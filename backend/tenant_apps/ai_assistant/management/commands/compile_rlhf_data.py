"""Compile RLHF feedback logs into redacted OpenAI JSONL datasets.

This is a safer successor to `export_rlhf_data`:
- Excludes tenant/document IDs from the training payload.
- Recursively redacts obvious PII/secrets from extracted/corrected JSON.
- Writes deterministic JSONL suitable for OpenAI chat fine-tuning.

Output defaults to /tmp (or --out).
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from tenant_apps.ai_assistant.services.rlhf_compiler import CompileOptions, write_compiled_jsonl


class Command(BaseCommand):
    help = 'Compile AIFeedbackLog rows into redacted OpenAI JSONL fine-tuning format'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=30)
        parser.add_argument('--since', type=str, default=None, help='ISO-8601 datetime (overrides --days)')
        parser.add_argument('--limit', type=int, default=5000)
        parser.add_argument('--tenant-id', type=str, default=None)
        parser.add_argument('--out', type=str, default=None)

    def handle(self, *args, **options):
        since_raw = options.get('since')
        since_dt = parse_datetime(since_raw) if since_raw else None
        if since_raw and not since_dt:
            raise ValueError("Invalid --since datetime. Use ISO-8601, e.g. 2026-03-01T00:00:00Z")
        if since_dt and timezone.is_naive(since_dt):
            since_dt = timezone.make_aware(since_dt, timezone.get_current_timezone())

        summary = write_compiled_jsonl(
            options=CompileOptions(
                days=int(options['days']),
                since=since_dt,
                limit=int(options['limit']),
                tenant_id=options.get('tenant_id') or None,
                out_path=options.get('out') or None,
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Wrote {summary['written']} records (total={summary['total_feedback_logs']}) to {summary['out_path']}"
            )
        )
