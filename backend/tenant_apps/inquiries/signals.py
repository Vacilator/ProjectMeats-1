"""Signal handlers for Inquiry activity, alerts, and review queue wiring."""
import logging
import uuid

from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from tenant_apps.ai_assistant.models import AIFeedbackLog
from tenant_apps.workflows.models import NotificationPriority, NotificationType, UserNotification

from apps.tenants.models import TenantUser

from .models import Inquiry, InquiryProduct

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=Inquiry)
def track_inquiry_state_change(sender, instance, **kwargs):
    """Track state changes before save."""
    if instance.pk:
        try:
            old_instance = Inquiry.objects.get(pk=instance.pk)
            instance._old_status = old_instance.status
            instance._old_route_decision = old_instance.route_decision
        except Inquiry.DoesNotExist:
            instance._old_status = None
            instance._old_route_decision = None
    else:
        instance._old_status = None
        instance._old_route_decision = None


def _inquiry_feedback_document_id(instance: Inquiry) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"tenant_apps.inquiries.Inquiry:{instance.pk}")


def _inquiry_review_target_url(instance: Inquiry) -> str:
    return f"/inquiries?review=inquiry&inquiry={instance.pk}"


def _build_inquiry_review_payload(instance: Inquiry, *, created: bool, route_changed: bool) -> dict:
    entity_name = instance.customer.name if instance.customer else instance.supplier.name if instance.supplier else ""
    event = "created" if created else "route_updated" if route_changed else "updated"

    return {
        "inquiry_id": instance.pk,
        "inquiry_number": instance.inquiry_number,
        "route_decision": instance.route_decision,
        "route_label": instance.get_route_decision_display() if instance.route_decision else "",
        "status": instance.status,
        "entity_type": instance.entity_type,
        "entity_name": entity_name,
        "contact_name": instance.contact_name or "",
        "source_type": instance.source_type,
        "source_email_message_id": instance.source_email_message_id,
        "source_email_thread_id": instance.source_email_thread_id,
        "review_target_url": _inquiry_review_target_url(instance),
        "document_type": "inquiry",
        "intent": "inquiry_review",
        "event": event,
    }


def _select_inquiry_review_recipients(instance: Inquiry):
    memberships = (
        TenantUser.objects.select_related("user")
        .filter(tenant=instance.tenant, is_active=True)
        .exclude(user__isnull=True)
    )
    recipients = []
    for membership in memberships:
        user = membership.user
        if not user:
            continue
        if user.is_superuser or user.is_staff or membership.role in {"owner", "admin", "manager"}:
            recipients.append(user)
    return recipients


def _enqueue_inquiry_review_alert(instance: Inquiry, *, created: bool, route_changed: bool) -> None:
    payload = _build_inquiry_review_payload(instance, created=created, route_changed=route_changed)
    route_label = payload.get("route_label") or "Pending route"
    review_target_url = str(payload["review_target_url"])

    AIFeedbackLog.objects.update_or_create(
        tenant=instance.tenant,
        document_id=_inquiry_feedback_document_id(instance),
        defaults={
            "document_type": "inquiry",
            "original_extracted_data": payload,
            "confidence_score": 1.0,
            "resolved_by": None,
        },
    )

    recipients = _select_inquiry_review_recipients(instance)
    if not recipients:
        return

    if created:
        title = f"Action required: {instance.inquiry_number}"
        message = f"New inquiry requires review ({route_label})."
    else:
        title = f"Inquiry rerouted: {instance.inquiry_number}"
        message = f"Inquiry route changed and requires review ({route_label})."

    notifications = [
        UserNotification(
            tenant=instance.tenant,
            user=user,
            notification_type=NotificationType.SYSTEM,
            priority=NotificationPriority.HIGH,
            title=title,
            message=message,
            entity_type="inquiry",
            entity_id=None,
            action_url=review_target_url,
            metadata=payload,
        )
        for user in recipients
    ]
    UserNotification.objects.bulk_create(notifications)


@receiver(post_save, sender=Inquiry)
def log_inquiry_activity(sender, instance, created, **kwargs):
    """Log inquiry creation and status changes to activity log."""
    from tenant_apps.cockpit.models import ActivityLog

    if created:
        # Log inquiry creation
        entity_type = instance.entity_type
        entity_id = instance.supplier_id if instance.supplier else instance.customer_id

        if entity_id:
            ActivityLog.objects.create(
                tenant=instance.tenant,
                entity_type=entity_type,
                entity_id=entity_id,
                title=f"New Inquiry: {instance.inquiry_number}",
                content=f"Inquiry created from {instance.get_source_type_display()}. Contact: {instance.contact_name or 'N/A'}",
                created_by=instance.created_by,
            )

        # Also log to contact if present
        if instance.contact_id:
            ActivityLog.objects.create(
                tenant=instance.tenant,
                entity_type="contact",
                entity_id=instance.contact_id,
                title=f"New Inquiry: {instance.inquiry_number}",
                content=f"Inquiry created with this contact",
                created_by=instance.created_by,
            )

    else:
        # Check for status changes
        old_status = getattr(instance, "_old_status", None)
        if old_status and old_status != instance.status:
            entity_type = instance.entity_type
            entity_id = instance.supplier_id if instance.supplier else instance.customer_id

            if entity_id:
                ActivityLog.objects.create(
                    tenant=instance.tenant,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    title=f"Inquiry Status: {instance.inquiry_number}",
                    content=f"Status changed from {old_status} to {instance.status}",
                    created_by=None,  # Could be system or user
                )

            # Auto-create follow-up call when status changes to 'quoted'
            if instance.status == "quoted" and old_status != "quoted":

                def _deferred_followup():
                    try:
                        from .services.auto_followup import create_followup_call

                        call = create_followup_call(instance, created_by=instance.created_by)
                        if call:
                            logger.info(
                                "[Inquiry:%s] Auto-created follow-up call scheduled=%s",
                                instance.inquiry_number,
                                call.scheduled_for,
                            )
                    except Exception as e:
                        logger.error(
                            "[Inquiry:%s] Failed to create follow-up call: %s",
                            instance.inquiry_number,
                            str(e),
                            exc_info=True,
                        )

                transaction.on_commit(_deferred_followup)

    old_route_decision = getattr(instance, "_old_route_decision", None)
    route_changed = bool(instance.route_decision and old_route_decision != instance.route_decision)
    if created or route_changed:
        transaction.on_commit(
            lambda: _enqueue_inquiry_review_alert(
                instance,
                created=created,
                route_changed=route_changed,
            )
        )


@receiver(post_save, sender=InquiryProduct)
def log_inquiry_product_activity(sender, instance, created, **kwargs):
    """Log when products are added to an inquiry."""
    from tenant_apps.cockpit.models import ActivityLog

    if created:
        inquiry = instance.inquiry
        entity_type = inquiry.entity_type
        entity_id = inquiry.supplier_id if inquiry.supplier else inquiry.customer_id

        if entity_id:
            product_name = (
                (getattr(instance.product, "name", "") or getattr(instance.product, "product_code", "") or "Product")
            )[:50]
            ActivityLog.objects.create(
                tenant=inquiry.tenant,
                entity_type=entity_type,
                entity_id=entity_id,
                title=f"Product Added: {inquiry.inquiry_number}",
                content=f"Added product: {product_name} (Qty: {instance.quantity})",
                created_by=None,
            )
