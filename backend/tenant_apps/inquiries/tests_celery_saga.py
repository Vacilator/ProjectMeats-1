"""Tests for Celery saga consumers (CTE-06.2).

Covers: process_domain_event task, saga dispatch, idempotency,
individual handlers, and the sweep task.
"""

import uuid
from unittest.mock import MagicMock, patch

from django.test import TestCase
from django.utils import timezone

from tenant_apps.inquiries.tasks import (
    SAGA_HANDLERS,
    _dispatch_saga,
    _saga_inquiry_routed,
    _saga_sales_order_approved,
    _saga_supplier_po_approved,
    _saga_trade_completed,
    enqueue_event_for_saga,
    process_domain_event,
    process_unprocessed_events,
)

from apps.core.events.contracts import TradeEventType
from apps.core.events.dispatcher import emit_trade_event
from apps.core.models import TradeEventLog
from apps.tenants.models import Tenant


class ProcessDomainEventTests(TestCase):
    """Tests for the process_domain_event Celery task."""

    def setUp(self):
        self.tenant = Tenant.objects.create(
            name="Saga Test Tenant",
            slug="saga-test",
            schema_name="saga_test",
        )

    def test_process_event_marks_as_processed(self):
        """Task should mark event as processed after handling."""
        event = emit_trade_event(
            event_type=TradeEventType.INQUIRY_ROUTED,
            tenant_id=str(self.tenant.pk),
            entity_type="Inquiry",
            entity_id="42",
            route_decision="BROKER",
        )

        # Call synchronously (not via Celery broker)
        result = process_domain_event(event.event_id)

        self.assertEqual(result["status"], "processed")
        log_entry = TradeEventLog.objects.get(event_id=event.event_id)
        self.assertTrue(log_entry.processed)
        self.assertIsNotNone(log_entry.processed_at)

    def test_process_event_idempotent(self):
        """Processing same event twice should return already_processed."""
        event = emit_trade_event(
            event_type=TradeEventType.SUPPLIER_PO_APPROVED,
            tenant_id=str(self.tenant.pk),
            entity_type="PurchaseOrder",
            entity_id="99",
        )

        # Process first time
        result1 = process_domain_event(event.event_id)
        self.assertEqual(result1["status"], "processed")

        # Process second time — should be idempotent
        result2 = process_domain_event(event.event_id)
        self.assertEqual(result2["status"], "already_processed")

    def test_process_nonexistent_event(self):
        """Processing a non-existent event_id should return not_found."""
        result = process_domain_event("nonexistent-event-id")
        self.assertEqual(result["status"], "not_found")

    def test_process_event_with_no_handler(self):
        """Events without a saga handler should still be marked processed."""
        event = emit_trade_event(
            event_type=TradeEventType.INQUIRY_CREATED,
            tenant_id=str(self.tenant.pk),
            entity_type="Inquiry",
            entity_id="1",
        )

        result = process_domain_event(event.event_id)
        self.assertEqual(result["status"], "processed")
        self.assertEqual(result["result"]["action"], "no_handler")


class SagaDispatchTests(TestCase):
    """Tests for _dispatch_saga routing."""

    def setUp(self):
        self.tenant = Tenant.objects.create(
            name="Dispatch Test",
            slug="dispatch-test",
            schema_name="dispatch_test",
        )

    def test_dispatch_routes_to_correct_handler(self):
        """Should call the handler matching the event_type."""
        event = emit_trade_event(
            event_type=TradeEventType.SUPPLIER_PO_APPROVED,
            tenant_id=str(self.tenant.pk),
            entity_type="PurchaseOrder",
            entity_id="55",
        )
        log_entry = TradeEventLog.objects.get(event_id=event.event_id)

        result = _dispatch_saga(log_entry)
        self.assertEqual(result["action"], "sales_order_draft_triggered")
        self.assertEqual(result["source_po_id"], "55")

    def test_dispatch_returns_no_handler_for_unknown_type(self):
        """Events without handlers should return no_handler."""
        event = emit_trade_event(
            event_type=TradeEventType.TRADE_CANCELLED,
            tenant_id=str(self.tenant.pk),
        )
        log_entry = TradeEventLog.objects.get(event_id=event.event_id)

        result = _dispatch_saga(log_entry)
        self.assertEqual(result["action"], "no_handler")

    def test_all_saga_handlers_exist(self):
        """All registered handler names should map to real functions."""
        from tenant_apps.inquiries import tasks

        for event_type, handler_name in SAGA_HANDLERS.items():
            fn = getattr(tasks, handler_name, None)
            self.assertIsNotNone(fn, f"Handler {handler_name} for {event_type} not found")


class IndividualSagaHandlerTests(TestCase):
    """Tests for individual saga handler functions."""

    def setUp(self):
        self.tenant = Tenant.objects.create(
            name="Handler Test",
            slug="handler-test",
            schema_name="handler_test",
        )

    def test_saga_inquiry_routed_broker(self):
        """BROKER route should trigger RFQ dispatch."""
        event = emit_trade_event(
            event_type=TradeEventType.INQUIRY_ROUTED,
            tenant_id=str(self.tenant.pk),
            entity_id="100",
            route_decision="BROKER",
        )
        log_entry = TradeEventLog.objects.get(event_id=event.event_id)

        result = _saga_inquiry_routed(log_entry)
        self.assertEqual(result["action"], "broker_path_initiated")

    def test_saga_inquiry_routed_fulfill(self):
        """FULFILL route should trigger SO draft."""
        event = emit_trade_event(
            event_type=TradeEventType.INQUIRY_ROUTED,
            tenant_id=str(self.tenant.pk),
            entity_id="101",
            route_decision="FULFILL",
        )
        log_entry = TradeEventLog.objects.get(event_id=event.event_id)

        result = _saga_inquiry_routed(log_entry)
        self.assertEqual(result["action"], "fulfill_path_initiated")

    def test_saga_sales_order_approved_broker_triggers_carrier(self):
        """BROKER route SO approval should trigger carrier inquiry."""
        event = emit_trade_event(
            event_type=TradeEventType.SALES_ORDER_APPROVED,
            tenant_id=str(self.tenant.pk),
            entity_id="SO-77",
            route_decision="BROKER",
        )
        log_entry = TradeEventLog.objects.get(event_id=event.event_id)

        result = _saga_sales_order_approved(log_entry)
        self.assertIn("carrier_inquiry_triggered", result["triggered_actions"])
        self.assertIn("pdf_generation_triggered", result["triggered_actions"])

    def test_saga_sales_order_approved_fulfill_no_carrier(self):
        """FULFILL route SO approval should NOT trigger carrier."""
        event = emit_trade_event(
            event_type=TradeEventType.SALES_ORDER_APPROVED,
            tenant_id=str(self.tenant.pk),
            entity_id="SO-88",
            route_decision="FULFILL",
        )
        log_entry = TradeEventLog.objects.get(event_id=event.event_id)

        result = _saga_sales_order_approved(log_entry)
        self.assertNotIn("carrier_inquiry_triggered", result["triggered_actions"])

    def test_saga_trade_completed(self):
        """Trade completed should finalize."""
        event = emit_trade_event(
            event_type=TradeEventType.TRADE_COMPLETED,
            tenant_id=str(self.tenant.pk),
            trade_id="TRD-2026-00001",
        )
        log_entry = TradeEventLog.objects.get(event_id=event.event_id)

        result = _saga_trade_completed(log_entry)
        self.assertEqual(result["action"], "trade_finalized")


class ProcessUnprocessedEventsTests(TestCase):
    """Tests for the sweep task."""

    def setUp(self):
        self.tenant = Tenant.objects.create(
            name="Sweep Test",
            slug="sweep-test",
            schema_name="sweep_test",
        )

    @patch("tenant_apps.inquiries.tasks.process_domain_event.delay")
    def test_sweep_enqueues_unprocessed(self, mock_delay):
        """Sweep should enqueue unprocessed events."""
        # Create 3 events
        for i in range(3):
            emit_trade_event(
                event_type=TradeEventType.INQUIRY_CREATED,
                tenant_id=str(self.tenant.pk),
                entity_id=str(i),
            )

        result = process_unprocessed_events(tenant_id=str(self.tenant.pk))
        self.assertEqual(result["enqueued"], 3)
        self.assertEqual(mock_delay.call_count, 3)

    @patch("tenant_apps.inquiries.tasks.process_domain_event.delay")
    def test_sweep_skips_processed(self, mock_delay):
        """Sweep should not re-enqueue processed events."""
        event = emit_trade_event(
            event_type=TradeEventType.INQUIRY_CREATED,
            tenant_id=str(self.tenant.pk),
        )
        # Mark as processed
        log_entry = TradeEventLog.objects.get(event_id=event.event_id)
        log_entry.processed = True
        log_entry.processed_at = timezone.now()
        log_entry.save()

        result = process_unprocessed_events(tenant_id=str(self.tenant.pk))
        self.assertEqual(result["enqueued"], 0)
        mock_delay.assert_not_called()


class EnqueueEventForSagaTests(TestCase):
    """Tests for enqueue_event_for_saga utility."""

    @patch("tenant_apps.inquiries.tasks.process_domain_event.delay")
    def test_enqueue_calls_delay(self, mock_delay):
        """Should call process_domain_event.delay with event_id."""
        enqueue_event_for_saga("test-event-id")
        mock_delay.assert_called_once_with("test-event-id")

    @patch("tenant_apps.inquiries.tasks.process_domain_event.delay")
    def test_enqueue_handles_broker_failure(self, mock_delay):
        """Should not raise if Celery broker is unavailable."""
        mock_delay.side_effect = ConnectionError("Broker down")

        # Should not raise
        enqueue_event_for_saga("test-event-id")
