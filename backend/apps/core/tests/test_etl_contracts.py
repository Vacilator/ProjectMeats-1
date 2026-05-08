from __future__ import annotations

import json
from pathlib import Path

from django.test import SimpleTestCase

from apps.core.services.etl import (
    ENTITY_CONTRACTS,
    GOLDEN_ETL_CONTRACT_VERSION,
    LINE_ITEM_ENTITY_ORDER,
    LINE_ITEM_PARENT_MAP,
    MASTER_ENTITY_ORDER,
    REQUIRED_SUPPRESSED_SIDE_EFFECTS,
    SOURCE_MANIFEST_VERSION,
    SUPPORTED_SOURCE_FORMATS,
    etl_side_effect_guard,
    etl_side_effects_suppressed,
    validate_source_manifest,
)

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "etl"


class EtlContractsTests(SimpleTestCase):
    def test_contract_constants_match_ticket_expectations(self):
        self.assertEqual(GOLDEN_ETL_CONTRACT_VERSION, "ga01.1.v1")
        self.assertEqual(SOURCE_MANIFEST_VERSION, 1)
        self.assertEqual(SUPPORTED_SOURCE_FORMATS, ("csv", "xls", "xlsx"))
        self.assertEqual(
            MASTER_ENTITY_ORDER,
            ("products", "plants", "locations", "suppliers", "customers", "carriers", "contacts"),
        )
        self.assertIn("purchase_order_history", REQUIRED_SUPPRESSED_SIDE_EFFECTS)
        self.assertIn("webhooks", REQUIRED_SUPPRESSED_SIDE_EFFECTS)

    def test_line_item_parent_map_points_to_registered_line_items(self):
        for header_entity, details in LINE_ITEM_PARENT_MAP.items():
            self.assertIn(header_entity, ENTITY_CONTRACTS)
            self.assertIn(details["item_entity"], LINE_ITEM_ENTITY_ORDER)
            self.assertIn(details["item_entity"], ENTITY_CONTRACTS)
            self.assertEqual(details["related_name"], "items")

    def test_canonical_targets_avoid_legacy_alias_targets(self):
        forbidden_targets = {
            "accounting_payment_terms",
            "credit_limits",
            "our_purchase_order_num",
            "supplier_confirmation_order_num",
            "carrier_release_num",
            "how_carrier_make_appointment",
            "delivery_po_num",
        }

        for entity_name, contract in ENTITY_CONTRACTS.items():
            for target in contract.canonical_targets:
                self.assertNotIn(
                    target,
                    forbidden_targets,
                    msg=f"{entity_name} targets legacy alias {target}",
                )

    def test_source_manifest_fixture_validates(self):
        manifest_payload = json.loads((FIXTURE_DIR / "source_manifest.json").read_text(encoding="utf-8"))
        manifest = validate_source_manifest(manifest_payload)

        self.assertEqual(manifest.version, SOURCE_MANIFEST_VERSION)
        self.assertEqual(manifest.batch_key, "sample-day-0-batch")
        self.assertEqual(len(manifest.files), 3)
        self.assertEqual(manifest.files[1].line_item_entity, "purchase_order_items")

    def test_side_effect_guard_preserves_compatibility_flag(self):
        self.assertFalse(etl_side_effects_suppressed())

        with etl_side_effect_guard():
            self.assertTrue(etl_side_effects_suppressed())
