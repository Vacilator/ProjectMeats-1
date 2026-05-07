"""Create tenant-safe draft supplier purchase orders from normalized quote replies."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.integrations.models import EmailLog
from apps.tenants.rls import tenant_rls
from tenant_apps.ai_assistant.models import AIFeedbackLog
from tenant_apps.contacts.services import resolve_supplier_order_contact_routes
from tenant_apps.inquiries.models import Inquiry, InquiryRouteDecisionChoices, InquirySupplierRFQ
from tenant_apps.purchase_orders.models import PurchaseOrder, PurchaseOrderStatus

WEIGHT_UOM_MAP = {
    "LB": "LBS",
    "LBS": "LBS",
    "POUND": "LBS",
    "POUNDS": "LBS",
    "KG": "KG",
    "KGS": "KG",
    "KILOGRAM": "KG",
    "KILOGRAMS": "KG",
}


class SupplierQuotePODraftError(ValueError):
    """Stable error raised when a draft PO cannot be created safely."""


@dataclass(frozen=True)
class SupplierQuotePODraftResult:
    """Return value for supplier quote PO draft creation."""

    purchase_order: PurchaseOrder
    rfq: InquirySupplierRFQ
    created: bool


def create_supplier_quote_purchase_order_draft(
    *,
    tenant: Any,
    inquiry: Inquiry,
    rfq_id: int,
) -> SupplierQuotePODraftResult:
    """Create or return the draft purchase order anchored to a qualifying supplier reply."""

    with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
        inquiry = (
            Inquiry.objects.select_for_update(of=("self",))
            .select_related(
                "requested_master_product",
                "requested_master_product__system_product",
            )
            .filter(id=inquiry.id, tenant=tenant)
            .first()
        )
        if not inquiry:
            raise SupplierQuotePODraftError("Inquiry not found for this tenant.")
        if inquiry.route_decision != InquiryRouteDecisionChoices.BROKER:
            raise SupplierQuotePODraftError("Only broker inquiries can create supplier purchase order drafts.")

        rfq = (
            InquirySupplierRFQ.objects.select_for_update(of=("self",))
            .select_related(
                "supplier",
                "inquiry",
                "inquiry__requested_master_product",
                "inquiry__requested_master_product__system_product",
            )
            .filter(id=rfq_id, tenant=tenant, inquiry=inquiry)
            .first()
        )
        if not rfq:
            raise SupplierQuotePODraftError("Supplier RFQ not found for this inquiry and tenant.")

        latest_reply_parse = _get_latest_reply_parse(rfq)
        normalized_quote = _get_qualifying_normalized_quote(latest_reply_parse)

        existing = _get_existing_purchase_order(tenant=tenant, inquiry=inquiry, rfq=rfq)
        if existing is not None:
            _update_review_artifacts(
                tenant=tenant,
                inquiry=inquiry,
                rfq=rfq,
                purchase_order=existing,
                latest_reply_parse=latest_reply_parse,
            )
            return SupplierQuotePODraftResult(purchase_order=existing, rfq=rfq, created=False)

        contact_routing = _build_contact_routing(tenant=tenant, inquiry=inquiry, rfq=rfq)
        supplier_contact = dict(contact_routing.get("supplier_contact") or {})
        purchase_order = PurchaseOrder.objects.create(
            tenant=tenant,
            supplier=rfq.supplier,
            product=_resolve_product(inquiry),
            item_description=_build_item_description(inquiry=inquiry, normalized_quote=normalized_quote),
            quantity=_resolve_quantity(normalized_quote),
            total_weight=_resolve_total_weight(normalized_quote),
            weight_unit=_resolve_weight_unit(normalized_quote),
            price_per_unit=_to_decimal(normalized_quote.get("price_per_unit")),
            total_amount=_resolve_total_amount(normalized_quote),
            status=PurchaseOrderStatus.DRAFT,
            order_date=timezone.now().date(),
            delivery_date=None,
            type_of_protein=inquiry.requested_protein or "",
            supplier_contact_name=str(
                supplier_contact.get("recipient_name") or getattr(rfq.supplier, "contact_person", "") or ""
            ),
            supplier_contact_phone=str(
                supplier_contact.get("phone") or getattr(rfq.supplier, "phone", "") or ""
            ),
            supplier_contact_email=str(
                supplier_contact.get("recipient_email") or rfq.recipient_email or ""
            ),
            notes=_build_purchase_order_notes(
                inquiry=inquiry,
                rfq=rfq,
                latest_reply_parse=latest_reply_parse,
                normalized_quote=normalized_quote,
            ),
            custom_data=_build_purchase_order_custom_data(
                inquiry=inquiry,
                rfq=rfq,
                latest_reply_parse=latest_reply_parse,
                normalized_quote=normalized_quote,
                contact_routing=contact_routing,
            ),
        )

        inquiry.supplier_purchase_order = purchase_order
        inquiry.modified_on = timezone.now()
        inquiry.save(update_fields=["supplier_purchase_order", "modified_on"])

        _backwrite_rfq_lineage(
            rfq=rfq,
            purchase_order=purchase_order,
            latest_reply_parse=latest_reply_parse,
        )
        _update_review_artifacts(
            tenant=tenant,
            inquiry=inquiry,
            rfq=rfq,
            purchase_order=purchase_order,
            latest_reply_parse=latest_reply_parse,
        )
        return SupplierQuotePODraftResult(purchase_order=purchase_order, rfq=rfq, created=True)


def _get_latest_reply_parse(rfq: InquirySupplierRFQ) -> dict[str, Any]:
    latest_reply_parse = dict((rfq.custom_data or {}).get("latest_reply_parse") or {})
    if not latest_reply_parse:
        raise SupplierQuotePODraftError("The selected RFQ has no normalized supplier reply payload yet.")
    if latest_reply_parse.get("parse_status") != "parsed":
        raise SupplierQuotePODraftError("Only parsed supplier quote replies can create draft purchase orders.")
    if latest_reply_parse.get("correlation_status") != "matched":
        raise SupplierQuotePODraftError("Only matched supplier quote replies can create draft purchase orders.")
    return latest_reply_parse


def _get_qualifying_normalized_quote(latest_reply_parse: dict[str, Any]) -> dict[str, Any]:
    normalized_quote = dict(latest_reply_parse.get("normalized_quote") or {})
    availability_status = str(normalized_quote.get("availability_status") or "").strip().lower()
    if availability_status not in {"affirmative", "partial"}:
        raise SupplierQuotePODraftError("Only affirmative or partial supplier replies can create draft purchase orders.")
    has_commercial_signal = any(
        (
            normalized_quote.get("price_per_unit") is not None,
            normalized_quote.get("quantity") is not None,
            str(normalized_quote.get("lead_time_text") or "").strip(),
            str(normalized_quote.get("offered_product_name") or "").strip(),
        )
    )
    if not has_commercial_signal:
        raise SupplierQuotePODraftError("The supplier reply must include at least one commercial signal before drafting a purchase order.")
    return normalized_quote


def _get_existing_purchase_order(*, tenant: Any, inquiry: Inquiry, rfq: InquirySupplierRFQ) -> PurchaseOrder | None:
    rfq_custom_data = dict(rfq.custom_data or {})
    existing_po_id = rfq_custom_data.get("draft_purchase_order_id")
    if existing_po_id:
        purchase_order = PurchaseOrder.objects.for_tenant(tenant).filter(id=existing_po_id).first()
        if purchase_order:
            return purchase_order
        raise SupplierQuotePODraftError("The RFQ points to a missing draft purchase order. Manual review is required.")

    if inquiry.supplier_purchase_order_id:
        purchase_order = (
            PurchaseOrder.objects.for_tenant(tenant)
            .select_for_update(of=("self",))
            .filter(id=inquiry.supplier_purchase_order_id)
            .first()
        )
        if purchase_order is None:
            raise SupplierQuotePODraftError("The inquiry points to a missing supplier purchase order. Manual review is required.")

        source_lineage = dict((purchase_order.custom_data or {}).get("source_lineage") or {})
        if source_lineage.get("rfq_id") == rfq.id:
            return purchase_order
        raise SupplierQuotePODraftError(
            "This inquiry is already linked to a different supplier purchase order. Manual review is required."
        )

    return None


def _resolve_product(inquiry: Inquiry):
    requested_master_product = getattr(inquiry, "requested_master_product", None)
    return getattr(requested_master_product, "system_product", None)


def _build_item_description(*, inquiry: Inquiry, normalized_quote: dict[str, Any]) -> str:
    offered_product_name = str(normalized_quote.get("offered_product_name") or "").strip()
    if offered_product_name:
        return offered_product_name
    requested_master_product = getattr(inquiry, "requested_master_product", None)
    requested_item_name = str(getattr(requested_master_product, "item_name", "") or "").strip()
    if requested_item_name:
        return requested_item_name
    return f"Supplier quote for {inquiry.inquiry_number}"


def _resolve_quantity(normalized_quote: dict[str, Any]) -> int | None:
    uom = _normalize_uom(normalized_quote.get("uom"))
    quantity = normalized_quote.get("quantity")
    if quantity is None or uom in WEIGHT_UOM_MAP:
        return None
    try:
        return int(Decimal(str(quantity)))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _resolve_total_weight(normalized_quote: dict[str, Any]) -> Decimal | None:
    uom = _normalize_uom(normalized_quote.get("uom"))
    quantity = normalized_quote.get("quantity")
    if quantity is None or uom not in WEIGHT_UOM_MAP:
        return None
    return _to_decimal(quantity)


def _resolve_weight_unit(normalized_quote: dict[str, Any]) -> str:
    uom = _normalize_uom(normalized_quote.get("uom"))
    return WEIGHT_UOM_MAP.get(uom, "LBS")


def _resolve_total_amount(normalized_quote: dict[str, Any]) -> Decimal:
    price = _to_decimal(normalized_quote.get("price_per_unit"))
    quantity = _to_decimal(normalized_quote.get("quantity"))
    if price is None or quantity is None:
        return Decimal("0.00")
    return (price * quantity).quantize(Decimal("0.01"))


def _build_purchase_order_notes(
    *,
    inquiry: Inquiry,
    rfq: InquirySupplierRFQ,
    latest_reply_parse: dict[str, Any],
    normalized_quote: dict[str, Any],
) -> str:
    lines = [
        f"Drafted from supplier quote reply for inquiry {inquiry.inquiry_number}.",
        f"RFQ correlation key: {rfq.correlation_key}",
    ]
    lead_time_text = str(normalized_quote.get("lead_time_text") or "").strip()
    if lead_time_text:
        lines.append(f"Supplier lead time: {lead_time_text}")
    summary = str(latest_reply_parse.get("summary") or "").strip()
    if summary:
        lines.append(f"Quote summary: {summary}")
    notes = str(normalized_quote.get("notes") or "").strip()
    if notes:
        lines.append(f"Supplier notes: {notes}")
    return "\n".join(lines)


def _build_purchase_order_custom_data(
    *,
    inquiry: Inquiry,
    rfq: InquirySupplierRFQ,
    latest_reply_parse: dict[str, Any],
    normalized_quote: dict[str, Any],
    contact_routing: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    lineage = dict(latest_reply_parse.get("lineage") or {})
    return {
        "source_type": "supplier_quote_reply",
        "review_state": "pending_review",
        "source_lineage": {
            "inquiry_id": inquiry.id,
            "inquiry_number": inquiry.inquiry_number,
            "rfq_id": rfq.id,
            "supplier_id": rfq.supplier_id,
            "correlation_key": str(rfq.correlation_key),
            "email_log_id": lineage.get("email_log_id"),
            "email_message_id": lineage.get("email_message_id") or "",
            "email_thread_id": lineage.get("email_thread_id") or "",
        },
        "normalized_quote": normalized_quote,
        "supplier_reply_parse": latest_reply_parse,
        "selected_bid": {
            "rfq_id": rfq.id,
            "supplier_id": rfq.supplier_id,
            "supplier_name": getattr(rfq.supplier, "name", ""),
            "recipient_email": rfq.recipient_email,
            "contact_routing": {
                "supplier_contact": dict(contact_routing.get("supplier_contact") or {}),
            },
            "normalized_quote": normalized_quote,
        },
        "contact_routing": contact_routing,
    }


def _build_contact_routing(
    *,
    tenant: Any,
    inquiry: Inquiry,
    rfq: InquirySupplierRFQ,
) -> dict[str, dict[str, Any]]:
    routing = {
        role: resolution.as_dict()
        for role, resolution in resolve_supplier_order_contact_routes(
            tenant=tenant,
            supplier=rfq.supplier,
            inquiry=inquiry,
        ).items()
    }
    rfq_routing = dict((rfq.custom_data or {}).get("recipient_routing") or {})
    if rfq_routing:
        existing = dict(routing.get("supplier_contact") or {})
        for key, value in rfq_routing.items():
            if existing.get(key) in (None, "", [], {}):
                existing[key] = value
        routing["supplier_contact"] = existing
    return routing


def _backwrite_rfq_lineage(
    *,
    rfq: InquirySupplierRFQ,
    purchase_order: PurchaseOrder,
    latest_reply_parse: dict[str, Any],
) -> None:
    custom_data = dict(rfq.custom_data or {})
    custom_data["draft_purchase_order_id"] = purchase_order.id
    custom_data["draft_purchase_order_order_number"] = purchase_order.order_number
    updated_parse = dict(latest_reply_parse)
    updated_lineage = dict(updated_parse.get("lineage") or {})
    updated_lineage["purchase_order_id"] = purchase_order.id
    updated_parse["lineage"] = updated_lineage
    custom_data["latest_reply_parse"] = updated_parse
    rfq.custom_data = custom_data
    rfq.modified_on = timezone.now()
    rfq.save(update_fields=["custom_data", "modified_on"])


def _update_review_artifacts(
    *,
    tenant: Any,
    inquiry: Inquiry,
    rfq: InquirySupplierRFQ,
    purchase_order: PurchaseOrder,
    latest_reply_parse: dict[str, Any],
) -> None:
    review_target_url = _purchase_order_review_target_url(purchase_order.id)
    source_lineage = dict((purchase_order.custom_data or {}).get("source_lineage") or {})
    email_log_id = source_lineage.get("email_log_id")
    email_message_id = source_lineage.get("email_message_id")

    feedback_document_id = _email_feedback_document_id(
        message_id=email_message_id,
        email_log_id=email_log_id,
    )
    payload = {
        **dict(latest_reply_parse),
        "purchase_order_id": purchase_order.id,
        "order_number": purchase_order.order_number,
        "supplier_name": getattr(rfq.supplier, "name", ""),
        "status": purchase_order.status,
        "review_target_url": review_target_url,
    }
    if feedback_document_id is not None:
        AIFeedbackLog.objects.update_or_create(
            tenant=tenant,
            document_id=feedback_document_id,
            defaults={
                "document_type": "purchase_order",
                "original_extracted_data": payload,
                "confidence_score": float(latest_reply_parse.get("confidence") or 0.0),
            },
        )

    if email_log_id:
        now = timezone.now()
        email_log = EmailLog.objects.filter(id=email_log_id, tenant=tenant).first()
        if email_log is not None:
            email_payload = dict(email_log.extracted_data or {})
            email_payload["purchase_order_id"] = purchase_order.id
            email_payload["order_number"] = purchase_order.order_number
            email_payload["review_target_url"] = review_target_url
            email_payload["category"] = "purchase_order"
            email_payload["document_type"] = "purchase_order"
            EmailLog.objects.filter(id=email_log.id).update(
                related_order_id=purchase_order.id,
                extracted_data=email_payload,
                status="order_created",
                processed_at=now,
                updated_at=now,
            )


def _email_feedback_document_id(*, message_id: Any, email_log_id: Any) -> uuid.UUID | None:
    identifier = str(message_id or email_log_id or "").strip()
    if not identifier:
        return None
    return uuid.uuid5(uuid.NAMESPACE_URL, f"apps.integrations.EmailLog:{identifier}")


def _purchase_order_review_target_url(purchase_order_id: int) -> str:
    return f"/purchase-orders/{purchase_order_id}/review"


def _normalize_uom(value: Any) -> str:
    return str(value or "").strip().upper()


def _to_decimal(value: Any) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None
