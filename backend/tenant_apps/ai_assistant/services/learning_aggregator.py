"""AI Learning Aggregator — Phase 40.

Aggregates feedback events into periodic snapshots for accuracy tracking.
Run daily by Celery beat.

Provides:
- aggregate_period(): Compute snapshot for a time range
- get_accuracy_for_entity(): Current accuracy metrics
- get_improvement_suggestions(): Fields needing more training data
"""

from __future__ import annotations

import logging
from collections import Counter
from datetime import timedelta

from django.db.models import Avg, Count, Q
from django.utils import timezone

logger = logging.getLogger(__name__)

# Signals considered positive vs negative for accuracy calculation
POSITIVE_SIGNALS = {"accepted_as_is", "suggestion_clicked"}
NEGATIVE_SIGNALS = {
    "field_correction", "dismissed_unopened", "dismissed_after_view",
    "undo_revert", "suggestion_dismissed",
}


def aggregate_period(
    tenant_id: str,
    period_start=None,
    period_end=None,
) -> dict:
    """Compute an AI learning snapshot for the given period.

    Default: last 24 hours.
    Creates AILearningSnapshot entries per entity_type.
    Returns: {"snapshots_created": int, "entity_types": list}
    """
    from tenant_apps.ai_assistant.models import AIFeedbackLog, AILearningSnapshot
    from apps.tenants.models import Tenant

    if period_end is None:
        period_end = timezone.now()
    if period_start is None:
        period_start = period_end - timedelta(days=1)

    try:
        tenant = Tenant.objects.get(pk=tenant_id)
    except Tenant.DoesNotExist:
        logger.warning("[LearningAggregator] Tenant %s not found", tenant_id)
        return {"snapshots_created": 0, "entity_types": []}

    qs = AIFeedbackLog.objects.filter(
        tenant_id=tenant_id,
        created_on__gte=period_start,
        created_on__lt=period_end,
    )

    # Group by entity type (source_entity_type field)
    entity_types = list(
        qs.exclude(source_entity_type="")
        .values_list("source_entity_type", flat=True)
        .distinct()
    )
    # Always include a catch-all "unknown"
    if qs.filter(source_entity_type="").exists():
        entity_types.append("unknown")

    snapshots_created = 0

    for entity_type in entity_types:
        if entity_type == "unknown":
            entity_qs = qs.filter(source_entity_type="")
        else:
            entity_qs = qs.filter(source_entity_type=entity_type)

        total = entity_qs.count()
        if total == 0:
            continue

        positive = entity_qs.filter(implicit_signal__in=POSITIVE_SIGNALS).count()
        negative = entity_qs.filter(implicit_signal__in=NEGATIVE_SIGNALS).count()

        avg_resolution = entity_qs.filter(
            review_duration_ms__isnull=False
        ).aggregate(avg=Avg("review_duration_ms"))["avg"] or 0

        # Top corrected fields
        corrected_fields = []
        field_logs = entity_qs.filter(
            implicit_signal="field_correction",
            fields_modified_by_user__len__gt=0,  # JSONField list with items
        )
        field_counter = Counter()
        for log in field_logs.iterator():
            for field in (log.fields_modified_by_user or []):
                field_counter[field] += 1
        for field_name, count in field_counter.most_common(10):
            corrected_fields.append({"field": field_name, "count": count})

        correction_rate = negative / max(1, total)

        # Accuracy trend: compare to previous period
        prev_start = period_start - (period_end - period_start)
        prev_snapshot = AILearningSnapshot.objects.filter(
            tenant_id=tenant_id,
            entity_type=entity_type,
            period_start__gte=prev_start,
            period_end__lte=period_start,
        ).order_by("-period_end").first()

        accuracy_trend = 0.0
        if prev_snapshot and prev_snapshot.correction_rate > 0:
            accuracy_trend = prev_snapshot.correction_rate - correction_rate

        AILearningSnapshot.objects.create(
            tenant=tenant,
            period_start=period_start,
            period_end=period_end,
            entity_type=entity_type,
            total_events=total,
            positive_signals=positive,
            negative_signals=negative,
            correction_rate=round(correction_rate, 4),
            avg_resolution_time_ms=int(avg_resolution),
            top_corrected_fields=corrected_fields,
            accuracy_trend=round(accuracy_trend, 4),
        )
        snapshots_created += 1

    logger.info(
        "[LearningAggregator] Created %d snapshots for tenant=%s period=%s→%s",
        snapshots_created, tenant_id, period_start, period_end,
    )

    return {"snapshots_created": snapshots_created, "entity_types": entity_types}


def get_accuracy_for_entity(tenant_id: str, entity_type: str, periods: int = 30) -> dict:
    """Get accuracy metrics for a specific entity type.

    Returns the last N snapshots + overall trend.
    """
    from tenant_apps.ai_assistant.models import AILearningSnapshot

    snapshots = list(
        AILearningSnapshot.objects.filter(
            tenant_id=tenant_id,
            entity_type=entity_type,
        ).order_by("-period_end")[:periods]
    )

    if not snapshots:
        return {
            "entity_type": entity_type,
            "snapshots": [],
            "overall_accuracy": 0.0,
            "trend": "no_data",
        }

    latest = snapshots[0]
    accuracy = 1.0 - latest.correction_rate

    # Determine trend
    if len(snapshots) >= 3:
        recent_avg = sum(1.0 - s.correction_rate for s in snapshots[:3]) / 3
        older_avg = sum(1.0 - s.correction_rate for s in snapshots[-3:]) / min(3, len(snapshots))
        if recent_avg > older_avg + 0.02:
            trend = "improving"
        elif recent_avg < older_avg - 0.02:
            trend = "declining"
        else:
            trend = "stable"
    else:
        trend = "insufficient_data"

    return {
        "entity_type": entity_type,
        "overall_accuracy": round(accuracy, 4),
        "trend": trend,
        "latest_correction_rate": latest.correction_rate,
        "latest_avg_resolution_ms": latest.avg_resolution_time_ms,
        "top_corrected_fields": latest.top_corrected_fields,
        "snapshot_count": len(snapshots),
    }


def get_improvement_suggestions(tenant_id: str) -> list[dict]:
    """Identify fields/entities that need more training data.

    Returns list of suggestions sorted by impact.
    """
    from tenant_apps.ai_assistant.models import AILearningSnapshot

    # Get latest snapshot per entity type
    latest_snapshots = {}
    for snap in AILearningSnapshot.objects.filter(
        tenant_id=tenant_id
    ).order_by("entity_type", "-period_end"):
        if snap.entity_type not in latest_snapshots:
            latest_snapshots[snap.entity_type] = snap

    suggestions = []
    for entity_type, snap in latest_snapshots.items():
        if snap.correction_rate > 0.15:  # >15% correction rate
            suggestions.append({
                "entity_type": entity_type,
                "correction_rate": snap.correction_rate,
                "severity": "high" if snap.correction_rate > 0.3 else "medium",
                "suggestion": f"AI accuracy for {entity_type} is {(1 - snap.correction_rate):.0%}. "
                             f"Top corrected fields: {', '.join(f['field'] for f in snap.top_corrected_fields[:3])}.",
                "top_fields": snap.top_corrected_fields[:5],
            })

    suggestions.sort(key=lambda x: x["correction_rate"], reverse=True)
    return suggestions
