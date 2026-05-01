"""Command coverage for the GA-03.2 archive snapshot flow."""

from __future__ import annotations

import json
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from django.utils import timezone

from apps.core.models import ArchiveBatch, ArchiveLegalHold, ArchiveRecordSnapshot
from apps.core.services.data_governance import subtract_years
from apps.tenants.models import Tenant, TenantUser
from tenant_apps.purchase_orders.models import PurchaseOrder, PurchaseOrderItem
from tenant_apps.suppliers.models import Supplier


PURCHASE_ORDER_LABEL = "tenant_apps.purchase_orders.models.PurchaseOrder"
PURCHASE_ORDER_ITEM_LABEL = "tenant_apps.purchase_orders.models.PurchaseOrderItem"


class ArchiveHistoricalRecordsCommandTests(TestCase):
    """Exercise dry-run and execute archive flows without purging live rows."""

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
        self.supplier = Supplier.objects.create(
            tenant=self.tenant,
            name="Archive Supplier",
            email="supplier@example.com",
            phone="5551112222",
        )
        self.other_supplier = Supplier.objects.create(
            tenant=self.other_tenant,
            name="Other Supplier",
            email="other-supplier@example.com",
            phone="5554448888",
        )
        cutoff = subtract_years(timezone.now().date())
        self.old_date = cutoff.replace(year=cutoff.year - 1)
        self.recent_date = timezone.now().date()

        self.held_order = PurchaseOrder.objects.create(
            tenant=self.tenant,
            order_number="PO-HOLD",
            supplier=self.supplier,
            order_date=self.old_date,
        )
        self.free_order = PurchaseOrder.objects.create(
            tenant=self.tenant,
            order_number="PO-FREE",
            supplier=self.supplier,
            order_date=self.old_date,
        )
        self.recent_order = PurchaseOrder.objects.create(
            tenant=self.tenant,
            order_number="PO-RECENT",
            supplier=self.supplier,
            order_date=self.recent_date,
        )
        self.deleted_order = PurchaseOrder.objects.create(
            tenant=self.tenant,
            order_number="PO-DELETED",
            supplier=self.supplier,
            order_date=self.old_date,
        )
        self.held_item = PurchaseOrderItem.objects.create(purchase_order=self.held_order, line_number=1)
        self.free_item = PurchaseOrderItem.objects.create(purchase_order=self.free_order, line_number=1)
        self.deleted_item = PurchaseOrderItem.objects.create(purchase_order=self.deleted_order, line_number=1)
        self.deleted_order.soft_delete()

        self.other_order = PurchaseOrder.objects.create(
            tenant=self.other_tenant,
            order_number="PO-OTHER",
            supplier=self.other_supplier,
            order_date=self.old_date,
        )
        self.other_item = PurchaseOrderItem.objects.create(purchase_order=self.other_order, line_number=1)

        self.requesting_user = get_user_model().objects.create_user(
            username="tenant-archiver",
            email="tenant-archiver@example.com",
            password="testpass123",
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.requesting_user, role="admin")

        ArchiveLegalHold.objects.create(
            tenant=self.tenant,
            scope_model=PURCHASE_ORDER_LABEL,
            scope_selector={"object_ids": [str(self.held_order.pk)]},
            reason_code="litigation",
            placed_by_email="legal@example.com",
        )

    def test_execute_requires_approval_evidence(self) -> None:
        with self.assertRaises(CommandError):
            call_command(
                "archive_historical_records",
                "--tenant-slug",
                self.tenant.slug,
                "--execute",
                stdout=StringIO(),
            )

    def test_dry_run_reports_eligible_records_without_creating_snapshots(self) -> None:
        out = StringIO()

        call_command(
            "archive_historical_records",
            "--tenant-slug",
            self.tenant.slug,
            "--model-label",
            PURCHASE_ORDER_LABEL,
            "--format",
            "json",
            stdout=out,
        )

        rendered = json.loads(out.getvalue())
        summary = rendered["batch_run"]["summary"]

        self.assertEqual(summary["dry_run_record_count"], 1)
        self.assertEqual(summary["archived_record_count"], 0)
        self.assertEqual(summary["legal_hold_skip_count"], 1)
        self.assertEqual(ArchiveBatch.objects.count(), 1)
        self.assertEqual(ArchiveRecordSnapshot.objects.count(), 0)
        self.assertEqual(summary["model_summaries"][0]["eligible_record_count"], 1)
        self.assertEqual(summary["model_summaries"][0]["legal_hold_skip_count"], 1)

    def test_execute_snapshots_line_items_and_skips_parent_legal_holds(self) -> None:
        out = StringIO()

        call_command(
            "archive_historical_records",
            "--tenant-slug",
            self.tenant.slug,
            "--model-label",
            PURCHASE_ORDER_ITEM_LABEL,
            "--execute",
            "--approved-email",
            "approver@example.com",
            "--requested-user-id",
            str(self.requesting_user.pk),
            "--format",
            "json",
            stdout=out,
        )

        rendered = json.loads(out.getvalue())
        summary = rendered["batch_run"]["summary"]

        self.assertEqual(summary["dry_run_record_count"], 0)
        self.assertEqual(summary["archived_record_count"], 1)
        self.assertEqual(summary["legal_hold_skip_count"], 1)
        self.assertEqual(ArchiveBatch.objects.count(), 1)
        self.assertEqual(ArchiveRecordSnapshot.objects.count(), 1)

        snapshot = ArchiveRecordSnapshot.objects.get()
        self.assertEqual(snapshot.model_label, PURCHASE_ORDER_ITEM_LABEL)
        self.assertEqual(snapshot.object_pk, str(self.free_item.pk))
        self.assertEqual(snapshot.parent_model_label, PURCHASE_ORDER_LABEL)
        self.assertEqual(snapshot.parent_object_pk, str(self.free_order.pk))
        self.assertEqual(snapshot.snapshot_payload["field_values"]["purchase_order_id"], self.free_order.pk)
        self.assertTrue(snapshot.payload_checksum)
        self.assertNotEqual(snapshot.object_pk, str(self.held_item.pk))
        self.assertNotEqual(snapshot.object_pk, str(self.deleted_item.pk))
        self.assertNotEqual(snapshot.object_pk, str(self.other_item.pk))

        batch = ArchiveBatch.objects.get()
        self.assertEqual(batch.approved_by_email, "approver@example.com")
        self.assertEqual(batch.requested_by_id, self.requesting_user.pk)

    def test_execute_rerun_reuses_same_batch_and_snapshot(self) -> None:
        first = StringIO()
        second = StringIO()

        for output in (first, second):
            call_command(
                "archive_historical_records",
                "--tenant-slug",
                self.tenant.slug,
                "--model-label",
                PURCHASE_ORDER_ITEM_LABEL,
                "--execute",
                "--approved-email",
                "approver@example.com",
                "--format",
                "json",
                stdout=output,
            )

        self.assertEqual(ArchiveBatch.objects.count(), 1)
        self.assertEqual(ArchiveRecordSnapshot.objects.count(), 1)

    def test_requested_user_must_belong_to_selected_tenant(self) -> None:
        outsider = get_user_model().objects.create_user(
            username="outsider",
            email="outsider@example.com",
            password="testpass123",
        )
        TenantUser.objects.create(tenant=self.other_tenant, user=outsider, role="admin")

        with self.assertRaises(CommandError):
            call_command(
                "archive_historical_records",
                "--tenant-slug",
                self.tenant.slug,
                "--model-label",
                PURCHASE_ORDER_ITEM_LABEL,
                "--execute",
                "--approved-email",
                "approver@example.com",
                "--requested-user-id",
                str(outsider.pk),
                stdout=StringIO(),
            )
