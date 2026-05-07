"""Domain event contracts for trade-state transitions (CTE-06.1).

Defines the canonical event types, payload shapes, and routing rules
for the trading engine state machine. These events are emitted when
key state transitions occur and consumed by saga handlers.

Event Properties:
- Idempotent: Consumers can safely process the same event multiple times
- Traceable: Every event carries tenant_id + trade_session_id for lineage
- Replayable: Events are stored durably and can be replayed in order

Event Flow:
    inquiry.created → supplier_rfq.sent → supplier_po.drafted →
    supplier_po.approved → sales_order.drafted → sales_order.approved →
    carrier_inquiry.sent → carrier_po.drafted → trade.completed
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


# ---------------------------------------------------------------------------
# Event Type Registry
# ---------------------------------------------------------------------------


class TradeEventType(str, Enum):
    """Canonical trade-state event types.

    Naming convention: {entity}.{past_tense_verb}
    """

    # Inquiry lifecycle
    INQUIRY_CREATED = "inquiry.created"
    INQUIRY_ROUTED = "inquiry.routed"

    # Supplier RFQ
    SUPPLIER_RFQ_SENT = "supplier_rfq.sent"
    SUPPLIER_RFQ_REPLIED = "supplier_rfq.replied"

    # Supplier Purchase Order
    SUPPLIER_PO_DRAFTED = "supplier_po.drafted"
    SUPPLIER_PO_APPROVED = "supplier_po.approved"
    SUPPLIER_PO_REJECTED = "supplier_po.rejected"

    # Sales Order
    SALES_ORDER_DRAFTED = "sales_order.drafted"
    SALES_ORDER_APPROVED = "sales_order.approved"
    SALES_ORDER_DISPATCHED = "sales_order.dispatched"

    # Carrier Freight
    CARRIER_INQUIRY_SENT = "carrier_inquiry.sent"
    CARRIER_INQUIRY_REPLIED = "carrier_inquiry.replied"

    # Carrier Purchase Order
    CARRIER_PO_DRAFTED = "carrier_po.drafted"
    CARRIER_PO_APPROVED = "carrier_po.approved"

    # Trade Session
    TRADE_COMPLETED = "trade.completed"
    TRADE_CANCELLED = "trade.cancelled"


# ---------------------------------------------------------------------------
# Event Payload
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TradeEvent:
    """Canonical domain event payload for trade-state transitions.

    All fields are immutable and JSON-serializable for durable storage.
    """

    # Event identity
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    event_type: TradeEventType = TradeEventType.INQUIRY_CREATED
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    # Tenant isolation
    tenant_id: str = ""

    # Lineage (always present for tracing)
    trade_session_id: str = ""
    trade_id: str = ""  # Human-readable TRD-YYYY-NNNNN

    # Source entity
    entity_type: str = ""  # e.g., "Inquiry", "PurchaseOrder", "SalesOrder"
    entity_id: str = ""

    # Actor
    actor_user_id: str = ""

    # Event-specific payload (varies by event_type)
    payload: dict = field(default_factory=dict)

    # Routing metadata
    route_decision: str = ""  # "FULFILL" or "BROKER"
    source_event_id: str = ""  # For causal chaining

    def to_dict(self) -> dict[str, Any]:
        """Serialize to JSON-compatible dict for storage/transport."""
        return {
            "event_id": self.event_id,
            "event_type": self.event_type.value if isinstance(self.event_type, TradeEventType) else self.event_type,
            "timestamp": self.timestamp,
            "tenant_id": self.tenant_id,
            "trade_session_id": self.trade_session_id,
            "trade_id": self.trade_id,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "actor_user_id": self.actor_user_id,
            "payload": self.payload,
            "route_decision": self.route_decision,
            "source_event_id": self.source_event_id,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "TradeEvent":
        """Deserialize from stored dict."""
        event_type = data.get("event_type", "")
        try:
            event_type = TradeEventType(event_type)
        except ValueError:
            pass  # Keep as string if unknown type

        return cls(
            event_id=data.get("event_id", str(uuid.uuid4())),
            event_type=event_type,
            timestamp=data.get("timestamp", ""),
            tenant_id=data.get("tenant_id", ""),
            trade_session_id=data.get("trade_session_id", ""),
            trade_id=data.get("trade_id", ""),
            entity_type=data.get("entity_type", ""),
            entity_id=data.get("entity_id", ""),
            actor_user_id=data.get("actor_user_id", ""),
            payload=data.get("payload", {}),
            route_decision=data.get("route_decision", ""),
            source_event_id=data.get("source_event_id", ""),
        )


# ---------------------------------------------------------------------------
# Routing Rules
# ---------------------------------------------------------------------------

# Maps event types to the next expected downstream events
DOWNSTREAM_EVENT_MAP: dict[TradeEventType, list[TradeEventType]] = {
    TradeEventType.INQUIRY_CREATED: [TradeEventType.INQUIRY_ROUTED],
    TradeEventType.INQUIRY_ROUTED: [
        TradeEventType.SUPPLIER_RFQ_SENT,  # BROKER path
        TradeEventType.SALES_ORDER_DRAFTED,  # FULFILL path
    ],
    TradeEventType.SUPPLIER_RFQ_SENT: [TradeEventType.SUPPLIER_RFQ_REPLIED],
    TradeEventType.SUPPLIER_RFQ_REPLIED: [TradeEventType.SUPPLIER_PO_DRAFTED],
    TradeEventType.SUPPLIER_PO_DRAFTED: [
        TradeEventType.SUPPLIER_PO_APPROVED,
        TradeEventType.SUPPLIER_PO_REJECTED,
    ],
    TradeEventType.SUPPLIER_PO_APPROVED: [TradeEventType.SALES_ORDER_DRAFTED],
    TradeEventType.SUPPLIER_PO_REJECTED: [],  # Terminal — requires new RFQ or cancellation
    TradeEventType.SALES_ORDER_DRAFTED: [TradeEventType.SALES_ORDER_APPROVED],
    TradeEventType.SALES_ORDER_APPROVED: [
        TradeEventType.SALES_ORDER_DISPATCHED,
        TradeEventType.CARRIER_INQUIRY_SENT,
    ],
    TradeEventType.SALES_ORDER_DISPATCHED: [],
    TradeEventType.CARRIER_INQUIRY_SENT: [TradeEventType.CARRIER_INQUIRY_REPLIED],
    TradeEventType.CARRIER_INQUIRY_REPLIED: [TradeEventType.CARRIER_PO_DRAFTED],
    TradeEventType.CARRIER_PO_DRAFTED: [TradeEventType.CARRIER_PO_APPROVED],
    TradeEventType.CARRIER_PO_APPROVED: [TradeEventType.TRADE_COMPLETED],
    TradeEventType.TRADE_COMPLETED: [],
    TradeEventType.TRADE_CANCELLED: [],
}

# Events that trigger automatic orchestrator advancement
AUTO_ADVANCE_EVENTS: set[TradeEventType] = {
    TradeEventType.SUPPLIER_RFQ_REPLIED,
    TradeEventType.SUPPLIER_PO_APPROVED,
    TradeEventType.SALES_ORDER_APPROVED,
    TradeEventType.CARRIER_INQUIRY_REPLIED,
}

# Events that require manual approval before advancing
MANUAL_GATE_EVENTS: set[TradeEventType] = {
    TradeEventType.SUPPLIER_PO_DRAFTED,
    TradeEventType.SALES_ORDER_DRAFTED,
    TradeEventType.CARRIER_PO_DRAFTED,
}
