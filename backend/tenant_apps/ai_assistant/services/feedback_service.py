"""AI Feedback Service — RT-02.3: Training queue + telemetry + corrections.

Provides:
- queue_feedback_for_training(): Celery-compatible task wrapper
- suggest_corrections(): AI-suggested field corrections on negative feedback
- emit_feedback_telemetry(): Fires TradeEventLog entries for feedback events
- process_feedback_with_deps(): Resolves missing dependencies when feedback indicates parse failure

Additive only — no existing services modified.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from django.utils import timezone

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Telemetry event types (canonical, referenced in FORM_PROCESS_TESTING_GUIDE)
# ---------------------------------------------------------------------------
EVENT_FEEDBACK_SUBMITTED = "ai_feedback.submitted"
EVENT_CORRECTION_APPLIED = "ai_feedback.correction_applied"
EVENT_DEPENDENCY_AUTOCREATE = "ai_dependency_autocreate.executed"


def emit_feedback_telemetry(
    *,
    tenant,
    event_type: str,
    feedback_id: str,
    actor_user_id: str = "",
    payload: dict | None = None,
) -> None:
    """Emit a TradeEventLog entry for feedback telemetry.

    Uses deferred import to avoid circular imports at module load.
    """
    from apps.core.models import TradeEventLog

    TradeEventLog.objects.create(
        tenant=tenant,
        event_id=str(uuid.uuid4()),
        event_type=event_type,
        entity_type="AIFeedbackLog",
        entity_id=str(feedback_id),
        actor_user_id=str(actor_user_id),
        payload=payload or {},
    )
    logger.info(
        "Telemetry emitted: %s for feedback %s",
        event_type,
        feedback_id,
    )


def suggest_corrections(
    *,
    original_data: dict[str, Any],
    confidence_score: float,
) -> dict[str, Any]:
    """Suggest field corrections based on extraction confidence.

    For fields with low confidence or missing values, suggests common
    corrections based on known patterns. This is a rule-based first pass —
    future iterations will use the trained model.

    Returns:
        Dict of field_name -> suggested_value (only for fields needing correction).
    """
    suggestions: dict[str, Any] = {}

    if not original_data:
        return suggestions

    # Suggest corrections for common parse failures
    po_numbers = original_data.get("po_numbers", [])
    if not po_numbers and original_data.get("subject"):
        # Subject might contain PO info that wasn't extracted
        suggestions["po_numbers"] = {
            "hint": "Check subject line for PO reference",
            "source_field": "subject",
        }

    # Check for missing quantity/UOM pairs
    line_items = original_data.get("line_items", [])
    for i, item in enumerate(line_items):
        if item.get("quantity") and not item.get("unit_of_measure"):
            suggestions[f"line_items[{i}].unit_of_measure"] = {
                "hint": "Quantity found but UOM missing — check for lbs/kg/cases",
                "common_values": ["LBS", "KG", "CASES", "UNITS"],
            }
        if item.get("unit_of_measure") and not item.get("quantity"):
            suggestions[f"line_items[{i}].quantity"] = {
                "hint": "UOM found but quantity missing — check numeric values in context",
            }

    # Suggest sender company if not extracted
    if not original_data.get("sender_company") and original_data.get("sender_email"):
        email = original_data["sender_email"]
        domain = email.split("@")[-1] if "@" in email else ""
        if domain and domain not in ("gmail.com", "yahoo.com", "hotmail.com", "outlook.com"):
            company_hint = domain.split(".")[0].title()
            suggestions["sender_company"] = {
                "hint": f"Derived from email domain: {company_hint}",
                "suggested_value": company_hint,
            }

    # Low confidence overall — suggest manual review
    if confidence_score < 0.3:
        suggestions["_meta"] = {
            "recommendation": "Low confidence extraction — manual review recommended",
            "confidence": confidence_score,
        }

    return suggestions


def process_feedback_with_deps(
    *,
    tenant,
    feedback_row,
    user,
) -> dict[str, Any]:
    """Process feedback that requires dependency auto-creation.

    When user corrects parsed data with a new supplier/contact/plant that
    doesn't exist yet, auto-create them using the RT-02.2 resolver.

    Returns:
        Dict with created/existing entity lists.
    """
    from tenant_apps.ai_assistant.services.email_parser import ParsedTradeEmail, resolve_dependencies

    corrected = feedback_row.user_corrected_data or {}
    if not corrected:
        return {"created": [], "existing": []}

    # Build ParsedTradeEmail from corrected data
    company = corrected.get("sender_company", "")
    email = corrected.get("sender_email", "")

    # Only resolve if there's meaningful company/email data
    if not company and not email:
        return {"created": [], "existing": []}

    parsed_data = ParsedTradeEmail(
        company_name=company,
        sender_email=email,
        sender_name=corrected.get("sender_name", ""),
    )

    result = resolve_dependencies(tenant=tenant, parsed_data=parsed_data)

    if result.created:
        emit_feedback_telemetry(
            tenant=tenant,
            event_type=EVENT_DEPENDENCY_AUTOCREATE,
            feedback_id=str(feedback_row.pk),
            actor_user_id=str(user.pk) if user else "",
            payload={
                "entities_created": result.created,
                "entities_existing": result.existing,
                "source": "feedback_correction",
            },
        )

    return {"created": result.created, "existing": result.existing}


def queue_single_feedback(feedback_id: str) -> dict[str, Any]:
    """Mark a feedback row as queued and signal the training pipeline.

    This is the real-time counterpart to the nightly RLHF flywheel batch.
    Called immediately after feedback submission.

    Returns:
        Status dict.
    """
    from tenant_apps.ai_assistant.models import AIFeedbackLog

    try:
        row = AIFeedbackLog.objects.get(pk=feedback_id)
    except AIFeedbackLog.DoesNotExist:
        logger.warning("queue_single_feedback: row %s not found", feedback_id)
        return {"status": "not_found", "feedback_id": feedback_id}

    if row.retraining_status == AIFeedbackLog.RetrainingStatus.QUEUED:
        # Already queued — idempotent
        return {"status": "already_queued", "feedback_id": feedback_id}

    row.retraining_status = AIFeedbackLog.RetrainingStatus.QUEUED
    row.retraining_queued_at = timezone.now()
    row.save(update_fields=["retraining_status", "retraining_queued_at", "modified_on"])

    logger.info("Feedback %s queued for training", feedback_id)
    return {"status": "queued", "feedback_id": feedback_id}
