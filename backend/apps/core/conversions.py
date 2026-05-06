"""Canonical trade invariants service helpers."""

from __future__ import annotations

from datetime import date, datetime, timezone as dt_timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Final
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone

TRADE_INVARIANTS_CONTRACT_VERSION: Final[str] = "b2b-02.1.v1"
TRADE_ENGINE_SERVICE_VERSION: Final[str] = "b2b-02.2.v1"
CANONICAL_WEIGHT_BASE_UNIT: Final[str] = "lbs"
SUPPORTED_WEIGHT_UNITS: Final[tuple[str, str]] = ("lbs", "kg")
KG_TO_LBS_FACTOR: Final[Decimal] = Decimal("2.20462262")
LBS_TO_KG_FACTOR: Final[Decimal] = Decimal("0.45359237")
DEFAULT_WEIGHT_QUANTUM: Final[Decimal] = Decimal("0.01")
DEFAULT_RENDER_TIMEZONE: Final[str] = "UTC"

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


def coerce_decimal(value: Decimal | int | float | str) -> Decimal:
    """Convert supported numeric input to Decimal deterministically."""

    if isinstance(value, Decimal):
        return value
    if isinstance(value, int):
        return Decimal(value)
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, str):
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Decimal value is required.")
        try:
            return Decimal(trimmed)
        except InvalidOperation as exc:
            raise ValueError(f"Invalid decimal value: {value}") from exc
    raise TypeError(f"Unsupported numeric type: {type(value)!r}")


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


def format_trade_weight(
    value: Decimal | int | float | str | None,
    unit: str | None,
    *,
    to_unit: str | None = None,
    quantum: Decimal = DEFAULT_WEIGHT_QUANTUM,
) -> str:
    """Render a weight with deterministic conversion and canonical unit labels."""

    if value in (None, ""):
        return ""

    if not unit and not to_unit:
        return str(quantize_weight(coerce_decimal(value), quantum=quantum))

    source_unit = normalize_weight_unit(unit or to_unit)
    target_unit = normalize_weight_unit(to_unit or source_unit)
    rendered_value = convert_weight(coerce_decimal(value), source_unit, target_unit, quantum=quantum)
    return f"{rendered_value} {target_unit.upper()}"


def ensure_utc(value: datetime) -> datetime:
    """Normalize a datetime to an aware UTC instant."""

    if timezone.is_naive(value):
        value = timezone.make_aware(value, timezone.get_default_timezone())
    return value.astimezone(dt_timezone.utc)


def resolve_trade_timezone_name(timezone_name: str | None = None) -> str:
    """Resolve the explicit trade render timezone, defaulting safely to UTC."""

    if timezone_name is None or not str(timezone_name).strip():
        return DEFAULT_RENDER_TIMEZONE
    candidate = str(timezone_name).strip()
    try:
        ZoneInfo(candidate)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"Unsupported timezone: {timezone_name}") from exc
    return candidate


def render_in_timezone(value: datetime, timezone_name: str | None = None) -> datetime:
    """Render an aware instant into a named IANA timezone."""

    return ensure_utc(value).astimezone(ZoneInfo(resolve_trade_timezone_name(timezone_name)))


def format_trade_datetime(
    value: datetime | None,
    *,
    timezone_name: str | None = None,
    include_timezone: bool = True,
) -> str:
    """Format an instant for exports/PDFs using the canonical trade contract."""

    if value is None:
        return ""

    rendered = render_in_timezone(value, timezone_name)
    format_string = "%Y-%m-%d %H:%M %Z" if include_timezone else "%Y-%m-%d %H:%M"
    return rendered.strftime(format_string)


def format_trade_date(
    value: date | datetime | None,
    *,
    timezone_name: str | None = None,
) -> str:
    """Format a trade date without shifting calendar-only values."""

    if value is None:
        return ""
    if isinstance(value, datetime):
        return render_in_timezone(value, timezone_name).date().isoformat()
    return value.isoformat()


def normalize_temporal_for_export(
    value: date | datetime | None,
    *,
    timezone_name: str | None = None,
) -> str:
    """Render date/datetime values for CSV/export surfaces safely."""

    if value is None:
        return ""
    if isinstance(value, datetime):
        return render_in_timezone(value, timezone_name).isoformat()
    return format_trade_date(value, timezone_name=timezone_name)
