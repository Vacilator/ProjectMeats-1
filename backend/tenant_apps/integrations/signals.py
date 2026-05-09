from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone

from tenant_apps.purchase_orders.models import PurchaseOrder
from tenant_apps.workflows.models import FormSubmission, FormSubmissionStatus

from .models import TenantWebhook, TenantWebhookEventType
from .tasks import dispatch_webhook_payload

logger = logging.getLogger(__name__)


def _enqueue_event(*, tenant_id: str, event_type: str, payload: Dict[str, Any]) -> None:
    webhooks = TenantWebhook.objects.filter(
        tenant_id=tenant_id,
        is_active=True,
        event_type=event_type,
    ).only("id", "tenant_id", "event_type", "is_active", "target_url", "signing_secret")

    for webhook in webhooks:
        dispatch_webhook_payload.delay(webhook.id, tenant_id, event_type, payload)


def _serialize_purchase_order(po: PurchaseOrder) -> Dict[str, Any]:
    def _iso_date(value: Any) -> Optional[str]:
        if not value:
            return None
        # In post_save signals, DateFields may still be a raw string from assignment
        # (Django coerces for DB, but doesn't mutate the instance attribute).
        if hasattr(value, "isoformat"):
            return value.isoformat()
        if isinstance(value, str):
            return value
        return str(value)

    return {
        "id": po.id,
        "order_number": po.order_number,
        "status": po.status,
        "payment_status": po.payment_status,
        "total_amount": str(po.total_amount),
        "order_date": _iso_date(po.order_date),
        "delivery_date": _iso_date(po.delivery_date),
        "supplier_id": po.supplier_id,
        "product_id": po.product_id,
        "created_on": po.created_on.isoformat() if getattr(po, "created_on", None) else None,
    }


def _serialize_form_submission(sub: FormSubmission) -> Dict[str, Any]:
    return {
        "id": str(sub.id),
        "form_id": sub.form_id,
        "status": sub.status,
        "created_by_id": sub.created_by_id,
        "created_at": sub.created_at.isoformat() if sub.created_at else None,
        "completed_at": sub.completed_at.isoformat() if sub.completed_at else None,
    }


@receiver(post_save, sender=PurchaseOrder)
def purchase_order_created_webhook(sender, instance: PurchaseOrder, created: bool, **kwargs):
    if not created:
        return

    tenant_id = str(instance.tenant_id)
    payload = {
        "event_type": TenantWebhookEventType.PURCHASE_ORDER_CREATED,
        "occurred_at": timezone.now().isoformat(),
        "tenant_id": tenant_id,
        "data": _serialize_purchase_order(instance),
    }

    transaction.on_commit(
        lambda: _enqueue_event(
            tenant_id=tenant_id,
            event_type=TenantWebhookEventType.PURCHASE_ORDER_CREATED,
            payload=payload,
        )
    )


@receiver(pre_save, sender=FormSubmission)
def _cache_previous_form_submission_status(sender, instance: FormSubmission, **kwargs):
    if not instance.pk:
        instance._previous_status = None
        return

    try:
        instance._previous_status = FormSubmission.objects.only("status").get(pk=instance.pk).status
    except FormSubmission.DoesNotExist:
        instance._previous_status = None


@receiver(post_save, sender=FormSubmission)
def workform_completed_webhook(sender, instance: FormSubmission, created: bool, **kwargs):
    previous_status = getattr(instance, "_previous_status", None)

    if instance.status != FormSubmissionStatus.COMPLETED:
        return

    if previous_status == FormSubmissionStatus.COMPLETED:
        return

    tenant_id = str(instance.tenant_id)
    payload = {
        "event_type": TenantWebhookEventType.WORKFORM_COMPLETED,
        "occurred_at": timezone.now().isoformat(),
        "tenant_id": tenant_id,
        "data": _serialize_form_submission(instance),
    }

    transaction.on_commit(
        lambda: _enqueue_event(
            tenant_id=tenant_id,
            event_type=TenantWebhookEventType.WORKFORM_COMPLETED,
            payload=payload,
        )
    )
