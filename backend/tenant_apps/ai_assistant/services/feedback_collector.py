"""AI Feedback Collector — Phase 40: Batch implicit/explicit feedback events.

Provides:
- record_implicit_event(): Store a single implicit signal
- record_batch_events(): Store a batch of events (from frontend flush)
- get_feedback_summary(): Summary stats for a tenant

Fire-and-forget pattern — frontend sends batch, we store asynchronously.
"""

from __future__ import annotations

import logging
import uuid
from datetime import timedelta
from typing import Any

from django.utils import timezone

logger = logging.getLogger(__name__)


# Maps frontend event_type strings to AIFeedbackLog.ImplicitSignalType values
SIGNAL_TYPE_MAP = {
    "implicit_accept": "accepted_as_is",
    "implicit_field_correction": "field_correction",
    "implicit_dismiss": "dismissed_after_view",
    "implicit_dismiss_unopened": "dismissed_unopened",
    "implicit_timing": "accepted_as_is",
    "implicit_search_intent": "search_navigate",
    "implicit_undo": "undo_revert",
    "implicit_suggestion_click": "suggestion_clicked",
    "implicit_suggestion_dismiss": "suggestion_dismissed",
}

# Positive signals (used for learning aggregation)
POSITIVE_SIGNALS = {"accepted_as_is", "suggestion_clicked"}
NEGATIVE_SIGNALS = {"field_correction", "dismissed_unopened", "dismissed_after_view", "undo_revert", "suggestion_dismissed"}


def record_implicit_event(
    *,
    tenant,
    user,
    event_type: str,
    source_surface: str = "",
    entity_type: str = "",
    entity_id: str = "",
    field_name: str = "",
    ai_value: Any = None,
    user_value: Any = None,
    confidence_score: float = 0.0,
    resolution_time_ms: int | None = None,
    metadata: dict | None = None,
) -> int | None:
    """Record a single implicit feedback event.

    Returns the created AIFeedbackLog ID, or None if creation failed.
    """
    from tenant_apps.ai_assistant.models import AIFeedbackLog

    implicit_signal = SIGNAL_TYPE_MAP.get(event_type, "")

    # Map to explicit feedback_signal if applicable
    feedback_signal = None
    if event_type == "explicit_thumbs_up":
        feedback_signal = "thumbs_up"
    elif event_type == "explicit_thumbs_down":
        feedback_signal = "thumbs_down"

    try:
        log = AIFeedbackLog.objects.create(
            tenant=tenant,
            document_id=entity_id or str(uuid.uuid4()),
            document_type=entity_type or "unknown",
            implicit_signal=implicit_signal,
            source_surface=source_surface,
            source_entity_type=entity_type,
            source_entity_id=entity_id,
            confidence_score=confidence_score,
            review_duration_ms=resolution_time_ms,
            feedback_signal=feedback_signal,
            submitted_by=user,
            fields_modified_by_user=[field_name] if field_name else [],
            original_extracted_data={"ai_value": ai_value} if ai_value is not None else {},
            user_corrected_data={"user_value": user_value} if user_value is not None else {},
        )
        return log.pk
    except Exception:
        logger.exception("[FeedbackCollector] Failed to record implicit event")
        return None


def record_batch_events(
    *,
    tenant,
    user,
    events: list[dict],
) -> dict:
    """Record a batch of feedback events (from frontend 30s flush).

    Returns: {"accepted": int, "failed": int}
    """
    from tenant_apps.ai_assistant.models import AIFeedbackLog

    bulk_logs = []
    failed = 0

    for event in events:
        event_type = event.get("event_type", "")
        implicit_signal = SIGNAL_TYPE_MAP.get(event_type, "")

        feedback_signal = None
        if event_type == "explicit_thumbs_up":
            feedback_signal = "thumbs_up"
        elif event_type == "explicit_thumbs_down":
            feedback_signal = "thumbs_down"

        try:
            log = AIFeedbackLog(
                tenant=tenant,
                document_id=event.get("entity_id") or str(uuid.uuid4()),
                document_type=event.get("entity_type", "unknown"),
                implicit_signal=implicit_signal,
                source_surface=event.get("source_surface", ""),
                source_entity_type=event.get("entity_type", ""),
                source_entity_id=event.get("entity_id", ""),
                confidence_score=event.get("confidence_score") or 0.0,
                review_duration_ms=event.get("resolution_time_ms"),
                feedback_signal=feedback_signal,
                submitted_by=user,
                fields_modified_by_user=[event["field_name"]] if event.get("field_name") else [],
                original_extracted_data={"ai_value": event.get("ai_value")} if event.get("ai_value") is not None else {},
                user_corrected_data={"user_value": event.get("user_value")} if event.get("user_value") is not None else {},
            )
            bulk_logs.append(log)
        except Exception:
            logger.exception("[FeedbackCollector] Failed to prepare event: %s", event)
            failed += 1

    accepted = 0
    if bulk_logs:
        try:
            AIFeedbackLog.objects.bulk_create(bulk_logs, ignore_conflicts=True)
            accepted = len(bulk_logs)
        except Exception:
            logger.exception("[FeedbackCollector] bulk_create failed")
            failed += len(bulk_logs)

    return {"accepted": accepted, "failed": failed}


def get_feedback_summary(tenant_id: str, days: int = 30) -> dict:
    """Get feedback summary stats for a tenant.

    Returns: {total, positive, negative, correction_rate, avg_resolution_ms, top_surfaces}
    """
    from tenant_apps.ai_assistant.models import AIFeedbackLog
    from django.db.models import Avg, Count, Q

    cutoff = timezone.now() - timedelta(days=days)
    qs = AIFeedbackLog.objects.filter(tenant_id=tenant_id, created_on__gte=cutoff)

    total = qs.count()
    if total == 0:
        return {
            "total": 0, "positive": 0, "negative": 0,
            "correction_rate": 0.0, "avg_resolution_ms": 0,
            "top_surfaces": {}, "period_days": days,
        }

    positive_count = qs.filter(implicit_signal__in=POSITIVE_SIGNALS).count()
    negative_count = qs.filter(implicit_signal__in=NEGATIVE_SIGNALS).count()

    avg_resolution = qs.filter(review_duration_ms__isnull=False).aggregate(
        avg=Avg("review_duration_ms")
    )["avg"] or 0

    # Top source surfaces
    surface_counts = dict(
        qs.exclude(source_surface="")
        .values_list("source_surface")
        .annotate(c=Count("id"))
        .order_by("-c")[:5]
        .values_list("source_surface", "c")
    )

    return {
        "total": total,
        "positive": positive_count,
        "negative": negative_count,
        "correction_rate": round(negative_count / max(1, total), 4),
        "avg_resolution_ms": int(avg_resolution),
        "top_surfaces": surface_counts,
        "period_days": days,
    }
