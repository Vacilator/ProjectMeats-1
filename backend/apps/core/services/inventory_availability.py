"""Canonical inventory availability routing for inquiry fulfill-vs-broker decisions."""

from __future__ import annotations

from dataclasses import dataclass

from tenant_apps.inquiries.models import InquiryRouteDecisionChoices
from tenant_apps.suppliers.models import SupplierAvailableItem


@dataclass(frozen=True)
class InventoryRouteEvaluation:
    """Structured result for availability-driven inquiry routing."""

    route_decision: str
    reason: str
    system_product_id: str | None = None
    available_supplier_count: int = 0


def _normalize_text(value: object) -> str:
    return str(value or "").strip().lower()


def evaluate_inquiry_route(
    *, tenant, requested_master_product=None, requested_protein: str = ""
) -> InventoryRouteEvaluation:
    """Return the deterministic route for an inquiry based on explicit availability only."""

    if tenant is None:
        raise ValueError("Tenant context is required for inventory routing.")

    if requested_master_product is None:
        return InventoryRouteEvaluation(
            route_decision=InquiryRouteDecisionChoices.BROKER,
            reason="missing_master_product",
        )

    if getattr(requested_master_product, "tenant_id", None) != getattr(tenant, "id", None):
        return InventoryRouteEvaluation(
            route_decision=InquiryRouteDecisionChoices.BROKER,
            reason="cross_tenant_master_product",
        )

    if not requested_master_product.is_active:
        return InventoryRouteEvaluation(
            route_decision=InquiryRouteDecisionChoices.BROKER,
            reason="inactive_master_product",
        )

    system_product = requested_master_product.system_product
    if system_product is None:
        return InventoryRouteEvaluation(
            route_decision=InquiryRouteDecisionChoices.BROKER,
            reason="unmapped_system_product",
        )

    requested_protein_normalized = _normalize_text(requested_protein or requested_master_product.protein)
    system_protein_normalized = _normalize_text(system_product.protein_type)
    if (
        system_protein_normalized
        and requested_protein_normalized
        and system_protein_normalized != requested_protein_normalized
    ):
        return InventoryRouteEvaluation(
            route_decision=InquiryRouteDecisionChoices.BROKER,
            reason="protein_mismatch",
            system_product_id=str(system_product.id),
        )

    supplier_count = (
        SupplierAvailableItem.objects.filter(
            tenant=tenant,
            product=system_product,
            is_active=True,
            product__is_active=True,
        )
        .values("supplier_id")
        .distinct()
        .count()
    )

    if supplier_count > 0:
        return InventoryRouteEvaluation(
            route_decision=InquiryRouteDecisionChoices.FULFILL,
            reason="active_supplier_available_item_match",
            system_product_id=str(system_product.id),
            available_supplier_count=supplier_count,
        )

    return InventoryRouteEvaluation(
        route_decision=InquiryRouteDecisionChoices.BROKER,
        reason="no_active_supplier_availability",
        system_product_id=str(system_product.id),
        available_supplier_count=0,
    )
