"""Preview the Golden Schema ETL contract for GA-01.1.

This command is intentionally non-mutating in GA-01.1. It validates the batch
manifest, resolves the target tenant, and prints the deterministic contract that
GA-01.2 will extend into a journal-backed dry-run engine.
"""

from __future__ import annotations

import json
from typing import Any

from django.core.management.base import BaseCommand, CommandError

from apps.core.services.etl import (
    BATCH_JOURNAL_FIELDS,
    ERROR_REPORT_FIELDS,
    build_contract_preview,
    load_batch_manifest,
    resolve_manifest_tenant,
    validate_batch_manifest,
)


class Command(BaseCommand):
    help = "Preview the Golden Schema ETL contract without importing any rows."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--manifest",
            required=True,
            help="Path to the ETL batch manifest JSON file.",
        )
        parser.add_argument(
            "--format",
            choices=("text", "json"),
            default="text",
            help="Render the contract preview as human-readable text or JSON.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        try:
            payload = load_batch_manifest(options["manifest"])
            manifest = validate_batch_manifest(payload)
            tenant = resolve_manifest_tenant(manifest)
            preview = build_contract_preview(manifest, resolved_tenant=tenant)
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            raise CommandError(str(exc)) from exc

        if options["format"] == "json":
            self.stdout.write(json.dumps(preview, indent=2, sort_keys=True))
            return

        self.stdout.write(self.style.MIGRATE_HEADING("Golden Schema ETL Contract Preview"))
        self.stdout.write(f"Batch: {preview['batch_name']}")
        self.stdout.write(f"Tenant: {preview['tenant_slug']} ({preview['tenant_id']})")
        self.stdout.write(f"Source system: {preview['source_system']}")
        self.stdout.write("")
        self.stdout.write(self.style.WARNING("Execution order (deterministic; no writes enabled):"))
        for position, entity_summary in enumerate(preview["entity_summaries"], start=1):
            source_descriptions = []
            for source in entity_summary["sources"]:
                sheet_suffix = f"#{source['sheet']}" if source["sheet"] else ""
                source_descriptions.append(f"{source['path']} ({source['format']}{sheet_suffix})")
            joined_sources = ", ".join(source_descriptions) or "no source declared"
            self.stdout.write(
                f"  {position}. {entity_summary['entity']} -> {entity_summary['target_model']} :: {joined_sources}"
            )

        self.stdout.write("")
        self.stdout.write(self.style.WARNING("Side effects to suppress when execute mode lands:"))
        for rule in preview["side_effects_suppressed"]:
            self.stdout.write(f"  - {rule}")

        self.stdout.write("")
        self.stdout.write(self.style.WARNING("Import journal contract (GA-01.2):"))
        self.stdout.write(f"  - {', '.join(BATCH_JOURNAL_FIELDS)}")
        self.stdout.write(self.style.WARNING("Error report contract (GA-01.2):"))
        self.stdout.write(f"  - {', '.join(ERROR_REPORT_FIELDS)}")
