"""RLHF dataset compilation utilities.

Compiles `AIFeedbackLog` rows into OpenAI chat fine-tuning JSONL, with a
redaction layer to strip PII/secrets and tenant-identifying fields.

This module is intentionally dependency-light so it can run in management
commands and Celery tasks.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, Optional, Tuple

from django.utils import timezone


DEFAULT_SYSTEM_PROMPT = (
    "You are a data extraction specialist for a wholesale meat logistics platform. "
    "Given an AI-extracted payload from an inbound document, return the corrected, normalized JSON."
)


_EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)

# Broad phone-number-ish matching (keeps it simple; errs on redacting rather than leaking).
_PHONE_RE = re.compile(
    r"(?:(?:\+?\d{1,3}[\s\-\.])?(?:\(?\d{3}\)?)[\s\-\.]?\d{3}[\s\-\.]?\d{4})"
)

# Common secret/token patterns.
_OPENAI_KEY_RE = re.compile(r"\bsk-[A-Za-z0-9]{10,}\b")
_BEARER_RE = re.compile(r"\bBearer\s+[A-Za-z0-9\-\._~\+/]+=*\b", re.IGNORECASE)
_GENERIC_TOKEN_RE = re.compile(r"\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*\S+\b", re.IGNORECASE)


def redact_text(value: str) -> str:
    """Redact obvious PII/secrets from a string."""

    if not value:
        return value

    redacted = value
    redacted = _EMAIL_RE.sub("[REDACTED_EMAIL]", redacted)
    redacted = _PHONE_RE.sub("[REDACTED_PHONE]", redacted)
    redacted = _OPENAI_KEY_RE.sub("[REDACTED_KEY]", redacted)
    redacted = _BEARER_RE.sub("Bearer [REDACTED_TOKEN]", redacted)
    redacted = _GENERIC_TOKEN_RE.sub("[REDACTED_SECRET]", redacted)
    return redacted


def deep_redact(obj: Any) -> Any:
    """Recursively redact strings inside nested lists/dicts."""

    if obj is None:
        return None

    if isinstance(obj, str):
        return redact_text(obj)

    if isinstance(obj, list):
        return [deep_redact(v) for v in obj]

    if isinstance(obj, tuple):
        return [deep_redact(v) for v in obj]

    if isinstance(obj, dict):
        # Preserve keys as-is; redact values.
        return {str(k): deep_redact(v) for k, v in obj.items()}

    return obj


@dataclass(frozen=True)
class CompileOptions:
    days: int = 30
    """Lookback window in days (ignored when `since` is provided)."""

    since: Optional[datetime] = None
    """Explicit lower-bound datetime for `created_on` filtering."""

    limit: int = 5000
    tenant_id: Optional[str] = None
    out_path: Optional[str] = None
    system_prompt: str = DEFAULT_SYSTEM_PROMPT


def _default_out_path(options: CompileOptions, prefix: str = 'projectmeats_rlhf_compiled') -> str:
    # Deterministic name per day/window so repeated runs overwrite (idempotent).
    day = timezone.now().strftime('%Y%m%d')
    tenant_part = (options.tenant_id or 'all').replace('-', '')[:12]
    window_part = (
        f"since{options.since.strftime('%Y%m%dT%H%M%S')}" if options.since else f"{int(options.days)}d"
    )
    return f"/tmp/{prefix}_{day}_{tenant_part}_{window_part}.jsonl"


def compile_feedback_logs_to_jsonl_lines(*, options: CompileOptions) -> Tuple[int, Iterable[str]]:
    """Compile feedback logs into JSONL lines.

    Returns:
        (total_count, lines_iterable)
    """

    from tenant_apps.ai_assistant.models import AIFeedbackLog

    since = options.since or (timezone.now() - timedelta(days=int(options.days)))

    qs = AIFeedbackLog.objects.filter(created_on__gte=since).order_by('created_on', 'id')
    if options.tenant_id:
        qs = qs.filter(tenant_id=options.tenant_id)

    qs = qs.only(
        'document_type',
        'confidence_score',
        'original_extracted_data',
        'user_corrected_data',
        'created_on',
    )

    def iter_lines() -> Iterable[str]:
        for row in qs[: int(options.limit)]:
            # Tenant/document IDs are intentionally excluded.
            user_payload: Dict[str, Any] = {
                'document_type': row.document_type,
                'confidence_score': float(row.confidence_score or 0.0),
                'original_extracted_data': deep_redact(row.original_extracted_data or {}),
            }
            assistant_payload: Dict[str, Any] = deep_redact(row.user_corrected_data or {})

            record = {
                'messages': [
                    {'role': 'system', 'content': options.system_prompt},
                    {'role': 'user', 'content': json.dumps(user_payload, ensure_ascii=False)},
                    {'role': 'assistant', 'content': json.dumps(assistant_payload, ensure_ascii=False)},
                ]
            }

            yield json.dumps(record, ensure_ascii=False)

    return qs.count(), iter_lines()


def write_compiled_jsonl(*, options: CompileOptions) -> Dict[str, Any]:
    """Write compiled JSONL to disk and return a small summary."""

    out_path = options.out_path or _default_out_path(options)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    total_count, lines = compile_feedback_logs_to_jsonl_lines(options=options)

    written = 0
    with open(out_path, 'w', encoding='utf-8') as f:
        for line in lines:
            f.write(line + '\n')
            written += 1

    return {
        'status': 'ok',
        'lookback_days': int(options.days),
        'total_feedback_logs': int(total_count),
        'written': int(written),
        'out_path': out_path,
    }
