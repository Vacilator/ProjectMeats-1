"""Tests for trading performance analytics service."""

from datetime import date, timedelta
from unittest import TestCase

from tenant_apps.workflows.services.trading_analytics import (
    AnalyticsFilter,
    SupplierWinRate,
    build_analytics_dashboard,
    compute_cycle_times,
    compute_margin_trend,
    compute_supplier_win_rates,
    compute_top_contacts,
)


class TestSupplierWinRates(TestCase):
    """Test supplier win rate calculation."""

    def setUp(self):
        self.bids = [
            {"supplier_id": "s1", "supplier_name": "Alpha Corp", "status": "won", "created_at": "2025-04-01"},
            {"supplier_id": "s1", "supplier_name": "Alpha Corp", "status": "lost", "created_at": "2025-04-05"},
            {"supplier_id": "s1", "supplier_name": "Alpha Corp", "status": "won", "created_at": "2025-04-10"},
            {"supplier_id": "s2", "supplier_name": "Beta LLC", "status": "lost", "created_at": "2025-04-02"},
            {"supplier_id": "s2", "supplier_name": "Beta LLC", "status": "lost", "created_at": "2025-04-08"},
            {"supplier_id": "s3", "supplier_name": "Gamma Inc", "status": "selected", "created_at": "2025-04-03"},
        ]

    def test_basic_win_rates(self):
        result = compute_supplier_win_rates(self.bids)
        self.assertEqual(len(result), 3)
        # s3 100%, s1 66.7%, s2 0%
        self.assertEqual(result[0].supplier_name, "Gamma Inc")
        self.assertEqual(result[0].win_rate, 100.0)
        self.assertEqual(result[1].supplier_id, "s1")
        self.assertAlmostEqual(result[1].win_rate, 66.7, places=1)
        self.assertEqual(result[2].win_rate, 0.0)

    def test_date_filter(self):
        f = AnalyticsFilter(start_date=date(2025, 4, 5), end_date=date(2025, 4, 10))
        result = compute_supplier_win_rates(self.bids, f)
        # Only bids from 4/5 to 4/10: s1 lost + won, s2 lost, no s3
        s1 = next(r for r in result if r.supplier_id == "s1")
        self.assertEqual(s1.bids_submitted, 2)
        self.assertEqual(s1.bids_won, 1)

    def test_empty_bids(self):
        result = compute_supplier_win_rates([])
        self.assertEqual(result, [])


class TestMarginTrend(TestCase):
    """Test margin trend calculation."""

    def setUp(self):
        self.trades = [
            {"sell_price": 10000, "buy_price": 8000, "completed_at": "2025-01-15"},
            {"sell_price": 15000, "buy_price": 12000, "completed_at": "2025-01-20"},
            {"sell_price": 20000, "buy_price": 18000, "completed_at": "2025-02-10"},
            {"sell_price": 5000, "buy_price": 4000, "completed_at": "2025-02-25"},
        ]

    def test_monthly_buckets(self):
        result = compute_margin_trend(self.trades, "monthly")
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].period, "2025-01")
        self.assertEqual(result[0].trade_count, 2)
        self.assertEqual(result[1].period, "2025-02")
        self.assertEqual(result[1].trade_count, 2)

    def test_margin_calculation(self):
        result = compute_margin_trend(self.trades, "monthly")
        # Jan: (10000-8000)/10000=20%, (15000-12000)/15000=20% -> avg 20%
        self.assertAlmostEqual(result[0].average_margin, 20.0, places=1)
        # Feb: (20000-18000)/20000=10%, (5000-4000)/5000=20% -> avg 15%
        self.assertAlmostEqual(result[1].average_margin, 15.0, places=1)

    def test_revenue_tracking(self):
        result = compute_margin_trend(self.trades, "monthly")
        self.assertEqual(result[0].total_revenue, 25000.0)  # 10k + 15k
        self.assertEqual(result[1].total_revenue, 25000.0)  # 20k + 5k

    def test_date_filter(self):
        f = AnalyticsFilter(start_date=date(2025, 2, 1))
        result = compute_margin_trend(self.trades, "monthly", f)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].period, "2025-02")

    def test_empty_trades(self):
        result = compute_margin_trend([])
        self.assertEqual(result, [])


class TestCycleTimes(TestCase):
    """Test process cycle time statistics."""

    def setUp(self):
        self.processes = [
            {"started_at": "2025-01-01", "completed_at": "2025-01-05"},  # 4 days
            {"started_at": "2025-01-10", "completed_at": "2025-01-17"},  # 7 days
            {"started_at": "2025-01-20", "completed_at": "2025-01-22"},  # 2 days
            {"started_at": "2025-02-01", "completed_at": "2025-02-11"},  # 10 days
        ]

    def test_basic_stats(self):
        result = compute_cycle_times(self.processes)
        self.assertEqual(result.total_completed, 4)
        self.assertEqual(result.min_days, 2.0)
        self.assertEqual(result.max_days, 10.0)
        self.assertAlmostEqual(result.average_days, 5.8, places=1)

    def test_median_odd_count(self):
        processes = self.processes[:3]  # 2, 4, 7
        result = compute_cycle_times(processes)
        self.assertEqual(result.median_days, 4.0)

    def test_median_even_count(self):
        result = compute_cycle_times(self.processes)  # 2, 4, 7, 10
        self.assertEqual(result.median_days, 5.5)

    def test_skips_incomplete(self):
        self.processes.append({"started_at": "2025-03-01", "completed_at": None})
        result = compute_cycle_times(self.processes)
        self.assertEqual(result.total_completed, 4)

    def test_empty(self):
        result = compute_cycle_times([])
        self.assertEqual(result.average_days, 0.0)
        self.assertEqual(result.total_completed, 0)


class TestTopContacts(TestCase):
    """Test top contacts computation."""

    def setUp(self):
        self.interactions = [
            {"contact_id": "c1", "contact_name": "Alice", "contact_type": "Sales", "timestamp": "2025-04-01"},
            {"contact_id": "c1", "contact_name": "Alice", "contact_type": "Sales", "timestamp": "2025-04-02"},
            {"contact_id": "c1", "contact_name": "Alice", "contact_type": "Sales", "timestamp": "2025-04-03"},
            {"contact_id": "c2", "contact_name": "Bob", "contact_type": "Accounting", "timestamp": "2025-04-01"},
            {"contact_id": "c3", "contact_name": "Carol", "contact_type": "Logistics", "timestamp": "2025-04-05"},
            {"contact_id": "c3", "contact_name": "Carol", "contact_type": "Logistics", "timestamp": "2025-04-06"},
        ]

    def test_sorted_by_interactions(self):
        result = compute_top_contacts(self.interactions)
        self.assertEqual(result[0].contact_name, "Alice")
        self.assertEqual(result[0].interactions, 3)
        self.assertEqual(result[1].contact_name, "Carol")
        self.assertEqual(result[1].interactions, 2)
        self.assertEqual(result[2].contact_name, "Bob")
        self.assertEqual(result[2].interactions, 1)

    def test_limit(self):
        result = compute_top_contacts(self.interactions, limit=2)
        self.assertEqual(len(result), 2)

    def test_preserves_contact_type(self):
        result = compute_top_contacts(self.interactions)
        alice = result[0]
        self.assertEqual(alice.contact_type, "Sales")


class TestBuildDashboard(TestCase):
    """Test full dashboard assembly."""

    def test_builds_complete_dashboard(self):
        bids = [
            {"supplier_id": "s1", "supplier_name": "Alpha", "status": "won", "created_at": "2025-03-01"},
            {"supplier_id": "s1", "supplier_name": "Alpha", "status": "lost", "created_at": "2025-03-05"},
        ]
        trades = [
            {"sell_price": 10000, "buy_price": 8000, "completed_at": "2025-03-10"},
        ]
        processes = [
            {"started_at": "2025-03-01", "completed_at": "2025-03-10"},
        ]
        interactions = [
            {"contact_id": "c1", "contact_name": "Alice", "contact_type": "Sales", "timestamp": "2025-03-05"},
        ]

        dashboard = build_analytics_dashboard(bids, trades, processes, interactions)

        self.assertEqual(len(dashboard.supplier_win_rates), 1)
        self.assertEqual(dashboard.supplier_win_rates[0].win_rate, 50.0)
        self.assertEqual(len(dashboard.margin_trend), 1)
        self.assertAlmostEqual(dashboard.margin_trend[0].average_margin, 20.0)
        self.assertEqual(dashboard.cycle_time.average_days, 9.0)
        self.assertEqual(len(dashboard.top_contacts), 1)
        self.assertEqual(dashboard.summary["total_trades"], 1)

    def test_empty_data(self):
        dashboard = build_analytics_dashboard([], [], [], [])
        self.assertEqual(dashboard.summary["total_trades"], 0)
        self.assertEqual(dashboard.cycle_time.total_completed, 0)
