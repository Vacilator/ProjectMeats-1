"""Domain event dispatcher for trade-state transitions (CTE-06.1).

Provides a synchronous in-process event bus with durable storage.
Designed for easy migration to Celery async consumers in CTE-06.2.

Architecture:
    emit_trade_event() → store in DB → call registered handlers → log telemetry
                                     ↓ (future CTE-06.2)
                               Celery task queue → async consumers
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any, Callable

from django.db import transaction
from django.utils import timezone

from .contracts import TradeEvent, TradeEventType

logger = logging.getLogger(__name__)

# Handler registry: event_type → list of handler functions
_handlers: dict[TradeEventType, list[Callable[[TradeEvent], None]]] = defaultdict(list)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def emit_trade_event(
    *,
    event_type: TradeEventType,
    tenant_id: str,
    trade_session_id: str = "",
    trade_id: str = "",
    entity_type: str = "",
    entity_id: str = "",
    actor_user_id: str = "",
    payload: dict | None = None,
    route_decision: str = "",
    source_event_id: str = "",
) -> TradeEvent:
    """Emit a domain event and dispatch to registered handlers.

    This is the primary entry point for the event system. It:
    1. Creates the immutable event object
    2. Stores it durably (TradeEventLog)
    3. Dispatches to registered in-process handlers
    4. Emits structured telemetry

    Args:
        event_type: The canonical event type from TradeEventType enum.
        tenant_id: Tenant UUID string for isolation.
        trade_session_id: TradeSession PK for lineage.
        trade_id: Human-readable trade ID (TRD-YYYY-NNNNN).
        entity_type: Source entity class name.
        entity_id: Source entity PK.
        actor_user_id: User who triggered the transition.
        payload: Event-specific data dict.
        route_decision: FULFILL or BROKER.
        source_event_id: Causal parent event ID.

    Returns:
        The created TradeEvent instance.
    """
    event = TradeEvent(
        event_type=event_type,
        tenant_id=tenant_id,
        trade_session_id=trade_session_id,
        trade_id=trade_id,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_user_id=actor_user_id,
        payload=payload or {},
        route_decision=route_decision,
        source_event_id=source_event_id,
    )

    # Store durably
    _store_event(event)

    # Dispatch to handlers
    _dispatch(event)

    # Telemetry (includes trace context for correlation)
    from apps.core.logging import get_current_trace, log_trade_step

    trace_ctx = get_current_trace()
    log_trade_step(
        step_name="domain_event.emitted",
        message=f"Event emitted: {event.event_type.value if isinstance(event.event_type, TradeEventType) else event.event_type}",
        entity_type=event.entity_type,
        entity_id=event.entity_id,
        extra={
            "event_id": event.event_id,
            "trace_id": trace_ctx.trace_id if trace_ctx else "",
        },
    )

    return event


def register_handler(
    event_type: TradeEventType,
    handler: Callable[[TradeEvent], None],
) -> None:
    """Register a handler function for a specific event type.

    Handlers are called synchronously in registration order.
    They should be idempotent and fast — heavy work should be deferred.

    Args:
        event_type: The event type to handle.
        handler: Callable that accepts a TradeEvent.
    """
    _handlers[event_type].append(handler)


def get_trade_event_log(
    *,
    tenant_id: str,
    trade_session_id: str | None = None,
    event_type: TradeEventType | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Query stored events for audit/replay.

    Returns event dicts ordered by timestamp descending.
    """
    from tenant_apps.inquiries.models import TradeSession

    # Use the ExecutionEventLog or a simple JSON query on custom_data
    # For now, query TradeEventLog model
    try:
        from apps.core.models import TradeEventLog

        qs = TradeEventLog.objects.filter(tenant_id=tenant_id)
        if trade_session_id:
            qs = qs.filter(trade_session_id=trade_session_id)
        if event_type:
            qs = qs.filter(event_type=event_type.value)
        return list(qs.order_by("-created_on").values()[:limit])
    except Exception:
        # Model may not exist yet — graceful degradation
        return []


def clear_handlers() -> None:
    """Clear all registered handlers (for testing)."""
    _handlers.clear()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _store_event(event: TradeEvent) -> None:
    """Persist event to the TradeEventLog table.

    Uses a separate atomic block to ensure storage even if handlers fail.
    """
    try:
        from apps.core.models import TradeEventLog

        with transaction.atomic():
            TradeEventLog.objects.create(
                tenant_id=event.tenant_id,
                event_id=event.event_id,
                event_type=(
                    event.event_type.value if isinstance(event.event_type, TradeEventType) else event.event_type
                ),
                trade_session_id=event.trade_session_id or None,
                trade_id=event.trade_id,
                entity_type=event.entity_type,
                entity_id=event.entity_id,
                actor_user_id=event.actor_user_id,
                payload=event.to_dict(),
                route_decision=event.route_decision,
            )
    except Exception as exc:
        # Don't let storage failure prevent event dispatch
        logger.warning(f"Failed to store trade event: {exc}")


def _dispatch(event: TradeEvent) -> None:
    """Dispatch event to all registered handlers."""
    event_type = event.event_type
    if not isinstance(event_type, TradeEventType):
        return

    handlers = _handlers.get(event_type, [])
    for handler in handlers:
        try:
            handler(event)
        except Exception as exc:
            logger.exception(f"Handler {handler.__name__} failed for event {event.event_id}: {exc}")
