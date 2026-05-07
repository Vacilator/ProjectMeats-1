"""Process event notification service (RT-06.1).

Emits in-app notifications (and optionally email) for every major event
in the EndToEndInquiryToPOProcess trading workflow.

Events handled:
- New bid received
- Due date approaching (< 24h)
- PO received from customer
- Approval needed (bid / PO / SO)
- Process step failure
- Process completed

Uses the contact resolution service (RT-04.1) to route notifications
to the correct user based on Plant Contact Type + Responsibilities.

Usage:
    from tenant_apps.workflows.services.process_notifications import (
        notify_process_event,
        ProcessEvent,
    )

    notify_process_event(
        tenant=tenant,
        event=ProcessEvent.BID_RECEIVED,
        inquiry=inquiry,
        context={"supplier": "Acme", "bid_amount": 1500.00},
    )
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from django.contrib.auth import get_user_model
from django.utils import timezone

from tenant_apps.workflows.models import (
    UserNotification,
    UserNotificationPreferences,
)

logger = logging.getLogger("trade")
User = get_user_model()


class ProcessEvent(str, Enum):
    """Major process events that trigger notifications."""

    BID_RECEIVED = "bid_received"
    DUE_DATE_APPROACHING = "due_date_approaching"
    PO_RECEIVED = "po_received"
    APPROVAL_NEEDED = "approval_needed"
    STEP_FAILED = "step_failed"
    PROCESS_COMPLETED = "process_completed"
    RFQ_SENT = "rfq_sent"
    SALES_ORDER_GENERATED = "sales_order_generated"


# Map events to notification metadata
EVENT_CONFIG: dict[str, dict[str, Any]] = {
    ProcessEvent.BID_RECEIVED: {
        "notification_type": "form_submitted",
        "priority": "normal",
        "title_template": "New Bid Received: {supplier}",
        "message_template": "A new bid has been received from {supplier} for Inquiry {inquiry_number}. Amount: {bid_amount}.",
        "target_department": "sales",
        "target_contact_type": "Sales",
    },
    ProcessEvent.DUE_DATE_APPROACHING: {
        "notification_type": "task_due_soon",
        "priority": "high",
        "title_template": "Due Date Approaching: {inquiry_number}",
        "message_template": "Inquiry {inquiry_number} has a due date within 24 hours. Current step: {current_step}.",
        "target_department": "sales",
        "target_contact_type": "Sales",
    },
    ProcessEvent.PO_RECEIVED: {
        "notification_type": "form_submitted",
        "priority": "high",
        "title_template": "Customer PO Received: {po_number}",
        "message_template": "Purchase Order {po_number} has been received from {customer} for Inquiry {inquiry_number}.",
        "target_department": "sales",
        "target_contact_type": "Sales",
    },
    ProcessEvent.APPROVAL_NEEDED: {
        "notification_type": "task_assigned",
        "priority": "urgent",
        "title_template": "Approval Required: {entity_type} {entity_number}",
        "message_template": "{entity_type} {entity_number} requires your approval. Margin: {margin}%.",
        "target_department": "accounting",
        "target_contact_type": "Accounting",
    },
    ProcessEvent.STEP_FAILED: {
        "notification_type": "system",
        "priority": "urgent",
        "title_template": "Process Failure: {step_name}",
        "message_template": "Step '{step_name}' failed for Inquiry {inquiry_number}. Error: {error_message}. Recovery: {recovery_hint}.",
        "target_department": "operations",
        "target_contact_type": "Operations",
    },
    ProcessEvent.PROCESS_COMPLETED: {
        "notification_type": "task_completed",
        "priority": "normal",
        "title_template": "Process Complete: {inquiry_number}",
        "message_template": "The end-to-end process for Inquiry {inquiry_number} has been completed successfully.",
        "target_department": "sales",
        "target_contact_type": "Sales",
    },
    ProcessEvent.RFQ_SENT: {
        "notification_type": "status_change",
        "priority": "normal",
        "title_template": "RFQ Sent: {supplier}",
        "message_template": "RFQ for Inquiry {inquiry_number} has been sent to {supplier} ({contact_name}).",
        "target_department": "sales",
        "target_contact_type": "Sales",
    },
    ProcessEvent.SALES_ORDER_GENERATED: {
        "notification_type": "status_change",
        "priority": "normal",
        "title_template": "Sales Order Generated: {so_number}",
        "message_template": "Sales Order {so_number} has been generated for Inquiry {inquiry_number}.",
        "target_department": "sales",
        "target_contact_type": "Sales",
    },
}


@dataclass
class NotificationResult:
    """Result of notification dispatch."""

    notifications_created: int = 0
    emails_queued: int = 0
    errors: list[str] = field(default_factory=list)


def notify_process_event(
    *,
    tenant: Any,
    event: ProcessEvent,
    inquiry: Any,
    context: dict[str, Any] | None = None,
    target_users: list[Any] | None = None,
) -> NotificationResult:
    """Emit notifications for a process event.

    Args:
        tenant: The tenant instance.
        event: The process event type.
        inquiry: The inquiry instance driving the process.
        context: Additional context for message templates (supplier, amount, etc.).
        target_users: Explicit list of users to notify. If None, resolves from contacts.

    Returns:
        NotificationResult with counts of created notifications.
    """
    result = NotificationResult()
    config = EVENT_CONFIG.get(event)
    if not config:
        result.errors.append(f"No config for event: {event}")
        return result

    ctx = context or {}
    ctx.setdefault("inquiry_number", _get_inquiry_number(inquiry))

    # Resolve title and message
    try:
        title = config["title_template"].format(**ctx)
    except (KeyError, TypeError):
        title = config["title_template"]

    try:
        message = config["message_template"].format(**ctx)
    except (KeyError, TypeError):
        message = config["message_template"]

    # Resolve target users
    users = target_users or _resolve_target_users(
        tenant=tenant,
        inquiry=inquiry,
        target_department=config.get("target_department"),
        target_contact_type=config.get("target_contact_type"),
    )

    if not users:
        # Fallback: notify all tenant staff
        users = list(
            User.objects.filter(
                tenant_memberships__tenant=tenant,
                is_active=True,
            ).distinct()[:10]
        )

    # Deduplication: skip if identical notification exists within last 5 min
    five_min_ago = timezone.now() - timezone.timedelta(minutes=5)

    for user in users:
        # Check for duplicate
        exists = UserNotification.objects.filter(
            user=user,
            tenant=tenant,
            title=title,
            created_at__gte=five_min_ago,
        ).exists()

        if exists:
            continue

        try:
            UserNotification.objects.create(
                user=user,
                tenant=tenant,
                notification_type=config["notification_type"],
                title=title,
                message=message,
                priority=config["priority"],
                entity_type="inquiry",
                entity_id=inquiry.id if hasattr(inquiry, "id") else None,
                action_url=f"/inquiries/{inquiry.id}" if hasattr(inquiry, "id") else "",
                metadata={
                    "event": event.value,
                    "context": {k: str(v) for k, v in ctx.items()},
                },
            )
            result.notifications_created += 1
        except Exception as exc:
            logger.warning("Failed to create notification for %s: %s", user, exc)
            result.errors.append(str(exc))

        # Queue email if user preferences allow
        if _should_send_email(user=user, tenant=tenant, notification_type=config["notification_type"]):
            _queue_notification_email(
                user=user,
                tenant=tenant,
                title=title,
                message=message,
                action_url=f"/inquiries/{inquiry.id}" if hasattr(inquiry, "id") else "",
            )
            result.emails_queued += 1

    logger.info(
        "Process notification dispatched: event=%s, inquiry=%s, created=%d, emails=%d",
        event.value,
        _get_inquiry_number(inquiry),
        result.notifications_created,
        result.emails_queued,
    )
    return result


def _get_inquiry_number(inquiry: Any) -> str:
    """Get display number for an inquiry."""
    return getattr(inquiry, "inquiry_number", "") or str(getattr(inquiry, "id", ""))[:8]


def _resolve_target_users(
    *,
    tenant: Any,
    inquiry: Any,
    target_department: str | None,
    target_contact_type: str | None,
) -> list[Any]:
    """Resolve target users based on contact type and department."""
    try:
        from tenant_apps.contacts.models import Contact

        filters: dict[str, Any] = {"tenant": tenant, "status": "active"}

        # First try: contact linked to the inquiry's supplier/customer
        supplier = getattr(inquiry, "supplier", None)
        customer = getattr(inquiry, "customer", None)

        if supplier and target_contact_type:
            contacts = Contact.objects.filter(
                **filters,
                supplier=supplier,
                contact_type=target_contact_type,
            ).select_related("user")[:5]

            users = [c.user for c in contacts if getattr(c, "user", None)]
            if users:
                return users

        if customer and target_contact_type:
            contacts = Contact.objects.filter(
                **filters,
                customer=customer,
                contact_type=target_contact_type,
            ).select_related("user")[:5]

            users = [c.user for c in contacts if getattr(c, "user", None)]
            if users:
                return users

        # Fallback: any contact with matching department
        if target_department:
            contacts = Contact.objects.filter(
                **filters,
                department=target_department,
            ).select_related("user")[:5]

            users = [c.user for c in contacts if getattr(c, "user", None)]
            if users:
                return users

    except Exception:
        logger.debug("Contact resolution for notifications failed", exc_info=True)

    return []


def _should_send_email(*, user: Any, tenant: Any, notification_type: str) -> bool:
    """Check if user preferences allow email for this notification type."""
    try:
        prefs = UserNotificationPreferences.objects.filter(
            user=user, tenant=tenant
        ).first()

        if not prefs:
            return True  # Default: send emails

        return prefs.should_notify(notification_type, "email")
    except Exception:
        return True  # Default: send on error


def _queue_notification_email(
    *,
    user: Any,
    tenant: Any,
    title: str,
    message: str,
    action_url: str,
) -> None:
    """Queue a notification email via the existing email service."""
    try:
        from apps.integrations.tasks import send_email_task

        email = getattr(user, "email", None)
        if not email:
            return

        send_email_task.delay(
            to_email=email,
            subject=f"[ProjectMeats] {title}",
            body=message,
            tenant_id=str(tenant.id),
            metadata={"notification": True, "action_url": action_url},
        )
    except Exception:
        logger.debug("Failed to queue notification email", exc_info=True)
