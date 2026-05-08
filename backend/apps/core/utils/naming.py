"""String naming helpers.

Shared primitives used across service modules.

These helpers are intentionally framework-agnostic (no Django imports) so they
can be used safely from both core and tenant_apps modules.
"""

from __future__ import annotations

import re

_CAMEL_1_RE = re.compile(r"(.)([A-Z][a-z]+)")
_CAMEL_2_RE = re.compile(r"([a-z0-9])([A-Z])")
_MULTI_UNDERSCORE_RE = re.compile(r"_+")


def to_snake_case(value: str) -> str:
    """Convert a string to snake_case.

    Handles:
    - CamelCase / PascalCase
    - hyphens/spaces

    Examples:
      "PurchaseOrder" -> "purchase_order"
      "purchaseOrder" -> "purchase_order"
      "purchase-order" -> "purchase_order"
    """

    raw = (value or "").strip()
    if not raw:
        return ""

    # Normalize separators first.
    raw = raw.replace("-", "_").replace(" ", "_")

    s1 = _CAMEL_1_RE.sub(r"\1_\2", raw)
    s2 = _CAMEL_2_RE.sub(r"\1_\2", s1)
    s2 = _MULTI_UNDERSCORE_RE.sub("_", s2)

    return s2.lower().strip("_")


def snake_to_pascal(value: str) -> str:
    """Convert snake_case to PascalCase."""

    raw = (value or "").strip("_")
    if not raw:
        return ""

    return "".join(word.capitalize() for word in raw.split("_") if word)


def normalize_field_name(value: str) -> str:
    """Normalize a field name for comparison (lowercase, spaces).

    Examples:
      "customer_name" -> "customer name"
      "CustomerName" -> "customer name"
      "first-name" -> "first name"
    """

    snake = to_snake_case(value)
    return snake.replace("_", " ").strip().lower()
