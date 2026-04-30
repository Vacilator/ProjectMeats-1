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
    initial_statuses=("draft", "pending", "pending_approval", "approved"),
    transitions={
        "draft": ("pending_approval", "cancelled"),
        "pending": ("pending_approval", "approved", "cancelled"),
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
    initial_statuses=("draft", "pending", "pending_approval", "approved"),
    transitions={
        "draft": ("pending_approval", "cancelled"),
        "pending": ("pending_approval", "approved", "cancelled"),
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
    initial_statuses=("draft", "pending_approval", "approved"),
    transitions={
        "draft": ("pending_approval", "approved", "cancelled"),
        "pending_approval": ("approved", "cancelled"),
        "approved": ("dispatched", "cancelled"),
        "dispatched": ("in_transit", "cancelled"),
        "in_transit": ("delivered", "cancelled"),
        "delivered": ("completed",),
        "completed": (),
        "cancelled": (),
    },
)


WORKFLOW_BY_MODEL_NAME: dict[str, DocumentWorkflow] = {
    "PurchaseOrder": PURCHASE_ORDER_WORKFLOW,
    "SalesOrder": SALES_ORDER_WORKFLOW,
    "Invoice": INVOICE_WORKFLOW,
    "CarrierPurchaseOrder": CARRIER_PO_WORKFLOW,
}


def get_document_workflow(instance) -> DocumentWorkflow:
    """Resolve the workflow definition for a model instance."""

    workflow = WORKFLOW_BY_MODEL_NAME.get(instance.__class__.__name__)
    if workflow is None:
        raise ValidationError(f"No workflow configured for {instance.__class__.__name__}.")
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
    if current_status and next_status not in allowed:
        raise ValidationError(
            {
                "status": (
                    f"Invalid status transition from '{current_status}' to '{next_status}'. "
                    f"Allowed transitions: {', '.join(allowed) or 'none'}."
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
