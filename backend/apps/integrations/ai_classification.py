"""AI-powered email ingestion classification helpers."""

from __future__ import annotations

import json
import os
from typing import Any

from django.conf import settings

from apps.core.models import ProteinTypeChoices
from apps.system.services.ai_model_resolver import get_active_openai_model_id

ACTIONABLE_EMAIL_CATEGORIES: dict[str, str] = {
    'Purchase Order': 'purchase_order',
    'BOL': 'bill_of_lading',
    'New Customer': 'new_customer',
    'Invoice': 'invoice',
    'Pricing Sheet': 'pricing_sheet',
}
INQUIRY_EMAIL_CATEGORIES = {'Purchase Order', 'New Customer'}
SUPPORTED_EMAIL_CATEGORIES = tuple([*ACTIONABLE_EMAIL_CATEGORIES.keys(), 'Spam/Other'])
SUPPORTED_PROTEIN_VALUES = ('', *(choice.value for choice in ProteinTypeChoices))


def classify_ingested_email(
    *,
    subject: str,
    sender_email: str,
    body_text: str,
    has_attachments: bool,
    attachment_text: str = '',
) -> dict[str, Any]:
    """Classify an ingested email into a lightweight operator review bucket."""

    openai_api_key = getattr(settings, 'OPENAI_API_KEY', None) or os.environ.get('OPENAI_API_KEY')
    if not openai_api_key:
        raise RuntimeError('OpenAI is not configured on the server.')

    from openai import OpenAI

    client = OpenAI(
        api_key=openai_api_key,
        organization=getattr(settings, 'OPENAI_ORG_ID', None) or os.environ.get('OPENAI_ORG_ID') or None,
    )
    prompt = (
        'Classify this email into exactly one category: '
        + ', '.join(SUPPORTED_EMAIL_CATEGORIES)
        + '.\nReturn JSON only.\n'
        'Rules:\n'
        '1. Use Spam/Other when the message is not actionable for ProjectMeats operators.\n'
        '2. Keep summary under 160 characters.\n'
        '3. Confidence must be a number between 0 and 1.\n'
        '4. actionable must be true only for Purchase Order, BOL, New Customer, Invoice, or Pricing Sheet.\n'
        '5. Extract contact/company/product details only when clearly supported by the email.\n'
        '6. requested_protein must be one of: '
        + ', '.join(value for value in SUPPORTED_PROTEIN_VALUES if value)
        + ' or an empty string when unknown.\n'
        '7. requested_quantity and requested_uom must stay as plain strings and can be empty.\n'
        '8. When attachment content is provided, use it alongside the email body for classification and extraction.\n'
        '9. po_number: extract PO/order number when present, empty string otherwise.\n'
        '10. bol_number: extract BOL/bill of lading number when present, empty string otherwise.\n'
        '11. total_amount: extract total dollar amount as string when present, empty string otherwise.\n'
        '12. attachment_document_types: for each attachment section, classify its type '
        '(purchase_order, bill_of_lading, invoice, pricing_sheet, manifest, label, certificate, photo, other). '
        'Return a list of objects with name (filename) and doc_type.\n\n'
        f'Subject: {subject}\n'
        f'Sender: {sender_email}\n'
        f'Has attachments: {has_attachments}\n'
        f'Body:\n{body_text[:6000]}'
    )
    if attachment_text:
        prompt += f'\n\n--- Attachment Content ---\n{attachment_text[:8000]}'
    response_schema = {
        'type': 'json_schema',
        'json_schema': {
            'name': 'email_ingestion_classification',
            'strict': True,
            'schema': {
                'type': 'object',
                'properties': {
                    'category': {
                        'type': 'string',
                        'enum': list(SUPPORTED_EMAIL_CATEGORIES),
                    },
                    'confidence': {
                        'type': 'number',
                        'minimum': 0,
                        'maximum': 1,
                    },
                    'summary': {'type': 'string'},
                    'rationale': {'type': 'string'},
                    'actionable': {'type': 'boolean'},
                    'contact_name': {'type': 'string'},
                    'contact_company': {'type': 'string'},
                    'requested_product_name': {'type': 'string'},
                    'requested_protein': {
                        'type': 'string',
                        'enum': list(SUPPORTED_PROTEIN_VALUES),
                    },
                    'requested_quantity': {'type': 'string'},
                    'requested_uom': {'type': 'string'},
                    'po_number': {'type': 'string'},
                    'bol_number': {'type': 'string'},
                    'total_amount': {'type': 'string'},
                    'attachment_document_types': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'name': {'type': 'string'},
                                'doc_type': {'type': 'string'},
                            },
                            'required': ['name', 'doc_type'],
                            'additionalProperties': False,
                        },
                    },
                },
                'required': [
                    'category',
                    'confidence',
                    'summary',
                    'rationale',
                    'actionable',
                    'contact_name',
                    'contact_company',
                    'requested_product_name',
                    'requested_protein',
                    'requested_quantity',
                    'requested_uom',
                    'po_number',
                    'bol_number',
                    'total_amount',
                    'attachment_document_types',
                ],
                'additionalProperties': False,
            },
        },
    }
    completion = client.chat.completions.create(
        model=get_active_openai_model_id(fallback='gpt-4o-mini'),
        temperature=0,
        response_format=response_schema,
        messages=[
            {
                'role': 'system',
                'content': 'You classify operational inbox mail for a meat logistics business.',
            },
            {'role': 'user', 'content': prompt},
        ],
    )
    message = completion.choices[0].message if completion.choices else None
    content = str(getattr(message, 'content', '') or '').strip()
    if not content:
        raise RuntimeError('The email classification service returned an empty response.')

    parsed = json.loads(content)
    if not isinstance(parsed, dict):
        raise RuntimeError('The email classification service returned an invalid response shape.')

    category = str(parsed.get('category') or 'Spam/Other').strip()
    if category not in SUPPORTED_EMAIL_CATEGORIES:
        category = 'Spam/Other'

    try:
        confidence = float(parsed.get('confidence') or 0.0)
    except (TypeError, ValueError):
        confidence = 0.0

    summary = str(parsed.get('summary') or '').strip()
    rationale = str(parsed.get('rationale') or '').strip()
    actionable = category in ACTIONABLE_EMAIL_CATEGORIES
    requested_protein = str(parsed.get('requested_protein') or '').strip()
    if requested_protein not in SUPPORTED_PROTEIN_VALUES:
        requested_protein = ''

    return {
        'category': category,
        'draft_type': ACTIONABLE_EMAIL_CATEGORIES.get(category, ''),
        'confidence': max(0.0, min(confidence, 1.0)),
        'summary': summary,
        'rationale': rationale,
        'actionable': actionable,
        'inquiry_candidate': actionable and category in INQUIRY_EMAIL_CATEGORIES,
        'contact_name': str(parsed.get('contact_name') or '').strip(),
        'contact_company': str(parsed.get('contact_company') or '').strip(),
        'requested_product_name': str(parsed.get('requested_product_name') or '').strip(),
        'requested_protein': requested_protein,
        'requested_quantity': str(parsed.get('requested_quantity') or '').strip(),
        'requested_uom': str(parsed.get('requested_uom') or '').strip(),
        'po_number': str(parsed.get('po_number') or '').strip(),
        'bol_number': str(parsed.get('bol_number') or '').strip(),
        'total_amount': str(parsed.get('total_amount') or '').strip(),
        'attachment_document_types': parsed.get('attachment_document_types') or [],
    }
