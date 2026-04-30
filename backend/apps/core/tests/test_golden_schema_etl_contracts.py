"""Tests for the GA-01.1 Golden Schema ETL contract scaffold."""

from __future__ import annotations

import json
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase

from apps.core.services.etl import (
    BATCH_JOURNAL_FIELDS,
    ENTITY_CONTRACTS,
    SIDE_EFFECT_SUPPRESSION_RULES,
    build_contract_preview,
    resolve_manifest_tenant,
    validate_batch_manifest,
)
from apps.tenants.models import Tenant


FIXTURE_PATH = (
    Path(__file__).resolve().parent / "fixtures" / "etl" / "legacy_batch_manifest.json"
)
DRY_RUN_FIXTURE_PATH = (
    Path(__file__).resolve().parent / "fixtures" / "etl" / "dry_run_manifest.json"
)


class GoldenSchemaETLContractTests(TestCase):
    """High-signal coverage for the contract-only ETL batch."""

    def setUp(self) -> None:
        self.tenant = Tenant.objects.create(
            name="ACME Meats",
            slug="acme-meats",
            schema_name="acme_meats",
            contact_email="ops@acme-meats.example",
            is_active=True,
        )

    def test_manifest_requires_explicit_tenant_selector(self) -> None:
        payload = {
            "batch_name": "missing-tenant",
            "source_system": "legacy_excel_bundle",
            "sources": [{"entity": "suppliers", "format": "xlsx", "path": "suppliers.xlsx"}],
        }

        with self.assertRaisesMessage(ValueError, "tenant_slug or tenant_id"):
            validate_batch_manifest(payload)

    def test_manifest_orders_entities_deterministically(self) -> None:
        payload = {
            "batch_name": "out-of-order",
            "source_system": "legacy_excel_bundle",
            "tenant_slug": self.tenant.slug,
            "sources": [
                {"entity": "invoice_items", "format": "csv", "path": "invoice_items.csv"},
                {"entity": "suppliers", "format": "xlsx", "path": "suppliers.xlsx"},
                {"entity": "purchase_orders", "format": "xlsx", "path": "purchase_orders.xlsx"},
                {"entity": "products", "format": "csv", "path": "products.csv"},
            ],
        }

        manifest = validate_batch_manifest(payload)
        self.assertEqual(
            manifest.ordered_entities(),
            ("products", "suppliers", "purchase_orders", "invoice_items"),
        )

    def test_preview_exposes_side_effect_suppression_and_journal_shape(self) -> None:
        payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        manifest = validate_batch_manifest(payload)
        preview = build_contract_preview(manifest, resolved_tenant=resolve_manifest_tenant(manifest))

        self.assertEqual(preview["side_effects_suppressed"], list(SIDE_EFFECT_SUPPRESSION_RULES))
        self.assertEqual(preview["journal_fields"], list(BATCH_JOURNAL_FIELDS))
        self.assertIn("carrier_purchase_orders", preview["ordered_entities"])

    def test_transaction_contracts_expand_mixin_fields(self) -> None:
        purchase_order_contract = ENTITY_CONTRACTS["purchase_orders"]
        invoice_contract = ENTITY_CONTRACTS["invoices"]
        line_item_contract = ENTITY_CONTRACTS["invoice_items"]

        self.assertIn("carrier_release_number", purchase_order_contract.expanded_fields)
        self.assertIn("accounting_payable_contact_email", invoice_contract.expanded_fields)
        self.assertIn("total_net_weight", line_item_contract.expanded_fields)

    def test_command_renders_stable_text_preview(self) -> None:
        out = StringIO()

        call_command(
            "import_golden_legacy_data",
            "--manifest",
            str(DRY_RUN_FIXTURE_PATH),
            stdout=out,
        )

        rendered = out.getvalue()
        self.assertIn("Golden Schema ETL Dry Run", rendered)
        self.assertIn("Tenant: acme-meats", rendered)
        self.assertIn("1. suppliers -> tenant_apps.suppliers.models.Supplier", rendered)
        self.assertIn("Side effects to suppress", rendered)
        self.assertIn("Dry-run summary", rendered)
