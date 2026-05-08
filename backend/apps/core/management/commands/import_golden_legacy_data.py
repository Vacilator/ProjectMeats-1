"""Dry-run-only Golden Schema ETL command scaffold for GA-01.1."""

from __future__ import annotations

import hashlib
import json
import uuid
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError

from apps.core.services.etl import (
    ENTITY_CONTRACTS,
    GOLDEN_ETL_CONTRACT_VERSION,
    LINE_ITEM_PARENT_MAP,
    MASTER_ENTITY_ORDER,
    REQUIRED_SUPPRESSED_SIDE_EFFECTS,
    TRANSACTION_ENTITY_ORDER,
    etl_side_effect_guard,
    validate_source_manifest,
)
from apps.core.services.etl.contracts import ManifestValidationError, ValidatedSourceManifest
from apps.tenants.models import Tenant
from apps.tenants.rls import tenant_rls


class Command(BaseCommand):
    help = "Validate a Golden Schema ETL source manifest and print the dry-run contract summary."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--source-manifest",
            required=True,
            help="Path to the JSON source manifest describing the incoming ETL batch.",
        )
        parser.add_argument(
            "--tenant-id",
            type=str,
            help="Tenant UUID for the batch. Required when --tenant-slug is omitted.",
        )
        parser.add_argument(
            "--tenant-slug",
            type=str,
            help="Tenant slug for the batch. Required when --tenant-id is omitted.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        manifest_path = Path(options["source_manifest"]).expanduser().resolve()
        manifest = self._load_manifest(manifest_path)
        tenant = self._resolve_tenant(
            tenant_id=options.get("tenant_id"),
            tenant_slug=options.get("tenant_slug"),
        )
        self._assert_manifest_matches_tenant(manifest, tenant)

        with tenant_rls(str(tenant.id), strict=True):
            with etl_side_effect_guard(mode="dry_run") as policy:
                self.stdout.write("Golden Schema ETL dry-run contract summary")
                self.stdout.write(f"Contract version: {GOLDEN_ETL_CONTRACT_VERSION}")
                self.stdout.write(f"Mode: {policy.mode}")
                self.stdout.write(f"Tenant: {tenant.slug} ({tenant.id})")
                self.stdout.write(f"Batch key: {manifest.batch_key}")
                self.stdout.write(f"Manifest checksum: {hashlib.sha256(manifest_path.read_bytes()).hexdigest()}")
                self.stdout.write(f"Suppressed side effects: {', '.join(policy.suppressed_side_effects)}")
                self.stdout.write(f"Manifest files: {len(manifest.files)}")

                for source_file in manifest.files:
                    contract = ENTITY_CONTRACTS[source_file.entity]
                    descriptor = f"- {source_file.entity} -> {contract.model_label}"
                    if source_file.sheet_name:
                        descriptor += f" [sheet={source_file.sheet_name}]"
                    if source_file.line_item_entity:
                        descriptor += f" [line_items={source_file.line_item_entity}]"
                    self.stdout.write(descriptor)

                self.stdout.write("Master entity order: " + " -> ".join(MASTER_ENTITY_ORDER))
                self.stdout.write("Transaction header order: " + " -> ".join(TRANSACTION_ENTITY_ORDER))

                for header_entity, line_item_details in LINE_ITEM_PARENT_MAP.items():
                    self.stdout.write(
                        f"Line-item link: {header_entity} uses {line_item_details['item_entity']} "
                        f"via {line_item_details['item_fk']}"
                    )

                self.stdout.write("No business rows were written.")
                self.stdout.write("GA-01.1 is dry-run only; write-capable ETL begins in GA-01.2.")

    def _load_manifest(self, manifest_path: Path) -> ValidatedSourceManifest:
        if not manifest_path.exists():
            raise CommandError(f"Source manifest does not exist: {manifest_path}")

        try:
            raw_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Source manifest is not valid JSON: {exc}") from exc

        try:
            return validate_source_manifest(raw_manifest)
        except ManifestValidationError as exc:
            raise CommandError(str(exc)) from exc

    def _resolve_tenant(self, *, tenant_id: str | None, tenant_slug: str | None) -> Tenant:
        tenant_id = (tenant_id or "").strip()
        tenant_slug = (tenant_slug or "").strip()

        if not tenant_id and not tenant_slug:
            raise CommandError("You must specify --tenant-id or --tenant-slug.")

        tenant = None
        if tenant_id:
            tenant = Tenant.objects.filter(id=tenant_id).first()
            if tenant is None:
                raise CommandError(f"Tenant not found for --tenant-id={tenant_id}.")

        if tenant_slug:
            slug_match = Tenant.objects.filter(slug=tenant_slug).first()
            if slug_match is None:
                raise CommandError(f"Tenant not found for --tenant-slug={tenant_slug}.")
            if tenant is not None and slug_match.id != tenant.id:
                raise CommandError("The provided --tenant-id and --tenant-slug resolve to different tenants.")
            tenant = slug_match

        if tenant is None:
            raise CommandError("Failed to resolve tenant.")

        return tenant

    def _assert_manifest_matches_tenant(
        self,
        manifest: ValidatedSourceManifest,
        tenant: Tenant,
    ) -> None:
        manifest_tenant_id = manifest.tenant.tenant_id
        manifest_tenant_slug = manifest.tenant.tenant_slug

        if manifest_tenant_id:
            try:
                manifest_tenant_uuid = uuid.UUID(manifest_tenant_id)
            except ValueError as exc:
                raise CommandError("Manifest tenant_id is not a valid UUID.") from exc

            if tenant.id.hex != manifest_tenant_uuid.hex:
                raise CommandError("Manifest tenant_id does not match the explicitly requested tenant.")
        if manifest_tenant_slug and tenant.slug != manifest_tenant_slug:
            raise CommandError("Manifest tenant_slug does not match the explicitly requested tenant.")
