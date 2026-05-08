"""
Product Anomaly Baseline Service
=================================

Provides a deterministic engine for evaluating whether submitted field values
deviate materially from tenant-specific historical baselines (90-day window).

The service computes per-product statistical baselines (mean, stddev, min, max,
sample count) and evaluates incoming values against configurable thresholds.

Key design decisions:
- Pure computation: no ORM calls inside; expects pre-aggregated historical data
- Tenant-safe: caller supplies tenant-scoped data only
- Additive-only: no changes to existing models or APIs
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from django.utils import timezone

from tenant_apps.invoices.models import Invoice, InvoiceStatus
from tenant_apps.purchase_orders.models import PurchaseOrder, PurchaseOrderStatus
from tenant_apps.sales_orders.models import SalesOrder, SalesOrderStatus

from apps.core.models import WeightUnitChoices

# -------------------------------------------------------------------
# Contract Types
# -------------------------------------------------------------------


@dataclass
class ProductBaseline:
    """90-day statistical baseline for a specific product + field combination."""

    product_id: str
    field_name: str
    mean: float
    stddev: float
    min_value: float
    max_value: float
    sample_count: int
    window_days: int = 90

    @property
    def is_sufficient(self) -> bool:
        """At least 5 data points required for reliable baseline."""
        return self.sample_count >= 5


@dataclass
class AnomalyThreshold:
    """Configurable threshold for anomaly detection.

    - warn_sigma: number of standard deviations before soft warning (default 2.0)
    - block_sigma: number of standard deviations before hard block (default 4.0)
    - min_absolute_deviation: minimum absolute difference to trigger (avoids noise)
    """

    warn_sigma: float = 2.0
    block_sigma: float = 4.0
    min_absolute_deviation: float = 0.01


@dataclass
class AnomalyCheckRequest:
    """Request to evaluate a single field value against its baseline."""

    product_id: str
    field_name: str
    submitted_value: float
    tenant_id: str


@dataclass
class AnomalyCheckResult:
    """Result of an anomaly evaluation."""

    product_id: str
    field_name: str
    submitted_value: float
    baseline_mean: float
    baseline_stddev: float
    deviation_sigma: float
    severity: str  # "normal", "warning", "critical"
    message: str
    baseline_context: dict = field(default_factory=dict)
    requires_confirmation: bool = False

    @property
    def is_anomalous(self) -> bool:
        return self.severity in ("warning", "critical")


@dataclass
class AnomalyEvaluationResponse:
    """Aggregated response for multiple field checks."""

    results: list[AnomalyCheckResult]
    has_warnings: bool = False
    has_critical: bool = False
    requires_confirmation: bool = False


# -------------------------------------------------------------------
# Default Thresholds per Field Type
# -------------------------------------------------------------------

DEFAULT_THRESHOLDS: dict[str, AnomalyThreshold] = {
    "unit_price": AnomalyThreshold(warn_sigma=2.0, block_sigma=4.0, min_absolute_deviation=0.50),
    "total_amount": AnomalyThreshold(warn_sigma=2.5, block_sigma=5.0, min_absolute_deviation=100.0),
    "weight": AnomalyThreshold(warn_sigma=2.0, block_sigma=4.0, min_absolute_deviation=0.5),
    "quantity": AnomalyThreshold(warn_sigma=2.5, block_sigma=5.0, min_absolute_deviation=1.0),
    "margin_percent": AnomalyThreshold(warn_sigma=1.5, block_sigma=3.0, min_absolute_deviation=2.0),
}

FALLBACK_THRESHOLD = AnomalyThreshold(warn_sigma=2.0, block_sigma=4.0, min_absolute_deviation=0.01)


# -------------------------------------------------------------------
# Historical baseline loading
# -------------------------------------------------------------------

HistoryLoader = Callable[[str, str, datetime], list[float]]

PURCHASE_ORDER_EXCLUDED_STATUSES = {
    PurchaseOrderStatus.DRAFT,
    PurchaseOrderStatus.CANCELLED,
}
SALES_ORDER_EXCLUDED_STATUSES = {
    SalesOrderStatus.DRAFT,
    SalesOrderStatus.CANCELLED,
}
INVOICE_EXCLUDED_STATUSES = {
    InvoiceStatus.DRAFT,
    InvoiceStatus.CANCELLED,
}


def _require_context(*, tenant_id: str, product_id: str, field_name: str) -> None:
    if not tenant_id:
        raise ValueError("tenant_id is required")
    if not product_id:
        raise ValueError("product_id is required")
    if not field_name:
        raise ValueError("field_name is required")


def _window_start(as_of: Optional[datetime], window_days: int) -> datetime:
    reference = as_of or timezone.now()
    if timezone.is_naive(reference):
        reference = timezone.make_aware(reference, timezone.get_current_timezone())
    return reference - timedelta(days=window_days)


def _as_float_list(raw_values) -> list[float]:
    values: list[float] = []
    for value in raw_values:
        if value is None:
            continue
        if isinstance(value, Decimal):
            values.append(float(value))
        else:
            values.append(float(value))
    return values


def _load_purchase_order_values(
    field_name: str,
    tenant_id: str,
    product_id: str,
    since: datetime,
) -> list[float]:
    queryset = (
        PurchaseOrder.objects.filter(
            tenant_id=tenant_id,
            product_id=product_id,
            order_date__gte=since.date(),
        )
        .exclude(status__in=PURCHASE_ORDER_EXCLUDED_STATUSES)
        .order_by("order_date", "id")
    )

    if field_name == "unit_price":
        return _as_float_list(queryset.values_list("price_per_unit", flat=True))
    if field_name == "total_amount":
        return _as_float_list(queryset.values_list("total_amount", flat=True))
    if field_name == "quantity":
        return _as_float_list(queryset.values_list("quantity", flat=True))
    if field_name == "weight":
        return _as_float_list(queryset.filter(weight_unit=WeightUnitChoices.LBS).values_list("total_weight", flat=True))
    return []


def _load_sales_order_values(
    field_name: str,
    tenant_id: str,
    product_id: str,
    since: datetime,
) -> list[float]:
    queryset = (
        SalesOrder.objects.filter(
            tenant_id=tenant_id,
            product_id=product_id,
            created_on__gte=since,
        )
        .exclude(status__in=SALES_ORDER_EXCLUDED_STATUSES)
        .order_by("created_on", "id")
    )

    if field_name == "total_amount":
        return _as_float_list(queryset.values_list("total_amount", flat=True))
    if field_name == "quantity":
        return _as_float_list(queryset.values_list("quantity", flat=True))
    if field_name == "weight":
        return _as_float_list(queryset.filter(weight_unit=WeightUnitChoices.LBS).values_list("total_weight", flat=True))
    return []


def _load_invoice_values(
    field_name: str,
    tenant_id: str,
    product_id: str,
    since: datetime,
) -> list[float]:
    queryset = (
        Invoice.objects.filter(
            tenant_id=tenant_id,
            product_id=product_id,
            created_on__gte=since,
        )
        .exclude(status__in=INVOICE_EXCLUDED_STATUSES)
        .order_by("created_on", "id")
    )

    if field_name == "unit_price":
        return _as_float_list(queryset.values_list("unit_price", flat=True))
    if field_name == "total_amount":
        return _as_float_list(queryset.values_list("total_amount", flat=True))
    if field_name == "quantity":
        return _as_float_list(queryset.values_list("quantity", flat=True))
    if field_name == "weight":
        return _as_float_list(queryset.filter(weight_unit=WeightUnitChoices.LBS).values_list("total_weight", flat=True))
    return []


FIELD_HISTORY_LOADERS: dict[str, tuple[HistoryLoader, ...]] = {
    "unit_price": (_load_purchase_order_values, _load_invoice_values),
    "total_amount": (
        _load_purchase_order_values,
        _load_sales_order_values,
        _load_invoice_values,
    ),
    "quantity": (
        _load_purchase_order_values,
        _load_sales_order_values,
        _load_invoice_values,
    ),
    "weight": (
        _load_purchase_order_values,
        _load_sales_order_values,
        _load_invoice_values,
    ),
}


def get_historical_field_values(
    *,
    tenant_id: str,
    product_id: str,
    field_name: str,
    as_of: Optional[datetime] = None,
    window_days: int = 90,
) -> list[float]:
    """Return deterministic 90-day historical values for one tenant-scoped product field."""
    _require_context(tenant_id=tenant_id, product_id=product_id, field_name=field_name)
    since = _window_start(as_of, window_days)
    values: list[float] = []
    for loader in FIELD_HISTORY_LOADERS.get(field_name, ()):
        values.extend(loader(field_name, tenant_id, product_id, since))
    values.sort()
    return values


def build_product_baseline(
    *,
    tenant_id: str,
    product_id: str,
    field_name: str,
    as_of: Optional[datetime] = None,
    window_days: int = 90,
) -> ProductBaseline:
    """Build a tenant-safe 90-day product baseline from committed transaction history."""
    values = get_historical_field_values(
        tenant_id=tenant_id,
        product_id=product_id,
        field_name=field_name,
        as_of=as_of,
        window_days=window_days,
    )
    return build_baseline_from_history(
        product_id=product_id,
        field_name=field_name,
        values=values,
        window_days=window_days,
    )


def evaluate_product_submission(
    *,
    tenant_id: str,
    product_id: str,
    submitted_fields: Mapping[str, float],
    thresholds: Optional[dict[str, AnomalyThreshold]] = None,
    as_of: Optional[datetime] = None,
    window_days: int = 90,
) -> AnomalyEvaluationResponse:
    """Evaluate submitted product values against tenant-specific baselines."""
    _require_context(tenant_id=tenant_id, product_id=product_id, field_name="submitted_fields")

    checks: list[tuple[float, ProductBaseline]] = []
    for field_name in sorted(submitted_fields):
        baseline = build_product_baseline(
            tenant_id=tenant_id,
            product_id=product_id,
            field_name=field_name,
            as_of=as_of,
            window_days=window_days,
        )
        checks.append((float(submitted_fields[field_name]), baseline))
    return evaluate_submission(checks, thresholds)


# -------------------------------------------------------------------
# Core Engine
# -------------------------------------------------------------------


def compute_deviation_sigma(value: float, mean: float, stddev: float) -> float:
    """Compute number of standard deviations from mean."""
    if stddev <= 0:
        # With zero variance, any different value is infinite deviation
        return float("inf") if abs(value - mean) > 0 else 0.0
    return abs(value - mean) / stddev


def evaluate_single_field(
    submitted_value: float,
    baseline: ProductBaseline,
    threshold: Optional[AnomalyThreshold] = None,
) -> AnomalyCheckResult:
    """Evaluate a single submitted value against its product baseline.

    Returns AnomalyCheckResult with severity classification.
    """
    if threshold is None:
        threshold = DEFAULT_THRESHOLDS.get(baseline.field_name, FALLBACK_THRESHOLD)

    # Insufficient data — cannot evaluate
    if not baseline.is_sufficient:
        return AnomalyCheckResult(
            product_id=baseline.product_id,
            field_name=baseline.field_name,
            submitted_value=submitted_value,
            baseline_mean=baseline.mean,
            baseline_stddev=baseline.stddev,
            deviation_sigma=0.0,
            severity="normal",
            message=f"Insufficient historical data ({baseline.sample_count} samples, need 5+)",
            baseline_context={
                "sample_count": baseline.sample_count,
                "window_days": baseline.window_days,
                "reason": "insufficient_data",
            },
        )

    deviation = compute_deviation_sigma(submitted_value, baseline.mean, baseline.stddev)
    absolute_diff = abs(submitted_value - baseline.mean)

    # Below minimum absolute deviation — not significant
    if absolute_diff < threshold.min_absolute_deviation:
        return AnomalyCheckResult(
            product_id=baseline.product_id,
            field_name=baseline.field_name,
            submitted_value=submitted_value,
            baseline_mean=baseline.mean,
            baseline_stddev=baseline.stddev,
            deviation_sigma=deviation,
            severity="normal",
            message="Value within normal range",
            baseline_context={
                "sample_count": baseline.sample_count,
                "window_days": baseline.window_days,
                "min": baseline.min_value,
                "max": baseline.max_value,
            },
        )

    # Critical threshold
    if deviation >= threshold.block_sigma:
        severity = "critical"
        direction = "above" if submitted_value > baseline.mean else "below"
        message = (
            f"{baseline.field_name} value {submitted_value:.2f} is {deviation:.1f}σ "
            f"{direction} the 90-day average of {baseline.mean:.2f} "
            f"(range: {baseline.min_value:.2f}–{baseline.max_value:.2f})"
        )
        requires_confirmation = True
    # Warning threshold
    elif deviation >= threshold.warn_sigma:
        severity = "warning"
        direction = "above" if submitted_value > baseline.mean else "below"
        message = (
            f"{baseline.field_name} value {submitted_value:.2f} is {deviation:.1f}σ "
            f"{direction} the 90-day average of {baseline.mean:.2f} "
            f"(range: {baseline.min_value:.2f}–{baseline.max_value:.2f})"
        )
        requires_confirmation = True
    else:
        severity = "normal"
        message = "Value within normal range"
        requires_confirmation = False

    return AnomalyCheckResult(
        product_id=baseline.product_id,
        field_name=baseline.field_name,
        submitted_value=submitted_value,
        baseline_mean=baseline.mean,
        baseline_stddev=baseline.stddev,
        deviation_sigma=deviation,
        severity=severity,
        message=message,
        baseline_context={
            "sample_count": baseline.sample_count,
            "window_days": baseline.window_days,
            "min": baseline.min_value,
            "max": baseline.max_value,
        },
        requires_confirmation=requires_confirmation,
    )


def evaluate_submission(
    checks: list[tuple[float, ProductBaseline]],
    thresholds: Optional[dict[str, AnomalyThreshold]] = None,
) -> AnomalyEvaluationResponse:
    """Evaluate multiple field values against their baselines.

    Args:
        checks: List of (submitted_value, baseline) tuples
        thresholds: Optional per-field threshold overrides

    Returns:
        AnomalyEvaluationResponse with all results and summary flags
    """
    results: list[AnomalyCheckResult] = []

    for submitted_value, baseline in checks:
        threshold = None
        if thresholds:
            threshold = thresholds.get(baseline.field_name)
        result = evaluate_single_field(submitted_value, baseline, threshold)
        results.append(result)

    has_warnings = any(r.severity == "warning" for r in results)
    has_critical = any(r.severity == "critical" for r in results)
    requires_confirmation = any(r.requires_confirmation for r in results)

    return AnomalyEvaluationResponse(
        results=results,
        has_warnings=has_warnings,
        has_critical=has_critical,
        requires_confirmation=requires_confirmation,
    )


def build_baseline_from_history(
    product_id: str,
    field_name: str,
    values: list[float],
    window_days: int = 90,
) -> ProductBaseline:
    """Build a ProductBaseline from a list of historical values.

    Pure computation — caller is responsible for tenant-scoped data selection.
    """
    n = len(values)
    if n == 0:
        return ProductBaseline(
            product_id=product_id,
            field_name=field_name,
            mean=0.0,
            stddev=0.0,
            min_value=0.0,
            max_value=0.0,
            sample_count=0,
            window_days=window_days,
        )

    mean = sum(values) / n
    min_val = min(values)
    max_val = max(values)

    if n < 2:
        stddev = 0.0
    else:
        variance = sum((v - mean) ** 2 for v in values) / (n - 1)
        stddev = variance**0.5

    return ProductBaseline(
        product_id=product_id,
        field_name=field_name,
        mean=mean,
        stddev=stddev,
        min_value=min_val,
        max_value=max_val,
        sample_count=n,
        window_days=window_days,
    )
