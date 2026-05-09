"""Dependency-Ordered Entity Creation Service.

Ensures related entities are created in the correct dependency order:
  1. Contact (no deps)
  2. Supplier / Plant / Location (may reference contacts)
  3. Customer (may reference contacts)
  4. Inquiry / Order / Payment (reference supplier + customer)

Used by the AI email ingestion pipeline to create all required
entities from a single extracted payload in safe topological order.
"""

from __future__ import annotations

import logging
from typing import Any

from django.db import transaction

logger = logging.getLogger("ai_assistant")

# Topological creation order — lower tier = create first
ENTITY_CREATION_ORDER: dict[str, int] = {
    "contact": 0,
    "location": 1,
    "supplier": 1,
    "plant": 2,
    "customer": 2,
    "inquiry": 3,
    "sales_order": 4,
    "purchase_order": 4,
    "payment": 5,
}


def resolve_creation_order(
    entity_drafts: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Sort entity drafts by dependency tier so parents are created first."""
    return sorted(
        entity_drafts,
        key=lambda d: ENTITY_CREATION_ORDER.get(d.get("entity_type", ""), 99),
    )


@transaction.atomic
def create_entities_in_order(
    tenant_id: str,
    entity_drafts: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Create multiple entities in dependency order within a single transaction.

    Each draft should have: entity_type, proposed_data, confidence.
    Returns list of results with created_id for each entity.
    """
    ordered = resolve_creation_order(entity_drafts)
    results: list[dict[str, Any]] = []
    created_ids: dict[str, str] = {}  # entity_type -> last created ID

    for draft in ordered:
        entity_type = draft.get("entity_type", "")
        proposed = dict(draft.get("proposed_data", {}))
        result: dict[str, Any] = {
            "entity_type": entity_type,
            "status": "skipped",
            "created_id": None,
        }

        # Link to previously created parent entities
        if entity_type in ("supplier", "plant", "customer"):
            if "contact" in created_ids and not proposed.get("contact_id"):
                proposed["contact_id"] = created_ids["contact"]
        if entity_type == "plant":
            if "supplier" in created_ids and not proposed.get("supplier_id"):
                proposed["supplier_id"] = created_ids["supplier"]
        if entity_type in ("inquiry", "sales_order", "purchase_order"):
            if "customer" in created_ids and not proposed.get("customer_id"):
                proposed["customer_id"] = created_ids["customer"]
            if "supplier" in created_ids and not proposed.get("supplier_id"):
                proposed["supplier_id"] = created_ids["supplier"]

        try:
            entity_id = _create_single_entity(tenant_id, entity_type, proposed)
            if entity_id:
                result["status"] = "created"
                result["created_id"] = entity_id
                created_ids[entity_type] = entity_id
            else:
                result["status"] = "unsupported"
        except Exception as exc:
            logger.warning(
                "Failed to create %s for tenant %s: %s",
                entity_type,
                tenant_id,
                exc,
            )
            result["status"] = "failed"
            result["error"] = str(exc)

        results.append(result)

    return results


def _create_single_entity(tenant_id: str, entity_type: str, data: dict[str, Any]) -> str | None:
    """Create a single entity using ORM. Returns entity ID or None."""
    from django.apps import apps as django_apps

    model_map = {
        "contact": ("contacts", "Contact"),
        "supplier": ("suppliers", "Supplier"),
        "plant": ("suppliers", "Plant"),
        "customer": ("customers", "Customer"),
    }

    mapping = model_map.get(entity_type)
    if not mapping:
        return None

    app_label, model_name = mapping
    try:
        Model = django_apps.get_model(app_label, model_name)
    except LookupError:
        logger.debug("Model %s.%s not found", app_label, model_name)
        return None

    data["tenant_id"] = tenant_id
    # Remove empty string values to avoid DB constraint issues
    clean_data = {k: v for k, v in data.items() if v not in (None, "")}

    try:
        obj = Model.objects.create(**clean_data)
        logger.info(
            "Created %s (id=%s) for tenant %s",
            entity_type,
            obj.pk,
            tenant_id,
        )
        return str(obj.pk)
    except Exception:
        raise
