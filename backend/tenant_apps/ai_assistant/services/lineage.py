from __future__ import annotations

from typing import Any


def create_lineage_event(
    *,
    tenant: Any,
    event_type: str,
    source_type: str = "",
    source_id: str | None = None,
    target_type: str = "",
    target_id: str | None = None,
    summary: str = "",
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
        source_type=source_type or "",
        source_id=str(source_id or ""),
        target_type=target_type or "",
        target_id=str(target_id or ""),
        summary=summary or "",
        metadata=metadata or {},
    )


def get_document_lineage_summary(document: Any, *, limit: int = 3) -> dict[str, Any] | None:
    from tenant_apps.ai_assistant.models import AILineageEvent

    if document is None or getattr(document, "id", None) is None or getattr(document, "tenant_id", None) is None:
        return None

    events = list(
        AILineageEvent.objects.filter(
            tenant_id=document.tenant_id,
            document_id=document.id,
        )
        .order_by("-created_on")
        .only("event_type", "summary", "created_on", "source_type", "target_type")[:limit]
    )
    if not events:
        return None

    total_events = AILineageEvent.objects.filter(
        tenant_id=document.tenant_id,
        document_id=document.id,
    ).count()
    latest = events[0]

    return {
        "event_count": int(total_events),
        "latest_event_type": latest.event_type,
        "latest_summary": latest.summary,
        "latest_created_on": latest.created_on.isoformat() if getattr(latest, "created_on", None) else "",
        "recent_events": [
            {
                "event_type": event.event_type,
                "summary": event.summary,
                "created_on": event.created_on.isoformat() if getattr(event, "created_on", None) else "",
                "source_type": event.source_type,
                "target_type": event.target_type,
            }
            for event in events
        ],
    }
