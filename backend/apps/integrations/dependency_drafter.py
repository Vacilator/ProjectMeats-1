"""Dependency-aware entity draft proposer for AI email ingestion.

Analyzes a classification payload and produces structured draft proposals
for all detected related business entities in correct dependency order:

    Contact → Supplier/Plant → Customer → Inquiry/Order/Payment

Each proposal is a serializable dict that can be stored in
EmailReviewDraft.extracted_payload['related_entity_drafts'] and
rendered in the unified AI Inbox review modal.
"""

from __future__ import annotations

import logging
from typing import Any

from django.apps import apps

logger = logging.getLogger(__name__)


def build_related_entity_drafts(
    *,
    classification: dict[str, Any],
    email_log: Any,
    tenant: Any,
) -> list[dict[str, Any]]:
    """Build a list of proposed entity drafts from classification data.

    Returns a list of dicts, each representing a single entity draft:
    {
        'entity_type': 'contact' | 'supplier' | 'customer' | 'inquiry' | ...,
        'status': 'proposed' | 'exists',
        'existing_id': str | None,
        'proposed_data': { ... entity field values ... },
        'confidence': float,
        'source': 'email_body' | 'attachment' | 'combined',
    }

    Drafts are ordered by dependency: contacts first, then suppliers/customers,
    then higher-level entities (inquiries, orders).
    """
    drafts: list[dict[str, Any]] = []
    payload = classification or {}

    contact_name = _text(payload.get('contact_name'))
    contact_company = _text(payload.get('contact_company'))
    sender_email = _text(payload.get('sender_email')) or _text(getattr(email_log, 'sender_email', ''))
    sender_name = _text(getattr(email_log, 'sender_name', ''))
    draft_type = _text(payload.get('draft_type'))

    # Resolve best available person name: prefer AI-extracted, fall back to
    # sender display name (but only if it looks like a real person name, not
    # a company/department like "Accounting" or "Sales Team")
    resolved_person_name = contact_name or _person_name_from_sender(sender_name)

    # --- Supplier draft (from company name) ---
    supplier_draft = _propose_supplier(
        name=contact_company,
        email=sender_email,
        tenant=tenant,
    )
    if supplier_draft:
        drafts.append(supplier_draft)

    # --- Customer draft ---
    category = _text(payload.get('category'))
    # For "New Customer" or "Company Update" with company info, propose customer
    if category in ('New Customer', 'Company Update') and contact_company:
        customer_draft = _propose_customer(
            name=contact_company,
            tenant=tenant,
        )
        if customer_draft:
            drafts.append(customer_draft)

    # --- Contact draft (only when we have a real person name or email) ---
    if resolved_person_name and (sender_email or resolved_person_name):
        contact_draft = _propose_contact(
            name=resolved_person_name,
            email=sender_email,
            company=contact_company,
            tenant=tenant,
        )
        if contact_draft:
            drafts.append(contact_draft)
    elif draft_type == 'contact' and sender_email:
        # Intent is contact but no person name — still propose with email only
        contact_draft = _propose_contact(
            name=resolved_person_name,
            email=sender_email,
            company=contact_company,
            tenant=tenant,
        )
        if contact_draft:
            drafts.append(contact_draft)

    # --- Inquiry draft (for PO / New Customer emails) ---
    draft_type = _text(payload.get('draft_type'))
    if draft_type in ('purchase_order', 'new_customer'):
        inquiry_draft = _propose_inquiry(payload, email_log)
        if inquiry_draft:
            drafts.append(inquiry_draft)

    # --- Invoice / BOL drafts from attachment document types ---
    att_doc_types = payload.get('attachment_document_types') or []
    for att in att_doc_types:
        if not isinstance(att, dict):
            continue
        doc_type = _text(att.get('doc_type'))
        att_name = _text(att.get('name'))
        if doc_type == 'invoice':
            drafts.append({
                'entity_type': 'invoice',
                'status': 'proposed',
                'existing_id': None,
                'proposed_data': {
                    'source_attachment': att_name,
                    'total_amount': _text(payload.get('total_amount')),
                    'po_number': _text(payload.get('po_number')),
                    'contact_company': contact_company,
                },
                'confidence': float(payload.get('confidence') or 0.0),
                'source': 'attachment',
            })
        elif doc_type == 'bill_of_lading':
            drafts.append({
                'entity_type': 'bill_of_lading',
                'status': 'proposed',
                'existing_id': None,
                'proposed_data': {
                    'source_attachment': att_name,
                    'bol_number': _text(payload.get('bol_number')),
                    'po_number': _text(payload.get('po_number')),
                },
                'confidence': float(payload.get('confidence') or 0.0),
                'source': 'attachment',
            })

    return drafts


def _text(value: Any) -> str:
    return str(value or '').strip()


# Common non-person sender names (departments, roles, generic addresses)
_NON_PERSON_NAMES = frozenset({
    'accounting', 'admin', 'billing', 'contact', 'dispatch', 'finance',
    'help desk', 'helpdesk', 'hr', 'info', 'invoicing', 'logistics',
    'no reply', 'noreply', 'notifications', 'office', 'operations', 'ops',
    'orders', 'payroll', 'procurement', 'purchasing', 'reception',
    'sales', 'sales team', 'shipping', 'support', 'team', 'warehouse',
})


def _person_name_from_sender(sender_name: str) -> str:
    """Return sender_name only if it looks like an individual person name.

    Filters out department/role names (e.g. "Accounting", "Sales Team") that
    are valid display names but not useful as contact person names.
    """
    if not sender_name:
        return ''
    normalized = sender_name.strip().lower()
    if normalized in _NON_PERSON_NAMES:
        return ''
    # Single-word names that match common non-person patterns
    if ' ' not in sender_name.strip() and normalized in {
        w for phrase in _NON_PERSON_NAMES for w in phrase.split()
    }:
        return ''
    return sender_name.strip()


def _propose_supplier(*, name: str, email: str, tenant: Any) -> dict[str, Any] | None:
    if not name:
        return None

    try:
        Supplier = apps.get_model('suppliers', 'Supplier')
        existing = Supplier.objects.filter(
            tenant=tenant,
            company_name__iexact=name,
        ).first()
        if existing:
            return {
                'entity_type': 'supplier',
                'status': 'exists',
                'existing_id': str(existing.pk),
                'proposed_data': {'company_name': name, 'email': email},
                'confidence': 1.0,
                'source': 'email_body',
            }
    except Exception:
        logger.debug('Supplier model lookup failed', exc_info=True)

    return {
        'entity_type': 'supplier',
        'status': 'proposed',
        'existing_id': None,
        'proposed_data': {
            'company_name': name,
            'email': email,
            'status': 'active',
        },
        'confidence': 0.7,
        'source': 'email_body',
    }


def _propose_customer(*, name: str, tenant: Any) -> dict[str, Any] | None:
    if not name:
        return None

    try:
        Customer = apps.get_model('customers', 'Customer')
        existing = Customer.objects.filter(
            tenant=tenant,
            company_name__iexact=name,
        ).first()
        if existing:
            return {
                'entity_type': 'customer',
                'status': 'exists',
                'existing_id': str(existing.pk),
                'proposed_data': {'company_name': name},
                'confidence': 1.0,
                'source': 'email_body',
            }
    except Exception:
        logger.debug('Customer model lookup failed', exc_info=True)

    return {
        'entity_type': 'customer',
        'status': 'proposed',
        'existing_id': None,
        'proposed_data': {
            'company_name': name,
            'status': 'active',
        },
        'confidence': 0.6,
        'source': 'email_body',
    }


def _propose_contact(
    *, name: str, email: str, company: str, tenant: Any,
) -> dict[str, Any] | None:
    if not email and not name:
        return None

    try:
        Contact = apps.get_model('contacts', 'Contact')
        if email:
            existing = Contact.objects.filter(
                tenant=tenant,
                email__iexact=email,
            ).first()
            if existing:
                return {
                    'entity_type': 'contact',
                    'status': 'exists',
                    'existing_id': str(existing.pk),
                    'proposed_data': {
                        'name': name,
                        'email': email,
                        'company': company,
                    },
                    'confidence': 1.0,
                    'source': 'email_body',
                }
    except Exception:
        logger.debug('Contact model lookup failed', exc_info=True)

    parts = name.split(' ', 1) if name else ['', '']
    return {
        'entity_type': 'contact',
        'status': 'proposed',
        'existing_id': None,
        'proposed_data': {
            'first_name': parts[0],
            'last_name': parts[1] if len(parts) > 1 else '',
            'email': email,
            'company': company,
            'contact_type': 'General',
        },
        'confidence': 0.65,
        'source': 'email_body',
    }


def _propose_inquiry(
    payload: dict[str, Any], email_log: Any,
) -> dict[str, Any] | None:
    return {
        'entity_type': 'inquiry',
        'status': 'proposed',
        'existing_id': None,
        'proposed_data': {
            'contact_name': _text(payload.get('contact_name')),
            'contact_email': _text(payload.get('sender_email')) or _text(getattr(email_log, 'sender_email', '')),
            'contact_company': _text(payload.get('contact_company')),
            'requested_protein': _text(payload.get('requested_protein')),
            'requested_product_name': _text(payload.get('requested_product_name')),
            'requested_quantity': _text(payload.get('requested_quantity')),
            'requested_uom': _text(payload.get('requested_uom')),
            'po_number': _text(payload.get('po_number')),
            'notes': _text(payload.get('summary')),
        },
        'confidence': float(payload.get('confidence') or 0.0),
        'source': 'combined',
    }
