import uuid
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

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
from tenant_apps.inquiries.services import parse_supplier_quote_reply
from tenant_apps.products.models import MasterProduct
from tenant_apps.suppliers.models import Supplier

from apps.core.models import ProteinTypeChoices
from apps.integrations.models import EmailLog, ExternalAuthProvider
from apps.system.models import Product
from apps.tenants.models import Tenant, TenantUser


class SupplierQuoteReplyParserTests(TestCase):
    def setUp(self):
        unique_id = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"rfq-reply-user-{unique_id}",
            email=f"rfq-reply-{unique_id}@example.com",
            password="testpass123",
        )
        self.tenant = Tenant.objects.create(
            name=f"RFQ Reply Tenant {unique_id}",
            slug=f"rfq-reply-tenant-{unique_id}",
            contact_email=f"rfq-reply-{unique_id}@example.com",
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
            product_code=f"RFQ-QUOTE-{unique_id}",
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
        self.rfq = InquirySupplierRFQ.objects.create(
            tenant=self.tenant,
            inquiry=self.inquiry,
            supplier=self.supplier,
            created_by=self.user,
            sender_provider=self.provider,
            sender_email="planner@example.com",
            recipient_email="supplier@example.com",
            recipient_name="Quoted Supplier",
            subject="RFQ for Ribeye",
            body="Please quote ribeye.\nRFQ reference: 11111111-1111-1111-1111-111111111111",
            status=InquirySupplierRFQStatusChoices.SENT,
            attempt_count=1,
            sent_at=timezone.now(),
            provider_message_id="graph-message-1",
            provider_thread_id="graph-thread-1",
            provider_internet_message_id="internet-message-1",
            correlation_key=uuid.UUID("11111111-1111-1111-1111-111111111111"),
        )

    def _create_email_log(
        self,
        *,
        message_id: str,
        thread_id: str = "",
        subject: str = "Re: RFQ for Ribeye",
        body_text: str = "We can offer 20,000 lbs at $2.45/lb next week.",
        sender_email: str = "supplier@example.com",
    ) -> EmailLog:
        return EmailLog.objects.create(
            tenant=self.tenant,
            provider=self.provider,
            message_id=message_id,
            thread_id=thread_id,
            subject=subject,
            sender_email=sender_email,
            sender_name="Supplier Rep",
            received_at=timezone.now(),
            body_text=body_text,
            body_html="",
            has_attachments=False,
            attachment_count=0,
            status="action_required",
        )

    @patch("tenant_apps.inquiries.services.supplier_quote_reply_parser._extract_supplier_quote_payload")
    def test_parse_supplier_quote_reply_matches_thread_and_persists_payload(self, extract_supplier_quote_payload):
        extract_supplier_quote_payload.return_value = {
            "summary": "Supplier quoted 20,000 LBS at 2.45 USD/lb.",
            "rationale": "Reply explicitly confirmed price, quantity, and lead time.",
            "confidence": 0.88,
            "normalized_quote": {
                "availability_status": "affirmative",
                "offered_product_name": "Ribeye",
                "price_per_unit": 2.45,
                "currency": "USD",
                "quantity": 20000,
                "uom": "LBS",
                "lead_time_text": "7 days",
                "lead_time_days_min": 7,
                "lead_time_days_max": 7,
                "notes": "",
            },
        }
        email_log = self._create_email_log(message_id="graph-reply-1", thread_id="graph-thread-1")

        payload = parse_supplier_quote_reply(email_log=email_log)

        self.rfq.refresh_from_db()
        self.assertIsNotNone(payload)
        self.assertEqual(payload["supplier_reply_parse"]["parse_status"], "parsed")
        self.assertEqual(payload["supplier_reply_parse"]["correlation_method"], "thread_id")
        self.assertEqual(payload["supplier_reply_parse"]["lineage"]["rfq_id"], self.rfq.id)
        self.assertEqual(self.rfq.custom_data["latest_reply_parse"]["lineage"]["email_log_id"], email_log.id)
        self.assertEqual(
            self.rfq.custom_data["latest_reply_parse"]["normalized_quote"]["price_per_unit"],
            2.45,
        )

    @patch("tenant_apps.inquiries.services.supplier_quote_reply_parser._extract_supplier_quote_payload")
    def test_parse_supplier_quote_reply_falls_back_to_rfq_reference(self, extract_supplier_quote_payload):
        extract_supplier_quote_payload.return_value = {
            "summary": "Supplier can cover the RFQ.",
            "rationale": "Explicit reply with the RFQ reference.",
            "confidence": 0.81,
            "normalized_quote": {
                "availability_status": "affirmative",
                "offered_product_name": "Ribeye",
                "price_per_unit": None,
                "currency": "",
                "quantity": 12000,
                "uom": "LBS",
                "lead_time_text": "next week",
                "lead_time_days_min": None,
                "lead_time_days_max": None,
                "notes": "",
            },
        }
        email_log = self._create_email_log(
            message_id="graph-reply-2",
            thread_id="",
            body_text="Reconfirming the ask.\nRFQ reference: 11111111-1111-1111-1111-111111111111\nWe can cover 12,000 lbs next week.",
        )

        payload = parse_supplier_quote_reply(email_log=email_log)

        self.assertIsNotNone(payload)
        self.assertEqual(payload["supplier_reply_parse"]["correlation_method"], "rfq_reference")
        self.assertEqual(payload["supplier_reply_parse"]["lineage"]["rfq_id"], self.rfq.id)

    def test_parse_supplier_quote_reply_fails_closed_for_ambiguous_thread_match(self):
        second_inquiry = Inquiry.objects.create(
            tenant=self.tenant,
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=self.customer,
            source_type=InquirySourceChoices.EMAIL,
            route_decision=InquiryRouteDecisionChoices.BROKER,
            shipping_type=InquiryShippingTypeChoices.TENANT,
            requested_master_product=self.master_product,
            requested_protein=ProteinTypeChoices.BEEF,
            notes="Need another quote.",
            created_by=self.user,
        )
        InquirySupplierRFQ.objects.create(
            tenant=self.tenant,
            inquiry=second_inquiry,
            supplier=self.supplier,
            created_by=self.user,
            sender_provider=self.provider,
            sender_email="planner@example.com",
            recipient_email="supplier@example.com",
            recipient_name="Quoted Supplier",
            subject="RFQ follow-up",
            body="Please quote another lot.",
            status=InquirySupplierRFQStatusChoices.SENT,
            attempt_count=1,
            sent_at=timezone.now(),
            provider_thread_id="graph-thread-1",
        )
        email_log = self._create_email_log(message_id="graph-reply-3", thread_id="graph-thread-1")

        payload = parse_supplier_quote_reply(email_log=email_log)

        self.assertIsNotNone(payload)
        self.assertEqual(payload["supplier_reply_parse"]["parse_status"], "ambiguous")
        self.assertEqual(payload["supplier_reply_parse"]["correlation_status"], "ambiguous")
        self.assertEqual(len(payload["supplier_reply_parse"]["lineage"]["candidate_rfqs"]), 2)
        self.rfq.refresh_from_db()
        self.assertNotIn("latest_reply_parse", self.rfq.custom_data)

    def test_parse_supplier_quote_reply_fails_closed_for_unmatched_reference(self):
        email_log = self._create_email_log(
            message_id="graph-reply-4",
            thread_id="",
            body_text="RFQ reference: 22222222-2222-2222-2222-222222222222\nCan you confirm?",
        )

        payload = parse_supplier_quote_reply(email_log=email_log)

        self.assertIsNotNone(payload)
        self.assertEqual(payload["supplier_reply_parse"]["parse_status"], "unmatched")
        self.assertEqual(payload["supplier_reply_parse"]["correlation_method"], "rfq_reference")
        self.assertEqual(payload["supplier_reply_parse"]["lineage"]["rfq_id"], None)

    @patch("tenant_apps.inquiries.services.supplier_quote_reply_parser._extract_supplier_quote_payload")
    def test_parse_supplier_quote_reply_ignores_cross_tenant_rfq_rows(self, extract_supplier_quote_payload):
        extract_supplier_quote_payload.return_value = {
            "summary": "Supplier quoted 20,000 LBS at 2.45 USD/lb.",
            "rationale": "Reply explicitly confirmed price, quantity, and lead time.",
            "confidence": 0.88,
            "normalized_quote": {
                "availability_status": "affirmative",
                "offered_product_name": "Ribeye",
                "price_per_unit": 2.45,
                "currency": "USD",
                "quantity": 20000,
                "uom": "LBS",
                "lead_time_text": "7 days",
                "lead_time_days_min": 7,
                "lead_time_days_max": 7,
                "notes": "",
            },
        }
        other_user = User.objects.create_user(
            username="rfq-cross-tenant-user",
            email="rfq-cross-tenant@example.com",
            password="testpass123",
        )
        other_tenant = Tenant.objects.create(
            name="Other RFQ Reply Tenant",
            slug="other-rfq-reply-tenant",
            contact_email="other-rfq-reply@example.com",
            created_by=other_user,
        )
        TenantUser.objects.create(tenant=other_tenant, user=other_user, role="owner")
        other_customer = Customer.objects.create(name="Other Buyer", tenant=other_tenant)
        other_supplier = Supplier.objects.create(
            tenant=other_tenant,
            name="Other Supplier",
            email="supplier@example.com",
            preferred_protein_types=[ProteinTypeChoices.BEEF],
        )
        other_inquiry = Inquiry.objects.create(
            tenant=other_tenant,
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
            customer=other_customer,
            source_type=InquirySourceChoices.EMAIL,
            route_decision=InquiryRouteDecisionChoices.BROKER,
            shipping_type=InquiryShippingTypeChoices.TENANT,
            requested_protein=ProteinTypeChoices.BEEF,
            created_by=other_user,
        )
        InquirySupplierRFQ.objects.create(
            tenant=other_tenant,
            inquiry=other_inquiry,
            supplier=other_supplier,
            created_by=other_user,
            sender_email="planner@example.com",
            recipient_email="supplier@example.com",
            subject="Other tenant RFQ",
            body="Other tenant RFQ reference",
            status=InquirySupplierRFQStatusChoices.SENT,
            attempt_count=1,
            sent_at=timezone.now(),
            provider_thread_id="graph-thread-1",
        )
        email_log = self._create_email_log(message_id="graph-reply-5", thread_id="graph-thread-1")

        payload = parse_supplier_quote_reply(email_log=email_log)

        self.assertIsNotNone(payload)
        self.assertEqual(payload["supplier_reply_parse"]["lineage"]["rfq_id"], self.rfq.id)

    @patch("tenant_apps.inquiries.services.supplier_quote_reply_parser._extract_supplier_quote_payload")
    def test_parse_supplier_quote_reply_persists_parse_errors(self, extract_supplier_quote_payload):
        extract_supplier_quote_payload.side_effect = RuntimeError("structured parser unavailable")
        email_log = self._create_email_log(message_id="graph-reply-6", thread_id="graph-thread-1")

        payload = parse_supplier_quote_reply(email_log=email_log)

        self.rfq.refresh_from_db()
        self.assertIsNotNone(payload)
        self.assertEqual(payload["supplier_reply_parse"]["parse_status"], "error")
        self.assertEqual(payload["supplier_reply_parse"]["errors"], ["structured parser unavailable"])
        self.assertEqual(self.rfq.custom_data["latest_reply_parse"]["parse_status"], "error")
