"""Shared transactional serializer helpers for trade invariants."""

from __future__ import annotations

from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from apps.core.conversions import (
    DEFAULT_RENDER_TIMEZONE,
    coerce_decimal,
    convert_weight,
    format_trade_date,
    format_trade_datetime,
    normalize_weight_unit,
    quantize_weight,
    resolve_trade_timezone_name,
)


class TradeWeightPayloadSerializer(serializers.Serializer):
    """OpenAPI shape for additive normalized weight metadata."""

    entered_value = serializers.CharField()
    entered_unit = serializers.CharField()
    normalized_lbs = serializers.CharField()
    normalized_kg = serializers.CharField()


class TradeTimelinePayloadSerializer(serializers.Serializer):
    """OpenAPI shape for additive date/datetime trade metadata."""

    storage_timezone = serializers.CharField()
    render_timezone = serializers.CharField()
    datetime_fields = serializers.DictField(child=serializers.CharField())
    date_fields = serializers.DictField(child=serializers.CharField())


def build_trade_weight_payload(value, unit) -> dict[str, str] | None:
    """Return canonical additive API metadata for a weight field."""

    if value in (None, "") or not unit:
        return None

    canonical_unit = normalize_weight_unit(unit)
    numeric_value = coerce_decimal(value)
    return {
        "entered_value": str(quantize_weight(numeric_value)),
        "entered_unit": canonical_unit.upper(),
        "normalized_lbs": str(convert_weight(numeric_value, canonical_unit, "lbs")),
        "normalized_kg": str(convert_weight(numeric_value, canonical_unit, "kg")),
    }


def resolve_object_trade_timezone_name(instance) -> str:
    """Resolve an explicit related timezone, falling back to UTC safely."""

    for relation_name in ("plant", "pick_up_location", "delivery_location"):
        relation = getattr(instance, relation_name, None)
        if relation is None:
            continue
        for attr in ("timezone", "time_zone"):
            timezone_name = getattr(relation, attr, None)
            if timezone_name:
                return resolve_trade_timezone_name(str(timezone_name))
    return DEFAULT_RENDER_TIMEZONE


def build_trade_timeline_payload(
    instance,
    *,
    datetime_fields: tuple[str, ...],
    date_fields: tuple[str, ...],
) -> dict[str, object]:
    """Return additive API metadata for trade date and datetime semantics."""

    render_timezone = resolve_object_trade_timezone_name(instance)
    return {
        "storage_timezone": "UTC",
        "render_timezone": render_timezone,
        "datetime_fields": {
            field: format_trade_datetime(getattr(instance, field), timezone_name=render_timezone)
            for field in datetime_fields
            if getattr(instance, field, None)
        },
        "date_fields": {
            field: format_trade_date(getattr(instance, field), timezone_name=render_timezone)
            for field in date_fields
            if getattr(instance, field, None)
        },
    }


class TradeWeightSerializerMixin:
    """Additive serializer mixin for normalized trade weight metadata."""

    trade_weight_value_field: str | None = None
    trade_weight_unit_field: str | None = None

    @extend_schema_field(TradeWeightPayloadSerializer(allow_null=True))
    def get_trade_weight(self, obj):
        if not self.trade_weight_value_field or not self.trade_weight_unit_field:
            return None
        return build_trade_weight_payload(
            getattr(obj, self.trade_weight_value_field, None),
            getattr(obj, self.trade_weight_unit_field, None),
        )


class TradeTimelineSerializerMixin:
    """Additive serializer mixin for UTC/date-only trade semantics."""

    trade_datetime_fields: tuple[str, ...] = ()
    trade_date_fields: tuple[str, ...] = ()

    @extend_schema_field(TradeTimelinePayloadSerializer)
    def get_trade_timeline(self, obj):
        return build_trade_timeline_payload(
            obj,
            datetime_fields=self.trade_datetime_fields,
            date_fields=self.trade_date_fields,
        )
