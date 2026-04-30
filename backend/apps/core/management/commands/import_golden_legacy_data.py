"""Run the Golden Schema ETL contract preview and dry-run journal flow.

This command remains non-mutating for business rows. In GA-01.2 it persists only
ETL journal tables so operators can inspect deterministic dry-run output before
GA-01.3 introduces write-capable import passes.
"""

from __future__ import annotations

import json
from typing import Any

from django.core.management.base import BaseCommand, CommandError

from apps.core.services.etl import (
    BATCH_JOURNAL_FIELDS,
    ERROR_REPORT_FIELDS,
    execute_dry_run,
    load_batch_manifest,
    resolve_manifest_tenant,
    validate_batch_manifest,
)
from apps.tenants.rls import tenant_rls


class Command(BaseCommand):
    help = "Preview and dry-run the Golden Schema ETL contract without importing business rows."

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
        parser.add_argument(
            "--entity",
            help="Optional entity slug to dry-run a single contract entity.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            help="Optional maximum number of source rows to journal in this dry run.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        try:
            payload = load_batch_manifest(options["manifest"])
            manifest = validate_batch_manifest(payload)
            tenant = resolve_manifest_tenant(manifest)
            with tenant_rls(str(tenant.id), strict=True):
                preview = execute_dry_run(
                    manifest,
                    manifest_payload=payload,
                    manifest_path=options["manifest"],
                    resolved_tenant=tenant,
                    entity=options.get("entity"),
                    limit=options.get("limit"),
                    output_format=options["format"],
                )
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            raise CommandError(str(exc)) from exc

        if options["format"] == "json":
            self.stdout.write(json.dumps(preview, indent=2, sort_keys=True))
            return

        batch_run = preview["batch_run"]

        self.stdout.write(self.style.MIGRATE_HEADING("Golden Schema ETL Dry Run"))
        self.stdout.write(f"Batch: {preview['batch_name']}")
        self.stdout.write(f"Tenant: {preview['tenant_slug']} ({preview['tenant_id']})")
        self.stdout.write(f"Source system: {preview['source_system']}")
        self.stdout.write(f"Batch run id: {batch_run['batch_id']}")
        self.stdout.write(f"Run key: {batch_run['run_key']}")
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
        self.stdout.write("")
        self.stdout.write(self.style.WARNING("Dry-run summary (journal rows only; no business writes):"))
        summary = batch_run["summary"]
        self.stdout.write(f"  - processed_rows: {summary['processed_rows']}")
        self.stdout.write(f"  - would_create_count: {summary['would_create_count']}")
        self.stdout.write(f"  - would_update_count: {summary['would_update_count']}")
        self.stdout.write(f"  - would_skip_count: {summary['would_skip_count']}")
        self.stdout.write(f"  - error_count: {summary['error_count']}")
