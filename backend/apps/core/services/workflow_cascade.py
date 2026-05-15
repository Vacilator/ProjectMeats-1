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


def _create_trade_document(
    tenant,
    trade_session,
    entity_type: str,
    entity_id: int,
    stage: str,
    direction: str,
    document_type: str,
    title: str,
    description: str = "",
    generated_by: str = "system",
    stage_order: int = 0,
):
    """Create a TradeDocument record for a cascade transition."""
    from tenant_apps.inquiries.models import TradeDocument

    try:
        TradeDocument.objects.create(
            tenant=tenant,
            trade_session=trade_session,
            entity_type=entity_type,
            entity_id=entity_id,
            stage=stage,
            direction=direction,
            document_type=document_type,
            title=title,
            description=description,
            generated_by=generated_by,
            stage_order=stage_order,
        )
    except Exception:
        logger.error("Failed to create trade document for %s %s", entity_type, entity_id, exc_info=True)


def _resolve_trade_session(tenant, parent_doc):
    """Resolve the TradeSession associated with a document, walking up lineage if needed."""
    from tenant_apps.inquiries.models import TradeSession

    inquiry = _resolve_source_inquiry(tenant, parent_doc)
    if not inquiry:
        return None
    return TradeSession.objects.filter(tenant=tenant, inquiry=inquiry).first()


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


def _cascade_inquiry_accepted_to_po(*, tenant: Any, document: Any) -> CascadeResult:
    """Inquiry accepted → auto-create draft Purchase Order.

    Uses the existing supplier_quote_po_draft service when an RFQ reply
    exists, otherwise creates a bare PO draft linked to the inquiry.
    Also ensures a TradeSession exists (so My Trades picks it up).
    """
    from tenant_apps.inquiries.models import Inquiry, InquirySupplierRFQ
    from tenant_apps.inquiries.services.trade_session import get_or_create_trade_session
    from tenant_apps.purchase_orders.models import PurchaseOrder

    inquiry: Inquiry = document

    # Always ensure a TradeSession exists for this inquiry
    trade_session, _ts_created = get_or_create_trade_session(tenant=tenant, inquiry=inquiry)

    with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
        # Idempotency: check if a PO already exists for this inquiry
        existing_po = PurchaseOrder.objects.for_tenant(tenant).filter(inquiry=inquiry).first()
        if existing_po:
            # Still advance trade session even for existing PO
            _update_trade_session_status_from_doc(tenant, inquiry, "ordered")
            _create_trade_document(
                tenant=tenant,
                trade_session=trade_session,
                entity_type="purchase_order",
                entity_id=existing_po.id,
                stage="purchase_order",
                direction="sent",
                document_type="confirmation",
                title=f"PO {existing_po.po_number or existing_po.id} (existing)",
                description="Purchase order already existed during cascade re-run.",
                stage_order=0,
            )
            return CascadeResult(
                triggered=True,
                created_entity_type="purchase_order",
                created_entity_id=str(existing_po.id),
                created_entity_label=(f"PO #{existing_po.po_number or existing_po.id}"),
                already_existed=True,
            )

        # Try the supplier-quote path first (RFQ with a reply)
        rfq = (
            InquirySupplierRFQ.objects.filter(inquiry=inquiry, tenant=tenant)
            .exclude(reply_status="pending")
            .order_by("-replied_at")
            .first()
        )
        if rfq:
            try:
                from tenant_apps.inquiries.services.supplier_quote_po_draft import (
                    create_supplier_quote_purchase_order_draft,
                )

                result = create_supplier_quote_purchase_order_draft(tenant=tenant, inquiry=inquiry, rfq_id=rfq.id)
                po = result.purchase_order
                # Link back on Inquiry so lineage picks it up
                _link_inquiry_fk(inquiry, "supplier_purchase_order", po)

                # Create trade documents + advance session for RFQ path
                _create_trade_document(
                    tenant=tenant,
                    trade_session=trade_session,
                    entity_type="inquiry",
                    entity_id=inquiry.id,
                    stage="inquiry",
                    direction="received",
                    document_type="confirmation",
                    title=f"Inquiry {inquiry.inquiry_number or inquiry.id} Accepted (RFQ)",
                    description="Inquiry accepted via supplier quote.",
                    stage_order=1,
                )
                _create_trade_document(
                    tenant=tenant,
                    trade_session=trade_session,
                    entity_type="purchase_order",
                    entity_id=po.id,
                    stage="purchase_order",
                    direction="sent",
                    document_type="confirmation",
                    title=f"PO {po.po_number or po.id} Created from RFQ",
                    description="Purchase order created from supplier quote.",
                    stage_order=0,
                )
                _update_trade_session_status_from_doc(tenant, inquiry, "ordered")

                return CascadeResult(
                    triggered=True,
                    created_entity_type="purchase_order",
                    created_entity_id=str(po.id),
                    created_entity_label=f"PO #{po.po_number or po.id}",
                    already_existed=not result.created,
                    details={
                        "purchase_order_id": str(po.id),
                        "created_via": "supplier_quote_po_draft",
                    },
                )
            except Exception:
                logger.warning(
                    "RFQ-based PO creation failed for inquiry %s, " "falling back to bare PO draft",
                    inquiry.id,
                    exc_info=True,
                )

        # Fallback: create a bare draft PO linked to this inquiry
        po = PurchaseOrder.objects.create(
            tenant=tenant,
            inquiry=inquiry,
            supplier=inquiry.supplier,
            customer=inquiry.customer,
            type_of_protein=inquiry.type_of_protein or "",
            fresh_or_frozen=inquiry.fresh_or_frozen or "",
            package_type=inquiry.package_type or "",
            net_or_catch=inquiry.net_or_catch or "",
            edible_or_inedible=inquiry.edible_or_inedible or "",
            status="draft",
            notes=(f"Auto-created from Inquiry " f"{inquiry.inquiry_number or inquiry.id}."),
            custom_data={
                "cascade_source": "inquiry",
                "source_inquiry_id": str(inquiry.id),
                "source_inquiry_number": inquiry.inquiry_number or "",
                "created_via": "workflow_cascade",
            },
        )

        # Link the PO back on the Inquiry so lineage/orchestrator picks it up
        _link_inquiry_fk(inquiry, "supplier_purchase_order", po)

        logger.info(
            "Cascade: Inquiry %s (accepted) → PO %s created",
            inquiry.id,
            po.id,
        )

        # Auto-create trade documents for inquiry acceptance + PO draft
        _create_trade_document(
            tenant=tenant,
            trade_session=trade_session,
            entity_type="inquiry",
            entity_id=inquiry.id,
            stage="inquiry",
            direction="received",
            document_type="confirmation",
            title=f"Inquiry {inquiry.inquiry_number or inquiry.id} Accepted",
            description="Inquiry accepted, purchase order being created.",
            stage_order=1,
        )
        _create_trade_document(
            tenant=tenant,
            trade_session=trade_session,
            entity_type="purchase_order",
            entity_id=po.id,
            stage="purchase_order",
            direction="sent",
            document_type="confirmation",
            title=f"PO {po.po_number or po.id} Draft Created",
            description="Draft purchase order auto-created from accepted inquiry.",
            stage_order=0,
        )

        # Advance trade session: INITIATED → ORDERED
        _update_trade_session_status_from_doc(tenant, inquiry, "ordered")

        return CascadeResult(
            triggered=True,
            created_entity_type="purchase_order",
            created_entity_id=str(po.id),
            created_entity_label=f"PO #{po.po_number or po.id}",
            details={
                "purchase_order_id": str(po.id),
                "created_via": "workflow_cascade_bare",
            },
        )


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
    # Link the SO back to the source inquiry so lineage updates
    _link_inquiry_fk_from_document(tenant, document, "sales_order", so)

    # Link SO to the trade session so MyTrades picks it up
    _link_trade_session(tenant, document, sales_order=so)

    # Auto-create trade document for SO draft
    ts = _resolve_trade_session(tenant, document)
    if ts:
        _create_trade_document(
            tenant=tenant,
            trade_session=ts,
            entity_type="sales_order",
            entity_id=so.id,
            stage="sales_order",
            direction="sent",
            document_type="confirmation",
            title=f"SO {so.our_sales_order_num or so.id} Draft Created",
            description=f"Draft sales order auto-created from approved PO {getattr(document, 'po_number', document.id)}.",
            stage_order=0,
        )

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
            _update_trade_session_status_from_doc(tenant, so, "logistics")
            ts = _resolve_trade_session(tenant, so)
            if ts:
                _create_trade_document(
                    tenant=tenant,
                    trade_session=ts,
                    entity_type="carrier_purchase_order",
                    entity_id=existing.id,
                    stage="carrier_po",
                    direction="sent",
                    document_type="confirmation",
                    title=f"Carrier PO {existing.order_number or existing.id} (existing)",
                    description="Carrier PO already existed during cascade re-run.",
                    stage_order=0,
                )
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

        # Link the Carrier PO back to the source inquiry
        _link_inquiry_fk_from_document(tenant, so, "carrier_purchase_order", carrier_po)

        # Link Carrier PO to the trade session so MyTrades picks it up
        _link_trade_session(tenant, so, carrier_purchase_order=carrier_po)

        # Auto-create trade document for carrier PO draft
        ts = _resolve_trade_session(tenant, so)
        if ts:
            _create_trade_document(
                tenant=tenant,
                trade_session=ts,
                entity_type="carrier_purchase_order",
                entity_id=carrier_po.id,
                stage="carrier_po",
                direction="sent",
                document_type="confirmation",
                title=f"Carrier PO {carrier_po.order_number or carrier_po.id} Draft Created",
                description=f"Draft carrier PO auto-created from confirmed SO {so.our_sales_order_num or so.id}.",
                stage_order=0,
            )

        # Advance trade session: ORDERED → LOGISTICS
        _update_trade_session_status_from_doc(tenant, so, "logistics")

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
            _update_trade_session_status_from_doc(tenant, carrier_po, "logistics")
            ts = _resolve_trade_session(tenant, carrier_po)
            if ts:
                _create_trade_document(
                    tenant=tenant,
                    trade_session=ts,
                    entity_type="fulfillment",
                    entity_id=existing.id,
                    stage="fulfillment",
                    direction="received",
                    document_type="confirmation",
                    title=f"Fulfillment {existing.fulfillment_number or existing.id} (existing)",
                    description="Fulfillment already existed during cascade re-run.",
                    stage_order=0,
                )
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

        # Store fulfillment reference on the source inquiry's custom_data
        _link_inquiry_custom_data(tenant, carrier_po, "fulfillment_id", str(fulfillment.id))

        # Advance trade session status to logistics
        _update_trade_session_status_from_doc(tenant, carrier_po, "logistics")

        # Auto-create trade document for fulfillment draft
        ts = _resolve_trade_session(tenant, carrier_po)
        if ts:
            _create_trade_document(
                tenant=tenant,
                trade_session=ts,
                entity_type="fulfillment",
                entity_id=fulfillment.id,
                stage="fulfillment",
                direction="received",
                document_type="confirmation",
                title=f"Fulfillment {fulfillment.fulfillment_number or fulfillment.id} Created",
                description=f"Fulfillment auto-created from delivered Carrier PO {carrier_po.order_number or carrier_po.id}.",
                stage_order=0,
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
            _update_trade_session_status_from_doc(tenant, fulfillment, "completed")
            ts = _resolve_trade_session(tenant, fulfillment)
            if ts:
                _create_trade_document(
                    tenant=tenant,
                    trade_session=ts,
                    entity_type="invoice",
                    entity_id=existing.id,
                    stage="invoice",
                    direction="sent",
                    document_type="confirmation",
                    title=f"Invoice {existing.invoice_number or existing.id} (existing)",
                    description="Invoice already existed during cascade re-run.",
                    stage_order=0,
                )
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

        # Store invoice reference on the source inquiry's custom_data
        _link_inquiry_custom_data_from_fulfillment(tenant, fulfillment, "invoice_id", str(invoice.id))

        # Advance trade session to completed
        _update_trade_session_status_from_doc(tenant, fulfillment, "completed")

        # Auto-create trade document for invoice draft
        ts = _resolve_trade_session(tenant, fulfillment)
        if ts:
            _create_trade_document(
                tenant=tenant,
                trade_session=ts,
                entity_type="invoice",
                entity_id=invoice.id,
                stage="invoice",
                direction="sent",
                document_type="invoice_doc",
                title=f"Invoice {invoice.invoice_number or invoice.id} Draft Created",
                description=f"Draft invoice auto-created from completed Fulfillment {fulfillment.fulfillment_number or fulfillment.id}.",
                stage_order=0,
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


def _resolve_trade_session(tenant: Any, parent_doc: Any):
    """Best-effort resolution of the TradeSession for a document."""
    from tenant_apps.inquiries.models import TradeSession

    try:
        inquiry = _resolve_source_inquiry(tenant, parent_doc)
        if inquiry:
            return TradeSession.objects.filter(tenant=tenant, inquiry=inquiry).first()
    except Exception:
        logger.debug("Could not resolve trade session for %s", parent_doc, exc_info=True)
    return None


def _link_trade_session(
    tenant: Any,
    parent_doc: Any,
    *,
    purchase_order: Any = None,
    sales_order: Any = None,
    carrier_purchase_order: Any = None,
) -> None:
    """Resolve the trade session from a parent document and link downstream entities.

    Walks up the lineage to find the source inquiry's TradeSession, then uses
    cascade_trade_session() to link the new downstream entities.
    Also advances the trade session status to reflect pipeline progress.
    Best-effort: logs and swallows errors so the parent cascade still succeeds.
    """
    from tenant_apps.inquiries.models import TradeSession, TradeSessionStatus
    from tenant_apps.inquiries.services.trade_session import (
        cascade_trade_session,
        update_trade_session_status,
    )

    try:
        inquiry = _resolve_source_inquiry(tenant, parent_doc)
        if not inquiry:
            return
        ts = TradeSession.objects.filter(tenant=tenant, inquiry=inquiry).first()
        if not ts:
            return
        cascade_trade_session(
            trade_session=ts,
            purchase_order=purchase_order,
            sales_order=sales_order,
            carrier_purchase_order=carrier_purchase_order,
        )

        # Advance trade session status based on which entity was created
        next_status = None
        if sales_order:
            next_status = TradeSessionStatus.ORDERED
        elif carrier_purchase_order:
            next_status = TradeSessionStatus.LOGISTICS
        if next_status and ts.status != next_status:
            update_trade_session_status(trade_session=ts, new_status=next_status)
    except Exception:
        logger.warning(
            "Failed to link trade session from %s(%s)",
            parent_doc.__class__.__name__,
            getattr(parent_doc, "id", "?"),
            exc_info=True,
        )


def _update_trade_session_status_from_doc(tenant: Any, parent_doc: Any, target_status: str) -> None:
    """Walk up the lineage to find the trade session and update its status.

    Used by cascade handlers for entities (Fulfillment, Invoice) that don't
    have a trade_session FK but still advance the trade lifecycle.
    """
    from tenant_apps.inquiries.models import TradeSession, TradeSessionStatus
    from tenant_apps.inquiries.services.trade_session import update_trade_session_status

    try:
        inquiry = _resolve_source_inquiry(tenant, parent_doc)
        if not inquiry:
            return
        ts = TradeSession.objects.filter(tenant=tenant, inquiry=inquiry).first()
        if not ts:
            return
        status_map = {s.value: s for s in TradeSessionStatus}
        new_status = status_map.get(target_status)
        if new_status and ts.status != new_status:
            update_trade_session_status(trade_session=ts, new_status=new_status)
    except Exception:
        logger.warning(
            "Failed to update trade session status from %s(%s)",
            parent_doc.__class__.__name__,
            getattr(parent_doc, "id", "?"),
            exc_info=True,
        )


def _resolve_linked_po(tenant: Any, sales_order: Any):
    """Resolve the linked supplier PO from the sales order's lineage."""
    from tenant_apps.purchase_orders.models import PurchaseOrder

    source_po_id = (sales_order.custom_data or {}).get("source_purchase_order_id")
    if source_po_id:
        return PurchaseOrder.objects.filter(id=source_po_id, tenant=tenant).first()
    return None


def _link_inquiry_fk(inquiry: Any, fk_field: str, entity: Any) -> None:
    """Set an FK on the Inquiry model so the lineage chain picks it up."""
    from tenant_apps.inquiries.models import Inquiry

    try:
        Inquiry.objects.filter(id=inquiry.id).update(**{fk_field: entity})
        # Update in-memory object too for same-request reads
        setattr(inquiry, fk_field, entity)
        setattr(inquiry, f"{fk_field}_id", entity.pk)
    except Exception:
        logger.warning("Failed to link %s back to Inquiry %s", fk_field, inquiry.id, exc_info=True)


def _link_inquiry_fk_from_document(tenant: Any, parent_doc: Any, fk_field: str, entity: Any) -> None:
    """Walk up the cascade lineage from a document to find its source Inquiry and set an FK."""
    from tenant_apps.inquiries.models import Inquiry

    inquiry = _resolve_source_inquiry(tenant, parent_doc)
    if inquiry:
        _link_inquiry_fk(inquiry, fk_field, entity)


def _link_inquiry_custom_data(tenant: Any, parent_doc: Any, key: str, value: str) -> None:
    """Store a reference in the source inquiry's custom_data for entities without FK columns."""
    from tenant_apps.inquiries.models import Inquiry

    inquiry = _resolve_source_inquiry(tenant, parent_doc)
    if not inquiry:
        return
    try:
        custom_data = dict(inquiry.custom_data or {})
        custom_data[key] = value
        Inquiry.objects.filter(id=inquiry.id).update(custom_data=custom_data)
    except Exception:
        logger.warning("Failed to store %s in Inquiry %s custom_data", key, inquiry.id, exc_info=True)


def _link_inquiry_custom_data_from_fulfillment(tenant: Any, fulfillment: Any, key: str, value: str) -> None:
    """Store a reference in the source inquiry's custom_data from a Fulfillment."""
    from tenant_apps.inquiries.models import Inquiry

    source_inquiry_id = None
    if fulfillment.inquiry_id:
        source_inquiry_id = fulfillment.inquiry_id
    elif hasattr(fulfillment, "custom_data") and fulfillment.custom_data:
        # Walk: fulfillment → carrier PO → SO → PO → inquiry
        source_so_id = fulfillment.custom_data.get("source_sales_order_id")
        if source_so_id:
            from tenant_apps.sales_orders.models import SalesOrder

            so = SalesOrder.objects.filter(id=source_so_id, tenant=tenant).first()
            if so:
                inq = Inquiry.objects.filter(sales_order=so, tenant=tenant).first()
                if inq:
                    source_inquiry_id = inq.id

    if not source_inquiry_id:
        return
    try:
        inquiry = Inquiry.objects.get(id=source_inquiry_id, tenant=tenant)
        custom_data = dict(inquiry.custom_data or {})
        custom_data[key] = value
        Inquiry.objects.filter(id=inquiry.id).update(custom_data=custom_data)
    except Exception:
        logger.warning("Failed to store %s from Fulfillment in Inquiry custom_data", key, exc_info=True)


def _resolve_source_inquiry(tenant: Any, document: Any):
    """Walk up the lineage to find the originating Inquiry for any document."""
    from tenant_apps.inquiries.models import Inquiry

    # Direct inquiry FK (PO has inquiry, Fulfillment has inquiry)
    inquiry_fk = getattr(document, "inquiry", None)
    if inquiry_fk and isinstance(inquiry_fk, Inquiry):
        return inquiry_fk
    inquiry_id = getattr(document, "inquiry_id", None)
    if inquiry_id:
        return Inquiry.objects.filter(id=inquiry_id, tenant=tenant).first()

    # Walk via custom_data source chain
    custom_data = getattr(document, "custom_data", None) or {}

    # SO → PO → Inquiry
    source_po_id = custom_data.get("source_purchase_order_id")
    if source_po_id:
        from tenant_apps.purchase_orders.models import PurchaseOrder

        po = PurchaseOrder.objects.filter(id=source_po_id, tenant=tenant).select_related("inquiry").first()
        if po and po.inquiry:
            return po.inquiry

    # CarrierPO → SO → Inquiry
    source_so_id = custom_data.get("source_sales_order_id")
    if source_so_id:
        inq = Inquiry.objects.filter(sales_order_id=source_so_id, tenant=tenant).first()
        if inq:
            return inq

    # Try Inquiry FK lookup via reverse relation
    source_inquiry_id = custom_data.get("source_inquiry_id")
    if source_inquiry_id:
        return Inquiry.objects.filter(id=source_inquiry_id, tenant=tenant).first()

    return None


# ---------------------------------------------------------------------------
# Registry — (ModelName, trigger_status) → handler
# ---------------------------------------------------------------------------

_CASCADE_HANDLERS: dict[tuple[str, str], Any] = {
    ("Inquiry", "accepted"): _cascade_inquiry_accepted_to_po,
    ("PurchaseOrder", "approved"): _cascade_po_approved_to_so,
    ("SalesOrder", "confirmed"): _cascade_so_confirmed_to_carrier_po,
    ("CarrierPurchaseOrder", "delivered"): _cascade_carrier_po_delivered_to_fulfillment,
    ("Fulfillment", "completed"): _cascade_fulfillment_completed_to_invoice,
}
