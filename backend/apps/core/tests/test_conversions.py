from __future__ import annotations

from datetime import datetime, timezone as dt_timezone
from decimal import Decimal
from pathlib import Path

from django.test import SimpleTestCase

from apps.core.conversions import (
    CANONICAL_WEIGHT_BASE_UNIT,
    DEFAULT_WEIGHT_QUANTUM,
    KG_TO_LBS_FACTOR,
    SUPPORTED_WEIGHT_UNITS,
    TRADE_INVARIANTS_CONTRACT_VERSION,
    convert_weight,
    ensure_utc,
    normalize_weight_unit,
    render_in_timezone,
)


class TradeInvariantContractTests(SimpleTestCase):
    def test_contract_constants_match_b2b_ticket(self):
        self.assertEqual(TRADE_INVARIANTS_CONTRACT_VERSION, "b2b-02.1.v1")
        self.assertEqual(CANONICAL_WEIGHT_BASE_UNIT, "lbs")
        self.assertEqual(SUPPORTED_WEIGHT_UNITS, ("lbs", "kg"))
        self.assertEqual(DEFAULT_WEIGHT_QUANTUM, Decimal("0.01"))
        self.assertEqual(KG_TO_LBS_FACTOR, Decimal("2.20462262"))

    def test_normalize_weight_unit_accepts_current_repo_variants(self):
        self.assertEqual(normalize_weight_unit("LBS"), "lbs")
        self.assertEqual(normalize_weight_unit("lb"), "lbs")
        self.assertEqual(normalize_weight_unit("KG"), "kg")
        self.assertEqual(normalize_weight_unit("kilograms"), "kg")

    def test_convert_weight_uses_decimal_contract(self):
        self.assertEqual(
            convert_weight(Decimal("100"), "kg", "lbs", quantum=None),
            Decimal("220.46226200"),
        )
        self.assertEqual(
            convert_weight(Decimal("100"), "lbs", "kg"),
            Decimal("45.36"),
        )

    def test_ensure_utc_and_render_in_timezone_keep_aware_instants(self):
        instant = datetime(2026, 1, 8, 14, 0, tzinfo=dt_timezone.utc)
        rendered = render_in_timezone(instant, "America/New_York")

        self.assertEqual(ensure_utc(instant), instant)
        self.assertEqual(rendered.hour, 9)
        self.assertEqual(rendered.utcoffset().total_seconds(), -5 * 60 * 60)

    def test_runbook_tracks_contract_version_and_key_surfaces(self):
        runbook_path = Path(__file__).resolve().parents[4] / "docs" / "runbooks" / "GLOBAL_TRADE_ENGINE.md"
        runbook = runbook_path.read_text(encoding="utf-8")

        self.assertIn(TRADE_INVARIANTS_CONTRACT_VERSION, runbook)
        self.assertIn("backend/apps/core/conversions.py", runbook)
        self.assertIn("backend/apps/core/exporting.py", runbook)
        self.assertIn("frontend/src/utils/formatters.ts", runbook)
