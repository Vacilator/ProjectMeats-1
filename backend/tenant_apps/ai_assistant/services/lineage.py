from __future__ import annotations

from typing import Any


def create_lineage_event(
    *,
    tenant: Any,
    event_type: str,
    source_type: str = '',
    source_id: str | None = None,
    target_type: str = '',
    target_id: str | None = None,
    summary: str = '',
    document: Any = None,
    run: Any = None,
    task: Any = None,
    approval: Any = None,
    metadata: dict[str, Any] | None = None,
):
    from tenant_apps.ai_assistant.models import AILineageEvent

    return AILineageEvent.objects.create(
        tenant=tenant,
        document=document,
        run=run,
        task=task,
        approval=approval,
        event_type=event_type,
        source_type=source_type or '',
        source_id=str(source_id or ''),
        target_type=target_type or '',
        target_id=str(target_id or ''),
        summary=summary or '',
        metadata=metadata or {},
    )
