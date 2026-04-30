"""End-to-end dry-run command coverage for GA-01.2."""

from __future__ import annotations

import json
import shutil
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.system.models import Product, ProductCategoryChoices
from apps.core.models import ETLImportBatch, ETLImportRowJournal
from apps.tenants.models import Tenant
from tenant_apps.carriers.models import Carrier
from tenant_apps.contacts.models import Contact
from tenant_apps.customers.models import Customer
from tenant_apps.invoices.models import Invoice, InvoiceItem
from tenant_apps.locations.models import Location
from tenant_apps.plants.models import Plant
from tenant_apps.products.models import MasterProduct
from tenant_apps.purchase_orders.models import (
    CarrierPOItem,
    CarrierPurchaseOrder,
    PurchaseOrder,
    PurchaseOrderItem,
)
from tenant_apps.sales_orders.models import SalesOrder, SalesOrderItem
from tenant_apps.suppliers.models import Supplier


DRY_RUN_MANIFEST_PATH = (
    Path(__file__).resolve().parent / "fixtures" / "etl" / "dry_run_manifest.json"
)
MASTER_DATA_MANIFEST_PATH = (
    Path(__file__).resolve().parent / "fixtures" / "etl" / "master_data_apply_manifest.json"
)
TRANSACTIONAL_MANIFEST_PATH = (
    Path(__file__).resolve().parent / "fixtures" / "etl" / "transactional_apply_manifest.json"
)
ETL_FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "etl"


class ImportGoldenLegacyDataCommandTests(TestCase):
    """Exercise the journal-write-only ETL dry-run path."""

    def setUp(self) -> None:
        self.tenant = Tenant.objects.create(
            name="ACME Meats",
            slug="acme-meats",
            schema_name="acme_meats",
            contact_email="ops@acme-meats.example",
            is_active=True,
        )
        self.other_tenant = Tenant.objects.create(
            name="Other Meats",
            slug="other-meats",
            schema_name="other_meats",
            contact_email="ops@other-meats.example",
            is_active=True,
        )
        Supplier.objects.create(
            tenant=self.tenant,
            name='Existing Supplier',
            email='existing-supplier@example.com',
            phone='5551112222',
        )
        Supplier.objects.create(
            tenant=self.tenant,
            name='Update Supplier',
            email='update-supplier@example.com',
            phone='5550001111',
        )
        Supplier.objects.create(
            tenant=self.other_tenant,
            name='Cross Tenant Supplier',
            email='cross-tenant@example.com',
            phone='5558889999',
        )
        Supplier.objects.create(
            tenant=self.other_tenant,
            name='Alpha Supplier',
            email='alpha-supplier@example.com',
            phone='5559990000',
        )
        Customer.objects.create(
            tenant=self.other_tenant,
            name='Beta Customer',
            email='beta-customer@example.com',
            phone='5559991000',
        )
        MasterProduct.objects.create(
            tenant=self.other_tenant,
            protein='Beef',
            item_name='Brisket',
            type='whole',
            trim='trimmed',
        )
        self.system_product = Product.objects.create(
            product_code='BEEF-BRISKET-001',
            name='Brisket',
            description='System brisket product',
            category=ProductCategoryChoices.BEEF,
            protein_type='beef',
            fresh_or_frozen='FRESH',
            package_type='Combo bins',
        )

    def test_command_persists_dry_run_journals_without_writing_business_rows(self) -> None:
        out = StringIO()

        call_command(
            'import_golden_legacy_data',
            '--manifest',
            str(DRY_RUN_MANIFEST_PATH),
            '--format',
            'json',
            stdout=out,
        )

        rendered = json.loads(out.getvalue())
        summary = rendered['batch_run']['summary']

        self.assertEqual(summary['would_create_count'], 1)
        self.assertEqual(summary['would_update_count'], 1)
        self.assertEqual(summary['would_skip_count'], 1)
        self.assertEqual(summary['error_count'], 1)

        self.assertEqual(ETLImportBatch.objects.count(), 1)
        self.assertEqual(ETLImportRowJournal.objects.count(), 4)
        self.assertEqual(Supplier.objects.filter(tenant=self.tenant).count(), 2)

        decisions = {
            journal.source_identifier or f'row-{journal.source_row_number}': journal.planned_action
            for journal in ETLImportRowJournal.objects.order_by('source_row_number')
        }
        self.assertEqual(decisions['name=Existing Supplier|email=existing-supplier@example.com'], 'would_skip')
        self.assertEqual(decisions['name=Update Supplier|email=update-supplier@example.com'], 'would_update')
        self.assertEqual(decisions['name=New Supplier|email=new-supplier@example.com'], 'would_create')
        self.assertEqual(
            ETLImportRowJournal.objects.get(error_code='missing_natural_key').planned_action,
            ETLImportRowJournal.PlannedAction.ERROR,
        )

    def test_rerun_reuses_same_batch_and_row_journals(self) -> None:
        first = StringIO()
        second = StringIO()

        call_command(
            'import_golden_legacy_data',
            '--manifest',
            str(DRY_RUN_MANIFEST_PATH),
            '--format',
            'json',
            stdout=first,
        )
        call_command(
            'import_golden_legacy_data',
            '--manifest',
            str(DRY_RUN_MANIFEST_PATH),
            '--format',
            'json',
            stdout=second,
        )

        self.assertEqual(ETLImportBatch.objects.count(), 1)
        self.assertEqual(ETLImportRowJournal.objects.count(), 4)

    def test_failed_source_load_marks_batch_failed(self) -> None:
        with TemporaryDirectory() as tmpdir:
            manifest_path = Path(tmpdir) / 'missing-source-manifest.json'
            manifest_path.write_text(
                json.dumps(
                    {
                        'batch_name': 'acme-failed-dry-run',
                        'source_system': 'legacy_json_bundle',
                        'tenant_slug': self.tenant.slug,
                        'sources': [
                            {
                                'entity': 'suppliers',
                                'format': 'json',
                                'path': 'missing-source.json',
                            }
                        ],
                    }
                ),
                encoding='utf-8',
            )

            with self.assertRaises(CommandError):
                call_command(
                    'import_golden_legacy_data',
                    '--manifest',
                    str(manifest_path),
                    '--format',
                    'json',
                    stdout=StringIO(),
                )

        batch = ETLImportBatch.objects.get(
            tenant=self.tenant,
            source_manifest__batch_name='acme-failed-dry-run',
        )
        self.assertEqual(batch.status, ETLImportBatch.Status.FAILED)
        self.assertIn('missing-source.json', batch.failure_message)

    def test_apply_mode_imports_master_data_without_cross_tenant_matching_or_workflow_triggers(self) -> None:
        out = StringIO()

        with patch('tenant_apps.workflows.models.TenantWorkflow.objects.filter') as workflow_filter:
            call_command(
                'import_golden_legacy_data',
                '--manifest',
                str(MASTER_DATA_MANIFEST_PATH),
                '--apply',
                '--format',
                'json',
                stdout=out,
            )

        workflow_filter.assert_not_called()

        rendered = json.loads(out.getvalue())
        summary = rendered['batch_run']['summary']

        self.assertEqual(rendered['batch_run']['mode'], ETLImportBatch.Mode.APPLY_MASTER_DATA)
        self.assertEqual(summary['created_count'], 8)
        self.assertEqual(summary['updated_count'], 0)
        self.assertEqual(summary['skipped_count'], 0)
        self.assertEqual(summary['error_count'], 0)

        self.assertEqual(MasterProduct.objects.filter(tenant=self.tenant).count(), 1)
        self.assertEqual(Supplier.objects.filter(tenant=self.tenant, name='Alpha Supplier').count(), 1)
        self.assertEqual(Customer.objects.filter(tenant=self.tenant, name='Beta Customer').count(), 1)
        self.assertEqual(Carrier.objects.filter(tenant=self.tenant, code='RAPID').count(), 1)
        self.assertEqual(Plant.objects.filter(tenant=self.tenant, name='Alpha Processing').count(), 1)
        self.assertEqual(Location.objects.filter(tenant=self.tenant, code='BETA-WH-1').count(), 1)
        self.assertEqual(Contact.objects.filter(tenant=self.tenant).count(), 2)

        supplier = Supplier.objects.get(tenant=self.tenant, name='Alpha Supplier')
        customer = Customer.objects.get(tenant=self.tenant, name='Beta Customer')
        plant = Plant.objects.get(tenant=self.tenant, name='Alpha Processing')
        location = Location.objects.get(tenant=self.tenant, code='BETA-WH-1')
        supplier_contact = Contact.objects.get(tenant=self.tenant, email='sales@alpha-supplier.example')
        customer_contact = Contact.objects.get(tenant=self.tenant, email='receiving@beta-customer.example')

        self.assertEqual(plant.supplier_id, supplier.id)
        self.assertEqual(location.customer_id, customer.id)
        self.assertEqual(supplier_contact.supplier_id, supplier.id)
        self.assertEqual(customer_contact.customer_id, customer.id)
        self.assertEqual(customer_contact.location_id, location.id)
        self.assertTrue(supplier.contacts.filter(pk=supplier_contact.pk).exists())
        self.assertTrue(customer.contacts.filter(pk=customer_contact.pk).exists())
        self.assertEqual(Supplier.objects.filter(tenant=self.other_tenant, name='Alpha Supplier').count(), 1)
        self.assertEqual(Customer.objects.filter(tenant=self.other_tenant, name='Beta Customer').count(), 1)
        self.assertEqual(MasterProduct.objects.filter(tenant=self.other_tenant).count(), 1)

    def test_apply_mode_rerun_reuses_batch_and_skips_existing_rows(self) -> None:
        first = StringIO()
        second = StringIO()

        call_command(
            'import_golden_legacy_data',
            '--manifest',
            str(MASTER_DATA_MANIFEST_PATH),
            '--apply',
            '--format',
            'json',
            stdout=first,
        )
        call_command(
            'import_golden_legacy_data',
            '--manifest',
            str(MASTER_DATA_MANIFEST_PATH),
            '--apply',
            '--format',
            'json',
            stdout=second,
        )

        rendered = json.loads(second.getvalue())
        summary = rendered['batch_run']['summary']

        self.assertEqual(ETLImportBatch.objects.count(), 1)
        self.assertEqual(ETLImportRowJournal.objects.count(), 8)
        self.assertEqual(summary['created_count'], 0)
        self.assertEqual(summary['updated_count'], 0)
        self.assertEqual(summary['skipped_count'], 8)

    def test_apply_mode_updates_existing_master_rows_in_place(self) -> None:
        call_command(
            'import_golden_legacy_data',
            '--manifest',
            str(MASTER_DATA_MANIFEST_PATH),
            '--apply',
            '--format',
            'json',
            stdout=StringIO(),
        )

        supplier = Supplier.objects.get(tenant=self.tenant, name='Alpha Supplier')
        original_supplier_pk = supplier.pk

        with TemporaryDirectory() as tmpdir:
            tmp_fixture_dir = Path(tmpdir) / 'etl'
            shutil.copytree(ETL_FIXTURE_DIR, tmp_fixture_dir)

            supplier_rows_path = tmp_fixture_dir / 'supplier_master_rows.json'
            supplier_rows = json.loads(supplier_rows_path.read_text(encoding='utf-8'))
            supplier_rows[0]['phone'] = '5551119999'
            supplier_rows_path.write_text(json.dumps(supplier_rows, indent=2), encoding='utf-8')

            out = StringIO()
            call_command(
                'import_golden_legacy_data',
                '--manifest',
                str(tmp_fixture_dir / 'master_data_apply_manifest.json'),
                '--apply',
                '--format',
                'json',
                stdout=out,
            )

        rendered = json.loads(out.getvalue())
        summary = rendered['batch_run']['summary']

        supplier.refresh_from_db()
        self.assertEqual(supplier.pk, original_supplier_pk)
        self.assertEqual(supplier.phone, '5551119999')
        self.assertEqual(summary['updated_count'], 1)
        self.assertEqual(summary['error_count'], 0)

    def test_apply_mode_does_not_blank_existing_supplier_email_when_reimport_row_has_no_email(self) -> None:
        call_command(
            'import_golden_legacy_data',
            '--manifest',
            str(MASTER_DATA_MANIFEST_PATH),
            '--apply',
            '--format',
            'json',
            stdout=StringIO(),
        )

        with TemporaryDirectory() as tmpdir:
            tmp_fixture_dir = Path(tmpdir) / 'etl'
            shutil.copytree(ETL_FIXTURE_DIR, tmp_fixture_dir)

            supplier_rows_path = tmp_fixture_dir / 'supplier_master_rows.json'
            supplier_rows = json.loads(supplier_rows_path.read_text(encoding='utf-8'))
            supplier_rows[0]['email'] = ''
            supplier_rows_path.write_text(json.dumps(supplier_rows, indent=2), encoding='utf-8')

            plant_rows_path = tmp_fixture_dir / 'plant_master_rows.json'
            plant_rows = json.loads(plant_rows_path.read_text(encoding='utf-8'))
            plant_rows[0]['supplier_email'] = ''
            plant_rows_path.write_text(json.dumps(plant_rows, indent=2), encoding='utf-8')

            call_command(
                'import_golden_legacy_data',
                '--manifest',
                str(tmp_fixture_dir / 'master_data_apply_manifest.json'),
                '--apply',
                '--format',
                'json',
                stdout=StringIO(),
            )

        suppliers = Supplier.objects.filter(tenant=self.tenant, name='Alpha Supplier').order_by('pk')
        plant = Plant.objects.get(tenant=self.tenant, plant_est_num='EST-100')
        self.assertEqual(suppliers.count(), 2)
        self.assertEqual(suppliers.first().email, 'alpha-supplier@example.com')
        self.assertIsNone(suppliers.last().email)
        self.assertEqual(plant.supplier_id, suppliers.last().id)

    def test_apply_mode_imports_transactional_rows_and_rerun_is_idempotent(self) -> None:
        call_command(
            'import_golden_legacy_data',
            '--manifest',
            str(MASTER_DATA_MANIFEST_PATH),
            '--apply',
            '--format',
            'json',
            stdout=StringIO(),
        )

        first = StringIO()
        second = StringIO()

        call_command(
            'import_golden_legacy_data',
            '--manifest',
            str(TRANSACTIONAL_MANIFEST_PATH),
            '--apply',
            '--format',
            'json',
            stdout=first,
        )
        rendered = json.loads(first.getvalue())
        summary = rendered['batch_run']['summary']

        self.assertEqual(rendered['batch_run']['mode'], ETLImportBatch.Mode.APPLY_TRANSACTIONS)
        self.assertEqual(rendered['batch_run']['execution_mode'], ETLImportBatch.Mode.APPLY_TRANSACTIONS)
        self.assertEqual(summary['created_count'], 8)
        self.assertEqual(summary['updated_count'], 0)
        self.assertEqual(summary['skipped_count'], 0)
        self.assertEqual(summary['error_count'], 0)
        self.assertEqual(rendered['error_report'], [])

        purchase_order = PurchaseOrder.objects.get(tenant=self.tenant, order_number='PO-1001')
        sales_order = SalesOrder.objects.get(tenant=self.tenant, our_sales_order_num='SO-2001')
        carrier_purchase_order = CarrierPurchaseOrder.objects.get(tenant=self.tenant, our_carrier_po_num='CPO-3001')
        invoice = Invoice.objects.get(tenant=self.tenant, invoice_number='INV-4001')
        purchase_order_item = PurchaseOrderItem.objects.get(tenant=self.tenant, purchase_order=purchase_order, line_number=1)
        sales_order_item = SalesOrderItem.objects.get(tenant=self.tenant, sales_order=sales_order, line_number=1)
        carrier_po_item = CarrierPOItem.objects.get(
            tenant=self.tenant,
            carrier_purchase_order=carrier_purchase_order,
            line_number=1,
        )
        invoice_item = InvoiceItem.objects.get(tenant=self.tenant, invoice=invoice, line_number=1)

        self.assertEqual(purchase_order.carrier.code, 'RAPID')
        self.assertEqual(purchase_order.delivery_location.code, 'BETA-WH-1')
        self.assertEqual(purchase_order.product_id, self.system_product.id)
        self.assertEqual(purchase_order.billing_contact_name, 'Alice Supplier')
        self.assertEqual(sales_order.customer.name, 'Beta Customer')
        self.assertEqual(sales_order.delivery_po_number, 'DEL-2001')
        self.assertEqual(carrier_purchase_order.linked_order_id, purchase_order.id)
        self.assertEqual(carrier_purchase_order.sales_order_id, sales_order.id)
        self.assertEqual(invoice.sales_order_id, sales_order.id)
        self.assertEqual(invoice.accounting_payable_contact_email, 'ap@beta-customer.example')
        self.assertEqual(purchase_order_item.product_description_id, self.system_product.id)
        self.assertEqual(sales_order_item.quantity, 20)
        self.assertEqual(carrier_po_item.total_net_weight, purchase_order_item.total_net_weight)
        self.assertEqual(str(invoice_item.line_total), '8500.00')

        call_command(
            'import_golden_legacy_data',
            '--manifest',
            str(TRANSACTIONAL_MANIFEST_PATH),
            '--apply',
            '--format',
            'json',
            stdout=second,
        )
        second_rendered = json.loads(second.getvalue())
        second_summary = second_rendered['batch_run']['summary']

        self.assertEqual(ETLImportBatch.objects.filter(mode=ETLImportBatch.Mode.APPLY_TRANSACTIONS).count(), 1)
        self.assertEqual(second_summary['created_count'], 0)
        self.assertEqual(second_summary['updated_count'], 0)
        self.assertEqual(second_summary['skipped_count'], 8)
        self.assertEqual(second_summary['error_count'], 0)

    def test_apply_mode_returns_transaction_reconciliation_errors(self) -> None:
        call_command(
            'import_golden_legacy_data',
            '--manifest',
            str(MASTER_DATA_MANIFEST_PATH),
            '--apply',
            '--format',
            'json',
            stdout=StringIO(),
        )

        with TemporaryDirectory() as tmpdir:
            tmp_fixture_dir = Path(tmpdir) / 'etl'
            shutil.copytree(ETL_FIXTURE_DIR, tmp_fixture_dir)

            invoice_item_rows_path = tmp_fixture_dir / 'invoice_item_rows.json'
            invoice_item_rows = json.loads(invoice_item_rows_path.read_text(encoding='utf-8'))
            invoice_item_rows[0]['invoice_number'] = 'INV-MISSING'
            invoice_item_rows_path.write_text(json.dumps(invoice_item_rows, indent=2), encoding='utf-8')

            out = StringIO()
            call_command(
                'import_golden_legacy_data',
                '--manifest',
                str(tmp_fixture_dir / 'transactional_apply_manifest.json'),
                '--apply',
                '--format',
                'json',
                stdout=out,
            )

        rendered = json.loads(out.getvalue())
        summary = rendered['batch_run']['summary']

        self.assertEqual(summary['created_count'], 7)
        self.assertEqual(summary['error_count'], 1)
        self.assertEqual(len(rendered['error_report']), 1)
        self.assertEqual(rendered['error_report'][0]['entity'], 'invoice_items')
        self.assertEqual(rendered['error_report'][0]['error_code'], 'parent_not_found')
        self.assertEqual(Invoice.objects.filter(tenant=self.tenant, invoice_number='INV-4001').count(), 1)
        self.assertEqual(InvoiceItem.objects.filter(tenant=self.tenant).count(), 0)
