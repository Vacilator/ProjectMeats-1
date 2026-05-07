import os
import uuid
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.core.models import ProteinTypeChoices
from apps.integrations.models import ExternalAuthProvider
from apps.system.models import Product
from apps.tenants.models import Tenant, TenantUser
from tenant_apps.customers.models import Customer
from tenant_apps.inquiries.models import (
    Inquiry,
    InquiryEntityTypeChoices,
    InquiryRouteDecisionChoices,
    InquiryShippingTypeChoices,
    InquirySourceChoices,
    InquirySupplierRFQ,
    InquirySupplierRFQStatusChoices,
)
from tenant_apps.inquiries.services import send_supplier_rfqs_for_inquiry
from tenant_apps.products.models import MasterProduct
from tenant_apps.suppliers.models import Supplier


class SupplierRFQEmailServiceTests(TestCase):
    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"rfq-user-{unique_id}",
            email=f"rfq-{unique_id}@example.com",
            password="testpass123",
        )
        self.tenant = Tenant.objects.create(
            name=f"RFQ Tenant {unique_id}",
            slug=f"rfq-tenant-{unique_id}",
            contact_email=f"rfq-{unique_id}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner")
        self.customer = Customer.objects.create(name=f"Buyer {unique_id}", tenant=self.tenant)
        self.provider = ExternalAuthProvider.objects.create(
            tenant=self.tenant,
            provider_type="microsoft",
            access_token="placeholder",
            token_expiry=timezone.now() + timedelta(hours=1),
            is_active=True,
            connected_email="planner@example.com",
            connected_name="Planner",
        )
        self.provider.set_encrypted_token("access", "access-token")
        self.provider.set_encrypted_token("refresh", "refresh-token")
        self.provider.save()

        self.system_product = Product.objects.create(
            product_code=f"RFQ-RIBEYE-{unique_id}",
            name="Ribeye",
            protein_type=ProteinTypeChoices.BEEF,
            category="BEEF",
            is_active=True,
        )
        self.master_product = MasterProduct.objects.create(
            tenant=self.tenant,
            protein=ProteinTypeChoices.BEEF,
            item_name="Ribeye",
            type="flat",
            trim="trimmed",
            system_product=self.system_product,
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
            notes="Need current pricing and lead time.",
            created_by=self.user,
        )
        self.supplier = Supplier.objects.create(
            tenant=self.tenant,
            name="Quoted Supplier",
            email="supplier@example.com",
            preferred_protein_types=[ProteinTypeChoices.BEEF],
        )

    @patch("tenant_apps.inquiries.services.supplier_rfq_email.MicrosoftGraphProvider.send_email")
    @patch.dict(os.environ, {"MICROSOFT_CLIENT_ID": "client-id"}, clear=False)
    def test_send_supplier_rfqs_persists_audit_and_provider_metadata(self, mock_send_email):
        mock_send_email.return_value = {
            "status": "sent",
            "provider": "microsoft",
            "provider_message_id": "graph-message-1",
            "provider_thread_id": "graph-thread-1",
            "provider_internet_message_id": "internet-message-1",
        }

        result = send_supplier_rfqs_for_inquiry(
            tenant=self.tenant,
            inquiry=self.inquiry,
            user=self.user,
        )

        self.assertEqual(result.dispatched_count, 1)
        self.assertEqual(result.skipped_count, 0)
        rfq = InquirySupplierRFQ.objects.get(tenant=self.tenant, inquiry=self.inquiry, supplier=self.supplier)
        self.assertEqual(rfq.status, InquirySupplierRFQStatusChoices.SENT)
        self.assertEqual(rfq.sender_provider, self.provider)
        self.assertEqual(rfq.sender_email, "planner@example.com")
        self.assertEqual(rfq.recipient_email, "supplier@example.com")
        self.assertEqual(rfq.provider_message_id, "graph-message-1")
        self.assertEqual(rfq.provider_thread_id, "graph-thread-1")
        self.assertEqual(rfq.provider_internet_message_id, "internet-message-1")
        self.assertEqual(rfq.attempt_count, 1)
        self.assertIn("RFQ reference", rfq.body)
        self.assertEqual(rfq.custom_data["inquiry_number"], self.inquiry.inquiry_number)
        self.assertEqual(rfq.custom_data["provider_result"]["provider_message_id"], "graph-message-1")
        mock_send_email.assert_called_once()

    @patch("tenant_apps.inquiries.services.supplier_rfq_email.MicrosoftGraphProvider.send_email")
    @patch.dict(os.environ, {"MICROSOFT_CLIENT_ID": "client-id"}, clear=False)
    def test_send_supplier_rfqs_is_idempotent_once_sent(self, mock_send_email):
        mock_send_email.return_value = {
            "status": "sent",
            "provider": "microsoft",
            "provider_message_id": "graph-message-1",
            "provider_thread_id": "graph-thread-1",
        }

        first = send_supplier_rfqs_for_inquiry(tenant=self.tenant, inquiry=self.inquiry, user=self.user)
        second = send_supplier_rfqs_for_inquiry(tenant=self.tenant, inquiry=self.inquiry, user=self.user)

        self.assertEqual(first.dispatched_count, 1)
        self.assertEqual(second.dispatched_count, 0)
        self.assertEqual(second.entries[0].skipped_reason, "already_sent")
        self.assertEqual(InquirySupplierRFQ.objects.count(), 1)
        self.assertEqual(InquirySupplierRFQ.objects.get().attempt_count, 1)
        mock_send_email.assert_called_once()

    def test_send_supplier_rfqs_fails_closed_for_non_broker_inquiry(self):
        self.inquiry.route_decision = InquiryRouteDecisionChoices.FULFILL
        self.inquiry.save(update_fields=["route_decision"])

        with self.assertRaisesMessage(ValueError, "Only broker inquiries can dispatch supplier RFQs."):
            send_supplier_rfqs_for_inquiry(tenant=self.tenant, inquiry=self.inquiry, user=self.user)

        self.assertFalse(InquirySupplierRFQ.objects.exists())

    @patch("tenant_apps.inquiries.services.supplier_rfq_email.MicrosoftGraphProvider.send_email")
    def test_send_supplier_rfqs_ignores_cross_tenant_supplier_ids(self, mock_send_email):
        other_user = User.objects.create_user(
            username="rfq-other-user",
            email="rfq-other@example.com",
            password="testpass123",
        )
        other_tenant = Tenant.objects.create(
            name="Other RFQ Tenant",
            slug="other-rfq-tenant",
            contact_email="other-rfq@example.com",
            created_by=other_user,
        )
        TenantUser.objects.create(tenant=other_tenant, user=other_user, role="owner")
        other_supplier = Supplier.objects.create(
            tenant=other_tenant,
            name="Other Supplier",
            email="other-supplier@example.com",
            preferred_protein_types=[ProteinTypeChoices.BEEF],
        )

        result = send_supplier_rfqs_for_inquiry(
            tenant=self.tenant,
            inquiry=self.inquiry,
            user=self.user,
            supplier_ids=[other_supplier.id],
        )

        self.assertEqual(result.dispatched_count, 0)
        self.assertEqual(result.entries, ())
        self.assertFalse(InquirySupplierRFQ.objects.exists())
        mock_send_email.assert_not_called()
