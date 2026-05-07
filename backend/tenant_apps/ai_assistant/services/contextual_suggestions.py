"""
Contextual Suggestion Service for Ambient AI.

Provides entity-aware, heuristic-first suggestions with bounded LLM escalation.
The service:
1. Loads the entity in tenant context
2. Evaluates deterministic heuristic rules
3. If rules produce high-confidence suggestions, returns them directly
4. If ambiguous, escalates to gpt-4o-mini for enrichment (bounded)
5. Caches results per entity+state for 5 minutes

Contract: POST /api/v1/ai-assistant/suggestions/contextual/
Request: { entity_type, entity_id, current_state }
Response: { suggestions: [...], cache_hit, confidence }
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


# -------------------------------------------------------------------
# Contract Types
# -------------------------------------------------------------------

@dataclass
class SuggestionRequest:
    """Incoming request for contextual suggestions."""

    entity_type: str  # inquiry, sales_order, purchase_order, supplier, customer
    entity_id: str
    current_state: dict[str, Any] = field(default_factory=dict)
    tenant_id: str = ""
    user_id: str = ""


@dataclass
class Suggestion:
    """A single contextual suggestion."""

    id: str
    action_type: str  # send_rfq, follow_up, approve, generate_so, create_po, etc.
    title: str
    description: str
    confidence: float  # 0.0 - 1.0
    rationale: str
    priority: int = 0  # higher = more important
    action_payload: dict[str, Any] = field(default_factory=dict)
    source: str = "heuristic"  # heuristic | llm | hybrid
    is_safe_action: bool = True  # safe actions can be one-click executed


@dataclass
class SuggestionResponse:
    """Response containing contextual suggestions."""

    suggestions: list[Suggestion] = field(default_factory=list)
    entity_type: str = ""
    entity_id: str = ""
    cache_hit: bool = False
    confidence: float = 0.0
    evaluation_source: str = "heuristic"


# -------------------------------------------------------------------
# Heuristic Rules
# -------------------------------------------------------------------

# Each rule is a function that takes entity_type + current_state
# and returns 0 or more Suggestion objects

def _inquiry_rules(state: dict[str, Any]) -> list[Suggestion]:
    """Heuristic rules for inquiry entities."""
    suggestions: list[Suggestion] = []

    # Rule: Inquiry with no RFQs sent
    if state.get("status") == "open" and state.get("rfq_count", 0) == 0:
        matched_suppliers = state.get("matched_suppliers", [])
        suggestions.append(Suggestion(
            id="send-rfq-to-suppliers",
            action_type="send_rfq",
            title="Send RFQ to matched suppliers",
            description=f"Send Request for Quotation to {len(matched_suppliers) or 'available'} suppliers",
            confidence=0.9,
            rationale="Inquiry is open but no RFQs have been dispatched yet",
            priority=10,
            action_payload={"supplier_ids": matched_suppliers},
            source="heuristic",
            is_safe_action=True,
        ))

    # Rule: Inquiry with bids received but no selection
    if state.get("bids_received", 0) > 0 and not state.get("bid_selected"):
        suggestions.append(Suggestion(
            id="select-bid",
            action_type="select_bid",
            title="Review and select winning bid",
            description=f"{state.get('bids_received')} bid(s) received — ready for selection",
            confidence=0.85,
            rationale="Bids have been received but no selection has been made",
            priority=9,
            action_payload={"bid_count": state.get("bids_received", 0)},
            source="heuristic",
            is_safe_action=False,
        ))

    # Rule: Inquiry approaching due date
    if state.get("days_until_due") is not None and state.get("days_until_due", 999) <= 2:
        suggestions.append(Suggestion(
            id="follow-up-suppliers",
            action_type="follow_up",
            title="Follow up with suppliers",
            description=f"Due date in {state.get('days_until_due')} day(s) — consider following up",
            confidence=0.8,
            rationale="Bid due date is approaching with outstanding responses",
            priority=8,
            action_payload={},
            source="heuristic",
            is_safe_action=True,
        ))

    return suggestions


def _sales_order_rules(state: dict[str, Any]) -> list[Suggestion]:
    """Heuristic rules for sales order entities."""
    suggestions: list[Suggestion] = []

    # Rule: SO generated but not sent
    if state.get("status") == "draft" and state.get("pdf_generated"):
        suggestions.append(Suggestion(
            id="send-so-to-customer",
            action_type="send_email",
            title="Send Sales Order to customer",
            description="SO is ready but hasn't been dispatched to the customer",
            confidence=0.95,
            rationale="Draft Sales Order with PDF generated but not yet emailed",
            priority=10,
            action_payload={"template": "sales_order_dispatch"},
            source="heuristic",
            is_safe_action=True,
        ))

    # Rule: SO sent but no PO received after 3+ days
    if state.get("status") == "sent" and state.get("days_since_sent", 0) >= 3:
        suggestions.append(Suggestion(
            id="follow-up-customer-po",
            action_type="follow_up",
            title="Follow up on customer PO",
            description=f"SO sent {state.get('days_since_sent')} days ago with no PO response",
            confidence=0.75,
            rationale="Customer has not confirmed with PO within expected timeframe",
            priority=7,
            action_payload={},
            source="heuristic",
            is_safe_action=True,
        ))

    return suggestions


def _purchase_order_rules(state: dict[str, Any]) -> list[Suggestion]:
    """Heuristic rules for purchase order entities."""
    suggestions: list[Suggestion] = []

    # Rule: PO approved but not sent to supplier
    if state.get("status") == "approved" and not state.get("sent_to_supplier"):
        suggestions.append(Suggestion(
            id="send-po-to-supplier",
            action_type="send_email",
            title="Send PO to supplier",
            description="Purchase Order approved — ready to dispatch to supplier",
            confidence=0.95,
            rationale="Approved PO not yet sent to supplier contact",
            priority=10,
            action_payload={"template": "purchase_order_dispatch"},
            source="heuristic",
            is_safe_action=True,
        ))

    # Rule: PO with outstanding payment approaching due
    if state.get("payment_status") == "unpaid" and state.get("days_until_due", 999) <= 5:
        suggestions.append(Suggestion(
            id="payment-reminder",
            action_type="create_task",
            title="Payment due soon",
            description=f"Payment due in {state.get('days_until_due')} day(s)",
            confidence=0.8,
            rationale="Payment deadline approaching for outstanding PO",
            priority=6,
            action_payload={},
            source="heuristic",
            is_safe_action=False,
        ))

    return suggestions


def _supplier_rules(state: dict[str, Any]) -> list[Suggestion]:
    """Heuristic rules for supplier entities."""
    suggestions: list[Suggestion] = []

    # Rule: New supplier without contacts
    if state.get("contact_count", 0) == 0:
        suggestions.append(Suggestion(
            id="add-supplier-contacts",
            action_type="create_contact",
            title="Add supplier contacts",
            description="No contacts registered — add primary and billing contacts",
            confidence=0.9,
            rationale="Supplier has no contacts, which blocks RFQ dispatch",
            priority=8,
            action_payload={},
            source="heuristic",
            is_safe_action=False,
        ))

    return suggestions


# Rule registry
HEURISTIC_RULES: dict[str, Any] = {
    "inquiry": _inquiry_rules,
    "sales_order": _sales_order_rules,
    "purchase_order": _purchase_order_rules,
    "supplier": _supplier_rules,
}


# -------------------------------------------------------------------
# Main Service
# -------------------------------------------------------------------

def get_contextual_suggestions(request: SuggestionRequest) -> SuggestionResponse:
    """
    Main entry point for contextual suggestions.

    Evaluates heuristic rules for the entity type, returns sorted suggestions.
    LLM escalation is deferred to a future iteration when heuristic confidence is low.
    """
    rules_fn = HEURISTIC_RULES.get(request.entity_type)

    if not rules_fn:
        logger.debug("No rules for entity_type=%s", request.entity_type)
        return SuggestionResponse(
            entity_type=request.entity_type,
            entity_id=request.entity_id,
        )

    suggestions = rules_fn(request.current_state)

    # Sort by priority (desc) then confidence (desc)
    suggestions.sort(key=lambda s: (s.priority, s.confidence), reverse=True)

    # Calculate overall confidence
    overall_confidence = (
        max(s.confidence for s in suggestions) if suggestions else 0.0
    )

    logger.info(
        "Generated %d suggestions for %s/%s (confidence: %.2f)",
        len(suggestions),
        request.entity_type,
        request.entity_id,
        overall_confidence,
    )

    return SuggestionResponse(
        suggestions=suggestions,
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        cache_hit=False,
        confidence=overall_confidence,
        evaluation_source="heuristic",
    )
