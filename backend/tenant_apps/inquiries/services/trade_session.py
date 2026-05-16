"""Trade session lineage service (CTE-05.1).

Creates and manages TradeSession objects that provide a durable lineage key
tying inquiry → supplier PO → sales order → carrier PO.
"""

from __future__ import annotations

import logging
from typing import Any

from django.db import transaction
from django.utils import timezone

from tenant_apps.inquiries.models import Inquiry, TradeSession, TradeSessionStatus

from apps.tenants.rls import tenant_rls

logger = logging.getLogger(__name__)


class TradeSessionError(ValueError):
    """Raised when a trade session cannot be created safely."""


def get_or_create_trade_session(
    *,
    tenant: Any,
    inquiry: Inquiry,
) -> tuple[TradeSession, bool]:
    """Get or create the TradeSession for an inquiry.

    Idempotent — safe to call multiple times. If a TradeSession already
    exists for this inquiry, returns it without modification.

    Returns:
        (trade_session, created) tuple.
    """
    with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
        existing = TradeSession.objects.filter(tenant=tenant, inquiry=inquiry).first()
        if existing:
            return existing, False

        trade_id = _generate_next_trade_id(tenant)
        trade_session = TradeSession.objects.create(
            tenant=tenant,
            inquiry=inquiry,
            trade_id=trade_id,
            status=TradeSessionStatus.INITIATED,
            route_decision=inquiry.route_decision or "",
            source_email_message_id=getattr(inquiry, "source_email_message_id", "") or "",
            source_email_thread_id=getattr(inquiry, "source_email_thread_id", "") or "",
        )

        logger.info(
            "Telemetry: trade_session.created",
            extra={
                "event_type": "trade_session.created",
                "tenant_id": str(tenant.id),
                "trade_session_id": str(trade_session.id),
                "trade_id": trade_id,
                "inquiry_id": str(inquiry.id),
                "route_decision": inquiry.route_decision or "",
            },
        )

        return trade_session, True


def cascade_trade_session(
    *,
    trade_session: TradeSession,
    purchase_order=None,
    sales_order=None,
    carrier_purchase_order=None,
) -> None:
    """Cascade the trade_session FK to downstream documents.

    Called by the orchestrator after creating downstream documents.
    Idempotent — skips if already linked. Also advances trade session
    status based on which documents are now linked.
    """
    changed = False

    if purchase_order and not purchase_order.trade_session_id:
        purchase_order.trade_session = trade_session
        purchase_order.save(update_fields=["trade_session", "modified_on"])
        changed = True

    if sales_order and not sales_order.trade_session_id:
        sales_order.trade_session = trade_session
        sales_order.save(update_fields=["trade_session", "modified_on"])
        changed = True

    if carrier_purchase_order and not carrier_purchase_order.trade_session_id:
        carrier_purchase_order.trade_session = trade_session
        carrier_purchase_order.save(update_fields=["trade_session", "modified_on"])
        changed = True

    if not changed:
        return

    # Advance trade session status based on linked documents
    new_status = _infer_status_from_documents(
        trade_session=trade_session,
        has_po=purchase_order is not None,
        has_so=sales_order is not None,
        has_carrier=carrier_purchase_order is not None,
    )
    if new_status and new_status != trade_session.status:
        update_trade_session_status(trade_session=trade_session, new_status=new_status)
        logger.info(
            "Trade session %s status advanced to %s",
            trade_session.trade_id,
            new_status,
        )


def _infer_status_from_documents(
    *,
    trade_session: TradeSession,
    has_po: bool,
    has_so: bool,
    has_carrier: bool,
) -> str | None:
    """Infer the appropriate trade status from linked documents.

    Returns the new status or None if no change needed.
    Status progression: initiated → sourcing → ordered → logistics
    """
    current = trade_session.status

    # Don't regress terminal statuses
    if current in (TradeSessionStatus.COMPLETED, TradeSessionStatus.CANCELLED, TradeSessionStatus.HALTED):
        return None

    if has_carrier:
        return TradeSessionStatus.LOGISTICS
    if has_so:
        return TradeSessionStatus.ORDERED
    if has_po:
        # Only advance if we're still in early stages
        if current in (TradeSessionStatus.INITIATED, TradeSessionStatus.SOURCING, TradeSessionStatus.QUOTED):
            return TradeSessionStatus.ORDERED
    return None


def update_trade_session_status(
    *,
    trade_session: TradeSession,
    new_status: str,
) -> None:
    """Update the trade session status with timestamp management."""
    trade_session.status = new_status
    if new_status == TradeSessionStatus.COMPLETED:
        trade_session.completed_at = timezone.now()
    trade_session.save(update_fields=["status", "completed_at", "modified_on"])


def _generate_next_trade_id(tenant: Any) -> str:
    """Generate the next sequential trade ID for a tenant.

    Format: TRD-YYYY-NNNNN (e.g., TRD-2026-00042)
    """
    year = timezone.now().year
    prefix = f"TRD-{year}-"

    last_session = TradeSession.objects.filter(tenant=tenant, trade_id__startswith=prefix).order_by("-trade_id").first()

    if last_session:
        try:
            last_num = int(last_session.trade_id.split("-")[-1])
            next_num = last_num + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        next_num = 1

    return f"{prefix}{next_num:05d}"
