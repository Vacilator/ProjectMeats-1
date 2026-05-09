"""Tests for financial reconciliation service."""

from decimal import Decimal
from unittest import TestCase

from tenant_apps.workflows.services.financial_reconciliation import (
    calculate_drift_percent,
    reconcile_trade_financials,
)


class TestDriftPercentCalculation(TestCase):
    """Test drift percentage calculation."""

    def test_no_drift(self):
        result = calculate_drift_percent(Decimal("100.00"), Decimal("100.00"))
        self.assertEqual(result, Decimal("0"))

    def test_small_drift(self):
        result = calculate_drift_percent(Decimal("100.01"), Decimal("100.00"))
        self.assertEqual(result, Decimal("0.0100"))

    def test_large_drift(self):
        result = calculate_drift_percent(Decimal("110.00"), Decimal("100.00"))
        self.assertEqual(result, Decimal("10.0000"))

    def test_zero_computed_nonzero_stored(self):
        result = calculate_drift_percent(Decimal("50.00"), Decimal("0"))
        self.assertEqual(result, Decimal("100"))

    def test_both_zero(self):
        result = calculate_drift_percent(Decimal("0"), Decimal("0"))
        self.assertEqual(result, Decimal("0"))


class TestReconcileTradeFinancials(TestCase):
    """Test trade financial reconciliation."""

    def test_no_drift_detected(self):
        trades = [
            {
                "trade_id": "t1",
                "sell_price": 10000,
                "buy_price": 8000,
                "stored_margin_percent": 20.00,
                "total_amount": 10000,
                "amount_paid": 5000,
                "stored_outstanding": 5000.00,
            }
        ]
        result = reconcile_trade_financials(trades)
        self.assertEqual(result.records_checked, 1)
        self.assertEqual(result.drifts_detected, 0)
        self.assertTrue(result.success)

    def test_margin_drift_auto_corrected(self):
        # Stored margin is 20%, but computed should be 25% (drift 25%)
        # This exceeds auto-correct threshold (1%), so it's an alert
        trades = [
            {
                "trade_id": "t1",
                "sell_price": 10000,
                "buy_price": 7500,
                "stored_margin_percent": 20.00,  # should be 25%
                "total_amount": 10000,
                "amount_paid": 5000,
                "stored_outstanding": 5000.00,
            }
        ]
        result = reconcile_trade_financials(trades)
        self.assertEqual(result.drifts_detected, 1)
        self.assertEqual(result.alerts_raised, 1)

    def test_small_drift_auto_corrected(self):
        # Stored margin is 19.99%, computed is 20% -> 0.05% drift -> auto-correct
        trades = [
            {
                "trade_id": "t1",
                "sell_price": 10000,
                "buy_price": 8000,
                "stored_margin_percent": 19.90,  # should be 20%
                "total_amount": 10000,
                "amount_paid": 5000,
                "stored_outstanding": 5000.00,
            }
        ]
        result = reconcile_trade_financials(trades, auto_correct_threshold=Decimal("1.0"))
        self.assertGreater(result.drifts_detected, 0)
        self.assertGreater(result.auto_corrected, 0)

    def test_outstanding_drift(self):
        trades = [
            {
                "trade_id": "t1",
                "sell_price": 10000,
                "buy_price": 8000,
                "stored_margin_percent": 20.00,
                "total_amount": 10000,
                "amount_paid": 3000,
                "stored_outstanding": 5000.00,  # should be 7000
            }
        ]
        result = reconcile_trade_financials(trades)
        outstanding_drifts = [d for d in result.drift_records if d.field_name == "outstanding_amount"]
        self.assertEqual(len(outstanding_drifts), 1)
        self.assertEqual(outstanding_drifts[0].computed_value, Decimal("7000.00"))

    def test_net_exposure_drift(self):
        trades = [
            {
                "trade_id": "t1",
                "sell_price": 10000,
                "buy_price": 8000,
                "stored_margin_percent": 20.00,
                "total_amount": 10000,
                "amount_paid": 10000,
                "stored_outstanding": 0.00,
                "stored_net_exposure": 1000.00,
                "so_outstanding": 2000,
                "po_outstanding": 5000,  # net = 5000 - 2000 = 3000
            }
        ]
        result = reconcile_trade_financials(trades)
        exposure_drifts = [d for d in result.drift_records if d.field_name == "net_exposure"]
        self.assertEqual(len(exposure_drifts), 1)
        self.assertEqual(exposure_drifts[0].computed_value, Decimal("3000.00"))

    def test_multiple_trades(self):
        trades = [
            {
                "trade_id": "t1",
                "sell_price": 10000,
                "buy_price": 8000,
                "stored_margin_percent": 20.00,
                "total_amount": 10000,
                "amount_paid": 10000,
                "stored_outstanding": 0.00,
            },
            {
                "trade_id": "t2",
                "sell_price": 20000,
                "buy_price": 16000,
                "stored_margin_percent": 20.00,
                "total_amount": 20000,
                "amount_paid": 15000,
                "stored_outstanding": 5000.00,
            },
        ]
        result = reconcile_trade_financials(trades)
        self.assertEqual(result.records_checked, 2)
        self.assertTrue(result.success)

    def test_empty_trades(self):
        result = reconcile_trade_financials([])
        self.assertEqual(result.total_records, 0)
        self.assertEqual(result.records_checked, 0)
        self.assertTrue(result.success)

    def test_custom_thresholds(self):
        trades = [
            {
                "trade_id": "t1",
                "sell_price": 10000,
                "buy_price": 8000,
                "stored_margin_percent": 19.50,  # drift from 20%
                "total_amount": 10000,
                "amount_paid": 10000,
                "stored_outstanding": 0.00,
            }
        ]
        # With very low alert threshold, this should trigger
        result = reconcile_trade_financials(
            trades,
            alert_threshold=Decimal("0.001"),
            auto_correct_threshold=Decimal("5.0"),
        )
        self.assertGreater(result.drifts_detected, 0)
        self.assertGreater(result.auto_corrected, 0)  # below 5% so auto-correct

    def test_duration_tracked(self):
        result = reconcile_trade_financials([])
        self.assertIsInstance(result.duration_seconds, float)
        self.assertGreaterEqual(result.duration_seconds, 0)
