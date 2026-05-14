"""Automatic downstream entity creation on workflow status transitions.

When a key status transition completes (e.g. PO approved), this service
creates a draft of the next entity in the trade workflow and cascades
available data from parent entities.

Cascade chain:
  Inquiry (accepted) → PO draft   (via existing supplier_quote_po_draft service)
  PO (approved)      → SO draft   (via existing draft_sales_order service)
  SO (confirmed)     → Carrier PO draft
  Carrier PO (delivered) → Fulfillment draft
  Fulfillment (completed) → Invoice draft
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from django.db import transaction

from apps.tenants.rls import tenant_rls

logger = logging.getLogger(__name__)


@dataclass
class CascadeResult:
    """Return value describing any downstream entities created."""

    triggered: bool = False
    created_entity_type: str = ""
    created_entity_id: str = ""
    created_entity_label: str = ""
    already_existed: bool = False
    error: str = ""
    details: dict[str, Any] = field(default_factory=dict)


def attempt_cascade(
    *,
    tenant: Any,
    document: Any,
    new_status: str,
) -> CascadeResult:
    """Attempt to cascade a workflow transition to create the next downstream entity.

    This is called AFTER a successful status transition. It is intentionally
    best-effort: if cascade fails, the parent transition still succeeds.
    """
    model_name = document.__class__.__name__

    handler = _CASCADE_HANDLERS.get((model_name, new_status))
    if handler is None:
        return CascadeResult(triggered=False)

    try:
        return handler(tenant=tenant, document=document)
    except Exception as exc:
        logger.warning(
            "Cascade failed for %s(%s) → %s: %s",
            model_name,
            getattr(document, "id", "?"),
            new_status,
            exc,
            exc_info=True,
        )
        return CascadeResult(
            triggered=True,
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# Cascade handlers — one per (model_name, trigger_status)
# ---------------------------------------------------------------------------


def _cascade_po_approved_to_so(*, tenant: Any, document: Any) -> CascadeResult:
    """PO approved → auto-create draft Sales Order."""
    from tenant_apps.sales_orders.services.draft_sales_order import (
        DraftSalesOrderError,
        create_draft_from_approved_source,
    )

    try:
        result = create_draft_from_approved_source(
            tenant=tenant,
            purchase_order=document,
        )
    except DraftSalesOrderError as exc:
        return CascadeResult(triggered=True, error=str(exc))

    so = result.sales_order
    return CascadeResult(
        triggered=True,
        created_entity_type="sales_order",
        created_entity_id=str(so.id),
        created_entity_label=f"SO #{so.our_sales_order_num}",
        already_existed=not result.created,
        details={
            "source_type": result.source_type,
            "sales_order_id": str(so.id),
            "sales_order_number": so.our_sales_order_num,
        },
    )


def _cascade_so_confirmed_to_carrier_po(*, tenant: Any, document: Any) -> CascadeResult:
    """SO confirmed → auto-create draft Carrier PO."""
    from tenant_apps.purchase_orders.models import CarrierPurchaseOrder

    with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
        so = document
        # Idempotency: check if carrier PO already exists for this SO
        existing = CarrierPurchaseOrder.objects.for_tenant(tenant).filter(sales_order=so).first()
        if existing:
            return CascadeResult(
                triggered=True,
                created_entity_type="carrier_purchase_order",
                created_entity_id=str(existing.id),
                created_entity_label=f"Carrier PO #{existing.order_number or existing.id}",
                already_existed=True,
            )

        carrier_po = CarrierPurchaseOrder.objects.create(
            tenant=tenant,
            carrier=so.carrier,
            supplier=so.supplier,
            product=so.product,
            sales_order=so,
            linked_order=_resolve_linked_po(tenant, so),
            plant=so.plant,
            pick_up_location=so.pick_up_location,
            delivery_location=so.delivery_location,
            quantity=so.quantity,
            total_weight=so.total_weight,
            weight_unit=so.weight_unit or "LBS",
            type_of_protein=so.type_of_protein or "",
            fresh_or_frozen=so.fresh_or_frozen or "",
            package_type=so.package_type or "",
            net_or_catch=so.net_or_catch or "",
            edible_or_inedible=so.edible_or_inedible or "",
            status="draft",
            notes=f"Auto-cascaded from Sales Order {so.our_sales_order_num or so.id}.",
            custom_data={
                "cascade_source": "sales_order",
                "source_sales_order_id": str(so.id),
                "source_sales_order_number": so.our_sales_order_num or "",
                "created_via": "workflow_cascade",
            },
        )

        logger.info(
            "Cascade: SO %s → Carrier PO %s created",
            so.id,
            carrier_po.id,
        )

        return CascadeResult(
            triggered=True,
            created_entity_type="carrier_purchase_order",
            created_entity_id=str(carrier_po.id),
            created_entity_label=f"Carrier PO #{carrier_po.order_number or carrier_po.id}",
            details={
                "carrier_po_id": str(carrier_po.id),
                "carrier_po_number": carrier_po.order_number or "",
            },
        )


def _cascade_carrier_po_delivered_to_fulfillment(*, tenant: Any, document: Any) -> CascadeResult:
    """Carrier PO delivered → auto-create draft Fulfillment."""
    from tenant_apps.fulfillments.models import Fulfillment
    from tenant_apps.inquiries.models import Inquiry

    with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
        carrier_po = document

        # Resolve source inquiry from carrier PO lineage
        inquiry = None
        so = getattr(carrier_po, "sales_order", None)
        if so:
            source_inquiry_id = (so.custom_data or {}).get("source_inquiry_id")
            if source_inquiry_id:
                inquiry = Inquiry.objects.filter(id=source_inquiry_id, tenant=tenant).first()

        # Idempotency: check if fulfillment already exists
        existing = (
            Fulfillment.objects.for_tenant(tenant).filter(custom_data__source_carrier_po_id=str(carrier_po.id)).first()
        )
        if existing:
            return CascadeResult(
                triggered=True,
                created_entity_type="fulfillment",
                created_entity_id=str(existing.id),
                created_entity_label=f"Fulfillment #{existing.fulfillment_number or existing.id}",
                already_existed=True,
            )

        # Resolve customer/supplier from lineage
        customer = getattr(so, "customer", None) if so else None
        supplier = getattr(so, "supplier", None) if so else (getattr(carrier_po, "supplier", None))
        carrier = getattr(carrier_po, "carrier", None)

        fulfillment = Fulfillment.objects.create(
            tenant=tenant,
            inquiry=inquiry,
            customer=customer,
            supplier=supplier,
            carrier=carrier,
            shipping_type=getattr(inquiry, "shipping_type", "") or "",
            status="pending",
            notes=f"Auto-cascaded from Carrier PO {carrier_po.order_number or carrier_po.id}.",
            custom_data={
                "cascade_source": "carrier_purchase_order",
                "source_carrier_po_id": str(carrier_po.id),
                "source_carrier_po_number": carrier_po.order_number or "",
                "source_sales_order_id": str(so.id) if so else "",
                "created_via": "workflow_cascade",
            },
        )

        logger.info(
            "Cascade: Carrier PO %s → Fulfillment %s created",
            carrier_po.id,
            fulfillment.id,
        )

        return CascadeResult(
            triggered=True,
            created_entity_type="fulfillment",
            created_entity_id=str(fulfillment.id),
            created_entity_label=f"Fulfillment #{fulfillment.fulfillment_number or fulfillment.id}",
            details={
                "fulfillment_id": str(fulfillment.id),
                "fulfillment_number": fulfillment.fulfillment_number or "",
            },
        )


def _cascade_fulfillment_completed_to_invoice(*, tenant: Any, document: Any) -> CascadeResult:
    """Fulfillment completed → auto-create draft Invoice."""
    from tenant_apps.invoices.models import Invoice
    from tenant_apps.sales_orders.models import SalesOrder

    with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
        fulfillment = document

        # Idempotency
        existing = (
            Invoice.objects.for_tenant(tenant).filter(custom_data__source_fulfillment_id=str(fulfillment.id)).first()
        )
        if existing:
            return CascadeResult(
                triggered=True,
                created_entity_type="invoice",
                created_entity_id=str(existing.id),
                created_entity_label=f"Invoice #{existing.invoice_number or existing.id}",
                already_existed=True,
            )

        # Resolve SO from fulfillment lineage
        so = None
        source_so_id = (fulfillment.custom_data or {}).get("source_sales_order_id")
        if source_so_id:
            so = SalesOrder.objects.filter(id=source_so_id, tenant=tenant).first()
        if not so and fulfillment.inquiry:
            so = getattr(fulfillment.inquiry, "sales_order", None)

        invoice = Invoice.objects.create(
            tenant=tenant,
            customer=fulfillment.customer or (so.customer if so else None),
            sales_order=so,
            product=so.product if so else None,
            our_sales_order_num=so.our_sales_order_num if so else "",
            our_sales_order_number_for_customer=so.our_sales_order_number_for_customer if so else "",
            quantity=so.quantity if so else None,
            total_weight=so.total_weight if so else None,
            weight_unit=(so.weight_unit if so else None) or "LBS",
            total_amount=so.total_amount if so else 0,
            outstanding_amount=so.total_amount if so else 0,
            type_of_protein=so.type_of_protein if so else "",
            fresh_or_frozen=so.fresh_or_frozen if so else "",
            package_type=so.package_type if so else "",
            net_or_catch=so.net_or_catch if so else "",
            edible_or_inedible=so.edible_or_inedible if so else "",
            total_net_weight=so.total_net_weight if so else None,
            status="draft",
            notes=f"Auto-cascaded from Fulfillment {fulfillment.fulfillment_number or fulfillment.id}.",
            custom_data={
                "cascade_source": "fulfillment",
                "source_fulfillment_id": str(fulfillment.id),
                "source_fulfillment_number": fulfillment.fulfillment_number or "",
                "source_sales_order_id": str(so.id) if so else "",
                "created_via": "workflow_cascade",
            },
        )

        logger.info(
            "Cascade: Fulfillment %s → Invoice %s created",
            fulfillment.id,
            invoice.id,
        )

        return CascadeResult(
            triggered=True,
            created_entity_type="invoice",
            created_entity_id=str(invoice.id),
            created_entity_label=f"Invoice #{invoice.invoice_number or invoice.id}",
            details={
                "invoice_id": str(invoice.id),
                "invoice_number": invoice.invoice_number or "",
            },
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_linked_po(tenant: Any, sales_order: Any):
    """Resolve the linked supplier PO from the sales order's lineage."""
    from tenant_apps.purchase_orders.models import PurchaseOrder

    source_po_id = (sales_order.custom_data or {}).get("source_purchase_order_id")
    if source_po_id:
        return PurchaseOrder.objects.filter(id=source_po_id, tenant=tenant).first()
    return None


# ---------------------------------------------------------------------------
# Registry — (ModelName, trigger_status) → handler
# ---------------------------------------------------------------------------

_CASCADE_HANDLERS: dict[tuple[str, str], Any] = {
    ("PurchaseOrder", "approved"): _cascade_po_approved_to_so,
    ("SalesOrder", "confirmed"): _cascade_so_confirmed_to_carrier_po,
    ("CarrierPurchaseOrder", "delivered"): _cascade_carrier_po_delivered_to_fulfillment,
    ("Fulfillment", "completed"): _cascade_fulfillment_completed_to_invoice,
}
