"""Shared helpers, constants, and utility functions for ai_assistant views.

This module contains helper functions used across multiple view modules to avoid
circular imports and duplication.
"""
import logging

from rest_framework import status
from rest_framework.response import Response

from ..models import (
    AIDocument,
    AIFeedbackLog,
)
from ..session_utils import get_request_tenant_id

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# OpenAI Swarm/Widget contract
# -----------------------------------------------------------------------------

SWARM_SYSTEM_PROMPT = (
    "You are the ProjectMeats Intelligent Architect. "
    "You have access to tenant data via RLS-safe tools and can learn from user feedback provided via the feedback tool. "
    "You are an expert in wholesale meat logistics, purchase orders, cold storage, and supplier management. "
    "Use tools only when they are available for the tenant (e.g., Outlook connection). "
    "Be highly analytical, concise, and proactive."
)


def _first_non_empty_string(*values: object) -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _extract_review_sender(payload: dict[str, object]) -> str:
    return _first_non_empty_string(
        payload.get("sender"),
        payload.get("sender_email"),
        payload.get("from_email"),
        payload.get("email"),
        payload.get("vendor_name"),
        payload.get("supplier_name"),
        payload.get("customer_name"),
    )


def _extract_review_subject(payload: dict[str, object], document_type: str) -> str:
    return _first_non_empty_string(
        payload.get("subject"),
        payload.get("email_subject"),
        payload.get("title"),
        payload.get("document_name"),
        document_type.replace("_", " ").replace("-", " ").title(),
    )


def _extract_review_summary(payload: dict[str, object]) -> str:
    summary = _first_non_empty_string(
        payload.get("notes"),
        payload.get("summary"),
        payload.get("email_body"),
        payload.get("body"),
        payload.get("text"),
    )
    return summary[:1000]


def _normalize_review_document_type(document_type: str) -> str:
    normalized = str(document_type or "").strip().lower().replace(" ", "_").replace("-", "_")
    return normalized


def _infer_review_entity_type(document_type: str, payload: dict[str, object]) -> str:
    """Map an AI-classified document type (and payload keys) to a canonical entity type string."""
    normalized = _normalize_review_document_type(document_type)

    if normalized in {"purchase_order", "po"}:
        return "purchase_order"
    if normalized in {"bill_of_lading", "bol", "shipment", "carrier_purchase_order", "carrier_po"}:
        return "carrier-pos"
    if normalized in {"invoice"}:
        return "invoice"
    if normalized in {"sales_order", "so"}:
        return "sales_order"
    if normalized in {"inquiry", "quote"}:
        return "inquiry"
    if normalized in {"contact", "new_contact", "contact_update"}:
        return "contact"
    if normalized in {"new_customer", "customer"}:
        return "customer"
    if normalized in {"supplier", "new_supplier", "vendor", "supplier_note"}:
        return "supplier"
    if normalized in {"payment", "payment_notice", "remittance"}:
        return "payment"
    if normalized in {"pricing_sheet"}:
        return "pricing_sheet"

    # Fallback: infer from payload keys
    if any(key in payload for key in ("order_number", "vendor_name", "supplier_name")):
        return "purchase_order"
    if any(key in payload for key in ("bol_number", "carrier_name", "pickup_date", "pick_up_date")):
        return "carrier-pos"
    if any(key in payload for key in ("first_name", "last_name", "contact_name")):
        return "contact"
    if any(key in payload for key in ("total_amount", "payment_amount", "remittance_amount")):
        return "payment"

    return ""


def build_contextual_suggestions(
    *,
    tenant,
    entity_type: str,
    entity_id: str,
    current_state: dict[str, object],
) -> list[dict[str, object]]:
    """Generate AI-powered action suggestions for an entity based on its current state."""
    suggestions: list[dict[str, object]] = []
    normalized_type = str(entity_type or "").strip().lower()
    current_state = current_state if isinstance(current_state, dict) else {}

    def add_suggestion(
        *,
        action: str,
        label: str,
        confidence: float,
        reason: str,
        prompt: str = "",
        target_url: str = "",
    ) -> None:
        suggestions.append(
            {
                "action": action,
                "label": label,
                "confidence": confidence,
                "reason": reason,
                "prompt": prompt,
                "target_url": target_url,
            }
        )

    status_value = _first_non_empty_string(
        current_state.get("status"),
        current_state.get("order_status"),
    ).upper()

    if normalized_type in {"supplier", "customer"}:
        add_suggestion(
            action="draft_check_in_email",
            label="Draft Check-in Email",
            confidence=0.93,
            reason="Relationship records support contextual follow-up drafting.",
            prompt=f"Draft a concise check-in email for this {normalized_type} using recent orders, balances, and delays.",
        )

    if normalized_type == "plant":
        from tenant_apps.plants.models import Plant

        plant = Plant.objects.filter(tenant=tenant, id=entity_id).only("id", "name", "booking_contact_email").first()
        if plant and not plant.booking_contact_email:
            add_suggestion(
                action="update_booking_contact",
                label="Add booking contact details",
                confidence=0.89,
                reason="This plant is missing a booking contact email.",
                prompt="Open the plant edit form and add booking contact details so logistics teams can route scheduling updates.",
            )
        else:
            add_suggestion(
                action="review_plant_profile",
                label="Review plant continuity profile",
                confidence=0.76,
                reason="Static plant editing is available for business continuity.",
                prompt="Review the plant profile and booking details for this facility.",
            )

    if normalized_type in {"purchase_order", "sales_order"} and status_value == "APPROVED":
        add_suggestion(
            action="generate_pdf",
            label="Generate & Email PDF",
            confidence=0.98,
            reason="Approved orders are good candidates for document generation and customer communication.",
            prompt="Generate the approved order PDF and prepare the outbound email for review.",
        )

    return suggestions[:3]


def _humanize_review_intent(document_type: str, payload: dict[str, object]) -> str:
    """Return a user-friendly label for a review item's entity intent (e.g. 'Purchase Order')."""
    entity_type = _infer_review_entity_type(document_type, payload)
    if entity_type == "carrier-pos":
        return "Bill Of Lading"
    if entity_type == "purchase_order":
        return "Purchase Order"
    if entity_type:
        return entity_type.replace("-", " ").replace("_", " ").title()
    normalized = _normalize_review_document_type(document_type)
    return normalized.replace("_", " ").title() or "AI Draft"


def build_pending_review_items(
    tenant_id: str,
    *,
    highlighted_id: str | None = None,
    limit: int = 25,
) -> list[dict[str, object]]:
    """Build serialized list of unresolved AI feedback items for the review queue."""
    qs = AIFeedbackLog.objects.filter(
        tenant_id=tenant_id,
        resolved_by__isnull=True,
    ).order_by("-created_on")

    rows = list(qs[:limit])
    if highlighted_id:
        try:
            highlighted_row = qs.filter(id=highlighted_id).first()
        except (TypeError, ValueError):
            highlighted_row = None
        if highlighted_row and all(str(row.id) != str(highlighted_row.id) for row in rows):
            rows = [highlighted_row, *rows[: max(limit - 1, 0)]]

    document_ids = [row.document_id for row in rows if row.document_id is not None]
    documents = {
        document.id: document
        for document in AIDocument.objects.filter(tenant_id=tenant_id, id__in=document_ids).only(
            "id",
            "original_filename",
        )
    }

    items: list[dict[str, object]] = []
    for row in rows:
        payload = row.original_extracted_data if isinstance(row.original_extracted_data, dict) else {}
        document = documents.get(row.document_id)
        review_entity_type = _infer_review_entity_type(row.document_type, payload)

        # Extract attachment metadata from the original_extracted_data payload
        att_count = int(payload.get("attachment_count") or 0)
        att_filenames = payload.get("attachment_filenames") or []
        if not isinstance(att_filenames, list):
            att_filenames = []

        items.append(
            {
                "id": row.id,
                "document_id": row.document_id,
                "document_type": row.document_type,
                "confidence_score": float(row.confidence_score or 0.0),
                "precision_delta": float(row.precision_delta or 0.0),
                "created_on": row.created_on,
                "original_extracted_data": payload,
                "sender": _extract_review_sender(payload),
                "source_subject": _extract_review_subject(payload, row.document_type),
                "source_summary": _extract_review_summary(payload),
                "source_document_name": str(getattr(document, "original_filename", "") or ""),
                "intent_label": _humanize_review_intent(row.document_type, payload),
                "review_entity_type": review_entity_type,
                "review_target_url": str(payload.get("review_target_url") or f"/my-tasks?tab=ai-review&draft={row.id}"),
                "feedback_signal": row.feedback_signal,
                "feedback_comment": row.feedback_comment,
                "retraining_status": row.retraining_status,
                "retraining_queued_at": row.retraining_queued_at,
                "attachment_count": att_count,
                "attachment_filenames": [str(n) for n in att_filenames[:20]],
            }
        )

    return items


def ai_not_configured_response() -> Response:
    """Return a 503 response when OpenAI integration is not configured."""
    return Response(
        {
            "error": "AI is not enabled for this environment.",
            "code": "AI_NOT_CONFIGURED",
            "detail": "OpenAI is not configured on the server (missing OPENAI_API_KEY).",
        },
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


def _tenant_membership_role(*, user, tenant) -> str:
    """Return the active TenantUser role for a user in a tenant, or empty string."""
    if not user or not getattr(user, "is_authenticated", False) or tenant is None:
        return ""

    from apps.tenants.models import TenantUser

    return (
        TenantUser.objects.filter(tenant=tenant, user=user, is_active=True).values_list("role", flat=True).first() or ""
    )


def _can_review_ai_approvals(*, user, tenant) -> bool:
    """Check if user has owner/admin role required to resolve AI approvals."""
    return _tenant_membership_role(user=user, tenant=tenant) in {"owner", "admin"}


def can_access_ai_review_queue(*, user, tenant) -> bool:
    """Check if user can view the AI review queue (staff, superuser, or owner/admin/manager)."""
    if not user or not getattr(user, "is_authenticated", False) or tenant is None:
        return False
    if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
        return True
    return _tenant_membership_role(user=user, tenant=tenant) in {"owner", "admin", "manager"}
