from __future__ import annotations

from pathlib import Path

from django.test import SimpleTestCase

from apps.core.services.etl import ENTITY_CONTRACTS, GOLDEN_ETL_CONTRACT_VERSION


class EtlRunbookTests(SimpleTestCase):
    def test_runbook_tracks_contract_and_entities(self):
        runbook_path = Path(__file__).resolve().parents[4] / "docs" / "runbooks" / "GOLDEN_SCHEMA_ETL.md"
        runbook = runbook_path.read_text(encoding="utf-8")

        self.assertIn("import_golden_legacy_data", runbook)
        self.assertIn(GOLDEN_ETL_CONTRACT_VERSION, runbook)

        for entity_name in ENTITY_CONTRACTS:
            self.assertIn(entity_name, runbook)
