"""Canonical retention and archive contract for GA governance work."""

from __future__ import annotations

import hashlib
import importlib
import json
from dataclasses import asdict, dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Final
from uuid import UUID

from django.db.models import Model, Q
from django.utils import timezone

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

ARCHIVE_TARGET_DETAILS: Final[dict[str, dict[str, object]]] = {
    "tenant_apps.purchase_orders.models.PurchaseOrder": {
        "eligibility_fields": ("order_date",),
        "select_related": (),
    },
    "tenant_apps.purchase_orders.models.PurchaseOrderItem": {
        "eligibility_fields": ("purchase_order__order_date",),
        "select_related": ("purchase_order",),
        "parent_relation": "purchase_order",
        "parent_model_label": "tenant_apps.purchase_orders.models.PurchaseOrder",
    },
    "tenant_apps.purchase_orders.models.CarrierPurchaseOrder": {
        "eligibility_fields": ("date_time_stamp_created",),
        "select_related": (),
    },
    "tenant_apps.purchase_orders.models.CarrierPOItem": {
        "eligibility_fields": ("carrier_purchase_order__date_time_stamp_created",),
        "select_related": ("carrier_purchase_order",),
        "parent_relation": "carrier_purchase_order",
        "parent_model_label": "tenant_apps.purchase_orders.models.CarrierPurchaseOrder",
    },
    "tenant_apps.sales_orders.models.SalesOrder": {
        "eligibility_fields": ("date_time_stamp",),
        "select_related": (),
    },
    "tenant_apps.sales_orders.models.SalesOrderItem": {
        "eligibility_fields": ("sales_order__date_time_stamp",),
        "select_related": ("sales_order",),
        "parent_relation": "sales_order",
        "parent_model_label": "tenant_apps.sales_orders.models.SalesOrder",
    },
    "tenant_apps.invoices.models.Invoice": {
        "eligibility_fields": ("date_time_stamp",),
        "select_related": (),
    },
    "tenant_apps.invoices.models.InvoiceItem": {
        "eligibility_fields": ("invoice__date_time_stamp",),
        "select_related": ("invoice",),
        "parent_relation": "invoice",
        "parent_model_label": "tenant_apps.invoices.models.Invoice",
    },
    "tenant_apps.invoices.models.Claim": {
        "eligibility_fields": ("resolution_date", "claim_date"),
        "select_related": (),
    },
    "tenant_apps.invoices.models.PaymentTransaction": {
        "eligibility_fields": ("payment_date",),
        "select_related": ("purchase_order", "sales_order", "invoice"),
    },
    "tenant_apps.fulfillments.models.Fulfillment": {
        "eligibility_fields": ("actual_delivery", "ship_date"),
        "select_related": (),
    },
    "tenant_apps.fulfillments.models.FulfillmentProduct": {
        "eligibility_fields": ("fulfillment__actual_delivery", "fulfillment__ship_date"),
        "select_related": ("fulfillment",),
        "parent_relation": "fulfillment",
        "parent_model_label": "tenant_apps.fulfillments.models.Fulfillment",
    },
    "tenant_apps.purchase_orders.models.ColdStorageEntry": {
        "eligibility_fields": ("date_time_stamp_created",),
        "select_related": ("supplier_po", "customer_sales_order"),
    },
}


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


def subtract_years(reference_date: date, *, years: int = RETENTION_YEARS) -> date:
    """Return a date shifted backward by the configured retention window."""

    try:
        return reference_date.replace(year=reference_date.year - years)
    except ValueError:
        # February 29th rolls back to February 28th for non-leap years.
        return reference_date.replace(month=2, day=28, year=reference_date.year - years)


def default_retention_cutoff(reference_date: date | None = None) -> date:
    """Return the default archive cutoff date for the retention window."""

    return subtract_years(reference_date or timezone.now().date())


def build_archive_command_options(
    *,
    model_label: str | None = None,
    limit: int | None = None,
    output_format: str = "text",
    execute: bool = False,
    requested_user_id: int | None = None,
    requested_email: str = "",
    approved_user_id: int | None = None,
    approved_email: str = "",
) -> dict[str, Any]:
    """Return the archive-command options persisted with a batch."""

    return {
        "model_label": model_label,
        "limit": limit,
        "format": output_format,
        "execute": execute,
        "requested_user_id": requested_user_id,
        "requested_email": requested_email,
        "approved_user_id": approved_user_id,
        "approved_email": approved_email,
    }


def build_archive_run_key(
    *,
    tenant_id: str,
    cutoff_date: date,
    command_options: dict[str, Any],
    mode: str,
) -> str:
    """Build a deterministic archive run key."""

    encoded = json.dumps(
        {
            "tenant_id": str(tenant_id),
            "cutoff_date": cutoff_date.isoformat(),
            "command_options": command_options,
            "mode": mode,
        },
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def get_or_start_archive_batch(
    *,
    tenant,
    cutoff_date: date,
    command_options: dict[str, Any],
    mode: str,
    requested_user=None,
    requested_email: str = "",
    approved_user=None,
    approved_email: str = "",
):
    """Create or reuse a restart-safe archive batch."""

    from apps.core.models import ArchiveBatch

    run_key = build_archive_run_key(
        tenant_id=str(tenant.id),
        cutoff_date=cutoff_date,
        command_options=command_options,
        mode=mode,
    )
    now = timezone.now()
    batch, created = ArchiveBatch.objects.get_or_create(
        tenant=tenant,
        run_key=run_key,
        defaults={
            "mode": mode,
            "status": ArchiveBatch.Status.RUNNING,
            "cutoff_date": cutoff_date,
            "command_options": command_options,
            "started_at": now,
            "requested_by": requested_user,
            "requested_by_email": requested_email,
            "approved_by": approved_user,
            "approved_by_email": approved_email,
        },
    )
    if not created:
        batch.mode = mode
        batch.status = ArchiveBatch.Status.RUNNING
        batch.cutoff_date = cutoff_date
        batch.command_options = command_options
        batch.failure_message = ""
        batch.completed_at = None
        batch.started_at = batch.started_at or now
        batch.requested_by = requested_user
        batch.requested_by_email = requested_email
        batch.approved_by = approved_user
        batch.approved_by_email = approved_email
        batch.save(
            update_fields=[
                "mode",
                "status",
                "cutoff_date",
                "command_options",
                "failure_message",
                "completed_at",
                "started_at",
                "requested_by",
                "requested_by_email",
                "approved_by",
                "approved_by_email",
                "modified_on",
            ]
        )
    return batch, created


def finalize_archive_batch(
    *,
    batch,
    summary: dict[str, Any],
    status: str,
    failure_message: str = "",
):
    """Persist the final archive batch summary."""

    batch.summary = summary
    batch.status = status
    batch.failure_message = failure_message
    batch.completed_at = timezone.now()
    batch.dry_run_record_count = int(summary.get("dry_run_record_count", 0))
    batch.archived_record_count = int(summary.get("archived_record_count", 0))
    batch.legal_hold_skip_count = int(summary.get("legal_hold_skip_count", 0))
    batch.save(
        update_fields=[
            "summary",
            "status",
            "failure_message",
            "completed_at",
            "dry_run_record_count",
            "archived_record_count",
            "legal_hold_skip_count",
            "modified_on",
        ]
    )
    return batch


def get_archive_target_details(model_label: str | None = None) -> list[dict[str, Any]]:
    """Return executable archive target details in the canonical order."""

    ordered = []
    for target in ARCHIVE_TARGETS:
        if model_label and target.model_label != model_label:
            continue
        detail = ARCHIVE_TARGET_DETAILS.get(target.model_label)
        if detail is None:
            raise ValueError(f"Archive target {target.model_label} is missing execution details.")
        ordered.append(
            {
                "model_label": target.model_label,
                "archive_class": target.archive_class,
                "business_reason": target.business_reason,
                **detail,
            }
        )
    if model_label and not ordered:
        raise ValueError(f"Unsupported archive target: {model_label}")
    return ordered


def resolve_model_from_label(model_label: str):
    """Resolve a canonical module-path model label into a Django model class."""

    module_path, class_name = model_label.rsplit(".", 1)
    module = importlib.import_module(module_path)
    return getattr(module, class_name)


def build_eligibility_q(fields: tuple[str, ...], cutoff_date: date) -> Q:
    """Build a first-non-null cutoff filter for one archive target."""

    query = Q()
    prior_null = Q()
    for field_name in fields:
        query |= prior_null & Q(**{f"{field_name}__isnull": False, f"{field_name}__lte": cutoff_date})
        prior_null &= Q(**{f"{field_name}__isnull": True})
    return query


def resolve_retention_basis_date(instance: Model, field_names: tuple[str, ...]) -> date | None:
    """Return the first non-null retention basis date for a model instance."""

    for field_name in field_names:
        value = resolve_attr(instance, field_name)
        if value is None:
            continue
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
    return None


def resolve_attr(instance: Model, field_name: str) -> Any:
    """Resolve a Django-style `__` attribute path from a model instance."""

    current: Any = instance
    for part in field_name.split("__"):
        if current is None:
            return None
        current = getattr(current, part, None)
    return current


def normalize_snapshot_value(value: Any) -> Any:
    """Convert model field values into JSON-safe archive payloads."""

    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, list):
        return [normalize_snapshot_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): normalize_snapshot_value(item) for key, item in value.items()}
    return value


def build_snapshot_payload(instance: Model, *, model_label: str, retention_basis_date: date | None) -> dict[str, Any]:
    """Build a JSON-safe archive snapshot payload for one model instance."""

    field_values: dict[str, Any] = {}
    for field in instance._meta.concrete_fields:
        field_values[field.attname] = normalize_snapshot_value(getattr(instance, field.attname))

    return {
        "model_label": model_label,
        "object_pk": str(instance.pk),
        "retention_basis_date": retention_basis_date.isoformat() if retention_basis_date else None,
        "field_values": field_values,
    }


def checksum_snapshot_payload(payload: dict[str, Any]) -> str:
    """Create a stable checksum for a snapshot payload."""

    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def upsert_archive_snapshot(
    *,
    batch,
    tenant,
    model_label: str,
    archive_class: str,
    instance: Model,
    retention_basis_date: date | None,
    parent_model_label: str = "",
    parent_object_pk: str = "",
):
    """Insert or update one archive snapshot row."""

    from apps.core.models import ArchiveRecordSnapshot

    payload = build_snapshot_payload(
        instance,
        model_label=model_label,
        retention_basis_date=retention_basis_date,
    )
    checksum = checksum_snapshot_payload(payload)
    snapshot, _ = ArchiveRecordSnapshot.objects.update_or_create(
        tenant=tenant,
        batch=batch,
        model_label=model_label,
        object_pk=str(instance.pk),
        defaults={
            "archive_class": archive_class,
            "retention_basis_date": retention_basis_date,
            "parent_model_label": parent_model_label,
            "parent_object_pk": parent_object_pk,
            "snapshot_payload": payload,
            "payload_checksum": checksum,
        },
    )
    return snapshot


def get_active_legal_holds(*, tenant):
    """Return active legal holds for one tenant."""

    from apps.core.models import ArchiveLegalHold

    return list(ArchiveLegalHold.objects.filter(tenant=tenant, released_at__isnull=True))


def hold_matches_instance(hold, *, model_label: str, object_pk: Any, parent_model_label: str = "", parent_object_pk: Any = None) -> bool:
    """Return True when a legal hold applies to an archive candidate."""

    selector = hold.scope_selector or {}
    if hold.scope_model == model_label and selector.get("all_records") is True:
        return True

    object_ids = {str(value) for value in selector.get("object_ids", [])}
    if hold.scope_model == model_label and str(object_pk) in object_ids:
        return True
    if parent_model_label and hold.scope_model == parent_model_label and parent_object_pk is not None:
        return str(parent_object_pk) in object_ids
    return False


def execute_archive_run(
    *,
    tenant,
    cutoff_date: date,
    command_options: dict[str, Any],
    execute: bool,
    requested_user=None,
    requested_email: str = "",
    approved_user=None,
    approved_email: str = "",
) -> dict[str, Any]:
    """Run a dry-run or execute-mode archive batch against the retention contract."""

    from apps.core.models import ArchiveBatch

    mode = ArchiveBatch.Mode.EXECUTE if execute else ArchiveBatch.Mode.DRY_RUN
    batch, _ = get_or_start_archive_batch(
        tenant=tenant,
        cutoff_date=cutoff_date,
        command_options=command_options,
        mode=mode,
        requested_user=requested_user,
        requested_email=requested_email,
        approved_user=approved_user,
        approved_email=approved_email,
    )
    holds = get_active_legal_holds(tenant=tenant)
    limit = command_options.get("limit")
    remaining = int(limit) if limit is not None else None

    summary = {
        "mode": mode,
        "cutoff_date": cutoff_date.isoformat(),
        "dry_run_record_count": 0,
        "archived_record_count": 0,
        "legal_hold_skip_count": 0,
        "model_summaries": [],
    }

    try:
        for target in get_archive_target_details(command_options.get("model_label")):
            model = resolve_model_from_label(target["model_label"])
            queryset = model.objects.filter(tenant=tenant)

            parent_relation = str(target.get("parent_relation") or "")
            if hasattr(model, "is_deleted"):
                queryset = queryset.filter(is_deleted=False)
            elif parent_relation:
                related_model = model._meta.get_field(parent_relation).related_model
                if hasattr(related_model, "is_deleted"):
                    queryset = queryset.filter(**{f"{parent_relation}__is_deleted": False})

            eligibility_fields = tuple(target["eligibility_fields"])
            queryset = queryset.filter(build_eligibility_q(eligibility_fields, cutoff_date))

            select_related_fields = tuple(target.get("select_related") or ())
            if select_related_fields:
                queryset = queryset.select_related(*select_related_fields)

            processed_for_model = 0
            skipped_for_hold = 0
            archived_for_model = 0

            for instance in queryset.iterator():
                if remaining is not None and remaining <= 0:
                    break

                retention_basis = resolve_retention_basis_date(instance, eligibility_fields)
                parent_model_label = str(target.get("parent_model_label") or "")
                parent_object_pk = None
                if parent_relation:
                    parent = getattr(instance, parent_relation, None)
                    parent_object_pk = getattr(parent, "pk", None)

                if any(
                    hold_matches_instance(
                        hold,
                        model_label=target["model_label"],
                        object_pk=instance.pk,
                        parent_model_label=parent_model_label,
                        parent_object_pk=parent_object_pk,
                    )
                    for hold in holds
                ):
                    skipped_for_hold += 1
                    summary["legal_hold_skip_count"] += 1
                    continue

                processed_for_model += 1
                if execute:
                    upsert_archive_snapshot(
                        batch=batch,
                        tenant=tenant,
                        model_label=target["model_label"],
                        archive_class=str(target["archive_class"]),
                        instance=instance,
                        retention_basis_date=retention_basis,
                        parent_model_label=parent_model_label,
                        parent_object_pk="" if parent_object_pk is None else str(parent_object_pk),
                    )
                    archived_for_model += 1
                    summary["archived_record_count"] += 1
                else:
                    summary["dry_run_record_count"] += 1

                if remaining is not None:
                    remaining -= 1

            summary["model_summaries"].append(
                {
                    "model_label": target["model_label"],
                    "archive_class": target["archive_class"],
                    "eligible_record_count": processed_for_model,
                    "legal_hold_skip_count": skipped_for_hold,
                    "archived_record_count": archived_for_model,
                    "dry_run_record_count": processed_for_model if not execute else 0,
                }
            )

            if remaining is not None and remaining <= 0:
                break
    except Exception as exc:
        finalize_archive_batch(
            batch=batch,
            summary=summary,
            status=ArchiveBatch.Status.FAILED,
            failure_message=str(exc),
        )
        raise

    finalize_archive_batch(
        batch=batch,
        summary=summary,
        status=ArchiveBatch.Status.COMPLETED,
    )

    return {
        "tenant_id": str(tenant.id),
        "tenant_slug": tenant.slug,
        "cutoff_date": cutoff_date.isoformat(),
        "batch_run": {
            "batch_id": str(batch.id),
            "run_key": batch.run_key,
            "mode": batch.mode,
            "status": batch.status,
            "summary": batch.summary,
        },
    }
