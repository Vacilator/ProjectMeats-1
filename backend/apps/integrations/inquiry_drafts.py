"""Helpers for building draft Inquiry rows from ingested email classification."""

from __future__ import annotations

from typing import Any

from apps.core.models import ProteinTypeChoices
from apps.core.services.inventory_availability import evaluate_inquiry_route
from tenant_apps.inquiries.models import (
    Inquiry,
    InquiryEntityTypeChoices,
    InquirySourceChoices,
    InquiryStatusChoices,
)

INQUIRY_ELIGIBLE_DRAFT_TYPES = {'purchase_order', 'new_customer'}
PROTEIN_LOOKUP = {
    str(choice.value).strip().lower(): str(choice.value)
    for choice in ProteinTypeChoices
}


def is_inquiry_candidate(classification: dict[str, Any] | None) -> bool:
    payload = classification or {}
    if 'inquiry_candidate' in payload:
        return bool(payload.get('inquiry_candidate'))
    return bool(payload.get('actionable')) and str(payload.get('draft_type') or '') in INQUIRY_ELIGIBLE_DRAFT_TYPES


def _normalize_text(value: Any) -> str:
    return str(value or '').strip()


def _normalize_protein(value: Any) -> str:
    normalized = _normalize_text(value).lower()
    return PROTEIN_LOOKUP.get(normalized, '')


def _build_notes(email_log, classification: dict[str, Any]) -> str:
    lines = [f'Source email subject: {email_log.subject}']
    summary = _normalize_text(classification.get('summary'))
    rationale = _normalize_text(classification.get('rationale'))
    requested_product = _normalize_text(classification.get('requested_product_name'))
    requested_quantity = _normalize_text(classification.get('requested_quantity'))
    requested_uom = _normalize_text(classification.get('requested_uom'))

    if summary:
        lines.append(f'AI summary: {summary}')
    if rationale:
        lines.append(f'AI rationale: {rationale}')
    if requested_product:
        lines.append(f'Requested product: {requested_product}')
    if requested_quantity:
        quantity_label = requested_quantity
        if requested_uom:
            quantity_label = f'{quantity_label} {requested_uom}'
        lines.append(f'Requested quantity: {quantity_label}')

    return '\n'.join(lines)


def _merge_email_intake_custom_data(
    *,
    inquiry: Inquiry,
    email_log,
    classification: dict[str, Any],
) -> dict[str, Any]:
    payload = dict(inquiry.custom_data or {})
    payload['email_intake'] = {
        'draft_type': _normalize_text(classification.get('draft_type')),
        'category': _normalize_text(classification.get('category')),
        'confidence': float(classification.get('confidence') or 0.0),
        'summary': _normalize_text(classification.get('summary')),
        'rationale': _normalize_text(classification.get('rationale')),
        'requested_product_name': _normalize_text(classification.get('requested_product_name')),
        'requested_quantity': _normalize_text(classification.get('requested_quantity')),
        'requested_uom': _normalize_text(classification.get('requested_uom')),
        'requested_protein': _normalize_protein(classification.get('requested_protein')),
        'contact_name': _normalize_text(classification.get('contact_name')),
        'contact_company': _normalize_text(classification.get('contact_company')),
        'source_message_id': _normalize_text(email_log.message_id),
        'source_thread_id': _normalize_text(email_log.thread_id),
    }
    return payload


def upsert_inquiry_draft_from_email(email_log, classification: dict[str, Any]) -> tuple[Inquiry | None, bool]:
    """Create or update the draft Inquiry anchored to a classified inbound email."""

    if not is_inquiry_candidate(classification):
        return None, False

    inquiry = (
        Inquiry.objects.filter(tenant=email_log.tenant, source_email=email_log)
        .order_by('created_on')
        .first()
    )
    created = inquiry is None
    if inquiry is None:
        inquiry = Inquiry(
            tenant=email_log.tenant,
            status=InquiryStatusChoices.DRAFT,
            source_type=InquirySourceChoices.EMAIL,
            source_email=email_log,
            entity_type=InquiryEntityTypeChoices.CUSTOMER,
        )

    if created:
        inquiry.status = InquiryStatusChoices.DRAFT
    if not inquiry.source_type:
        inquiry.source_type = InquirySourceChoices.EMAIL
    inquiry.source_email = email_log
    if not inquiry.source_email_message_id:
        inquiry.source_email_message_id = _normalize_text(email_log.message_id)
    if not inquiry.source_email_thread_id:
        inquiry.source_email_thread_id = _normalize_text(email_log.thread_id)
    if not inquiry.entity_type:
        inquiry.entity_type = InquiryEntityTypeChoices.CUSTOMER
    if not inquiry.contact_name:
        inquiry.contact_name = (
            _normalize_text(classification.get('contact_name'))
            or _normalize_text(getattr(email_log, 'sender_name', ''))
        )
    if not inquiry.contact_email:
        inquiry.contact_email = _normalize_text(email_log.sender_email)
    if not inquiry.contact_company:
        inquiry.contact_company = _normalize_text(classification.get('contact_company'))
    normalized_protein = _normalize_protein(classification.get('requested_protein'))
    if normalized_protein and not inquiry.requested_protein:
        inquiry.requested_protein = normalized_protein
    if not inquiry.notes:
        inquiry.notes = _build_notes(email_log, classification)
    route_evaluation = evaluate_inquiry_route(
        tenant=email_log.tenant,
        requested_master_product=inquiry.requested_master_product,
        requested_protein=inquiry.requested_protein,
    )
    inquiry.route_decision = route_evaluation.route_decision
    inquiry.custom_data = _merge_email_intake_custom_data(
        inquiry=inquiry,
        email_log=email_log,
        classification=classification,
    )
    inquiry.save()
    return inquiry, created
