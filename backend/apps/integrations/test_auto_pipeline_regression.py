"""AUTO-38.4 — Sample-email regression: PO → SO → fulfillment → invoice.

Deterministic end-to-end tests for the zero-touch email automation pipeline.
Uses stable factory fixtures and exercises the full chain:

  EmailLog (draft_created, confidence ≥ 0.98)
    → create_purchase_order_from_email
    → generate_sales_order_from_po
    → trigger_fulfillment
    → generate_invoice_from_so

Each step is tested individually AND as a chain to ensure:
  1. Happy-path produces PO → SO → Confirmed SO → Draft Invoice
  2. Idempotency: re-running any step is safe
  3. Missing/null inputs degrade gracefully (no crash, returns None)
  4. Phase-38 reliability semantics (failure_code, status_metadata) preserved
"""

from django.test import TestCase, override_settings

from apps.core.tests.factories import (
    CustomerFactory,
    EmailLogFactory,
    PurchaseOrderFactory,
    SalesOrderFactory,
    SupplierFactory,
    TenantFactory,
)
from apps.integrations.auto_pipeline import (
    create_purchase_order_from_email,
    generate_invoice_from_so,
    generate_sales_order_from_po,
    trigger_fulfillment,
)
from apps.integrations.models import EmailLog


def _run(task, *args):
    """Execute a bound Celery task synchronously, returning the result."""
    return task.apply(args=args).result


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class TestEmailToPOCreation(TestCase):
    """Step 1: EmailLog → PurchaseOrder."""

    def setUp(self):
        self.tenant = TenantFactory()
        self.tid = str(self.tenant.id)
        self.supplier = SupplierFactory(tenant=self.tenant, name="Acme Meats")

    def _make_email(self, *, confidence=0.99, draft_type="purchase_order", **overrides):
        extracted = {
            "confidence": confidence,
            "draft_type": draft_type,
            "contact_company": "Acme Meats",
            "requested_product_name": "80/20 Ground Beef",
            "requested_quantity": "5000",
            "summary": "Urgent PO request from buyer",
            **overrides,
        }
        return EmailLogFactory(
            tenant=self.tenant,
            status="draft_created",
            extracted_data=extracted,
            subject="PO Request: Ground Beef",
        )

    def test_happy_path_creates_po(self):
        email = self._make_email()
        po_id = _run(create_purchase_order_from_email, email.id, self.tid)

        self.assertIsNotNone(po_id)

        from tenant_apps.purchase_orders.models import PurchaseOrder

        po = PurchaseOrder.objects.get(id=po_id)
        self.assertEqual(po.tenant_id, self.tenant.id)
        self.assertEqual(po.supplier_id, self.supplier.id)
        self.assertEqual(po.item_description, "80/20 Ground Beef")
        self.assertEqual(po.quantity, 5000)
        self.assertIn("Auto-created from email", po.notes)

        email.refresh_from_db()
        self.assertEqual(email.status, "order_created")
        self.assertEqual(email.related_order_id, po_id)

    def test_idempotent_returns_existing_po(self):
        email = self._make_email()
        po_id_1 = _run(create_purchase_order_from_email, email.id, self.tid)
        po_id_2 = _run(create_purchase_order_from_email, email.id, self.tid)
        self.assertEqual(po_id_1, po_id_2)

    def test_auto_creates_supplier_if_unknown(self):
        email = self._make_email(contact_company="New Vendor LLC")
        po_id = _run(create_purchase_order_from_email, email.id, self.tid)
        self.assertIsNotNone(po_id)

        from tenant_apps.suppliers.models import Supplier

        self.assertTrue(
            Supplier.objects.filter(tenant=self.tenant, name="New Vendor LLC").exists()
        )

    def test_missing_email_returns_none(self):
        result = _run(create_purchase_order_from_email, 999999, self.tid)
        self.assertIsNone(result)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class TestPOToSOGeneration(TestCase):
    """Step 2: PurchaseOrder → SalesOrder."""

    def setUp(self):
        self.tenant = TenantFactory()
        self.tid = str(self.tenant.id)
        self.supplier = SupplierFactory(tenant=self.tenant)
        self.po = PurchaseOrderFactory(
            tenant=self.tenant,
            supplier=self.supplier,
            item_description="Boneless Chicken Breast",
            quantity=2000,
        )

    def test_happy_path_creates_so_and_inquiry_lineage(self):
        so_id = _run(generate_sales_order_from_po, self.po.id, self.tid)
        self.assertIsNotNone(so_id)

        from tenant_apps.inquiries.models import Inquiry
        from tenant_apps.sales_orders.models import SalesOrder

        so = SalesOrder.objects.get(id=so_id)
        self.assertEqual(so.tenant_id, self.tenant.id)
        self.assertEqual(so.supplier_id, self.supplier.id)
        self.assertEqual(so.status, "draft")

        # Verify inquiry lineage was created
        from tenant_apps.inquiries.models import Inquiry

        inquiry = Inquiry.objects.get(
            tenant=self.tenant, supplier_purchase_order=self.po
        )
        self.assertEqual(inquiry.sales_order_id, so_id)
        self.assertEqual(inquiry.source_type, "email")

    def test_idempotent_returns_existing_so(self):
        so_id_1 = _run(generate_sales_order_from_po, self.po.id, self.tid)
        so_id_2 = _run(generate_sales_order_from_po, self.po.id, self.tid)
        self.assertEqual(so_id_1, so_id_2)

    def test_none_po_id_returns_none(self):
        result = _run(generate_sales_order_from_po, None, self.tid)
        self.assertIsNone(result)

    def test_missing_po_returns_none(self):
        result = _run(generate_sales_order_from_po, 999999, self.tid)
        self.assertIsNone(result)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class TestFulfillmentTrigger(TestCase):
    """Step 3: SO draft → SO confirmed."""

    def setUp(self):
        self.tenant = TenantFactory()
        self.tid = str(self.tenant.id)
        self.so = SalesOrderFactory(tenant=self.tenant, status="draft")

    def test_happy_path_confirms_so(self):
        result = _run(trigger_fulfillment, self.so.id, self.tid)
        self.assertIsNotNone(result)
        self.assertEqual(result["action"], "confirmed")

        self.so.refresh_from_db()
        self.assertEqual(self.so.status, "confirmed")

    def test_idempotent_skips_already_confirmed(self):
        self.so.status = "confirmed"
        self.so.save(update_fields=["status"])

        result = _run(trigger_fulfillment, self.so.id, self.tid)
        self.assertEqual(result["action"], "none")

    def test_none_so_id_returns_none(self):
        result = _run(trigger_fulfillment, None, self.tid)
        self.assertIsNone(result)

    def test_missing_so_returns_none(self):
        result = _run(trigger_fulfillment, 999999, self.tid)
        self.assertIsNone(result)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class TestInvoiceGeneration(TestCase):
    """Step 4: Confirmed SO → Draft Invoice."""

    def setUp(self):
        self.tenant = TenantFactory()
        self.tid = str(self.tenant.id)
        self.customer = CustomerFactory(tenant=self.tenant)
        self.so = SalesOrderFactory(
            tenant=self.tenant,
            customer=self.customer,
            status="confirmed",
            our_sales_order_num="SO-TEST-001",
        )

    def test_happy_path_creates_draft_invoice(self):
        fulfillment = {"so_id": self.so.id, "status": "confirmed", "action": "confirmed"}
        result = _run(generate_invoice_from_so, fulfillment, self.tid)

        self.assertIsNotNone(result)
        self.assertEqual(result["action"], "created")

        from tenant_apps.invoices.models import Invoice

        invoice = Invoice.objects.get(id=result["invoice_id"])
        self.assertEqual(invoice.tenant_id, self.tenant.id)
        self.assertEqual(invoice.customer_id, self.customer.id)
        self.assertEqual(invoice.sales_order_id, self.so.id)
        self.assertEqual(invoice.status, "draft")

    def test_idempotent_skips_existing_invoice(self):
        fulfillment = {"so_id": self.so.id}
        result_1 = _run(generate_invoice_from_so, fulfillment, self.tid)
        result_2 = _run(generate_invoice_from_so, fulfillment, self.tid)
        self.assertEqual(result_1["invoice_id"], result_2["invoice_id"])
        self.assertEqual(result_2["action"], "none")

    def test_none_input_returns_none(self):
        self.assertIsNone(_run(generate_invoice_from_so, None, self.tid))
        self.assertIsNone(_run(generate_invoice_from_so, {}, self.tid))

    def test_missing_so_returns_none(self):
        result = _run(generate_invoice_from_so, {"so_id": 999999}, self.tid)
        self.assertIsNone(result)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class TestFullPipelineEndToEnd(TestCase):
    """Complete chain: EmailLog → PO → SO → Confirm → Invoice."""

    def setUp(self):
        self.tenant = TenantFactory()
        self.tid = str(self.tenant.id)
        self.supplier = SupplierFactory(
            tenant=self.tenant, name="Prime Beef Suppliers"
        )
        self.customer = CustomerFactory(tenant=self.tenant, name="FastFood Chain")

    def test_full_chain_produces_all_entities(self):
        """The entire email-to-invoice pipeline produces correct entities."""
        email = EmailLogFactory(
            tenant=self.tenant,
            status="draft_created",
            subject="Quote accepted — 10,000 lbs ground beef",
            extracted_data={
                "confidence": 0.99,
                "draft_type": "purchase_order",
                "contact_company": "Prime Beef Suppliers",
                "requested_product_name": "73/27 Ground Beef",
                "requested_quantity": "10000",
                "summary": "Customer accepted quote, proceed with PO",
            },
        )

        # Step 1: Email → PO
        po_id = _run(create_purchase_order_from_email, email.id, self.tid)
        self.assertIsNotNone(po_id, "Step 1 should create a PurchaseOrder")

        # Step 2: PO → SO (creates inquiry lineage)
        so_id = _run(generate_sales_order_from_po, po_id, self.tid)
        self.assertIsNotNone(so_id, "Step 2 should create a SalesOrder")

        # Link customer to inquiry for invoice step
        from tenant_apps.inquiries.models import Inquiry
        from tenant_apps.sales_orders.models import SalesOrder as SO_Model

        inquiry = Inquiry.objects.get(
            tenant=self.tenant, supplier_purchase_order_id=po_id
        )
        inquiry.customer = self.customer
        inquiry.save(update_fields=["customer"])

        # Also update the SO's customer (simulates operator assignment)
        so_obj = SO_Model.objects.get(id=so_id)
        so_obj.customer = self.customer
        so_obj.save(update_fields=["customer"])

        # Step 3: SO → Confirmed
        fulfillment = _run(trigger_fulfillment, so_id, self.tid)
        self.assertIsNotNone(fulfillment)
        self.assertEqual(fulfillment["action"], "confirmed")

        # Step 4: Confirmed SO → Draft Invoice
        invoice_result = _run(generate_invoice_from_so, fulfillment, self.tid)
        self.assertIsNotNone(invoice_result)
        self.assertEqual(invoice_result["action"], "created")

        # Verify final state
        from tenant_apps.invoices.models import Invoice
        from tenant_apps.purchase_orders.models import PurchaseOrder
        from tenant_apps.sales_orders.models import SalesOrder

        po = PurchaseOrder.objects.get(id=po_id)
        so = SalesOrder.objects.get(id=so_id)
        invoice = Invoice.objects.get(id=invoice_result["invoice_id"])

        self.assertEqual(po.supplier, self.supplier)
        self.assertEqual(so.supplier, self.supplier)
        self.assertEqual(invoice.customer, self.customer)
        self.assertEqual(invoice.sales_order, so)
        self.assertEqual(invoice.status, "draft")

        email.refresh_from_db()
        self.assertEqual(email.status, "order_created")
        self.assertEqual(email.related_order_id, po_id)
        self.assertEqual(email.failure_code, "")
        self.assertEqual(email.status_metadata, {})

    def test_full_chain_idempotent_on_rerun(self):
        """Re-running the entire chain produces no duplicates."""
        email = EmailLogFactory(
            tenant=self.tenant,
            status="draft_created",
            subject="Duplicate safety test",
            extracted_data={
                "confidence": 0.99,
                "draft_type": "purchase_order",
                "contact_company": "Prime Beef Suppliers",
                "requested_product_name": "Ribeye Steak",
                "requested_quantity": "500",
            },
        )

        po_1 = _run(create_purchase_order_from_email, email.id, self.tid)
        so_1 = _run(generate_sales_order_from_po, po_1, self.tid)
        _run(trigger_fulfillment, so_1, self.tid)

        # Re-run full chain — should be idempotent
        po_2 = _run(create_purchase_order_from_email, email.id, self.tid)
        so_2 = _run(generate_sales_order_from_po, po_2, self.tid)

        self.assertEqual(po_1, po_2)
        self.assertEqual(so_1, so_2)

        from tenant_apps.purchase_orders.models import PurchaseOrder
        from tenant_apps.sales_orders.models import SalesOrder

        self.assertEqual(PurchaseOrder.objects.filter(tenant=self.tenant).count(), 1)
        self.assertEqual(SalesOrder.objects.filter(tenant=self.tenant).count(), 1)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class TestPhase38ReliabilitySemantics(TestCase):
    """Verify Phase 38 failure contract fields are preserved."""

    def setUp(self):
        self.tenant = TenantFactory()
        self.tid = str(self.tenant.id)

    def test_successful_po_clears_failure_fields(self):
        """After PO creation, failure_code and status_metadata are cleared."""
        SupplierFactory(tenant=self.tenant, name="Test Supplier")
        email = EmailLogFactory(
            tenant=self.tenant,
            status="draft_created",
            failure_code="PREVIOUS_ERROR",
            status_metadata={"old": "metadata"},
            extracted_data={
                "confidence": 0.99,
                "draft_type": "purchase_order",
                "contact_company": "Test Supplier",
                "requested_product_name": "Test Product",
            },
        )

        po_id = _run(create_purchase_order_from_email, email.id, self.tid)
        self.assertIsNotNone(po_id)

        email.refresh_from_db()
        self.assertEqual(email.failure_code, "")
        self.assertEqual(email.status_metadata, {})

    def test_mark_as_draft_created_clears_failure_fields(self):
        """mark_as_draft_created resets reliability fields."""
        email = EmailLogFactory(
            tenant=self.tenant,
            status="failed",
            failure_code="OUTLOOK_TOKEN_REFRESH_FAILED",
            status_metadata={"code": "OUTLOOK_TOKEN_REFRESH_FAILED", "retryable": False},
        )

        email.mark_as_draft_created(
            extracted_data={"confidence": 0.95, "draft_type": "purchase_order"}
        )
        email.refresh_from_db()

        self.assertEqual(email.status, "draft_created")
        self.assertEqual(email.failure_code, "")
        self.assertEqual(email.status_metadata, {})

    def test_mark_as_failed_populates_failure_fields(self):
        """mark_as_failed sets failure_code and status_metadata."""
        email = EmailLogFactory(tenant=self.tenant, status="ai_parsing")

        email.mark_as_failed(
            error_message="Decryption error",
            failure={"code": "DECRYPTION_FAILED", "retryable": True, "category": "crypto"},
        )
        email.refresh_from_db()

        self.assertEqual(email.status, "failed")
        self.assertEqual(email.failure_code, "DECRYPTION_FAILED")
        self.assertTrue(email.status_metadata.get("retryable"))
