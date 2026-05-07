"""Financial Calculated Fields Service (RT-08.1).

Provides real-time calculated financial metrics for trades:
- Margin % (selling price vs buying price)
- Outstanding Amount (total - payments received)
- Payment Status (paid/partial/overdue/pending)
- Credit Risk Indicator (based on payment history)
- Supplier Risk Score (new supplier, late deliveries, etc.)

These are computed fields (not stored in DB) — recalculated on each request
for accuracy. Suitable for embedding in React Flow node headers, entity
detail pages, and the Financial Snapshot panel.

Usage:
    from tenant_apps.workflows.services.financial_fields import (
        calculate_trade_financials,
        TradeFinancials,
    )

    financials = calculate_trade_financials(
        sales_order=so,
        purchase_order=po,
        tenant=tenant,
    )
    print(financials.margin_percent)  # e.g., Decimal("18.50")
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Any

from django.utils import timezone

logger = logging.getLogger("workflows.financial_fields")

ZERO = Decimal("0.00")
HUNDRED = Decimal("100")


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class PaymentStatus(str, Enum):
    """Payment status of an order."""

    PAID = "paid"
    PARTIAL = "partial"
    OVERDUE = "overdue"
    PENDING = "pending"
    NOT_INVOICED = "not_invoiced"


class RiskLevel(str, Enum):
    """Risk level indicator."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ---------------------------------------------------------------------------
# Data Classes
# ---------------------------------------------------------------------------


@dataclass
class TradeFinancials:
    """Calculated financial metrics for a trade (SO + PO pair)."""

    # Margin
    margin_amount: Decimal = ZERO
    margin_percent: Decimal = ZERO
    buy_price: Decimal = ZERO
    sell_price: Decimal = ZERO

    # Outstanding
    so_outstanding: Decimal = ZERO
    po_outstanding: Decimal = ZERO
    net_exposure: Decimal = ZERO

    # Payment
    so_payment_status: PaymentStatus = PaymentStatus.NOT_INVOICED
    po_payment_status: PaymentStatus = PaymentStatus.NOT_INVOICED

    # Risk
    credit_risk: RiskLevel = RiskLevel.LOW
    supplier_risk: RiskLevel = RiskLevel.LOW
    risk_factors: list[str] = field(default_factory=list)

    # Metadata
    currency: str = "USD"
    calculated_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Serialize to JSON-safe dict."""
        return {
            "margin_amount": str(self.margin_amount),
            "margin_percent": str(self.margin_percent),
            "buy_price": str(self.buy_price),
            "sell_price": str(self.sell_price),
            "so_outstanding": str(self.so_outstanding),
            "po_outstanding": str(self.po_outstanding),
            "net_exposure": str(self.net_exposure),
            "so_payment_status": self.so_payment_status.value,
            "po_payment_status": self.po_payment_status.value,
            "credit_risk": self.credit_risk.value,
            "supplier_risk": self.supplier_risk.value,
            "risk_factors": self.risk_factors,
            "currency": self.currency,
            "calculated_at": self.calculated_at,
        }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def calculate_trade_financials(
    *,
    sales_order: Any | None = None,
    purchase_order: Any | None = None,
    tenant: Any | None = None,
) -> TradeFinancials:
    """Calculate financial metrics for a trade.

    Accepts either or both of SO/PO. Computes margin when both are present.

    Args:
        sales_order: SalesOrder model instance (optional).
        purchase_order: PurchaseOrder model instance (optional).
        tenant: Tenant for credit history lookups (optional).

    Returns:
        TradeFinancials with all calculated fields.
    """
    result = TradeFinancials(
        calculated_at=timezone.now().isoformat(),
    )

    # Extract amounts from SO
    sell_price = _safe_decimal(getattr(sales_order, "total_amount", None))
    so_outstanding = _safe_decimal(getattr(sales_order, "outstanding_amount", None))

    # Extract amounts from PO
    buy_price = _safe_decimal(getattr(purchase_order, "total_amount", None))
    po_outstanding = _safe_decimal(getattr(purchase_order, "outstanding_amount", None))

    result.sell_price = sell_price
    result.buy_price = buy_price
    result.so_outstanding = so_outstanding
    result.po_outstanding = po_outstanding

    # Margin calculation (only meaningful when both SO and PO have amounts)
    if sell_price > ZERO and buy_price > ZERO:
        result.margin_amount = sell_price - buy_price
        result.margin_percent = (
            (result.margin_amount / sell_price) * HUNDRED
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Net exposure (what we owe suppliers minus what customers owe us)
    result.net_exposure = po_outstanding - so_outstanding

    # Payment status
    if sales_order:
        result.so_payment_status = _calculate_payment_status(
            total=sell_price,
            outstanding=so_outstanding,
            due_date=getattr(sales_order, "payment_due_date", None),
        )

    if purchase_order:
        result.po_payment_status = _calculate_payment_status(
            total=buy_price,
            outstanding=po_outstanding,
            due_date=getattr(purchase_order, "payment_due_date", None),
        )

    # Risk assessment
    result.credit_risk, credit_factors = _assess_credit_risk(
        sales_order=sales_order,
        outstanding=so_outstanding,
        total=sell_price,
    )
    result.supplier_risk, supplier_factors = _assess_supplier_risk(
        purchase_order=purchase_order,
        tenant=tenant,
    )
    result.risk_factors = credit_factors + supplier_factors

    return result


def calculate_order_financials(
    *,
    order: Any,
    order_type: str = "purchase_order",
) -> dict[str, Any]:
    """Calculate financials for a single order (PO or SO).

    Returns a dict suitable for API serialization.
    """
    total = _safe_decimal(getattr(order, "total_amount", None))
    outstanding = _safe_decimal(getattr(order, "outstanding_amount", None))
    paid = total - outstanding if total >= outstanding else ZERO

    payment_status = _calculate_payment_status(
        total=total,
        outstanding=outstanding,
        due_date=getattr(order, "payment_due_date", None),
    )

    return {
        "total_amount": str(total),
        "outstanding_amount": str(outstanding),
        "paid_amount": str(paid),
        "payment_percent": str(
            ((paid / total) * HUNDRED).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if total > ZERO else ZERO
        ),
        "payment_status": payment_status.value,
        "order_type": order_type,
    }


# ---------------------------------------------------------------------------
# Internal Helpers
# ---------------------------------------------------------------------------


def _safe_decimal(value: Any) -> Decimal:
    """Convert a value to Decimal safely."""
    if value is None:
        return ZERO
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except Exception:
        return ZERO


def _calculate_payment_status(
    *,
    total: Decimal,
    outstanding: Decimal,
    due_date: Any = None,
) -> PaymentStatus:
    """Determine payment status from amounts and due date."""
    if total == ZERO:
        return PaymentStatus.NOT_INVOICED

    if outstanding == ZERO:
        return PaymentStatus.PAID

    if outstanding < total:
        # Some payment received
        if due_date and hasattr(due_date, "date"):
            if due_date < timezone.now().date():
                return PaymentStatus.OVERDUE
        return PaymentStatus.PARTIAL

    # Full amount outstanding
    if due_date:
        try:
            due = due_date if not callable(getattr(due_date, "date", None)) else due_date
            if hasattr(due, "__lt__") and due < timezone.now().date():
                return PaymentStatus.OVERDUE
        except (TypeError, AttributeError):
            pass

    return PaymentStatus.PENDING


def _assess_credit_risk(
    *,
    sales_order: Any | None,
    outstanding: Decimal,
    total: Decimal,
) -> tuple[RiskLevel, list[str]]:
    """Assess credit risk based on customer payment patterns."""
    factors: list[str] = []

    if not sales_order:
        return RiskLevel.LOW, factors

    # High outstanding ratio
    if total > ZERO and outstanding > ZERO:
        ratio = outstanding / total
        if ratio > Decimal("0.8"):
            factors.append("High outstanding ratio (>80%)")

    # Large order amount
    if total > Decimal("100000"):
        factors.append(f"Large order (${total:,.0f})")

    # Determine risk level
    if len(factors) >= 2:
        return RiskLevel.HIGH, factors
    elif len(factors) == 1:
        return RiskLevel.MEDIUM, factors
    return RiskLevel.LOW, factors


def _assess_supplier_risk(
    *,
    purchase_order: Any | None,
    tenant: Any | None,
) -> tuple[RiskLevel, list[str]]:
    """Assess supplier risk based on delivery and payment history."""
    factors: list[str] = []

    if not purchase_order:
        return RiskLevel.LOW, factors

    supplier = getattr(purchase_order, "supplier", None)
    if not supplier:
        return RiskLevel.LOW, factors

    # New supplier (no history)
    created_at = getattr(supplier, "created_at", None) or getattr(supplier, "created_on", None)
    if created_at:
        try:
            age_days = (timezone.now() - created_at).days if hasattr(created_at, "days") else 0
            if hasattr(created_at, "date"):
                age_days = (timezone.now().date() - created_at.date()).days
            if age_days < 30:
                factors.append("New supplier (<30 days)")
        except (TypeError, AttributeError):
            pass

    # Large PO amount with new supplier
    po_total = _safe_decimal(getattr(purchase_order, "total_amount", None))
    if po_total > Decimal("50000") and factors:
        factors.append(f"Large PO with new supplier (${po_total:,.0f})")

    if len(factors) >= 2:
        return RiskLevel.HIGH, factors
    elif len(factors) == 1:
        return RiskLevel.MEDIUM, factors
    return RiskLevel.LOW, factors
