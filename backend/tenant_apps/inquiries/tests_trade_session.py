"""Tests for trade session lineage service (CTE-05.1)."""

from __future__ import annotations

import uuid
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from apps.tenants.models import Tenant
from tenant_apps.customers.models import Customer
from tenant_apps.inquiries.models import (
    Inquiry,
    InquiryStatusChoices,
    TradeSession,
    TradeSessionStatus,
)
from tenant_apps.inquiries.services.trade_session import (
    cascade_trade_session,
    get_or_create_trade_session,
    update_trade_session_status,
)
from tenant_apps.purchase_orders.models import PurchaseOrder, PurchaseOrderStatus
from tenant_apps.sales_orders.models import SalesOrder, SalesOrderStatus
from tenant_apps.suppliers.models import Supplier


class TradeSessionCreationTests(TestCase):
    """Test TradeSession creation and ID generation."""

    def setUp(self):
        uid = uuid.uuid4().hex[:6]
        self.tenant = Tenant.objects.create(
            name=f"test-ts-{uid}",
            schema_name=f"ts_{uid}",
            domain=f"ts-{uid}.test.local",
        )
        self.supplier = Supplier.objects.create(
            tenant=self.tenant,
            name=f"Supplier-{uid}",
        )
        self.customer = Customer.objects.create(
            tenant=self.tenant,
            name=f"Customer-{uid}",
        )

    def _make_inquiry(self, **kwargs):
        defaults = {
            "tenant": self.tenant,
            "route_decision": "FULFILL",
            "status": InquiryStatusChoices.PENDING,
            "inquiry_number": f"INQ-{uuid.uuid4().hex[:6]}",
            "supplier": self.supplier,
            "customer": self.customer,
        }
        defaults.update(kwargs)
        return Inquiry.objects.create(**defaults)

    def test_create_trade_session_generates_sequential_id(self):
        inquiry = self._make_inquiry()
        ts, created = get_or_create_trade_session(tenant=self.tenant, inquiry=inquiry)

        self.assertTrue(created)
        self.assertTrue(ts.trade_id.startswith("TRD-"))
        self.assertEqual(ts.trade_id.split("-")[-1], "00001")
        self.assertEqual(ts.status, TradeSessionStatus.INITIATED)
        self.assertEqual(ts.inquiry, inquiry)
        self.assertEqual(ts.tenant, self.tenant)

    def test_idempotent_returns_existing(self):
        inquiry = self._make_inquiry()
        ts1, created1 = get_or_create_trade_session(tenant=self.tenant, inquiry=inquiry)
        ts2, created2 = get_or_create_trade_session(tenant=self.tenant, inquiry=inquiry)

        self.assertTrue(created1)
        self.assertFalse(created2)
        self.assertEqual(ts1.id, ts2.id)

    def test_sequential_ids_increment(self):
        inq1 = self._make_inquiry()
        inq2 = self._make_inquiry()

        ts1, _ = get_or_create_trade_session(tenant=self.tenant, inquiry=inq1)
        ts2, _ = get_or_create_trade_session(tenant=self.tenant, inquiry=inq2)

        self.assertEqual(ts1.trade_id.split("-")[-1], "00001")
        self.assertEqual(ts2.trade_id.split("-")[-1], "00002")

    def test_captures_route_decision(self):
        inquiry = self._make_inquiry(route_decision="BROKER")
        ts, _ = get_or_create_trade_session(tenant=self.tenant, inquiry=inquiry)
        self.assertEqual(ts.route_decision, "BROKER")

    def test_captures_source_email_provenance(self):
        inquiry = self._make_inquiry(
            source_email_message_id="<msg-123@example.com>",
            source_email_thread_id="thread-abc-456",
        )
        ts, _ = get_or_create_trade_session(tenant=self.tenant, inquiry=inquiry)
        self.assertEqual(ts.source_email_message_id, "<msg-123@example.com>")
        self.assertEqual(ts.source_email_thread_id, "thread-abc-456")


class TradeSessionCascadeTests(TestCase):
    """Test cascading trade_session FK to downstream documents."""

    def setUp(self):
        uid = uuid.uuid4().hex[:6]
        self.tenant = Tenant.objects.create(
            name=f"test-cascade-{uid}",
            schema_name=f"cascade_{uid}",
            domain=f"cascade-{uid}.test.local",
        )
        self.supplier = Supplier.objects.create(
            tenant=self.tenant,
            name=f"Supplier-{uid}",
        )
        self.customer = Customer.objects.create(
            tenant=self.tenant,
            name=f"Customer-{uid}",
        )

    def test_cascade_to_purchase_order(self):
        inquiry = Inquiry.objects.create(
            tenant=self.tenant,
            route_decision="BROKER",
            status=InquiryStatusChoices.PENDING,
            inquiry_number=f"INQ-{uuid.uuid4().hex[:6]}",
            supplier=self.supplier,
            customer=self.customer,
        )
        ts, _ = get_or_create_trade_session(tenant=self.tenant, inquiry=inquiry)

        po = PurchaseOrder.objects.create(
            tenant=self.tenant,
            order_number=f"PO-{uuid.uuid4().hex[:6]}",
            supplier=self.supplier,
            total_amount=Decimal("1000.00"),
            status=PurchaseOrderStatus.DRAFT,
            order_date=timezone.now().date(),
        )

        cascade_trade_session(trade_session=ts, purchase_order=po)
        po.refresh_from_db()
        self.assertEqual(po.trade_session_id, ts.id)

    def test_cascade_is_idempotent(self):
        inquiry = Inquiry.objects.create(
            tenant=self.tenant,
            route_decision="FULFILL",
            status=InquiryStatusChoices.PENDING,
            inquiry_number=f"INQ-{uuid.uuid4().hex[:6]}",
            supplier=self.supplier,
            customer=self.customer,
        )
        ts, _ = get_or_create_trade_session(tenant=self.tenant, inquiry=inquiry)

        so = SalesOrder.objects.create(
            tenant=self.tenant,
            our_sales_order_num=f"SO-{uuid.uuid4().hex[:6]}",
            supplier=self.supplier,
            customer=self.customer,
            status=SalesOrderStatus.PENDING,
        )

        cascade_trade_session(trade_session=ts, sales_order=so)
        cascade_trade_session(trade_session=ts, sales_order=so)
        so.refresh_from_db()
        self.assertEqual(so.trade_session_id, ts.id)


class TradeSessionStatusTests(TestCase):
    """Test trade session status transitions."""

    def setUp(self):
        uid = uuid.uuid4().hex[:6]
        self.tenant = Tenant.objects.create(
            name=f"test-status-{uid}",
            schema_name=f"status_{uid}",
            domain=f"status-{uid}.test.local",
        )
        self.supplier = Supplier.objects.create(
            tenant=self.tenant,
            name=f"Supplier-{uid}",
        )
        self.customer = Customer.objects.create(
            tenant=self.tenant,
            name=f"Customer-{uid}",
        )

    def test_update_to_completed_sets_timestamp(self):
        inquiry = Inquiry.objects.create(
            tenant=self.tenant,
            route_decision="FULFILL",
            status=InquiryStatusChoices.PENDING,
            inquiry_number=f"INQ-{uuid.uuid4().hex[:6]}",
            supplier=self.supplier,
            customer=self.customer,
        )
        ts, _ = get_or_create_trade_session(tenant=self.tenant, inquiry=inquiry)
        self.assertIsNone(ts.completed_at)

        update_trade_session_status(
            trade_session=ts, new_status=TradeSessionStatus.COMPLETED
        )
        ts.refresh_from_db()
        self.assertEqual(ts.status, TradeSessionStatus.COMPLETED)
        self.assertIsNotNone(ts.completed_at)

    def test_update_to_sourcing_no_completed_timestamp(self):
        inquiry = Inquiry.objects.create(
            tenant=self.tenant,
            route_decision="BROKER",
            status=InquiryStatusChoices.PENDING,
            inquiry_number=f"INQ-{uuid.uuid4().hex[:6]}",
            supplier=self.supplier,
            customer=self.customer,
        )
        ts, _ = get_or_create_trade_session(tenant=self.tenant, inquiry=inquiry)

        update_trade_session_status(
            trade_session=ts, new_status=TradeSessionStatus.SOURCING
        )
        ts.refresh_from_db()
        self.assertEqual(ts.status, TradeSessionStatus.SOURCING)
        self.assertIsNone(ts.completed_at)
