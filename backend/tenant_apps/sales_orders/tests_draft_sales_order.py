"""Tests for CTE-04.1: Draft sales order generation from fulfill or approved source."""

import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.tenants.models import Tenant, TenantUser
from tenant_apps.customers.models import Customer
from tenant_apps.inquiries.models import (
    Inquiry,
    InquiryEntityTypeChoices,
    InquiryRouteDecisionChoices,
    InquiryShippingTypeChoices,
    InquirySourceChoices,
)
from tenant_apps.purchase_orders.models import PurchaseOrder, PurchaseOrderStatus
from tenant_apps.sales_orders.models import SalesOrder, SalesOrderStatus
from tenant_apps.sales_orders.services.draft_sales_order import (
    DraftSalesOrderError,
    create_draft_from_approved_source,
    create_draft_from_fulfill,
)
from tenant_apps.suppliers.models import Supplier


class DraftSalesOrderFulfillTests(TestCase):
    """Test create_draft_from_fulfill service (FULFILL path)."""

    def setUp(self):
        uid = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"so-test-{uid}", email=f"so-{uid}@test.com", password="pass"
        )
        self.tenant = Tenant.objects.create(
            name=f"SO Tenant {uid}",
            slug=f"so-tenant-{uid}",
            contact_email=f"so-{uid}@test.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")
        self.customer = Customer.objects.create(
            name=f"Customer {uid}", email=f"cust-{uid}@test.com", tenant=self.tenant
        )
        self.supplier = Supplier.objects.create(
            name=f"Supplier {uid}", email=f"sup-{uid}@test.com", tenant=self.tenant
        )
        self.inquiry = Inquiry.objects.create(
            tenant=self.tenant,
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=self.customer,
            supplier=self.supplier,
            source_type=InquirySourceChoices.EMAIL,
            route_decision=InquiryRouteDecisionChoices.FULFILL,
            shipping_type=InquiryShippingTypeChoices.TENANT,
            notes="Rowena/TX direct fulfill test",
            source_email_message_id="msg-rowena-226052",
            source_email_thread_id="thread-rowena-226052",
            created_by=self.user,
        )

    def test_fulfill_creates_draft_sales_order(self):
        """FULFILL inquiry creates draft SO with correct lineage."""
        result = create_draft_from_fulfill(tenant=self.tenant, inquiry=self.inquiry)

        self.assertTrue(result.created)
        self.assertEqual(result.source_type, "fulfill")
        so = result.sales_order
        self.assertEqual(so.status, SalesOrderStatus.DRAFT)
        self.assertEqual(so.customer, self.customer)
        self.assertEqual(so.supplier, self.supplier)
        self.assertEqual(so.tenant, self.tenant)
        self.assertEqual(so.custom_data["source_type"], "fulfill")
        self.assertEqual(so.custom_data["source_inquiry_id"], str(self.inquiry.id))
        self.assertEqual(so.custom_data["source_email_message_id"], "msg-rowena-226052")
        self.assertEqual(so.custom_data["review_state"], "pending_review")

    def test_fulfill_idempotent_on_retry(self):
        """Second call returns existing SO without creating duplicate."""
        result1 = create_draft_from_fulfill(tenant=self.tenant, inquiry=self.inquiry)
        result2 = create_draft_from_fulfill(tenant=self.tenant, inquiry=self.inquiry)

        self.assertTrue(result1.created)
        self.assertFalse(result2.created)
        self.assertEqual(result1.sales_order.id, result2.sales_order.id)
        self.assertEqual(SalesOrder.objects.filter(tenant=self.tenant).count(), 1)

    def test_fulfill_links_inquiry_to_sales_order(self):
        """Inquiry.sales_order FK updated after SO creation."""
        result = create_draft_from_fulfill(tenant=self.tenant, inquiry=self.inquiry)

        self.inquiry.refresh_from_db()
        self.assertEqual(self.inquiry.sales_order_id, result.sales_order.id)

    def test_fulfill_rejects_broker_inquiry(self):
        """BROKER inquiry cannot use FULFILL path."""
        self.inquiry.route_decision = InquiryRouteDecisionChoices.BROKER
        self.inquiry.save()

        with self.assertRaises(DraftSalesOrderError) as ctx:
            create_draft_from_fulfill(tenant=self.tenant, inquiry=self.inquiry)
        self.assertIn("FULFILL", str(ctx.exception))

    def test_fulfill_rejects_inquiry_without_customer(self):
        """Inquiry without customer cannot create SO."""
        self.inquiry.customer = None
        self.inquiry.save()

        with self.assertRaises(DraftSalesOrderError) as ctx:
            create_draft_from_fulfill(tenant=self.tenant, inquiry=self.inquiry)
        self.assertIn("customer", str(ctx.exception))

    def test_fulfill_cross_tenant_blocked(self):
        """Cross-tenant inquiry fails safely."""
        uid2 = uuid.uuid4().hex[:8]
        other_tenant = Tenant.objects.create(
            name=f"Other {uid2}",
            slug=f"other-{uid2}",
            contact_email=f"other-{uid2}@test.com",
            created_by=self.user,
        )

        with self.assertRaises(DraftSalesOrderError):
            create_draft_from_fulfill(tenant=other_tenant, inquiry=self.inquiry)


class DraftSalesOrderApprovedSourceTests(TestCase):
    """Test create_draft_from_approved_source service (BROKER path)."""

    def setUp(self):
        uid = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"so-ap-{uid}", email=f"so-ap-{uid}@test.com", password="pass"
        )
        self.tenant = Tenant.objects.create(
            name=f"SO AP Tenant {uid}",
            slug=f"so-ap-{uid}",
            contact_email=f"so-ap-{uid}@test.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")
        self.customer = Customer.objects.create(
            name=f"Buyer {uid}", email=f"buyer-{uid}@test.com", tenant=self.tenant
        )
        self.supplier = Supplier.objects.create(
            name=f"Supplier {uid}", email=f"sup-{uid}@test.com", tenant=self.tenant
        )
        self.inquiry = Inquiry.objects.create(
            tenant=self.tenant,
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=self.customer,
            supplier=self.supplier,
            source_type=InquirySourceChoices.EMAIL,
            route_decision=InquiryRouteDecisionChoices.BROKER,
            shipping_type=InquiryShippingTypeChoices.TENANT,
            notes="Rowena/TX PO 226052 broker path",
            source_email_message_id="msg-226052",
            source_email_thread_id="thread-226052",
            created_by=self.user,
        )
        self.purchase_order = PurchaseOrder.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            status=PurchaseOrderStatus.APPROVED,
            order_date="2026-05-07",
            total_amount=15000,
            quantity=40000,
            total_weight=40000,
            weight_unit="LBS",
            custom_data={
                "source_type": "supplier_quote_reply",
                "source_lineage": {
                    "inquiry_id": str(self.inquiry.id),
                    "rfq_id": "123",
                    "supplier_id": str(self.supplier.id),
                },
                "selected_bid": {
                    "rfq_id": "123",
                    "supplier_id": str(self.supplier.id),
                    "supplier_name": self.supplier.name,
                    "contact_routing": {
                        "supplier_contact": {
                            "recipient_name": "Price Desk",
                            "recipient_email": "sales@supplier.example.com",
                            "department": "sales",
                            "title": "Account Manager",
                        }
                    },
                },
                "contact_routing": {
                    "billing_contact": {
                        "recipient_name": "AP Desk",
                        "recipient_email": "ap@supplier.example.com",
                        "department": "accounting",
                        "title": "Accounts Payable",
                    },
                    "shipping_contact": {
                        "recipient_name": "Loadout Desk",
                        "recipient_email": "shipping@supplier.example.com",
                        "department": "shipping",
                        "title": "Shipping Supervisor",
                    },
                },
            },
        )
        # Link inquiry to PO
        self.inquiry.supplier_purchase_order = self.purchase_order
        self.inquiry.save()

    def test_approved_source_creates_draft_so(self):
        """Approved supplier PO creates draft SO with full lineage."""
        result = create_draft_from_approved_source(
            tenant=self.tenant, purchase_order=self.purchase_order
        )

        self.assertTrue(result.created)
        self.assertEqual(result.source_type, "approved_source")
        so = result.sales_order
        self.assertEqual(so.status, SalesOrderStatus.DRAFT)
        self.assertEqual(so.customer, self.customer)
        self.assertEqual(so.supplier, self.supplier)
        self.assertEqual(so.quantity, 40000)
        self.assertEqual(so.custom_data["source_type"], "approved_source")
        self.assertEqual(so.custom_data["source_inquiry_id"], str(self.inquiry.id))
        self.assertEqual(so.custom_data["source_purchase_order_id"], str(self.purchase_order.id))
        self.assertEqual(
            so.custom_data["contact_routing"]["shipping_contact"]["recipient_email"],
            "shipping@supplier.example.com",
        )
        self.assertEqual(
            so.custom_data["process_cockpit"]["selected_bid"]["contact_routing"]["supplier_contact"]["title"],
            "Account Manager",
        )

    def test_approved_source_idempotent(self):
        """Second call returns existing SO without duplicate."""
        result1 = create_draft_from_approved_source(
            tenant=self.tenant, purchase_order=self.purchase_order
        )
        result2 = create_draft_from_approved_source(
            tenant=self.tenant, purchase_order=self.purchase_order
        )

        self.assertTrue(result1.created)
        self.assertFalse(result2.created)
        self.assertEqual(result1.sales_order.id, result2.sales_order.id)

    def test_approved_source_rejects_draft_po(self):
        """Non-approved PO cannot create draft SO."""
        self.purchase_order.status = PurchaseOrderStatus.DRAFT
        self.purchase_order.save()

        with self.assertRaises(DraftSalesOrderError) as ctx:
            create_draft_from_approved_source(
                tenant=self.tenant, purchase_order=self.purchase_order
            )
        self.assertIn("approved", str(ctx.exception))

    def test_approved_source_cross_tenant_blocked(self):
        """Cross-tenant PO fails safely."""
        uid2 = uuid.uuid4().hex[:8]
        other_tenant = Tenant.objects.create(
            name=f"Other {uid2}",
            slug=f"other-{uid2}",
            contact_email=f"other-{uid2}@test.com",
            created_by=self.user,
        )

        with self.assertRaises(DraftSalesOrderError):
            create_draft_from_approved_source(
                tenant=other_tenant, purchase_order=self.purchase_order
            )

    def test_approved_source_links_inquiry(self):
        """Inquiry.sales_order FK updated after SO creation."""
        result = create_draft_from_approved_source(
            tenant=self.tenant, purchase_order=self.purchase_order
        )

        self.inquiry.refresh_from_db()
        self.assertEqual(self.inquiry.sales_order_id, result.sales_order.id)


class DraftSalesOrderAPITests(TestCase):
    """Test the API endpoints for draft SO creation."""

    def setUp(self):
        uid = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"so-api-{uid}", email=f"so-api-{uid}@test.com", password="pass"
        )
        self.tenant = Tenant.objects.create(
            name=f"API Tenant {uid}",
            slug=f"api-tenant-{uid}",
            contact_email=f"api-{uid}@test.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")
        self.customer = Customer.objects.create(
            name=f"API Cust {uid}", email=f"api-cust-{uid}@test.com", tenant=self.tenant
        )
        self.supplier = Supplier.objects.create(
            name=f"API Sup {uid}", email=f"api-sup-{uid}@test.com", tenant=self.tenant
        )
        self.inquiry = Inquiry.objects.create(
            tenant=self.tenant,
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=self.customer,
            supplier=self.supplier,
            source_type=InquirySourceChoices.EMAIL,
            route_decision=InquiryRouteDecisionChoices.FULFILL,
            shipping_type=InquiryShippingTypeChoices.TENANT,
            notes="API test",
            created_by=self.user,
        )
        self.purchase_order = PurchaseOrder.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            status=PurchaseOrderStatus.APPROVED,
            order_date="2026-05-07",
            total_amount=10000,
            custom_data={
                "source_type": "supplier_quote_reply",
                "source_lineage": {
                    "inquiry_id": str(self.inquiry.id),
                    "supplier_id": str(self.supplier.id),
                },
            },
        )
        self.inquiry.supplier_purchase_order = self.purchase_order
        self.inquiry.save()

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        # Set tenant header
        self.client.credentials(HTTP_X_TENANT_ID=str(self.tenant.id))

    def test_inquiry_create_sales_order_draft_endpoint(self):
        """POST /api/v1/inquiries/{id}/create-sales-order-draft/ returns 201."""
        url = f"/api/v1/inquiries/{self.inquiry.id}/create-sales-order-draft/"
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["created"])
        self.assertEqual(response.data["source_type"], "fulfill")
        self.assertIn("sales_order", response.data)

    def test_inquiry_endpoint_idempotent(self):
        """Second POST returns 200 with same SO."""
        url = f"/api/v1/inquiries/{self.inquiry.id}/create-sales-order-draft/"
        r1 = self.client.post(url)
        r2 = self.client.post(url)

        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertEqual(
            r1.data["sales_order"]["id"],
            r2.data["sales_order"]["id"],
        )

    def test_purchase_order_create_sales_order_draft_endpoint(self):
        """POST /api/v1/purchase-orders/{id}/create-sales-order-draft/ returns 201."""
        # Need BROKER inquiry for this path
        self.inquiry.route_decision = InquiryRouteDecisionChoices.BROKER
        self.inquiry.save()

        url = f"/api/v1/purchase-orders/{self.purchase_order.id}/create-sales-order-draft/"
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["created"])
        self.assertEqual(response.data["source_type"], "approved_source")
        self.assertIn("sales_order", response.data)

    def test_purchase_order_endpoint_rejects_unapproved(self):
        """POST to unapproved PO returns 400."""
        self.purchase_order.status = PurchaseOrderStatus.DRAFT
        self.purchase_order.save()

        url = f"/api/v1/purchase-orders/{self.purchase_order.id}/create-sales-order-draft/"
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
