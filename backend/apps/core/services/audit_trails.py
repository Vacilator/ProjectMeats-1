"""Audit trail helpers (diff + safe JSON normalization)."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any


def _normalize(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    try:
        # Django model instances
        pk = getattr(value, "pk", None)
        if pk is not None:
            return str(pk)
    except Exception:
        pass
    if isinstance(value, (list, tuple, set)):
        return [_normalize(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _normalize(v) for k, v in value.items()}
    return str(value)


def model_field_diff(*, before: Any, after: Any, ignore_fields: set[str]) -> dict[str, dict[str, Any]]:
    """Return per-field diff for simple model fields.

    Uses model._meta.fields (no M2M) and ignores common bookkeeping fields.
    """

    if before is None or after is None:
        return {}

    diffs: dict[str, dict[str, Any]] = {}
    for f in after._meta.fields:
        name = getattr(f, "name", None)
        if not name or name in ignore_fields:
            continue

        try:
            b = getattr(before, name)
            a = getattr(after, name)
        except Exception:
            continue

        nb = _normalize(b)
        na = _normalize(a)
        if nb != na:
            diffs[name] = {"from": nb, "to": na}

    return diffs
