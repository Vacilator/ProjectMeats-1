from __future__ import annotations

from datetime import datetime
from typing import Any

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from tenant_apps.workflows.models import ExecutionEventLog, ExecutionEventLogStatus, TenantWorkFormExecution

EVENT_STATUS_MAP: dict[str, str] = {
    'execution_start': ExecutionEventLogStatus.STARTED,
    'node_enter': ExecutionEventLogStatus.STARTED,
    'action_start': ExecutionEventLogStatus.STARTED,
    'parallel_deferred': ExecutionEventLogStatus.STARTED,
    'action_success': ExecutionEventLogStatus.SUCCESS,
    'loop_enqueued': ExecutionEventLogStatus.SUCCESS,
    'node_terminal': ExecutionEventLogStatus.SUCCESS,
    'execution_complete': ExecutionEventLogStatus.SUCCESS,
    'action_error': ExecutionEventLogStatus.FAILED,
}


def _parse_event_timestamp(value: Any) -> datetime:
    if isinstance(value, datetime):
        if timezone.is_naive(value):
            return timezone.make_aware(value, timezone.get_current_timezone())
        return value

    if isinstance(value, str):
        parsed = parse_datetime(value)
        if parsed is not None:
            if timezone.is_naive(parsed):
                return timezone.make_aware(parsed, timezone.get_current_timezone())
            return parsed

    return timezone.now()


def persist_execution_event_logs(execution: TenantWorkFormExecution) -> int:
    """Persist normalized telemetry rows from the execution audit trail."""

    trail = execution.audit_trail if isinstance(execution.audit_trail, list) else []

    ExecutionEventLog.objects.filter(workform_execution=execution).delete()

    active_spans: dict[str, datetime] = {}
    rows: list[ExecutionEventLog] = []

    for index, raw_event in enumerate(trail):
        if not isinstance(raw_event, dict):
            continue

        event_type = str(raw_event.get('event') or 'unknown').strip() or 'unknown'
        node_id = str(raw_event.get('node_id') or '')
        node_type = str(raw_event.get('node_type') or '')
        event_ts = _parse_event_timestamp(raw_event.get('ts'))
        span_key = f'{event_type}:{node_id or "execution"}'

        if event_type in {'execution_start', 'node_enter', 'action_start'}:
            active_spans[span_key] = event_ts

        started_at = event_ts
        completed_at = None
        duration_ms = None

        if event_type == 'action_success':
            started_at = active_spans.pop(f'action_start:{node_id or "execution"}', event_ts)
            completed_at = event_ts
        elif event_type == 'action_error':
            started_at = active_spans.pop(f'action_start:{node_id or "execution"}', event_ts)
            completed_at = event_ts
        elif event_type == 'execution_complete':
            started_at = active_spans.pop('execution_start:execution', event_ts)
            completed_at = event_ts

        if completed_at is not None:
            duration_ms = max(int((completed_at - started_at).total_seconds() * 1000), 0)

        payload = {
            key: value
            for key, value in raw_event.items()
            if key not in {'ts', 'event', 'node_id', 'node_type'}
        }

        rows.append(
            ExecutionEventLog(
                tenant=execution.tenant,
                workform=execution.workform,
                workform_execution=execution,
                sequence=index,
                event_type=event_type,
                status=EVENT_STATUS_MAP.get(event_type, ExecutionEventLogStatus.INFO),
                node_id=node_id,
                node_type=node_type,
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=duration_ms,
                payload=payload,
            )
        )

    if rows:
        ExecutionEventLog.objects.bulk_create(rows, batch_size=200)

    return len(rows)
