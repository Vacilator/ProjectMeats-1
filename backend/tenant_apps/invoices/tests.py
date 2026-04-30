"""
Tests for Invoices app models.

Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid
from django.test import TestCase
from django.contrib.auth.models import User
from decimal import Decimal
from tenant_apps.invoices.models import Invoice, InvoiceItem, InvoiceStatus
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
