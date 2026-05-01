"""Canonical retention and archive contract for GA governance work."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Final

RETENTION_YEARS: Final[int] = 7


@dataclass(frozen=True)
class ArchiveTarget:
    """A record class that becomes archive-eligible after the retention window."""

    model_label: str
    archive_class: str
    business_reason: str
    archive_after_years: int = RETENTION_YEARS
    legal_hold_required: bool = True
    restore_scope: str = "tenant-batch-operator-only"


@dataclass(frozen=True)
class ExemptionRule:
    """A record class that is intentionally excluded from GA-03.1 archive automation."""

    scope: str
    reason: str
    deferred_to: str | None = None


ARCHIVE_TARGETS: Final[tuple[ArchiveTarget, ...]] = (
    ArchiveTarget(
        model_label="tenant_apps.purchase_orders.models.PurchaseOrder",
        archive_class="transactional_header",
        business_reason="Supplier-facing commercial commitments must remain recoverable for audit and dispute handling.",
    ),
    ArchiveTarget(
        model_label="tenant_apps.purchase_orders.models.PurchaseOrderItem",
        archive_class="transactional_line_item",
        business_reason="Line-item economics must follow their parent purchase orders into the archive set.",
    ),
    ArchiveTarget(
        model_label="tenant_apps.purchase_orders.models.CarrierPurchaseOrder",
        archive_class="freight_order_header",
        business_reason="Freight commitments and delivery evidence remain part of the financial shipment record.",
    ),
    ArchiveTarget(
        model_label="tenant_apps.purchase_orders.models.CarrierPOItem",
        archive_class="freight_order_line_item",
        business_reason="Carrier PO line items must remain paired with archived freight-order headers.",
    ),
    ArchiveTarget(
        model_label="tenant_apps.sales_orders.models.SalesOrder",
        archive_class="transactional_header",
        business_reason="Customer-facing order history is part of the retained commercial ledger.",
    ),
    ArchiveTarget(
        model_label="tenant_apps.sales_orders.models.SalesOrderItem",
        archive_class="transactional_line_item",
        business_reason="Sales line items preserve margin and fulfillment context for retained order history.",
    ),
    ArchiveTarget(
        model_label="tenant_apps.invoices.models.Invoice",
        archive_class="financial_header",
        business_reason="Invoices are the primary 7-year retained settlement document.",
    ),
    ArchiveTarget(
        model_label="tenant_apps.invoices.models.InvoiceItem",
        archive_class="financial_line_item",
        business_reason="Invoice line items preserve the auditable price and quantity breakdown.",
    ),
    ArchiveTarget(
        model_label="tenant_apps.invoices.models.Claim",
        archive_class="financial_dispute",
        business_reason="Claims remain tied to invoice history for dispute-resolution evidence.",
    ),
    ArchiveTarget(
        model_label="tenant_apps.invoices.models.PaymentTransaction",
        archive_class="settlement_event",
        business_reason="Settlement records prove when and how invoices moved toward paid status.",
    ),
    ArchiveTarget(
        model_label="tenant_apps.fulfillments.models.Fulfillment",
        archive_class="logistics_execution",
        business_reason="Fulfillment records preserve delivery execution evidence tied to retained orders.",
    ),
    ArchiveTarget(
        model_label="tenant_apps.fulfillments.models.FulfillmentProduct",
        archive_class="logistics_execution_line_item",
        business_reason="Fulfillment products preserve shipped-quantity evidence for archived deliveries.",
    ),
    ArchiveTarget(
        model_label="tenant_apps.purchase_orders.models.ColdStorageEntry",
        archive_class="inventory_storage_event",
        business_reason="Cold-storage history remains part of the retained physical-goods chain of custody.",
    ),
)

EXEMPTION_RULES: Final[tuple[ExemptionRule, ...]] = (
    ExemptionRule(
        scope="tenant master data",
        reason="Customers, suppliers, carriers, contacts, plants, and locations stay live because archived transactions still reference them.",
        deferred_to="GA-03.2",
    ),
    ExemptionRule(
        scope="workflow definitions and execution telemetry",
        reason="Workflow/runtime records need a separate operational retention policy instead of the financial 7-year archive window.",
        deferred_to="GA-03.4",
    ),
    ExemptionRule(
        scope="AI documents, communications, and observability payloads",
        reason="Those records require centralized redaction rules before retention automation can safely classify them.",
        deferred_to="GA-03.3",
    ),
    ExemptionRule(
        scope="soft-deleted rows",
        reason="Soft-delete recovery remains distinct from archival restore and must not be conflated with 7-year archive actions.",
        deferred_to="GA-03.2",
    ),
)

LEGAL_HOLD_CONTRACT: Final[dict[str, object]] = {
    "status": "future-contract-only",
    "required_fields": (
        "tenant_id",
        "scope_model",
        "scope_selector",
        "reason_code",
        "placed_by",
        "placed_at",
        "released_by",
        "released_at",
    ),
    "behavior": (
        "Archive jobs must skip any record or batch selected by an active legal hold.",
        "Legal holds must preserve tenant isolation and remain visible in operator evidence.",
        "Release of a legal hold is a separate audited action and is not part of GA-03.1.",
    ),
}

RESTORE_CONTRACT: Final[dict[str, object]] = {
    "mode": "operator-only",
    "scope": "tenant-explicit batch restore",
    "requirements": (
        "restore requests must identify tenant ownership before any data is rehydrated",
        "restores must use archived batch manifests or equivalent evidence, not ad-hoc row edits",
        "soft-delete restore endpoints are not archival restore mechanisms",
        "restore execution remains deferred to GA-03.2 and later",
    ),
}

OPERATOR_EVIDENCE_FIELDS: Final[tuple[str, ...]] = (
    "tenant_id",
    "archive_batch_id",
    "retention_cutoff_date",
    "model_label",
    "record_count",
    "legal_hold_skips",
    "requested_by",
    "approved_by",
    "restored_by",
    "restored_at",
)


def get_retention_contract() -> dict[str, object]:
    """Return the immutable GA-03.1 retention contract as a serializable payload."""

    return {
        "retention_years": RETENTION_YEARS,
        "archive_targets": [asdict(target) for target in ARCHIVE_TARGETS],
        "exemptions": [asdict(rule) for rule in EXEMPTION_RULES],
        "legal_hold_contract": LEGAL_HOLD_CONTRACT,
        "restore_contract": RESTORE_CONTRACT,
        "operator_evidence_fields": OPERATOR_EVIDENCE_FIELDS,
    }
