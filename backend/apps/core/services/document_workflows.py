"""Workflow definitions and transition validation for transactional documents."""

from __future__ import annotations

from dataclasses import dataclass

from django.core.exceptions import ValidationError


@dataclass(frozen=True)
class DocumentWorkflow:
    """State machine definition for a document model."""

    initial_statuses: tuple[str, ...]
    transitions: dict[str, tuple[str, ...]]

    def allowed_transitions(self, current_status: str | None) -> tuple[str, ...]:
        normalized = str(current_status or "").strip()
        if not normalized:
            return self.initial_statuses
        return self.transitions.get(normalized, ())


PURCHASE_ORDER_WORKFLOW = DocumentWorkflow(
    initial_statuses=("draft", "pending"),
    transitions={
        "draft": ("pending_approval", "cancelled"),
        "pending": ("pending_approval", "cancelled"),
        "pending_approval": ("approved", "cancelled"),
        "approved": ("sent", "carrier_assigned", "cancelled"),
        "sent": ("carrier_assigned", "in_transit", "cancelled"),
        "carrier_assigned": ("in_transit", "cancelled"),
        "in_transit": ("delivered", "cancelled"),
        "delivered": ("invoiced",),
        "invoiced": (),
        "cancelled": (),
    },
)

SALES_ORDER_WORKFLOW = DocumentWorkflow(
    initial_statuses=("draft", "pending"),
    transitions={
        "draft": ("pending_approval", "cancelled"),
        "pending": ("pending_approval", "cancelled"),
        "pending_approval": ("approved", "cancelled"),
        "approved": ("confirmed", "sent", "cancelled"),
        "confirmed": ("sent", "in_transit", "cancelled"),
        "sent": ("in_transit", "delivered", "cancelled"),
        "in_transit": ("delivered", "cancelled"),
        "delivered": ("invoiced",),
        "invoiced": (),
        "cancelled": (),
    },
)

INVOICE_WORKFLOW = DocumentWorkflow(
    initial_statuses=("draft", "pending_approval", "approved", "sent"),
    transitions={
        "draft": ("pending_approval", "approved", "sent", "cancelled"),
        "pending_approval": ("approved", "cancelled"),
        "approved": ("sent", "cancelled"),
        "sent": ("partial_paid", "paid", "overdue", "cancelled"),
        "partial_paid": ("paid", "overdue", "cancelled"),
        "overdue": ("partial_paid", "paid", "cancelled"),
        "paid": (),
        "cancelled": (),
    },
)

CARRIER_PO_WORKFLOW = DocumentWorkflow(
    initial_statuses=("draft",),
    transitions={
        "draft": ("pending_approval", "cancelled"),
        "pending_approval": ("approved", "cancelled"),
        "approved": ("dispatched", "cancelled"),
        "dispatched": ("in_transit", "cancelled"),
        "in_transit": ("delivered", "cancelled"),
        "delivered": ("completed",),
        "completed": (),
        "cancelled": (),
    },
)


INQUIRY_WORKFLOW = DocumentWorkflow(
    initial_statuses=("draft", "pending"),
    transitions={
        "draft": ("pending", "quoted", "cancelled"),
        "pending": ("quoted", "cancelled"),
        "quoted": ("accepted", "rejected", "cancelled"),
        "accepted": ("fulfilled", "cancelled"),
        "rejected": (),
        "fulfilled": (),
        "cancelled": (),
    },
)

FULFILLMENT_WORKFLOW = DocumentWorkflow(
    initial_statuses=("pending",),
    transitions={
        "pending": ("in_progress", "cancelled"),
        "in_progress": ("shipped", "cancelled"),
        "shipped": ("delivered", "cancelled"),
        "delivered": ("completed",),
        "completed": (),
        "cancelled": (),
    },
)

CLAIM_WORKFLOW = DocumentWorkflow(
    initial_statuses=("pending",),
    transitions={
        "pending": ("approved", "denied", "cancelled"),
        "approved": ("settled", "cancelled"),
        "denied": (),
        "settled": (),
        "cancelled": (),
    },
)

WORKFLOW_BY_MODEL_NAME: dict[str, DocumentWorkflow] = {
    "Inquiry": INQUIRY_WORKFLOW,
    "PurchaseOrder": PURCHASE_ORDER_WORKFLOW,
    "SalesOrder": SALES_ORDER_WORKFLOW,
    "Invoice": INVOICE_WORKFLOW,
    "CarrierPurchaseOrder": CARRIER_PO_WORKFLOW,
    "Fulfillment": FULFILLMENT_WORKFLOW,
    "Claim": CLAIM_WORKFLOW,
}


def get_document_workflow(subject) -> DocumentWorkflow:
    """Resolve the workflow definition for a model instance or model class."""

    model_name = subject.__name__ if isinstance(subject, type) else subject.__class__.__name__
    workflow = WORKFLOW_BY_MODEL_NAME.get(model_name)
    if workflow is None:
        raise ValidationError(f"No workflow configured for {model_name}.")
    return workflow


def get_status_choices(instance) -> list[dict[str, str]]:
    """Return the current status catalog from the model field choices."""

    status_field = instance._meta.get_field("status")
    return [{"value": str(value), "label": str(label)} for value, label in status_field.choices]


def validate_status_transition(instance, new_status: str) -> None:
    """Raise ValidationError when a transition is not allowed."""

    current_status = str(getattr(instance, "status", "") or "").strip()
    next_status = str(new_status or "").strip()
    if not next_status or current_status == next_status:
        return

    workflow = get_document_workflow(instance)
    allowed = workflow.allowed_transitions(current_status)
    if next_status not in allowed:
        raise ValidationError(
            {
                "status": (
                    f"Invalid status transition from '{current_status}' to '{next_status}'. "
                    f"Allowed transitions: {', '.join(allowed) or 'none'}."
                )
            }
        )


def validate_initial_status(subject, new_status: str) -> None:
    """Raise ValidationError when a create request proposes an invalid initial status."""

    next_status = str(new_status or "").strip()
    if not next_status:
        return

    workflow = get_document_workflow(subject)
    allowed = workflow.allowed_transitions(None)
    if next_status not in allowed:
        raise ValidationError(
            {
                "status": (
                    f"Invalid initial status '{next_status}'. "
                    f"Allowed initial statuses: {', '.join(allowed) or 'none'}."
                )
            }
        )


def get_status_workflow_payload(instance) -> dict[str, object]:
    """Return UI-ready workflow metadata for a document instance."""

    current_status = str(getattr(instance, "status", "") or "").strip()
    workflow = get_document_workflow(instance)
    return {
        "current_status": current_status,
        "allowed_transitions": list(workflow.allowed_transitions(current_status)),
        "statuses": get_status_choices(instance),
    }
