from __future__ import annotations

import time
from typing import Any

from channels.generic.websocket import AsyncJsonWebsocketConsumer


class EntityMutationConsumer(AsyncJsonWebsocketConsumer):
    """Tenant-scoped websocket channel for entity mutation notifications."""

    group_name: str
    tenant_id: str
    _last_seen: float

    async def connect(self):
        user = self.scope.get('user')
        if not user or not getattr(user, 'is_authenticated', False):
            await self.close(code=4401)
            return

        tenant = self.scope.get('tenant')
        if not tenant:
            await self.close(code=4403)
            return

        self.tenant_id = str(tenant.id)
        self.group_name = f'tenant-mutations__{self.tenant_id.replace("-", "_")}'
        self._last_seen = time.monotonic()

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json(
            {
                'type': 'subscription.ready',
                'tenant_id': self.tenant_id,
            }
        )

    async def disconnect(self, close_code: int):
        if getattr(self, 'group_name', None):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content: Any, **kwargs: Any):
        self._last_seen = time.monotonic()
        msg_type = (content or {}).get('type')
        if msg_type == 'ping':
            await self.send_json({'type': 'pong', 'timestamp': int(time.time() * 1000)})

    async def mutation_message(self, event: dict[str, Any]):
        await self.send_json({'type': 'entity.mutation', **event.get('payload', {})})
