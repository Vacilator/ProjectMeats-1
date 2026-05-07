"""Deterministic happy-path orchestrator for the core trading engine.

CTE-04.5: Wires the hardcoded state-machine across inquiry routing, sourcing,
approval, sales, and logistics — providing a single traceable chain from source
inquiry to downstream commercial documents.

State Machine (two branches):
    FULFILL: inquiry → draft SO → approve SO → carrier fan-out → carrier reply → draft carrier PO
    BROKER:  inquiry → supplier RFQ → supplier reply → draft supplier PO → approve supplier PO
             → draft SO → approve SO → carrier fan-out → carrier reply → draft carrier PO

Each step is:
  - Idempotent (safe to re-invoke)
  - Tenant-isolated (RLS enforced)
  - Traceable (ExecutionEventLog + custom_data lineage)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from django.utils import timezone

from apps.tenants.rls import tenant_rls
from tenant_apps.inquiries.models import (
    Inquiry,
    InquiryRouteDecisionChoices,
    InquiryStatusChoices,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# State Machine Definitions
# ---------------------------------------------------------------------------


class OrchestratorStep(str, Enum):
    """Ordered steps in the happy-path state machine."""

    # BROKER-only prefix
    SUPPLIER_RFQ = "supplier_rfq"
    SUPPLIER_REPLY_PARSE = "supplier_reply_parse"
    DRAFT_SUPPLIER_PO = "draft_supplier_po"
    APPROVE_SUPPLIER_PO = "approve_supplier_po"

    # Shared suffix (both FULFILL and BROKER)
    DRAFT_SALES_ORDER = "draft_sales_order"
    APPROVE_SALES_ORDER = "approve_sales_order"
    CARRIER_FAN_OUT = "carrier_fan_out"
    CARRIER_REPLY_PARSE = "carrier_reply_parse"
    DRAFT_CARRIER_PO = "draft_carrier_po"

    # Terminal
    COMPLETED = "completed"


FULFILL_STEPS = [
    OrchestratorStep.DRAFT_SALES_ORDER,
    OrchestratorStep.APPROVE_SALES_ORDER,
    OrchestratorStep.CARRIER_FAN_OUT,
    OrchestratorStep.CARRIER_REPLY_PARSE,
    OrchestratorStep.DRAFT_CARRIER_PO,
    OrchestratorStep.COMPLETED,
]

BROKER_STEPS = [
    OrchestratorStep.SUPPLIER_RFQ,
    OrchestratorStep.SUPPLIER_REPLY_PARSE,
    OrchestratorStep.DRAFT_SUPPLIER_PO,
    OrchestratorStep.APPROVE_SUPPLIER_PO,
    OrchestratorStep.DRAFT_SALES_ORDER,
    OrchestratorStep.APPROVE_SALES_ORDER,
    OrchestratorStep.CARRIER_FAN_OUT,
    OrchestratorStep.CARRIER_REPLY_PARSE,
    OrchestratorStep.DRAFT_CARRIER_PO,
    OrchestratorStep.COMPLETED,
]


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------


@dataclass
class StepResult:
    """Outcome of a single orchestrator step."""

    step: OrchestratorStep
    success: bool
    message: str = ""
    entity_id: str | None = None
    entity_type: str | None = None


@dataclass
class OrchestratorResult:
    """Full result of the orchestrator advance operation."""

    inquiry_id: str
    route: str
    current_step: OrchestratorStep
    steps_executed: list[StepResult] = field(default_factory=list)
    blocked: bool = False
    blocked_reason: str = ""
    completed: bool = False

    @property
    def success(self) -> bool:
        return all(s.success for s in self.steps_executed)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_orchestrator_state(*, tenant: Any, inquiry: Inquiry) -> OrchestratorStep:
    """Derive the current step from the inquiry's linked entities.

    Inspects the inquiry's FK chain to determine how far along the process is.
    This is a pure read operation — no mutations.
    """
    route = inquiry.route_decision

    if route == InquiryRouteDecisionChoices.FULFILL:
        return _derive_fulfill_state(inquiry)
    elif route == InquiryRouteDecisionChoices.BROKER:
        return _derive_broker_state(inquiry)
    else:
        return OrchestratorStep.DRAFT_SALES_ORDER


def advance_orchestrator(
    *,
    tenant: Any,
    inquiry: Inquiry,
    advance_through: OrchestratorStep | None = None,
    user: Any = None,
) -> OrchestratorResult:
    """Advance the orchestrator to the next achievable step.

    This is the main entry point for the state machine. It reads the current
    state, then attempts to advance by one step (or all the way to
    `advance_through` if specified).

    Each step delegates to the appropriate service. Steps that require external
    input (e.g., waiting for a supplier reply) are marked as "blocked" rather
    than failed — the orchestrator cannot advance past them without new data.

    Args:
        tenant: Active tenant.
        inquiry: The root inquiry to orchestrate.
        advance_through: Optional target step to advance to. If None, advances one step.
        user: The user initiating the advance (for audit).

    Returns:
        OrchestratorResult with step outcomes.
    """
    route = inquiry.route_decision
    steps = FULFILL_STEPS if route == InquiryRouteDecisionChoices.FULFILL else BROKER_STEPS

    current = get_orchestrator_state(tenant=tenant, inquiry=inquiry)
    result = OrchestratorResult(
        inquiry_id=str(inquiry.id),
        route=route or "FULFILL",
        current_step=current,
    )

    if current == OrchestratorStep.COMPLETED:
        result.completed = True
        return result

    # Find index of current step
    try:
        start_idx = steps.index(current)
    except ValueError:
        result.blocked = True
        result.blocked_reason = f"Unknown state: {current}"
        return result

    # Advance from current through target
    target_idx = len(steps) - 1
    if advance_through:
        try:
            target_idx = steps.index(advance_through)
        except ValueError:
            pass

    for step in steps[start_idx: target_idx + 1]:
        if step == OrchestratorStep.COMPLETED:
            result.completed = True
            result.current_step = OrchestratorStep.COMPLETED
            _mark_inquiry_fulfilled(tenant=tenant, inquiry=inquiry)
            _emit_orchestrator_telemetry(
                tenant=tenant, inquiry=inquiry, event="orchestrator.completed", step=step
            )
            break

        step_result = _execute_step(
            tenant=tenant, inquiry=inquiry, step=step, user=user
        )
        result.steps_executed.append(step_result)

        if not step_result.success:
            result.blocked = True
            result.blocked_reason = step_result.message
            break

        result.current_step = step

    return result


def get_lineage_chain(*, tenant: Any, inquiry: Inquiry) -> dict[str, Any]:
    """Return the full lineage chain for an inquiry as a JSON-serializable dict.

    Used by the Process Cockpit to render the React Flow diagram.
    """
    with tenant_rls(str(tenant.id), strict=True):
        inquiry = Inquiry.objects.select_related(
            "supplier_purchase_order",
            "sales_order",
            "carrier_purchase_order",
            "customer",
            "supplier",
        ).get(id=inquiry.id, tenant=tenant)

    chain: dict[str, Any] = {
        "inquiry": {
            "id": str(inquiry.id),
            "number": getattr(inquiry, "inquiry_number", "") or str(inquiry.id)[:8],
            "status": inquiry.status,
            "route_decision": inquiry.route_decision,
            "customer": str(inquiry.customer) if inquiry.customer else None,
            "supplier": str(inquiry.supplier) if inquiry.supplier else None,
        },
        "supplier_purchase_order": None,
        "sales_order": None,
        "carrier_purchase_order": None,
        "current_step": get_orchestrator_state(tenant=tenant, inquiry=inquiry).value,
    }

    if inquiry.supplier_purchase_order:
        po = inquiry.supplier_purchase_order
        chain["supplier_purchase_order"] = {
            "id": str(po.id),
            "number": po.order_number or str(po.id)[:8],
            "status": po.status,
        }

    if inquiry.sales_order:
        so = inquiry.sales_order
        chain["sales_order"] = {
            "id": str(so.id),
            "number": so.our_sales_order_num or str(so.id)[:8],
            "status": so.status,
        }

    if inquiry.carrier_purchase_order:
        cpo = inquiry.carrier_purchase_order
        chain["carrier_purchase_order"] = {
            "id": str(cpo.id),
            "number": cpo.our_carrier_po_num or str(cpo.id)[:8],
            "status": cpo.status,
        }

    return chain


# ---------------------------------------------------------------------------
# Step executors
# ---------------------------------------------------------------------------


def _execute_step(
    *, tenant: Any, inquiry: Inquiry, step: OrchestratorStep, user: Any = None
) -> StepResult:
    """Execute a single orchestrator step by delegating to the appropriate service."""

    _emit_orchestrator_telemetry(
        tenant=tenant, inquiry=inquiry, event=f"orchestrator.step.start", step=step
    )

    try:
        if step == OrchestratorStep.SUPPLIER_RFQ:
            return _step_supplier_rfq(tenant=tenant, inquiry=inquiry, user=user)
        elif step == OrchestratorStep.SUPPLIER_REPLY_PARSE:
            return _step_supplier_reply_parse(tenant=tenant, inquiry=inquiry)
        elif step == OrchestratorStep.DRAFT_SUPPLIER_PO:
            return _step_draft_supplier_po(tenant=tenant, inquiry=inquiry)
        elif step == OrchestratorStep.APPROVE_SUPPLIER_PO:
            return _step_approve_supplier_po(tenant=tenant, inquiry=inquiry)
        elif step == OrchestratorStep.DRAFT_SALES_ORDER:
            return _step_draft_sales_order(tenant=tenant, inquiry=inquiry)
        elif step == OrchestratorStep.APPROVE_SALES_ORDER:
            return _step_approve_sales_order(tenant=tenant, inquiry=inquiry)
        elif step == OrchestratorStep.CARRIER_FAN_OUT:
            return _step_carrier_fan_out(tenant=tenant, inquiry=inquiry, user=user)
        elif step == OrchestratorStep.CARRIER_REPLY_PARSE:
            return _step_carrier_reply_parse(tenant=tenant, inquiry=inquiry)
        elif step == OrchestratorStep.DRAFT_CARRIER_PO:
            return _step_draft_carrier_po(tenant=tenant, inquiry=inquiry)
        else:
            return StepResult(step=step, success=False, message=f"Unknown step: {step}")
    except Exception as exc:
        logger.exception(f"Orchestrator step {step.value} failed for inquiry {inquiry.id}")
        _emit_orchestrator_telemetry(
            tenant=tenant, inquiry=inquiry, event="orchestrator.step.error", step=step
        )
        return StepResult(step=step, success=False, message=str(exc))


# ---------------------------------------------------------------------------
# Individual step implementations
# ---------------------------------------------------------------------------


def _step_supplier_rfq(*, tenant: Any, inquiry: Inquiry, user: Any = None) -> StepResult:
    """Send supplier RFQ emails for BROKER-routed inquiry."""
    from tenant_apps.inquiries.services.supplier_rfq_email import send_supplier_rfqs_for_inquiry

    rfqs = inquiry.supplier_rfqs.all()
    if rfqs.exists():
        return StepResult(
            step=OrchestratorStep.SUPPLIER_RFQ,
            success=True,
            message="RFQs already sent (idempotent).",
        )

    # If no RFQs exist yet but the inquiry has a supplier, auto-create one
    if not inquiry.supplier:
        return StepResult(
            step=OrchestratorStep.SUPPLIER_RFQ,
            success=False,
            message="No supplier assigned to inquiry. Cannot send RFQ.",
        )

    try:
        result = send_supplier_rfqs_for_inquiry(
            tenant=tenant, inquiry=inquiry, user=user
        )
        return StepResult(
            step=OrchestratorStep.SUPPLIER_RFQ,
            success=True,
            message=f"Sent {getattr(result, 'sent_count', 1)} RFQ(s).",
            entity_type="InquirySupplierRFQ",
        )
    except Exception as exc:
        return StepResult(
            step=OrchestratorStep.SUPPLIER_RFQ,
            success=False,
            message=f"RFQ send failed: {exc}",
        )


def _step_supplier_reply_parse(*, tenant: Any, inquiry: Inquiry) -> StepResult:
    """Check if a supplier reply has been parsed for this inquiry's RFQ."""
    rfqs = inquiry.supplier_rfqs.all()
    if not rfqs.exists():
        return StepResult(
            step=OrchestratorStep.SUPPLIER_REPLY_PARSE,
            success=False,
            message="No RFQs exist. Must send RFQs first.",
        )

    # Check if any RFQ has a reply with parsed data
    replied_rfq = rfqs.filter(status__in=["replied", "accepted"]).first()
    if replied_rfq:
        return StepResult(
            step=OrchestratorStep.SUPPLIER_REPLY_PARSE,
            success=True,
            message="Supplier reply received and parsed.",
            entity_id=str(replied_rfq.id),
            entity_type="InquirySupplierRFQ",
        )

    return StepResult(
        step=OrchestratorStep.SUPPLIER_REPLY_PARSE,
        success=False,
        message="Waiting for supplier reply. Cannot advance until a reply is parsed.",
    )


def _step_draft_supplier_po(*, tenant: Any, inquiry: Inquiry) -> StepResult:
    """Create draft supplier PO from the accepted/replied RFQ."""
    from tenant_apps.inquiries.services.supplier_quote_po_draft import (
        create_supplier_quote_purchase_order_draft,
    )

    # Already linked?
    if inquiry.supplier_purchase_order_id:
        return StepResult(
            step=OrchestratorStep.DRAFT_SUPPLIER_PO,
            success=True,
            message="Supplier PO already exists (idempotent).",
            entity_id=str(inquiry.supplier_purchase_order_id),
            entity_type="PurchaseOrder",
        )

    replied_rfq = inquiry.supplier_rfqs.filter(
        status__in=["replied", "accepted"]
    ).first()
    if not replied_rfq:
        return StepResult(
            step=OrchestratorStep.DRAFT_SUPPLIER_PO,
            success=False,
            message="No replied RFQ found.",
        )

    result = create_supplier_quote_purchase_order_draft(
        tenant=tenant, inquiry=inquiry, rfq_id=replied_rfq.id
    )

    # Link to inquiry
    inquiry.supplier_purchase_order = result.purchase_order
    inquiry.save(update_fields=["supplier_purchase_order", "modified_on"])

    return StepResult(
        step=OrchestratorStep.DRAFT_SUPPLIER_PO,
        success=True,
        message=f"Draft supplier PO created: {result.purchase_order.order_number}",
        entity_id=str(result.purchase_order.id),
        entity_type="PurchaseOrder",
    )


def _step_approve_supplier_po(*, tenant: Any, inquiry: Inquiry) -> StepResult:
    """Check/wait for supplier PO approval."""
    from tenant_apps.purchase_orders.models import PurchaseOrderStatus

    po = inquiry.supplier_purchase_order
    if not po:
        return StepResult(
            step=OrchestratorStep.APPROVE_SUPPLIER_PO,
            success=False,
            message="No supplier PO linked to inquiry.",
        )

    po.refresh_from_db()
    if po.status == PurchaseOrderStatus.APPROVED:
        return StepResult(
            step=OrchestratorStep.APPROVE_SUPPLIER_PO,
            success=True,
            message="Supplier PO is approved.",
            entity_id=str(po.id),
            entity_type="PurchaseOrder",
        )

    return StepResult(
        step=OrchestratorStep.APPROVE_SUPPLIER_PO,
        success=False,
        message=f"Supplier PO is '{po.status}'. Waiting for approval.",
    )


def _step_draft_sales_order(*, tenant: Any, inquiry: Inquiry) -> StepResult:
    """Create draft sales order (FULFILL or from approved BROKER source)."""
    from tenant_apps.sales_orders.services.draft_sales_order import (
        create_draft_from_approved_source,
        create_draft_from_fulfill,
    )

    # Already linked?
    if inquiry.sales_order_id:
        return StepResult(
            step=OrchestratorStep.DRAFT_SALES_ORDER,
            success=True,
            message="Sales order already exists (idempotent).",
            entity_id=str(inquiry.sales_order_id),
            entity_type="SalesOrder",
        )

    route = inquiry.route_decision
    if route == InquiryRouteDecisionChoices.FULFILL:
        result = create_draft_from_fulfill(tenant=tenant, inquiry=inquiry)
    else:
        # BROKER — need approved supplier PO
        po = inquiry.supplier_purchase_order
        if not po:
            return StepResult(
                step=OrchestratorStep.DRAFT_SALES_ORDER,
                success=False,
                message="No supplier PO linked. Cannot create SO for BROKER path.",
            )
        result = create_draft_from_approved_source(tenant=tenant, purchase_order=po)

    # Refresh inquiry to get the linked SO
    inquiry.refresh_from_db()

    return StepResult(
        step=OrchestratorStep.DRAFT_SALES_ORDER,
        success=True,
        message=f"Draft SO {'created' if result.created else 'already existed'}: "
        f"{result.sales_order.our_sales_order_num}",
        entity_id=str(result.sales_order.id),
        entity_type="SalesOrder",
    )


def _step_approve_sales_order(*, tenant: Any, inquiry: Inquiry) -> StepResult:
    """Check/wait for sales order approval. Triggers PDF + customer email dispatch."""
    from tenant_apps.sales_orders.models import SalesOrderStatus

    inquiry.refresh_from_db()
    so = inquiry.sales_order
    if not so:
        return StepResult(
            step=OrchestratorStep.APPROVE_SALES_ORDER,
            success=False,
            message="No sales order linked to inquiry.",
        )

    so.refresh_from_db()
    if so.status in (SalesOrderStatus.APPROVED, SalesOrderStatus.COMPLETED):
        return StepResult(
            step=OrchestratorStep.APPROVE_SALES_ORDER,
            success=True,
            message=f"Sales order is '{so.status}'.",
            entity_id=str(so.id),
            entity_type="SalesOrder",
        )

    return StepResult(
        step=OrchestratorStep.APPROVE_SALES_ORDER,
        success=False,
        message=f"Sales order is '{so.status}'. Waiting for approval.",
    )


def _step_carrier_fan_out(*, tenant: Any, inquiry: Inquiry, user: Any = None) -> StepResult:
    """Send carrier freight inquiry emails for the approved SO."""
    from tenant_apps.carriers.services.freight_inquiry import send_carrier_freight_inquiries

    inquiry.refresh_from_db()
    so = inquiry.sales_order
    if not so:
        return StepResult(
            step=OrchestratorStep.CARRIER_FAN_OUT,
            success=False,
            message="No sales order linked.",
        )

    result = send_carrier_freight_inquiries(
        tenant=tenant, sales_order=so, user=user
    )

    if result.success:
        return StepResult(
            step=OrchestratorStep.CARRIER_FAN_OUT,
            success=True,
            message=f"Carrier inquiries sent: {result.inquiries_sent}",
            entity_type="CarrierFreightInquiry",
        )

    return StepResult(
        step=OrchestratorStep.CARRIER_FAN_OUT,
        success=False,
        message=result.error_message or "Carrier fan-out failed.",
    )


def _step_carrier_reply_parse(*, tenant: Any, inquiry: Inquiry) -> StepResult:
    """Check if any carrier has replied to the freight inquiries."""
    from tenant_apps.carriers.models import CarrierFreightInquiry, CarrierFreightInquiryStatus

    inquiry.refresh_from_db()
    so = inquiry.sales_order
    if not so:
        return StepResult(
            step=OrchestratorStep.CARRIER_REPLY_PARSE,
            success=False,
            message="No sales order linked.",
        )

    replied = CarrierFreightInquiry.objects.filter(
        tenant=tenant,
        sales_order=so,
        status__in=[
            CarrierFreightInquiryStatus.REPLIED,
            CarrierFreightInquiryStatus.ACCEPTED,
        ],
    ).first()

    if replied:
        return StepResult(
            step=OrchestratorStep.CARRIER_REPLY_PARSE,
            success=True,
            message=f"Carrier reply received from {replied.carrier}.",
            entity_id=str(replied.id),
            entity_type="CarrierFreightInquiry",
        )

    return StepResult(
        step=OrchestratorStep.CARRIER_REPLY_PARSE,
        success=False,
        message="Waiting for carrier reply.",
    )


def _step_draft_carrier_po(*, tenant: Any, inquiry: Inquiry) -> StepResult:
    """Create or verify draft carrier PO from accepted freight inquiry."""
    from tenant_apps.purchase_orders.models import CarrierPurchaseOrder

    # Already linked?
    if inquiry.carrier_purchase_order_id:
        return StepResult(
            step=OrchestratorStep.DRAFT_CARRIER_PO,
            success=True,
            message="Carrier PO already linked (idempotent).",
            entity_id=str(inquiry.carrier_purchase_order_id),
            entity_type="CarrierPurchaseOrder",
        )

    # Look for a draft CPO linked to this SO's freight inquiries
    inquiry.refresh_from_db()
    so = inquiry.sales_order
    if not so:
        return StepResult(
            step=OrchestratorStep.DRAFT_CARRIER_PO,
            success=False,
            message="No sales order linked.",
        )

    cpo = CarrierPurchaseOrder.objects.filter(
        tenant=tenant,
        sales_order=so,
        status="draft",
    ).first()

    if cpo:
        inquiry.carrier_purchase_order = cpo
        inquiry.save(update_fields=["carrier_purchase_order", "modified_on"])
        return StepResult(
            step=OrchestratorStep.DRAFT_CARRIER_PO,
            success=True,
            message=f"Carrier PO linked: {cpo.our_carrier_po_num or cpo.id}",
            entity_id=str(cpo.id),
            entity_type="CarrierPurchaseOrder",
        )

    return StepResult(
        step=OrchestratorStep.DRAFT_CARRIER_PO,
        success=False,
        message="No draft carrier PO found. The carrier reply parser creates these automatically.",
    )


# ---------------------------------------------------------------------------
# State derivation helpers
# ---------------------------------------------------------------------------


def _derive_fulfill_state(inquiry: Inquiry) -> OrchestratorStep:
    """Derive state for a FULFILL-routed inquiry."""
    from tenant_apps.carriers.models import CarrierFreightInquiry, CarrierFreightInquiryStatus
    from tenant_apps.sales_orders.models import SalesOrderStatus

    if inquiry.carrier_purchase_order_id:
        return OrchestratorStep.COMPLETED

    so = inquiry.sales_order
    if so:
        so.refresh_from_db()
        if so.status in (SalesOrderStatus.APPROVED, SalesOrderStatus.COMPLETED):
            # Check carrier progress
            has_freight = CarrierFreightInquiry.objects.filter(
                tenant=inquiry.tenant, sales_order=so
            ).exists()
            if not has_freight:
                return OrchestratorStep.CARRIER_FAN_OUT

            has_reply = CarrierFreightInquiry.objects.filter(
                tenant=inquiry.tenant,
                sales_order=so,
                status__in=[
                    CarrierFreightInquiryStatus.REPLIED,
                    CarrierFreightInquiryStatus.ACCEPTED,
                ],
            ).exists()
            if not has_reply:
                return OrchestratorStep.CARRIER_REPLY_PARSE

            return OrchestratorStep.DRAFT_CARRIER_PO

        return OrchestratorStep.APPROVE_SALES_ORDER

    return OrchestratorStep.DRAFT_SALES_ORDER


def _derive_broker_state(inquiry: Inquiry) -> OrchestratorStep:
    """Derive state for a BROKER-routed inquiry."""
    from tenant_apps.purchase_orders.models import PurchaseOrderStatus

    po = inquiry.supplier_purchase_order
    if not po:
        rfqs = inquiry.supplier_rfqs.all()
        if not rfqs.exists():
            return OrchestratorStep.SUPPLIER_RFQ
        has_reply = rfqs.filter(status__in=["replied", "accepted"]).exists()
        if not has_reply:
            return OrchestratorStep.SUPPLIER_REPLY_PARSE
        return OrchestratorStep.DRAFT_SUPPLIER_PO

    po.refresh_from_db()
    if po.status != PurchaseOrderStatus.APPROVED:
        return OrchestratorStep.APPROVE_SUPPLIER_PO

    # From here, same as FULFILL
    return _derive_fulfill_state(inquiry)


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------


def _mark_inquiry_fulfilled(*, tenant: Any, inquiry: Inquiry) -> None:
    """Mark the inquiry as fulfilled when the orchestrator completes."""
    if inquiry.status != InquiryStatusChoices.FULFILLED:
        inquiry.status = InquiryStatusChoices.FULFILLED
        inquiry.modified_on = timezone.now()
        inquiry.save(update_fields=["status", "modified_on"])


def _emit_orchestrator_telemetry(
    *, tenant: Any, inquiry: Inquiry, event: str, step: OrchestratorStep
) -> None:
    """Emit structured telemetry for orchestrator state transitions."""
    logger.info(
        f"Telemetry: {event}",
        extra={
            "event_type": event,
            "tenant_id": str(tenant.id),
            "inquiry_id": str(inquiry.id),
            "step": step.value,
            "route": inquiry.route_decision or "unknown",
        },
    )
