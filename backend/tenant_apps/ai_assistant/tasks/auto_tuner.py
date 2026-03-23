"""Auto-tuner Celery tasks (scaffold).

This exists to keep ai_assistant.tasks importable after converting tasks into a
package, and to provide the integration point for future RLHF fine-tuning.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(name='ai_assistant.orchestrate_rlhf_finetuning')
def orchestrate_rlhf_finetuning(*, jsonl_path: str, suffix: str = 'pm-rlhf') -> Dict[str, Any]:
    """Scaffold orchestration task.

    This PR only exports JSONL. Fine-tuning orchestration will be wired in a
    later PR.
    """

    if not getattr(settings, 'OPENAI_API_KEY', None):
        return {'status': 'skipped', 'error': 'OPENAI_API_KEY not configured'}

    logger.info('[AutoTuner] Scaffold only (jsonl_path=%s, suffix=%s)', jsonl_path, suffix)
    return {'status': 'scaffold'}
