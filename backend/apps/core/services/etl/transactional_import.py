"""Write-capable transactional ETL pass for GA-01.4."""

from __future__ import annotations

from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from django.db import transaction

from tenant_apps.contacts.models import Contact
from tenant_apps.invoices.models import Invoice, InvoiceItem
from tenant_apps.locations.models import Location
from tenant_apps.purchase_orders.models import CarrierPOItem, CarrierPurchaseOrder, PurchaseOrder, PurchaseOrderItem
from tenant_apps.sales_orders.models import SalesOrder, SalesOrderItem

from apps.core.models import ETLImportBatch, ETLImportRowJournal
from apps.system.models import Product

from .context import etl_execution_context
from .contracts import ENTITY_CONTRACTS, SIDE_EFFECT_SUPPRESSION_RULES, BatchManifest, build_contract_preview
from .journal import (
    build_command_options,
    checksum_manifest_payload,
    finalize_batch,
    get_or_start_batch,
    upsert_row_journal,
)
from .master_data_import import (
    PreparedRow,
    RowPreparationError,
    _build_row_fingerprint,
    _normalize_bool,
    _normalize_choice,
    _normalize_date,
    _normalize_decimal,
    _normalize_int,
    _normalize_optional_choice,
    _normalize_payload,
    _planned_action,
    _required,
    _resolve_actor,
    _resolve_carrier,
    _resolve_customer,
    _resolve_location,
    _resolve_supplier,
    _value,
    _values_equal,
)
from .runtime import LoadedSourceRow, load_source_rows

TRANSACTION_APPLY_ORDER = (
    "purchase_orders",
    "purchase_order_items",
    "sales_orders",
    "sales_order_items",
    "carrier_purchase_orders",
    "carrier_po_items",
    "invoices",
    "invoice_items",
)


def execute_transaction_import(
    manifest: BatchManifest,
    *,
    manifest_payload: dict[str, Any],
    manifest_path: str | Path,
    resolved_tenant,
    entity: str | None = None,
    limit: int | None = None,
    output_format: str = "text",
    actor_user_id: int | None = None,
    actor_email: str | None = None,
) -> dict[str, Any]:
    """Execute the write-capable transactional ETL import pass."""

    manifest_dir = Path(manifest_path).resolve().parent
    actor = _resolve_actor(actor_user_id)
    effective_actor_email = actor_email or getattr(actor, "email", "") or ""
    command_options = build_command_options(
        entity=entity,
        limit=limit,
        output_format=output_format,
        apply=True,
        execution_mode=ETLImportBatch.Mode.APPLY_TRANSACTIONS,
        actor_user_id=actor_user_id,
        actor_email=effective_actor_email,
    )
    manifest_checksum = checksum_manifest_payload(manifest_payload)
    batch, created = get_or_start_batch(
        tenant=resolved_tenant,
        manifest_payload=manifest_payload,
        manifest_checksum=manifest_checksum,
        command_options=command_options,
        mode=ETLImportBatch.Mode.APPLY_TRANSACTIONS,
    )
    preview = build_contract_preview(manifest, resolved_tenant=resolved_tenant)

    try:
        with etl_execution_context(
            tenant=resolved_tenant,
            actor=actor,
            actor_email=effective_actor_email,
            suppress_external_side_effects=True,
        ):
            summary, entity_summaries, processed_rows, resume_cursor, error_report = _process_manifest(
                manifest,
                manifest_dir=manifest_dir,
                resolved_tenant=resolved_tenant,
                actor=actor,
                batch=batch,
                entity_filter=entity,
                limit=limit,
            )
        finalize_batch(
            batch=batch,
            summary=summary,
            resume_cursor=resume_cursor,
            status=ETLImportBatch.Status.COMPLETED,
        )
    except Exception as exc:
        finalize_batch(
            batch=batch,
            summary={},
            resume_cursor={},
            status=ETLImportBatch.Status.FAILED,
            failure_message=str(exc),
        )
        raise

    preview.update(
        {
            "batch_run": {
                "batch_id": str(batch.id),
                "run_key": batch.run_key,
                "created": created,
                "status": batch.status,
                "mode": batch.mode,
                "execution_mode": ETLImportBatch.Mode.APPLY_TRANSACTIONS,
                "manifest_checksum": manifest_checksum,
                "command_options": command_options,
                "summary": summary,
                "resume_cursor": resume_cursor,
            },
            "entity_results": entity_summaries,
            "row_journal_count": processed_rows,
            "error_report": error_report,
        }
    )
    return preview


def _process_manifest(
    manifest: BatchManifest,
    *,
    manifest_dir: Path,
    resolved_tenant,
    actor,
    batch: ETLImportBatch,
    entity_filter: str | None,
    limit: int | None,
) -> tuple[dict[str, Any], list[dict[str, Any]], int, dict[str, Any], list[dict[str, Any]]]:
    selected_entities = _selected_entities(manifest, entity_filter=entity_filter)
    source_map: dict[str, list[Any]] = defaultdict(list)
    for source in manifest.sources:
        source_map[source.entity].append(source)

    counters = Counter()
    entity_counts: dict[str, Counter] = defaultdict(Counter)
    processed_rows = 0
    resume_cursor: dict[str, Any] = {}
    error_report: list[dict[str, Any]] = []

    for entity_name in selected_entities:
        for source in source_map.get(entity_name, []):
            loaded_rows = load_source_rows(source, manifest_dir=manifest_dir)
            for loaded_row in loaded_rows:
                if limit is not None and processed_rows >= int(limit):
                    break

                with transaction.atomic():
                    row_result = _apply_row(loaded_row, tenant=resolved_tenant, actor=actor)
                    upsert_row_journal(batch=batch, tenant=resolved_tenant, row_result=row_result)

                planned_action = row_result["planned_action"]
                counters["total_rows"] += 1
                counters["processed_rows"] += 1
                counters[planned_action] += 1
                entity_counts[row_result["entity"]]["rows"] += 1
                entity_counts[row_result["entity"]][planned_action] += 1

                if planned_action == ETLImportRowJournal.PlannedAction.ERROR:
                    error_report.append(
                        {
                            "entity": row_result["entity"],
                            "source_path": row_result["source_path"],
                            "source_sheet": row_result["source_sheet"],
                            "source_row_number": row_result["source_row_number"],
                            "source_identifier": row_result["source_identifier"],
                            "error_code": row_result["error_code"],
                            "error_message": row_result["error_message"],
                            "canonical_field": "",
                        }
                    )

                processed_rows += 1
                resume_cursor = {
                    "entity": row_result["entity"],
                    "source_path": row_result["source_path"],
                    "source_sheet": row_result["source_sheet"],
                    "source_row_number": row_result["source_row_number"],
                }

            if limit is not None and processed_rows >= int(limit):
                break
        if limit is not None and processed_rows >= int(limit):
            break

    summary = {
        "total_rows": counters["total_rows"],
        "processed_rows": counters["processed_rows"],
        "would_create_count": counters[ETLImportRowJournal.PlannedAction.WOULD_CREATE],
        "would_update_count": counters[ETLImportRowJournal.PlannedAction.WOULD_UPDATE],
        "would_skip_count": counters[ETLImportRowJournal.PlannedAction.WOULD_SKIP],
        "error_count": counters[ETLImportRowJournal.PlannedAction.ERROR],
        "created_count": counters[ETLImportRowJournal.PlannedAction.WOULD_CREATE],
        "updated_count": counters[ETLImportRowJournal.PlannedAction.WOULD_UPDATE],
        "skipped_count": counters[ETLImportRowJournal.PlannedAction.WOULD_SKIP],
    }
    entity_summaries = [
        {
            "entity": entity_name,
            "row_count": counter["rows"],
            "would_create_count": counter[ETLImportRowJournal.PlannedAction.WOULD_CREATE],
            "would_update_count": counter[ETLImportRowJournal.PlannedAction.WOULD_UPDATE],
            "would_skip_count": counter[ETLImportRowJournal.PlannedAction.WOULD_SKIP],
            "error_count": counter[ETLImportRowJournal.PlannedAction.ERROR],
            "created_count": counter[ETLImportRowJournal.PlannedAction.WOULD_CREATE],
            "updated_count": counter[ETLImportRowJournal.PlannedAction.WOULD_UPDATE],
            "skipped_count": counter[ETLImportRowJournal.PlannedAction.WOULD_SKIP],
        }
        for entity_name, counter in entity_counts.items()
    ]
    return summary, entity_summaries, processed_rows, resume_cursor, error_report


def _selected_entities(manifest: BatchManifest, *, entity_filter: str | None) -> tuple[str, ...]:
    declared_entities = tuple(dict.fromkeys(source.entity for source in manifest.sources))
    if entity_filter:
        if entity_filter not in TRANSACTION_APPLY_ORDER:
            raise ValueError(f"Apply mode currently supports only transactional entities, not '{entity_filter}'.")
        if entity_filter not in declared_entities:
            raise ValueError(f"Entity '{entity_filter}' is not declared in the batch manifest.")
        return (entity_filter,)

    unsupported = [entity for entity in declared_entities if entity not in TRANSACTION_APPLY_ORDER]
    if unsupported:
        joined = ", ".join(sorted(unsupported))
        raise ValueError(
            "Transactional apply mode currently supports only transactional entities; "
            f"unsupported sources detected: {joined}."
        )

    return tuple(entity for entity in TRANSACTION_APPLY_ORDER if entity in declared_entities)


def _apply_row(loaded_row: LoadedSourceRow, *, tenant, actor) -> dict[str, Any]:
    contract = ENTITY_CONTRACTS[loaded_row.entity]
    normalized_payload = _normalize_payload(loaded_row.payload)
    row_fingerprint = _build_row_fingerprint(loaded_row.entity, loaded_row.source_path, loaded_row.payload)

    try:
        prepared = _prepare_row(loaded_row, tenant=tenant, actor=actor, normalized_payload=normalized_payload)
        planned_action = _planned_action(prepared)
        target_identifier = str(prepared.matched_instance.pk) if prepared.matched_instance else ""

        if planned_action == ETLImportRowJournal.PlannedAction.WOULD_CREATE:
            instance = _create_instance(prepared, tenant=tenant)
            target_identifier = str(instance.pk)
        elif planned_action == ETLImportRowJournal.PlannedAction.WOULD_UPDATE:
            instance = _update_instance(prepared)
            target_identifier = str(instance.pk)

        return {
            "entity": loaded_row.entity,
            "source_path": loaded_row.source_path,
            "source_sheet": loaded_row.source_sheet or "",
            "source_row_number": loaded_row.source_row_number,
            "source_identifier": prepared.source_identifier,
            "normalized_lookup_key": prepared.lookup_key,
            "row_fingerprint": row_fingerprint,
            "planned_action": planned_action,
            "target_model": prepared.target_model,
            "target_identifier": target_identifier,
            "status": ETLImportRowJournal.Status.PLANNED,
            "error_code": "",
            "error_message": "",
            "side_effects_suppressed": list(SIDE_EFFECT_SUPPRESSION_RULES),
            "raw_payload": loaded_row.payload,
            "normalized_payload": normalized_payload,
            "warnings": prepared.warnings,
        }
    except RowPreparationError as exc:
        return {
            "entity": loaded_row.entity,
            "source_path": loaded_row.source_path,
            "source_sheet": loaded_row.source_sheet or "",
            "source_row_number": loaded_row.source_row_number,
            "source_identifier": "",
            "normalized_lookup_key": "",
            "row_fingerprint": row_fingerprint,
            "planned_action": ETLImportRowJournal.PlannedAction.ERROR,
            "target_model": contract.target_model,
            "target_identifier": "",
            "status": ETLImportRowJournal.Status.ERROR,
            "error_code": exc.code,
            "error_message": str(exc),
            "side_effects_suppressed": list(SIDE_EFFECT_SUPPRESSION_RULES),
            "raw_payload": loaded_row.payload,
            "normalized_payload": normalized_payload,
            "warnings": [],
        }


def _prepare_row(loaded_row: LoadedSourceRow, *, tenant, actor, normalized_payload: dict[str, Any]) -> PreparedRow:
    dispatch = {
        "purchase_orders": _prepare_purchase_order,
        "purchase_order_items": _prepare_purchase_order_item,
        "sales_orders": _prepare_sales_order,
        "sales_order_items": _prepare_sales_order_item,
        "carrier_purchase_orders": _prepare_carrier_purchase_order,
        "carrier_po_items": _prepare_carrier_po_item,
        "invoices": _prepare_invoice,
        "invoice_items": _prepare_invoice_item,
    }
    try:
        handler = dispatch[loaded_row.entity]
    except KeyError as exc:
        raise RowPreparationError(
            "unsupported_entity", f"Unsupported transactional entity '{loaded_row.entity}'."
        ) from exc
    return handler(normalized_payload, tenant=tenant, actor=actor)


def _create_instance(prepared: PreparedRow, *, tenant):
    model_class = _resolve_model_class(prepared.entity)
    return model_class.objects.create(tenant=tenant, **prepared.defaults)


def _update_instance(prepared: PreparedRow):
    instance = prepared.matched_instance
    changed_fields: list[str] = []
    for field_name, value in prepared.defaults.items():
        if _values_equal(getattr(instance, field_name), value):
            continue
        setattr(instance, field_name, value)
        changed_fields.append(field_name)
    if changed_fields:
        instance.save(
            update_fields=changed_fields + ["updated_at"] if hasattr(instance, "updated_at") else changed_fields
        )
    return instance


def _resolve_model_class(entity: str):
    mapping = {
        "purchase_orders": PurchaseOrder,
        "purchase_order_items": PurchaseOrderItem,
        "sales_orders": SalesOrder,
        "sales_order_items": SalesOrderItem,
        "carrier_purchase_orders": CarrierPurchaseOrder,
        "carrier_po_items": CarrierPOItem,
        "invoices": Invoice,
        "invoice_items": InvoiceItem,
    }
    return mapping[entity]


def _prepare_purchase_order(payload: dict[str, Any], *, tenant, actor) -> PreparedRow:
    order_number = _required(payload, "order_number", "our_purchase_order_number_to_supplier", "our_purchase_order_num")
    supplier = _resolve_supplier(payload, tenant=tenant)
    carrier = _resolve_carrier(payload, tenant=tenant, required=False)
    pick_up_location = _resolve_pickup_location(payload, tenant=tenant)
    delivery_location = _resolve_delivery_location(payload, tenant=tenant)
    plant = _resolve_plant_location(payload, tenant=tenant, required=False)
    product = _resolve_product(payload, required=False)
    contact = _resolve_primary_contact(payload, tenant=tenant, required=False)
    defaults = {
        "order_number": order_number,
        "supplier": supplier,
        "carrier": carrier,
        "product": product,
        "plant": plant,
        "pick_up_location": pick_up_location,
        "delivery_location": delivery_location,
        "contact": contact,
        "order_date": _normalize_date(payload.get("order_date"), "order_date", required=True),
        "status": _normalize_choice(
            payload.get("status", PurchaseOrder._meta.get_field("status").default),
            PurchaseOrder._meta.get_field("status").choices,
            "status",
        ),
        "payment_status": _normalize_choice(
            payload.get("payment_status", PurchaseOrder._meta.get_field("payment_status").default),
            PurchaseOrder._meta.get_field("payment_status").choices,
            "payment_status",
        ),
        "total_amount": _normalize_decimal(payload.get("total_amount"), "total_amount"),
        "outstanding_amount": _normalize_decimal(payload.get("outstanding_amount"), "outstanding_amount"),
        "notes": _value(payload, "notes"),
        "our_purchase_order_number_to_supplier": _value(payload, "our_purchase_order_number_to_supplier")
        or order_number,
        "my_customer_number_from_supplier": _value(payload, "my_customer_number_from_supplier"),
        "supplier_confirmation_order_number": _value(
            payload,
            "supplier_confirmation_order_number",
            "supplier_confirmation_order_num",
        ),
        "payment_terms": _normalize_optional_choice(
            payload.get("payment_terms"),
            PurchaseOrder._meta.get_field("payment_terms").choices,
            "payment_terms",
        ),
        "credit_limit": _normalize_optional_choice(
            payload.get("credit_limit"),
            PurchaseOrder._meta.get_field("credit_limit").choices,
            "credit_limit",
        ),
        "quantity": _normalize_int(payload.get("quantity"), "quantity"),
        "total_weight": _normalize_decimal(payload.get("total_weight"), "total_weight"),
        "weight_unit": _normalize_choice(
            payload.get("weight_unit", PurchaseOrder._meta.get_field("weight_unit").default),
            PurchaseOrder._meta.get_field("weight_unit").choices,
            "weight_unit",
        ),
        "price_per_unit": _normalize_decimal(payload.get("price_per_unit"), "price_per_unit"),
        "type_of_protein": _normalize_optional_choice(
            payload.get("type_of_protein"),
            PurchaseOrder._meta.get_field("type_of_protein").choices,
            "type_of_protein",
        ),
        "fresh_or_frozen": _normalize_optional_choice(
            payload.get("fresh_or_frozen"),
            PurchaseOrder._meta.get_field("fresh_or_frozen").choices,
            "fresh_or_frozen",
        ),
        "package_type": _normalize_optional_choice(
            payload.get("package_type"),
            PurchaseOrder._meta.get_field("package_type").choices,
            "package_type",
        ),
        "net_or_catch": _normalize_optional_choice(
            payload.get("net_or_catch"),
            PurchaseOrder._meta.get_field("net_or_catch").choices,
            "net_or_catch",
        ),
        "edible_or_inedible": _normalize_optional_choice(
            payload.get("edible_or_inedible"),
            PurchaseOrder._meta.get_field("edible_or_inedible").choices,
            "edible_or_inedible",
        ),
        "item_description": _value(payload, "item_description"),
        "special_instructions": _value(payload, "special_instructions"),
        **_logistics_defaults(payload, model_class=PurchaseOrder),
        **_billing_snapshot_defaults(payload),
        **_shipping_snapshot_defaults(payload),
    }
    matched = PurchaseOrder.objects.filter(tenant=tenant, order_number=order_number).order_by("pk").first()
    identifier = f"order_number={order_number}"
    return PreparedRow(
        entity="purchase_orders",
        target_model=ENTITY_CONTRACTS["purchase_orders"].target_model,
        source_identifier=identifier,
        lookup_key=identifier,
        matched_instance=matched,
        defaults=defaults,
        warnings=[],
    )


def _prepare_purchase_order_item(payload: dict[str, Any], *, tenant, actor) -> PreparedRow:
    purchase_order = _resolve_purchase_order(payload, tenant=tenant)
    line_number = _normalize_int(payload.get("line_number"), "line_number", required=True)
    defaults = {
        "purchase_order": purchase_order,
        "line_number": line_number,
        "notes": _value(payload, "notes"),
        **_line_item_defaults(payload, model_class=PurchaseOrderItem),
    }
    matched = (
        PurchaseOrderItem.objects.filter(
            tenant=tenant,
            purchase_order=purchase_order,
            line_number=line_number,
        )
        .order_by("pk")
        .first()
    )
    identifier = f"purchase_order={purchase_order.order_number}|line_number={line_number}"
    return PreparedRow(
        entity="purchase_order_items",
        target_model=ENTITY_CONTRACTS["purchase_order_items"].target_model,
        source_identifier=identifier,
        lookup_key=identifier,
        matched_instance=matched,
        defaults=defaults,
        warnings=[],
    )


def _prepare_sales_order(payload: dict[str, Any], *, tenant, actor) -> PreparedRow:
    sales_order_number = _required(
        payload, "our_sales_order_number_for_customer", "our_sales_order_num", "sales_order_number"
    )
    supplier = _resolve_supplier(payload, tenant=tenant)
    customer = _resolve_customer(payload, tenant=tenant)
    carrier = _resolve_carrier(payload, tenant=tenant, required=False)
    pick_up_location = _resolve_pickup_location(payload, tenant=tenant)
    delivery_location = _resolve_delivery_location(payload, tenant=tenant)
    plant = _resolve_plant_location(payload, tenant=tenant, required=False)
    product = _resolve_product(payload, required=False)
    contact = _resolve_primary_contact(payload, tenant=tenant, required=False)
    defaults = {
        "our_sales_order_num": sales_order_number,
        "our_sales_order_number_for_customer": _value(payload, "our_sales_order_number_for_customer")
        or sales_order_number,
        "delivery_po_number": _value(payload, "delivery_po_number", "delivery_po_num"),
        "supplier": supplier,
        "customer": customer,
        "carrier": carrier,
        "product": product,
        "plant": plant,
        "pick_up_location": pick_up_location,
        "delivery_location": delivery_location,
        "contact": contact,
        "status": _normalize_choice(
            payload.get("status", SalesOrder._meta.get_field("status").default),
            SalesOrder._meta.get_field("status").choices,
            "status",
        ),
        "payment_status": _normalize_choice(
            payload.get("payment_status", SalesOrder._meta.get_field("payment_status").default),
            SalesOrder._meta.get_field("payment_status").choices,
            "payment_status",
        ),
        "total_amount": _normalize_decimal(payload.get("total_amount"), "total_amount"),
        "outstanding_amount": _normalize_decimal(payload.get("outstanding_amount"), "outstanding_amount"),
        "notes": _value(payload, "notes"),
        "quantity": _normalize_int(payload.get("quantity"), "quantity"),
        "total_weight": _normalize_decimal(payload.get("total_weight"), "total_weight"),
        "weight_unit": _normalize_choice(
            payload.get("weight_unit", SalesOrder._meta.get_field("weight_unit").default),
            SalesOrder._meta.get_field("weight_unit").choices,
            "weight_unit",
        ),
        "plant_est_number": _value(payload, "plant_est_number"),
        **_logistics_defaults(payload, model_class=SalesOrder),
        **_billing_snapshot_defaults(payload),
        **_shipping_snapshot_defaults(payload),
    }
    matched = SalesOrder.objects.filter(tenant=tenant, our_sales_order_num=sales_order_number).order_by("pk").first()
    identifier = f"our_sales_order_num={sales_order_number}"
    return PreparedRow(
        entity="sales_orders",
        target_model=ENTITY_CONTRACTS["sales_orders"].target_model,
        source_identifier=identifier,
        lookup_key=identifier,
        matched_instance=matched,
        defaults=defaults,
        warnings=[],
    )


def _prepare_sales_order_item(payload: dict[str, Any], *, tenant, actor) -> PreparedRow:
    sales_order = _resolve_sales_order(payload, tenant=tenant)
    line_number = _normalize_int(payload.get("line_number"), "line_number", required=True)
    defaults = {
        "sales_order": sales_order,
        "line_number": line_number,
        "notes": _value(payload, "notes"),
        **_line_item_defaults(payload, model_class=SalesOrderItem),
    }
    matched = (
        SalesOrderItem.objects.filter(
            tenant=tenant,
            sales_order=sales_order,
            line_number=line_number,
        )
        .order_by("pk")
        .first()
    )
    identifier = f"sales_order={sales_order.our_sales_order_num}|line_number={line_number}"
    return PreparedRow(
        entity="sales_order_items",
        target_model=ENTITY_CONTRACTS["sales_order_items"].target_model,
        source_identifier=identifier,
        lookup_key=identifier,
        matched_instance=matched,
        defaults=defaults,
        warnings=[],
    )


def _prepare_carrier_purchase_order(payload: dict[str, Any], *, tenant, actor) -> PreparedRow:
    carrier_po_number = _required(payload, "our_carrier_po_num", "carrier_purchase_order_number")
    carrier = _resolve_carrier(payload, tenant=tenant)
    supplier = _resolve_supplier(payload, tenant=tenant)
    linked_order = _resolve_purchase_order(
        payload, tenant=tenant, required=False, names=("linked_order_number", "purchase_order_number")
    )
    sales_order = _resolve_sales_order(payload, tenant=tenant, required=False)
    pick_up_location = _resolve_pickup_location(payload, tenant=tenant)
    delivery_location = _resolve_delivery_location(payload, tenant=tenant)
    plant = _resolve_plant_location(payload, tenant=tenant, required=False)
    product = _resolve_product(payload, required=False)
    defaults = {
        "our_carrier_po_num": carrier_po_number,
        "carrier": carrier,
        "supplier": supplier,
        "linked_order": linked_order,
        "sales_order": sales_order,
        "plant": plant,
        "pick_up_location": pick_up_location,
        "delivery_location": delivery_location,
        "product": product,
        "status": _normalize_choice(
            payload.get("status", CarrierPurchaseOrder._meta.get_field("status").default),
            CarrierPurchaseOrder._meta.get_field("status").choices,
            "status",
        ),
        "carrier_name": _value(payload, "carrier_name") or carrier.name,
        "payment_terms": _normalize_optional_choice(
            payload.get("payment_terms"),
            CarrierPurchaseOrder._meta.get_field("payment_terms").choices,
            "payment_terms",
        ),
        "credit_limits": _normalize_optional_choice(
            payload.get("credit_limit", payload.get("credit_limits")),
            CarrierPurchaseOrder._meta.get_field("credit_limits").choices,
            "credit_limits",
        ),
        "type_of_protein": _normalize_optional_choice(
            payload.get("type_of_protein"),
            CarrierPurchaseOrder._meta.get_field("type_of_protein").choices,
            "type_of_protein",
        ),
        "fresh_or_frozen": _normalize_optional_choice(
            payload.get("fresh_or_frozen"),
            CarrierPurchaseOrder._meta.get_field("fresh_or_frozen").choices,
            "fresh_or_frozen",
        ),
        "package_type": _normalize_optional_choice(
            payload.get("package_type"),
            CarrierPurchaseOrder._meta.get_field("package_type").choices,
            "package_type",
        ),
        "net_or_catch": _normalize_optional_choice(
            payload.get("net_or_catch"),
            CarrierPurchaseOrder._meta.get_field("net_or_catch").choices,
            "net_or_catch",
        ),
        "edible_or_inedible": _normalize_optional_choice(
            payload.get("edible_or_inedible"),
            CarrierPurchaseOrder._meta.get_field("edible_or_inedible").choices,
            "edible_or_inedible",
        ),
        "total_weight": _normalize_decimal(payload.get("total_weight"), "total_weight"),
        "weight_unit": _normalize_choice(
            payload.get("weight_unit", CarrierPurchaseOrder._meta.get_field("weight_unit").default),
            CarrierPurchaseOrder._meta.get_field("weight_unit").choices,
            "weight_unit",
        ),
        "quantity": _normalize_int(payload.get("quantity"), "quantity"),
        "departments_of_carrier": _value(payload, "departments_of_carrier"),
        **_logistics_defaults(payload, model_class=CarrierPurchaseOrder),
        **_billing_snapshot_defaults(payload),
        **_shipping_snapshot_defaults(payload),
    }
    matched = (
        CarrierPurchaseOrder.objects.filter(tenant=tenant, our_carrier_po_num=carrier_po_number).order_by("pk").first()
    )
    identifier = f"our_carrier_po_num={carrier_po_number}"
    return PreparedRow(
        entity="carrier_purchase_orders",
        target_model=ENTITY_CONTRACTS["carrier_purchase_orders"].target_model,
        source_identifier=identifier,
        lookup_key=identifier,
        matched_instance=matched,
        defaults=defaults,
        warnings=[],
    )


def _prepare_carrier_po_item(payload: dict[str, Any], *, tenant, actor) -> PreparedRow:
    carrier_purchase_order = _resolve_carrier_purchase_order(payload, tenant=tenant)
    line_number = _normalize_int(payload.get("line_number"), "line_number", required=True)
    defaults = {
        "carrier_purchase_order": carrier_purchase_order,
        "line_number": line_number,
        "notes": _value(payload, "notes"),
        **_line_item_defaults(payload, model_class=CarrierPOItem),
    }
    matched = (
        CarrierPOItem.objects.filter(
            tenant=tenant,
            carrier_purchase_order=carrier_purchase_order,
            line_number=line_number,
        )
        .order_by("pk")
        .first()
    )
    identifier = f"carrier_purchase_order={carrier_purchase_order.our_carrier_po_num}|line_number={line_number}"
    return PreparedRow(
        entity="carrier_po_items",
        target_model=ENTITY_CONTRACTS["carrier_po_items"].target_model,
        source_identifier=identifier,
        lookup_key=identifier,
        matched_instance=matched,
        defaults=defaults,
        warnings=[],
    )


def _prepare_invoice(payload: dict[str, Any], *, tenant, actor) -> PreparedRow:
    invoice_number = _required(payload, "invoice_number")
    customer = _resolve_customer(payload, tenant=tenant)
    sales_order = _resolve_sales_order(payload, tenant=tenant, required=False)
    product = _resolve_product(payload, required=False)
    defaults = {
        "invoice_number": invoice_number,
        "customer": customer,
        "sales_order": sales_order,
        "product": product,
        "due_date": _normalize_date(payload.get("due_date"), "due_date"),
        "our_sales_order_num": _value(payload, "our_sales_order_number_for_customer", "our_sales_order_num"),
        "our_sales_order_number_for_customer": _value(
            payload, "our_sales_order_number_for_customer", "our_sales_order_num"
        ),
        "delivery_po_number": _value(payload, "delivery_po_number", "delivery_po_num"),
        "payment_terms": _normalize_optional_choice(
            payload.get("payment_terms"),
            Invoice._meta.get_field("payment_terms").choices,
            "payment_terms",
        ),
        "type_of_protein": _normalize_optional_choice(
            payload.get("type_of_protein"),
            Invoice._meta.get_field("type_of_protein").choices,
            "type_of_protein",
        ),
        "description_of_product_item": _value(payload, "description_of_product_item"),
        "quantity": _normalize_int(payload.get("quantity"), "quantity"),
        "total_weight": _normalize_decimal(payload.get("total_weight"), "total_weight"),
        "weight_unit": _normalize_choice(
            payload.get("weight_unit", Invoice._meta.get_field("weight_unit").default),
            Invoice._meta.get_field("weight_unit").choices,
            "weight_unit",
        ),
        "edible_or_inedible": _normalize_optional_choice(
            payload.get("edible_or_inedible"),
            Invoice._meta.get_field("edible_or_inedible").choices,
            "edible_or_inedible",
        ),
        "tested_product": _normalize_bool(payload.get("tested_product"), default=False),
        "unit_price": _normalize_decimal(payload.get("unit_price"), "unit_price"),
        "total_amount": _normalize_decimal(payload.get("total_amount"), "total_amount"),
        "tax_amount": _normalize_decimal(payload.get("tax_amount"), "tax_amount"),
        "status": _normalize_choice(
            payload.get("status", Invoice._meta.get_field("status").default),
            Invoice._meta.get_field("status").choices,
            "status",
        ),
        "payment_status": _normalize_choice(
            payload.get("payment_status", Invoice._meta.get_field("payment_status").default),
            Invoice._meta.get_field("payment_status").choices,
            "payment_status",
        ),
        "outstanding_amount": _normalize_decimal(payload.get("outstanding_amount"), "outstanding_amount"),
        "notes": _value(payload, "notes"),
        **_logistics_defaults(payload, model_class=Invoice),
        **_accounts_payable_snapshot_defaults(payload),
        **_billing_snapshot_defaults(payload),
        **_shipping_snapshot_defaults(payload),
    }
    matched = Invoice.objects.filter(tenant=tenant, invoice_number=invoice_number).order_by("pk").first()
    identifier = f"invoice_number={invoice_number}"
    return PreparedRow(
        entity="invoices",
        target_model=ENTITY_CONTRACTS["invoices"].target_model,
        source_identifier=identifier,
        lookup_key=identifier,
        matched_instance=matched,
        defaults=defaults,
        warnings=[],
    )


def _prepare_invoice_item(payload: dict[str, Any], *, tenant, actor) -> PreparedRow:
    invoice = _resolve_invoice(payload, tenant=tenant)
    line_number = _normalize_int(payload.get("line_number"), "line_number", required=True)
    defaults = {
        "invoice": invoice,
        "line_number": line_number,
        "unit_price": _normalize_decimal(payload.get("unit_price"), "unit_price"),
        "line_total": _normalize_decimal(payload.get("line_total"), "line_total"),
        "notes": _value(payload, "notes"),
        **_line_item_defaults(payload, model_class=InvoiceItem),
    }
    matched = (
        InvoiceItem.objects.filter(
            tenant=tenant,
            invoice=invoice,
            line_number=line_number,
        )
        .order_by("pk")
        .first()
    )
    identifier = f"invoice={invoice.invoice_number}|line_number={line_number}"
    return PreparedRow(
        entity="invoice_items",
        target_model=ENTITY_CONTRACTS["invoice_items"].target_model,
        source_identifier=identifier,
        lookup_key=identifier,
        matched_instance=matched,
        defaults=defaults,
        warnings=[],
    )


def _logistics_defaults(payload: dict[str, Any], *, model_class) -> dict[str, Any]:
    return {
        "pick_up_date": _normalize_date(payload.get("pick_up_date"), "pick_up_date"),
        "delivery_date": _normalize_date(payload.get("delivery_date"), "delivery_date"),
        "carrier_release_format": _normalize_optional_choice(
            payload.get("carrier_release_format"),
            model_class._meta.get_field("carrier_release_format").choices,
            "carrier_release_format",
        ),
        "carrier_release_number": _value(payload, "carrier_release_number", "carrier_release_num"),
        "how_to_make_appointment": _normalize_optional_choice(
            payload.get("how_to_make_appointment", payload.get("how_carrier_make_appointment")),
            model_class._meta.get_field("how_to_make_appointment").choices,
            "how_to_make_appointment",
        ),
    }


def _billing_snapshot_defaults(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "billing_contact_name": _value(payload, "billing_contact_name"),
        "billing_contact_phone": _value(payload, "billing_contact_phone"),
        "billing_contact_email": _value(payload, "billing_contact_email"),
        "billing_contact_title": _value(payload, "billing_contact_title"),
        "billing_address_street": _value(payload, "billing_address_street"),
        "billing_address_city": _value(payload, "billing_address_city"),
        "billing_address_state_zip": _value(payload, "billing_address_state_zip"),
        "billing_building_name": _value(payload, "billing_building_name"),
    }


def _shipping_snapshot_defaults(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "shipping_contact_name": _value(payload, "shipping_contact_name"),
        "shipping_contact_phone": _value(payload, "shipping_contact_phone"),
        "shipping_contact_email": _value(payload, "shipping_contact_email"),
        "shipping_contact_title": _value(payload, "shipping_contact_title"),
        "shipping_address_street": _value(payload, "shipping_address_street"),
        "shipping_address_city": _value(payload, "shipping_address_city"),
        "shipping_address_state_zip": _value(payload, "shipping_address_state_zip"),
        "shipping_building_name": _value(payload, "shipping_building_name"),
    }


def _accounts_payable_snapshot_defaults(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "accounting_payable_contact_name": _value(payload, "accounting_payable_contact_name"),
        "accounting_payable_contact_phone": _value(payload, "accounting_payable_contact_phone"),
        "accounting_payable_contact_email": _value(payload, "accounting_payable_contact_email"),
        "accounting_payable_contact_title": _value(payload, "accounting_payable_contact_title"),
    }


def _line_item_defaults(payload: dict[str, Any], *, model_class) -> dict[str, Any]:
    return {
        "protein_type": _normalize_optional_choice(
            payload.get("protein_type"),
            model_class._meta.get_field("protein_type").choices,
            "protein_type",
        ),
        "product_description": _resolve_product(
            payload, required=False, code_fields=("product_code", "product_description_code")
        ),
        "fresh_or_frozen": _normalize_optional_choice(
            payload.get("fresh_or_frozen"),
            model_class._meta.get_field("fresh_or_frozen").choices,
            "fresh_or_frozen",
        ),
        "package_type": _normalize_optional_choice(
            payload.get("package_type"),
            model_class._meta.get_field("package_type").choices,
            "package_type",
        ),
        "quantity": _normalize_int(payload.get("quantity"), "quantity"),
        "uom": _normalize_choice(
            payload.get("uom", model_class._meta.get_field("uom").default),
            model_class._meta.get_field("uom").choices,
            "uom",
        ),
        "net_or_catch": _normalize_optional_choice(
            payload.get("net_or_catch"),
            model_class._meta.get_field("net_or_catch").choices,
            "net_or_catch",
        ),
        "edible_or_inedible": _normalize_optional_choice(
            payload.get("edible_or_inedible"),
            model_class._meta.get_field("edible_or_inedible").choices,
            "edible_or_inedible",
        ),
        "tested_product": _normalize_bool(payload.get("tested_product"), default=False),
        "total_net_weight": _normalize_decimal(payload.get("total_net_weight"), "total_net_weight"),
    }


def _resolve_pickup_location(payload: dict[str, Any], *, tenant, required: bool = False):
    return _resolve_location(
        {
            "location_code": _value(payload, "pick_up_location_code", "pickup_location_code"),
            "location_name": _value(payload, "pick_up_location_name", "pickup_location_name"),
            "location_city": _value(payload, "pick_up_location_city", "pickup_location_city"),
            "location_state": _value(payload, "pick_up_location_state", "pickup_location_state"),
        },
        tenant=tenant,
        required=required,
    )


def _resolve_delivery_location(payload: dict[str, Any], *, tenant, required: bool = False):
    return _resolve_location(
        {
            "location_code": _value(payload, "delivery_location_code"),
            "location_name": _value(payload, "delivery_location_name"),
            "location_city": _value(payload, "delivery_location_city"),
            "location_state": _value(payload, "delivery_location_state"),
        },
        tenant=tenant,
        required=required,
    )


def _resolve_plant_location(payload: dict[str, Any], *, tenant, required: bool = False):
    plant_code = _value(payload, "plant_location_code", "plant_code")
    plant_name = _value(payload, "plant_name")
    plant_est_num = _value(payload, "plant_est_num", "plant_est_number")
    has_reference = bool(plant_code or plant_name or plant_est_num)
    if not has_reference:
        if required:
            raise RowPreparationError(
                "missing_parent_reference",
                "Row is missing the plant location reference required for import.",
            )
        return None
    queryset = Location.objects.filter(tenant=tenant)
    if plant_code:
        queryset = queryset.filter(code=plant_code)
    if plant_name:
        queryset = queryset.filter(name=plant_name)
    if plant_est_num:
        queryset = queryset.filter(plant_est_num=plant_est_num)
    location = queryset.order_by("pk").first()
    if location is None:
        if required:
            raise RowPreparationError(
                "parent_not_found",
                f"Plant location reference could not be resolved for code='{plant_code}' name='{plant_name}' est='{plant_est_num}'.",
            )
        return None
    return location


def _resolve_primary_contact(payload: dict[str, Any], *, tenant, required: bool = False):
    contact_email = _value(payload, "contact_email")
    contact_phone = _value(payload, "contact_phone")
    contact_first_name = _value(payload, "contact_first_name")
    contact_last_name = _value(payload, "contact_last_name")
    contact_name = _value(payload, "contact_name")
    if contact_name and not (contact_first_name or contact_last_name):
        parts = contact_name.split()
        if parts:
            contact_first_name = parts[0]
            contact_last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
    has_reference = bool(contact_email or contact_phone or contact_first_name or contact_last_name)
    if not has_reference:
        if required:
            raise RowPreparationError(
                "missing_parent_reference",
                "Row is missing the contact reference required for import.",
            )
        return None
    queryset = Contact.objects.filter(tenant=tenant)
    if contact_email:
        queryset = queryset.filter(email=contact_email)
    if contact_phone:
        queryset = queryset.filter(phone=contact_phone)
    if contact_first_name:
        queryset = queryset.filter(first_name=contact_first_name)
    if contact_last_name:
        queryset = queryset.filter(last_name=contact_last_name)
    contact = queryset.order_by("pk").first()
    if contact is None:
        raise RowPreparationError(
            "parent_not_found",
            f"Contact reference could not be resolved for email='{contact_email}' phone='{contact_phone}'.",
        )
    return contact


def _resolve_product(
    payload: dict[str, Any],
    *,
    required: bool = False,
    code_fields: tuple[str, ...] = ("product_code",),
    name_fields: tuple[str, ...] = ("product_name",),
):
    product_code = _value(payload, *code_fields)
    product_name = _value(payload, *name_fields)
    has_reference = bool(product_code or product_name)
    if not has_reference:
        if required:
            raise RowPreparationError(
                "missing_parent_reference",
                "Row is missing the product_code/product_name reference required for import.",
            )
        return None
    queryset = Product.objects.all()
    if product_code:
        queryset = queryset.filter(product_code=product_code)
    if product_name:
        queryset = queryset.filter(name=product_name)
    product = queryset.order_by("pk").first()
    if product is None:
        raise RowPreparationError(
            "parent_not_found",
            f"Product reference could not be resolved for code='{product_code}' name='{product_name}'.",
        )
    return product


def _resolve_purchase_order(
    payload: dict[str, Any],
    *,
    tenant,
    required: bool = True,
    names: tuple[str, ...] = ("purchase_order_number", "purchase_order", "order_number"),
):
    order_number = _value(payload, *names)
    if not order_number:
        if required:
            raise RowPreparationError(
                "missing_parent_reference",
                "Row is missing the purchase_order reference required for import.",
            )
        return None
    purchase_order = PurchaseOrder.objects.filter(tenant=tenant, order_number=order_number).order_by("pk").first()
    if purchase_order is None:
        raise RowPreparationError(
            "parent_not_found",
            f"Purchase order reference could not be resolved for order_number='{order_number}'.",
        )
    return purchase_order


def _resolve_sales_order(
    payload: dict[str, Any],
    *,
    tenant,
    required: bool = True,
    names: tuple[str, ...] = (
        "sales_order_number",
        "sales_order",
        "our_sales_order_number_for_customer",
        "our_sales_order_num",
    ),
):
    sales_order_number = _value(payload, *names)
    if not sales_order_number:
        if required:
            raise RowPreparationError(
                "missing_parent_reference",
                "Row is missing the sales_order reference required for import.",
            )
        return None
    sales_order = (
        SalesOrder.objects.filter(tenant=tenant, our_sales_order_num=sales_order_number).order_by("pk").first()
    )
    if sales_order is None:
        raise RowPreparationError(
            "parent_not_found",
            f"Sales order reference could not be resolved for order_number='{sales_order_number}'.",
        )
    return sales_order


def _resolve_carrier_purchase_order(payload: dict[str, Any], *, tenant, required: bool = True):
    carrier_po_number = _value(payload, "carrier_purchase_order_number", "carrier_purchase_order", "our_carrier_po_num")
    if not carrier_po_number:
        if required:
            raise RowPreparationError(
                "missing_parent_reference",
                "Row is missing the carrier purchase order reference required for import.",
            )
        return None
    carrier_purchase_order = (
        CarrierPurchaseOrder.objects.filter(
            tenant=tenant,
            our_carrier_po_num=carrier_po_number,
        )
        .order_by("pk")
        .first()
    )
    if carrier_purchase_order is None:
        raise RowPreparationError(
            "parent_not_found",
            f"Carrier purchase order reference could not be resolved for order_number='{carrier_po_number}'.",
        )
    return carrier_purchase_order


def _resolve_invoice(payload: dict[str, Any], *, tenant, required: bool = True):
    invoice_number = _value(payload, "invoice_number", "invoice")
    if not invoice_number:
        if required:
            raise RowPreparationError(
                "missing_parent_reference",
                "Row is missing the invoice reference required for import.",
            )
        return None
    invoice = Invoice.objects.filter(tenant=tenant, invoice_number=invoice_number).order_by("pk").first()
    if invoice is None:
        raise RowPreparationError(
            "parent_not_found",
            f"Invoice reference could not be resolved for invoice_number='{invoice_number}'.",
        )
    return invoice
