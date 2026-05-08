"""Dry-run engine for Golden Schema ETL batches."""

from __future__ import annotations

import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from django.utils.module_loading import import_string

from apps.core.models import ETLImportBatch, ETLImportRowJournal

from .contracts import ENTITY_CONTRACTS, SIDE_EFFECT_SUPPRESSION_RULES, BatchManifest, build_contract_preview
from .journal import (
    build_command_options,
    checksum_manifest_payload,
    finalize_batch,
    get_or_start_batch,
    upsert_row_journal,
)
from .runtime import LoadedSourceRow, load_source_rows


def execute_dry_run(
    manifest: BatchManifest,
    *,
    manifest_payload: dict[str, Any],
    manifest_path: str | Path,
    resolved_tenant,
    entity: str | None = None,
    limit: int | None = None,
    output_format: str = "text",
) -> dict[str, Any]:
    """Execute the restart-safe dry-run ETL journal flow."""

    manifest_dir = Path(manifest_path).resolve().parent
    command_options = build_command_options(
        entity=entity,
        limit=limit,
        output_format=output_format,
        execution_mode=ETLImportBatch.Mode.DRY_RUN,
    )
    manifest_checksum = checksum_manifest_payload(manifest_payload)
    batch, created = get_or_start_batch(
        tenant=resolved_tenant,
        manifest_payload=manifest_payload,
        manifest_checksum=manifest_checksum,
        command_options=command_options,
        mode=ETLImportBatch.Mode.DRY_RUN,
    )
    preview = build_contract_preview(manifest, resolved_tenant=resolved_tenant)

    try:
        summary, entity_summaries, processed_rows, resume_cursor = _process_manifest(
            manifest,
            manifest_dir=manifest_dir,
            resolved_tenant=resolved_tenant,
            batch=batch,
            entity_filter=entity,
            limit=limit,
        )
        finalize_batch(
            batch=batch,
            summary=summary,
            resume_cursor=resume_cursor,
            status=ETLImportBatch.Status.COMPLETED,
        )
    except Exception as exc:
        finalize_batch(
            batch=batch,
            summary={},
            resume_cursor={},
            status=ETLImportBatch.Status.FAILED,
            failure_message=str(exc),
        )
        raise

    preview.update(
        {
            "batch_run": {
                "batch_id": str(batch.id),
                "run_key": batch.run_key,
                "created": created,
                "status": batch.status,
                "mode": batch.mode,
                "manifest_checksum": manifest_checksum,
                "command_options": command_options,
                "summary": summary,
                "resume_cursor": resume_cursor,
            },
            "entity_results": entity_summaries,
            "row_journal_count": processed_rows,
        }
    )
    return preview


def _process_manifest(
    manifest: BatchManifest,
    *,
    manifest_dir: Path,
    resolved_tenant,
    batch: ETLImportBatch,
    entity_filter: str | None,
    limit: int | None,
) -> tuple[dict[str, Any], list[dict[str, Any]], int, dict[str, Any]]:
    counters = Counter()
    entity_counts: dict[str, Counter] = defaultdict(Counter)
    resume_cursor: dict[str, Any] = {}
    processed_rows = 0

    selected_entities = {entity_filter} if entity_filter else set(manifest.ordered_entities())
    if entity_filter and entity_filter not in ENTITY_CONTRACTS:
        raise ValueError(f"Unknown entity filter '{entity_filter}'.")

    for source in manifest.sources:
        if source.entity not in selected_entities:
            continue

        loaded_rows = load_source_rows(source, manifest_dir=manifest_dir)
        for loaded_row in loaded_rows:
            if limit is not None and processed_rows >= int(limit):
                break

            row_result = _classify_row(loaded_row, tenant=resolved_tenant)
            upsert_row_journal(batch=batch, tenant=resolved_tenant, row_result=row_result)

            planned_action = row_result["planned_action"]
            counters["total_rows"] += 1
            counters["processed_rows"] += 1
            counters[planned_action] += 1
            entity_counts[row_result["entity"]]["rows"] += 1
            entity_counts[row_result["entity"]][planned_action] += 1

            processed_rows += 1
            resume_cursor = {
                "entity": row_result["entity"],
                "source_path": row_result["source_path"],
                "source_sheet": row_result["source_sheet"],
                "source_row_number": row_result["source_row_number"],
            }

        if limit is not None and processed_rows >= int(limit):
            break

    summary = {
        "total_rows": counters["total_rows"],
        "processed_rows": counters["processed_rows"],
        "would_create_count": counters[ETLImportRowJournal.PlannedAction.WOULD_CREATE],
        "would_update_count": counters[ETLImportRowJournal.PlannedAction.WOULD_UPDATE],
        "would_skip_count": counters[ETLImportRowJournal.PlannedAction.WOULD_SKIP],
        "error_count": counters[ETLImportRowJournal.PlannedAction.ERROR],
    }
    entity_summaries = [
        {
            "entity": entity_name,
            "row_count": counter["rows"],
            "would_create_count": counter[ETLImportRowJournal.PlannedAction.WOULD_CREATE],
            "would_update_count": counter[ETLImportRowJournal.PlannedAction.WOULD_UPDATE],
            "would_skip_count": counter[ETLImportRowJournal.PlannedAction.WOULD_SKIP],
            "error_count": counter[ETLImportRowJournal.PlannedAction.ERROR],
        }
        for entity_name, counter in entity_counts.items()
    ]
    return summary, entity_summaries, processed_rows, resume_cursor


def _classify_row(loaded_row: LoadedSourceRow, *, tenant) -> dict[str, Any]:
    contract = ENTITY_CONTRACTS[loaded_row.entity]
    normalized_payload = _normalize_payload(loaded_row.payload)
    source_identifier = _build_source_identifier(contract, normalized_payload)
    row_fingerprint = _build_row_fingerprint(loaded_row.entity, loaded_row.source_path, loaded_row.payload)
    warnings: list[str] = []

    if not source_identifier:
        return _build_error_result(
            loaded_row,
            contract=contract,
            normalized_payload=normalized_payload,
            row_fingerprint=row_fingerprint,
            error_code="missing_natural_key",
            error_message="Row is missing the canonical natural-key fields required for dry-run matching.",
            warnings=warnings,
        )

    target_model = _resolve_target_model(contract.target_model)
    matched_instance = _match_existing_instance(
        target_model=target_model,
        contract=contract,
        normalized_payload=normalized_payload,
        tenant_id=str(tenant.id),
        warnings=warnings,
    )

    if matched_instance is None:
        planned_action = ETLImportRowJournal.PlannedAction.WOULD_CREATE
        target_identifier = ""
    else:
        target_identifier = str(matched_instance.pk)
        if _instance_differs(matched_instance, normalized_payload):
            planned_action = ETLImportRowJournal.PlannedAction.WOULD_UPDATE
        else:
            planned_action = ETLImportRowJournal.PlannedAction.WOULD_SKIP

    return {
        "entity": loaded_row.entity,
        "source_path": loaded_row.source_path,
        "source_sheet": loaded_row.source_sheet or "",
        "source_row_number": loaded_row.source_row_number,
        "source_identifier": source_identifier,
        "normalized_lookup_key": source_identifier,
        "row_fingerprint": row_fingerprint,
        "planned_action": planned_action,
        "target_model": contract.target_model,
        "target_identifier": target_identifier,
        "status": ETLImportRowJournal.Status.PLANNED,
        "error_code": "",
        "error_message": "",
        "side_effects_suppressed": list(SIDE_EFFECT_SUPPRESSION_RULES),
        "raw_payload": loaded_row.payload,
        "normalized_payload": normalized_payload,
        "warnings": warnings,
    }


def _build_error_result(
    loaded_row: LoadedSourceRow,
    *,
    contract,
    normalized_payload: dict[str, Any],
    row_fingerprint: str,
    error_code: str,
    error_message: str,
    warnings: list[str],
) -> dict[str, Any]:
    return {
        "entity": loaded_row.entity,
        "source_path": loaded_row.source_path,
        "source_sheet": loaded_row.source_sheet or "",
        "source_row_number": loaded_row.source_row_number,
        "source_identifier": "",
        "normalized_lookup_key": "",
        "row_fingerprint": row_fingerprint,
        "planned_action": ETLImportRowJournal.PlannedAction.ERROR,
        "target_model": contract.target_model,
        "target_identifier": "",
        "status": ETLImportRowJournal.Status.ERROR,
        "error_code": error_code,
        "error_message": error_message,
        "side_effects_suppressed": list(SIDE_EFFECT_SUPPRESSION_RULES),
        "raw_payload": loaded_row.payload,
        "normalized_payload": normalized_payload,
        "warnings": warnings,
    }


def _normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {str(key): _normalize_value(value) for key, value in payload.items()}


def _normalize_value(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return value
    if isinstance(value, list):
        return [_normalize_value(item) for item in value]
    return str(value).strip()


def _build_source_identifier(contract, normalized_payload: dict[str, Any]) -> str:
    parts = []
    for field_name in contract.natural_keys:
        value = normalized_payload.get(field_name)
        if value not in (None, "", []):
            parts.append(f"{field_name}={value}")
    return "|".join(parts)


def _build_row_fingerprint(entity: str, source_path: str, payload: dict[str, Any]) -> str:
    encoded = json.dumps(
        {"entity": entity, "source_path": source_path, "payload": payload},
        sort_keys=True,
        default=str,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _resolve_target_model(target_model: str):
    return import_string(target_model)


def _match_existing_instance(
    *, target_model, contract, normalized_payload: dict[str, Any], tenant_id: str, warnings: list[str]
):
    filter_kwargs: dict[str, Any] = {"tenant_id": tenant_id}
    queryable_fields = []

    for field_name in contract.natural_keys:
        if field_name not in normalized_payload or normalized_payload[field_name] in (None, "", []):
            continue
        if not _model_has_field(target_model, field_name):
            continue
        filter_kwargs[field_name] = normalized_payload[field_name]
        queryable_fields.append(field_name)

    if not queryable_fields:
        warnings.append("matching_strategy_pending")
        return None

    return target_model.objects.filter(**filter_kwargs).order_by("pk").first()


def _instance_differs(instance, normalized_payload: dict[str, Any]) -> bool:
    comparable_fields = [
        field_name for field_name in normalized_payload if _model_has_field(instance.__class__, field_name)
    ]
    if not comparable_fields:
        return False

    for field_name in comparable_fields:
        instance_value = getattr(instance, field_name, "")
        if _normalize_value(instance_value) != normalized_payload[field_name]:
            return True
    return False


def _model_has_field(model_class, field_name: str) -> bool:
    try:
        model_class._meta.get_field(field_name)
        return True
    except Exception:
        return False
