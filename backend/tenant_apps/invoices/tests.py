"""
Tests for Invoices app models.

Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid
from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from tenant_apps.customers.models import Customer
from tenant_apps.invoices.models import Invoice, InvoiceItem, InvoiceStatus, PaymentTransaction
from tenant_apps.invoices.serializers import InvoiceSerializer

from apps.tenants.models import Tenant, TenantUser


class InvoiceModelTest(TestCase):
    """Test cases for Invoice model."""

    def setUp(self):
        """Set up test data with tenant context."""
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"testuser-{unique_id}", email=f"test-{unique_id}@example.com", password="testpass123"
        )
        self.tenant = Tenant.objects.create(
            name=f"Test Company {unique_id}",
            slug=f"test-company-{unique_id}",
            contact_email=f"admin-{unique_id}@testcompany.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")

        self.customer = Customer.objects.create(
            name=f"Test Customer {unique_id}",
            email=f"customer-{unique_id}@test.com",
            tenant=self.tenant,
        )

    def test_create_invoice(self):
        """Test creating an invoice."""
        unique_id = uuid.uuid4().hex[:8]
        invoice = Invoice.objects.create(
            invoice_number=f"INV-{unique_id}",
            customer=self.customer,
            total_amount=Decimal("1500.00"),
            status=InvoiceStatus.DRAFT,
            tenant=self.tenant,
        )

        self.assertEqual(invoice.invoice_number, f"INV-{unique_id}")
        self.assertEqual(invoice.customer, self.customer)
        self.assertEqual(invoice.total_amount, Decimal("1500.00"))
        self.assertEqual(invoice.status, "draft")
        self.assertEqual(invoice.tenant, self.tenant)

    def test_invoice_str_representation(self):
        """Test the string representation of an invoice."""
        unique_id = uuid.uuid4().hex[:8]
        invoice = Invoice.objects.create(
            invoice_number=f"INV-{unique_id}",
            customer=self.customer,
            total_amount=Decimal("2000.00"),
            tenant=self.tenant,
        )

        self.assertEqual(str(invoice), f"INV-INV-{unique_id}")

    def test_invoice_tenant_isolation(self):
        """Test that invoices are properly isolated by tenant."""
        unique_id = uuid.uuid4().hex[:8]

        # Create invoice for first tenant
        inv1 = Invoice.objects.create(
            invoice_number=f"INV1-{unique_id}",
            customer=self.customer,
            total_amount=Decimal("1000.00"),
            tenant=self.tenant,
        )

        # Create second tenant
        other_user = User.objects.create_user(
            username=f"otheruser-{unique_id}", email=f"other-{unique_id}@example.com", password="testpass123"
        )
        other_tenant = Tenant.objects.create(
            name=f"Other Company {unique_id}",
            slug=f"other-company-{unique_id}",
            contact_email=f"admin-{unique_id}@othercompany.com",
            created_by=other_user,
        )
        other_customer = Customer.objects.create(
            name=f"Other Customer {unique_id}",
            tenant=other_tenant,
        )

        # Create invoice for second tenant
        inv2 = Invoice.objects.create(
            invoice_number=f"INV2-{unique_id}",
            customer=other_customer,
            total_amount=Decimal("2000.00"),
            tenant=other_tenant,
        )

        # Verify isolation
        tenant1_invoices = Invoice.objects.for_tenant(self.tenant)
        tenant2_invoices = Invoice.objects.for_tenant(other_tenant)

        self.assertEqual(tenant1_invoices.count(), 1)
        self.assertEqual(tenant2_invoices.count(), 1)
        self.assertIn(inv1, tenant1_invoices)
        self.assertNotIn(inv2, tenant1_invoices)

    def test_invoice_alias_fields_sync(self):
        """Canonical aliases sync to legacy invoice references."""
        unique_id = uuid.uuid4().hex[:8]
        invoice = Invoice.objects.create(
            invoice_number=f"INV-{unique_id}",
            customer=self.customer,
            our_sales_order_number_for_customer=f"SO-{unique_id}",
            delivery_po_number=f"DPO-{unique_id}",
            tenant=self.tenant,
        )

        self.assertEqual(invoice.our_sales_order_num, f"SO-{unique_id}")
        self.assertEqual(invoice.delivery_po_num, f"DPO-{unique_id}")

    def test_invoice_item_inherits_tenant(self):
        """Invoice items inherit their parent tenant."""
        unique_id = uuid.uuid4().hex[:8]
        invoice = Invoice.objects.create(
            invoice_number=f"INV-{unique_id}",
            customer=self.customer,
            tenant=self.tenant,
        )

        item = InvoiceItem.objects.create(
            invoice=invoice,
            quantity=3,
        )

        self.assertEqual(item.tenant, self.tenant)
        self.assertEqual(item.invoice, invoice)

    def test_invoice_serializer_exposes_trade_invariants(self):
        unique_id = uuid.uuid4().hex[:8]
        invoice = Invoice.objects.create(
            invoice_number=f"INV-{unique_id}",
            customer=self.customer,
            total_amount=Decimal("1500.00"),
            total_weight=Decimal("1000.50"),
            weight_unit="LBS",
            due_date=date(2026, 1, 15),
            tenant=self.tenant,
        )

        data = InvoiceSerializer(invoice).data

        self.assertEqual(data["trade_weight"]["normalized_lbs"], "1000.50")
        self.assertEqual(data["trade_weight"]["normalized_kg"], "453.82")
        self.assertEqual(data["trade_timeline"]["date_fields"]["due_date"], "2026-01-15")

    def test_payment_transaction_reconciles_invoice_outstanding_balance(self):
        unique_id = uuid.uuid4().hex[:8]
        invoice = Invoice.objects.create(
            invoice_number=f"INV-{unique_id}",
            customer=self.customer,
            total_amount=Decimal("900.00"),
            status=InvoiceStatus.DRAFT,
            tenant=self.tenant,
        )

        PaymentTransaction.objects.create(
            tenant=self.tenant,
            invoice=invoice,
            amount=Decimal("300.00"),
            payment_date=date(2026, 2, 1),
            created_by=self.user,
        )

        invoice.refresh_from_db()
        self.assertEqual(invoice.outstanding_amount, Decimal("600.00"))
        self.assertEqual(invoice.payment_status, "partial")
        self.assertEqual(invoice.status, InvoiceStatus.DRAFT)

        PaymentTransaction.objects.create(
            tenant=self.tenant,
            invoice=invoice,
            amount=Decimal("600.00"),
            payment_date=date(2026, 2, 2),
            created_by=self.user,
        )

        invoice.refresh_from_db()
        self.assertEqual(invoice.outstanding_amount, Decimal("0.00"))
        self.assertEqual(invoice.payment_status, "paid")
        self.assertEqual(invoice.status, InvoiceStatus.PAID)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class InvoiceDocumentOperationsAPITests(APITestCase):
    """API coverage for invoice workflow and document actions."""

    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"invoice-doc-{unique_id}",
            email=f"invoice-doc-{unique_id}@example.com",
            password="testpass123",
        )
        self.client.force_login(self.user)
        self.tenant = Tenant.objects.create(
            name=f"Invoice Tenant {unique_id}",
            slug=f"invoice-tenant-{unique_id}",
            contact_email=f"invoice-doc-{unique_id}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner", is_active=True)
        self.customer = Customer.objects.create(
            name=f"Invoice Customer {unique_id}",
            email=f"customer-{unique_id}@example.com",
            tenant=self.tenant,
        )
        self.invoice = Invoice.objects.create(
            tenant=self.tenant,
            customer=self.customer,
            invoice_number=f"INV-{unique_id}",
            total_amount=Decimal("900.00"),
            status=InvoiceStatus.DRAFT,
        )
        self.tenant_header = {"HTTP_X_TENANT_ID": str(self.tenant.id)}

    def test_invoice_patch_rejects_invalid_status_transition(self):
        response = self.client.patch(
            f"/api/v1/accounting/invoices/{self.invoice.id}/",
            {"status": InvoiceStatus.PAID},
            format="json",
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.data)

    def test_invoice_email_endpoint_sends_pdf_attachment(self):
        response = self.client.post(
            f"/api/v1/accounting/invoices/{self.invoice.id}/email/",
            {
                "to": ["ap@example.com"],
                "subject": "Invoice package",
                "body": "Attached is your invoice.",
            },
            format="json",
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["ap@example.com"])
        self.assertEqual(mail.outbox[0].attachments[0][2], "application/pdf")


class PaymentTransactionFilterApiTests(APITestCase):
    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"payment-filter-{unique_id}",
            email=f"payment-filter-{unique_id}@example.com",
            password="testpass123",
        )
        self.client.force_login(self.user)
        self.tenant = Tenant.objects.create(
            name=f"Payment Filter Tenant {unique_id}",
            slug=f"payment-filter-tenant-{unique_id}",
            contact_email=f"payment-filter-{unique_id}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner", is_active=True)
        self.customer = Customer.objects.create(
            name=f"Filter Customer {unique_id}",
            email=f"filter-customer-{unique_id}@example.com",
            tenant=self.tenant,
        )
        self.invoice = Invoice.objects.create(
            tenant=self.tenant,
            customer=self.customer,
            invoice_number=f"INV-FILTER-{unique_id}",
            total_amount=Decimal("900.00"),
        )
        other_invoice = Invoice.objects.create(
            tenant=self.tenant,
            customer=self.customer,
            invoice_number=f"INV-OTHER-{unique_id}",
            total_amount=Decimal("400.00"),
        )
        PaymentTransaction.objects.create(
            tenant=self.tenant,
            invoice=self.invoice,
            amount=Decimal("300.00"),
            payment_date=date(2026, 2, 1),
            created_by=self.user,
        )
        PaymentTransaction.objects.create(
            tenant=self.tenant,
            invoice=other_invoice,
            amount=Decimal("100.00"),
            payment_date=date(2026, 2, 2),
            created_by=self.user,
        )
        self.tenant_header = {"HTTP_X_TENANT_ID": str(self.tenant.id)}

    def test_list_filters_payments_by_invoice_query_param(self):
        response = self.client.get(
            f"/api/v1/accounting/payments/?invoice={self.invoice.id}",
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["invoice"], self.invoice.id)
