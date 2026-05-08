"""Canonical broker supplier matching for inquiry routing follow-up."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from django.db.models import Q

from tenant_apps.inquiries.models import InquiryRouteDecisionChoices, InquiryShippingTypeChoices
from tenant_apps.locations.models import Location
from tenant_apps.plants.models import Plant
from tenant_apps.suppliers.models import Supplier, SupplierAvailableItem, SupplierPlant

from apps.core.models import ShippingOfferedChoices


@dataclass(frozen=True)
class SupplierMatchFilters:
    """Optional commercial narrowing rules for supplier candidate matching."""

    require_contracts: bool = False
    require_export_documents: bool = False
    require_supplier_delivery: bool = False

    def with_inquiry_defaults(self, inquiry) -> "SupplierMatchFilters":
        """Apply any inquiry-driven narrowing without widening the explicit filter set."""

        return SupplierMatchFilters(
            require_contracts=self.require_contracts,
            require_export_documents=self.require_export_documents,
            require_supplier_delivery=(
                self.require_supplier_delivery
                or getattr(inquiry, "shipping_type", "") == InquiryShippingTypeChoices.SUPPLIER_DELIVERING
            ),
        )


@dataclass(frozen=True)
class SupplierMatchCandidate:
    """One ordered supplier candidate for a broker inquiry."""

    supplier_id: int
    supplier_name: str
    score: int
    reasons: tuple[str, ...]
    matched_plant_ids: tuple[int, ...] = ()
    matched_location_ids: tuple[int, ...] = ()
    has_active_available_item: bool = False
    shipping_offered: str = ""
    offer_contracts: bool = False
    export_capable: bool = False


@dataclass(frozen=True)
class SupplierMatchResult:
    """Structured result for broker supplier matching."""

    inquiry_id: int | None
    route_decision: str
    reason: str
    requested_master_product_id: int | None = None
    system_product_id: str | None = None
    requested_protein: str = ""
    candidate_count: int = 0
    candidates: tuple[SupplierMatchCandidate, ...] = ()


def _normalize_text(value: object) -> str:
    return str(value or "").strip().lower()


def _map_values(rows) -> dict[int, set[int]]:
    values = defaultdict(set)
    for supplier_id, related_id in rows:
        if supplier_id and related_id:
            values[int(supplier_id)].add(int(related_id))
    return values


def _set_from_values(values) -> set[int]:
    return {int(value) for value in values if value is not None}


def match_suppliers_for_inquiry(*, tenant, inquiry, filters: SupplierMatchFilters | None = None) -> SupplierMatchResult:
    """Return deterministic supplier candidates for a broker-routed inquiry."""

    if tenant is None:
        raise ValueError("Tenant context is required for supplier matching.")

    if inquiry is None:
        raise ValueError("Inquiry is required for supplier matching.")

    if getattr(inquiry, "tenant_id", None) != getattr(tenant, "id", None):
        return SupplierMatchResult(
            inquiry_id=getattr(inquiry, "id", None),
            route_decision=getattr(inquiry, "route_decision", ""),
            reason="cross_tenant_inquiry",
        )

    if inquiry.route_decision != InquiryRouteDecisionChoices.BROKER:
        return SupplierMatchResult(
            inquiry_id=inquiry.id,
            route_decision=inquiry.route_decision,
            reason="non_broker_inquiry",
        )

    requested_master_product = inquiry.requested_master_product
    if requested_master_product is None:
        return SupplierMatchResult(
            inquiry_id=inquiry.id,
            route_decision=inquiry.route_decision,
            reason="missing_master_product",
        )

    if getattr(requested_master_product, "tenant_id", None) != getattr(tenant, "id", None):
        return SupplierMatchResult(
            inquiry_id=inquiry.id,
            route_decision=inquiry.route_decision,
            reason="cross_tenant_master_product",
            requested_master_product_id=requested_master_product.id,
        )

    if not requested_master_product.is_active:
        return SupplierMatchResult(
            inquiry_id=inquiry.id,
            route_decision=inquiry.route_decision,
            reason="inactive_master_product",
            requested_master_product_id=requested_master_product.id,
        )

    system_product = requested_master_product.system_product
    if system_product is None:
        return SupplierMatchResult(
            inquiry_id=inquiry.id,
            route_decision=inquiry.route_decision,
            reason="unmapped_system_product",
            requested_master_product_id=requested_master_product.id,
        )

    if not system_product.is_active:
        return SupplierMatchResult(
            inquiry_id=inquiry.id,
            route_decision=inquiry.route_decision,
            reason="inactive_system_product",
            requested_master_product_id=requested_master_product.id,
            system_product_id=str(system_product.id),
        )

    requested_protein = inquiry.requested_protein or requested_master_product.protein
    requested_protein_normalized = _normalize_text(requested_protein)
    system_protein_normalized = _normalize_text(system_product.protein_type)
    if (
        requested_protein_normalized
        and system_protein_normalized
        and requested_protein_normalized != system_protein_normalized
    ):
        return SupplierMatchResult(
            inquiry_id=inquiry.id,
            route_decision=inquiry.route_decision,
            reason="protein_mismatch",
            requested_master_product_id=requested_master_product.id,
            system_product_id=str(system_product.id),
            requested_protein=str(requested_protein or ""),
        )

    active_available_supplier_ids = _set_from_values(
        SupplierAvailableItem.objects.filter(
            tenant=tenant,
            product=system_product,
            is_active=True,
            product__is_active=True,
        )
        .values_list("supplier_id", flat=True)
        .distinct()
    )

    direct_plant_matches = _map_values(
        Plant.objects.filter(
            tenant=tenant,
            is_active=True,
            supplier__isnull=False,
            supplier__tenant=tenant,
            associated_master_products=requested_master_product,
        )
        .values_list("supplier_id", "id")
        .distinct()
    )
    linked_plant_matches = _map_values(
        SupplierPlant.objects.filter(
            tenant=tenant,
            supplier__tenant=tenant,
            plant__tenant=tenant,
            plant__is_active=True,
            plant__associated_master_products=requested_master_product,
        )
        .values_list("supplier_id", "plant_id")
        .distinct()
    )
    matched_plant_ids = defaultdict(set)
    for source in (direct_plant_matches, linked_plant_matches):
        for supplier_id, plant_ids in source.items():
            matched_plant_ids[supplier_id].update(plant_ids)

    location_matches = _map_values(
        Location.objects.filter(
            tenant=tenant,
            is_active=True,
            supplier__isnull=False,
            supplier__tenant=tenant,
            associated_master_products=requested_master_product,
        )
        .values_list("supplier_id", "id")
        .distinct()
    )

    protein_supplier_ids = set()
    plant_protein_match_ids = defaultdict(set)
    if requested_protein_normalized:
        protein_supplier_ids = _set_from_values(
            Supplier.objects.filter(tenant=tenant)
            .filter(
                Q(preferred_protein_types__contains=[str(requested_protein)])
                | Q(proteins__name__iexact=str(requested_protein))
            )
            .values_list("id", flat=True)
            .distinct()
        )
        direct_plant_protein_matches = _map_values(
            Plant.objects.filter(
                tenant=tenant,
                is_active=True,
                supplier__isnull=False,
                supplier__tenant=tenant,
                proteins_offered__name__iexact=str(requested_protein),
            )
            .values_list("supplier_id", "id")
            .distinct()
        )
        linked_plant_protein_matches = _map_values(
            SupplierPlant.objects.filter(
                tenant=tenant,
                supplier__tenant=tenant,
                plant__tenant=tenant,
                plant__is_active=True,
                plant__proteins_offered__name__iexact=str(requested_protein),
            )
            .values_list("supplier_id", "plant_id")
            .distinct()
        )
        for source in (direct_plant_protein_matches, linked_plant_protein_matches):
            for supplier_id, plant_ids in source.items():
                plant_protein_match_ids[supplier_id].update(plant_ids)

    export_approved_plant_ids = defaultdict(set)
    for source in (
        _map_values(
            Plant.objects.filter(
                tenant=tenant,
                is_active=True,
                export_approved=True,
                supplier__isnull=False,
                supplier__tenant=tenant,
            )
            .values_list("supplier_id", "id")
            .distinct()
        ),
        _map_values(
            SupplierPlant.objects.filter(
                tenant=tenant,
                supplier__tenant=tenant,
                plant__tenant=tenant,
                plant__is_active=True,
                plant__export_approved=True,
            )
            .values_list("supplier_id", "plant_id")
            .distinct()
        ),
    ):
        for supplier_id, plant_ids in source.items():
            export_approved_plant_ids[supplier_id].update(plant_ids)

    candidate_supplier_ids = set(active_available_supplier_ids)
    candidate_supplier_ids.update(matched_plant_ids.keys())
    candidate_supplier_ids.update(location_matches.keys())
    candidate_supplier_ids.update(protein_supplier_ids)
    candidate_supplier_ids.update(plant_protein_match_ids.keys())

    if not candidate_supplier_ids:
        return SupplierMatchResult(
            inquiry_id=inquiry.id,
            route_decision=inquiry.route_decision,
            reason="no_supplier_candidates",
            requested_master_product_id=requested_master_product.id,
            system_product_id=str(system_product.id),
            requested_protein=str(requested_protein or ""),
        )

    applied_filters = (filters or SupplierMatchFilters()).with_inquiry_defaults(inquiry)
    suppliers = Supplier.objects.for_tenant(tenant).filter(id__in=candidate_supplier_ids).order_by("name", "id")

    candidates: list[SupplierMatchCandidate] = []
    for supplier in suppliers:
        supplier_reasons: list[str] = []
        score = 0

        if supplier.id in active_available_supplier_ids:
            supplier_reasons.append("active_available_item")
            score += 100
        if matched_plant_ids[supplier.id]:
            supplier_reasons.append("plant_master_product_affinity")
            score += 60
        if location_matches[supplier.id]:
            supplier_reasons.append("location_master_product_affinity")
            score += 50
        if supplier.id in protein_supplier_ids:
            supplier_reasons.append("supplier_protein_affinity")
            score += 20
        if plant_protein_match_ids[supplier.id]:
            supplier_reasons.append("plant_protein_affinity")
            score += 15

        if not supplier_reasons:
            continue

        if applied_filters.require_contracts and not supplier.offer_contracts:
            continue

        if applied_filters.require_supplier_delivery and supplier.shipping_offered in {
            "",
            ShippingOfferedChoices.NO,
            None,
        }:
            continue

        supplier_export_capable = supplier.offers_export_documents or bool(export_approved_plant_ids[supplier.id])
        if applied_filters.require_export_documents and not supplier_export_capable:
            continue

        candidates.append(
            SupplierMatchCandidate(
                supplier_id=supplier.id,
                supplier_name=supplier.name,
                score=score,
                reasons=tuple(supplier_reasons),
                matched_plant_ids=tuple(sorted(matched_plant_ids[supplier.id] | plant_protein_match_ids[supplier.id])),
                matched_location_ids=tuple(sorted(location_matches[supplier.id])),
                has_active_available_item=supplier.id in active_available_supplier_ids,
                shipping_offered=supplier.shipping_offered or "",
                offer_contracts=supplier.offer_contracts,
                export_capable=supplier_export_capable,
            )
        )

    ordered_candidates = tuple(
        sorted(
            candidates,
            key=lambda candidate: (-candidate.score, candidate.supplier_name.lower(), candidate.supplier_id),
        )
    )
    reason = "supplier_candidates_found" if ordered_candidates else "no_supplier_candidates"

    return SupplierMatchResult(
        inquiry_id=inquiry.id,
        route_decision=inquiry.route_decision,
        reason=reason,
        requested_master_product_id=requested_master_product.id,
        system_product_id=str(system_product.id),
        requested_protein=str(requested_protein or ""),
        candidate_count=len(ordered_candidates),
        candidates=ordered_candidates,
    )
