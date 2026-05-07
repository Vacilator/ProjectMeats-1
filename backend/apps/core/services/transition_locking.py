"""Transition locking service for trade-state mutations (CTE-07.1).

Provides atomic, locked state transitions for trade entities using
`select_for_update()` to prevent concurrent double-transitions.

Architecture:
    Client code calls transition_entity() which:
    1. Acquires a row-level lock on the entity (SELECT FOR UPDATE)
    2. Validates the transition is allowed (guard clause)
    3. Performs the state mutation
    4. Emits the domain event
    5. Returns the updated entity

This prevents:
- Double-click approvals creating duplicate downstream documents
- Concurrent Celery workers racing on the same entity
- Webhook replays advancing state twice

Usage:
    from apps.core.services.transition_locking import (
        transition_entity,
        TransitionError,
        VALID_TRANSITIONS,
    )

    result = transition_entity(
        model_class=PurchaseOrder,
        pk=po_id,
        tenant_id=tenant_id,
        from_status="pending_approval",
        to_status="approved",
        actor_user_id=user_id,
        event_type=TradeEventType.SUPPLIER_PO_APPROVED,
    )
"""

from __future__ import annotations

import logging
from typing import Any, Type

from django.db import models, transaction

logger = logging.getLogger("trade.transitions")


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class TransitionError(Exception):
    """Raised when a state transition is invalid or blocked."""

    def __init__(self, message: str, current_status: str = "", target_status: str = ""):
        super().__init__(message)
        self.current_status = current_status
        self.target_status = target_status


class ConcurrentTransitionError(TransitionError):
    """Raised when a concurrent modification is detected."""

    pass


# ---------------------------------------------------------------------------
# Valid Transition Maps
# ---------------------------------------------------------------------------

# Maps entity type → {from_status → [allowed_to_statuses]}
VALID_TRANSITIONS: dict[str, dict[str, list[str]]] = {
    "PurchaseOrder": {
        "draft": ["pending", "pending_approval", "cancelled"],
        "pending": ["pending_approval", "approved", "cancelled"],
        "pending_approval": ["approved", "cancelled"],
        "approved": ["sent", "carrier_assigned", "cancelled"],
        "sent": ["carrier_assigned", "in_transit", "delivered", "cancelled"],
        "carrier_assigned": ["in_transit", "delivered", "cancelled"],
        "in_transit": ["delivered", "cancelled"],
        "delivered": ["invoiced"],
        "invoiced": [],
        "cancelled": [],
    },
    "CarrierPurchaseOrder": {
        "draft": ["pending_approval", "cancelled"],
        "pending_approval": ["approved", "cancelled"],
        "approved": ["dispatched", "cancelled"],
        "dispatched": ["in_transit", "delivered", "cancelled"],
        "in_transit": ["delivered", "cancelled"],
        "delivered": ["completed"],
        "completed": [],
        "cancelled": [],
    },
    "SalesOrder": {
        "draft": ["pending_approval", "cancelled"],
        "pending_approval": ["approved", "cancelled"],
        "approved": ["dispatched", "cancelled"],
        "dispatched": ["delivered", "cancelled"],
        "delivered": ["invoiced"],
        "invoiced": [],
        "cancelled": [],
    },
}


# ---------------------------------------------------------------------------
# Core Transition Function
# ---------------------------------------------------------------------------


def transition_entity(
    *,
    model_class: Type[models.Model],
    pk: Any,
    tenant_id: str,
    from_status: str,
    to_status: str,
    actor_user_id: str = "",
    event_type=None,
    trade_id: str = "",
    trade_session_id: str = "",
    extra_updates: dict | None = None,
    emit_event: bool = True,
) -> models.Model:
    """Perform an atomic, locked state transition on a trade entity.

    Steps:
    1. SELECT FOR UPDATE (row-level lock)
    2. Validate current status matches expected from_status
    3. Validate transition is in allowed map
    4. Apply status change + any extra_updates
    5. Emit domain event (if event_type provided)

    Args:
        model_class: Django model class (PurchaseOrder, SalesOrder, etc.)
        pk: Primary key of the entity
        tenant_id: Tenant UUID for isolation
        from_status: Expected current status (guard clause)
        to_status: Target status
        actor_user_id: User performing the transition
        event_type: TradeEventType to emit (optional)
        trade_id: Human-readable trade ID for event
        trade_session_id: TradeSession PK for lineage
        extra_updates: Additional field updates to apply atomically
        emit_event: Whether to emit a domain event (default True)

    Returns:
        The updated model instance

    Raises:
        TransitionError: If the transition is invalid
        ConcurrentTransitionError: If current status doesn't match from_status
        model_class.DoesNotExist: If entity not found
    """
    entity_type = model_class.__name__

    with transaction.atomic():
        # Acquire row-level lock
        try:
            entity = (
                model_class.objects.select_for_update()
                .filter(tenant_id=tenant_id)
                .get(pk=pk)
            )
        except model_class.DoesNotExist:
            raise TransitionError(
                f"{entity_type} with pk={pk} not found for tenant {tenant_id}",
                current_status="",
                target_status=to_status,
            )

        # Guard clause: verify current status matches expected
        current_status = getattr(entity, "status", None)
        if current_status is None:
            raise TransitionError(
                f"{entity_type} has no 'status' field",
                current_status="",
                target_status=to_status,
            )

        if current_status != from_status:
            raise ConcurrentTransitionError(
                f"{entity_type} pk={pk} status is '{current_status}', "
                f"expected '{from_status}'. Concurrent modification detected.",
                current_status=current_status,
                target_status=to_status,
            )

        # Validate transition is allowed
        allowed = VALID_TRANSITIONS.get(entity_type, {})
        if allowed:
            valid_targets = allowed.get(from_status, [])
            if to_status not in valid_targets:
                raise TransitionError(
                    f"Transition {from_status} → {to_status} is not allowed "
                    f"for {entity_type}. Valid targets: {valid_targets}",
                    current_status=from_status,
                    target_status=to_status,
                )

        # Apply status change
        entity.status = to_status

        # Apply extra updates if provided
        update_fields = ["status"]
        if extra_updates:
            for field_name, value in extra_updates.items():
                setattr(entity, field_name, value)
                update_fields.append(field_name)

        entity.save(update_fields=update_fields)

        logger.info(
            f"Transition: {entity_type} pk={pk} "
            f"{from_status} → {to_status} by {actor_user_id}",
            extra={
                "entity_type": entity_type,
                "entity_id": str(pk),
                "from_status": from_status,
                "to_status": to_status,
                "actor_user_id": actor_user_id,
            },
        )

    # Emit domain event outside the lock (after commit)
    if emit_event and event_type:
        try:
            from apps.core.events.dispatcher import emit_trade_event

            emit_trade_event(
                event_type=event_type,
                tenant_id=tenant_id,
                trade_id=trade_id,
                trade_session_id=trade_session_id,
                entity_type=entity_type,
                entity_id=str(pk),
                actor_user_id=actor_user_id,
                payload={
                    "from_status": from_status,
                    "to_status": to_status,
                },
                route_decision="",
            )
        except Exception as exc:
            # Event emission failure should not rollback the transition
            logger.warning(
                f"Failed to emit event for {entity_type} pk={pk}: {exc}"
            )

    return entity


# ---------------------------------------------------------------------------
# Convenience wrappers
# ---------------------------------------------------------------------------


def approve_purchase_order(
    *,
    pk: Any,
    tenant_id: str,
    actor_user_id: str = "",
    trade_id: str = "",
    trade_session_id: str = "",
) -> models.Model:
    """Approve a supplier purchase order with transition locking."""
    from apps.core.events.contracts import TradeEventType
    from tenant_apps.purchase_orders.models import PurchaseOrder

    return transition_entity(
        model_class=PurchaseOrder,
        pk=pk,
        tenant_id=tenant_id,
        from_status="pending_approval",
        to_status="approved",
        actor_user_id=actor_user_id,
        event_type=TradeEventType.SUPPLIER_PO_APPROVED,
        trade_id=trade_id,
        trade_session_id=trade_session_id,
    )


def approve_sales_order(
    *,
    pk: Any,
    tenant_id: str,
    actor_user_id: str = "",
    trade_id: str = "",
    trade_session_id: str = "",
) -> models.Model:
    """Approve a sales order with transition locking."""
    from apps.core.events.contracts import TradeEventType
    from tenant_apps.sales_orders.models import SalesOrder

    return transition_entity(
        model_class=SalesOrder,
        pk=pk,
        tenant_id=tenant_id,
        from_status="pending_approval",
        to_status="approved",
        actor_user_id=actor_user_id,
        event_type=TradeEventType.SALES_ORDER_APPROVED,
        trade_id=trade_id,
        trade_session_id=trade_session_id,
    )


def approve_carrier_po(
    *,
    pk: Any,
    tenant_id: str,
    actor_user_id: str = "",
    trade_id: str = "",
    trade_session_id: str = "",
) -> models.Model:
    """Approve a carrier purchase order with transition locking."""
    from apps.core.events.contracts import TradeEventType
    from tenant_apps.purchase_orders.models import CarrierPurchaseOrder

    return transition_entity(
        model_class=CarrierPurchaseOrder,
        pk=pk,
        tenant_id=tenant_id,
        from_status="pending_approval",
        to_status="approved",
        actor_user_id=actor_user_id,
        event_type=TradeEventType.CARRIER_PO_APPROVED,
        trade_id=trade_id,
        trade_session_id=trade_session_id,
    )


def is_valid_transition(entity_type: str, from_status: str, to_status: str) -> bool:
    """Check if a transition is valid without performing it."""
    allowed = VALID_TRANSITIONS.get(entity_type, {})
    if not allowed:
        return True  # Unknown entity types are permissive
    valid_targets = allowed.get(from_status, [])
    return to_status in valid_targets
