"""
Contextual Email Draft Service
===============================

Generates context-aware email draft payloads for supplier/customer communications.
Reads recent orders, outstanding balances, and delay history to produce
Outlook-ready drafts with reviewable subject/body metadata.

Design:
- Pure computation: caller provides pre-fetched business context
- Tenant-safe: operates only on supplied data
- Graceful degradation: returns empty draft when context insufficient
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional


# -------------------------------------------------------------------
# Contract Types
# -------------------------------------------------------------------


@dataclass
class OrderSummary:
    """Summary of a recent order for context building."""

    order_id: str
    order_number: str
    order_date: str  # ISO format
    total_amount: float
    currency: str = "USD"
    status: str = "active"
    product_description: str = ""


@dataclass
class BalanceSummary:
    """Outstanding balance information."""

    total_outstanding: float
    currency: str = "USD"
    oldest_invoice_date: Optional[str] = None
    overdue_count: int = 0
    days_overdue_max: int = 0


@dataclass
class DelaySummary:
    """Recent delivery/payment delay information."""

    total_delays: int = 0
    avg_delay_days: float = 0.0
    last_delay_date: Optional[str] = None
    delay_reason: str = ""


@dataclass
class EmailDraftContext:
    """Full business context for email generation."""

    entity_type: str  # "supplier" or "customer"
    entity_id: str
    entity_name: str
    contact_name: str
    contact_email: str
    recent_orders: list[OrderSummary] = field(default_factory=list)
    balance: Optional[BalanceSummary] = None
    delays: Optional[DelaySummary] = None
    tenant_company_name: str = "Our Company"
    sender_name: str = ""
    draft_purpose: str = "follow_up"  # follow_up, payment_reminder, order_update, introduction


@dataclass
class EmailDraft:
    """Generated email draft ready for Outlook integration."""

    to: str
    subject: str
    body: str
    draft_purpose: str
    confidence: float  # 0.0-1.0 — how confident we are this is useful
    context_summary: str  # Plain-English summary of what context was used
    metadata: dict = field(default_factory=dict)

    @property
    def is_viable(self) -> bool:
        """Draft has enough content to be useful."""
        return bool(self.to and self.subject and self.body and self.confidence >= 0.3)


@dataclass
class EmailDraftResponse:
    """Response from the draft generation service."""

    draft: Optional[EmailDraft]
    available: bool  # Whether a draft could be generated
    reason: str = ""  # Why not available, if applicable


# -------------------------------------------------------------------
# Draft Generation Templates
# -------------------------------------------------------------------

TEMPLATES = {
    "follow_up": {
        "subject": "Following up on recent order{s} – {entity_name}",
        "body": (
            "Hi {contact_name},\n\n"
            "I hope this message finds you well. I wanted to follow up regarding "
            "our recent business activity.\n\n"
            "{order_context}"
            "{balance_context}"
            "Please let me know if you have any questions or if there's anything "
            "we can assist with.\n\n"
            "Best regards,\n{sender_name}\n{company_name}"
        ),
    },
    "payment_reminder": {
        "subject": "Payment reminder – {overdue_count} invoice{s} outstanding – {entity_name}",
        "body": (
            "Hi {contact_name},\n\n"
            "I'm writing to kindly remind you about outstanding payment{s}.\n\n"
            "{balance_context}"
            "We would appreciate your prompt attention to this matter. "
            "If payment has already been sent, please disregard this message.\n\n"
            "Please don't hesitate to reach out if you'd like to discuss "
            "payment arrangements.\n\n"
            "Best regards,\n{sender_name}\n{company_name}"
        ),
    },
    "order_update": {
        "subject": "Order update – {latest_order_number} – {entity_name}",
        "body": (
            "Hi {contact_name},\n\n"
            "I wanted to provide you with an update on your recent order.\n\n"
            "{order_context}"
            "{delay_context}"
            "Please let me know if you need any additional information.\n\n"
            "Best regards,\n{sender_name}\n{company_name}"
        ),
    },
    "introduction": {
        "subject": "Introduction – {company_name}",
        "body": (
            "Hi {contact_name},\n\n"
            "I'd like to introduce myself. My name is {sender_name} from "
            "{company_name}.\n\n"
            "We specialize in providing quality products and services, "
            "and I believe there may be an opportunity for us to work together.\n\n"
            "Would you be available for a brief call this week to discuss "
            "how we might support your needs?\n\n"
            "Best regards,\n{sender_name}\n{company_name}"
        ),
    },
}


# -------------------------------------------------------------------
# Context Formatters
# -------------------------------------------------------------------


def _format_order_context(orders: list[OrderSummary]) -> str:
    """Format recent orders into readable paragraph."""
    if not orders:
        return ""

    if len(orders) == 1:
        o = orders[0]
        return (
            f"Our most recent order ({o.order_number}, {o.order_date}) "
            f"was for {o.currency} {o.total_amount:,.2f}"
            f"{' – ' + o.product_description if o.product_description else ''}.\n\n"
        )

    total = sum(o.total_amount for o in orders)
    currency = orders[0].currency
    lines = [f"Here's a summary of our recent activity ({len(orders)} orders, total {currency} {total:,.2f}):\n"]
    for o in orders[:5]:
        desc = f" – {o.product_description}" if o.product_description else ""
        lines.append(f"  • {o.order_number} ({o.order_date}): {o.currency} {o.total_amount:,.2f}{desc}")
    return "\n".join(lines) + "\n\n"


def _format_balance_context(balance: Optional[BalanceSummary]) -> str:
    """Format balance info into readable paragraph."""
    if not balance or balance.total_outstanding <= 0:
        return ""

    parts = [
        f"Current outstanding balance: {balance.currency} {balance.total_outstanding:,.2f}"
    ]
    if balance.overdue_count > 0:
        parts.append(
            f" ({balance.overdue_count} overdue invoice{'s' if balance.overdue_count > 1 else ''}, "
            f"oldest {balance.days_overdue_max} days past due)"
        )
    return "".join(parts) + ".\n\n"


def _format_delay_context(delays: Optional[DelaySummary]) -> str:
    """Format delay info into readable paragraph."""
    if not delays or delays.total_delays == 0:
        return ""

    return (
        f"We've noted {delays.total_delays} recent delay{'s' if delays.total_delays > 1 else ''} "
        f"(average {delays.avg_delay_days:.0f} days)"
        f"{' – ' + delays.delay_reason if delays.delay_reason else ''}.\n\n"
    )


# -------------------------------------------------------------------
# Draft Purpose Selection
# -------------------------------------------------------------------


def select_draft_purpose(context: EmailDraftContext) -> str:
    """Auto-select the most appropriate draft purpose based on context."""
    if context.draft_purpose != "follow_up":
        return context.draft_purpose

    # Auto-detect based on context signals
    if context.balance and context.balance.overdue_count > 0:
        return "payment_reminder"

    if context.delays and context.delays.total_delays > 2:
        return "order_update"

    if not context.recent_orders:
        return "introduction"

    return "follow_up"


# -------------------------------------------------------------------
# Main Service
# -------------------------------------------------------------------


def generate_email_draft(context: EmailDraftContext) -> EmailDraftResponse:
    """Generate a contextual email draft from business context.

    Returns EmailDraftResponse with the draft or reason for unavailability.
    """
    # Validate minimum requirements
    if not context.contact_email:
        return EmailDraftResponse(
            draft=None,
            available=False,
            reason="No contact email available",
        )

    if not context.contact_name:
        return EmailDraftResponse(
            draft=None,
            available=False,
            reason="No contact name available",
        )

    purpose = select_draft_purpose(context)
    template = TEMPLATES.get(purpose, TEMPLATES["follow_up"])

    # Build template variables
    order_context = _format_order_context(context.recent_orders)
    balance_context = _format_balance_context(context.balance)
    delay_context = _format_delay_context(context.delays)

    latest_order_number = context.recent_orders[0].order_number if context.recent_orders else "N/A"
    overdue_count = context.balance.overdue_count if context.balance else 0

    variables = {
        "entity_name": context.entity_name,
        "contact_name": context.contact_name,
        "sender_name": context.sender_name or "The Team",
        "company_name": context.tenant_company_name,
        "order_context": order_context,
        "balance_context": balance_context,
        "delay_context": delay_context,
        "latest_order_number": latest_order_number,
        "overdue_count": str(overdue_count),
        "s": "s" if len(context.recent_orders) != 1 else "",
    }

    subject = template["subject"].format(**variables)
    body = template["body"].format(**variables)

    # Calculate confidence based on context richness
    confidence = _calculate_confidence(context)

    # Build context summary
    context_parts = []
    if context.recent_orders:
        context_parts.append(f"{len(context.recent_orders)} recent orders")
    if context.balance and context.balance.total_outstanding > 0:
        context_parts.append("outstanding balance")
    if context.delays and context.delays.total_delays > 0:
        context_parts.append("delivery delays")
    context_summary = "Based on: " + ", ".join(context_parts) if context_parts else "Limited context available"

    draft = EmailDraft(
        to=context.contact_email,
        subject=subject,
        body=body,
        draft_purpose=purpose,
        confidence=confidence,
        context_summary=context_summary,
        metadata={
            "entity_type": context.entity_type,
            "entity_id": context.entity_id,
            "entity_name": context.entity_name,
            "orders_used": len(context.recent_orders),
            "has_balance_data": context.balance is not None,
            "has_delay_data": context.delays is not None,
        },
    )

    return EmailDraftResponse(draft=draft, available=True)


def _calculate_confidence(context: EmailDraftContext) -> float:
    """Calculate confidence score based on available context richness."""
    score = 0.3  # Base score for having a contact

    if context.recent_orders:
        score += min(0.3, len(context.recent_orders) * 0.06)

    if context.balance:
        score += 0.15

    if context.delays:
        score += 0.1

    if context.sender_name:
        score += 0.05

    return min(1.0, round(score, 2))
