from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from tenant_apps.invoices.models import Invoice, PaymentMethod, PaymentTransaction
from tenant_apps.purchase_orders.models import PurchaseOrder
from tenant_apps.sales_orders.models import SalesOrder

from .models import SettlementEvent, SettlementEventState, SettlementReconciliationReason

_CAMEL_BOUNDARY = re.compile(r"(?<!^)(?=[A-Z])")

INVOICE_REFERENCE_ALIASES = {
    "invoice_number",
    "invoice_no",
    "invoice_reference",
}
SALES_ORDER_REFERENCE_ALIASES = {
    "sales_order_number",
    "sales_order_num",
    "our_sales_order_num",
}
PURCHASE_ORDER_REFERENCE_ALIASES = {
    "purchase_order_number",
    "purchase_order_num",
    "po_number",
    "po_num",
    "our_purchase_order_num",
    "supplier_confirmation_order_number",
    "supplier_confirmation_order_num",
}
PAYMENT_METHOD_ALIASES = {
    "payment_method",
    "method",
}
REFERENCE_NUMBER_ALIASES = {
    "transaction_id",
    "reference_number",
    "payout_id",
    "trace_number",
}


@dataclass(frozen=True)
class SettlementMatchCandidate:
    entity_type: str
    object_id: int
    reference_value: str
    outstanding_amount: Decimal


def reconcile_settlement_event(*, event: SettlementEvent) -> dict[str, object]:
    with transaction.atomic():
        locked_event = (
            SettlementEvent.objects.select_for_update()
            .select_related("source")
            .filter(id=event.id, tenant=event.tenant)
            .first()
        )
        if not locked_event:
            return {"success": False, "reason": "event_not_found"}

        if locked_event.payment_transaction_id or locked_event.state == SettlementEventState.POSTED:
            return {
                "success": True,
                "skipped": True,
                "state": locked_event.state,
                "reason_code": locked_event.reconciliation_reason_code,
            }

        if _normalize_reference_value(locked_event.direction).lower() != "credit":
            _mark_event_for_review(
                locked_event,
                reason_code=SettlementReconciliationReason.UNSUPPORTED_DIRECTION,
            )
            return {
                "success": True,
                "state": locked_event.state,
                "reason_code": locked_event.reconciliation_reason_code,
                "requires_review": True,
            }

        payload = locked_event.normalized_payload if isinstance(locked_event.normalized_payload, dict) else {}
        reference_map = _collect_reference_values(payload)
        if not any(reference_map.values()):
            _mark_event_for_review(
                locked_event,
                reason_code=SettlementReconciliationReason.MISSING_REFERENCE,
            )
            return {
                "success": True,
                "state": locked_event.state,
                "reason_code": locked_event.reconciliation_reason_code,
                "requires_review": True,
            }

        raw_candidates = _find_reference_candidates(locked_event, reference_map)
        if not raw_candidates:
            _mark_event_for_review(
                locked_event,
                reason_code=SettlementReconciliationReason.REFERENCE_NOT_FOUND,
            )
            return {
                "success": True,
                "state": locked_event.state,
                "reason_code": locked_event.reconciliation_reason_code,
                "requires_review": True,
            }

        exact_candidates = [
            candidate for candidate in raw_candidates if candidate.outstanding_amount == locked_event.amount
        ]
        if not exact_candidates:
            _mark_event_for_review(
                locked_event,
                reason_code=SettlementReconciliationReason.AMOUNT_MISMATCH,
            )
            return {
                "success": True,
                "state": locked_event.state,
                "reason_code": locked_event.reconciliation_reason_code,
                "requires_review": True,
            }

        if len(exact_candidates) > 1:
            _mark_event_for_review(
                locked_event,
                reason_code=SettlementReconciliationReason.AMBIGUOUS_MATCH,
            )
            return {
                "success": True,
                "state": locked_event.state,
                "reason_code": locked_event.reconciliation_reason_code,
                "requires_review": True,
            }

        candidate = exact_candidates[0]
        payment = _create_payment_transaction(locked_event, candidate, payload)
        _mark_event_posted(locked_event, candidate, payment)
        return {
            "success": True,
            "state": locked_event.state,
            "reason_code": locked_event.reconciliation_reason_code,
            "payment_transaction_id": payment.id,
        }


def override_settlement_event(
    *,
    event: SettlementEvent,
    reviewer: User,
    target_type: str,
    target_id: int,
    review_note: str = "",
) -> SettlementEvent:
    with transaction.atomic():
        locked_event = (
            SettlementEvent.objects.select_for_update()
            .select_related("source")
            .filter(id=event.id, tenant=event.tenant)
            .first()
        )
        if not locked_event:
            raise ValidationError("Settlement event no longer exists.")
        if locked_event.state == SettlementEventState.POSTED or locked_event.payment_transaction_id:
            raise ValidationError("This settlement event has already been posted.")
        if locked_event.state != SettlementEventState.READY_TO_POST:
            raise ValidationError("Only review-queue settlement events can be overridden.")

        candidate = _resolve_override_candidate(
            event=locked_event,
            target_type=target_type,
            target_id=target_id,
        )
        payload = locked_event.normalized_payload if isinstance(locked_event.normalized_payload, dict) else {}
        payment = _create_payment_transaction(
            locked_event,
            candidate,
            payload,
            notes_override=_build_manual_payment_notes(locked_event, candidate, reviewer, review_note),
        )
        _mark_event_reviewed(locked_event, reviewer=reviewer, review_note=review_note)
        _mark_event_posted(
            locked_event,
            candidate,
            payment,
            reason_code=_manual_override_reason(candidate.entity_type),
        )
        return locked_event


def reject_settlement_event(
    *,
    event: SettlementEvent,
    reviewer: User,
    review_note: str = "",
) -> SettlementEvent:
    with transaction.atomic():
        locked_event = SettlementEvent.objects.select_for_update().filter(id=event.id, tenant=event.tenant).first()
        if not locked_event:
            raise ValidationError("Settlement event no longer exists.")
        if locked_event.state == SettlementEventState.POSTED or locked_event.payment_transaction_id:
            raise ValidationError("Posted settlement events cannot be rejected.")

        locked_event.state = SettlementEventState.IGNORED
        locked_event.reconciliation_reason_code = SettlementReconciliationReason.ACCOUNTANT_REJECTED
        locked_event.last_error = ""
        locked_event.processed_at = timezone.now()
        _mark_event_reviewed(locked_event, reviewer=reviewer, review_note=review_note)
        locked_event.save(
            update_fields=[
                "state",
                "reconciliation_reason_code",
                "last_error",
                "processed_at",
                "reviewed_by",
                "reviewed_at",
                "review_note",
                "modified_on",
            ]
        )
        return locked_event


def _collect_reference_values(payload: dict[str, object]) -> dict[str, set[str]]:
    return {
        "invoice": _collect_alias_values(payload, INVOICE_REFERENCE_ALIASES),
        "sales_order": _collect_alias_values(payload, SALES_ORDER_REFERENCE_ALIASES),
        "purchase_order": _collect_alias_values(payload, PURCHASE_ORDER_REFERENCE_ALIASES),
    }


def _collect_alias_values(node: object, aliases: set[str]) -> set[str]:
    values: set[str] = set()
    if isinstance(node, dict):
        for key, value in node.items():
            normalized_key = _normalize_key(key)
            if normalized_key in aliases:
                normalized_value = _normalize_reference_value(value)
                if normalized_value:
                    values.add(normalized_value)
            values.update(_collect_alias_values(value, aliases))
    elif isinstance(node, list):
        for item in node:
            values.update(_collect_alias_values(item, aliases))
    return values


def _normalize_key(key: object) -> str:
    value = _CAMEL_BOUNDARY.sub("_", str(key))
    return value.replace("-", "_").lower()


def _normalize_reference_value(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _find_reference_candidates(
    event: SettlementEvent,
    reference_map: dict[str, set[str]],
) -> list[SettlementMatchCandidate]:
    candidates: dict[tuple[str, int], SettlementMatchCandidate] = {}

    invoice_refs = reference_map["invoice"]
    if invoice_refs:
        queryset = Invoice.objects.select_for_update().filter(tenant=event.tenant, invoice_number__in=invoice_refs)
        for invoice in queryset:
            candidates[("invoice", invoice.id)] = SettlementMatchCandidate(
                entity_type="invoice",
                object_id=invoice.id,
                reference_value=invoice.invoice_number,
                outstanding_amount=_get_outstanding_amount(invoice.outstanding_amount, invoice.total_amount),
            )

    sales_refs = reference_map["sales_order"]
    if sales_refs:
        sales_query = Q()
        for value in sales_refs:
            sales_query |= Q(our_sales_order_num=value) | Q(our_sales_order_number_for_customer=value)
        queryset = SalesOrder.objects.select_for_update().filter(tenant=event.tenant).filter(sales_query)
        for sales_order in queryset:
            candidates[("sales_order", sales_order.id)] = SettlementMatchCandidate(
                entity_type="sales_order",
                object_id=sales_order.id,
                reference_value=sales_order.our_sales_order_num,
                outstanding_amount=_get_outstanding_amount(sales_order.outstanding_amount, sales_order.total_amount),
            )

    purchase_refs = reference_map["purchase_order"]
    if purchase_refs:
        purchase_query = Q()
        for value in purchase_refs:
            purchase_query |= Q(order_number=value)
            purchase_query |= Q(our_purchase_order_num=value)
            purchase_query |= Q(our_purchase_order_number_to_supplier=value)
            purchase_query |= Q(supplier_confirmation_order_num=value)
            purchase_query |= Q(supplier_confirmation_order_number=value)
        queryset = PurchaseOrder.objects.select_for_update().filter(tenant=event.tenant).filter(purchase_query)
        for purchase_order in queryset:
            candidates[("purchase_order", purchase_order.id)] = SettlementMatchCandidate(
                entity_type="purchase_order",
                object_id=purchase_order.id,
                reference_value=purchase_order.order_number,
                outstanding_amount=_get_outstanding_amount(
                    purchase_order.outstanding_amount, purchase_order.total_amount
                ),
            )

    return list(candidates.values())


def _get_outstanding_amount(current_outstanding: Decimal | None, total_amount: Decimal | None) -> Decimal:
    if current_outstanding is not None:
        return current_outstanding
    if total_amount is not None:
        return total_amount
    return Decimal("0.00")


def _create_payment_transaction(
    event: SettlementEvent,
    candidate: SettlementMatchCandidate,
    payload: dict[str, object],
    *,
    notes_override: str | None = None,
) -> PaymentTransaction:
    payment_kwargs: dict[str, object] = {
        "tenant": event.tenant,
        "amount": event.amount,
        "payment_date": event.occurred_at.date(),
        "payment_method": _resolve_payment_method(payload),
        "reference_number": _resolve_reference_number(event, payload),
        "notes": notes_override or _build_payment_notes(event, candidate),
    }
    if candidate.entity_type == "invoice":
        payment_kwargs["invoice_id"] = candidate.object_id
    elif candidate.entity_type == "sales_order":
        payment_kwargs["sales_order_id"] = candidate.object_id
    else:
        payment_kwargs["purchase_order_id"] = candidate.object_id
    return PaymentTransaction.objects.create(**payment_kwargs)


def _resolve_payment_method(payload: dict[str, object]) -> str:
    payment_method_values = _collect_alias_values(payload, PAYMENT_METHOD_ALIASES)
    if not payment_method_values:
        return PaymentMethod.OTHER
    value = sorted(payment_method_values)[0].lower().replace(" ", "_")
    valid_choices = {choice for choice, _label in PaymentMethod.choices}
    return value if value in valid_choices else PaymentMethod.OTHER


def _resolve_reference_number(event: SettlementEvent, payload: dict[str, object]) -> str:
    reference_values = _collect_alias_values(payload, REFERENCE_NUMBER_ALIASES)
    if reference_values:
        return sorted(reference_values)[0]
    if event.external_event_id:
        return event.external_event_id
    return event.idempotency_key[:32]


def _build_payment_notes(event: SettlementEvent, candidate: SettlementMatchCandidate) -> str:
    event_reference = event.external_event_id or event.idempotency_key[:12]
    return (
        f"Settlement auto-post from {event.provider_code} "
        f"event {event_reference} via {candidate.entity_type}:{candidate.reference_value}"
    )


def _mark_event_for_review(event: SettlementEvent, *, reason_code: str) -> None:
    event.state = SettlementEventState.READY_TO_POST
    event.reconciliation_reason_code = reason_code
    event.payment_transaction = None
    event.matched_invoice = None
    event.matched_sales_order = None
    event.matched_purchase_order = None
    event.last_error = ""
    event.processed_at = timezone.now()
    event.save(
        update_fields=[
            "state",
            "reconciliation_reason_code",
            "payment_transaction",
            "matched_invoice",
            "matched_sales_order",
            "matched_purchase_order",
            "last_error",
            "processed_at",
            "modified_on",
        ]
    )


def _mark_event_posted(
    event: SettlementEvent,
    candidate: SettlementMatchCandidate,
    payment: PaymentTransaction,
    *,
    reason_code: str | None = None,
) -> None:
    event.state = SettlementEventState.POSTED
    event.payment_transaction = payment
    event.reconciliation_reason_code = reason_code or _exact_match_reason(candidate.entity_type)
    event.last_error = ""
    event.processed_at = timezone.now()
    event.matched_invoice_id = payment.invoice_id
    event.matched_sales_order_id = payment.sales_order_id
    event.matched_purchase_order_id = payment.purchase_order_id
    event.save(
        update_fields=[
            "state",
            "payment_transaction",
            "reconciliation_reason_code",
            "last_error",
            "processed_at",
            "matched_invoice",
            "matched_sales_order",
            "matched_purchase_order",
            "reviewed_by",
            "reviewed_at",
            "review_note",
            "modified_on",
        ]
    )


def _exact_match_reason(entity_type: str) -> str:
    if entity_type == "invoice":
        return SettlementReconciliationReason.EXACT_INVOICE_MATCH
    if entity_type == "sales_order":
        return SettlementReconciliationReason.EXACT_SALES_ORDER_MATCH
    return SettlementReconciliationReason.EXACT_PURCHASE_ORDER_MATCH


def _manual_override_reason(entity_type: str) -> str:
    if entity_type == "invoice":
        return SettlementReconciliationReason.MANUAL_INVOICE_OVERRIDE
    if entity_type == "sales_order":
        return SettlementReconciliationReason.MANUAL_SALES_ORDER_OVERRIDE
    return SettlementReconciliationReason.MANUAL_PURCHASE_ORDER_OVERRIDE


def _resolve_override_candidate(
    *,
    event: SettlementEvent,
    target_type: str,
    target_id: int,
) -> SettlementMatchCandidate:
    if target_type == "invoice":
        invoice = Invoice.objects.select_for_update().filter(tenant=event.tenant, id=target_id).first()
        if not invoice:
            raise ValidationError("Selected invoice was not found for this tenant.")
        return SettlementMatchCandidate(
            entity_type="invoice",
            object_id=invoice.id,
            reference_value=invoice.invoice_number,
            outstanding_amount=_get_outstanding_amount(invoice.outstanding_amount, invoice.total_amount),
        )

    if target_type == "sales_order":
        sales_order = SalesOrder.objects.select_for_update().filter(tenant=event.tenant, id=target_id).first()
        if not sales_order:
            raise ValidationError("Selected sales order was not found for this tenant.")
        return SettlementMatchCandidate(
            entity_type="sales_order",
            object_id=sales_order.id,
            reference_value=sales_order.our_sales_order_num,
            outstanding_amount=_get_outstanding_amount(sales_order.outstanding_amount, sales_order.total_amount),
        )

    if target_type == "purchase_order":
        purchase_order = PurchaseOrder.objects.select_for_update().filter(tenant=event.tenant, id=target_id).first()
        if not purchase_order:
            raise ValidationError("Selected purchase order was not found for this tenant.")
        return SettlementMatchCandidate(
            entity_type="purchase_order",
            object_id=purchase_order.id,
            reference_value=purchase_order.order_number,
            outstanding_amount=_get_outstanding_amount(purchase_order.outstanding_amount, purchase_order.total_amount),
        )

    raise ValidationError("Unsupported override target type.")


def _build_manual_payment_notes(
    event: SettlementEvent,
    candidate: SettlementMatchCandidate,
    reviewer: User,
    review_note: str,
) -> str:
    event_reference = event.external_event_id or event.idempotency_key[:12]
    reviewer_label = reviewer.get_full_name().strip() or reviewer.username
    note_suffix = f" Note: {review_note.strip()}" if review_note.strip() else ""
    return (
        f"Settlement manual override from {event.provider_code} "
        f"event {event_reference} to {candidate.entity_type}:{candidate.reference_value} "
        f"by {reviewer_label}.{note_suffix}"
    )


def _mark_event_reviewed(event: SettlementEvent, *, reviewer: User, review_note: str) -> None:
    event.reviewed_by = reviewer
    event.reviewed_at = timezone.now()
    event.review_note = review_note.strip()
