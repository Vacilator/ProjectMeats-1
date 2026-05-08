from __future__ import annotations

import uuid
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from tenant_apps.carriers.models import Carrier
from tenant_apps.customers.models import Customer
from tenant_apps.locations.models import Location
from tenant_apps.purchase_orders.models import CarrierPurchaseOrder, PurchaseOrder
from tenant_apps.purchase_orders.services.approval_dispatch import PurchaseOrderApprovalDispatchResult
from tenant_apps.sales_orders.models import SalesOrder
from tenant_apps.suppliers.models import Supplier

from apps.core.models import TenantAuditEvent
from apps.core.services.document_workflows import (
    CARRIER_PO_WORKFLOW,
    PURCHASE_ORDER_WORKFLOW,
    SALES_ORDER_WORKFLOW,
    get_document_workflow,
    validate_initial_status,
    validate_status_transition,
)
from apps.system.models import Product
from apps.tenants.models import Tenant, TenantUser


class DocumentWorkflowServiceTests(SimpleTestCase):
    def test_initial_statuses_exclude_approved_for_all_three_workflows(self):
        for workflow in (PURCHASE_ORDER_WORKFLOW, SALES_ORDER_WORKFLOW, CARRIER_PO_WORKFLOW):
            with self.subTest(workflow=workflow):
                self.assertNotIn("approved", workflow.initial_statuses)

    def test_pending_to_approved_is_not_allowed_for_purchase_and_sales(self):
        self.assertNotIn("approved", PURCHASE_ORDER_WORKFLOW.allowed_transitions("pending"))
        self.assertNotIn("approved", SALES_ORDER_WORKFLOW.allowed_transitions("pending"))

    def test_validate_initial_status_rejects_approved_for_all_three_models(self):
        for model_class in (PurchaseOrder, SalesOrder, CarrierPurchaseOrder):
            with self.subTest(model=model_class.__name__):
                with self.assertRaises(ValidationError):
                    validate_initial_status(model_class, "approved")

    def test_validate_status_transition_allows_pending_approval_to_approved(self):
        purchase_order = PurchaseOrder(status="pending_approval")
        sales_order = SalesOrder(status="pending_approval")
        carrier_po = CarrierPurchaseOrder(status="pending_approval")

        validate_status_transition(purchase_order, "approved")
        validate_status_transition(sales_order, "approved")
        validate_status_transition(carrier_po, "approved")

    def test_unregistered_model_raises_validation_error(self):
        class UnknownDocument:
            pass

        with self.assertRaises(ValidationError):
            get_document_workflow(UnknownDocument())


class DocumentWorkflowActionTests(APITestCase):
    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"workflow-user-{unique_id}",
            email=f"workflow-{unique_id}@example.com",
            password="testpass123",
        )
        self.client.force_login(self.user)
        self.tenant = Tenant.objects.create(
            name=f"Workflow Tenant {unique_id}",
            slug=f"workflow-tenant-{unique_id}",
            contact_email=f"workflow-{unique_id}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner", is_active=True)
        self.tenant_header = {"HTTP_X_TENANT_ID": str(self.tenant.id)}

        self.carrier = Carrier.objects.create(
            name=f"Carrier {unique_id}",
            email=f"carrier-{unique_id}@example.com",
            tenant=self.tenant,
        )
        self.supplier = Supplier.objects.create(
            name=f"Supplier {unique_id}",
            email=f"supplier-{unique_id}@example.com",
            tenant=self.tenant,
        )
        self.customer = Customer.objects.create(
            name=f"Customer {unique_id}",
            email=f"customer-{unique_id}@example.com",
            tenant=self.tenant,
        )
        self.location = Location.objects.create(
            name=f"Warehouse {unique_id}",
            city="Chicago",
            location_type="warehouse",
            tenant=self.tenant,
        )
        self.product = Product.objects.create(
            product_code=f"WF-{unique_id}",
            name="Workflow Product",
        )
        self.purchase_order = PurchaseOrder.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            carrier=self.carrier,
            order_number=f"PO-{unique_id}",
            order_date=timezone.now().date(),
            total_amount=Decimal("1000.00"),
            status="pending",
            product=self.product,
            pick_up_location=self.location,
            delivery_location=self.location,
        )
        self.sales_order = SalesOrder.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            customer=self.customer,
            carrier=self.carrier,
            product=self.product,
            our_sales_order_num=f"SO-{unique_id}",
            total_amount=Decimal("1200.00"),
            status="pending",
            pick_up_location=self.location,
            delivery_location=self.location,
        )
        self.carrier_po = CarrierPurchaseOrder.objects.create(
            tenant=self.tenant,
            carrier=self.carrier,
            supplier=self.supplier,
            linked_order=self.purchase_order,
            sales_order=self.sales_order,
            our_carrier_po_num=f"CPO-{unique_id}",
            status="draft",
            pick_up_location=self.location,
            delivery_location=self.location,
        )

    def test_purchase_order_transition_records_actor_and_status_diff(self):
        response = self.client.post(
            f"/api/v1/purchase-orders/{self.purchase_order.id}/transition-status/",
            {"status": "pending_approval"},
            format="json",
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.purchase_order.refresh_from_db()
        self.assertEqual(self.purchase_order.status, "pending_approval")

        event = TenantAuditEvent.objects.filter(
            tenant=self.tenant,
            entity_type="PurchaseOrder",
            object_id=str(self.purchase_order.id),
            action=TenantAuditEvent.Action.UPDATE,
        ).latest("created_at")
        self.assertEqual(event.actor_id, self.user.id)
        self.assertEqual(event.changed_fields["status"], {"from": "pending", "to": "pending_approval"})

    def test_sales_order_and_carrier_po_transition_happy_paths(self):
        test_cases = (
            (f"/api/v1/sales-orders/{self.sales_order.id}/transition-status/", self.sales_order, "pending_approval"),
            (f"/api/v1/carrier-pos/{self.carrier_po.id}/transition-status/", self.carrier_po, "pending_approval"),
        )

        for path, document, next_status in test_cases:
            with self.subTest(path=path):
                response = self.client.post(
                    path,
                    {"status": next_status},
                    format="json",
                    **self.tenant_header,
                )

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                document.refresh_from_db()
                self.assertEqual(document.status, next_status)

    def test_purchase_and_sales_orders_cannot_skip_pending_approval(self):
        for path in (
            f"/api/v1/purchase-orders/{self.purchase_order.id}/transition-status/",
            f"/api/v1/sales-orders/{self.sales_order.id}/transition-status/",
            f"/api/v1/carrier-pos/{self.carrier_po.id}/transition-status/",
        ):
            with self.subTest(path=path):
                response = self.client.post(
                    path,
                    {"status": "approved"},
                    format="json",
                    **self.tenant_header,
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("status", response.data)

    @patch("tenant_apps.purchase_orders.views.approve_purchase_order_and_send_to_supplier")
    def test_purchase_order_approved_transition_uses_dispatch_service(self, dispatch_mock):
        self.purchase_order.status = "pending_approval"
        self.purchase_order.save(update_fields=["status"])
        dispatch_mock.return_value = PurchaseOrderApprovalDispatchResult(success=True)

        response = self.client.post(
            f"/api/v1/purchase-orders/{self.purchase_order.id}/transition-status/",
            {"status": "approved"},
            format="json",
            **self.tenant_header,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        dispatch_mock.assert_called_once()

    @patch("tenant_apps.purchase_orders.views.approve_purchase_order_and_send_to_supplier")
    def test_purchase_order_approved_transition_still_fails_closed_across_tenants(self, dispatch_mock):
        self.purchase_order.status = "pending_approval"
        self.purchase_order.save(update_fields=["status"])

        other_user = User.objects.create_user(
            username="workflow-approved-other-user",
            email="workflow-approved-other@example.com",
            password="testpass123",
        )
        other_tenant = Tenant.objects.create(
            name="Workflow Approved Other Tenant",
            slug="workflow-approved-other-tenant",
            contact_email="workflow-approved-other@example.com",
            created_by=other_user,
        )
        TenantUser.objects.create(tenant=other_tenant, user=other_user, role="owner", is_active=True)

        self.client.force_login(other_user)
        response = self.client.post(
            f"/api/v1/purchase-orders/{self.purchase_order.id}/transition-status/",
            {"status": "approved"},
            format="json",
            HTTP_X_TENANT_ID=str(other_tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        dispatch_mock.assert_not_called()

    def test_create_endpoints_reject_approved_initial_status(self):
        unique_id = uuid.uuid4().hex[:6]
        test_cases = (
            (
                "/api/v1/purchase-orders/",
                {
                    "supplier": self.supplier.id,
                    "order_date": timezone.now().date().isoformat(),
                    "status": "approved",
                },
            ),
            (
                "/api/v1/sales-orders/",
                {
                    "tenant": self.tenant.id,
                    "our_sales_order_num": f"SO-CREATE-{unique_id}",
                    "supplier": self.supplier.id,
                    "customer": self.customer.id,
                    "status": "approved",
                },
            ),
            (
                "/api/v1/carrier-pos/",
                {
                    "carrier": self.carrier.id,
                    "supplier": self.supplier.id,
                    "our_carrier_po_num": f"CPO-CREATE-{unique_id}",
                    "status": "approved",
                },
            ),
        )

        for path, payload in test_cases:
            with self.subTest(path=path):
                response = self.client.post(
                    path,
                    payload,
                    format="json",
                    **self.tenant_header,
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("status", response.data)

    def test_transition_status_fails_closed_across_tenants(self):
        other_user = User.objects.create_user(
            username="workflow-other-user",
            email="workflow-other@example.com",
            password="testpass123",
        )
        other_tenant = Tenant.objects.create(
            name="Workflow Other Tenant",
            slug="workflow-other-tenant",
            contact_email="workflow-other@example.com",
            created_by=other_user,
        )
        TenantUser.objects.create(tenant=other_tenant, user=other_user, role="owner", is_active=True)

        self.client.force_login(other_user)
        other_header = {"HTTP_X_TENANT_ID": str(other_tenant.id)}
        for path in (
            f"/api/v1/purchase-orders/{self.purchase_order.id}/transition-status/",
            f"/api/v1/sales-orders/{self.sales_order.id}/transition-status/",
            f"/api/v1/carrier-pos/{self.carrier_po.id}/transition-status/",
        ):
            with self.subTest(path=path):
                response = self.client.post(
                    path,
                    {"status": "pending_approval"},
                    format="json",
                    **other_header,
                )
                self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
