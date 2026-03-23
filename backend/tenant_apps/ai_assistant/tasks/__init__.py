"""AI Assistant Celery tasks.

Phase 8.0: PM-AS (Multi-Agent Swarm) + RLHF flywheel scaffolding.

NOTE: This module is safe to import even when optional AI integrations are not configured.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import timedelta
from typing import Any, Dict, List

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)

# Expose auto-tuner task for Celery autodiscovery
from .auto_tuner import orchestrate_rlhf_finetuning  # noqa: F401


SYSTEM_PROMPT = (
    'You are a data extraction specialist for a wholesale meat logistics platform. '
    'Given an AI-extracted payload from an inbound document, return the corrected, normalized JSON.'
)


@shared_task(name='ai_assistant.process_rlhf_flywheel')
def process_rlhf_flywheel(days: int = 7, limit: int = 5000, out_path: str | None = None) -> Dict[str, Any]:
    """Nightly RLHF flywheel aggregation.

    Aggregates recent *resolved* `AIFeedbackLog` rows and writes an OpenAI chat
    fine-tuning JSONL file to disk for later upload.

    This task is tenant-safe (never crosses tenant boundaries in a single record)
    and intentionally does not initiate any fine-tune jobs.

    Args:
        days: Lookback window for feedback logs.
        limit: Maximum number of records to export.
        out_path: Optional output path for the JSONL file.

    Returns:
        Summary dict with counts and output path.
    """

    try:
        from tenant_apps.ai_assistant.models import AIFeedbackLog

        since = timezone.now() - timedelta(days=int(days))
        qs = (
            AIFeedbackLog.objects.filter(created_on__gte=since, resolved_by__isnull=False)
            .exclude(user_corrected_data={})
            .only(
                'tenant_id',
                'document_id',
                'document_type',
                'confidence_score',
                'original_extracted_data',
                'user_corrected_data',
            )
            .order_by('created_on')
        )

        total = qs.count()

        if not out_path:
            ts = timezone.now().strftime('%Y%m%d_%H%M%S')
            out_path = f"/tmp/projectmeats_rlhf_flywheel_{ts}.jsonl"

        os.makedirs(os.path.dirname(out_path), exist_ok=True)

        written = 0
        preview: List[str] = []

        with open(out_path, 'w', encoding='utf-8') as f:
            for row in qs[: int(limit)]:
                # Redaction baseline: do not emit tenant-identifying IDs into the export.
                user_payload = {
                    'document_type': row.document_type,
                    'confidence_score': float(row.confidence_score or 0.0),
                    'original_extracted_data': row.original_extracted_data or {},
                }

                assistant_payload = row.user_corrected_data or {}

                record = {
                    'messages': [
                        {'role': 'system', 'content': SYSTEM_PROMPT},
                        {'role': 'user', 'content': json.dumps(user_payload, ensure_ascii=False)},
                        {'role': 'assistant', 'content': json.dumps(assistant_payload, ensure_ascii=False)},
                    ]
                }

                line = json.dumps(record, ensure_ascii=False)
                f.write(line + '\n')

                if len(preview) < 3:
                    preview.append(line)

                written += 1

        logger.info('[RLHF] Exported %s/%s resolved feedback logs to %s', written, total, out_path)

        return {
            'status': 'ok',
            'lookback_days': int(days),
            'total_resolved_feedback_logs': total,
            'written': written,
            'out_path': out_path,
            'preview': preview,
        }

    except Exception as e:
        logger.warning('[RLHF] Flywheel task failed: %s', str(e), exc_info=True)
        return {'status': 'error', 'error': str(e)}
