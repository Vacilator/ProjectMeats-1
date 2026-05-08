from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from tenant_apps.workflows.models import (
    ExecutionEventLog,
    ExecutionEventLogStatus,
    TenantWorkFormExecution,
    TenantWorkFormExecutionStatus,
)

EVENT_STATUS_MAP: dict[str, str] = {
    "execution_start": ExecutionEventLogStatus.STARTED,
    "node_enter": ExecutionEventLogStatus.STARTED,
    "action_start": ExecutionEventLogStatus.STARTED,
    "parallel_deferred": ExecutionEventLogStatus.STARTED,
    "action_success": ExecutionEventLogStatus.SUCCESS,
    "loop_enqueued": ExecutionEventLogStatus.SUCCESS,
    "node_terminal": ExecutionEventLogStatus.SUCCESS,
    "execution_complete": ExecutionEventLogStatus.SUCCESS,
    "action_error": ExecutionEventLogStatus.FAILED,
}

FINAL_EXECUTION_NODE_STATUS: dict[str, str] = {
    TenantWorkFormExecutionStatus.COMPLETED: "completed",
    TenantWorkFormExecutionStatus.FAILED: "failed",
    TenantWorkFormExecutionStatus.CANCELLED: "failed",
    TenantWorkFormExecutionStatus.SUSPENDED: "suspended",
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


def _node_labels_map(execution: TenantWorkFormExecution) -> dict[str, str]:
    definition = getattr(getattr(execution, "workform", None), "workflow_definition", None) or {}
    nodes = definition.get("nodes", []) if isinstance(definition, dict) else []

    labels: dict[str, str] = {}
    if not isinstance(nodes, list):
        return labels

    for node in nodes:
        if not isinstance(node, dict):
            continue

        node_id = node.get("id")
        if not node_id:
            continue

        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        label = (
            data.get("label") or data.get("name") or data.get("containerName") or node.get("label") or node.get("name")
        )
        if isinstance(label, str) and label.strip():
            labels[str(node_id)] = label.strip()

    return labels


def _normalize_runtime_event_rows(
    execution: TenantWorkFormExecution, *, rows: Iterable[Any] | None = None
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []

    if rows is None:
        persisted_rows = list(ExecutionEventLog.objects.filter(workform_execution=execution).order_by("sequence"))
        if persisted_rows:
            rows = persisted_rows
        else:
            rows = execution.audit_trail if isinstance(execution.audit_trail, list) else []

    for index, row in enumerate(rows):
        if isinstance(row, ExecutionEventLog):
            event_ts = row.completed_at or row.started_at
            normalized.append(
                {
                    "sequence": int(row.sequence),
                    "event_type": str(row.event_type or "unknown"),
                    "status": str(row.status or ExecutionEventLogStatus.INFO),
                    "node_id": str(row.node_id or ""),
                    "node_type": str(row.node_type or ""),
                    "timestamp": event_ts,
                    "payload": dict(row.payload or {}),
                }
            )
            continue

        if not isinstance(row, dict):
            continue

        event_type = str(row.get("event") or row.get("event_type") or "unknown").strip() or "unknown"
        payload = {
            key: value for key, value in row.items() if key not in {"ts", "event", "event_type", "node_id", "node_type"}
        }
        normalized.append(
            {
                "sequence": index,
                "event_type": event_type,
                "status": EVENT_STATUS_MAP.get(event_type, ExecutionEventLogStatus.INFO),
                "node_id": str(row.get("node_id") or ""),
                "node_type": str(row.get("node_type") or ""),
                "timestamp": _parse_event_timestamp(row.get("ts")),
                "payload": payload,
            }
        )

    normalized.sort(key=lambda item: int(item.get("sequence", 0)))
    return normalized


def persist_execution_event_logs(execution: TenantWorkFormExecution) -> list[ExecutionEventLog]:
    """Persist normalized telemetry rows from the execution audit trail."""

    trail = execution.audit_trail if isinstance(execution.audit_trail, list) else []

    ExecutionEventLog.objects.filter(workform_execution=execution).delete()

    active_spans: dict[str, datetime] = {}
    rows: list[ExecutionEventLog] = []

    for index, raw_event in enumerate(trail):
        if not isinstance(raw_event, dict):
            continue

        event_type = str(raw_event.get("event") or "unknown").strip() or "unknown"
        node_id = str(raw_event.get("node_id") or "")
        node_type = str(raw_event.get("node_type") or "")
        event_ts = _parse_event_timestamp(raw_event.get("ts"))
        span_key = f'{event_type}:{node_id or "execution"}'

        if event_type in {"execution_start", "node_enter", "action_start"}:
            active_spans[span_key] = event_ts

        started_at = event_ts
        completed_at = None
        duration_ms = None

        if event_type == "action_success":
            started_at = active_spans.pop(f'action_start:{node_id or "execution"}', event_ts)
            completed_at = event_ts
        elif event_type == "action_error":
            started_at = active_spans.pop(f'action_start:{node_id or "execution"}', event_ts)
            completed_at = event_ts
        elif event_type == "execution_complete":
            started_at = active_spans.pop("execution_start:execution", event_ts)
            completed_at = event_ts

        if completed_at is not None:
            duration_ms = max(int((completed_at - started_at).total_seconds() * 1000), 0)

        payload = {key: value for key, value in raw_event.items() if key not in {"ts", "event", "node_id", "node_type"}}

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

    return rows


def build_execution_runtime_state(
    execution: TenantWorkFormExecution,
    *,
    rows: Iterable[Any] | None = None,
) -> dict[str, Any]:
    """Build a compact execution state snapshot from telemetry rows."""

    labels = _node_labels_map(execution)
    normalized_rows = _normalize_runtime_event_rows(execution, rows=rows)

    node_statuses: dict[str, str] = {}
    errors: list[dict[str, Any]] = []
    event_counts = {
        "started": 0,
        "success": 0,
        "failed": 0,
        "info": 0,
    }

    current_node_id: str | None = None
    current_node_type: str | None = None
    last_event: str | None = None
    last_event_at: str | None = None

    active_node_id: str | None = None

    ctx = execution.context_data if isinstance(execution.context_data, dict) else {}
    ctx_errors = ctx.get("errors")
    if isinstance(ctx_errors, list):
        for row in ctx_errors:
            if not isinstance(row, dict) or not row.get("error"):
                continue
            node_id = str(row.get("node_id") or "")
            errors.append(
                {
                    "node_id": node_id or None,
                    "node_type": row.get("node_type"),
                    "node_label": labels.get(node_id) if node_id else None,
                    "error": row.get("error"),
                    "routed_to": row.get("routed_to"),
                    "ts": row.get("ts"),
                }
            )

    for row in normalized_rows:
        event_type = str(row.get("event_type") or "unknown")
        event_status = str(row.get("status") or ExecutionEventLogStatus.INFO)
        node_id = str(row.get("node_id") or "")
        node_type = str(row.get("node_type") or "")
        payload = dict(row.get("payload") or {})
        ts = _parse_event_timestamp(row.get("timestamp"))

        if event_status in event_counts:
            event_counts[event_status] += 1

        last_event = event_type
        last_event_at = ts.isoformat()

        if event_type == "node_enter":
            if active_node_id and active_node_id != node_id and node_statuses.get(active_node_id) == "in_progress":
                node_statuses[active_node_id] = "completed"
            if node_id:
                node_statuses[node_id] = "in_progress"
                active_node_id = node_id
                current_node_id = node_id
                current_node_type = node_type or current_node_type
            continue

        if event_type in {"action_start", "parallel_deferred"}:
            if node_id:
                node_statuses[node_id] = "in_progress"
                active_node_id = node_id
                current_node_id = node_id
                current_node_type = node_type or current_node_type
            continue

        if event_type in {"action_success", "node_terminal", "loop_enqueued"}:
            if node_id:
                node_statuses[node_id] = "completed"
                active_node_id = node_id
                current_node_id = node_id
                current_node_type = node_type or current_node_type
            continue

        if event_type == "action_error":
            if node_id:
                node_statuses[node_id] = "failed"
                active_node_id = node_id
                current_node_id = node_id
                current_node_type = node_type or current_node_type

            errors.append(
                {
                    "node_id": node_id or None,
                    "node_type": node_type or None,
                    "node_label": labels.get(node_id) if node_id else None,
                    "error": payload.get("error") or payload.get("detail") or payload.get("message") or "Action failed",
                    "routed_to": payload.get("routed_to"),
                    "ts": ts.isoformat(),
                }
            )

    if active_node_id and node_statuses.get(active_node_id) == "in_progress":
        final_status = FINAL_EXECUTION_NODE_STATUS.get(str(execution.status or ""))
        if final_status:
            node_statuses[active_node_id] = final_status

    deduped_errors: list[dict[str, Any]] = []
    seen_errors: set[tuple[Any, Any, Any]] = set()
    for row in errors:
        key = (row.get("node_id"), row.get("error"), row.get("ts"))
        if key in seen_errors:
            continue
        seen_errors.add(key)
        deduped_errors.append(row)

    return {
        "version": 1,
        "execution_status": execution.status,
        "event_count": len(normalized_rows),
        "event_counts": event_counts,
        "node_statuses": node_statuses,
        "current_node_id": current_node_id,
        "current_node_type": current_node_type,
        "current_node_label": labels.get(current_node_id) if current_node_id else None,
        "last_event": last_event,
        "last_event_at": last_event_at,
        "errors": deduped_errors,
        "hydrated_at": timezone.now().isoformat(),
    }


def sync_execution_telemetry(execution: TenantWorkFormExecution) -> dict[str, Any]:
    """Persist telemetry rows and hydrate the execution runtime_state snapshot."""

    rows = persist_execution_event_logs(execution)
    runtime_state = build_execution_runtime_state(execution, rows=rows)
    execution.runtime_state = runtime_state
    execution.save(update_fields=["runtime_state"])
    return runtime_state
