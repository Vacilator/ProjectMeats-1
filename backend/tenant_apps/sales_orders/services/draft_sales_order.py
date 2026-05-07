"""Create tenant-safe draft sales orders from fulfilled inquiries or approved supplier sourcing."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.tenants.rls import tenant_rls
from tenant_apps.inquiries.models import Inquiry, InquiryRouteDecisionChoices
from tenant_apps.purchase_orders.models import PurchaseOrder, PurchaseOrderStatus
from tenant_apps.sales_orders.models import SalesOrder, SalesOrderStatus

logger = logging.getLogger(__name__)


class DraftSalesOrderError(ValueError):
    """Stable error raised when a draft sales order cannot be created safely."""


@dataclass(frozen=True)
class DraftSalesOrderResult:
    """Return value for draft sales order creation."""

    sales_order: SalesOrder
    created: bool
    source_type: str  # "fulfill" or "approved_source"


def create_draft_from_fulfill(
    *,
    tenant: Any,
    inquiry: Inquiry,
) -> DraftSalesOrderResult:
    """Create or return the draft sales order for a FULFILL-routed inquiry.

    FULFILL inquiries skip supplier brokerage and go straight to draft sales
    order creation. The SO is populated from the inquiry's customer, product,
    and contact data.
    """

    with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
        inquiry = (
            Inquiry.objects.select_for_update(of=("self",))
            .select_related(
                "customer",
                "supplier",
                "contact",
                "requested_master_product",
                "requested_master_product__system_product",
            )
            .filter(id=inquiry.id, tenant=tenant)
            .first()
        )
        if not inquiry:
            raise DraftSalesOrderError("Inquiry not found for this tenant.")

        if inquiry.route_decision != InquiryRouteDecisionChoices.FULFILL:
            raise DraftSalesOrderError(
                "Only FULFILL inquiries can create sales orders directly. "
                "BROKER inquiries must go through supplier sourcing first."
            )

        if not inquiry.customer:
            raise DraftSalesOrderError(
                "Inquiry must have a customer assigned before creating a sales order."
            )

        # Idempotency: check if draft SO already exists for this inquiry
        existing = _get_existing_sales_order_for_inquiry(tenant=tenant, inquiry=inquiry)
        if existing is not None:
            return DraftSalesOrderResult(
                sales_order=existing, created=False, source_type="fulfill"
            )

        sales_order = _create_sales_order(
            tenant=tenant,
            inquiry=inquiry,
            source_type="fulfill",
            source_purchase_order=None,
        )

        # Link inquiry to the new sales order
        inquiry.sales_order = sales_order
        inquiry.modified_on = timezone.now()
        inquiry.save(update_fields=["sales_order", "modified_on"])

        _emit_telemetry(
            event="sales_order.draft_created",
            tenant=tenant,
            sales_order=sales_order,
            inquiry=inquiry,
            source_type="fulfill",
        )

        return DraftSalesOrderResult(
            sales_order=sales_order, created=True, source_type="fulfill"
        )


def create_draft_from_approved_source(
    *,
    tenant: Any,
    purchase_order: PurchaseOrder,
) -> DraftSalesOrderResult:
    """Create or return the draft sales order from an approved supplier purchase order.

    BROKER inquiries create a supplier PO first; once that PO is approved,
    this function creates the downstream draft sales order with full lineage.
    """

    with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
        purchase_order = (
            PurchaseOrder.objects.select_for_update(of=("self",))
            .select_related("supplier", "product")
            .filter(id=purchase_order.id, tenant=tenant)
            .first()
        )
        if not purchase_order:
            raise DraftSalesOrderError("Purchase order not found for this tenant.")

        if purchase_order.status != PurchaseOrderStatus.APPROVED:
            raise DraftSalesOrderError(
                f"Purchase order must be in 'approved' status to create a sales order. "
                f"Current status: {purchase_order.status}."
            )

        # Resolve the source inquiry from PO lineage
        inquiry = _resolve_inquiry_from_purchase_order(tenant=tenant, purchase_order=purchase_order)
        if not inquiry:
            raise DraftSalesOrderError(
                "Cannot resolve source inquiry from this purchase order. "
                "Lineage data is missing or invalid."
            )

        if not inquiry.customer:
            raise DraftSalesOrderError(
                "Source inquiry must have a customer assigned before creating a sales order."
            )

        # Idempotency: check if draft SO already exists
        existing = _get_existing_sales_order_for_purchase_order(
            tenant=tenant, purchase_order=purchase_order
        )
        if existing is not None:
            return DraftSalesOrderResult(
                sales_order=existing, created=False, source_type="approved_source"
            )

        sales_order = _create_sales_order(
            tenant=tenant,
            inquiry=inquiry,
            source_type="approved_source",
            source_purchase_order=purchase_order,
        )

        # Link inquiry to the new sales order
        if not inquiry.sales_order:
            inquiry.sales_order = sales_order
            inquiry.modified_on = timezone.now()
            inquiry.save(update_fields=["sales_order", "modified_on"])

        _emit_telemetry(
            event="sales_order.draft_created",
            tenant=tenant,
            sales_order=sales_order,
            inquiry=inquiry,
            source_type="approved_source",
            purchase_order=purchase_order,
        )

        return DraftSalesOrderResult(
            sales_order=sales_order, created=True, source_type="approved_source"
        )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_existing_sales_order_for_inquiry(
    *, tenant: Any, inquiry: Inquiry
) -> SalesOrder | None:
    """Check if a draft SO already exists for this inquiry (deduplication)."""
    # First check via FK
    if inquiry.sales_order_id:
        so = SalesOrder.objects.for_tenant(tenant).filter(id=inquiry.sales_order_id).first()
        if so:
            return so

    # Also check via custom_data lineage
    existing = (
        SalesOrder.objects.for_tenant(tenant)
        .filter(custom_data__source_inquiry_id=str(inquiry.id))
        .first()
    )
    return existing


def _get_existing_sales_order_for_purchase_order(
    *, tenant: Any, purchase_order: PurchaseOrder
) -> SalesOrder | None:
    """Check if a draft SO already exists for this PO (deduplication)."""
    existing = (
        SalesOrder.objects.for_tenant(tenant)
        .filter(custom_data__source_purchase_order_id=str(purchase_order.id))
        .first()
    )
    return existing


def _resolve_inquiry_from_purchase_order(
    *, tenant: Any, purchase_order: PurchaseOrder
) -> Inquiry | None:
    """Resolve the source inquiry from PO's custom_data lineage or reverse FK."""
    # Try custom_data lineage first (set by supplier_quote_po_draft service)
    source_lineage = (purchase_order.custom_data or {}).get("source_lineage", {})
    inquiry_id = source_lineage.get("inquiry_id")
    if inquiry_id:
        inquiry = (
            Inquiry.objects.select_related("customer", "supplier", "contact", "requested_master_product")
            .filter(id=inquiry_id, tenant=tenant)
            .first()
        )
        if inquiry:
            return inquiry

    # Fall back to reverse FK lookup
    inquiry = (
        Inquiry.objects.select_related("customer", "supplier", "contact", "requested_master_product")
        .filter(supplier_purchase_order=purchase_order, tenant=tenant)
        .first()
    )
    return inquiry


def _create_sales_order(
    *,
    tenant: Any,
    inquiry: Inquiry,
    source_type: str,
    source_purchase_order: PurchaseOrder | None,
) -> SalesOrder:
    """Create the actual SalesOrder record with lineage and auto-generated number."""
    # Auto-generate SO number
    next_so_num = _generate_next_so_number(tenant)

    # Resolve product
    product = None
    if source_purchase_order and source_purchase_order.product:
        product = source_purchase_order.product
    elif inquiry.requested_master_product:
        product = getattr(inquiry.requested_master_product, "system_product", None)

    # Build lineage custom_data
    custom_data = _build_custom_data(
        inquiry=inquiry,
        source_type=source_type,
        source_purchase_order=source_purchase_order,
    )

    # Resolve quantity and weight from source
    quantity = None
    total_weight = None
    weight_unit = "LBS"
    total_amount = None

    if source_purchase_order:
        quantity = source_purchase_order.quantity
        total_weight = source_purchase_order.total_weight
        weight_unit = source_purchase_order.weight_unit or "LBS"
        total_amount = source_purchase_order.total_amount

    sales_order = SalesOrder.objects.create(
        tenant=tenant,
        our_sales_order_num=next_so_num,
        our_sales_order_number_for_customer=next_so_num,
        customer=inquiry.customer,
        supplier=inquiry.supplier or (source_purchase_order.supplier if source_purchase_order else None),
        product=product,
        contact=inquiry.contact,
        status=SalesOrderStatus.DRAFT,
        quantity=quantity,
        total_weight=total_weight,
        weight_unit=weight_unit,
        total_amount=total_amount or 0,
        outstanding_amount=total_amount or 0,
        notes=_build_notes(inquiry=inquiry, source_type=source_type, source_purchase_order=source_purchase_order),
        custom_data=custom_data,
    )

    return sales_order


def _generate_next_so_number(tenant: Any) -> str:
    """Generate the next sequential SO number for the tenant."""
    existing_sos = SalesOrder.objects.filter(tenant=tenant).select_for_update()
    max_order_num = 0
    for so in existing_sos:
        try:
            num = int(so.our_sales_order_num)
            if num > max_order_num:
                max_order_num = num
        except (ValueError, TypeError):
            continue
    return str(max_order_num + 1)


def _build_custom_data(
    *,
    inquiry: Inquiry,
    source_type: str,
    source_purchase_order: PurchaseOrder | None,
) -> dict[str, Any]:
    """Build the custom_data dict with full lineage for traceability."""
    data: dict[str, Any] = {
        "source_type": source_type,
        "source_inquiry_id": str(inquiry.id),
        "source_inquiry_number": getattr(inquiry, "inquiry_number", "") or "",
        "review_state": "pending_review",
        "created_via": "draft_sales_order_service",
    }

    # Email lineage
    if inquiry.source_email_message_id:
        data["source_email_message_id"] = inquiry.source_email_message_id
    if inquiry.source_email_thread_id:
        data["source_email_thread_id"] = inquiry.source_email_thread_id

    # Purchase order lineage (BROKER path)
    if source_purchase_order:
        data["source_purchase_order_id"] = str(source_purchase_order.id)
        data["source_purchase_order_number"] = source_purchase_order.order_number or ""
        # Propagate deeper lineage from PO
        po_lineage = (source_purchase_order.custom_data or {}).get("source_lineage", {})
        if po_lineage:
            data["supplier_rfq_id"] = po_lineage.get("rfq_id", "")
            data["supplier_id"] = po_lineage.get("supplier_id", "")

    return data


def _build_notes(
    *,
    inquiry: Inquiry,
    source_type: str,
    source_purchase_order: PurchaseOrder | None,
) -> str:
    """Build descriptive notes for the draft SO."""
    parts = [f"Auto-generated draft from {source_type} path."]
    if inquiry:
        parts.append(f"Source inquiry: {getattr(inquiry, 'inquiry_number', inquiry.id)}")
    if source_purchase_order:
        parts.append(f"Approved supplier PO: {source_purchase_order.order_number or source_purchase_order.id}")
    return " | ".join(parts)


def _emit_telemetry(
    *,
    event: str,
    tenant: Any,
    sales_order: SalesOrder,
    inquiry: Inquiry,
    source_type: str,
    purchase_order: PurchaseOrder | None = None,
) -> None:
    """Emit telemetry event for draft SO creation."""
    logger.info(
        f"Telemetry: {event}",
        extra={
            "event_type": event,
            "tenant_id": str(tenant.id),
            "sales_order_id": str(sales_order.id),
            "sales_order_number": sales_order.our_sales_order_num,
            "inquiry_id": str(inquiry.id),
            "source_type": source_type,
            "purchase_order_id": str(purchase_order.id) if purchase_order else None,
            "timestamp": timezone.now().isoformat(),
        },
    )
