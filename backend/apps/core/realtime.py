from __future__ import annotations

from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def get_tenant_mutation_group_name(tenant_id: Any) -> str:
    tenant_part = str(tenant_id or '').replace('-', '_')
    return f'tenant-mutations__{tenant_part}'


def build_mutation_payload(*, instance: Any, action: str, created: bool | None = None) -> dict[str, Any] | None:
    tenant_id = getattr(instance, 'tenant_id', None)
    instance_id = getattr(instance, 'pk', None)
    if not tenant_id or instance_id is None:
        return None

    related_entity_type = getattr(instance, 'entity_type', '')
    related_entity_id = getattr(instance, 'entity_id', None)
    if related_entity_id is not None:
        related_entity_id = str(related_entity_id)

    return {
        'action': action,
        'tenant_id': str(tenant_id),
        'entity_type': instance._meta.model_name,
        'entity_app': instance._meta.app_label,
        'entity_label': instance._meta.label_lower,
        'id': str(instance_id),
        'created': bool(created),
        'is_deleted': bool(getattr(instance, 'is_deleted', False)),
        'related_entity_type': str(related_entity_type or ''),
        'related_entity_id': related_entity_id or '',
    }


def broadcast_tenant_mutation(*, instance: Any, action: str, created: bool | None = None) -> None:
    payload = build_mutation_payload(instance=instance, action=action, created=created)
    if not payload:
        return

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        get_tenant_mutation_group_name(payload['tenant_id']),
        {
            'type': 'mutation.message',
            'payload': payload,
        },
    )
