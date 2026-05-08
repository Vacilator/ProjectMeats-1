"""Normalize inbound supplier RFQ replies into strict quote payloads."""

from __future__ import annotations

import json
import os
import re
from typing import Any
from uuid import UUID

from django.conf import settings
from django.utils import timezone

from tenant_apps.inquiries.models import InquirySupplierRFQ, InquirySupplierRFQStatusChoices

from apps.integrations.models import EmailLog
from apps.system.services.ai_model_resolver import get_active_openai_model_id
from apps.tenants.rls import tenant_rls

SUPPLIER_QUOTE_REPLY_CATEGORY = "supplier_quote_reply"
RFQ_REFERENCE_PATTERN = re.compile(
    r"RFQ reference:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
    re.IGNORECASE,
)


def parse_supplier_quote_reply(*, email_log: EmailLog) -> dict[str, Any] | None:
    """Return a structured supplier-reply payload when inbound mail maps to an RFQ."""

    sender_email = str(email_log.sender_email or "").strip().lower()
    thread_id = str(email_log.thread_id or "").strip()
    references = _extract_rfq_references(email_log.subject, email_log.body_text)
    with tenant_rls(str(email_log.tenant_id), strict=True):
        correlation = _correlate_rfq(
            tenant_id=email_log.tenant_id,
            sender_email=sender_email,
            thread_id=thread_id,
            references=references,
        )
        if not correlation["handled"]:
            return None

        rfq = correlation.get("rfq")
        if rfq is None:
            return _build_email_payload(
                email_log=email_log,
                summary=correlation["summary"],
                rationale=correlation["rationale"],
                parse_status=correlation["parse_status"],
                correlation_status=correlation["correlation_status"],
                correlation_method=correlation["correlation_method"],
                confidence=0.0,
                normalized_quote=_empty_normalized_quote(),
                errors=list(correlation["errors"]),
                rfq=None,
                candidate_rfqs=correlation["candidate_rfqs"],
            )

        try:
            parsed_quote = _extract_supplier_quote_payload(email_log=email_log, rfq=rfq)
            payload = _build_email_payload(
                email_log=email_log,
                summary=str(parsed_quote["summary"]),
                rationale=str(parsed_quote["rationale"]),
                parse_status="parsed",
                correlation_status="matched",
                correlation_method=correlation["correlation_method"],
                confidence=float(parsed_quote["confidence"]),
                normalized_quote=dict(parsed_quote["normalized_quote"]),
                errors=[],
                rfq=rfq,
                candidate_rfqs=correlation["candidate_rfqs"],
            )
        except Exception as exc:
            payload = _build_email_payload(
                email_log=email_log,
                summary="Correlated supplier reply to an RFQ, but structured quote extraction failed.",
                rationale="The reply lineage matched a sent supplier RFQ, but the normalized quote parser returned an error.",
                parse_status="error",
                correlation_status="matched",
                correlation_method=correlation["correlation_method"],
                confidence=0.0,
                normalized_quote=_empty_normalized_quote(),
                errors=[str(exc)],
                rfq=rfq,
                candidate_rfqs=correlation["candidate_rfqs"],
            )

        _persist_latest_reply_parse(rfq=rfq, payload=payload["supplier_reply_parse"])
        return payload


def _extract_rfq_references(*values: str) -> tuple[UUID, ...]:
    references: list[UUID] = []
    for value in values:
        for match in RFQ_REFERENCE_PATTERN.findall(str(value or "")):
            try:
                parsed = UUID(match)
            except (TypeError, ValueError):
                continue
            if parsed not in references:
                references.append(parsed)
    return tuple(references)


def _correlate_rfq(
    *,
    tenant_id: Any,
    sender_email: str,
    thread_id: str,
    references: tuple[UUID, ...],
) -> dict[str, Any]:
    base_qs = InquirySupplierRFQ.objects.select_related("inquiry", "supplier").filter(
        tenant_id=tenant_id,
        status=InquirySupplierRFQStatusChoices.SENT,
        recipient_email__iexact=sender_email,
    )
    reference_matches = _dedupe_rfqs(base_qs.filter(correlation_key__in=references)) if references else {}
    thread_matches = _dedupe_rfqs(base_qs.filter(provider_thread_id=thread_id)) if thread_id else {}

    candidate_rfqs = _sorted_rfqs({**reference_matches, **thread_matches}.values())
    if not references and not thread_matches:
        return {
            "handled": False,
            "candidate_rfqs": (),
        }

    if reference_matches and thread_matches:
        shared_ids = set(reference_matches).intersection(thread_matches)
        if len(shared_ids) == 1:
            rfq = reference_matches[next(iter(shared_ids))]
            return {
                "handled": True,
                "rfq": rfq,
                "candidate_rfqs": _serialize_candidates(candidate_rfqs),
                "parse_status": "parsed",
                "correlation_status": "matched",
                "correlation_method": "thread_id+rfq_reference",
            }
        if shared_ids:
            return _ambiguous_correlation(candidate_rfqs, method="thread_id+rfq_reference")
        return _ambiguous_correlation(candidate_rfqs, method="thread_id+rfq_reference")

    if len(reference_matches) == 1:
        return {
            "handled": True,
            "rfq": next(iter(reference_matches.values())),
            "candidate_rfqs": _serialize_candidates(candidate_rfqs),
            "parse_status": "parsed",
            "correlation_status": "matched",
            "correlation_method": "rfq_reference",
        }
    if len(reference_matches) > 1:
        return _ambiguous_correlation(candidate_rfqs, method="rfq_reference")
    if references:
        return {
            "handled": True,
            "candidate_rfqs": (),
            "parse_status": "unmatched",
            "correlation_status": "unmatched",
            "correlation_method": "rfq_reference",
            "summary": "Inbound email referenced an RFQ key, but no sent RFQ matched this tenant and supplier.",
            "rationale": "The email contained an RFQ reference, but no tenant-safe outbound RFQ row matched the sender.",
            "errors": ["No sent RFQ matched the explicit RFQ reference for this tenant and supplier."],
        }

    if len(thread_matches) == 1:
        return {
            "handled": True,
            "rfq": next(iter(thread_matches.values())),
            "candidate_rfqs": _serialize_candidates(candidate_rfqs),
            "parse_status": "parsed",
            "correlation_status": "matched",
            "correlation_method": "thread_id",
        }
    if len(thread_matches) > 1:
        return _ambiguous_correlation(candidate_rfqs, method="thread_id")

    return {
        "handled": False,
        "candidate_rfqs": (),
    }


def _ambiguous_correlation(candidate_rfqs: list[InquirySupplierRFQ], *, method: str) -> dict[str, Any]:
    return {
        "handled": True,
        "candidate_rfqs": _serialize_candidates(candidate_rfqs),
        "parse_status": "ambiguous",
        "correlation_status": "ambiguous",
        "correlation_method": method,
        "summary": "Inbound supplier reply matched multiple RFQs and requires manual review.",
        "rationale": "The reply correlation produced more than one tenant-safe RFQ candidate, so the parser failed closed.",
        "errors": ["Multiple sent RFQs matched this reply; no quote was normalized automatically."],
    }


def _dedupe_rfqs(queryset) -> dict[int, InquirySupplierRFQ]:
    return {rfq.id: rfq for rfq in queryset.order_by("-created_on", "-id")}


def _sorted_rfqs(rfqs) -> list[InquirySupplierRFQ]:
    return sorted(
        rfqs,
        key=lambda rfq: (rfq.created_on, rfq.id),
        reverse=True,
    )


def _serialize_candidates(rfqs: list[InquirySupplierRFQ]) -> tuple[dict[str, Any], ...]:
    return tuple(
        {
            "rfq_id": rfq.id,
            "inquiry_id": rfq.inquiry_id,
            "supplier_id": rfq.supplier_id,
            "correlation_key": str(rfq.correlation_key),
        }
        for rfq in rfqs
    )


def _build_email_payload(
    *,
    email_log: EmailLog,
    summary: str,
    rationale: str,
    parse_status: str,
    correlation_status: str,
    correlation_method: str,
    confidence: float,
    normalized_quote: dict[str, Any],
    errors: list[str],
    rfq: InquirySupplierRFQ | None,
    candidate_rfqs: tuple[dict[str, Any], ...],
) -> dict[str, Any]:
    supplier_reply_parse = {
        "parse_status": parse_status,
        "correlation_status": correlation_status,
        "correlation_method": correlation_method,
        "confidence": max(0.0, min(float(confidence or 0.0), 1.0)),
        "errors": [str(error).strip() for error in errors if str(error).strip()],
        "normalized_quote": normalized_quote,
        "lineage": {
            "email_log_id": email_log.id,
            "email_message_id": str(email_log.message_id or "").strip(),
            "email_thread_id": str(email_log.thread_id or "").strip(),
            "rfq_id": rfq.id if rfq else None,
            "inquiry_id": rfq.inquiry_id if rfq else None,
            "supplier_id": rfq.supplier_id if rfq else None,
            "correlation_key": str(rfq.correlation_key) if rfq else "",
            "candidate_rfqs": list(candidate_rfqs),
        },
    }
    if rfq is not None:
        supplier_reply_parse["rfq_snapshot"] = {
            "subject": rfq.subject,
            "recipient_email": rfq.recipient_email,
            "supplier_name": getattr(rfq.supplier, "name", ""),
            "inquiry_number": getattr(rfq.inquiry, "inquiry_number", ""),
        }

    return {
        "category": SUPPLIER_QUOTE_REPLY_CATEGORY,
        "draft_type": "",
        "actionable": False,
        "inquiry_candidate": False,
        "confidence": supplier_reply_parse["confidence"],
        "summary": str(summary or "").strip(),
        "rationale": str(rationale or "").strip(),
        "supplier_reply_parse": supplier_reply_parse,
    }


def _empty_normalized_quote() -> dict[str, Any]:
    return {
        "availability_status": "unclear",
        "offered_product_name": "",
        "price_per_unit": None,
        "currency": "",
        "quantity": None,
        "uom": "",
        "lead_time_text": "",
        "lead_time_days_min": None,
        "lead_time_days_max": None,
        "notes": "",
    }


def _extract_supplier_quote_payload(*, email_log: EmailLog, rfq: InquirySupplierRFQ) -> dict[str, Any]:
    openai_api_key = getattr(settings, "OPENAI_API_KEY", None) or os.environ.get("OPENAI_API_KEY")
    if not openai_api_key:
        raise RuntimeError("OpenAI is not configured on the server.")

    from openai import OpenAI

    requested_product = ""
    inquiry = getattr(rfq, "inquiry", None)
    if inquiry is not None and getattr(inquiry, "requested_master_product_id", None):
        requested_product = str(getattr(inquiry.requested_master_product, "item_name", "") or "").strip()

    prompt = (
        "Normalize this supplier RFQ reply into strict JSON.\n"
        "Rules:\n"
        "1. Output JSON only.\n"
        "2. Use only facts clearly stated by the supplier.\n"
        "3. Ignore quoted earlier thread text unless the supplier explicitly confirms it in the reply.\n"
        "4. If price, quantity, or lead time are not clearly stated, return null for numeric values and empty strings for text.\n"
        "5. Use availability_status=affirmative when the supplier can supply, negative when they decline, partial when partially available, and unclear otherwise.\n"
        "6. Keep summary under 180 characters.\n\n"
        f"Original RFQ subject: {rfq.subject}\n"
        f"Requested product: {requested_product}\n"
        f"Inquiry number: {getattr(inquiry, 'inquiry_number', '')}\n"
        f"Inbound subject: {email_log.subject}\n"
        f"Inbound sender: {email_log.sender_email}\n"
        f"Inbound body:\n{str(email_log.body_text or '')[:6000]}"
    )
    response_schema = {
        "type": "json_schema",
        "json_schema": {
            "name": "supplier_quote_reply",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "summary": {"type": "string"},
                    "rationale": {"type": "string"},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    "availability_status": {
                        "type": "string",
                        "enum": ["affirmative", "negative", "partial", "unclear"],
                    },
                    "offered_product_name": {"type": "string"},
                    "price_per_unit": {"anyOf": [{"type": "number"}, {"type": "null"}]},
                    "currency": {"type": "string"},
                    "quantity": {"anyOf": [{"type": "number"}, {"type": "null"}]},
                    "uom": {"type": "string"},
                    "lead_time_text": {"type": "string"},
                    "lead_time_days_min": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
                    "lead_time_days_max": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
                    "notes": {"type": "string"},
                },
                "required": [
                    "summary",
                    "rationale",
                    "confidence",
                    "availability_status",
                    "offered_product_name",
                    "price_per_unit",
                    "currency",
                    "quantity",
                    "uom",
                    "lead_time_text",
                    "lead_time_days_min",
                    "lead_time_days_max",
                    "notes",
                ],
                "additionalProperties": False,
            },
        },
    }

    client = OpenAI(
        api_key=openai_api_key,
        organization=getattr(settings, "OPENAI_ORG_ID", None) or os.environ.get("OPENAI_ORG_ID") or None,
    )
    completion = client.chat.completions.create(
        model=get_active_openai_model_id(fallback="gpt-4o-mini"),
        temperature=0,
        response_format=response_schema,
        messages=[
            {
                "role": "system",
                "content": "You extract supplier quote replies into strict, fail-closed JSON.",
            },
            {"role": "user", "content": prompt},
        ],
    )
    message = completion.choices[0].message if completion.choices else None
    content = str(getattr(message, "content", "") or "").strip()
    if not content:
        raise RuntimeError("The supplier quote parser returned an empty response.")

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise RuntimeError("The supplier quote parser returned invalid JSON.") from exc

    if not isinstance(parsed, dict):
        raise RuntimeError("The supplier quote parser returned an invalid response shape.")

    return {
        "summary": str(parsed.get("summary") or "").strip(),
        "rationale": str(parsed.get("rationale") or "").strip(),
        "confidence": max(0.0, min(float(parsed.get("confidence") or 0.0), 1.0)),
        "normalized_quote": {
            "availability_status": str(parsed.get("availability_status") or "unclear").strip() or "unclear",
            "offered_product_name": str(parsed.get("offered_product_name") or "").strip(),
            "price_per_unit": parsed.get("price_per_unit"),
            "currency": str(parsed.get("currency") or "").strip(),
            "quantity": parsed.get("quantity"),
            "uom": str(parsed.get("uom") or "").strip(),
            "lead_time_text": str(parsed.get("lead_time_text") or "").strip(),
            "lead_time_days_min": parsed.get("lead_time_days_min"),
            "lead_time_days_max": parsed.get("lead_time_days_max"),
            "notes": str(parsed.get("notes") or "").strip(),
        },
    }


def _persist_latest_reply_parse(*, rfq: InquirySupplierRFQ, payload: dict[str, Any]) -> None:
    custom_data = dict(rfq.custom_data or {})
    custom_data["latest_reply_parse"] = payload
    rfq.custom_data = custom_data
    rfq.modified_on = timezone.now()
    rfq.save(update_fields=["custom_data", "modified_on"])
