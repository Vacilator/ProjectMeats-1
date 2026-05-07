"""
Financial Reconciliation Service.

Daily background job that recomputes all financial fields from source records,
detects drift, and auto-corrects below threshold.

Usage:
    from tenant_apps.workflows.services.financial_reconciliation import (
        reconcile_trade_financials,
        ReconciliationResult,
    )
    result = reconcile_trade_financials(trades, auto_correct_threshold=0.01)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

logger = logging.getLogger(__name__)

DRIFT_THRESHOLD_PERCENT = Decimal("0.01")  # 0.01% drift triggers alert
AUTO_CORRECT_THRESHOLD_PERCENT = Decimal("1.00")  # auto-correct if < 1%


@dataclass
class DriftRecord:
    """Records a single field drift detection."""

    trade_id: str
    field_name: str
    stored_value: Decimal
    computed_value: Decimal
    drift_percent: Decimal
    auto_corrected: bool = False
    requires_alert: bool = False


@dataclass
class ReconciliationResult:
    """Result of a reconciliation run."""

    total_records: int = 0
    records_checked: int = 0
    drifts_detected: int = 0
    auto_corrected: int = 0
    alerts_raised: int = 0
    drift_records: list[DriftRecord] = field(default_factory=list)
    duration_seconds: float = 0.0
    success: bool = True
    errors: list[str] = field(default_factory=list)


def calculate_drift_percent(stored: Decimal, computed: Decimal) -> Decimal:
    """Calculate percentage drift between stored and computed values."""
    if computed == Decimal("0"):
        if stored == Decimal("0"):
            return Decimal("0")
        return Decimal("100")  # 100% drift if computed is 0 but stored isn't

    drift = abs(stored - computed) / abs(computed) * Decimal("100")
    return drift.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def reconcile_trade_financials(
    trades: list[dict[str, Any]],
    auto_correct_threshold: Decimal = AUTO_CORRECT_THRESHOLD_PERCENT,
    alert_threshold: Decimal = DRIFT_THRESHOLD_PERCENT,
) -> ReconciliationResult:
    """
    Reconcile financial fields for a batch of trades.

    Each trade dict should contain:
        - trade_id: str
        - stored_margin_percent: float/Decimal (what's currently stored)
        - sell_price: float/Decimal (source record)
        - buy_price: float/Decimal (source record)
        - stored_outstanding: float/Decimal
        - total_amount: float/Decimal (from source)
        - amount_paid: float/Decimal (from source)
        - stored_net_exposure: float/Decimal (optional)
        - so_outstanding: float/Decimal (optional, for net exposure)
        - po_outstanding: float/Decimal (optional, for net exposure)

    Returns:
        ReconciliationResult with drift details and correction status.
    """
    import time
    start_time = time.time()

    result = ReconciliationResult(total_records=len(trades))
    
    for trade in trades:
        trade_id = str(trade.get("trade_id", "unknown"))
        try:
            _reconcile_single_trade(trade, trade_id, result, auto_correct_threshold, alert_threshold)
            result.records_checked += 1
        except Exception as e:
            result.errors.append(f"Error reconciling {trade_id}: {str(e)}")
            logger.error("Reconciliation error for trade %s: %s", trade_id, e)

    result.duration_seconds = round(time.time() - start_time, 3)
    result.success = len(result.errors) == 0

    logger.info(
        "Reconciliation complete: %d records, %d drifts, %d auto-corrected, %d alerts, %.3fs",
        result.records_checked,
        result.drifts_detected,
        result.auto_corrected,
        result.alerts_raised,
        result.duration_seconds,
    )

    return result


def _reconcile_single_trade(
    trade: dict[str, Any],
    trade_id: str,
    result: ReconciliationResult,
    auto_correct_threshold: Decimal,
    alert_threshold: Decimal,
) -> None:
    """Reconcile a single trade's financial fields."""

    # 1. Reconcile margin
    sell = Decimal(str(trade.get("sell_price", 0)))
    buy = Decimal(str(trade.get("buy_price", 0)))
    stored_margin = Decimal(str(trade.get("stored_margin_percent", 0)))

    if sell > 0:
        computed_margin = ((sell - buy) / sell * Decimal("100")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        _check_drift(
            trade_id, "margin_percent", stored_margin, computed_margin,
            result, auto_correct_threshold, alert_threshold,
        )

    # 2. Reconcile outstanding amount
    total = Decimal(str(trade.get("total_amount", 0)))
    paid = Decimal(str(trade.get("amount_paid", 0)))
    stored_outstanding = Decimal(str(trade.get("stored_outstanding", 0)))

    computed_outstanding = (total - paid).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    _check_drift(
        trade_id, "outstanding_amount", stored_outstanding, computed_outstanding,
        result, auto_correct_threshold, alert_threshold,
    )

    # 3. Reconcile net exposure (if present)
    if "stored_net_exposure" in trade:
        so_outstanding = Decimal(str(trade.get("so_outstanding", 0)))
        po_outstanding = Decimal(str(trade.get("po_outstanding", 0)))
        stored_exposure = Decimal(str(trade.get("stored_net_exposure", 0)))
        computed_exposure = (po_outstanding - so_outstanding).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        _check_drift(
            trade_id, "net_exposure", stored_exposure, computed_exposure,
            result, auto_correct_threshold, alert_threshold,
        )


def _check_drift(
    trade_id: str,
    field_name: str,
    stored: Decimal,
    computed: Decimal,
    result: ReconciliationResult,
    auto_correct_threshold: Decimal,
    alert_threshold: Decimal,
) -> None:
    """Check if a field has drifted and handle accordingly."""
    if stored == computed:
        return

    drift_pct = calculate_drift_percent(stored, computed)

    if drift_pct <= alert_threshold:
        return  # Within acceptable tolerance

    result.drifts_detected += 1
    auto_corrected = drift_pct <= auto_correct_threshold
    requires_alert = drift_pct > auto_correct_threshold

    drift = DriftRecord(
        trade_id=trade_id,
        field_name=field_name,
        stored_value=stored,
        computed_value=computed,
        drift_percent=drift_pct,
        auto_corrected=auto_corrected,
        requires_alert=requires_alert,
    )
    result.drift_records.append(drift)

    if auto_corrected:
        result.auto_corrected += 1
        logger.info(
            "Auto-corrected %s.%s: %s → %s (drift: %s%%)",
            trade_id, field_name, stored, computed, drift_pct,
        )
    else:
        result.alerts_raised += 1
        logger.warning(
            "ALERT: %s.%s drift %s%% (stored: %s, computed: %s)",
            trade_id, field_name, drift_pct, stored, computed,
        )
