"""Export RLHF feedback into OpenAI fine-tuning JSONL format.

Writes a JSONL artifact to Django storage (or --out storage path) for later upload.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from tenant_apps.ai_assistant.services.rlhf_compiler import CompileOptions, write_compiled_jsonl


class Command(BaseCommand):
    help = "Export AIFeedbackLog rows into OpenAI JSONL fine-tuning format"

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=30)
        parser.add_argument('--limit', type=int, default=5000)
        parser.add_argument('--tenant-id', type=str, default=None)
        parser.add_argument('--out', type=str, default=None)

    def handle(self, *args, **options):
        summary = write_compiled_jsonl(
            options=CompileOptions(
                days=int(options['days']),
                limit=int(options['limit']),
                tenant_id=options.get('tenant_id') or None,
                out_path=options.get('out') or None,
            )
        )
        self.stdout.write(self.style.SUCCESS(f"Wrote {summary['written']} records to {summary['out_path']}"))
