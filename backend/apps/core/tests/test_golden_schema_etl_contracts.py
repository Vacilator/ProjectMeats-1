"""Regression coverage for the current Golden Schema ETL contract surface."""

from __future__ import annotations

import json
import tempfile
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase

from apps.core.services.etl import (
    ENTITY_CONTRACTS,
    LINE_ITEM_ENTITY_ORDER,
    LINE_ITEM_PARENT_MAP,
    REQUIRED_SUPPRESSED_SIDE_EFFECTS,
    SOURCE_MANIFEST_VERSION,
    validate_source_manifest,
)
from apps.tenants.models import Tenant

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "etl"


class GoldenSchemaETLContractTests(TestCase):
    """Keep the ETL regression suite aligned to the current contract-only API."""

    def setUp(self) -> None:
        self.tenant = Tenant.objects.create(
            name="ACME Meats",
            slug="acme-meats",
            schema_name="acme_meats",
            contact_email="ops@acme-meats.example",
            is_active=True,
        )

    def test_source_manifest_validates_against_current_contract(self) -> None:
        manifest_payload = json.loads((FIXTURE_DIR / "source_manifest.json").read_text(encoding="utf-8"))
        manifest_payload["tenant"]["tenant_id"] = str(self.tenant.id)
        manifest_payload["tenant"]["tenant_slug"] = self.tenant.slug

        manifest = validate_source_manifest(manifest_payload)

        self.assertEqual(manifest.version, SOURCE_MANIFEST_VERSION)
        self.assertEqual(manifest.batch_key, "sample-day-0-batch")
        self.assertEqual(len(manifest.files), 3)
        self.assertEqual(manifest.files[1].line_item_entity, "purchase_order_items")

    def test_line_item_parent_map_points_to_registered_contracts(self) -> None:
        self.assertIn("webhooks", REQUIRED_SUPPRESSED_SIDE_EFFECTS)
        self.assertIn("purchase_order_history", REQUIRED_SUPPRESSED_SIDE_EFFECTS)

        for header_entity, details in LINE_ITEM_PARENT_MAP.items():
            self.assertIn(header_entity, ENTITY_CONTRACTS)
            self.assertIn(details["item_entity"], LINE_ITEM_ENTITY_ORDER)
            self.assertIn(details["item_entity"], ENTITY_CONTRACTS)
            self.assertEqual(details["related_name"], "items")

    def test_command_renders_current_dry_run_summary(self) -> None:
        stdout = StringIO()
        manifest_path = self._write_manifest("source_manifest.json")

        call_command(
            "import_golden_legacy_data",
            source_manifest=str(manifest_path),
            tenant_id=str(self.tenant.id),
            stdout=stdout,
        )

        rendered = stdout.getvalue()
        self.assertIn("Golden Schema ETL dry-run contract summary", rendered)
        self.assertIn(f"Tenant: {self.tenant.slug} ({self.tenant.id})", rendered)
        self.assertIn("- suppliers -> tenant_apps.suppliers.models.Supplier", rendered)
        self.assertIn("Suppressed side effects:", rendered)
        self.assertIn("No business rows were written.", rendered)

    def _write_manifest(self, fixture_name: str) -> Path:
        payload = json.loads((FIXTURE_DIR / fixture_name).read_text(encoding="utf-8"))
        payload["tenant"]["tenant_id"] = str(self.tenant.id)
        payload["tenant"]["tenant_slug"] = self.tenant.slug

        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as handle:
            json.dump(payload, handle)
            path = handle.name
        return Path(path)
