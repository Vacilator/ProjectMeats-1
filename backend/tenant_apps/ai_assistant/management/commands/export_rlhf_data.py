"""Export RLHF feedback into OpenAI fine-tuning JSONL format.

Writes a JSONL file to /tmp (or --out path) for later upload.

Each line uses OpenAI chat fine-tuning shape:
{
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
"""

from __future__ import annotations

import json
import os
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone


SYSTEM_PROMPT = (
    "You are a data extraction specialist for a wholesale meat logistics platform. "
    "Given an AI-extracted payload from an inbound document, return the corrected, normalized JSON."
)


class Command(BaseCommand):
    help = "Export AIFeedbackLog rows into OpenAI JSONL fine-tuning format"

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=30)
        parser.add_argument('--limit', type=int, default=5000)
        parser.add_argument('--tenant-id', type=str, default=None)
        parser.add_argument('--out', type=str, default=None)

    def handle(self, *args, **options):
        from tenant_apps.ai_assistant.models import AIFeedbackLog

        days = int(options['days'])
        limit = int(options['limit'])
        tenant_id = options.get('tenant_id')

        since = timezone.now() - timedelta(days=days)
        qs = (
            AIFeedbackLog.objects.filter(created_on__gte=since, resolved_by__isnull=False)
            .exclude(user_corrected_data={})
            .order_by('created_on')
        )
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)

        qs = qs.only(
            'tenant_id',
            'document_id',
            'document_type',
            'confidence_score',
            'original_extracted_data',
            'user_corrected_data',
        )

        out_path = options.get('out')
        if not out_path:
            ts = timezone.now().strftime('%Y%m%d_%H%M%S')
            out_path = f"/tmp/projectmeats_rlhf_{ts}.jsonl"

        os.makedirs(os.path.dirname(out_path), exist_ok=True)

        written = 0
        with open(out_path, 'w', encoding='utf-8') as f:
            for row in qs[:limit]:
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

                f.write(json.dumps(record, ensure_ascii=False) + '\n')
                written += 1

        self.stdout.write(self.style.SUCCESS(f"Wrote {written} records to {out_path}"))
