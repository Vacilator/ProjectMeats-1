from __future__ import annotations

from django.apps import apps

from apps.core.utils.naming import to_snake_case

ENTITY_MODEL_MAP: dict[str, tuple[str, str]] = {
    "customer": ("customers", "Customer"),
    "supplier": ("suppliers", "Supplier"),
    "plant": ("plants", "Plant"),
    "location": ("locations", "Location"),
    "product": ("system", "Product"),
    "contact": ("contacts", "Contact"),
    "carrier": ("carriers", "Carrier"),
    "purchase_order": ("purchase_orders", "PurchaseOrder"),
    "sales_order": ("sales_orders", "SalesOrder"),
    "invoice": ("invoices", "Invoice"),
    "inquiry": ("inquiries", "Inquiry"),
    "claim": ("invoices", "Claim"),
    "fulfillment": ("fulfillments", "Fulfillment"),
    "call": ("cockpit", "ScheduledCall"),
    "tenant_user": ("tenants", "TenantUser"),
}


def normalize_entity_type(raw_type: str) -> str:
    candidate = str(raw_type or "").strip()
    if not candidate:
        raise ValueError("Entity type is required")

    candidate_lc = candidate.replace("-", "_").lower()
    if candidate_lc in ENTITY_MODEL_MAP:
        return candidate_lc

    snake = to_snake_case(candidate)
    if snake in ENTITY_MODEL_MAP:
        return snake
    if snake.endswith("s") and snake[:-1] in ENTITY_MODEL_MAP:
        return snake[:-1]

    for entity_type, (app_label, model_name) in ENTITY_MODEL_MAP.items():
        if candidate_lc == app_label.lower() or candidate_lc == model_name.lower():
            return entity_type

    raise ValueError(f"Unknown entity type: {raw_type}")


def get_entity_model(entity_type: str):
    resolved_type = normalize_entity_type(entity_type)
    app_label, model_name = ENTITY_MODEL_MAP[resolved_type]
    try:
        model = apps.get_model(app_label, model_name)
    except LookupError as exc:  # pragma: no cover
        raise LookupError(f"Model not found: {app_label}.{model_name}") from exc
    return resolved_type, model


def resolve_entity_for_tenant(*, tenant, entity_type: str, entity_id):
    resolved_type, model = get_entity_model(entity_type)

    if hasattr(model, "tenant"):
        if tenant is None:
            raise ValueError("Tenant context required")
        entity = model.objects.filter(tenant=tenant).get(pk=entity_id)
    else:
        entity = model.objects.get(pk=entity_id)

    return resolved_type, model, entity
