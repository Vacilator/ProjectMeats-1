from __future__ import annotations

import logging

from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .consumers import get_ai_inbox_group_name, get_ai_inbox_snapshot
from .models import AIFeedbackLog

logger = logging.getLogger(__name__)


def broadcast_ai_inbox_update(tenant_id: str) -> None:
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    try:
        snapshot = get_ai_inbox_snapshot(str(tenant_id))
        async_to_sync(channel_layer.group_send)(
            get_ai_inbox_group_name(str(tenant_id)),
            {
                "type": "ai.inbox.update",
                "pending_count": snapshot["pending_count"],
                "results": snapshot["results"],
            },
        )
    except Exception:
        logger.exception("[AI Inbox] Failed to broadcast update for tenant=%s", tenant_id)


@receiver(post_save, sender=AIFeedbackLog)
def broadcast_ai_inbox_on_save(sender, instance: AIFeedbackLog, **kwargs) -> None:
    tenant_id = getattr(instance, "tenant_id", None)
    if not tenant_id:
        return

    transaction.on_commit(lambda: broadcast_ai_inbox_update(str(tenant_id)))


@receiver(post_delete, sender=AIFeedbackLog)
def broadcast_ai_inbox_on_delete(sender, instance: AIFeedbackLog, **kwargs) -> None:
    tenant_id = getattr(instance, "tenant_id", None)
    if not tenant_id:
        return

    transaction.on_commit(lambda: broadcast_ai_inbox_update(str(tenant_id)))
