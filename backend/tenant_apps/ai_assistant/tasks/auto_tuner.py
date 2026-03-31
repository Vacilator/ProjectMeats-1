"""Auto-tuner Celery tasks.

Scaffold: orchestration of RLHF fine-tuning and automatic model pivot.

This is intentionally minimal. Once the OpenAI fine-tuning workflow is wired
(end-to-end JSONL upload + job creation + polling), the only required side
-effect is updating SystemConfiguration.active_openai_model_id.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(name='ai_assistant.orchestrate_rlhf_finetuning')
def orchestrate_rlhf_finetuning(
    *,
    jsonl_path: str,
    suffix: str = 'pm-rlhf',
) -> Dict[str, Any]:
    """Orchestrate RLHF fine-tuning and pivot the active model.

    Args:
        jsonl_path: Local path (on the worker) to the prepared JSONL dataset.
        suffix: Optional name suffix for the fine-tune job.

    Returns:
        Dict with status and (when successful) the new fine-tuned model id.
    """

    openai_api_key = getattr(settings, 'OPENAI_API_KEY', None)
    if not openai_api_key:
        return {'status': 'skipped', 'error': 'OPENAI_API_KEY not configured'}

    new_fine_tuned_model_id: Optional[str] = None

    try:
        from openai import OpenAI

        OpenAI(
            api_key=openai_api_key,
            organization=getattr(settings, 'OPENAI_ORG_ID', None) or None,
        )

        # NOTE: The exact fine-tuning API wiring is environment-dependent and
        # will be filled in once the dataset format + job params are finalized.
        # This scaffold reserves the integration point.
        #
        # Expected flow:
        # 1) file = client.files.create(file=open(jsonl_path,'rb'), purpose='fine-tune')
        # 2) job = client.fine_tuning.jobs.create(training_file=file.id, model='gpt-4o-mini', suffix=suffix)
        # 3) poll until job.status == 'succeeded'
        # 4) new_fine_tuned_model_id = job.fine_tuned_model

        raise NotImplementedError('Fine-tuning orchestration not yet wired')

    except NotImplementedError as e:
        logger.info('[AutoTuner] %s', str(e))
        return {'status': 'scaffold', 'detail': str(e)}

    except Exception as e:
        logger.warning('[AutoTuner] Fine-tune orchestration failed: %s', str(e), exc_info=True)
        return {'status': 'error', 'error': str(e)}

    if not new_fine_tuned_model_id:
        return {'status': 'error', 'error': 'Fine-tune completed but no model id returned'}

    from apps.system.models import SystemConfiguration

    SystemConfiguration.objects.update_or_create(
        defaults={"active_openai_model_id": new_fine_tuned_model_id}
    )

    return {'status': 'ok', 'active_openai_model_id': new_fine_tuned_model_id}
