"""Tests for the carrier reply parser service (CTE-04.4)."""

import uuid
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.tenants.models import Tenant, TenantUser
from django.contrib.auth import get_user_model
from apps.integrations.models import EmailLog
from tenant_apps.carriers.models import (
    Carrier,
    CarrierFreightInquiry,
    CarrierFreightInquiryStatus,
)
from tenant_apps.carriers.services.carrier_reply_parser import (
    parse_carrier_reply,
    _correlate_inquiry,
    _extract_so_references,
)
from tenant_apps.purchase_orders.models import CarrierPurchaseOrder, CarrierPurchaseOrderStatus
from tenant_apps.sales_orders.models import SalesOrder, SalesOrderStatus

User = get_user_model()


def _uid():
    return uuid.uuid4().hex[:8]


class CarrierReplyCorrelationTests(TestCase):
    """Tests for correlating carrier emails to freight inquiries."""

    @classmethod
    def setUpTestData(cls):
        cls.tenant = Tenant.objects.create(name=f"Test Tenant {_uid()}", slug=f"test-{_uid()}")
        cls.user = User.objects.create_user(username=f"tester_{_uid()}", password="password123")
        TenantUser.objects.create(tenant=cls.tenant, user=cls.user, role="admin")

        from tenant_apps.suppliers.models import Supplier
        from tenant_apps.customers.models import Customer

        cls.supplier = Supplier.objects.create(tenant=cls.tenant, name=f"Supplier {_uid()}")
        cls.customer = Customer.objects.create(
            tenant=cls.tenant, name=f"Customer {_uid()}", email="cust@example.com"
        )
        cls.carrier = Carrier.objects.create(
            tenant=cls.tenant,
            name=f"FastFreight {_uid()}",
            code=f"FF-{_uid()[:4]}",
            email="dispatch@fastfreight.com",
            is_active=True,
        )
        cls.sales_order = SalesOrder.objects.create(
            tenant=cls.tenant,
            supplier=cls.supplier,
            customer=cls.customer,
            our_sales_order_num=f"SO-{_uid()}",
            status=SalesOrderStatus.APPROVED,
        )
        cls.inquiry = CarrierFreightInquiry.objects.create(
            tenant=cls.tenant,
            carrier=cls.carrier,
            sales_order=cls.sales_order,
            initiated_by=cls.user,
            recipient_email="dispatch@fastfreight.com",
            subject=f"Freight Quote Request - {cls.sales_order.our_sales_order_num}",
            status=CarrierFreightInquiryStatus.SENT,
            sent_at=timezone.now(),
            provider_thread_id="thread-abc-123",
        )

    def test_correlate_by_thread_id(self):
        result = _correlate_inquiry(
            tenant_id=self.tenant.id,
            sender_email="dispatch@fastfreight.com",
            thread_id="thread-abc-123",
            subject="Re: Freight Quote",
            body="We can do $3.50/mile",
        )
        self.assertTrue(result["matched"])
        self.assertEqual(result["inquiry"].id, self.inquiry.id)
        self.assertIn("thread_id", result["method"])

    def test_correlate_by_sender_email(self):
        result = _correlate_inquiry(
            tenant_id=self.tenant.id,
            sender_email="dispatch@fastfreight.com",
            thread_id="",
            subject="Quote available",
            body="We have availability",
        )
        self.assertTrue(result["matched"])
        self.assertEqual(result["inquiry"].id, self.inquiry.id)

    def test_no_match_for_unknown_sender(self):
        result = _correlate_inquiry(
            tenant_id=self.tenant.id,
            sender_email="unknown@carrier.com",
            thread_id="",
            subject="Random email",
            body="Nothing relevant",
        )
        self.assertFalse(result["matched"])

    def test_extract_so_references(self):
        refs = _extract_so_references(
            "Re: Freight Quote Request - SO-12345 (Dallas → Houston)",
            "Regarding Ref: SO-67890, we can provide...",
        )
        self.assertIn("SO-12345", refs)
        self.assertIn("SO-67890", refs)


class CarrierReplyParserServiceTests(TestCase):
    """Unit tests for parse_carrier_reply."""

    @classmethod
    def setUpTestData(cls):
        cls.tenant = Tenant.objects.create(name=f"Parse Tenant {_uid()}", slug=f"parse-{_uid()}")
        cls.user = User.objects.create_user(username=f"parser_{_uid()}", password="password123")
        TenantUser.objects.create(tenant=cls.tenant, user=cls.user, role="admin")

        from tenant_apps.suppliers.models import Supplier
        from tenant_apps.customers.models import Customer

        cls.supplier = Supplier.objects.create(tenant=cls.tenant, name=f"Supplier {_uid()}")
        cls.customer = Customer.objects.create(
            tenant=cls.tenant, name=f"Customer {_uid()}", email="cust@example.com"
        )
        cls.carrier = Carrier.objects.create(
            tenant=cls.tenant,
            name=f"ReliableHaul {_uid()}",
            code=f"RH-{_uid()[:4]}",
            email="rates@reliablehaul.com",
            is_active=True,
        )
        cls.sales_order = SalesOrder.objects.create(
            tenant=cls.tenant,
            supplier=cls.supplier,
            customer=cls.customer,
            our_sales_order_num=f"SO-P-{_uid()}",
            status=SalesOrderStatus.APPROVED,
        )
        cls.inquiry = CarrierFreightInquiry.objects.create(
            tenant=cls.tenant,
            carrier=cls.carrier,
            sales_order=cls.sales_order,
            initiated_by=cls.user,
            recipient_email="rates@reliablehaul.com",
            subject=f"Freight Quote Request - {cls.sales_order.our_sales_order_num}",
            status=CarrierFreightInquiryStatus.SENT,
            sent_at=timezone.now(),
            provider_thread_id="thread-xyz-789",
            origin_city="Dallas",
            origin_state="TX",
            destination_city="Houston",
            destination_state="TX",
        )

    def _make_email_log(self, **kwargs):
        from apps.integrations.models import ExternalAuthProvider

        provider = ExternalAuthProvider.objects.filter(tenant=self.tenant).first()
        if not provider:
            provider = ExternalAuthProvider.objects.create(
                tenant=self.tenant,
                provider_type="microsoft",
                access_token="test-token",
                token_expiry=timezone.now() + timezone.timedelta(hours=1),
                is_active=True,
                connected_email="logistics@company.com",
            )

        defaults = {
            "tenant": self.tenant,
            "provider": provider,
            "sender_email": "rates@reliablehaul.com",
            "subject": "Re: Freight Quote Request",
            "body_text": "We can haul this load for $3.50/mile. Available next Tuesday.",
            "thread_id": "thread-xyz-789",
            "message_id": f"msg-{_uid()}",
            "received_at": timezone.now(),
        }
        defaults.update(kwargs)
        return EmailLog.objects.create(**defaults)

    def test_missing_email_log_returns_error(self):
        result = parse_carrier_reply(email_log=None)
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "missing_context")

    def test_unmatched_sender_returns_error(self):
        email = self._make_email_log(
            sender_email="unknown@random.com",
            thread_id="no-match-thread",
        )
        result = parse_carrier_reply(email_log=email)
        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "no_match")

    @patch("tenant_apps.carriers.services.carrier_reply_parser._extract_freight_quote")
    def test_affirmative_reply_creates_draft_carrier_po(self, mock_extract):
        mock_extract.return_value = {
            "summary": "Carrier accepts at $3.50/mile",
            "rationale": "Clear acceptance with rate",
            "confidence": 0.95,
            "availability_status": "affirmative",
            "rate_per_mile": 3.50,
            "flat_rate": None,
            "currency": "USD",
            "transit_days_min": 1,
            "transit_days_max": 2,
            "available_date": "2026-05-10",
            "truck_type": "reefer",
            "capacity_lbs": 44000,
            "notes": "Available next Tuesday",
        }
        email = self._make_email_log()

        result = parse_carrier_reply(email_log=email)

        self.assertTrue(result.success)
        self.assertEqual(result.parse_status, "parsed")
        self.assertGreater(result.confidence, 0.9)
        self.assertIsNotNone(result.carrier_po_id)

        # Verify CarrierPurchaseOrder created
        cpo = CarrierPurchaseOrder.objects.get(id=result.carrier_po_id)
        self.assertEqual(cpo.tenant_id, self.tenant.id)
        self.assertEqual(cpo.carrier_id, self.carrier.id)
        self.assertEqual(cpo.sales_order_id, self.sales_order.id)
        self.assertEqual(cpo.status, CarrierPurchaseOrderStatus.DRAFT)
        self.assertEqual(cpo.custom_data["carrier_reply_parse"]["rate_per_mile"], 3.50)

        # Verify inquiry status updated
        self.inquiry.refresh_from_db()
        self.assertEqual(self.inquiry.status, CarrierFreightInquiryStatus.ACCEPTED)

    @patch("tenant_apps.carriers.services.carrier_reply_parser._extract_freight_quote")
    def test_negative_reply_declines_inquiry(self, mock_extract):
        mock_extract.return_value = {
            "summary": "Carrier declines - no availability",
            "rationale": "Explicit decline",
            "confidence": 0.9,
            "availability_status": "negative",
            "rate_per_mile": None,
            "flat_rate": None,
            "currency": "USD",
            "transit_days_min": None,
            "transit_days_max": None,
            "available_date": None,
            "truck_type": "",
            "capacity_lbs": None,
            "notes": "All trucks committed this week",
        }
        email = self._make_email_log()

        result = parse_carrier_reply(email_log=email)

        self.assertTrue(result.success)
        self.assertIsNone(result.carrier_po_id)

        self.inquiry.refresh_from_db()
        self.assertEqual(self.inquiry.status, CarrierFreightInquiryStatus.DECLINED)

    @patch("tenant_apps.carriers.services.carrier_reply_parser._extract_freight_quote")
    def test_parse_error_marks_inquiry_failed(self, mock_extract):
        mock_extract.side_effect = RuntimeError("OpenAI timeout")
        email = self._make_email_log()

        result = parse_carrier_reply(email_log=email)

        self.assertFalse(result.success)
        self.assertEqual(result.error_code, "parse_error")

        self.inquiry.refresh_from_db()
        self.assertEqual(self.inquiry.status, CarrierFreightInquiryStatus.FAILED)

    @patch("tenant_apps.carriers.services.carrier_reply_parser._extract_freight_quote")
    def test_idempotent_does_not_create_duplicate_cpo(self, mock_extract):
        mock_extract.return_value = {
            "summary": "Carrier accepts",
            "rationale": "Clear",
            "confidence": 0.95,
            "availability_status": "affirmative",
            "rate_per_mile": 3.50,
            "flat_rate": None,
            "currency": "USD",
            "transit_days_min": 1,
            "transit_days_max": 2,
            "available_date": None,
            "truck_type": "reefer",
            "capacity_lbs": 44000,
            "notes": "",
        }

        email1 = self._make_email_log()
        result1 = parse_carrier_reply(email_log=email1)
        self.assertTrue(result1.success)
        self.assertIsNotNone(result1.carrier_po_id)

        # Reset inquiry to SENT for second parse attempt
        self.inquiry.status = CarrierFreightInquiryStatus.SENT
        self.inquiry.save()

        email2 = self._make_email_log(message_id=f"msg-{_uid()}")
        result2 = parse_carrier_reply(email_log=email2)
        self.assertTrue(result2.success)
        # Same CPO (deduplicated)
        self.assertEqual(result1.carrier_po_id, result2.carrier_po_id)

        # Only 1 CPO in DB
        cpo_count = CarrierPurchaseOrder.objects.filter(
            tenant=self.tenant, carrier=self.carrier, sales_order=self.sales_order
        ).count()
        self.assertEqual(cpo_count, 1)
