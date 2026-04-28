"""
Tests for multi-tenancy data isolation with SHARED-SCHEMA approach.

ProjectMeats uses shared-schema multi-tenancy where:
- All tenants share one PostgreSQL schema
- Tenant isolation is via tenant_id ForeignKey on business models
- TenantMiddleware sets request.tenant for context

This module tests that data is properly isolated between tenants using tenant_id filtering.
"""

from datetime import date

from django.contrib.auth.models import User
from django.db import IntegrityError
from django.test import TestCase

from apps.tenants.models import Tenant, TenantUser
from tenant_apps.carriers.models import Carrier
from tenant_apps.contacts.models import Contact
from tenant_apps.customers.models import Customer
from tenant_apps.deals.models import Deal, DealActionItem
from tenant_apps.fulfillments.models import Fulfillment
from tenant_apps.invoices.models import Invoice
from tenant_apps.inquiries.models import Inquiry, InquiryEntityTypeChoices
from tenant_apps.purchase_orders.models import PurchaseOrder
from tenant_apps.sales_orders.models import SalesOrder
from tenant_apps.suppliers.models import Supplier
from tenant_apps.plants.models import Plant


class TenantIsolationTests(TestCase):
    """Test cases for shared-schema tenant data isolation.

    These tests are designed to run in CI to prevent regressions that could
    cause cross-tenant data exposure.
    """

    def setUp(self):
        self.user_a = User.objects.create_user(username='user_a', password='pass')
        self.user_b = User.objects.create_user(username='user_b', password='pass')

        self.tenant_a = Tenant.objects.create(
            name='Tenant A',
            slug='tenant-a',
            contact_email='a@example.com',
            created_by=self.user_a,
        )
        self.tenant_b = Tenant.objects.create(
            name='Tenant B',
            slug='tenant-b',
            contact_email='b@example.com',
            created_by=self.user_b,
        )

        TenantUser.objects.create(tenant=self.tenant_a, user=self.user_a, role='owner', is_active=True)
        TenantUser.objects.create(tenant=self.tenant_b, user=self.user_b, role='owner', is_active=True)

    def test_supplier_isolation(self):
        Supplier.objects.create(tenant=self.tenant_a, name='Supplier A')
        Supplier.objects.create(tenant=self.tenant_b, name='Supplier B')

        self.assertEqual(Supplier.objects.filter(tenant=self.tenant_a).count(), 1)
        self.assertEqual(Supplier.objects.filter(tenant=self.tenant_b).count(), 1)
        self.assertEqual(Supplier.objects.exclude(tenant=self.tenant_a).count(), 1)

    def test_customer_isolation(self):
        Customer.objects.create(tenant=self.tenant_a, name='Customer A')
        Customer.objects.create(tenant=self.tenant_b, name='Customer B')

        self.assertEqual(Customer.objects.filter(tenant=self.tenant_a).count(), 1)
        self.assertEqual(Customer.objects.filter(tenant=self.tenant_b).count(), 1)

    def test_purchase_order_isolation(self):
        supplier_a = Supplier.objects.create(tenant=self.tenant_a, name='Supplier A')
        supplier_b = Supplier.objects.create(tenant=self.tenant_b, name='Supplier B')

        PurchaseOrder.objects.create(
            tenant=self.tenant_a,
            supplier=supplier_a,
            order_number='PO-A-1',
            order_date=date.today(),
        )
        PurchaseOrder.objects.create(
            tenant=self.tenant_b,
            supplier=supplier_b,
            order_number='PO-B-1',
            order_date=date.today(),
        )

        self.assertEqual(PurchaseOrder.objects.filter(tenant=self.tenant_a).count(), 1)
        self.assertEqual(PurchaseOrder.objects.filter(tenant=self.tenant_b).count(), 1)

    def test_plant_isolation(self):
        Plant.objects.create(tenant=self.tenant_a, name='Plant A')
        Plant.objects.create(tenant=self.tenant_b, name='Plant B')

        self.assertEqual(Plant.objects.filter(tenant=self.tenant_a).count(), 1)
        self.assertEqual(Plant.objects.filter(tenant=self.tenant_b).count(), 1)

    def test_contact_isolation(self):
        Contact.objects.create(tenant=self.tenant_a, first_name='A', last_name='User')
        Contact.objects.create(tenant=self.tenant_b, first_name='B', last_name='User')

        self.assertEqual(Contact.objects.filter(tenant=self.tenant_a).count(), 1)
        self.assertEqual(Contact.objects.filter(tenant=self.tenant_b).count(), 1)

    def test_carrier_isolation(self):
        Carrier.objects.create(tenant=self.tenant_a, name='Carrier A', code='A')
        Carrier.objects.create(tenant=self.tenant_b, name='Carrier B', code='B')

        self.assertEqual(Carrier.objects.filter(tenant=self.tenant_a).count(), 1)
        self.assertEqual(Carrier.objects.filter(tenant=self.tenant_b).count(), 1)

    def test_accounts_receivable_isolation(self):
        customer_a = Customer.objects.create(tenant=self.tenant_a, name='Customer A')
        customer_b = Customer.objects.create(tenant=self.tenant_b, name='Customer B')

        Invoice.objects.create(tenant=self.tenant_a, customer=customer_a, invoice_number='INV-A-1')
        Invoice.objects.create(tenant=self.tenant_b, customer=customer_b, invoice_number='INV-B-1')

        self.assertEqual(Invoice.objects.filter(tenant=self.tenant_a).count(), 1)
        self.assertEqual(Invoice.objects.filter(tenant=self.tenant_b).count(), 1)

    def test_deal_isolation(self):
        supplier_a = Supplier.objects.create(tenant=self.tenant_a, name='Supplier A')
        supplier_b = Supplier.objects.create(tenant=self.tenant_b, name='Supplier B')
        customer_a = Customer.objects.create(tenant=self.tenant_a, name='Customer A')
        customer_b = Customer.objects.create(tenant=self.tenant_b, name='Customer B')
        inquiry_a = Inquiry.objects.create(
            tenant=self.tenant_a,
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=customer_a,
        )
        inquiry_b = Inquiry.objects.create(
            tenant=self.tenant_b,
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=customer_b,
        )
        po_a = PurchaseOrder.objects.create(
            tenant=self.tenant_a,
            supplier=supplier_a,
            order_number='PO-A-1',
            order_date=date.today(),
        )
        po_b = PurchaseOrder.objects.create(
            tenant=self.tenant_b,
            supplier=supplier_b,
            order_number='PO-B-1',
            order_date=date.today(),
        )
        so_a = SalesOrder.objects.create(
            tenant=self.tenant_a,
            supplier=supplier_a,
            customer=customer_a,
            our_sales_order_num='SO-A-1',
        )
        so_b = SalesOrder.objects.create(
            tenant=self.tenant_b,
            supplier=supplier_b,
            customer=customer_b,
            our_sales_order_num='SO-B-1',
        )
        fulfillment_a = Fulfillment.objects.create(tenant=self.tenant_a, inquiry=inquiry_a)
        fulfillment_b = Fulfillment.objects.create(tenant=self.tenant_b, inquiry=inquiry_b)

        Deal.objects.create(
            tenant=self.tenant_a,
            purchase_order=po_a,
            sales_order=so_a,
            fulfillment=fulfillment_a,
        )
        Deal.objects.create(
            tenant=self.tenant_b,
            purchase_order=po_b,
            sales_order=so_b,
            fulfillment=fulfillment_b,
        )

        self.assertEqual(Deal.objects.filter(tenant=self.tenant_a).count(), 1)
        self.assertEqual(Deal.objects.filter(tenant=self.tenant_b).count(), 1)

    def test_deal_action_item_isolation(self):
        supplier = Supplier.objects.create(tenant=self.tenant_a, name='Supplier A')
        customer = Customer.objects.create(tenant=self.tenant_a, name='Customer A')
        inquiry = Inquiry.objects.create(
            tenant=self.tenant_a,
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=customer,
        )
        po = PurchaseOrder.objects.create(
            tenant=self.tenant_a,
            supplier=supplier,
            order_number='PO-A-2',
            order_date=date.today(),
        )
        so = SalesOrder.objects.create(
            tenant=self.tenant_a,
            supplier=supplier,
            customer=customer,
            our_sales_order_num='SO-A-2',
        )
        fulfillment = Fulfillment.objects.create(tenant=self.tenant_a, inquiry=inquiry)
        deal = Deal.objects.create(
            tenant=self.tenant_a,
            purchase_order=po,
            sales_order=so,
            fulfillment=fulfillment,
        )

        DealActionItem.objects.create(
            tenant=self.tenant_a,
            deal=deal,
            fulfillment=fulfillment,
            title='Collect docs',
        )

        self.assertEqual(DealActionItem.objects.filter(tenant=self.tenant_a).count(), 1)

    def test_null_tenant_not_visible(self):
        with self.assertRaises(IntegrityError):
            Supplier.objects.create(name='No Tenant Supplier')
