"""Phase 40: Celery tasks for approval timeouts and learning aggregation.

Tasks:
- process_approval_timeouts: Hourly — expires stale approval requests
- aggregate_daily_learning: Daily — computes AI learning snapshots for all tenants
"""

from __future__ import annotations

import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="ai_assistant.process_approval_timeouts")
def process_approval_timeouts() -> dict:
    """Expire stale approval requests past their expires_at.

    Runs hourly via Celery beat.
    """
    from tenant_apps.ai_assistant.services.approval_gate_service import expire_stale_requests

    result = expire_stale_requests()
    logger.info("[ApprovalTimeouts] Expired %d requests", result.get("expired", 0))
    return result


@shared_task(name="ai_assistant.aggregate_daily_learning")
def aggregate_daily_learning() -> dict:
    """Compute AI learning snapshots for all tenants.

    Runs daily via Celery beat at 4:00 AM UTC.
    """
    from apps.tenants.models import Tenant
    from tenant_apps.ai_assistant.services.learning_aggregator import aggregate_period

    tenants = Tenant.objects.filter(is_active=True).values_list("id", flat=True)
    total_snapshots = 0
    tenant_count = 0

    for tenant_id in tenants:
        try:
            result = aggregate_period(str(tenant_id))
            total_snapshots += result.get("snapshots_created", 0)
            tenant_count += 1
        except Exception:
            logger.exception(
                "[DailyLearning] Failed to aggregate for tenant=%s", tenant_id
            )

    logger.info(
        "[DailyLearning] Aggregated %d snapshots across %d tenants",
        total_snapshots, tenant_count,
    )
    return {"tenants_processed": tenant_count, "snapshots_created": total_snapshots}
