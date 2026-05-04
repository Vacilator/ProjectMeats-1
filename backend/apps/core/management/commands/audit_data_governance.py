"""Operator-facing governance posture audit for archive evidence and observability redaction."""

from __future__ import annotations

import json
from typing import Any

from django.core.management.base import BaseCommand, CommandError

from apps.core.services.data_governance import (
    build_governance_posture_report,
    summarize_governance_reports,
)
from apps.tenants.models import Tenant
from apps.tenants.rls import tenant_rls


class Command(BaseCommand):
    help = "Audit archive evidence and observability redaction posture across active tenants."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--tenant-slug",
            help="Optional tenant slug to scope the governance audit.",
        )
        parser.add_argument(
            "--tenant-id",
            help="Optional tenant UUID to scope the governance audit.",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="Look back this many days for archive evidence checks (default: 30).",
        )
        parser.add_argument(
            "--format",
            choices=("text", "json"),
            default="text",
            help="Render the audit as human-readable text or JSON.",
        )
        parser.add_argument(
            "--strict",
            action="store_true",
            help="Exit non-zero when the governance posture is not healthy.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        days = int(options["days"])
        if days <= 0:
            raise CommandError("--days must be a positive integer.")

        tenant_slug = options.get("tenant_slug")
        tenant_id = options.get("tenant_id")
        if tenant_slug and tenant_id:
            raise CommandError("Pass only one tenant selector: --tenant-slug or --tenant-id.")

        reports = [
            self._build_tenant_report(tenant=tenant, lookback_days=days)
            for tenant in self._get_target_tenants(tenant_slug=tenant_slug, tenant_id=tenant_id)
        ]
        summary = summarize_governance_reports(reports, lookback_days=days)

        if options["format"] == "json":
            self.stdout.write(json.dumps(summary, indent=2, sort_keys=True))
        else:
            self._render_text(summary)

        if options.get("strict") and summary["overall_status"] != "healthy":
            raise CommandError(
                f"Data governance posture is {summary['overall_status']} "
                f"across {summary['tenant_count']} audited tenant(s)."
            )

    def _get_target_tenants(self, *, tenant_slug: str | None, tenant_id: str | None):
        if tenant_slug:
            return [Tenant.objects.get(slug=tenant_slug)]
        if tenant_id:
            return [Tenant.objects.get(id=tenant_id)]
        return list(Tenant.objects.filter(is_active=True).order_by("slug"))

    def _build_tenant_report(self, *, tenant: Tenant, lookback_days: int) -> dict[str, Any]:
        with tenant_rls(str(tenant.id), strict=True):
            return build_governance_posture_report(tenant=tenant, lookback_days=lookback_days)

    def _render_text(self, summary: dict[str, Any]) -> None:
        heading_style = {
            "healthy": self.style.SUCCESS,
            "warning": self.style.WARNING,
            "critical": self.style.ERROR,
        }[summary["overall_status"]]

        self.stdout.write(heading_style("DATA GOVERNANCE POSTURE AUDIT"))
        self.stdout.write(f"Lookback days: {summary['lookback_days']}")
        self.stdout.write(f"Overall status: {summary['overall_status'].upper()}")
        self.stdout.write(f"Tenants audited: {summary['tenant_count']}")
        self.stdout.write("")

        for report in summary["tenant_reports"]:
            archive_evidence = report["archive_evidence"]
            observability = report["observability"]
            self.stdout.write(
                f"- {report['tenant_slug']} ({report['tenant_id']}) :: {report['overall_status'].upper()}"
            )
            self.stdout.write(
                "  archive batches="
                f"{archive_evidence['recent_batch_count']} "
                f"execute={archive_evidence['recent_execute_batch_count']} "
                f"failed={archive_evidence['recent_failed_batch_count']} "
                f"stale_inflight={archive_evidence['stale_inflight_batch_count']} "
                f"holds={archive_evidence['active_legal_hold_count']}"
            )
            self.stdout.write(
                "  observability logging="
                f"{observability['logging_redaction_configured']} "
                f"sentry_enabled={observability['sentry_enabled']} "
                f"send_default_pii_disabled={observability['sentry_send_default_pii_disabled']} "
                f"probe_ok={observability['redaction_probe']['all_checks_passed']}"
            )
            self.stdout.write(
                f"  retention checksum={report['retention_contract']['checksum']}"
            )
            if report["warnings"]:
                for warning in report["warnings"]:
                    self.stdout.write(f"  warning: {warning}")
            self.stdout.write("")
