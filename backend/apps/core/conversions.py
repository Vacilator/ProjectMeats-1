"""Canonical trade invariants contract helpers.

This module defines the non-adopted contract constants for Phase 15 / B2B-02.1.
It intentionally avoids mutating existing runtime behavior; downstream tickets
roll these helpers out to backend services, exports, PDFs, and frontend
formatters once the audit contract is accepted.
"""

from __future__ import annotations

from datetime import datetime, timezone as dt_timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Final
from zoneinfo import ZoneInfo

from django.utils import timezone

TRADE_INVARIANTS_CONTRACT_VERSION: Final[str] = "b2b-02.1.v1"
CANONICAL_WEIGHT_BASE_UNIT: Final[str] = "lbs"
SUPPORTED_WEIGHT_UNITS: Final[tuple[str, str]] = ("lbs", "kg")
KG_TO_LBS_FACTOR: Final[Decimal] = Decimal("2.20462262")
LBS_TO_KG_FACTOR: Final[Decimal] = Decimal("0.45359237")
DEFAULT_WEIGHT_QUANTUM: Final[Decimal] = Decimal("0.01")

_WEIGHT_UNIT_ALIASES: Final[dict[str, str]] = {
    "lb": "lbs",
    "lbs": "lbs",
    "pound": "lbs",
    "pounds": "lbs",
    "kg": "kg",
    "kgs": "kg",
    "kilogram": "kg",
    "kilograms": "kg",
}


def normalize_weight_unit(unit: str | None) -> str:
    """Normalize user/model/display units to the canonical contract value."""

    if unit is None:
        raise ValueError("Weight unit is required.")

    normalized = unit.strip().lower()
    canonical = _WEIGHT_UNIT_ALIASES.get(normalized)
    if canonical is None:
        raise ValueError(f"Unsupported weight unit: {unit}")
    return canonical


def quantize_weight(
    value: Decimal,
    *,
    quantum: Decimal = DEFAULT_WEIGHT_QUANTUM,
) -> Decimal:
    """Quantize weight output for deterministic display or persistence."""

    return value.quantize(quantum, rounding=ROUND_HALF_UP)


def convert_weight(
    value: Decimal,
    from_unit: str,
    to_unit: str,
    *,
    quantum: Decimal | None = DEFAULT_WEIGHT_QUANTUM,
) -> Decimal:
    """Convert weights through the canonical pounds base unit using Decimal math."""

    source = normalize_weight_unit(from_unit)
    target = normalize_weight_unit(to_unit)

    if source == target:
        return quantize_weight(value, quantum=quantum) if quantum is not None else value

    pounds_value = value if source == CANONICAL_WEIGHT_BASE_UNIT else value * KG_TO_LBS_FACTOR
    converted = pounds_value if target == CANONICAL_WEIGHT_BASE_UNIT else pounds_value * LBS_TO_KG_FACTOR
    return quantize_weight(converted, quantum=quantum) if quantum is not None else converted


def ensure_utc(value: datetime) -> datetime:
    """Normalize a datetime to an aware UTC instant."""

    if timezone.is_naive(value):
        value = timezone.make_aware(value, timezone.get_default_timezone())
    return value.astimezone(dt_timezone.utc)


def render_in_timezone(value: datetime, timezone_name: str) -> datetime:
    """Render an aware instant into a named IANA timezone."""

    return ensure_utc(value).astimezone(ZoneInfo(timezone_name))
