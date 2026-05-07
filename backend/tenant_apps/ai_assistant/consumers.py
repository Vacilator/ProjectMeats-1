from __future__ import annotations

import re
from typing import Any

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.tenants.rls import reset_current_tenant, set_current_tenant
from .serializers import PendingReviewItemSerializer
from .views import build_pending_review_items, can_access_ai_review_queue


def _sanitize_group_component(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", str(value or ""))


def get_ai_inbox_group_name(tenant_id: str) -> str:
    return f"ai-inbox__{_sanitize_group_component(str(tenant_id))}"


def get_ai_inbox_snapshot(tenant_id: str) -> dict[str, Any]:
    from .models import AIFeedbackLog

    rls = set_current_tenant(str(tenant_id))
    if not rls.ok:
        return {"pending_count": 0, "results": []}

    try:
        results = PendingReviewItemSerializer(build_pending_review_items(tenant_id, limit=5), many=True).data
        pending_count = int(
            AIFeedbackLog.objects.filter(
                tenant_id=tenant_id,
                resolved_by__isnull=True,
            ).count()
        )
        return {"pending_count": pending_count, "results": results}
    finally:
        reset_current_tenant()


@database_sync_to_async
def load_ai_inbox_snapshot(tenant_id: str) -> dict[str, Any]:
    return get_ai_inbox_snapshot(tenant_id)


@database_sync_to_async
def load_ai_inbox_access(user, tenant) -> bool:
    return can_access_ai_review_queue(user=user, tenant=tenant)


class AIInboxConsumer(AsyncJsonWebsocketConsumer):
    tenant_id: str
    group_name: str | None = None
    has_queue_access: bool = False

    async def connect(self):
        user = self.scope.get("user")
        if not user or not getattr(user, "is_authenticated", False):
            await self.close(code=4401)
            return

        tenant = self.scope.get("tenant")
        if not tenant:
            await self.close(code=4403)
            return

        self.tenant_id = str(tenant.id)
        self.has_queue_access = await load_ai_inbox_access(user, tenant)

        if self.has_queue_access:
            self.group_name = get_ai_inbox_group_name(self.tenant_id)
            await self.channel_layer.group_add(self.group_name, self.channel_name)

        requested_subprotocols = {str(value) for value in (self.scope.get("subprotocols") or []) if value}
        accepted_subprotocol = "pm.ai.inbox" if "pm.ai.inbox" in requested_subprotocols else None
        if accepted_subprotocol:
            await self.accept(accepted_subprotocol)
        else:
            await self.accept()

        snapshot = (
            await load_ai_inbox_snapshot(self.tenant_id)
            if self.has_queue_access
            else {"pending_count": 0, "results": []}
        )
        await self.send_json({"type": "ai.inbox.snapshot", **snapshot})

    async def disconnect(self, close_code: int):
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content: Any, **kwargs: Any):
        message_type = str((content or {}).get("type") or "")
        if message_type == "ai.inbox.refresh" and self.has_queue_access:
            snapshot = await load_ai_inbox_snapshot(self.tenant_id)
            await self.send_json({"type": "ai.inbox.snapshot", **snapshot})
            return

        if message_type == "ping":
            await self.send_json({"type": "pong"})

    async def ai_inbox_update(self, event: dict[str, Any]):
        await self.send_json(
            {
                "type": "ai.inbox.update",
                "pending_count": int(event.get("pending_count") or 0),
                "results": event.get("results") or [],
            }
        )
