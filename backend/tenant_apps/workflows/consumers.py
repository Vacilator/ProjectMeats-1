"""WebSocket consumers for WorkForms real-time collaboration (Phase 7.3).

This is intentionally a minimal scaffold:
- Establishes a tenant-scoped collaboration group per workflow
- Provides basic ping/echo and broadcast plumbing

Any future database access MUST set tenant context and remain RLS-safe.
"""

from __future__ import annotations

import asyncio
import re
import time
import uuid
from typing import Any

from channels.generic.websocket import AsyncJsonWebsocketConsumer


def _sanitize_group_component(val: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", val)


class WorkflowCollaborationConsumer(AsyncJsonWebsocketConsumer):
    """Tenant-scoped collaboration channel for a workflow editor session."""

    workflow_id: str
    tenant_id: str
    group_name: str

    _heartbeat_task: asyncio.Task | None = None
    _last_seen: float

    HEARTBEAT_INTERVAL_SECONDS = 20
    STALE_CONNECTION_SECONDS = 90

    async def connect(self):
        self.workflow_id = str(self.scope.get("url_route", {}).get("kwargs", {}).get("workflow_id", ""))

        user = self.scope.get("user")
        if not user or not getattr(user, "is_authenticated", False):
            await self.close(code=4401)
            return

        tenant = self.scope.get("tenant")
        if not tenant:
            await self.close(code=4403)
            return

        # Workflow IDs are UUIDs (TenantWorkForm IDs). Fail closed on invalid input.
        try:
            workflow_uuid = uuid.UUID(str(self.workflow_id))
        except Exception:
            await self.close(code=4400)
            return

        from django.db import connection

        from channels.db import database_sync_to_async

        @database_sync_to_async
        def _workflow_exists_for_tenant() -> bool:
            from apps.system.models import TenantWorkForm

            if connection.vendor == "postgresql":
                from apps.tenants.rls import set_current_tenant

                set_current_tenant(str(tenant.id))

            try:
                return TenantWorkForm.objects.filter(id=workflow_uuid, tenant_id=tenant.id).exists()
            finally:
                if connection.vendor == "postgresql":
                    with connection.cursor() as cursor:
                        cursor.execute("RESET app.current_tenant_id")
                        cursor.execute("RESET app.current_tenant")

        if not await _workflow_exists_for_tenant():
            await self.close(code=4404)
            return

        self.tenant_id = str(tenant.id)

        workflow_component = _sanitize_group_component(str(workflow_uuid))
        tenant_component = _sanitize_group_component(self.tenant_id)
        self.group_name = f"workflow-collab__{tenant_component}__{workflow_component}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Heartbeat: treat any client message as liveness (backward compatible with older clients).
        self._last_seen = time.monotonic()
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

        await self.send_json(
            {
                "type": "presence.joined",
                "tenant_id": self.tenant_id,
                "workflow_id": self.workflow_id,
            }
        )

    async def disconnect(self, close_code: int):
        if getattr(self, "_heartbeat_task", None):
            self._heartbeat_task.cancel()
            self._heartbeat_task = None

        if getattr(self, "group_name", None):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def _heartbeat_loop(self):
        """Send periodic pings and close stale connections.

        Note: we do NOT require pong for compatibility; any inbound client message updates _last_seen.
        """
        try:
            while True:
                await asyncio.sleep(self.HEARTBEAT_INTERVAL_SECONDS)

                # If we haven't heard from the client in a while, assume it's a zombie connection.
                if time.monotonic() - getattr(self, "_last_seen", 0.0) > self.STALE_CONNECTION_SECONDS:
                    await self.close(code=4408)
                    return

                await self.send_json({"type": "ping", "timestamp": int(time.time() * 1000)})
        except asyncio.CancelledError:
            return
        except Exception:
            # Never crash the consumer due to heartbeat issues.
            return

    async def receive_json(self, content: Any, **kwargs: Any):
        self._last_seen = time.monotonic()

        msg_type = (content or {}).get("type")

        if msg_type == "ping":
            await self.send_json({"type": "pong", "timestamp": int(time.time() * 1000)})
            return

        if msg_type == "pong":
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
