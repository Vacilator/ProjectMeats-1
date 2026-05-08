"""Carrier reply parser — correlates inbound carrier emails to freight inquiries
and generates draft CarrierPurchaseOrder rows (CTE-04.4).

Pattern follows supplier_quote_reply_parser.py.
"""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status as http_status

from tenant_apps.carriers.models import CarrierFreightInquiry, CarrierFreightInquiryStatus
from tenant_apps.purchase_orders.models import CarrierPurchaseOrder, CarrierPurchaseOrderStatus

from apps.integrations.models import EmailLog
from apps.system.services.ai_model_resolver import get_active_openai_model_id
from apps.tenants.rls import tenant_rls

logger = logging.getLogger(__name__)

CARRIER_REPLY_CATEGORY = "carrier_freight_reply"
INQUIRY_REFERENCE_PATTERN = re.compile(
    r"(?:Freight Quote Request|Ref)[:\s\-]*(SO[- ]?\S+)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class CarrierReplyParseResult:
    success: bool
    carrier_po_id: int | None = None
    parse_status: str = ""
    confidence: float = 0.0
    error_message: str = ""
    error_code: str = ""
    http_status: int = http_status.HTTP_200_OK
    normalized_quote: dict = field(default_factory=dict)
    lineage: dict = field(default_factory=dict)


def parse_carrier_reply(*, email_log: EmailLog) -> CarrierReplyParseResult:
    """Parse an inbound carrier email, correlate to a freight inquiry, extract
    structured quote data, and create a draft CarrierPurchaseOrder if positive.

    Args:
        email_log: The ingested email record.

    Returns:
        CarrierReplyParseResult with parse status and optional draft CPO ID.
    """
    if not email_log or not email_log.tenant_id:
        return CarrierReplyParseResult(
            success=False,
            error_message="Email log with tenant context is required.",
            error_code="missing_context",
            http_status=http_status.HTTP_400_BAD_REQUEST,
        )

    sender_email = str(email_log.sender_email or "").strip().lower()
    thread_id = str(email_log.thread_id or "").strip()

    with tenant_rls(str(email_log.tenant_id), strict=True):
        # Step 1: Correlate to a CarrierFreightInquiry
        correlation = _correlate_inquiry(
            tenant_id=email_log.tenant_id,
            sender_email=sender_email,
            thread_id=thread_id,
            subject=email_log.subject or "",
            body=email_log.body_text or "",
        )

        if not correlation["matched"]:
            return CarrierReplyParseResult(
                success=False,
                parse_status="unmatched",
                error_message=correlation.get("reason", "No matching freight inquiry found."),
                error_code="no_match",
                http_status=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                lineage=correlation.get("lineage", {}),
            )

        inquiry: CarrierFreightInquiry = correlation["inquiry"]

        # Step 2: Parse with OpenAI
        try:
            parsed_quote = _extract_freight_quote(email_log=email_log, inquiry=inquiry)
        except Exception as exc:
            logger.warning(
                "Carrier reply parse failed",
                extra={"email_log_id": email_log.id, "error": str(exc)},
            )
            _update_inquiry_status(inquiry, "error", error=str(exc))
            return CarrierReplyParseResult(
                success=False,
                parse_status="error",
                error_message=f"Quote extraction failed: {str(exc)}",
                error_code="parse_error",
                http_status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                lineage=_build_lineage(email_log, inquiry),
            )

        # Step 3: Create draft CarrierPurchaseOrder if affirmative
        carrier_po_id = None
        if parsed_quote["availability_status"] in ("affirmative", "partial"):
            carrier_po_id = _create_draft_carrier_po(
                inquiry=inquiry,
                parsed_quote=parsed_quote,
                email_log=email_log,
            )
            _update_inquiry_status(inquiry, "accepted")
        elif parsed_quote["availability_status"] == "negative":
            _update_inquiry_status(inquiry, "declined")
        else:
            _update_inquiry_status(inquiry, "replied")

        logger.info(
            "Telemetry: carrier_reply.parsed",
            extra={
                "event_type": "carrier_reply.parsed",
                "tenant_id": str(email_log.tenant_id),
                "inquiry_id": inquiry.id,
                "carrier_id": inquiry.carrier_id,
                "availability": parsed_quote["availability_status"],
                "confidence": parsed_quote["confidence"],
                "carrier_po_created": carrier_po_id is not None,
                "timestamp": timezone.now().isoformat(),
            },
        )

        return CarrierReplyParseResult(
            success=True,
            carrier_po_id=carrier_po_id,
            parse_status="parsed",
            confidence=parsed_quote["confidence"],
            normalized_quote=parsed_quote,
            lineage=_build_lineage(email_log, inquiry),
        )


# ---------------------------------------------------------------------------
# Correlation
# ---------------------------------------------------------------------------


def _correlate_inquiry(
    *,
    tenant_id,
    sender_email: str,
    thread_id: str,
    subject: str,
    body: str,
) -> dict[str, Any]:
    """Find the CarrierFreightInquiry that this reply belongs to."""

    base_qs = CarrierFreightInquiry.objects.select_related("carrier", "sales_order").filter(
        tenant_id=tenant_id,
        status=CarrierFreightInquiryStatus.SENT,
    )

    # Method 1: Thread ID match
    if thread_id:
        thread_matches = list(base_qs.filter(provider_thread_id=thread_id).order_by("-sent_at")[:5])
        if len(thread_matches) == 1:
            return {"matched": True, "inquiry": thread_matches[0], "method": "thread_id"}
        if thread_matches:
            # Filter by sender email to disambiguate
            sender_filtered = [i for i in thread_matches if i.recipient_email.lower() == sender_email]
            if len(sender_filtered) == 1:
                return {"matched": True, "inquiry": sender_filtered[0], "method": "thread_id+sender"}

    # Method 2: Sender email + SO reference in subject/body
    so_refs = _extract_so_references(subject, body)
    if so_refs and sender_email:
        ref_matches = list(
            base_qs.filter(
                recipient_email__iexact=sender_email,
                sales_order__our_sales_order_num__in=so_refs,
            ).order_by("-sent_at")[:5]
        )
        if len(ref_matches) == 1:
            return {"matched": True, "inquiry": ref_matches[0], "method": "so_reference+sender"}
        if ref_matches:
            return {"matched": True, "inquiry": ref_matches[0], "method": "so_reference+sender(first)"}

    # Method 3: Sender email only (most recent sent inquiry to this carrier)
    if sender_email:
        sender_matches = list(base_qs.filter(recipient_email__iexact=sender_email).order_by("-sent_at")[:1])
        if sender_matches:
            return {"matched": True, "inquiry": sender_matches[0], "method": "sender_email(recent)"}

    return {
        "matched": False,
        "reason": f"No sent freight inquiry matches sender={sender_email}, thread={thread_id}.",
        "lineage": {"sender_email": sender_email, "thread_id": thread_id},
    }


def _extract_so_references(subject: str, body: str) -> list[str]:
    """Extract SO number references from email text."""
    refs = []
    for text in [subject, body[:3000]]:
        for match in INQUIRY_REFERENCE_PATTERN.findall(str(text or "")):
            cleaned = match.strip().rstrip(".,;:")
            if cleaned and cleaned not in refs:
                refs.append(cleaned)
    return refs


# ---------------------------------------------------------------------------
# OpenAI extraction
# ---------------------------------------------------------------------------


def _extract_freight_quote(*, email_log: EmailLog, inquiry: CarrierFreightInquiry) -> dict[str, Any]:
    """Use OpenAI structured outputs to normalize a carrier freight reply."""
    openai_api_key = getattr(settings, "OPENAI_API_KEY", None) or os.environ.get("OPENAI_API_KEY")
    if not openai_api_key:
        raise RuntimeError("OpenAI is not configured on the server.")

    from openai import OpenAI

    prompt = (
        "Normalize this carrier freight quote reply into strict JSON.\n"
        "Rules:\n"
        "1. Output JSON only.\n"
        "2. Use only facts clearly stated by the carrier.\n"
        "3. availability_status=affirmative when carrier accepts/quotes, "
        "negative when they decline, partial when partially available, unclear otherwise.\n"
        "4. If rate, transit time, or capacity are not stated, use null.\n"
        "5. Keep summary under 180 characters.\n\n"
        f"Original inquiry subject: {inquiry.subject}\n"
        f"Lane: {inquiry.origin_city}, {inquiry.origin_state} → "
        f"{inquiry.destination_city}, {inquiry.destination_state}\n"
        f"Carrier: {inquiry.carrier.name if inquiry.carrier_id else ''}\n"
        f"Inbound subject: {email_log.subject}\n"
        f"Inbound sender: {email_log.sender_email}\n"
        f"Inbound body:\n{str(email_log.body_text or '')[:6000]}"
    )

    response_schema = {
        "type": "json_schema",
        "json_schema": {
            "name": "carrier_freight_reply",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "summary": {"type": "string"},
                    "rationale": {"type": "string"},
                    "confidence": {"type": "number"},
                    "availability_status": {
                        "type": "string",
                        "enum": ["affirmative", "negative", "partial", "unclear"],
                    },
                    "rate_per_mile": {"anyOf": [{"type": "number"}, {"type": "null"}]},
                    "flat_rate": {"anyOf": [{"type": "number"}, {"type": "null"}]},
                    "currency": {"type": "string"},
                    "transit_days_min": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
                    "transit_days_max": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
                    "available_date": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                    "truck_type": {"type": "string"},
                    "capacity_lbs": {"anyOf": [{"type": "number"}, {"type": "null"}]},
                    "notes": {"type": "string"},
                },
                "required": [
                    "summary",
                    "rationale",
                    "confidence",
                    "availability_status",
                    "rate_per_mile",
                    "flat_rate",
                    "currency",
                    "transit_days_min",
                    "transit_days_max",
                    "available_date",
                    "truck_type",
                    "capacity_lbs",
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
            {"role": "system", "content": "You extract carrier freight quote replies into strict JSON."},
            {"role": "user", "content": prompt},
        ],
    )
    message = completion.choices[0].message if completion.choices else None
    content = str(getattr(message, "content", "") or "").strip()
    if not content:
        raise RuntimeError("The carrier quote parser returned an empty response.")

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise RuntimeError("The carrier quote parser returned invalid JSON.") from exc

    if not isinstance(parsed, dict):
        raise RuntimeError("The carrier quote parser returned an invalid response shape.")

    return {
        "summary": str(parsed.get("summary") or "").strip(),
        "rationale": str(parsed.get("rationale") or "").strip(),
        "confidence": max(0.0, min(float(parsed.get("confidence") or 0.0), 1.0)),
        "availability_status": str(parsed.get("availability_status") or "unclear").strip(),
        "rate_per_mile": parsed.get("rate_per_mile"),
        "flat_rate": parsed.get("flat_rate"),
        "currency": str(parsed.get("currency") or "USD").strip(),
        "transit_days_min": parsed.get("transit_days_min"),
        "transit_days_max": parsed.get("transit_days_max"),
        "available_date": str(parsed.get("available_date") or "").strip() or None,
        "truck_type": str(parsed.get("truck_type") or "").strip(),
        "capacity_lbs": parsed.get("capacity_lbs"),
        "notes": str(parsed.get("notes") or "").strip(),
    }


# ---------------------------------------------------------------------------
# Draft Carrier PO creation
# ---------------------------------------------------------------------------


def _create_draft_carrier_po(
    *,
    inquiry: CarrierFreightInquiry,
    parsed_quote: dict[str, Any],
    email_log: EmailLog,
) -> int:
    """Create a draft CarrierPurchaseOrder from a positive carrier reply."""
    with transaction.atomic():
        # Deduplication: check if we already created a CPO for this inquiry
        existing = CarrierPurchaseOrder.objects.filter(
            tenant_id=inquiry.tenant_id,
            carrier_id=inquiry.carrier_id,
            sales_order_id=inquiry.sales_order_id,
            custom_data__source_freight_inquiry_id=inquiry.id,
        ).first()
        if existing:
            return existing.id

        so = inquiry.sales_order
        carrier_po = CarrierPurchaseOrder.objects.create(
            tenant_id=inquiry.tenant_id,
            carrier_id=inquiry.carrier_id,
            supplier_id=so.supplier_id,
            sales_order=so,
            linked_order_id=getattr(so, "custom_data", {}).get("source_purchase_order_id"),
            status=CarrierPurchaseOrderStatus.DRAFT,
            carrier_name=inquiry.carrier.name if inquiry.carrier_id else "",
            total_weight=inquiry.weight,
            weight_unit=inquiry.weight_unit or "lbs",
            custom_data={
                "source_freight_inquiry_id": inquiry.id,
                "source_email_log_id": email_log.id,
                "carrier_reply_parse": {
                    "availability_status": parsed_quote["availability_status"],
                    "rate_per_mile": parsed_quote.get("rate_per_mile"),
                    "flat_rate": parsed_quote.get("flat_rate"),
                    "currency": parsed_quote.get("currency", "USD"),
                    "transit_days_min": parsed_quote.get("transit_days_min"),
                    "transit_days_max": parsed_quote.get("transit_days_max"),
                    "truck_type": parsed_quote.get("truck_type", ""),
                    "capacity_lbs": parsed_quote.get("capacity_lbs"),
                    "notes": parsed_quote.get("notes", ""),
                    "confidence": parsed_quote.get("confidence", 0.0),
                },
                "lineage": {
                    "sales_order_id": so.id,
                    "sales_order_num": so.our_sales_order_num,
                    "carrier_id": inquiry.carrier_id,
                    "freight_inquiry_id": inquiry.id,
                    "email_log_id": email_log.id,
                },
            },
        )
        return carrier_po.id


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _update_inquiry_status(inquiry: CarrierFreightInquiry, new_status: str, error: str = ""):
    """Update the inquiry status based on carrier reply outcome."""
    status_map = {
        "accepted": CarrierFreightInquiryStatus.ACCEPTED,
        "declined": CarrierFreightInquiryStatus.DECLINED,
        "replied": CarrierFreightInquiryStatus.REPLIED,
        "error": CarrierFreightInquiryStatus.FAILED,
    }
    inquiry.status = status_map.get(new_status, CarrierFreightInquiryStatus.REPLIED)
    if error:
        inquiry.error_message = error
    inquiry.save(update_fields=["status", "error_message", "modified_on"])


def _build_lineage(email_log: EmailLog, inquiry: CarrierFreightInquiry) -> dict:
    return {
        "email_log_id": email_log.id,
        "email_message_id": str(email_log.message_id or "").strip(),
        "email_thread_id": str(email_log.thread_id or "").strip(),
        "freight_inquiry_id": inquiry.id,
        "carrier_id": inquiry.carrier_id,
        "sales_order_id": inquiry.sales_order_id,
    }
