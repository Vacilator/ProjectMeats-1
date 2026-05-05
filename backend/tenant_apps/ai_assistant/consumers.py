from __future__ import annotations

import re

from channels.generic.websocket import AsyncJsonWebsocketConsumer


def _sanitize_group_component(value: str) -> str:
    return re.sub(r'[^a-zA-Z0-9_-]', '_', str(value or ''))


class AIInboxConsumer(AsyncJsonWebsocketConsumer):
    group_name: str

    async def connect(self):
        user = self.scope.get('user')
        tenant = self.scope.get('tenant')

        if not user or not getattr(user, 'is_authenticated', False):
            await self.close(code=4401)
            return

        if not tenant:
            await self.close(code=4403)
            return

        self.group_name = (
            f"ai-inbox__{_sanitize_group_component(getattr(tenant, 'id', ''))}"
            f"__{_sanitize_group_component(getattr(user, 'id', ''))}"
        )
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({'type': 'ai.inbox.connected'})

    async def disconnect(self, close_code: int):
        if getattr(self, 'group_name', None):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def ai_inbox_message(self, event: dict):
        await self.send_json({'type': 'ai.inbox.notification', **(event.get('payload') or {})})
