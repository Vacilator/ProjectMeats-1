from __future__ import annotations

import re
from typing import Any

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.tenants.rls import reset_current_tenant, set_current_tenant


def _sanitize_group_component(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", value)


def get_ai_inbox_group_name(tenant_id: str) -> str:
    return f"ai-inbox__{_sanitize_group_component(str(tenant_id))}"


def get_ai_inbox_snapshot(tenant_id: str) -> dict[str, Any]:
    from .models import AIFeedbackLog

    rls = set_current_tenant(str(tenant_id))
    if not rls.ok:
        return {"pending_count": 0, "results": []}

    try:
        queryset = (
            AIFeedbackLog.objects.filter(
                tenant_id=tenant_id,
                resolved_by__isnull=True,
            )
            .order_by("-created_on")
        )

        results = [
            {
                "id": str(row.id),
                "document_id": str(row.document_id),
                "document_type": row.document_type,
                "confidence_score": float(row.confidence_score or 0.0),
            }
            for row in queryset[:5]
        ]

        return {"pending_count": int(queryset.count()), "results": results}
    finally:
        reset_current_tenant()


@database_sync_to_async
def load_ai_inbox_snapshot(tenant_id: str) -> dict[str, Any]:
    return get_ai_inbox_snapshot(tenant_id)


class AIInboxConsumer(AsyncJsonWebsocketConsumer):
    tenant_id: str
    group_name: str | None = None
    is_staff_member: bool = False

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
        self.is_staff_member = bool(getattr(user, "is_staff", False) or getattr(user, "is_superuser", False))

        if self.is_staff_member:
            self.group_name = get_ai_inbox_group_name(self.tenant_id)
            await self.channel_layer.group_add(self.group_name, self.channel_name)

        await self.accept()

        snapshot = (
            await load_ai_inbox_snapshot(self.tenant_id)
            if self.is_staff_member
            else {"pending_count": 0, "results": []}
        )
        await self.send_json({"type": "ai.inbox.snapshot", **snapshot})

    async def disconnect(self, close_code: int):
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content: Any, **kwargs: Any):
        message_type = str((content or {}).get("type") or "")
        if message_type == "ai.inbox.refresh" and self.is_staff_member:
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
