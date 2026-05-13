"""External Approval Gate Service — Phase 40.

Intercepts outbound communications and enforces human approval
when the user's preference requires it.

Provides:
- intercept_outbound(): Check if approval is needed, create request if so
- approve_request() / reject_request() / edit_and_approve()
- delegate_request()
- expire_stale_requests()
- get_pending_count()
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from django.utils import timezone

logger = logging.getLogger(__name__)

# Default expiry: 72 hours
DEFAULT_EXPIRY_HOURS = 72


def _get_user_prefs(tenant, user):
    """Get or create UserAIPreferences for the given user."""
    from tenant_apps.ai_assistant.models import UserAIPreferences
    prefs, _ = UserAIPreferences.objects.get_or_create(
        tenant=tenant, user=user,
    )
    return prefs


def intercept_outbound(
    *,
    tenant,
    user,
    request_type: str,
    subject: str,
    recipient_type: str = "other",
    recipient_entity_id: str = "",
    recipient_name: str = "",
    recipient_email: str = "",
    content_preview: str = "",
    content_payload: dict | None = None,
    source_entity_type: str = "",
    source_entity_id: str = "",
    ai_generated: bool = False,
    ai_confidence: float | None = None,
    priority: str = "normal",
) -> dict:
    """Intercept an outbound communication.

    Checks UserAIPreferences.require_external_approval:
    - If ON → creates ExternalApprovalRequest, returns {requires_approval: True, request_id: uuid}
    - If OFF → returns {requires_approval: False}

    Also checks auto-approve threshold: if ai_confidence >= threshold → auto-approve.
    """
    from tenant_apps.ai_assistant.models import (
        ExternalApprovalRequest,
        ExternalApprovalStatus,
    )

    prefs = _get_user_prefs(tenant, user)

    # Check if approval is required
    if not prefs.require_external_approval:
        return {"requires_approval": False}

    # Check auto-approve threshold
    if ai_confidence is not None and ai_confidence >= prefs.approval_auto_approve_threshold:
        logger.info(
            "[ApprovalGate] Auto-approved: confidence=%.2f >= threshold=%.2f",
            ai_confidence, prefs.approval_auto_approve_threshold,
        )
        return {"requires_approval": False, "auto_approved": True}

    # Create approval request
    request = ExternalApprovalRequest.objects.create(
        tenant=tenant,
        request_type=request_type,
        status=ExternalApprovalStatus.PENDING,
        priority=priority,
        subject=subject,
        recipient_type=recipient_type,
        recipient_entity_id=recipient_entity_id,
        recipient_name=recipient_name,
        recipient_email=recipient_email,
        content_preview=content_preview,
        content_payload=content_payload or {},
        source_entity_type=source_entity_type,
        source_entity_id=source_entity_id,
        ai_generated=ai_generated,
        ai_confidence=ai_confidence,
        requested_by=user,
        expires_at=timezone.now() + timedelta(hours=DEFAULT_EXPIRY_HOURS),
    )

    logger.info(
        "[ApprovalGate] Created approval request %s: %s → %s (%s)",
        request.id, request_type, recipient_name or recipient_email, priority,
    )

    return {
        "requires_approval": True,
        "request_id": str(request.id),
        "expires_at": request.expires_at.isoformat(),
    }


def approve_request(request_id: str, reviewer, notes: str = "") -> dict:
    """Approve an external approval request."""
    from tenant_apps.ai_assistant.models import (
        ExternalApprovalRequest,
        ExternalApprovalStatus,
    )

    try:
        req = ExternalApprovalRequest.objects.select_for_update().get(pk=request_id)
    except ExternalApprovalRequest.DoesNotExist:
        return {"error": "Request not found", "success": False}

    if req.status != ExternalApprovalStatus.PENDING:
        return {"error": f"Cannot approve — status is {req.status}", "success": False}

    req.status = ExternalApprovalStatus.APPROVED
    req.reviewed_by = reviewer
    req.reviewed_at = timezone.now()
    req.reviewer_notes = notes
    req.save()

    logger.info("[ApprovalGate] Approved %s by user %s", request_id, reviewer)
    return {"success": True, "status": "approved"}


def reject_request(request_id: str, reviewer, notes: str = "") -> dict:
    """Reject an external approval request."""
    from tenant_apps.ai_assistant.models import (
        ExternalApprovalRequest,
        ExternalApprovalStatus,
    )

    try:
        req = ExternalApprovalRequest.objects.select_for_update().get(pk=request_id)
    except ExternalApprovalRequest.DoesNotExist:
        return {"error": "Request not found", "success": False}

    if req.status != ExternalApprovalStatus.PENDING:
        return {"error": f"Cannot reject — status is {req.status}", "success": False}

    req.status = ExternalApprovalStatus.REJECTED
    req.reviewed_by = reviewer
    req.reviewed_at = timezone.now()
    req.reviewer_notes = notes
    req.save()

    logger.info("[ApprovalGate] Rejected %s by user %s", request_id, reviewer)
    return {"success": True, "status": "rejected"}


def edit_and_approve(request_id: str, reviewer, edited_content: dict, notes: str = "") -> dict:
    """Edit content and then approve."""
    from tenant_apps.ai_assistant.models import (
        ExternalApprovalRequest,
        ExternalApprovalStatus,
    )

    try:
        req = ExternalApprovalRequest.objects.select_for_update().get(pk=request_id)
    except ExternalApprovalRequest.DoesNotExist:
        return {"error": "Request not found", "success": False}

    if req.status != ExternalApprovalStatus.PENDING:
        return {"error": f"Cannot edit-approve — status is {req.status}", "success": False}

    req.status = ExternalApprovalStatus.EDITED_AND_APPROVED
    req.reviewed_by = reviewer
    req.reviewed_at = timezone.now()
    req.reviewer_notes = notes
    req.edited_content = edited_content
    req.save()

    logger.info("[ApprovalGate] Edit-approved %s by user %s", request_id, reviewer)
    return {"success": True, "status": "edited_and_approved"}


def delegate_request(request_id: str, from_user, to_user_id: int, notes: str = "") -> dict:
    """Delegate an approval request to another user."""
    from tenant_apps.ai_assistant.models import (
        ExternalApprovalRequest,
        ExternalApprovalStatus,
    )
    from django.contrib.auth import get_user_model
    User = get_user_model()

    try:
        req = ExternalApprovalRequest.objects.select_for_update().get(pk=request_id)
    except ExternalApprovalRequest.DoesNotExist:
        return {"error": "Request not found", "success": False}

    if req.status != ExternalApprovalStatus.PENDING:
        return {"error": f"Cannot delegate — status is {req.status}", "success": False}

    try:
        to_user = User.objects.get(pk=to_user_id)
    except User.DoesNotExist:
        return {"error": "Delegate user not found", "success": False}

    req.delegated_to = to_user
    req.reviewer_notes = notes
    req.save()

    logger.info("[ApprovalGate] Delegated %s from %s to %s", request_id, from_user, to_user)
    return {"success": True, "delegated_to": to_user_id}


def expire_stale_requests(tenant_id: str | None = None) -> dict:
    """Expire approval requests past their expires_at.

    Called by Celery beat task hourly.
    Returns: {"expired": int}
    """
    from tenant_apps.ai_assistant.models import (
        ExternalApprovalRequest,
        ExternalApprovalStatus,
    )

    now = timezone.now()
    qs = ExternalApprovalRequest.objects.filter(
        status=ExternalApprovalStatus.PENDING,
        expires_at__lte=now,
    )
    if tenant_id:
        qs = qs.filter(tenant_id=tenant_id)

    count = qs.update(status=ExternalApprovalStatus.EXPIRED)

    if count:
        logger.info("[ApprovalGate] Expired %d stale approval requests", count)

    return {"expired": count}


def get_pending_count(tenant, user=None) -> int:
    """Get count of pending approval requests for a tenant/user."""
    from tenant_apps.ai_assistant.models import (
        ExternalApprovalRequest,
        ExternalApprovalStatus,
    )
    from django.db.models import Q

    qs = ExternalApprovalRequest.objects.filter(
        tenant=tenant,
        status=ExternalApprovalStatus.PENDING,
    )
    if user and not user.is_superuser:
        qs = qs.filter(Q(requested_by=user) | Q(delegated_to=user))
    return qs.count()
