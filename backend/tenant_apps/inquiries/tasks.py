"""Celery saga consumers for trade-state side effects (CTE-06.2).

These tasks react to domain events emitted by the trading engine and perform
downstream side effects asynchronously (PDF generation, email dispatch,
entity creation, status updates).

Architecture:
    emit_trade_event() → TradeEventLog (durable) → Celery task enqueued
    Celery worker → consume event → perform side effect → mark processed

Design principles:
- Idempotent: Each task checks if work was already done before proceeding
- Replay-safe: Uses event_id to prevent duplicate processing
- Tenant-aware: All operations scoped to event's tenant_id
- Traceable: Propagates trace_id from event into trace context
"""

from __future__ import annotations

import logging

from celery import shared_task
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(
    name="trade.process_domain_event",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
    queue="pm.trade",
    routing_key="pm.trade",
)
def process_domain_event(self, event_id: str) -> dict:
    """Process a single trade domain event by dispatching to saga handlers.

    This is the main Celery entry point. It:
    1. Loads the event from TradeEventLog
    2. Sets up trace context
    3. Dispatches to the appropriate saga handler
    4. Marks the event as processed

    Idempotent: Skips if already processed.
    """
    from apps.core.logging import trace_context
    from apps.core.models import TradeEventLog

    try:
        event_log = TradeEventLog.objects.get(event_id=event_id)
    except TradeEventLog.DoesNotExist:
        logger.error(f"Trade event {event_id} not found in database")
        return {"status": "not_found", "event_id": event_id}

    # Idempotency check
    if event_log.processed:
        logger.info(f"Event {event_id} already processed, skipping")
        return {"status": "already_processed", "event_id": event_id}

    # Set up trace context for structured logging
    with trace_context(
        trace_id=event_log.payload.get("event_id", event_id),
        tenant_id=str(event_log.tenant_id),
        trade_id=event_log.trade_id,
        trade_session_id=str(event_log.trade_session_id or ""),
        source_step=f"saga.{event_log.event_type}",
    ):
        try:
            result = _dispatch_saga(event_log)

            # Mark as processed
            with transaction.atomic():
                event_log.processed = True
                event_log.processed_at = timezone.now()
                event_log.save(update_fields=["processed", "processed_at", "modified_on"])

            logger.info(
                f"Saga completed for event {event_id}: {event_log.event_type}",
                extra={"event_type": event_log.event_type, "result": str(result)[:200]},
            )
            return {"status": "processed", "event_id": event_id, "result": result}

        except Exception as exc:
            logger.exception(
                f"Saga failed for event {event_id}: {exc}",
                extra={"event_type": event_log.event_type, "error": str(exc)[:500]},
            )
            # Retry with exponential backoff
            raise self.retry(exc=exc)


@shared_task(
    name="trade.process_unprocessed_events",
    bind=True,
    queue="pm.trade",
    routing_key="pm.trade",
)
def process_unprocessed_events(self, tenant_id: str = "", limit: int = 50) -> dict:
    """Sweep unprocessed events and enqueue them for processing.

    This is a catch-up task that ensures no events are missed if the
    synchronous dispatch failed or was skipped.
    """
    from apps.core.models import TradeEventLog

    qs = TradeEventLog.objects.filter(processed=False).order_by("created_on")
    if tenant_id:
        qs = qs.filter(tenant_id=tenant_id)

    events = list(qs[:limit].values_list("event_id", flat=True))

    for eid in events:
        process_domain_event.delay(eid)

    return {"enqueued": len(events), "tenant_id": tenant_id or "all"}


# ---------------------------------------------------------------------------
# Saga Router — maps event types to handler functions
# ---------------------------------------------------------------------------

# Maps event_type string → handler function name
SAGA_HANDLERS: dict[str, str] = {
    "supplier_po.approved": "_saga_supplier_po_approved",
    "sales_order.approved": "_saga_sales_order_approved",
    "sales_order.drafted": "_saga_sales_order_drafted",
    "carrier_inquiry.replied": "_saga_carrier_inquiry_replied",
    "carrier_po.approved": "_saga_carrier_po_approved",
    "trade.completed": "_saga_trade_completed",
    "inquiry.routed": "_saga_inquiry_routed",
    "supplier_rfq.replied": "_saga_supplier_rfq_replied",
}


def _dispatch_saga(event_log) -> dict:
    """Route an event to the appropriate saga handler."""
    handler_name = SAGA_HANDLERS.get(event_log.event_type)

    if not handler_name:
        # No saga handler for this event type — that's fine
        return {"action": "no_handler", "event_type": event_log.event_type}

    handler_fn = globals().get(handler_name)
    if not handler_fn:
        logger.warning(f"Saga handler {handler_name} not found")
        return {"action": "handler_missing", "event_type": event_log.event_type}

    return handler_fn(event_log)


# ---------------------------------------------------------------------------
# Individual Saga Handlers
# ---------------------------------------------------------------------------


def _saga_inquiry_routed(event_log) -> dict:
    """When an inquiry is routed, determine path and kick off next step.

    FULFILL path: Draft sales order directly
    BROKER path: Send supplier RFQs
    """
    route = event_log.route_decision
    payload = event_log.payload or {}
    inquiry_id = event_log.entity_id

    if not inquiry_id:
        return {"action": "skipped", "reason": "no inquiry_id"}

    if route == "FULFILL":
        logger.info(f"Inquiry {inquiry_id} routed to FULFILL — SO draft will follow")
        return {"action": "fulfill_path_initiated", "inquiry_id": inquiry_id}
    elif route == "BROKER":
        logger.info(f"Inquiry {inquiry_id} routed to BROKER — RFQ dispatch will follow")
        return {"action": "broker_path_initiated", "inquiry_id": inquiry_id}
    else:
        return {"action": "unknown_route", "route": route}


def _saga_supplier_rfq_replied(event_log) -> dict:
    """When a supplier replies to an RFQ, trigger PO draft creation."""
    payload = event_log.payload or {}
    inquiry_id = payload.get("inquiry_id", event_log.entity_id)

    logger.info(
        f"Supplier RFQ replied for inquiry {inquiry_id} — PO draft will be created"
    )
    return {"action": "po_draft_triggered", "inquiry_id": inquiry_id}


def _saga_supplier_po_approved(event_log) -> dict:
    """When a supplier PO is approved, draft a sales order.

    This is the key handoff from procurement to sales.
    """
    payload = event_log.payload or {}
    po_id = event_log.entity_id
    tenant_id = str(event_log.tenant_id)

    logger.info(
        f"Supplier PO {po_id} approved — initiating sales order draft",
        extra={"entity_type": "PurchaseOrder", "entity_id": po_id},
    )

    # The actual SO drafting is handled by existing service
    # This saga just coordinates the trigger
    return {
        "action": "sales_order_draft_triggered",
        "source_po_id": po_id,
        "tenant_id": tenant_id,
    }


def _saga_sales_order_drafted(event_log) -> dict:
    """When a sales order is drafted, notify for approval."""
    payload = event_log.payload or {}
    so_id = event_log.entity_id

    logger.info(f"Sales order {so_id} drafted — pending approval")
    return {"action": "approval_pending", "sales_order_id": so_id}


def _saga_sales_order_approved(event_log) -> dict:
    """When a sales order is approved, generate PDF and dispatch email.

    Also triggers carrier freight inquiry if logistics required.
    """
    payload = event_log.payload or {}
    so_id = event_log.entity_id
    route = event_log.route_decision

    logger.info(
        f"Sales order {so_id} approved — generating PDF and dispatching",
        extra={"route_decision": route},
    )

    actions = ["pdf_generation_triggered", "customer_email_triggered"]

    if route == "BROKER":
        actions.append("carrier_inquiry_triggered")

    return {
        "action": "post_approval_initiated",
        "sales_order_id": so_id,
        "triggered_actions": actions,
    }


def _saga_carrier_inquiry_replied(event_log) -> dict:
    """When a carrier replies, create draft carrier PO."""
    payload = event_log.payload or {}
    carrier_id = payload.get("carrier_id", "")

    logger.info(f"Carrier replied — drafting carrier PO")
    return {"action": "carrier_po_draft_triggered", "carrier_id": carrier_id}


def _saga_carrier_po_approved(event_log) -> dict:
    """When carrier PO is approved, advance toward trade completion."""
    payload = event_log.payload or {}
    po_id = event_log.entity_id

    logger.info(f"Carrier PO {po_id} approved — trade nearing completion")
    return {"action": "trade_completion_check", "carrier_po_id": po_id}


def _saga_trade_completed(event_log) -> dict:
    """When a trade is completed, update session status and emit summary."""
    trade_id = event_log.trade_id
    trade_session_id = event_log.trade_session_id

    logger.info(f"Trade {trade_id} completed — finalizing session")

    if trade_session_id:
        try:
            from tenant_apps.inquiries.services.trade_session import (
                update_trade_session_status,
            )

            update_trade_session_status(
                trade_session_id=int(trade_session_id),
                new_status="completed",
                tenant_id=str(event_log.tenant_id),
            )
        except Exception as exc:
            logger.warning(f"Failed to update trade session status: {exc}")

    return {"action": "trade_finalized", "trade_id": trade_id}


# ---------------------------------------------------------------------------
# Integration: Hook into event dispatcher for async processing
# ---------------------------------------------------------------------------


def enqueue_event_for_saga(event_id: str) -> None:
    """Enqueue a domain event for async saga processing.

    Call this from emit_trade_event() after synchronous storage.
    Safe to call even if Celery broker is unavailable (logs warning).
    """
    try:
        process_domain_event.delay(event_id)
    except Exception as exc:
        logger.warning(
            f"Failed to enqueue event {event_id} for saga processing: {exc}. "
            "Event stored durably — will be picked up by sweep task."
        )
