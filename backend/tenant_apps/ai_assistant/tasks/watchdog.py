"""Watchdog tasks for PM-AS.

Phase 8.x: Proactive anomaly detection.

This is intentionally conservative: it only creates in-app notifications and does
NOT perform any destructive actions.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from apps.tenants.rls import reset_current_tenant, set_current_tenant

logger = logging.getLogger(__name__)


@shared_task(name='ai_assistant.run_daily_watchdog')
def run_daily_watchdog(days_overdue: int = 3) -> dict:
    """Daily watchdog that alerts tenant admins about simple anomalies.

    Current checks (v1):
    - Purchase Orders overdue beyond expected delivery_date and not delivered/cancelled.

    Returns a summary payload for logs.
    """

    from apps.tenants.models import Tenant, TenantUser
    from tenant_apps.purchase_orders.models import PurchaseOrder, PurchaseOrderStatus
    from tenant_apps.workflows.models import NotificationType, NotificationPriority, UserNotification

    now = timezone.now()
    cutoff_date = (now - timedelta(days=int(days_overdue))).date()

    summary = {
        'checked_tenants': 0,
        'notifications_created': 0,
        'overdue_pos_found': 0,
        'cutoff_date': cutoff_date.isoformat(),
    }

    for tenant in Tenant.objects.all().only('id', 'name'):
        summary['checked_tenants'] += 1

        # Assert RLS session variable for this tenant.
        rls = set_current_tenant(str(tenant.id))
        if not rls.ok:
            logger.warning('[Watchdog] Skipping tenant=%s (RLS set failed: %s)', tenant.id, rls.error)
            continue

        try:
            overdue_qs = (
                PurchaseOrder.objects.filter(
                    tenant=tenant,
                    is_deleted=False,
                    delivery_date__isnull=False,
                    delivery_date__lt=cutoff_date,
                )
                .exclude(status__in=[PurchaseOrderStatus.DELIVERED, PurchaseOrderStatus.CANCELLED])
                .only('id', 'order_number', 'delivery_date', 'status')
                .order_by('delivery_date')
            )

            overdue = list(overdue_qs[:25])
            if not overdue:
                continue

            summary['overdue_pos_found'] += len(overdue)

            admin_user_ids = list(
                TenantUser.objects.filter(tenant=tenant, is_active=True, role__in=['owner', 'admin']).values_list('user_id', flat=True)
            )
            if not admin_user_ids:
                continue

            lines = [
                f"PO {po.order_number} expected {po.delivery_date} (status={po.status})" for po in overdue
            ]
            title = f"Overdue Purchase Orders ({len(overdue)})"
            message = "The following POs appear overdue:\n" + "\n".join(lines)

            for uid in admin_user_ids:
                UserNotification.objects.create(
                    user_id=uid,
                    tenant=tenant,
                    notification_type=NotificationType.SYSTEM,
                    title=title,
                    message=message,
                    priority=NotificationPriority.HIGH,
                    entity_type='purchase_order',
                    metadata={'watchdog': True, 'cutoff_date': cutoff_date.isoformat(), 'count': len(overdue)},
                )
                summary['notifications_created'] += 1

        finally:
            reset_current_tenant()

    return summary
