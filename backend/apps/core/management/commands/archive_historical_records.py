"""Dry-run-first archive command for seven-year retention evidence."""

from __future__ import annotations

import json
from datetime import date
from typing import Any

from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.core.management.base import BaseCommand, CommandError

from apps.core.services.data_governance import (
    build_archive_command_options,
    default_retention_cutoff,
    execute_archive_run,
    get_archive_target_details,
)
from apps.tenants.models import Tenant, TenantUser
from apps.tenants.rls import tenant_rls


class Command(BaseCommand):
    help = "Preview or execute the additive seven-year archive snapshot contract."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--tenant-slug", help="Tenant slug to archive.")
        parser.add_argument("--tenant-id", help="Tenant UUID to archive.")
        parser.add_argument(
            "--cutoff-date",
            help="Optional ISO date override for archive eligibility. Defaults to seven years ago.",
        )
        parser.add_argument(
            "--model-label",
            help="Optional Django model label from the retention contract.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            help="Optional maximum number of eligible records to process in this batch.",
        )
        parser.add_argument(
            "--format",
            choices=("text", "json"),
            default="text",
            help="Render the archive batch as human-readable text or JSON.",
        )
        parser.add_argument(
            "--execute",
            action="store_true",
            help="Write archive snapshot evidence rows. Without this flag the command remains a dry run.",
        )
        parser.add_argument(
            "--requested-user-id",
            type=int,
            help="Optional user ID recorded as the requesting operator.",
        )
        parser.add_argument(
            "--requested-email",
            default="",
            help="Optional requestor email recorded with the batch.",
        )
        parser.add_argument(
            "--approved-user-id",
            type=int,
            help="Optional user ID recorded as the approving operator for execute mode.",
        )
        parser.add_argument(
            "--approved-email",
            default="",
            help="Optional approver email recorded with the batch.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        if not options.get("tenant_slug") and not options.get("tenant_id"):
            raise CommandError("Archive execution requires --tenant-slug or --tenant-id.")
        if options.get("tenant_slug") and options.get("tenant_id"):
            raise CommandError("Pass only one tenant selector: --tenant-slug or --tenant-id.")
        if options.get("limit") is not None and options["limit"] <= 0:
            raise CommandError("--limit must be a positive integer.")
        if options.get("execute") and not (options.get("approved_user_id") or options.get("approved_email")):
            raise CommandError("Execute mode requires --approved-user-id or --approved-email for audit evidence.")

        try:
            get_archive_target_details(options.get("model_label"))
            cutoff_date = (
                default_retention_cutoff()
                if not options.get("cutoff_date")
                else self.parse_date(options["cutoff_date"])
            )
            tenant = self.resolve_tenant(
                tenant_slug=options.get("tenant_slug"),
                tenant_id=options.get("tenant_id"),
            )
            requested_user = self.resolve_user(tenant=tenant, user_id=options.get("requested_user_id"))
            approved_user = self.resolve_user(tenant=tenant, user_id=options.get("approved_user_id"))
            command_options = build_archive_command_options(
                model_label=options.get("model_label"),
                limit=options.get("limit"),
                output_format=options["format"],
                execute=options.get("execute", False),
                requested_user_id=options.get("requested_user_id"),
                requested_email=options.get("requested_email", ""),
                approved_user_id=options.get("approved_user_id"),
                approved_email=options.get("approved_email", ""),
            )
            with tenant_rls(str(tenant.id), strict=True):
                preview = execute_archive_run(
                    tenant=tenant,
                    cutoff_date=cutoff_date,
                    command_options=command_options,
                    execute=options.get("execute", False),
                    requested_user=requested_user,
                    requested_email=options.get("requested_email", ""),
                    approved_user=approved_user,
                    approved_email=options.get("approved_email", ""),
                )
        except (ObjectDoesNotExist, ValueError) as exc:
            raise CommandError(str(exc)) from exc

        if options["format"] == "json":
            self.stdout.write(json.dumps(preview, indent=2, sort_keys=True))
            return

        batch_run = preview["batch_run"]
        summary = batch_run["summary"]

        title = "Historical Archive Execute" if options["execute"] else "Historical Archive Dry Run"
        self.stdout.write(self.style.MIGRATE_HEADING(title))
        self.stdout.write(f"Tenant: {preview['tenant_slug']} ({preview['tenant_id']})")
        self.stdout.write(f"Cutoff date: {preview['cutoff_date']}")
        self.stdout.write(f"Batch run id: {batch_run['batch_id']}")
        self.stdout.write(f"Run key: {batch_run['run_key']}")
        self.stdout.write("")
        self.stdout.write(self.style.WARNING("Retention targets:"))
        for model_summary in summary["model_summaries"]:
            self.stdout.write(
                f"  - {model_summary['model_label']}: "
                f"eligible={model_summary['eligible_record_count']} "
                f"holds={model_summary['legal_hold_skip_count']} "
                f"archived={model_summary['archived_record_count']} "
                f"dry_run={model_summary['dry_run_record_count']}"
            )
        self.stdout.write("")
        self.stdout.write(self.style.WARNING("Batch summary:"))
        self.stdout.write(f"  - dry_run_record_count: {summary['dry_run_record_count']}")
        self.stdout.write(f"  - archived_record_count: {summary['archived_record_count']}")
        self.stdout.write(f"  - legal_hold_skip_count: {summary['legal_hold_skip_count']}")

    def resolve_tenant(self, *, tenant_slug: str | None, tenant_id: str | None) -> Tenant:
        """Resolve one tenant for archive execution."""

        if tenant_slug:
            return Tenant.objects.get(slug=tenant_slug)
        return Tenant.objects.get(id=tenant_id)

    def resolve_user(self, *, tenant: Tenant, user_id: int | None):
        """Resolve an optional audit operator."""

        if not user_id:
            return None
        user = get_user_model().objects.get(pk=user_id)
        if user.is_superuser:
            return user
        if not TenantUser.objects.filter(tenant=tenant, user=user, is_active=True).exists():
            raise CommandError("Archive audit users must belong to the selected tenant.")
        return user

    def parse_date(self, value: str):
        """Parse an ISO date string for archive cutoff overrides."""

        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise CommandError("--cutoff-date must use ISO format YYYY-MM-DD.") from exc
