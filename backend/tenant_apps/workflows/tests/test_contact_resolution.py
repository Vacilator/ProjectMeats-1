"""Tests for RT-04.1: Contact resolution service for Workform nodes."""

from django.test import TestCase

from apps.core.tests.factories import TenantFactory
from tenant_apps.contacts.models import Contact
from tenant_apps.suppliers.models import Supplier
from tenant_apps.workflows.services.contact_resolution import (
    ResolvedContact,
    resolve_bid_evaluator,
    resolve_customer_contact,
    resolve_po_contact,
    resolve_rfq_recipient,
)


class ContactResolutionBaseTest(TestCase):
    """Base test case with supplier + contacts setup."""

    def setUp(self):
        self.tenant = TenantFactory()
        self.supplier = Supplier.objects.create(
            tenant=self.tenant,
            name="Test Supplier Inc",
        )
        # Sales contact
        self.sales_contact = Contact.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            first_name="Alice",
            last_name="Sales",
            email="alice@supplier.com",
            contact_type="Sales",
            contact_title="Sales Manager",
            status="active",
        )
        # Accounting contact
        self.acct_contact = Contact.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            first_name="Bob",
            last_name="Accounting",
            email="bob@supplier.com",
            contact_type="Accounting",
            contact_title="Accounts Payable",
            status="active",
        )
        # Operations contact
        self.ops_contact = Contact.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            first_name="Charlie",
            last_name="Ops",
            email="charlie@supplier.com",
            contact_type="Operations",
            contact_title="Plant Manager",
            status="active",
        )


class RFQRecipientResolutionTest(ContactResolutionBaseTest):
    """Test RFQ recipient resolution logic."""

    def test_resolves_sales_contact_for_rfq(self):
        result = resolve_rfq_recipient(
            tenant=self.tenant,
            supplier=self.supplier,
            preferred_contact_type="Sales",
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.email, "alice@supplier.com")
        self.assertEqual(result.contact_type, "Sales")
        self.assertEqual(result.resolution_method, "type_match")

    def test_resolves_operations_when_sales_missing(self):
        self.sales_contact.delete()
        result = resolve_rfq_recipient(
            tenant=self.tenant,
            supplier=self.supplier,
            preferred_contact_type="Sales",
            fallback_contact_type="Operations",
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.email, "charlie@supplier.com")

    def test_returns_none_when_no_contacts(self):
        Contact.objects.filter(tenant=self.tenant, supplier=self.supplier).delete()
        result = resolve_rfq_recipient(
            tenant=self.tenant,
            supplier=self.supplier,
        )
        self.assertIsNone(result)

    def test_skips_inactive_contacts(self):
        self.sales_contact.status = "inactive"
        self.sales_contact.save()
        result = resolve_rfq_recipient(
            tenant=self.tenant,
            supplier=self.supplier,
            preferred_contact_type="Sales",
        )
        # Should fall back to another contact
        self.assertIsNotNone(result)
        self.assertNotEqual(result.email, "alice@supplier.com")

    def test_returns_resolved_contact_dataclass(self):
        result = resolve_rfq_recipient(
            tenant=self.tenant,
            supplier=self.supplier,
        )
        self.assertIsInstance(result, ResolvedContact)
        self.assertTrue(result.name)
        self.assertTrue(result.email)
        self.assertTrue(result.contact_id)


class POContactResolutionTest(ContactResolutionBaseTest):
    """Test PO contact resolution logic."""

    def test_resolves_accounting_for_po(self):
        result = resolve_po_contact(
            tenant=self.tenant,
            supplier=self.supplier,
            contact_type="Accounting",
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.email, "bob@supplier.com")
        self.assertEqual(result.contact_type, "Accounting")

    def test_falls_back_to_sales_when_no_accounting(self):
        self.acct_contact.delete()
        result = resolve_po_contact(
            tenant=self.tenant,
            supplier=self.supplier,
            contact_type="Accounting",
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.email, "alice@supplier.com")


class BidEvaluatorResolutionTest(ContactResolutionBaseTest):
    """Test bid evaluator resolution logic."""

    def test_resolves_sales_for_bid_evaluation(self):
        result = resolve_bid_evaluator(
            tenant=self.tenant,
            supplier=self.supplier,
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.contact_type, "Sales")


class CustomerContactResolutionTest(TestCase):
    """Test customer contact resolution."""

    def setUp(self):
        from tenant_apps.customers.models import Customer

        self.tenant = TenantFactory()
        self.customer = Customer.objects.create(
            tenant=self.tenant,
            name="Test Customer",
        )
        self.customer_contact = Contact.objects.create(
            tenant=self.tenant,
            customer=self.customer,
            first_name="Dana",
            last_name="Customer",
            email="dana@customer.com",
            contact_type="Sales",
            status="active",
        )

    def test_resolves_customer_contact(self):
        result = resolve_customer_contact(
            tenant=self.tenant,
            customer=self.customer,
            contact_type="Sales",
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.email, "dana@customer.com")

    def test_returns_none_when_no_customer_contacts(self):
        self.customer_contact.delete()
        result = resolve_customer_contact(
            tenant=self.tenant,
            customer=self.customer,
        )
        self.assertIsNone(result)
