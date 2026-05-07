"""
Trading Performance Analytics Service for Process Cockpit.

Computes trading performance metrics from telemetry events and process data:
- Win rate by supplier
- Average margin trend
- Process cycle time
- Top contacts (by activity)
- Filterable by date range, trader, and workform run
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class SupplierWinRate:
    """Win rate statistics for a supplier."""

    supplier_id: str
    supplier_name: str
    bids_submitted: int = 0
    bids_won: int = 0
    win_rate: float = 0.0

    def calculate(self) -> None:
        if self.bids_submitted > 0:
            self.win_rate = round((self.bids_won / self.bids_submitted) * 100, 1)


@dataclass
class MarginDataPoint:
    """A single data point in the margin trend."""

    period: str  # YYYY-MM or YYYY-WW
    average_margin: float = 0.0
    trade_count: int = 0
    total_revenue: float = 0.0


@dataclass
class CycleTimeStats:
    """Process cycle time statistics."""

    average_days: float = 0.0
    median_days: float = 0.0
    min_days: float = 0.0
    max_days: float = 0.0
    total_completed: int = 0


@dataclass
class ContactActivity:
    """Activity metrics for a contact."""

    contact_id: str
    contact_name: str
    contact_type: str
    department: str = ""
    interactions: int = 0
    last_activity: str = ""


@dataclass
class AnalyticsFilter:
    """Filter parameters for analytics queries."""

    start_date: date | None = None
    end_date: date | None = None
    trader_id: str | None = None
    workform_run_id: str | None = None
    supplier_id: str | None = None
    customer_id: str | None = None

    @classmethod
    def last_30_days(cls) -> "AnalyticsFilter":
        return cls(
            start_date=date.today() - timedelta(days=30),
            end_date=date.today(),
        )

    @classmethod
    def last_90_days(cls) -> "AnalyticsFilter":
        return cls(
            start_date=date.today() - timedelta(days=90),
            end_date=date.today(),
        )


@dataclass
class AnalyticsDashboard:
    """Complete analytics dashboard data."""

    supplier_win_rates: list[SupplierWinRate] = field(default_factory=list)
    margin_trend: list[MarginDataPoint] = field(default_factory=list)
    cycle_time: CycleTimeStats = field(default_factory=CycleTimeStats)
    top_contacts: list[ContactActivity] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)


def compute_supplier_win_rates(
    bids: list[dict[str, Any]],
    filter_params: AnalyticsFilter | None = None,
) -> list[SupplierWinRate]:
    """
    Compute win rates per supplier from bid data.

    Args:
        bids: List of bid records with supplier_id, supplier_name, status, created_at
        filter_params: Optional date/trader filter
    """
    suppliers: dict[str, SupplierWinRate] = {}

    for bid in bids:
        if filter_params:
            bid_date = bid.get("created_at")
            if bid_date and filter_params.start_date:
                if isinstance(bid_date, str):
                    bid_date = date.fromisoformat(bid_date[:10])
                if bid_date < filter_params.start_date:
                    continue
            if bid_date and filter_params.end_date:
                if isinstance(bid_date, str):
                    bid_date = date.fromisoformat(bid_date[:10])
                if bid_date > filter_params.end_date:
                    continue

        sid = str(bid.get("supplier_id", ""))
        if sid not in suppliers:
            suppliers[sid] = SupplierWinRate(
                supplier_id=sid,
                supplier_name=bid.get("supplier_name", "Unknown"),
            )

        suppliers[sid].bids_submitted += 1
        if bid.get("status") in ("won", "accepted", "selected"):
            suppliers[sid].bids_won += 1

    result = list(suppliers.values())
    for s in result:
        s.calculate()

    return sorted(result, key=lambda x: x.win_rate, reverse=True)


def compute_margin_trend(
    trades: list[dict[str, Any]],
    period: str = "monthly",
    filter_params: AnalyticsFilter | None = None,
) -> list[MarginDataPoint]:
    """
    Compute average margin trend over time.

    Args:
        trades: List of trade records with sell_price, buy_price, completed_at
        period: "monthly" or "weekly"
        filter_params: Optional filter
    """
    buckets: dict[str, list[dict[str, Any]]] = {}

    for trade in trades:
        trade_date = trade.get("completed_at") or trade.get("created_at", "")
        if isinstance(trade_date, str) and len(trade_date) >= 10:
            d = date.fromisoformat(trade_date[:10])
        elif isinstance(trade_date, date):
            d = trade_date
        else:
            continue

        if filter_params:
            if filter_params.start_date and d < filter_params.start_date:
                continue
            if filter_params.end_date and d > filter_params.end_date:
                continue

        if period == "weekly":
            key = f"{d.isocalendar()[0]}-W{d.isocalendar()[1]:02d}"
        else:
            key = d.strftime("%Y-%m")

        buckets.setdefault(key, []).append(trade)

    result: list[MarginDataPoint] = []
    for period_key in sorted(buckets.keys()):
        period_trades = buckets[period_key]
        margins: list[float] = []
        total_rev = 0.0

        for t in period_trades:
            sell = float(t.get("sell_price", 0))
            buy = float(t.get("buy_price", 0))
            total_rev += sell
            if sell > 0:
                margins.append(((sell - buy) / sell) * 100)

        avg_margin = sum(margins) / len(margins) if margins else 0.0
        result.append(MarginDataPoint(
            period=period_key,
            average_margin=round(avg_margin, 2),
            trade_count=len(period_trades),
            total_revenue=round(total_rev, 2),
        ))

    return result


def compute_cycle_times(
    processes: list[dict[str, Any]],
    filter_params: AnalyticsFilter | None = None,
) -> CycleTimeStats:
    """
    Compute process cycle time statistics.

    Args:
        processes: List with started_at and completed_at dates
        filter_params: Optional filter
    """
    durations: list[float] = []

    for proc in processes:
        started = proc.get("started_at")
        completed = proc.get("completed_at")
        if not started or not completed:
            continue

        if isinstance(started, str):
            started = date.fromisoformat(started[:10])
        if isinstance(completed, str):
            completed = date.fromisoformat(completed[:10])

        if filter_params:
            if filter_params.start_date and completed < filter_params.start_date:
                continue
            if filter_params.end_date and completed > filter_params.end_date:
                continue

        days = (completed - started).days
        if days >= 0:
            durations.append(float(days))

    if not durations:
        return CycleTimeStats()

    durations.sort()
    n = len(durations)
    median_idx = n // 2
    median = (
        durations[median_idx]
        if n % 2 == 1
        else (durations[median_idx - 1] + durations[median_idx]) / 2
    )

    return CycleTimeStats(
        average_days=round(sum(durations) / n, 1),
        median_days=round(median, 1),
        min_days=durations[0],
        max_days=durations[-1],
        total_completed=n,
    )


def compute_top_contacts(
    interactions: list[dict[str, Any]],
    limit: int = 10,
    filter_params: AnalyticsFilter | None = None,
) -> list[ContactActivity]:
    """
    Compute most active contacts.

    Args:
        interactions: List with contact_id, contact_name, contact_type, timestamp
        limit: Max contacts to return
        filter_params: Optional filter
    """
    contacts: dict[str, ContactActivity] = {}

    for event in interactions:
        if filter_params:
            ts = event.get("timestamp", "")
            if isinstance(ts, str) and len(ts) >= 10:
                d = date.fromisoformat(ts[:10])
                if filter_params.start_date and d < filter_params.start_date:
                    continue
                if filter_params.end_date and d > filter_params.end_date:
                    continue

        cid = str(event.get("contact_id", ""))
        if cid not in contacts:
            contacts[cid] = ContactActivity(
                contact_id=cid,
                contact_name=event.get("contact_name", "Unknown"),
                contact_type=event.get("contact_type", ""),
                department=event.get("department", ""),
            )

        contacts[cid].interactions += 1
        contacts[cid].last_activity = event.get("timestamp", "")

    result = sorted(contacts.values(), key=lambda x: x.interactions, reverse=True)
    return result[:limit]


def build_analytics_dashboard(
    bids: list[dict[str, Any]],
    trades: list[dict[str, Any]],
    processes: list[dict[str, Any]],
    interactions: list[dict[str, Any]],
    filter_params: AnalyticsFilter | None = None,
) -> AnalyticsDashboard:
    """
    Build complete analytics dashboard from raw data.

    This is the main entry point for the trading analytics service.
    """
    win_rates = compute_supplier_win_rates(bids, filter_params)
    margin_trend = compute_margin_trend(trades, "monthly", filter_params)
    cycle_time = compute_cycle_times(processes, filter_params)
    top_contacts = compute_top_contacts(interactions, 10, filter_params)

    total_trades = sum(dp.trade_count for dp in margin_trend)
    avg_margin = (
        sum(dp.average_margin * dp.trade_count for dp in margin_trend) / total_trades
        if total_trades > 0
        else 0.0
    )

    summary = {
        "total_trades": total_trades,
        "average_margin": round(avg_margin, 2),
        "avg_cycle_days": cycle_time.average_days,
        "total_suppliers": len(win_rates),
        "top_win_rate": win_rates[0].win_rate if win_rates else 0.0,
        "total_interactions": sum(c.interactions for c in top_contacts),
    }

    return AnalyticsDashboard(
        supplier_win_rates=win_rates,
        margin_trend=margin_trend,
        cycle_time=cycle_time,
        top_contacts=top_contacts,
        summary=summary,
    )
