from __future__ import annotations

from datetime import date, datetime, timezone as dt_timezone
from decimal import Decimal
from pathlib import Path

from django.test import SimpleTestCase

from apps.core.conversions import (
    CANONICAL_WEIGHT_BASE_UNIT,
    DEFAULT_WEIGHT_QUANTUM,
    DEFAULT_RENDER_TIMEZONE,
    KG_TO_LBS_FACTOR,
    SUPPORTED_WEIGHT_UNITS,
    TRADE_ENGINE_SERVICE_VERSION,
    TRADE_INVARIANTS_CONTRACT_VERSION,
    format_trade_date,
    format_trade_datetime,
    format_trade_weight,
    convert_weight,
    ensure_utc,
    normalize_temporal_for_export,
    normalize_weight_unit,
    render_in_timezone,
    resolve_trade_timezone_name,
)


class TradeInvariantContractTests(SimpleTestCase):
    def test_contract_constants_match_b2b_ticket(self):
        self.assertEqual(TRADE_INVARIANTS_CONTRACT_VERSION, "b2b-02.1.v1")
        self.assertEqual(CANONICAL_WEIGHT_BASE_UNIT, "lbs")
        self.assertEqual(SUPPORTED_WEIGHT_UNITS, ("lbs", "kg"))
        self.assertEqual(DEFAULT_WEIGHT_QUANTUM, Decimal("0.01"))
        self.assertEqual(DEFAULT_RENDER_TIMEZONE, "UTC")
        self.assertEqual(KG_TO_LBS_FACTOR, Decimal("2.20462262"))
        self.assertEqual(TRADE_ENGINE_SERVICE_VERSION, "b2b-02.2.v1")

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

    def test_format_trade_weight_renders_canonical_label(self):
        self.assertEqual(format_trade_weight("100", "kg"), "100.00 KG")
        self.assertEqual(format_trade_weight("100", "kg", to_unit="lbs"), "220.46 LBS")

    def test_ensure_utc_and_render_in_timezone_keep_aware_instants(self):
        instant = datetime(2026, 1, 8, 14, 0, tzinfo=dt_timezone.utc)
        rendered = render_in_timezone(instant, "America/New_York")

        self.assertEqual(ensure_utc(instant), instant)
        self.assertEqual(rendered.hour, 9)
        self.assertEqual(rendered.utcoffset().total_seconds(), -5 * 60 * 60)

    def test_render_in_timezone_handles_dst_boundaries(self):
        pre_dst = render_in_timezone(datetime(2026, 3, 8, 6, 30, tzinfo=dt_timezone.utc), "America/New_York")
        post_dst = render_in_timezone(datetime(2026, 3, 8, 7, 30, tzinfo=dt_timezone.utc), "America/New_York")

        self.assertEqual((pre_dst.hour, int(pre_dst.utcoffset().total_seconds() // 3600)), (1, -5))
        self.assertEqual((post_dst.hour, int(post_dst.utcoffset().total_seconds() // 3600)), (3, -4))

    def test_format_trade_datetime_defaults_to_utc(self):
        instant = datetime(2026, 1, 8, 14, 0, tzinfo=dt_timezone.utc)
        self.assertEqual(format_trade_datetime(instant), "2026-01-08 14:00 UTC")

    def test_format_trade_date_keeps_calendar_day_for_date_objects(self):
        self.assertEqual(format_trade_date(datetime(2026, 1, 9, 1, 0, tzinfo=dt_timezone.utc), timezone_name="America/New_York"), "2026-01-08")
        self.assertEqual(format_trade_date(date(2026, 1, 9), timezone_name="America/New_York"), "2026-01-09")

    def test_normalize_temporal_for_export_uses_explicit_timezone(self):
        instant = datetime(2026, 1, 8, 14, 0, tzinfo=dt_timezone.utc)
        self.assertEqual(normalize_temporal_for_export(instant), "2026-01-08T14:00:00+00:00")
        self.assertEqual(
            normalize_temporal_for_export(instant, timezone_name="America/New_York"),
            "2026-01-08T09:00:00-05:00",
        )

    def test_resolve_trade_timezone_name_falls_back_to_utc(self):
        self.assertEqual(resolve_trade_timezone_name(None), "UTC")
        self.assertEqual(resolve_trade_timezone_name("America/Chicago"), "America/Chicago")

    def test_runbook_tracks_contract_version_and_key_surfaces(self):
        runbook_path = Path(__file__).resolve().parents[4] / "docs" / "runbooks" / "GLOBAL_TRADE_ENGINE.md"
        runbook = runbook_path.read_text(encoding="utf-8")

        self.assertIn(TRADE_INVARIANTS_CONTRACT_VERSION, runbook)
        self.assertIn("backend/apps/core/conversions.py", runbook)
        self.assertIn("backend/apps/core/exporting.py", runbook)
        self.assertIn("frontend/src/utils/formatters.ts", runbook)
