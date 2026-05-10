"""AI-powered email ingestion classification helpers."""

from __future__ import annotations

import json
import os
from typing import Any

from django.conf import settings

from apps.core.models import ProteinTypeChoices
from apps.system.services.ai_model_resolver import get_active_openai_model_id

ACTIONABLE_EMAIL_CATEGORIES: dict[str, str] = {
    "Purchase Order": "purchase_order",
    "BOL": "bill_of_lading",
    "New Customer": "new_customer",
    "Invoice": "invoice",
    "Pricing Sheet": "pricing_sheet",
    "Contact Update": "contact",
    "Company Update": "company",
    "Payment Notice": "payment",
    "Supplier Note": "supplier_note",
}
INQUIRY_EMAIL_CATEGORIES = {"Purchase Order", "New Customer"}
SUPPORTED_EMAIL_CATEGORIES = tuple([*ACTIONABLE_EMAIL_CATEGORIES.keys(), "Spam/Other"])
SUPPORTED_PROTEIN_VALUES = ("", *(choice.value for choice in ProteinTypeChoices))


def classify_ingested_email(
    *,
    subject: str,
    sender_email: str,
    sender_name: str = "",
    body_text: str,
    has_attachments: bool,
    attachment_text: str = "",
) -> dict[str, Any]:
    """Classify an ingested email into a lightweight operator review bucket.

    Returns a safe fallback when OpenAI is not configured rather than raising,
    so the email ingestion pipeline degrades gracefully.
    """

    openai_api_key = getattr(settings, "OPENAI_API_KEY", None) or os.environ.get("OPENAI_API_KEY")
    if not openai_api_key:
        import logging
        logging.getLogger(__name__).warning(
            "OpenAI is not configured — returning manual-review fallback for email '%s'",
            subject[:80],
        )
        return _manual_review_fallback(subject=subject, sender_email=sender_email, sender_name=sender_name)

    from openai import OpenAI

    client = OpenAI(
        api_key=openai_api_key,
        organization=getattr(settings, "OPENAI_ORG_ID", None) or os.environ.get("OPENAI_ORG_ID") or None,
    )
    prompt = (
        "Classify this email into exactly one category: "
        + ", ".join(SUPPORTED_EMAIL_CATEGORIES)
        + ".\nReturn JSON only.\n"
        "Rules:\n"
        "1. Use Spam/Other ONLY when the message contains zero business-relevant information "
        "(no contact name, no company, no dollar amount, no invoice/PO number, no product reference).\n"
        "2. 'Contact Update': Use when a specific individual person's name is identifiable "
        "(from sender display name, email signature, body text, or sign-off). "
        "The email must contain enough info to create or update a contact record (at minimum a person name).\n"
        "3. 'Company Update': Use when the email contains company/organization information "
        "(company name, domain, industry details) but NO identifiable individual person name. "
        "For example, a generic info@ or sales@ email with company details but no personal name.\n"
        "4. If the email mentions a payment, remittance, dollar amount with an invoice reference, "
        "classify as 'Payment Notice'.\n"
        "5. If the email is from a supplier with operational info (shipping updates, notes, availability), "
        "classify as 'Supplier Note'.\n"
        "6. Keep summary under 160 characters.\n"
        "7. Confidence must be a number between 0 and 1.\n"
        "8. actionable must be true for all categories EXCEPT Spam/Other.\n"
        "9. Extract contact/company/product details only when clearly supported by the email.\n"
        "10. contact_name: Extract the individual person's full name. Use the sender display name "
        "if the body/signature does not provide a better name. NEVER leave empty when a person name "
        "is available from any source (sender, signature, body, sign-off like 'Best regards, Name').\n"
        "11. contact_company: Extract the company/organization name when present.\n"
        "12. requested_protein must be one of: "
        + ", ".join(value for value in SUPPORTED_PROTEIN_VALUES if value)
        + " or an empty string when unknown.\n"
        "13. requested_quantity and requested_uom must stay as plain strings and can be empty.\n"
        "14. When attachment content is provided, use it alongside the email body for classification and extraction.\n"
        "15. po_number: extract PO/order number when present, empty string otherwise.\n"
        "16. bol_number: extract BOL/bill of lading number when present, empty string otherwise.\n"
        "17. total_amount: extract total dollar amount as string when present, empty string otherwise.\n"
        "18. attachment_document_types: for each attachment section, classify its type "
        "(purchase_order, bill_of_lading, invoice, pricing_sheet, manifest, label, certificate, photo, other). "
        "Return a list of objects with name (filename) and doc_type.\n"
        "19. field_confidence: for each extracted field (contact_name, contact_company, po_number, bol_number, "
        "total_amount, requested_product_name, requested_protein, requested_quantity), provide a confidence "
        "score 0-1. Return as object with field names as keys and confidence numbers as values.\n\n"
        f"Subject: {subject}\n"
        + (f"Sender: {sender_name} <{sender_email}>" if sender_name else f"Sender: {sender_email}")
    )
    prompt += (
        f"\nHas attachments: {has_attachments}\n"
        f"Body:\n{body_text[:6000]}"
    )
    if attachment_text:
        prompt += (
            "\n\n--- Source: email_body (above) ---\n"
            "--- Attachment Content (below, each tagged with source) ---\n"
            f"{attachment_text[:8000]}"
        )
    response_schema = {
        "type": "json_schema",
        "json_schema": {
            "name": "email_ingestion_classification",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "enum": list(SUPPORTED_EMAIL_CATEGORIES),
                    },
                    "confidence": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1,
                    },
                    "summary": {"type": "string"},
                    "rationale": {"type": "string"},
                    "actionable": {"type": "boolean"},
                    "contact_name": {"type": "string"},
                    "contact_company": {"type": "string"},
                    "requested_product_name": {"type": "string"},
                    "requested_protein": {
                        "type": "string",
                        "enum": list(SUPPORTED_PROTEIN_VALUES),
                    },
                    "requested_quantity": {"type": "string"},
                    "requested_uom": {"type": "string"},
                    "po_number": {"type": "string"},
                    "bol_number": {"type": "string"},
                    "total_amount": {"type": "string"},
                    "attachment_document_types": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "doc_type": {"type": "string"},
                            },
                            "required": ["name", "doc_type"],
                            "additionalProperties": False,
                        },
                    },
                    "field_confidence": {
                        "type": "object",
                        "properties": {
                            "contact_name": {"type": "number"},
                            "contact_company": {"type": "number"},
                            "po_number": {"type": "number"},
                            "bol_number": {"type": "number"},
                            "total_amount": {"type": "number"},
                            "requested_product_name": {"type": "number"},
                            "requested_protein": {"type": "number"},
                            "requested_quantity": {"type": "number"},
                        },
                        "required": [
                            "contact_name",
                            "contact_company",
                            "po_number",
                            "bol_number",
                            "total_amount",
                            "requested_product_name",
                            "requested_protein",
                            "requested_quantity",
                        ],
                        "additionalProperties": False,
                    },
                },
                "required": [
                    "category",
                    "confidence",
                    "summary",
                    "rationale",
                    "actionable",
                    "contact_name",
                    "contact_company",
                    "requested_product_name",
                    "requested_protein",
                    "requested_quantity",
                    "requested_uom",
                    "po_number",
                    "bol_number",
                    "total_amount",
                    "attachment_document_types",
                    "field_confidence",
                ],
                "additionalProperties": False,
            },
        },
    }
    completion = client.chat.completions.create(
        model=get_active_openai_model_id(fallback="gpt-4o-mini"),
        temperature=0,
        response_format=response_schema,
        messages=[
            {
                "role": "system",
                "content": "You classify operational inbox mail for a meat logistics business.",
            },
            {"role": "user", "content": prompt},
        ],
    )
    message = completion.choices[0].message if completion.choices else None
    content = str(getattr(message, "content", "") or "").strip()
    if not content:
        raise RuntimeError("The email classification service returned an empty response.")

    parsed = json.loads(content)
    if not isinstance(parsed, dict):
        raise RuntimeError("The email classification service returned an invalid response shape.")

    category = str(parsed.get("category") or "Spam/Other").strip()
    if category not in SUPPORTED_EMAIL_CATEGORIES:
        category = "Spam/Other"

    try:
        confidence = float(parsed.get("confidence") or 0.0)
    except (TypeError, ValueError):
        confidence = 0.0

    summary = str(parsed.get("summary") or "").strip()
    rationale = str(parsed.get("rationale") or "").strip()

    # Extract fields before actionable check (needed for fallback)
    contact_name = str(parsed.get("contact_name") or "").strip()
    contact_company = str(parsed.get("contact_company") or "").strip()
    total_amount = str(parsed.get("total_amount") or "").strip()
    po_number = str(parsed.get("po_number") or "").strip()

    # Fallback: if classified as Spam/Other but contains business signals,
    # reclassify to the most appropriate actionable category
    if category == "Spam/Other":
        if total_amount and (po_number or parsed.get("invoice_number")):
            category = "Payment Notice"
            rationale = f"[Auto-reclassified from Spam/Other] {rationale}"
        elif contact_name and contact_company:
            category = "Contact Update"
            rationale = f"[Auto-reclassified from Spam/Other] {rationale}"
        elif contact_company and not contact_name:
            category = "Company Update"
            rationale = f"[Auto-reclassified from Spam/Other] {rationale}"
        elif contact_name:
            category = "Contact Update"
            rationale = f"[Auto-reclassified from Spam/Other] {rationale}"

    actionable = category in ACTIONABLE_EMAIL_CATEGORIES
    requested_protein = str(parsed.get("requested_protein") or "").strip()
    if requested_protein not in SUPPORTED_PROTEIN_VALUES:
        requested_protein = ""

    return {
        "category": category,
        "draft_type": ACTIONABLE_EMAIL_CATEGORIES.get(category, ""),
        "confidence": max(0.0, min(confidence, 1.0)),
        "summary": summary,
        "rationale": rationale,
        "actionable": actionable,
        "inquiry_candidate": actionable and category in INQUIRY_EMAIL_CATEGORIES,
        "contact_name": contact_name,
        "contact_company": contact_company,
        "requested_product_name": str(parsed.get("requested_product_name") or "").strip(),
        "requested_protein": requested_protein,
        "requested_quantity": str(parsed.get("requested_quantity") or "").strip(),
        "requested_uom": str(parsed.get("requested_uom") or "").strip(),
        "po_number": po_number,
        "bol_number": str(parsed.get("bol_number") or "").strip(),
        "total_amount": total_amount,
        "attachment_document_types": parsed.get("attachment_document_types") or [],
    }


def _manual_review_fallback(
    *, subject: str, sender_email: str, sender_name: str
) -> dict[str, Any]:
    """Return a safe classification when AI is unavailable.

    Marks the email as non-actionable with zero confidence so operators
    see it in the review queue without the pipeline crashing.
    """
    return {
        "category": "Spam/Other",
        "draft_type": "",
        "confidence": 0.0,
        "summary": "AI classification unavailable — manual review required.",
        "rationale": "OpenAI API key is not configured; email queued for manual triage.",
        "actionable": False,
        "inquiry_candidate": False,
        "contact_name": sender_name or "",
        "contact_company": "",
        "requested_product_name": "",
        "requested_protein": "",
        "requested_quantity": "",
        "requested_uom": "",
        "po_number": "",
        "bol_number": "",
        "total_amount": "",
        "attachment_document_types": [],
        "_ai_unavailable": True,
    }
