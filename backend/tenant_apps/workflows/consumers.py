"""WebSocket consumers for WorkForms real-time collaboration (Phase 7.3).

This is intentionally a minimal scaffold:
- Establishes a tenant-scoped collaboration group per workflow
- Provides basic ping/echo and broadcast plumbing

Any future database access MUST set tenant context and remain RLS-safe.
"""

from __future__ import annotations

import re
import uuid
from typing import Any
from urllib.parse import parse_qs

from channels.generic.websocket import AsyncJsonWebsocketConsumer


def _sanitize_group_component(val: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", val)


class WorkflowCollaborationConsumer(AsyncJsonWebsocketConsumer):
    """Tenant-scoped collaboration channel for a workflow editor session."""

    workflow_id: str
    tenant_id: str
    group_name: str

    async def connect(self):
        self.workflow_id = str(self.scope.get("url_route", {}).get("kwargs", {}).get("workflow_id", ""))

        query = parse_qs((self.scope.get("query_string") or b"").decode("utf-8"))
        tenant_id = (query.get("tenant_id") or query.get("tenantId") or [""])[0]

        # Require tenant id to prevent cross-tenant broadcast leakage.
        try:
            self.tenant_id = str(uuid.UUID(tenant_id))
        except Exception:
            await self.close(code=4400)
            return

        workflow_component = _sanitize_group_component(self.workflow_id)
        tenant_component = _sanitize_group_component(self.tenant_id)
        self.group_name = f"workflow-collab__{tenant_component}__{workflow_component}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.send_json(
            {
                "type": "presence.joined",
                "tenant_id": self.tenant_id,
                "workflow_id": self.workflow_id,
            }
        )

    async def disconnect(self, close_code: int):
        if getattr(self, "group_name", None):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content: Any, **kwargs: Any):
        msg_type = (content or {}).get("type")

        if msg_type == "ping":
            await self.send_json({"type": "pong"})
            return

        # Broadcast to other listeners in the same tenant+workflow group.
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "collab.message",
                "payload": content,
            },
        )

    async def collab_message(self, event: dict[str, Any]):
        await self.send_json({"type": "collab.message", **event})
