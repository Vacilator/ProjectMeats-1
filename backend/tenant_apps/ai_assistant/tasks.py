"""AI Assistant Celery tasks.

Phase 8.0: PM-AS (Multi-Agent Swarm) + RLHF flywheel scaffolding.

NOTE: This module is safe to import even when optional AI integrations are not configured.
"""

from __future__ import annotations

import json
import logging
from datetime import timedelta
from typing import Any, Dict, List

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name='ai_assistant.process_rlhf_flywheel')
def process_rlhf_flywheel(days: int = 7) -> Dict[str, Any]:
    """Nightly RLHF flywheel aggregation.

    Aggregates recent `AIFeedbackLog` rows and formats them into a JSONL-style
    instruction dataset for future fine-tuning of local enrichment models.

    This is scaffold-only: it currently returns a summary and *does not* write files
    or initiate any fine-tune jobs.

    Args:
        days: Lookback window for feedback logs.

    Returns:
        Summary dict with counts and a small sample.
    """

    try:
        from tenant_apps.ai_assistant.models import AIFeedbackLog

        since = timezone.now() - timedelta(days=int(days))
        qs = (
            AIFeedbackLog.objects.filter(created_on__gte=since)
            .only('tenant_id', 'document_id', 'document_type', 'confidence_score', 'original_extracted_data', 'user_corrected_data')
            .order_by('-created_on')
        )

        count = qs.count()
        sample_rows = list(qs[:25])

        # JSONL instruction format (placeholder)
        jsonl: List[str] = []
        for row in sample_rows:
            record = {
                'tenant_id': str(row.tenant_id),
                'document_id': str(row.document_id),
                'document_type': row.document_type,
                'confidence_score': float(row.confidence_score or 0.0),
                'input': row.original_extracted_data or {},
                'output': row.user_corrected_data or {},
                'metadata': {
                    'source': 'rlhf_flywheel',
                },
            }
            jsonl.append(json.dumps(record, ensure_ascii=False))

        logger.info('[RLHF] Aggregated %s feedback logs (sample=%s)', count, len(sample_rows))

        return {
            'status': 'ok',
            'lookback_days': int(days),
            'total_feedback_logs': count,
            'sample_jsonl_count': len(jsonl),
            'sample_jsonl_preview': jsonl[:3],
        }

    except Exception as e:
        logger.warning('[RLHF] Flywheel task failed: %s', str(e), exc_info=True)
        return {'status': 'error', 'error': str(e)}
