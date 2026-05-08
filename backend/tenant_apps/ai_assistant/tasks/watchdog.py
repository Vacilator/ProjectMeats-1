"""Watchdog tasks for PM-AS.

Phase 8.x: Proactive anomaly detection and AI inbox continuity.
"""

from __future__ import annotations

import logging
import re
from datetime import timedelta

from django.utils import timezone

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer

from apps.tenants.rls import reset_current_tenant, set_current_tenant, tenant_rls

logger = logging.getLogger(__name__)


def _sanitize_group_component(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", str(value or ""))


def _build_ai_inbox_group_name(*, tenant_id: str, user_id: int) -> str:
    return f"ai-inbox__{_sanitize_group_component(tenant_id)}__{_sanitize_group_component(str(user_id))}"


def _build_ai_feedback_payload(draft) -> dict:
    email_log = getattr(draft, "email_log", None)
    payload = dict(getattr(draft, "extracted_payload", {}) or {})
    payload.setdefault("draft_id", str(draft.id))
    payload.setdefault("subject", getattr(email_log, "subject", ""))
    payload.setdefault("sender_email", getattr(email_log, "sender_email", ""))
    payload.setdefault("sender_name", getattr(email_log, "sender_name", ""))
    payload.setdefault("email_body", getattr(email_log, "body_text", "") or getattr(email_log, "body_html", ""))
    payload.setdefault("summary", getattr(draft, "summary", ""))
    return payload


def ensure_feedback_log_for_draft(draft) -> tuple[object, bool]:
    from tenant_apps.ai_assistant.models import AIFeedbackLog

    payload = _build_ai_feedback_payload(draft)
    row = AIFeedbackLog.objects.filter(tenant=draft.tenant, document_id=draft.id).order_by("-created_on").first()
    created = False

    if row is None:
        row = AIFeedbackLog.objects.create(
            tenant=draft.tenant,
            document_id=draft.id,
            document_type=draft.draft_type,
            original_extracted_data=payload,
            confidence_score=float(draft.classification_confidence or 0.0),
        )
        created = True
    elif row.resolved_by_id is None:
        row.document_type = draft.draft_type or row.document_type
        row.original_extracted_data = payload
        row.confidence_score = float(draft.classification_confidence or row.confidence_score or 0.0)
        row.save(update_fields=["document_type", "original_extracted_data", "confidence_score", "modified_on"])

    return row, created


def broadcast_ai_inbox_event(*, tenant_id: str, user_ids: list[int], payload: dict) -> None:
    channel_layer = get_channel_layer()
    if not channel_layer or not user_ids:
        return

    for user_id in user_ids:
        async_to_sync(channel_layer.group_send)(
            _build_ai_inbox_group_name(tenant_id=tenant_id, user_id=user_id),
            {
                "type": "ai_inbox_message",
                "payload": payload,
            },
        )


def sync_ai_feedback_queue_for_tenant(tenant_id: str) -> dict:
    from apps.integrations.models import EmailReviewDraft
    from apps.tenants.models import TenantUser

    drafts = list(
        EmailReviewDraft.objects.filter(tenant_id=tenant_id, status="pending_review")
        .select_related("tenant", "email_log")
        .order_by("-created_at")[:25]
    )

    created_rows = 0
    created_by_type: dict[str, int] = {}
    for draft in drafts:
        _row, created = ensure_feedback_log_for_draft(draft)
        if created:
            created_rows += 1
            created_by_type[draft.draft_type] = created_by_type.get(draft.draft_type, 0) + 1

    unresolved_count = len(drafts)
    if created_rows:
        recipient_ids = list(
            TenantUser.objects.filter(
                tenant_id=tenant_id,
                is_active=True,
                role__in=["owner", "admin"],
            ).values_list("user_id", flat=True)
        )

        labels = []
        if created_by_type.get("purchase_order"):
            labels.append(f"{created_by_type['purchase_order']} new Purchase Orders")
        if created_by_type.get("bill_of_lading"):
            labels.append(f"{created_by_type['bill_of_lading']} new BOLs")
        if created_by_type.get("new_customer"):
            labels.append(f"{created_by_type['new_customer']} new Customer drafts")
        detail = " and ".join(labels) if labels else f"{created_rows} new AI Inbox items"

        try:
            broadcast_ai_inbox_event(
                tenant_id=tenant_id,
                user_ids=recipient_ids,
                payload={
                    "message": f"I found {detail} while you were away. Check your AI Inbox.",
                    "unread_count": unresolved_count,
                },
            )
        except Exception as exc:
            logger.warning("[AI Inbox] Failed to broadcast notification for tenant=%s: %s", tenant_id, exc)

    return {
        "drafts_seen": len(drafts),
        "feedback_logs_created": created_rows,
        "unread_count": unresolved_count,
    }


@shared_task(name="ai_assistant.run_daily_watchdog")
def run_daily_watchdog(days_overdue: int = 3) -> dict:
    """Daily watchdog that alerts tenant admins about simple anomalies."""

    from tenant_apps.purchase_orders.models import PurchaseOrder, PurchaseOrderStatus
    from tenant_apps.workflows.models import NotificationPriority, NotificationType, UserNotification

    from apps.tenants.models import Tenant, TenantUser

    now = timezone.now()
    cutoff_date = (now - timedelta(days=int(days_overdue))).date()

    summary = {
        "checked_tenants": 0,
        "notifications_created": 0,
        "overdue_pos_found": 0,
        "cutoff_date": cutoff_date.isoformat(),
    }

    for tenant in Tenant.objects.all().only("id", "name"):
        summary["checked_tenants"] += 1

        rls = set_current_tenant(str(tenant.id))
        if not rls.ok:
            logger.warning("[Watchdog] Skipping tenant=%s (RLS set failed: %s)", tenant.id, rls.error)
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
                .only("id", "order_number", "delivery_date", "status")
                .order_by("delivery_date")
            )

            overdue = list(overdue_qs[:25])
            if not overdue:
                continue

            summary["overdue_pos_found"] += len(overdue)

            admin_user_ids = list(
                TenantUser.objects.filter(tenant=tenant, is_active=True, role__in=["owner", "admin"]).values_list(
                    "user_id", flat=True
                )
            )
            if not admin_user_ids:
                continue

            lines = [f"PO {po.order_number} expected {po.delivery_date} (status={po.status})" for po in overdue]
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
                    entity_type="purchase_order",
                    metadata={"watchdog": True, "cutoff_date": cutoff_date.isoformat(), "count": len(overdue)},
                )
                summary["notifications_created"] += 1

        finally:
            reset_current_tenant()

    return summary


@shared_task(name="ai_assistant.run_ai_inbox_watchdog")
def run_ai_inbox_watchdog() -> dict:
    from tenant_apps.integrations.services.email_ingestion import EmailIngestionService

    from apps.tenants.models import Tenant

    summary = {"tenants_checked": 0, "feedback_logs_created": 0, "unread_count": 0}

    for tenant in Tenant.objects.filter(is_active=True).only("id"):
        summary["tenants_checked"] += 1
        with tenant_rls(str(tenant.id)):
            EmailIngestionService().poll_tenant_by_id(str(tenant.id))
            tenant_summary = sync_ai_feedback_queue_for_tenant(str(tenant.id))
            summary["feedback_logs_created"] += int(tenant_summary.get("feedback_logs_created") or 0)
            summary["unread_count"] += int(tenant_summary.get("unread_count") or 0)

    return summary
