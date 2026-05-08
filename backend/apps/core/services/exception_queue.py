"""Exception queue (dead-letter) model and service for trade failures (CTE-08.1).

Provides a first-class dead-letter model for failed automated trade steps.
When an async trade step fails (PDF gen, email dispatch, entity creation),
it creates an exception queue entry and halts the affected trade session.

Architecture:
    Saga handler fails → catch exception → create ExceptionQueueEntry
    → halt TradeSession → assign to operator → await manual resolution

Resolution:
    Operator reviews in Process Cockpit → resolves issue → retries step
    → ExceptionQueueEntry resolved → TradeSession resumes

Usage:
    from apps.core.services.exception_queue import (
        enqueue_trade_exception,
        resolve_exception,
        retry_exception,
    )

    try:
        generate_pdf(...)
    except Exception as exc:
        enqueue_trade_exception(
            tenant_id=tenant_id,
            trade_session_id=session_id,
            failed_step="sales_order.pdf_generation",
            error=exc,
            entity_type="SalesOrder",
            entity_id=so_id,
        )
"""

from __future__ import annotations

import logging
import traceback
from typing import Any

from django.db import models, transaction
from django.utils import timezone

logger = logging.getLogger("trade.exceptions")


# ---------------------------------------------------------------------------
# Exception Queue Model
# ---------------------------------------------------------------------------

# Note: The model is added to apps/core/models.py to keep all core models together.
# This service module provides the business logic.


# ---------------------------------------------------------------------------
# Reason Codes
# ---------------------------------------------------------------------------

REASON_CODES = {
    "PDF_GENERATION_FAILED": "PDF document generation failed",
    "EMAIL_DISPATCH_FAILED": "Email dispatch to recipient failed",
    "ENTITY_CREATION_FAILED": "Downstream entity creation failed",
    "APPROVAL_TIMEOUT": "Approval timeout exceeded",
    "EXTERNAL_SERVICE_ERROR": "External service (carrier/supplier) returned error",
    "DATA_VALIDATION_FAILED": "Data validation failed for downstream creation",
    "TRANSITION_CONFLICT": "State transition conflict (concurrent modification)",
    "DEPENDENCY_MISSING": "Required dependency entity not found",
    "RATE_LIMIT_EXCEEDED": "API rate limit exceeded",
    "UNKNOWN": "Unknown or unclassified failure",
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def enqueue_trade_exception(
    *,
    tenant=None,
    tenant_id: str = "",
    trade_session_id: int | str | None = None,
    trade_id: str = "",
    failed_step: str,
    error: Exception | None = None,
    error_message: str = "",
    reason_code: str = "UNKNOWN",
    entity_type: str = "",
    entity_id: str = "",
    source_event_id: str = "",
    event_id: str = "",
    context_payload: dict | None = None,
    payload: dict | None = None,
    auto_halt: bool = True,
) -> Any:
    """Enqueue a failed trade step into the exception queue.

    This is the primary entry point for recording trade failures.
    Optionally halts the associated trade session.

    Args:
        tenant: Tenant model instance (preferred).
        tenant_id: Tenant UUID string (alternative to tenant).
        trade_session_id: TradeSession PK (optional).
        trade_id: Human-readable trade ID.
        failed_step: The step that failed (e.g., "sales_order.pdf_generation").
        error: The exception object (stack trace extracted).
        error_message: Alternative to passing error object.
        reason_code: Classification code from REASON_CODES.
        entity_type: The entity being operated on.
        entity_id: The entity PK.
        source_event_id: Source event that triggered the failure.
        event_id: Alias for source_event_id (backward compat).
        context_payload: Context payload for debugging/retry.
        payload: Alias for context_payload (backward compat).
        auto_halt: Whether to halt the trade session.

    Returns:
        The created TradeExceptionQueue instance.
    """
    from apps.core.models import TradeExceptionQueue

    # Resolve tenant
    resolved_tenant_id = str(tenant.pk) if tenant else tenant_id
    resolved_payload = context_payload or payload or {}
    resolved_event_id = source_event_id or event_id

    # Extract error info
    if error:
        error_msg = f"{type(error).__name__}: {str(error)[:500]}"
        stack_trace_lines = traceback.format_exception(type(error), error, error.__traceback__)
        stack_str = "".join(stack_trace_lines)[-2000:]
    else:
        error_msg = error_message[:500]
        stack_str = ""

    create_kwargs: dict[str, Any] = {
        "trade_session_id": int(trade_session_id) if trade_session_id else None,
        "trade_id": trade_id,
        "failed_step": failed_step,
        "reason_code": reason_code,
        "error_message": error_msg,
        "stack_trace": stack_str,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "source_event_id": resolved_event_id,
        "context_payload": resolved_payload,
        "status": "open",
        "retry_count": 0,
    }

    # Assign tenant via FK or raw ID
    if tenant:
        create_kwargs["tenant"] = tenant
    else:
        create_kwargs["tenant_id"] = resolved_tenant_id

    with transaction.atomic():
        entry = TradeExceptionQueue.objects.create(**create_kwargs)

        # Halt trade session if requested
        if auto_halt and trade_session_id:
            _halt_trade_session(
                tenant_id=resolved_tenant_id,
                trade_session_id=int(trade_session_id),
                exception_id=entry.pk,
            )

    logger.warning(
        f"Trade exception enqueued: {failed_step} - {error_msg[:100]}",
        extra={
            "exception_id": str(entry.pk),
            "failed_step": failed_step,
            "reason_code": reason_code,
            "trade_id": trade_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
        },
    )

    return entry


def resolve_exception(
    *,
    exception_id: int,
    tenant=None,
    tenant_id: str = "",
    resolved_by: str = "",
    resolution_notes: str = "",
    resume_trade: bool = True,
) -> Any:
    """Mark an exception as resolved and optionally resume the trade.

    Args:
        exception_id: PK of the TradeExceptionQueue entry.
        tenant: Tenant model instance (preferred).
        tenant_id: Tenant UUID for isolation (alternative).
        resolved_by: User ID of the resolver.
        resolution_notes: Free-text resolution description.
        resume_trade: Whether to resume the halted trade session.
    """
    from apps.core.models import TradeExceptionQueue

    resolved_tenant_id = str(tenant.pk) if tenant else tenant_id

    with transaction.atomic():
        entry = (
            TradeExceptionQueue.objects.select_for_update().filter(tenant_id=resolved_tenant_id).get(pk=exception_id)
        )

        if entry.trade_session_id:
            _lock_trade_session(
                tenant_id=resolved_tenant_id,
                trade_session_id=entry.trade_session_id,
            )

        if entry.status == "resolved":
            return entry  # Idempotent

        entry.status = "resolved"
        entry.resolved_by = resolved_by
        entry.resolved_at = timezone.now()
        entry.resolution_notes = resolution_notes
        entry.save(update_fields=["status", "resolved_by", "resolved_at", "resolution_notes", "modified_on"])

        has_active_siblings = entry.trade_session_id and _has_active_trade_exceptions(
            tenant_id=resolved_tenant_id,
            trade_session_id=entry.trade_session_id,
            exclude_exception_id=entry.pk,
        )

        if resume_trade and entry.trade_session_id and not has_active_siblings:
            _resume_trade_session(
                tenant_id=resolved_tenant_id,
                trade_session_id=entry.trade_session_id,
            )

    logger.info(
        f"Trade exception resolved: {exception_id} by {resolved_by}",
        extra={
            "exception_id": str(exception_id),
            "resolved_by": resolved_by,
            "trade_id": entry.trade_id,
        },
    )

    return entry


def retry_exception(
    *,
    exception_id: int,
    tenant=None,
    tenant_id: str = "",
    retried_by: str = "",
    max_retries: int = 3,
) -> Any:
    """Increment retry count and update status.

    Returns the updated TradeExceptionQueue instance.
    """
    from apps.core.models import TradeExceptionQueue

    resolved_tenant_id = str(tenant.pk) if tenant else tenant_id

    with transaction.atomic():
        qs = TradeExceptionQueue.objects.select_for_update()
        if resolved_tenant_id:
            qs = qs.filter(tenant_id=resolved_tenant_id)
        entry = qs.get(pk=exception_id)

        if entry.status == "resolved":
            return entry

        entry.retry_count += 1
        entry.last_retry_at = timezone.now()

        if entry.retry_count >= max_retries:
            entry.status = "exhausted"
        else:
            entry.status = "retrying"

        entry.save(update_fields=["retry_count", "last_retry_at", "status", "modified_on"])

    logger.info(
        f"Trade exception retry #{entry.retry_count}: {exception_id}",
        extra={
            "exception_id": str(exception_id),
            "retry_count": entry.retry_count,
            "failed_step": entry.failed_step,
        },
    )

    return entry


def get_open_exceptions(
    *,
    tenant=None,
    tenant_id: str = "",
    trade_session_id: int | None = None,
    limit: int = 50,
):
    """Get open/retrying exceptions for a tenant or trade session.

    Returns a QuerySet for flexibility (caller can .values() or iterate).
    """
    from apps.core.models import TradeExceptionQueue

    resolved_tenant_id = str(tenant.pk) if tenant else tenant_id

    qs = TradeExceptionQueue.objects.filter(
        tenant_id=resolved_tenant_id,
        status__in=["open", "retrying"],
    ).order_by("-created_on")

    if trade_session_id:
        qs = qs.filter(trade_session_id=trade_session_id)

    return qs[:limit]


# ---------------------------------------------------------------------------
# Internal Helpers
# ---------------------------------------------------------------------------


def _halt_trade_session(*, tenant_id: str, trade_session_id: int, exception_id: int) -> None:
    """Halt a trade session due to an exception."""
    try:
        from tenant_apps.inquiries.models import TradeSession

        TradeSession.objects.filter(tenant_id=tenant_id, pk=trade_session_id).update(status="halted")

        logger.info(f"Trade session {trade_session_id} halted (exception {exception_id})")
    except Exception as exc:
        logger.warning(f"Failed to halt trade session {trade_session_id}: {exc}")


def _resume_trade_session(*, tenant_id: str, trade_session_id: int) -> None:
    """Resume a halted trade session after exception resolution."""
    try:
        from tenant_apps.inquiries.models import TradeSession

        # Only resume if currently halted (don't override completed/cancelled)
        # Resume to "sourcing" as the default safe state
        updated = TradeSession.objects.filter(tenant_id=tenant_id, pk=trade_session_id, status="halted").update(
            status="sourcing"
        )

        if updated:
            logger.info(f"Trade session {trade_session_id} resumed")
    except Exception as exc:
        logger.warning(f"Failed to resume trade session {trade_session_id}: {exc}")


def _has_active_trade_exceptions(
    *,
    tenant_id: str,
    trade_session_id: int,
    exclude_exception_id: int | None = None,
) -> bool:
    """Return True when another open/retrying exception still blocks the trade."""
    from apps.core.models import TradeExceptionQueue

    queryset = TradeExceptionQueue.objects.filter(
        tenant_id=tenant_id,
        trade_session_id=trade_session_id,
        status__in=["open", "retrying"],
    )
    if exclude_exception_id:
        queryset = queryset.exclude(pk=exclude_exception_id)
    return queryset.exists()


def _lock_trade_session(*, tenant_id: str, trade_session_id: int) -> None:
    """Serialize resume/halt decisions for one trade session."""
    from tenant_apps.inquiries.models import TradeSession

    TradeSession.objects.select_for_update().filter(
        tenant_id=tenant_id,
        pk=trade_session_id,
    ).first()
