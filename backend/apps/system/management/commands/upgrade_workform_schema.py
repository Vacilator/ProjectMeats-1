from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand, CommandError

from apps.system.models import TenantWorkForm
from apps.system.services.workform_schema_upgrade import upgrade_workform_definition


class Command(BaseCommand):
    help = "Dry-run or apply additive WorkForm schema upgrades for legacy node aliases."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--tenant-id", type=str, help="Limit the upgrade to a single tenant UUID.")
        parser.add_argument("--workform-id", type=str, help="Limit the upgrade to a single workform UUID.")
        parser.add_argument("--limit", type=int, help="Only inspect the first N matching workforms.")
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Persist the upgraded workflow_definition instead of running in dry-run mode.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        qs = TenantWorkForm.objects.select_related("tenant").order_by("updated_at")

        tenant_id = options.get("tenant_id")
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)

        workform_id = options.get("workform_id")
        if workform_id:
            qs = qs.filter(id=workform_id)

        limit = options.get("limit")
        if limit:
            qs = qs[: max(int(limit), 0)]

        workforms = list(qs)
        if not workforms:
            raise CommandError("No matching workforms found.")

        apply_changes = bool(options.get("apply"))
        upgraded_count = 0
        aliased_form_refs = 0

        for workform in workforms:
            upgraded_definition, stats = upgrade_workform_definition(workform.workflow_definition)
            if not stats["changed"]:
                self.stdout.write(
                    self.style.NOTICE(f"UNCHANGED {workform.id} {workform.name} ({workform.tenant.slug})")
                )
                continue

            upgraded_count += 1
            aliased_form_refs += int(stats["aliased_form_refs"])

            self.stdout.write(
                self.style.WARNING(
                    f"UPGRADE {workform.id} {workform.name} ({workform.tenant.slug}) "
                    f'nodes={stats["changed_nodes"]} aliased_form_refs={stats["aliased_form_refs"]}'
                )
            )
            for change in stats["type_changes"]:
                self.stdout.write(f'  - node {change["node_id"] or "unknown"}: {change["from"]} -> {change["to"]}')

            if not apply_changes:
                continue

            workform.workflow_definition = upgraded_definition
            workform.form_references = workform.extract_form_references()
            workform.save(update_fields=["workflow_definition", "form_references", "updated_at"])

        mode = "APPLY" if apply_changes else "DRY-RUN"
        self.stdout.write(
            self.style.SUCCESS(
                f"{mode} complete: scanned={len(workforms)} upgraded={upgraded_count} "
                f"aliased_form_refs={aliased_form_refs}"
            )
        )
