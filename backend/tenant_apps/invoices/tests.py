"""
Tests for Invoices app models.

Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid
from datetime import date
from django.core import mail
from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from decimal import Decimal
from rest_framework import status
from rest_framework.test import APITestCase
from tenant_apps.invoices.models import Invoice, InvoiceItem, InvoiceStatus, PaymentTransaction
from tenant_apps.invoices.serializers import InvoiceSerializer
from tenant_apps.customers.models import Customer
from apps.tenants.models import Tenant, TenantUser


class InvoiceModelTest(TestCase):
    """Test cases for Invoice model."""

    def setUp(self):
        """Set up test data with tenant context."""
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"testuser-{unique_id}",
            email=f"test-{unique_id}@example.com",
            password="testpass123"
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
            username=f"otheruser-{unique_id}",
            email=f"other-{unique_id}@example.com",
            password="testpass123"
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
            username=f'payment-filter-{unique_id}',
            email=f'payment-filter-{unique_id}@example.com',
            password='testpass123',
        )
        self.client.force_login(self.user)
        self.tenant = Tenant.objects.create(
            name=f'Payment Filter Tenant {unique_id}',
            slug=f'payment-filter-tenant-{unique_id}',
            contact_email=f'payment-filter-{unique_id}@example.com',
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner', is_active=True)
        self.customer = Customer.objects.create(
            name=f'Filter Customer {unique_id}',
            email=f'filter-customer-{unique_id}@example.com',
            tenant=self.tenant,
        )
        self.invoice = Invoice.objects.create(
            tenant=self.tenant,
            customer=self.customer,
            invoice_number=f'INV-FILTER-{unique_id}',
            total_amount=Decimal('900.00'),
        )
        other_invoice = Invoice.objects.create(
            tenant=self.tenant,
            customer=self.customer,
            invoice_number=f'INV-OTHER-{unique_id}',
            total_amount=Decimal('400.00'),
        )
        PaymentTransaction.objects.create(
            tenant=self.tenant,
            invoice=self.invoice,
            amount=Decimal('300.00'),
            payment_date=date(2026, 2, 1),
            created_by=self.user,
        )
        PaymentTransaction.objects.create(
            tenant=self.tenant,
            invoice=other_invoice,
            amount=Decimal('100.00'),
            payment_date=date(2026, 2, 2),
            created_by=self.user,
        )
        self.tenant_header = {'HTTP_X_TENANT_ID': str(self.tenant.id)}

    def test_list_filters_payments_by_invoice_query_param(self):
        response = self.client.get(
            f'/api/v1/accounting/payments/?invoice={self.invoice.id}',
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['invoice'], self.invoice.id)


class InvoiceStatusTransitionTests(APITestCase):
    """Tests for invoice status transition validation via the API."""

    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"status-trans-{unique_id}",
            email=f"status-trans-{unique_id}@example.com",
            password="testpass123",
        )
        self.client.force_login(self.user)
        self.tenant = Tenant.objects.create(
            name=f"Transition Tenant {unique_id}",
            slug=f"transition-tenant-{unique_id}",
            contact_email=f"transition-{unique_id}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner", is_active=True)
        self.customer = Customer.objects.create(
            name=f"Transition Customer {unique_id}",
            email=f"trans-customer-{unique_id}@example.com",
            tenant=self.tenant,
        )
        self.invoice = Invoice.objects.create(
            tenant=self.tenant,
            customer=self.customer,
            invoice_number=f"INV-TRANS-{unique_id}",
            total_amount=Decimal("500.00"),
            status=InvoiceStatus.DRAFT,
        )
        self.tenant_header = {"HTTP_X_TENANT_ID": str(self.tenant.id)}

    def test_valid_status_transition_draft_to_sent(self):
        """Test that draft → sent is allowed."""
        response = self.client.patch(
            f"/api/v1/accounting/invoices/{self.invoice.id}/",
            {"status": InvoiceStatus.SENT},
            format="json",
            **self.tenant_header,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, InvoiceStatus.SENT)

    def test_valid_status_transition_sent_to_paid(self):
        """Test that sent → paid is allowed."""
        self.invoice.status = InvoiceStatus.SENT
        self.invoice.save(update_fields=["status"])

        response = self.client.patch(
            f"/api/v1/accounting/invoices/{self.invoice.id}/",
            {"status": InvoiceStatus.PAID},
            format="json",
            **self.tenant_header,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, InvoiceStatus.PAID)

    def test_cannot_skip_to_paid_from_draft(self):
        """Test that draft → paid is rejected."""
        response = self.client.patch(
            f"/api/v1/accounting/invoices/{self.invoice.id}/",
            {"status": InvoiceStatus.PAID},
            format="json",
            **self.tenant_header,
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.data)

    def test_cancelled_is_terminal(self):
        """Test that cancelled is a terminal state — no further transitions."""
        self.invoice.status = InvoiceStatus.CANCELLED
        self.invoice.save(update_fields=["status"])

        response = self.client.patch(
            f"/api/v1/accounting/invoices/{self.invoice.id}/",
            {"status": InvoiceStatus.SENT},
            format="json",
            **self.tenant_header,
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.data)


class InvoiceTenantIsolationTests(APITestCase):
    """Tests for invoice tenant isolation via the API."""

    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        # Tenant A
        self.user_a = User.objects.create_user(
            username=f"user-a-{unique_id}",
            email=f"user-a-{unique_id}@example.com",
            password="testpass123",
        )
        self.client.force_login(self.user_a)
        self.tenant_a = Tenant.objects.create(
            name=f"Tenant A {unique_id}",
            slug=f"tenant-a-{unique_id}",
            contact_email=f"tenant-a-{unique_id}@example.com",
            created_by=self.user_a,
        )
        TenantUser.objects.create(tenant=self.tenant_a, user=self.user_a, role="owner", is_active=True)
        self.customer_a = Customer.objects.create(
            name=f"Customer A {unique_id}",
            tenant=self.tenant_a,
        )
        self.invoice_a = Invoice.objects.create(
            tenant=self.tenant_a,
            customer=self.customer_a,
            invoice_number=f"INV-A-{unique_id}",
            total_amount=Decimal("100.00"),
            status=InvoiceStatus.DRAFT,
        )

        # Tenant B
        self.user_b = User.objects.create_user(
            username=f"user-b-{unique_id}",
            email=f"user-b-{unique_id}@example.com",
            password="testpass123",
        )
        self.tenant_b = Tenant.objects.create(
            name=f"Tenant B {unique_id}",
            slug=f"tenant-b-{unique_id}",
            contact_email=f"tenant-b-{unique_id}@example.com",
            created_by=self.user_b,
        )
        TenantUser.objects.create(tenant=self.tenant_b, user=self.user_b, role="owner", is_active=True)
        self.customer_b = Customer.objects.create(
            name=f"Customer B {unique_id}",
            tenant=self.tenant_b,
        )
        self.invoice_b = Invoice.objects.create(
            tenant=self.tenant_b,
            customer=self.customer_b,
            invoice_number=f"INV-B-{unique_id}",
            total_amount=Decimal("200.00"),
            status=InvoiceStatus.DRAFT,
        )

        self.tenant_a_header = {"HTTP_X_TENANT_ID": str(self.tenant_a.id)}

    def test_cannot_access_other_tenant_invoice(self):
        """Test that GET for another tenant's invoice returns 404."""
        response = self.client.get(
            f"/api/v1/accounting/invoices/{self.invoice_b.id}/",
            **self.tenant_a_header,
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_invoices_filtered_by_tenant(self):
        """Test that list returns only own tenant's invoices."""
        response = self.client.get(
            "/api/v1/accounting/invoices/",
            **self.tenant_a_header,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"] if isinstance(response.data, dict) else response.data
        invoice_numbers = [inv["invoice_number"] for inv in results]
        self.assertIn(self.invoice_a.invoice_number, invoice_numbers)
        self.assertNotIn(self.invoice_b.invoice_number, invoice_numbers)

    def test_cannot_update_other_tenant_invoice(self):
        """Test that PATCH on another tenant's invoice returns 404."""
        response = self.client.patch(
            f"/api/v1/accounting/invoices/{self.invoice_b.id}/",
            {"notes": "Hacked"},
            format="json",
            **self.tenant_a_header,
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class InvoiceSearchAndFilterTests(APITestCase):
    """Tests for invoice status filtering and search."""

    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"inv-search-{unique_id}",
            email=f"inv-search-{unique_id}@example.com",
            password="testpass123",
        )
        self.client.force_login(self.user)
        self.tenant = Tenant.objects.create(
            name=f"Search Tenant {unique_id}",
            slug=f"search-tenant-{unique_id}",
            contact_email=f"search-{unique_id}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner", is_active=True)
        self.customer = Customer.objects.create(
            name=f"Search Customer {unique_id}",
            tenant=self.tenant,
        )

        self.inv_draft = Invoice.objects.create(
            tenant=self.tenant,
            customer=self.customer,
            invoice_number=f"INV-DRAFT-{unique_id}",
            total_amount=Decimal("100.00"),
            status=InvoiceStatus.DRAFT,
        )
        self.inv_sent = Invoice.objects.create(
            tenant=self.tenant,
            customer=self.customer,
            invoice_number=f"INV-SENT-{unique_id}",
            total_amount=Decimal("200.00"),
            status=InvoiceStatus.SENT,
        )
        self.inv_paid = Invoice.objects.create(
            tenant=self.tenant,
            customer=self.customer,
            invoice_number=f"INV-PAID-{unique_id}",
            total_amount=Decimal("300.00"),
            status=InvoiceStatus.PAID,
        )
        self.tenant_header = {"HTTP_X_TENANT_ID": str(self.tenant.id)}

    def test_filter_invoices_by_status(self):
        """Test ?status=draft returns only draft invoices."""
        response = self.client.get(
            "/api/v1/accounting/invoices/",
            {"status": "draft"},
            **self.tenant_header,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"] if isinstance(response.data, dict) else response.data
        statuses = [inv["status"] for inv in results]
        self.assertTrue(all(s == "draft" for s in statuses))
        self.assertEqual(len(results), 1)

    def test_search_invoices_by_number(self):
        """Test ?search= filters invoices by invoice number."""
        response = self.client.get(
            "/api/v1/accounting/invoices/",
            {"search": "INV-DRAFT"},
            **self.tenant_header,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"] if isinstance(response.data, dict) else response.data
        numbers = [inv["invoice_number"] for inv in results]
        self.assertIn(self.inv_draft.invoice_number, numbers)
        self.assertNotIn(self.inv_sent.invoice_number, numbers)
