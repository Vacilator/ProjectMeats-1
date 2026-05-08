from __future__ import annotations

import uuid
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from tenant_apps.contacts.models import Contact
from tenant_apps.customers.models import Customer
from tenant_apps.inquiries.models import (
    Inquiry,
    InquiryEntityTypeChoices,
    InquiryRouteDecisionChoices,
    InquiryShippingTypeChoices,
    InquirySourceChoices,
)
from tenant_apps.plants.models import Plant
from tenant_apps.products.models import MasterProduct
from tenant_apps.purchase_orders.models import PurchaseOrder
from tenant_apps.suppliers.models import Supplier
from tenant_apps.workflows.models import NotificationType, TenantWorkFormExecution, UserNotification
from tenant_apps.workflows.services.action_executor import ActionExecutor

from apps.core.models import ProteinTypeChoices
from apps.integrations.models import ExternalAuthProvider
from apps.system.models import Product, TenantWorkForm
from apps.tenants.models import Tenant, TenantUser


class ActionExecutorSendNotificationTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.user = User.objects.create_user(username=f"u-{unique}", password="pw")
        self.tenant = Tenant.objects.create(
            name=f"Tenant {unique}",
            slug=f"tenant-{unique}",
            contact_email=f"{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="admin", is_active=True)

        self.workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name="Notify WF",
            status="active",
            workflow_definition={
                "nodes": [
                    {"id": "t1", "type": "triggerManual", "data": {"label": "Manual Trigger"}},
                    {
                        "id": "n1",
                        "type": "actionNotify",
                        "data": {"label": "Notify", "config": {"title": "Hi", "message": "Msg"}},
                    },
                ],
                "edges": [],
            },
            created_by=self.user,
            updated_by=self.user,
        )

        self.execution = TenantWorkFormExecution.objects.create(
            tenant=self.tenant,
            workform=self.workform,
            status="in_progress",
            initial_data={"entity_type": "customer", "entity_id": "1"},
            started_by=self.user,
        )

    def test_send_notification_falls_back_to_execution_actor_and_persists(self):
        executor = ActionExecutor(
            self.tenant,
            context={
                "execution_id": str(self.execution.id),
                "trigger": self.execution.initial_data,
                "variables": {},
            },
        )

        result = executor.execute(
            "send_notification",
            {
                "title": "Hello",
                "message": "World",
            },
        )

        self.assertTrue(result.get("success"), result)
        self.assertEqual(UserNotification.objects.filter(tenant=self.tenant, user=self.user).count(), 1)

        n = UserNotification.objects.filter(tenant=self.tenant, user=self.user).first()
        assert n is not None
        self.assertEqual(n.notification_type, NotificationType.WORKFLOW_TRIGGER)
        self.assertEqual(n.title, "Hello")
        self.assertEqual(n.message, "World")

    def test_send_notification_rejects_cross_tenant_recipient(self):
        other = User.objects.create_user(username=f"other-{uuid.uuid4().hex[:6]}", password="pw")

        executor = ActionExecutor(
            self.tenant,
            context={
                "execution_id": str(self.execution.id),
                "trigger": {},
                "variables": {},
            },
        )

        result = executor.execute(
            "send_notification",
            {
                "title": "Hello",
                "message": "World",
                "user_id": str(other.id),
            },
        )

        self.assertFalse(result.get("success"))
        self.assertIn("tenant", str(result.get("error", "")).lower())
        self.assertEqual(UserNotification.objects.filter(tenant=self.tenant, user=other).count(), 0)


class ActionExecutorPurchaseOrderGuardTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.user = User.objects.create_user(username=f"po-guard-{unique}", password="pw")
        self.tenant = Tenant.objects.create(
            name=f"PO Guard Tenant {unique}",
            slug=f"po-guard-tenant-{unique}",
            contact_email=f"{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="admin", is_active=True)
        self.supplier = Supplier.objects.create(
            name=f"Supplier {unique}", email=f"supplier-{unique}@example.com", tenant=self.tenant
        )
        self.provider = ExternalAuthProvider.objects.create(
            tenant=self.tenant,
            provider_type="microsoft",
            access_token="placeholder",
            token_expiry=timezone.now() + timedelta(hours=1),
            connected_email=f"sender-{unique}@example.com",
        )
        self.provider.set_encrypted_token("access", "token")
        self.provider.save(update_fields=["access_token"])
        self.purchase_order = PurchaseOrder.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            order_number=f"PO-{unique}",
            order_date=timezone.now().date(),
            total_amount=Decimal("100.00"),
            status="pending_approval",
        )

    def test_update_record_rejects_purchase_order_status_mutation(self):
        executor = ActionExecutor(self.tenant, context={"variables": {}})

        result = executor.execute(
            "update_record",
            {
                "entity_type": "purchase_order",
                "entity_id": str(self.purchase_order.id),
                "field_updates": {"status": "approved"},
            },
        )

        self.assertFalse(result.get("success"))
        self.assertIn("transition-status", str(result.get("error", "")))


class ActionExecutorSendEmailRoutingTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.user = User.objects.create_user(username=f"email-route-{unique}", password="pw")
        self.tenant = Tenant.objects.create(
            name=f"Email Route Tenant {unique}",
            slug=f"email-route-tenant-{unique}",
            contact_email=f"{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="admin", is_active=True)
        self.customer = Customer.objects.create(name=f"Buyer {unique}", tenant=self.tenant)
        self.product = Product.objects.create(
            product_code=f"ROUTE-{unique}",
            name="Brisket",
            protein_type=ProteinTypeChoices.BEEF,
            category="BEEF",
            is_active=True,
        )
        self.master_product = MasterProduct.objects.create(
            tenant=self.tenant,
            protein=ProteinTypeChoices.BEEF,
            item_name="Brisket",
            type="flat",
            trim="trimmed",
            system_product=self.product,
        )
        self.supplier = Supplier.objects.create(
            tenant=self.tenant,
            name=f"Supplier {unique}",
            email="",
            preferred_protein_types=[ProteinTypeChoices.BEEF],
        )
        self.plant = Plant.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            name="Outbound Plant",
            created_by=self.user,
        )
        Contact.objects.create(
            tenant=self.tenant,
            supplier=self.supplier,
            plant=self.plant,
            department="sales",
            first_name="Rita",
            last_name="Receiver",
            email="rita.receiver@example.com",
            title="Sales Supervisor",
            protein_types_responsible=[ProteinTypeChoices.BEEF],
            items_responsible=[self.master_product.display_name],
            documents_responsible_for=["Spec Sheets"],
        )
        self.inquiry = Inquiry.objects.create(
            tenant=self.tenant,
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=self.customer,
            source_type=InquirySourceChoices.EMAIL,
            route_decision=InquiryRouteDecisionChoices.BROKER,
            shipping_type=InquiryShippingTypeChoices.TENANT,
            requested_master_product=self.master_product,
            requested_protein=ProteinTypeChoices.BEEF,
            created_by=self.user,
        )

    @patch("tenant_apps.workflows.services.action_executor.EmailMultiAlternatives")
    def test_send_email_can_use_supplier_plant_contact_routing(self, email_cls):
        message = email_cls.return_value

        executor = ActionExecutor(
            self.tenant,
            context={
                "trigger": {"entity_id": str(self.inquiry.id)},
                "variables": {},
            },
        )

        result = executor.execute(
            "send_email",
            {
                "recipient_strategy": "supplier_plant_contact",
                "supplier_id": str(self.supplier.id),
                "inquiry_id": str(self.inquiry.id),
                "email_focus": "auto",
                "subject": "RFQ {{trigger.entity_id}}",
                "body": "Please review the inquiry.",
            },
        )

        self.assertTrue(result.get("success"), result)
        email_cls.assert_called_once()
        self.assertEqual(email_cls.call_args.kwargs["to"], ["rita.receiver@example.com"])
        self.assertEqual(result["routing"]["department"], "sales")
        message.attach.assert_called_once()
        message.send.assert_called_once_with(fail_silently=False)
