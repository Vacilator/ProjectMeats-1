"""AI Feedback Aggregation & Retraining Queue (PI-02).

Provides:
- Feedback statistics aggregation for monitoring dashboards
- Retraining data export consumer for continuous learning
- Login-triggered sync task

Usage:
    from tenant_apps.ai_assistant.tasks.feedback_tasks import (
        compute_feedback_stats,
        export_retraining_batch,
        trigger_login_sync,
    )
"""

from __future__ import annotations

import logging
from datetime import timedelta

from django.db.models import Avg, Count, Q
from django.utils import timezone

from celery import shared_task

from apps.tenants.rls import tenant_rls

logger = logging.getLogger(__name__)


@shared_task(name="ai_assistant.compute_feedback_stats")
def compute_feedback_stats(tenant_id: str, days: int = 30) -> dict:
    """Compute aggregate feedback statistics for a tenant.

    Returns breakdown of thumbs up/down, average confidence,
    retraining queue depth, and trend indicators.
    """
    from tenant_apps.ai_assistant.models import AIFeedbackLog

    cutoff = timezone.now() - timedelta(days=days)

    with tenant_rls(tenant_id):
        qs = AIFeedbackLog.objects.filter(tenant_id=tenant_id, created_on__gte=cutoff)

        total = qs.count()
        if total == 0:
            return {
                "total": 0,
                "thumbs_up": 0,
                "thumbs_down": 0,
                "no_signal": 0,
                "avg_confidence": 0.0,
                "retraining_queued": 0,
                "retraining_exported": 0,
                "period_days": days,
            }

        aggregates = qs.aggregate(
            avg_confidence=Avg("confidence_score"),
            thumbs_up=Count("id", filter=Q(feedback_signal="thumbs_up")),
            thumbs_down=Count("id", filter=Q(feedback_signal="thumbs_down")),
            no_signal=Count("id", filter=Q(feedback_signal__isnull=True) | Q(feedback_signal="")),
            queued=Count("id", filter=Q(retraining_status="queued")),
            exported=Count("id", filter=Q(retraining_status="exported")),
        )

        return {
            "total": total,
            "thumbs_up": aggregates["thumbs_up"] or 0,
            "thumbs_down": aggregates["thumbs_down"] or 0,
            "no_signal": aggregates["no_signal"] or 0,
            "avg_confidence": round(float(aggregates["avg_confidence"] or 0), 4),
            "retraining_queued": aggregates["queued"] or 0,
            "retraining_exported": aggregates["exported"] or 0,
            "period_days": days,
            "approval_rate": round(
                (aggregates["thumbs_up"] or 0)
                / max(1, (aggregates["thumbs_up"] or 0) + (aggregates["thumbs_down"] or 0)),
                4,
            ),
        }


@shared_task(name="ai_assistant.export_retraining_batch")
def export_retraining_batch(tenant_id: str, batch_size: int = 100) -> dict:
    """Export queued feedback entries for retraining.

    Marks exported entries so they aren't processed twice.
    Returns structured data suitable for model fine-tuning.
    """
    from tenant_apps.ai_assistant.models import AIFeedbackLog

    with tenant_rls(tenant_id):
        queued = list(
            AIFeedbackLog.objects.filter(
                tenant_id=tenant_id,
                retraining_status="queued",
            ).order_by(
                "created_on"
            )[:batch_size]
        )

        if not queued:
            return {"exported": 0, "entries": []}

        entries = []
        for item in queued:
            entries.append(
                {
                    "document_id": str(item.document_id),
                    "document_type": item.document_type,
                    "original": item.original_extracted_data,
                    "corrected": item.user_corrected_data,
                    "confidence": item.confidence_score,
                    "signal": item.feedback_signal or "",
                    "comment": item.feedback_comment or "",
                }
            )

        # Mark as exported
        ids = [item.pk for item in queued]
        AIFeedbackLog.objects.filter(pk__in=ids).update(
            retraining_status="exported",
            retraining_queued_at=timezone.now(),
        )

        logger.info(
            "[AI Feedback] Exported %d retraining entries for tenant=%s",
            len(entries),
            tenant_id,
        )

        return {"exported": len(entries), "entries": entries}


@shared_task(name="ai_assistant.trigger_login_sync")
def trigger_login_sync(tenant_id: str, user_id: int | None = None) -> dict:
    """Triggered on user login to perform instant AI inbox refresh.

    Lighter than the full watchdog — just syncs feedback queue and
    broadcasts any new items to the user.
    """
    from tenant_apps.ai_assistant.tasks.watchdog import sync_ai_feedback_queue_for_tenant

    with tenant_rls(tenant_id):
        result = sync_ai_feedback_queue_for_tenant(tenant_id)

    logger.info(
        "[AI Inbox] Login sync for tenant=%s user=%s: %d new items",
        tenant_id,
        user_id,
        result.get("feedback_logs_created", 0),
    )

    return {
        "tenant_id": tenant_id,
        "user_id": user_id,
        "synced": True,
        **result,
    }
