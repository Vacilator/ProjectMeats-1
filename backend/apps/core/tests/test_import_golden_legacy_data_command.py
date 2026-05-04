from __future__ import annotations

import json
import tempfile
import uuid
from io import StringIO
from pathlib import Path

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.tenants.models import Tenant
from tenant_apps.customers.models import Customer
from tenant_apps.purchase_orders.models import PurchaseOrder
from tenant_apps.suppliers.models import Supplier


FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "etl"


class ImportGoldenLegacyDataCommandTests(TestCase):
    def setUp(self) -> None:
        unique = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(username=f"etl-{unique}", password="pw")
        self.tenant = Tenant.objects.create(
            name=f"Tenant {unique}",
            slug=f"tenant-{unique}",
            contact_email=f"{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )

    def test_command_requires_explicit_tenant(self):
        manifest_path = self._write_manifest("source_manifest.json")

        with self.assertRaisesMessage(CommandError, "You must specify --tenant-id or --tenant-slug."):
            call_command("import_golden_legacy_data", source_manifest=str(manifest_path))

    def test_command_is_dry_run_only_and_writes_nothing(self):
        manifest_path = self._write_manifest("source_manifest.json")
        before_counts = (
            Supplier.objects.count(),
            Customer.objects.count(),
            PurchaseOrder.objects.count(),
        )
        stdout = StringIO()

        call_command(
            "import_golden_legacy_data",
            source_manifest=str(manifest_path),
            tenant_id=str(self.tenant.id),
            stdout=stdout,
        )

        after_counts = (
            Supplier.objects.count(),
            Customer.objects.count(),
            PurchaseOrder.objects.count(),
        )
        self.assertEqual(before_counts, after_counts)

        output = stdout.getvalue()
        self.assertIn("Mode: dry_run", output)
        self.assertIn("No business rows were written.", output)
        self.assertIn("GA-01.1 is dry-run only", output)

    def test_command_fails_closed_on_manifest_tenant_mismatch(self):
        manifest_path = self._write_manifest(
            "source_manifest.json",
            tenant={"tenant_id": None, "tenant_slug": "different-tenant", "asserted_by": "manifest"},
        )

        with self.assertRaisesMessage(
            CommandError,
            "Manifest tenant_slug does not match the explicitly requested tenant.",
        ):
            call_command(
                "import_golden_legacy_data",
                source_manifest=str(manifest_path),
                tenant_id=str(self.tenant.id),
            )

    def test_command_accepts_equivalent_manifest_uuid_formats(self):
        manifest_path = self._write_manifest(
            "source_manifest.json",
            tenant={
                "tenant_id": self.tenant.id.hex.upper(),
                "tenant_slug": self.tenant.slug,
                "asserted_by": "manifest",
            },
        )
        stdout = StringIO()

        call_command(
            "import_golden_legacy_data",
            source_manifest=str(manifest_path),
            tenant_id=str(self.tenant.id),
            stdout=stdout,
        )

        self.assertIn("No business rows were written.", stdout.getvalue())

    def test_command_rejects_manifest_unknown_fields(self):
        manifest_path = self._write_manifest("invalid_unknown_field.json")

        with self.assertRaisesMessage(CommandError, "Unknown keys in manifest: unexpected."):
            call_command(
                "import_golden_legacy_data",
                source_manifest=str(manifest_path),
                tenant_id=str(self.tenant.id),
            )

    def _write_manifest(self, fixture_name: str, **overrides) -> Path:
        payload = json.loads((FIXTURE_DIR / fixture_name).read_text(encoding="utf-8"))
        payload.setdefault("tenant", {})

        if fixture_name == "source_manifest.json" and "tenant" not in overrides:
            payload["tenant"]["tenant_id"] = str(self.tenant.id)
            payload["tenant"]["tenant_slug"] = self.tenant.slug

        for key, value in overrides.items():
            payload[key] = value

        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as handle:
            json.dump(payload, handle)
            path = handle.name
        return Path(path)
