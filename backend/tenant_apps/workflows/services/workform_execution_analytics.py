from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.db.models import Avg, Count, Max, Q
from django.utils import timezone

from tenant_apps.workflows.models import ExecutionEventLog, TenantWorkFormExecution

from apps.tenants.models import Tenant


def _node_labels_for_workforms(workform_ids: list[str], *, tenant: Tenant) -> dict[str, dict[str, str]]:
    from apps.system.models import TenantWorkForm

    labels: dict[str, dict[str, str]] = {}
    workforms = TenantWorkForm.objects.filter(id__in=workform_ids, tenant=tenant).only("id", "workflow_definition")
    for workform in workforms:
        definition = workform.workflow_definition if isinstance(workform.workflow_definition, dict) else {}
        nodes = definition.get("nodes", [])
        if not isinstance(nodes, list):
            continue

        labels[str(workform.id)] = {}
        for node in nodes:
            if not isinstance(node, dict):
                continue
            node_id = node.get("id")
            if not node_id:
                continue
            data = node.get("data") if isinstance(node.get("data"), dict) else {}
            label = (
                data.get("label")
                or data.get("name")
                or data.get("containerName")
                or node.get("label")
                or node.get("name")
            )
            if isinstance(label, str) and label.strip():
                labels[str(workform.id)][str(node_id)] = label.strip()

    return labels


def get_workform_execution_analytics(*, tenant: Tenant, days: int = 30, limit: int = 5) -> dict[str, Any]:
    window_days = max(int(days or 30), 1)
    item_limit = max(int(limit or 5), 1)
    cutoff = timezone.now() - timedelta(days=window_days)

    execution_qs = TenantWorkFormExecution.objects.filter(tenant=tenant, created_on__gte=cutoff)
    event_qs = ExecutionEventLog.objects.filter(tenant=tenant, created_on__gte=cutoff)

    total_runs = execution_qs.count()
    status_rows = execution_qs.values("status").annotate(count=Count("id")).order_by()
    status_counts = {str(row["status"]): int(row["count"]) for row in status_rows}

    terminal_total = sum(status_counts.get(status, 0) for status in ("completed", "failed", "cancelled", "suspended"))
    success_rate = round((status_counts.get("completed", 0) / terminal_total) * 100, 1) if terminal_total else 0.0

    duration_rows = (
        execution_qs.exclude(started_at__isnull=True)
        .exclude(completed_at__isnull=True)
        .values_list(
            "started_at",
            "completed_at",
        )
    )
    durations_ms = [
        max(int((completed_at - started_at).total_seconds() * 1000), 0) for started_at, completed_at in duration_rows
    ]
    avg_duration_ms = int(sum(durations_ms) / len(durations_ms)) if durations_ms else None

    workform_rows = list(
        execution_qs.values("workform_id", "workform__name")
        .annotate(
            total_runs=Count("id"),
            completed_runs=Count("id", filter=Q(status="completed")),
            failed_runs=Count("id", filter=Q(status__in=["failed", "cancelled", "suspended"])),
        )
        .order_by("-total_runs", "workform__name")[:item_limit]
    )
    for row in workform_rows:
        total = int(row["total_runs"] or 0)
        completed = int(row["completed_runs"] or 0)
        row["workform_id"] = str(row.pop("workform_id"))
        row["workform_name"] = row.pop("workform__name")
        row["success_rate"] = round((completed / total) * 100, 1) if total else 0.0

    failure_rows = list(
        event_qs.filter(status="failed")
        .exclude(node_id="")
        .values("workform_id", "workform__name", "node_id", "node_type")
        .annotate(failure_count=Count("id"), last_failed_at=Max("completed_at"))
        .order_by("-failure_count", "-last_failed_at", "workform__name", "node_id")[:item_limit]
    )

    slow_rows = list(
        event_qs.filter(event_type="action_success", duration_ms__isnull=False)
        .exclude(node_id="")
        .values("workform_id", "workform__name", "node_id", "node_type")
        .annotate(
            avg_duration_ms=Avg("duration_ms"),
            max_duration_ms=Max("duration_ms"),
            sample_count=Count("id"),
        )
        .order_by("-avg_duration_ms", "-max_duration_ms", "workform__name", "node_id")[:item_limit]
    )

    label_maps = _node_labels_for_workforms(
        list({str(row["workform_id"]) for row in [*failure_rows, *slow_rows] if row.get("workform_id")}),
        tenant=tenant,
    )

    for row in failure_rows:
        workform_id = str(row["workform_id"])
        node_id = str(row["node_id"])
        row["workform_id"] = workform_id
        row["workform_name"] = row.pop("workform__name")
        row["node_label"] = label_maps.get(workform_id, {}).get(node_id)
        if row.get("last_failed_at"):
            row["last_failed_at"] = row["last_failed_at"].isoformat()

    for row in slow_rows:
        workform_id = str(row["workform_id"])
        node_id = str(row["node_id"])
        row["workform_id"] = workform_id
        row["workform_name"] = row.pop("workform__name")
        row["node_label"] = label_maps.get(workform_id, {}).get(node_id)
        if row.get("avg_duration_ms") is not None:
            row["avg_duration_ms"] = int(row["avg_duration_ms"])
        if row.get("max_duration_ms") is not None:
            row["max_duration_ms"] = int(row["max_duration_ms"])

    return {
        "window_days": window_days,
        "generated_at": timezone.now().isoformat(),
        "summary": {
            "total_runs": total_runs,
            "active_runs": status_counts.get("pending", 0) + status_counts.get("in_progress", 0),
            "completed_runs": status_counts.get("completed", 0),
            "failed_runs": status_counts.get("failed", 0),
            "suspended_runs": status_counts.get("suspended", 0),
            "success_rate": success_rate,
            "avg_duration_ms": avg_duration_ms,
        },
        "status_counts": status_counts,
        "top_workforms": workform_rows,
        "top_failed_nodes": failure_rows,
        "slowest_actions": slow_rows,
    }
