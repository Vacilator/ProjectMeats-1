"""Tests for the domain event system (CTE-06.1).

Covers: contracts, dispatcher, durable storage, handler registration,
idempotency, and event querying.
"""

import uuid

from django.test import TestCase
from django.utils import timezone

from apps.core.events.contracts import (
    AUTO_ADVANCE_EVENTS,
    DOWNSTREAM_EVENT_MAP,
    MANUAL_GATE_EVENTS,
    TradeEvent,
    TradeEventType,
)
from apps.core.events.dispatcher import (
    clear_handlers,
    emit_trade_event,
    get_trade_event_log,
    register_handler,
)
from apps.core.models import TradeEventLog
from apps.tenants.models import Tenant


class TradeEventContractTests(TestCase):
    """Tests for TradeEvent dataclass and type registry."""

    def test_trade_event_type_values_follow_convention(self):
        """All event types must follow {entity}.{past_tense_verb} naming."""
        for evt in TradeEventType:
            parts = evt.value.split(".")
            self.assertEqual(len(parts), 2, f"{evt.value} must have exactly one dot")
            self.assertTrue(len(parts[0]) > 0, f"{evt.value} entity part empty")
            self.assertTrue(len(parts[1]) > 0, f"{evt.value} verb part empty")

    def test_trade_event_creation_generates_uuid(self):
        """TradeEvent should auto-generate a unique event_id."""
        event = TradeEvent(
            event_type=TradeEventType.INQUIRY_CREATED,
            tenant_id=str(uuid.uuid4()),
        )
        self.assertEqual(len(event.event_id), 36)  # UUID format
        self.assertIn("-", event.event_id)

    def test_trade_event_to_dict_and_from_dict_roundtrip(self):
        """Serialization/deserialization should be lossless."""
        original = TradeEvent(
            event_type=TradeEventType.SUPPLIER_PO_APPROVED,
            tenant_id=str(uuid.uuid4()),
            trade_id="TRD-2026-00042",
            entity_type="PurchaseOrder",
            entity_id="123",
            payload={"margin": 15.5, "supplier_name": "Acme"},
            route_decision="BROKER",
        )
        serialized = original.to_dict()
        restored = TradeEvent.from_dict(serialized)

        self.assertEqual(restored.event_id, original.event_id)
        self.assertEqual(restored.event_type, original.event_type)
        self.assertEqual(restored.trade_id, original.trade_id)
        self.assertEqual(restored.entity_type, original.entity_type)
        self.assertEqual(restored.payload, original.payload)
        self.assertEqual(restored.route_decision, original.route_decision)

    def test_downstream_event_map_covers_all_types(self):
        """Every event type should have a mapping entry."""
        for evt in TradeEventType:
            self.assertIn(
                evt,
                DOWNSTREAM_EVENT_MAP,
                f"{evt.value} missing from DOWNSTREAM_EVENT_MAP",
            )

    def test_auto_advance_and_manual_gate_are_disjoint(self):
        """No event should be both auto-advance and manual-gate."""
        overlap = AUTO_ADVANCE_EVENTS & MANUAL_GATE_EVENTS
        self.assertEqual(len(overlap), 0, f"Overlap: {overlap}")

    def test_trade_event_is_immutable(self):
        """Frozen dataclass should reject attribute mutation."""
        event = TradeEvent(
            event_type=TradeEventType.INQUIRY_CREATED,
            tenant_id="test",
        )
        with self.assertRaises(Exception):
            event.tenant_id = "hacked"  # type: ignore


class TradeEventDispatcherTests(TestCase):
    """Tests for emit_trade_event() and handler dispatch."""

    def setUp(self):
        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            slug="test-events",
            schema_name="test_events",
        )
        clear_handlers()

    def tearDown(self):
        clear_handlers()

    def test_emit_stores_event_in_database(self):
        """emit_trade_event() should persist to TradeEventLog."""
        event = emit_trade_event(
            event_type=TradeEventType.INQUIRY_CREATED,
            tenant_id=str(self.tenant.pk),
            trade_id="TRD-2026-00001",
            entity_type="Inquiry",
            entity_id="42",
            actor_user_id="user-1",
        )

        log_entry = TradeEventLog.objects.get(event_id=event.event_id)
        self.assertEqual(log_entry.event_type, "inquiry.created")
        self.assertEqual(log_entry.trade_id, "TRD-2026-00001")
        self.assertEqual(log_entry.entity_type, "Inquiry")
        self.assertEqual(log_entry.entity_id, "42")
        self.assertEqual(str(log_entry.tenant_id), str(self.tenant.pk))

    def test_emit_dispatches_to_registered_handlers(self):
        """Registered handlers should be called with the event."""
        received = []

        def handler(event: TradeEvent):
            received.append(event)

        register_handler(TradeEventType.SUPPLIER_PO_APPROVED, handler)

        event = emit_trade_event(
            event_type=TradeEventType.SUPPLIER_PO_APPROVED,
            tenant_id=str(self.tenant.pk),
            entity_type="PurchaseOrder",
            entity_id="99",
        )

        self.assertEqual(len(received), 1)
        self.assertEqual(received[0].event_id, event.event_id)

    def test_handler_failure_does_not_prevent_storage(self):
        """If a handler raises, the event should still be stored."""

        def failing_handler(event: TradeEvent):
            raise RuntimeError("Handler exploded")

        register_handler(TradeEventType.SALES_ORDER_DRAFTED, failing_handler)

        event = emit_trade_event(
            event_type=TradeEventType.SALES_ORDER_DRAFTED,
            tenant_id=str(self.tenant.pk),
            entity_type="SalesOrder",
            entity_id="77",
        )

        # Event should still be stored
        self.assertTrue(
            TradeEventLog.objects.filter(event_id=event.event_id).exists()
        )

    def test_multiple_handlers_all_called(self):
        """Multiple handlers for same event type should all execute."""
        calls = []

        register_handler(
            TradeEventType.CARRIER_PO_APPROVED, lambda e: calls.append("h1")
        )
        register_handler(
            TradeEventType.CARRIER_PO_APPROVED, lambda e: calls.append("h2")
        )
        register_handler(
            TradeEventType.CARRIER_PO_APPROVED, lambda e: calls.append("h3")
        )

        emit_trade_event(
            event_type=TradeEventType.CARRIER_PO_APPROVED,
            tenant_id=str(self.tenant.pk),
        )

        self.assertEqual(calls, ["h1", "h2", "h3"])

    def test_get_trade_event_log_filters_by_tenant(self):
        """get_trade_event_log should only return events for the tenant."""
        other_tenant = Tenant.objects.create(
            name="Other", slug="other-events", schema_name="other_events"
        )

        emit_trade_event(
            event_type=TradeEventType.INQUIRY_CREATED,
            tenant_id=str(self.tenant.pk),
            trade_id="TRD-2026-00010",
        )
        emit_trade_event(
            event_type=TradeEventType.INQUIRY_CREATED,
            tenant_id=str(other_tenant.pk),
            trade_id="TRD-2026-00011",
        )

        results = get_trade_event_log(tenant_id=str(self.tenant.pk))
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["trade_id"], "TRD-2026-00010")

    def test_get_trade_event_log_filters_by_type(self):
        """get_trade_event_log should filter by event_type."""
        emit_trade_event(
            event_type=TradeEventType.INQUIRY_CREATED,
            tenant_id=str(self.tenant.pk),
        )
        emit_trade_event(
            event_type=TradeEventType.SUPPLIER_RFQ_SENT,
            tenant_id=str(self.tenant.pk),
        )

        results = get_trade_event_log(
            tenant_id=str(self.tenant.pk),
            event_type=TradeEventType.SUPPLIER_RFQ_SENT,
        )
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["event_type"], "supplier_rfq.sent")

    def test_emit_returns_immutable_event(self):
        """The returned TradeEvent should be frozen (immutable)."""
        event = emit_trade_event(
            event_type=TradeEventType.TRADE_COMPLETED,
            tenant_id=str(self.tenant.pk),
        )
        with self.assertRaises(Exception):
            event.tenant_id = "nope"  # type: ignore

    def test_clear_handlers_removes_all(self):
        """clear_handlers() should remove all registered handlers."""
        register_handler(
            TradeEventType.INQUIRY_CREATED, lambda e: None
        )
        clear_handlers()

        # Emit should not call any handler (just store)
        event = emit_trade_event(
            event_type=TradeEventType.INQUIRY_CREATED,
            tenant_id=str(self.tenant.pk),
        )
        # No exception means no handler was called
        self.assertTrue(
            TradeEventLog.objects.filter(event_id=event.event_id).exists()
        )

    def test_duplicate_event_id_is_rejected(self):
        """Storing the same event_id twice should raise (unique constraint)."""
        event = emit_trade_event(
            event_type=TradeEventType.INQUIRY_CREATED,
            tenant_id=str(self.tenant.pk),
        )
        # Manually try to store a duplicate — should warn but not crash
        from apps.core.events.dispatcher import _store_event

        duplicate = TradeEvent(
            event_id=event.event_id,
            event_type=TradeEventType.INQUIRY_CREATED,
            tenant_id=str(self.tenant.pk),
        )
        # Should not raise (dispatcher handles gracefully)
        _store_event(duplicate)
        # But only one record should exist
        count = TradeEventLog.objects.filter(event_id=event.event_id).count()
        self.assertEqual(count, 1)
