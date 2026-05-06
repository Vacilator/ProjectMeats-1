from __future__ import annotations

from datetime import date, datetime, timezone as dt_timezone
from types import SimpleNamespace

from django.test import SimpleTestCase

from apps.core.exporting import _normalize_cell
from apps.core.services import pdf_generator


class TradeDocumentRenderingTests(SimpleTestCase):
    def test_csv_normalize_cell_keeps_date_only_values_calendar_safe(self):
        self.assertEqual(_normalize_cell(date(2026, 1, 8)), "2026-01-08")

    def test_csv_normalize_cell_uses_trade_timezone_contract(self):
        instant = datetime(2026, 1, 8, 14, 0, tzinfo=dt_timezone.utc)
        self.assertEqual(_normalize_cell(instant), "2026-01-08T14:00:00+00:00")
        self.assertEqual(
            _normalize_cell(instant, timezone_name="America/New_York"),
            "2026-01-08T09:00:00-05:00",
        )

    def test_document_subtitle_defaults_to_utc_when_no_facility_timezone_exists(self):
        instance = SimpleNamespace(
            order_number="PO-123",
            status="approved",
            get_status_display=lambda: "Approved",
            date_time_stamp=datetime(2026, 1, 8, 14, 0, tzinfo=dt_timezone.utc),
            created_on=None,
            date_time_stamp_created=None,
        )

        subtitle = pdf_generator._document_subtitle(instance)

        self.assertIn("PO-123", subtitle)
        self.assertIn("Generated 2026-01-08 14:00 UTC", subtitle)

    def test_document_subtitle_honors_explicit_related_timezone(self):
        instance = SimpleNamespace(
            order_number="PO-123",
            status="approved",
            get_status_display=lambda: "Approved",
            date_time_stamp=datetime(2026, 1, 8, 14, 0, tzinfo=dt_timezone.utc),
            created_on=None,
            date_time_stamp_created=None,
            plant=SimpleNamespace(timezone="America/Chicago"),
        )

        subtitle = pdf_generator._document_subtitle(instance)

        self.assertIn("Generated 2026-01-08 08:00 CST", subtitle)

    def test_pdf_product_summary_weight_uses_trade_weight_formatter(self):
        instance = SimpleNamespace(
            order_number="PO-456",
            status="draft",
            product=None,
            type_of_protein="Beef",
            item_description="Trim",
            description_of_product_item="",
            fresh_or_frozen="Fresh",
            package_type="Boxed",
            quantity=12,
            total_weight="220.462262",
            weight_unit="LBS",
        )

        product_summary = pdf_generator._document_sections(instance)[-1][1]

        self.assertIn(("Weight", "220.46 LBS"), product_summary)
