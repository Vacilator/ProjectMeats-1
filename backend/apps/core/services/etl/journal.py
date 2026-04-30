"""Persistence helpers for the Golden Schema ETL dry-run journal."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from django.utils import timezone

from apps.core.models import ETLImportBatch, ETLImportRowJournal


def checksum_manifest_payload(payload: dict[str, Any]) -> str:
    """Create a stable checksum for the manifest payload."""

    encoded = json.dumps(payload, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(encoded).hexdigest()


def build_command_options(
    *,
    entity: str | None = None,
    limit: int | None = None,
    output_format: str = 'text',
    apply: bool = False,
    execution_mode: str = 'dry_run',
    actor_user_id: int | None = None,
    actor_email: str = '',
) -> dict[str, Any]:
    """Return the ETL-relevant command options stored with the batch."""

    return {
        'entity': entity,
        'limit': limit,
        'format': output_format,
        'apply': apply,
        'execution_mode': execution_mode,
        'actor_user_id': actor_user_id,
        'actor_email': actor_email,
    }


def build_run_key(
    *,
    tenant_id: str,
    manifest_checksum: str,
    command_options: dict[str, Any],
    mode: str = ETLImportBatch.Mode.DRY_RUN,
) -> str:
    """Build a deterministic tenant-scoped ETL run key."""

    encoded = json.dumps(
        {
            'tenant_id': str(tenant_id),
            'manifest_checksum': manifest_checksum,
            'command_options': command_options,
            'mode': mode,
        },
        sort_keys=True,
        separators=(',', ':'),
    ).encode('utf-8')
    return hashlib.sha256(encoded).hexdigest()


def get_or_start_batch(
    *,
    tenant,
    manifest_payload: dict[str, Any],
    manifest_checksum: str,
    command_options: dict[str, Any],
    mode: str = ETLImportBatch.Mode.DRY_RUN,
):
    """Create or reuse a restart-safe ETL batch."""

    run_key = build_run_key(
        tenant_id=str(tenant.id),
        manifest_checksum=manifest_checksum,
        command_options=command_options,
        mode=mode,
    )
    now = timezone.now()
    batch, created = ETLImportBatch.objects.get_or_create(
        tenant=tenant,
        run_key=run_key,
        defaults={
            'mode': mode,
            'status': ETLImportBatch.Status.RUNNING,
            'source_manifest': manifest_payload,
            'manifest_checksum': manifest_checksum,
            'command_options': command_options,
            'started_at': now,
            'last_checkpoint_at': now,
        },
    )
    if not created:
        batch.mode = mode
        batch.status = ETLImportBatch.Status.RUNNING
        batch.source_manifest = manifest_payload
        batch.manifest_checksum = manifest_checksum
        batch.command_options = command_options
        batch.failure_message = ''
        batch.started_at = batch.started_at or now
        batch.completed_at = None
        batch.last_checkpoint_at = now
        batch.save(
            update_fields=[
                'mode',
                'status',
                'source_manifest',
                'manifest_checksum',
                'command_options',
                'failure_message',
                'started_at',
                'completed_at',
                'last_checkpoint_at',
                'modified_on',
            ]
        )
    return batch, created


def upsert_row_journal(*, batch: ETLImportBatch, tenant, row_result: dict[str, Any]) -> ETLImportRowJournal:
    """Insert or update one row-level dry-run journal record."""

    source_sheet = row_result.get('source_sheet') or ''
    journal, _ = ETLImportRowJournal.objects.update_or_create(
        tenant=tenant,
        batch=batch,
        entity=row_result['entity'],
        source_path=row_result['source_path'],
        source_sheet=source_sheet,
        source_row_number=row_result['source_row_number'],
        defaults={
            'source_identifier': row_result.get('source_identifier', ''),
            'normalized_lookup_key': row_result.get('normalized_lookup_key', ''),
            'row_fingerprint': row_result.get('row_fingerprint', ''),
            'planned_action': row_result['planned_action'],
            'target_model': row_result.get('target_model', ''),
            'target_identifier': row_result.get('target_identifier', ''),
            'status': row_result.get('status', ETLImportRowJournal.Status.PLANNED),
            'error_code': row_result.get('error_code', ''),
            'error_message': row_result.get('error_message', ''),
            'side_effects_suppressed': row_result.get('side_effects_suppressed', []),
            'raw_payload': row_result.get('raw_payload', {}),
            'normalized_payload': row_result.get('normalized_payload', {}),
            'warnings': row_result.get('warnings', []),
        },
    )
    return journal


def finalize_batch(
    *,
    batch: ETLImportBatch,
    summary: dict[str, Any],
    resume_cursor: dict[str, Any],
    status: str,
    failure_message: str = '',
) -> ETLImportBatch:
    """Persist the final dry-run batch summary."""

    batch.summary = summary
    batch.resume_cursor = resume_cursor
    batch.status = status
    batch.failure_message = failure_message
    batch.completed_at = timezone.now()
    batch.last_checkpoint_at = batch.completed_at
    batch.total_rows = int(summary.get('total_rows', 0))
    batch.processed_rows = int(summary.get('processed_rows', 0))
    batch.would_create_count = int(summary.get('would_create_count', 0))
    batch.would_update_count = int(summary.get('would_update_count', 0))
    batch.would_skip_count = int(summary.get('would_skip_count', 0))
    batch.error_count = int(summary.get('error_count', 0))
    batch.save(
        update_fields=[
            'summary',
            'resume_cursor',
            'status',
            'failure_message',
            'completed_at',
            'last_checkpoint_at',
            'total_rows',
            'processed_rows',
            'would_create_count',
            'would_update_count',
            'would_skip_count',
            'error_count',
            'modified_on',
        ]
    )
    return batch
