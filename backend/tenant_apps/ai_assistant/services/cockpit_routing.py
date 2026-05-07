"""Cockpit Routing Service — RT-02.4: Route inbox items to Process Cockpit.

Provides:
- create_draft_from_feedback(): Create a CockpitDraftForm from an AIFeedbackLog row
- create_draft_from_parsed_email(): Create a draft from ParsedTradeEmail result
- update_draft_status(): Transition draft through its lifecycle
- infer_form_type(): Determine which form type to use based on parsed data

Additive only — no existing services modified.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from django.utils import timezone

logger = logging.getLogger(__name__)

# Form type constants
FORM_TYPE_PURCHASE_ORDER = "purchase_order"
FORM_TYPE_INQUIRY = "inquiry"
FORM_TYPE_SALES_ORDER = "sales_order"
FORM_TYPE_BID = "bid"
FORM_TYPE_UNKNOWN = "unknown"


def infer_form_type(parsed_data: dict[str, Any]) -> str:
    """Infer which form type to route to based on parsed email content.

    Priority:
    1. Has PO numbers → purchase_order
    2. Has line items with prices → bid
    3. Has line items without prices → inquiry
    4. Fallback → unknown
    """
    po_numbers = parsed_data.get("po_numbers", [])
    if po_numbers:
        return FORM_TYPE_PURCHASE_ORDER

    line_items = parsed_data.get("line_items", [])
    if line_items:
        has_prices = any(
            item.get("unit_price") or item.get("price")
            for item in line_items
            if isinstance(item, dict)
        )
        if has_prices:
            return FORM_TYPE_BID
        return FORM_TYPE_INQUIRY

    return FORM_TYPE_UNKNOWN


def build_form_data(parsed_data: dict[str, Any], form_type: str) -> dict[str, Any]:
    """Transform parsed email data into pre-populated form fields.

    Maps parsed fields to the target form's expected field names.
    """
    form_data: dict[str, Any] = {}

    # Common fields
    if parsed_data.get("sender_company"):
        form_data["supplier_name"] = parsed_data["sender_company"]
    if parsed_data.get("sender_email"):
        form_data["contact_email"] = parsed_data["sender_email"]
    if parsed_data.get("sender_name"):
        form_data["contact_name"] = parsed_data["sender_name"]

    # PO-specific
    if form_type == FORM_TYPE_PURCHASE_ORDER:
        po_numbers = parsed_data.get("po_numbers", [])
        if po_numbers:
            form_data["po_number"] = po_numbers[0]
            if len(po_numbers) > 1:
                form_data["additional_po_numbers"] = po_numbers[1:]

    # Line items
    line_items = parsed_data.get("line_items", [])
    if line_items:
        form_data["line_items"] = []
        for item in line_items:
            if isinstance(item, dict):
                form_data["line_items"].append({
                    "product": item.get("product_description", ""),
                    "quantity": item.get("quantity", ""),
                    "uom": item.get("unit_of_measure", ""),
                    "unit_price": item.get("unit_price", ""),
                })

    # Dates
    if parsed_data.get("delivery_date"):
        form_data["delivery_date"] = parsed_data["delivery_date"]
    if parsed_data.get("ship_date"):
        form_data["ship_date"] = parsed_data["ship_date"]

    return form_data


def create_draft_from_feedback(
    *,
    tenant,
    feedback_row,
    user=None,
) -> Any:
    """Create a CockpitDraftForm from an AIFeedbackLog row.

    Uses the feedback's original_extracted_data to pre-populate the form.

    Returns:
        CockpitDraftForm instance.
    """
    from tenant_apps.ai_assistant.models import CockpitDraftForm, CockpitDraftStatus

    parsed_data = feedback_row.original_extracted_data or {}
    form_type = infer_form_type(parsed_data)
    form_data = build_form_data(parsed_data, form_type)

    draft = CockpitDraftForm.objects.create(
        tenant=tenant,
        source_feedback_id=feedback_row.pk,
        source_document_id=feedback_row.document_id,
        form_type=form_type,
        form_data=form_data,
        parsed_payload=parsed_data,
        status=CockpitDraftStatus.PENDING,
        assigned_to=user,
    )

    logger.info(
        "Draft created: %s (type=%s) from feedback %s",
        draft.pk,
        form_type,
        feedback_row.pk,
    )
    return draft


def create_draft_from_parsed_email(
    *,
    tenant,
    parsed_result,
    document_id=None,
    user=None,
) -> Any:
    """Create a CockpitDraftForm directly from a ParsedTradeEmail result.

    Used when routing directly from AI inbox sync (skip feedback step).

    Args:
        tenant: Tenant instance.
        parsed_result: ParsedTradeEmail dataclass from email_parser.
        document_id: Optional source document UUID.
        user: Optional user to assign.

    Returns:
        CockpitDraftForm instance.
    """
    from tenant_apps.ai_assistant.models import CockpitDraftForm, CockpitDraftStatus

    parsed_data = parsed_result.to_dict() if hasattr(parsed_result, "to_dict") else parsed_result
    form_type = infer_form_type(parsed_data)
    form_data = build_form_data(parsed_data, form_type)

    draft = CockpitDraftForm.objects.create(
        tenant=tenant,
        source_document_id=document_id,
        form_type=form_type,
        form_data=form_data,
        parsed_payload=parsed_data,
        status=CockpitDraftStatus.PENDING,
        assigned_to=user,
    )

    logger.info(
        "Draft created from parsed email: %s (type=%s)",
        draft.pk,
        form_type,
    )
    return draft


def update_draft_status(
    *,
    draft,
    new_status: str,
    user=None,
    submitted_entity_type: str = "",
    submitted_entity_id: str = "",
) -> Any:
    """Transition a draft through its lifecycle.

    Valid transitions:
    - pending → in_progress, discarded
    - in_progress → submitted, discarded
    - submitted/discarded → (terminal, no further transitions)

    Returns:
        Updated CockpitDraftForm instance.
    """
    from tenant_apps.ai_assistant.models import CockpitDraftStatus

    terminal_states = {CockpitDraftStatus.SUBMITTED, CockpitDraftStatus.DISCARDED}
    if draft.status in terminal_states:
        raise ValueError(f"Cannot transition from terminal state '{draft.status}'")

    draft.status = new_status

    if new_status == CockpitDraftStatus.SUBMITTED:
        draft.submitted_at = timezone.now()
        draft.submitted_by = user
        draft.submitted_entity_type = submitted_entity_type
        draft.submitted_entity_id = submitted_entity_id

    draft.save(update_fields=[
        "status", "submitted_at", "submitted_by",
        "submitted_entity_type", "submitted_entity_id", "modified_on",
    ])

    logger.info("Draft %s → %s", draft.pk, new_status)
    return draft
