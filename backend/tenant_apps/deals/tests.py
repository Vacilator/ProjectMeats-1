"""Regression coverage for Deal Desk backend flows."""
from __future__ import annotations

from datetime import date
from decimal import Decimal
import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.test.utils import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.tenants.models import Tenant, TenantDomain, TenantUser
from tenant_apps.customers.models import Customer
from tenant_apps.deals.models import Deal, DealActionItem, DealActionItemStatus
from tenant_apps.fulfillments.models import Fulfillment, FulfillmentStatusChoices
from tenant_apps.inquiries.models import Inquiry, InquiryEntityTypeChoices
from tenant_apps.purchase_orders.models import PurchaseOrder
from tenant_apps.sales_orders.models import SalesOrder
from tenant_apps.suppliers.models import Supplier


User = get_user_model()


class DealTestMixin:
    """Shared tenant-aware fixtures for deal tests."""

    def create_tenant_bundle(self, suffix: str, user: User) -> dict[str, object]:
        tenant = Tenant.objects.create(
            name=f"Tenant {suffix}",
            slug=f"tenant-{suffix}",
            contact_email=f"{suffix}@example.com",
            is_active=True,
            created_by=user,
        )
        domain = TenantDomain.objects.create(
            tenant=tenant,
            domain=f"{tenant.slug}.example.com",
            is_primary=True,
        )
        TenantUser.objects.create(tenant=tenant, user=user, role="admin", is_active=True)

        supplier = Supplier.objects.create(tenant=tenant, name=f"Supplier {suffix}")
        customer = Customer.objects.create(tenant=tenant, name=f"Customer {suffix}")
        inquiry = Inquiry.objects.create(
            tenant=tenant,
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=customer,
        )
        purchase_order = PurchaseOrder.objects.create(
            tenant=tenant,
            supplier=supplier,
            order_number=f"PO-{suffix}",
            order_date=date.today(),
            total_amount=Decimal("1250.00"),
        )
        sales_order = SalesOrder.objects.create(
            tenant=tenant,
            supplier=supplier,
            customer=customer,
            our_sales_order_num=f"SO-{suffix}",
            total_amount=Decimal("1800.00"),
        )
        fulfillment = Fulfillment.objects.create(
            tenant=tenant,
            inquiry=inquiry,
            supplier=supplier,
            customer=customer,
            freight_cost=Decimal("150.00"),
        )
        deal = Deal.objects.create(
            tenant=tenant,
            purchase_order=purchase_order,
            sales_order=sales_order,
            fulfillment=fulfillment,
            assigned_trader=user,
        )

        return {
            "tenant": tenant,
            "domain": domain,
            "supplier": supplier,
            "customer": customer,
            "inquiry": inquiry,
            "purchase_order": purchase_order,
            "sales_order": sales_order,
            "fulfillment": fulfillment,
            "deal": deal,
        }


class DealModelTests(DealTestMixin, TestCase):
    """Model-level tests for Deal Desk entities."""

    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(username=f"user-{unique}", password="pw")
        bundle = self.create_tenant_bundle(unique, self.user)
        self.tenant = bundle["tenant"]
        self.deal: Deal = bundle["deal"]
        self.fulfillment: Fulfillment = bundle["fulfillment"]

    def test_deal_computes_financials(self):
        self.assertEqual(self.deal.gross_revenue, Decimal("1800.00"))
        self.assertEqual(self.deal.cogs, Decimal("1250.00"))
        self.assertEqual(self.deal.freight_cost, Decimal("150.00"))
        self.assertEqual(self.deal.net_margin, Decimal("400.00"))

    def test_shipping_fulfillment_creates_open_deal_action_item(self):
        self.fulfillment.status = FulfillmentStatusChoices.SHIPPED
        self.fulfillment.save()

        action_item = DealActionItem.objects.get(deal=self.deal, status=DealActionItemStatus.OPEN)
        self.assertIn("Collect BOL / COA", action_item.title)
        self.assertEqual(action_item.assigned_user, self.user)
        self.deal.refresh_from_db()
        self.assertEqual(self.deal.status, "in_transit")

    def test_received_documents_close_open_reminder(self):
        self.fulfillment.status = FulfillmentStatusChoices.SHIPPED
        self.fulfillment.save()

        self.fulfillment.document_milestones = {
            "bol_received": True,
            "coa_received": True,
        }
        self.fulfillment.save()

        action_item = DealActionItem.objects.get(deal=self.deal)
        self.assertEqual(action_item.status, DealActionItemStatus.COMPLETED)


@override_settings(ALLOWED_HOSTS=["*"])
class DealApiTests(DealTestMixin, APITestCase):
    """API tests for tenant-safe deal endpoints."""

    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(username=f"user-{unique}", password="pw")
        self.client.force_authenticate(self.user)

        bundle1 = self.create_tenant_bundle(f"{unique}-a", self.user)
        bundle2 = self.create_tenant_bundle(f"{unique}-b", self.user)

        self.tenant1 = bundle1["tenant"]
        self.domain1 = bundle1["domain"]
        self.deal1: Deal = bundle1["deal"]
        self.fulfillment1: Fulfillment = bundle1["fulfillment"]
        self.tenant2 = bundle2["tenant"]
        self.domain2 = bundle2["domain"]
        self.deal2: Deal = bundle2["deal"]

    def test_deal_list_is_tenant_scoped(self):
        response = self.client.get("/api/v1/deals/", HTTP_HOST=self.domain1.domain)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)

        results = response.json().get("results") if isinstance(response.json(), dict) else response.json()
        ids = {row["id"] for row in results}
        self.assertIn(str(self.deal1.id), ids)
        self.assertNotIn(str(self.deal2.id), ids)

    def test_cross_tenant_retrieve_fails_closed(self):
        response = self.client.get(f"/api/v1/deals/{self.deal2.id}/", HTTP_HOST=self.domain1.domain)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_action_items_endpoint_includes_open_deal_reminder(self):
        self.fulfillment1.status = FulfillmentStatusChoices.SHIPPED
        self.fulfillment1.save()

        response = self.client.get("/api/v1/workflows/action-items/", HTTP_HOST=self.domain1.domain)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)

        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["entity_type"], "deal")
        self.assertEqual(payload[0]["entity_id"], str(self.deal1.id))

    def test_action_item_counts_include_open_deal_reminder(self):
        self.fulfillment1.status = FulfillmentStatusChoices.SHIPPED
        self.fulfillment1.save()

        response = self.client.get("/api/v1/workflows/action-items/counts/", HTTP_HOST=self.domain1.domain)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)

        payload = response.json()
        self.assertEqual(payload["total"], 1)
        self.assertEqual(payload["by_priority"]["high"], 1)

    def test_create_rejects_assigned_trader_outside_active_tenant(self):
        outsider = User.objects.create_user(username=f"outsider-{uuid.uuid4().hex[:8]}", password="pw")
        other_tenant = Tenant.objects.create(
            name="Outsider Tenant",
            slug=f"outsider-{uuid.uuid4().hex[:8]}",
            contact_email="outsider@example.com",
            is_active=True,
            created_by=outsider,
        )
        TenantUser.objects.create(tenant=other_tenant, user=outsider, role="admin", is_active=True)

        supplier = Supplier.objects.create(tenant=self.tenant1, name="Tenant One Supplier")
        customer = Customer.objects.create(tenant=self.tenant1, name="Tenant One Customer")
        inquiry = Inquiry.objects.create(
            tenant=self.tenant1,
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=customer,
        )
        purchase_order = PurchaseOrder.objects.create(
            tenant=self.tenant1,
            supplier=supplier,
            order_number=f"PO-{uuid.uuid4().hex[:6]}",
            order_date=date.today(),
        )
        sales_order = SalesOrder.objects.create(
            tenant=self.tenant1,
            supplier=supplier,
            customer=customer,
            our_sales_order_num=f"SO-{uuid.uuid4().hex[:6]}",
        )
        fulfillment = Fulfillment.objects.create(tenant=self.tenant1, inquiry=inquiry)

        response = self.client.post(
            "/api/v1/deals/",
            {
                "purchase_order": purchase_order.id,
                "sales_order": sales_order.id,
                "fulfillment": fulfillment.id,
                "assigned_trader": outsider.id,
            },
            format="json",
            HTTP_HOST=self.domain1.domain,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assigned_trader", response.json())
