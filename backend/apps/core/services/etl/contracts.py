"""Contract-only Golden Schema ETL scaffolding for GA-01.1.

This module intentionally stops at deterministic contract definition:

* entity execution order
* canonical field groups derived from Golden Schema mixins
* batch-manifest validation
* side-effect suppression requirements
* planned journal/error-report shapes for GA-01.2

No write-capable import logic is enabled here.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any
from uuid import UUID


SUPPORTED_SOURCE_FORMATS = ("csv", "xlsx", "json", "database_export")
BATCH_MANIFEST_REQUIRED_FIELDS = ("batch_name", "source_system", "sources")
TENANT_SELECTOR_FIELDS = ("tenant_slug", "tenant_id")

MASTER_DATA_IMPORT_ORDER = (
    "locations",
    "plants",
    "suppliers",
    "customers",
    "carriers",
    "contacts",
    "products",
)

TRANSACTION_IMPORT_ORDER = (
    "purchase_orders",
    "purchase_order_items",
    "sales_orders",
    "sales_order_items",
    "carrier_purchase_orders",
    "carrier_po_items",
    "invoices",
    "invoice_items",
)

SIDE_EFFECT_SUPPRESSION_RULES = (
    "outbound_email",
    "integration_webhook",
    "notification_fanout",
    "background_sync_dispatch",
)

BATCH_JOURNAL_FIELDS = (
    "batch_id",
    "batch_name",
    "tenant_id",
    "tenant_slug",
    "source_system",
    "entity",
    "source_path",
    "source_sheet",
    "source_row_number",
    "source_identifier",
    "normalized_lookup_key",
    "planned_action",
    "target_model",
    "target_identifier",
    "status",
    "error_code",
    "error_message",
    "side_effects_suppressed",
)

ERROR_REPORT_FIELDS = (
    "entity",
    "source_path",
    "source_sheet",
    "source_row_number",
    "source_identifier",
    "error_code",
    "error_message",
    "canonical_field",
)

NEXT_PHASE_FILES = (
    "backend/apps/core/services/etl/journal.py",
    "backend/apps/core/services/etl/runtime.py",
    "backend/apps/core/services/etl/engine.py",
    "backend/apps/core/services/etl/context.py",
    "backend/apps/core/services/etl/master_data_import.py",
    "backend/apps/core/management/commands/import_golden_legacy_data.py",
    "backend/apps/core/tests/test_golden_schema_etl_journal.py",
)

CANONICAL_FIELD_GROUPS: dict[str, tuple[str, ...]] = {
    "financial_terms": (
        "payment_terms",
        "credit_limit",
        "account_line_of_credit",
    ),
    "logistics": (
        "pick_up_date",
        "delivery_date",
        "carrier_release_format",
        "carrier_release_number",
        "how_to_make_appointment",
    ),
    "contact_snapshot": (
        "contact_name",
        "contact_phone",
        "contact_email",
        "contact_title",
    ),
    "billing_contact_snapshot": (
        "billing_contact_name",
        "billing_contact_phone",
        "billing_contact_email",
        "billing_contact_title",
    ),
    "billing_address_snapshot": (
        "billing_address_street",
        "billing_address_city",
        "billing_address_state_zip",
        "billing_building_name",
    ),
    "shipping_contact_snapshot": (
        "shipping_contact_name",
        "shipping_contact_phone",
        "shipping_contact_email",
        "shipping_contact_title",
    ),
    "shipping_address_snapshot": (
        "shipping_address_street",
        "shipping_address_city",
        "shipping_address_state_zip",
        "shipping_building_name",
    ),
    "accounts_payable_contact_snapshot": (
        "accounting_payable_contact_name",
        "accounting_payable_contact_phone",
        "accounting_payable_contact_email",
        "accounting_payable_contact_title",
    ),
    "base_line_item": (
        "protein_type",
        "product_description",
        "fresh_or_frozen",
        "package_type",
        "quantity",
        "uom",
        "net_or_catch",
        "edible_or_inedible",
        "tested_product",
        "total_net_weight",
    ),
}


@dataclass(frozen=True)
class EntityContract:
    """Deterministic import contract for one Golden Schema entity."""

    entity: str
    phase: str
    target_model: str
    canonical_fields: tuple[str, ...]
    field_groups: tuple[str, ...] = ()
    depends_on: tuple[str, ...] = ()
    natural_keys: tuple[str, ...] = ()
    notes: tuple[str, ...] = ()

    @property
    def expanded_fields(self) -> tuple[str, ...]:
        ordered_fields = list(self.canonical_fields)
        for group_name in self.field_groups:
            ordered_fields.extend(CANONICAL_FIELD_GROUPS[group_name])
        return tuple(ordered_fields)


@dataclass(frozen=True)
class SourceBinding:
    """One declared legacy source file/tab inside an ETL batch manifest."""

    entity: str
    format: str
    path: str
    sheet: str | None = None
    notes: str = ""


@dataclass(frozen=True)
class BatchManifest:
    """Validated contract-only ETL batch manifest."""

    batch_name: str
    source_system: str
    tenant_slug: str | None
    tenant_id: str | None
    sources: tuple[SourceBinding, ...]

    def ordered_entities(self) -> tuple[str, ...]:
        declared = {source.entity for source in self.sources}
        ordered = [
            entity
            for entity in MASTER_DATA_IMPORT_ORDER + TRANSACTION_IMPORT_ORDER
            if entity in declared
        ]
        return tuple(ordered)


ENTITY_CONTRACTS: dict[str, EntityContract] = {
    "locations": EntityContract(
        entity="locations",
        phase="master_data",
        target_model="tenant_apps.locations.models.Location",
        canonical_fields=("name", "code", "location_type", "address", "city", "state", "zip_code", "country"),
        field_groups=("contact_snapshot",),
        natural_keys=("code", "name", "city", "state"),
        notes=("Legacy warehouse, delivery, and pickup rows normalize into Location.",),
    ),
    "plants": EntityContract(
        entity="plants",
        phase="master_data",
        target_model="tenant_apps.plants.models.Plant",
        canonical_fields=("name", "plant_est_num", "plant_type", "supplier_name", "supplier_email"),
        field_groups=("contact_snapshot",),
        depends_on=("suppliers",),
        natural_keys=("plant_est_num", "name"),
        notes=(
            "GA-01.3 imports write into the dedicated plants.Plant model used by current tenant workflows.",
            "Supplier-linked plant relationships must resolve within the same tenant before contacts import.",
        ),
    ),
    "suppliers": EntityContract(
        entity="suppliers",
        phase="master_data",
        target_model="tenant_apps.suppliers.models.Supplier",
        canonical_fields=(
            "name",
            "contact_person",
            "email",
            "phone",
            "street_address",
            "city",
            "state",
            "zip_code",
            "country",
            "departments_array",
            "preferred_protein_types",
        ),
        field_groups=("financial_terms",),
        depends_on=("plants", "locations"),
        natural_keys=("name", "email"),
    ),
    "customers": EntityContract(
        entity="customers",
        phase="master_data",
        target_model="tenant_apps.customers.models.Customer",
        canonical_fields=(
            "name",
            "contact_person",
            "email",
            "phone",
            "street_address",
            "city",
            "state",
            "zip_code",
            "country",
            "buyer_contact_name",
            "buyer_contact_phone",
            "buyer_contact_email",
            "preferred_protein_types",
        ),
        field_groups=("financial_terms",),
        depends_on=("plants", "locations"),
        natural_keys=("name", "email"),
    ),
    "carriers": EntityContract(
        entity="carriers",
        phase="master_data",
        target_model="tenant_apps.carriers.models.Carrier",
        canonical_fields=(
            "name",
            "code",
            "mc_number",
            "dot_number",
            "email",
            "phone",
            "address",
            "city",
            "state",
            "zip_code",
            "departments_array",
            "how_carrier_make_appointment",
        ),
        field_groups=("financial_terms",),
        natural_keys=("code", "name"),
    ),
    "contacts": EntityContract(
        entity="contacts",
        phase="master_data",
        target_model="tenant_apps.contacts.models.Contact",
        canonical_fields=("first_name", "last_name", "email", "phone", "title", "department"),
        depends_on=("suppliers", "customers", "plants", "locations"),
        natural_keys=("first_name", "last_name", "email", "phone"),
        notes=("Link contacts to parents only after the owning master record exists.",),
    ),
    "products": EntityContract(
        entity="products",
        phase="master_data",
        target_model="tenant_apps.products.models.MasterProduct",
        canonical_fields=(
            "protein",
            "item_name",
            "type",
            "trim",
        ),
        natural_keys=("protein", "item_name", "type", "trim"),
    ),
    "purchase_orders": EntityContract(
        entity="purchase_orders",
        phase="transaction_header",
        target_model="tenant_apps.purchase_orders.models.PurchaseOrder",
        canonical_fields=(
            "order_number",
            "our_purchase_order_number_to_supplier",
            "my_customer_number_from_supplier",
            "supplier_confirmation_order_number",
            "supplier",
            "carrier",
            "pick_up_location",
            "delivery_location",
            "order_date",
            "status",
            "payment_status",
            "total_amount",
        ),
        field_groups=(
            "logistics",
            "billing_contact_snapshot",
            "billing_address_snapshot",
            "shipping_contact_snapshot",
            "shipping_address_snapshot",
        ),
        depends_on=("suppliers", "carriers", "locations", "contacts", "products"),
        natural_keys=("order_number",),
    ),
    "purchase_order_items": EntityContract(
        entity="purchase_order_items",
        phase="transaction_line_item",
        target_model="tenant_apps.purchase_orders.models.PurchaseOrderItem",
        canonical_fields=("purchase_order", "line_number", "notes"),
        field_groups=("base_line_item",),
        depends_on=("purchase_orders", "products"),
        natural_keys=("purchase_order", "line_number"),
    ),
    "sales_orders": EntityContract(
        entity="sales_orders",
        phase="transaction_header",
        target_model="tenant_apps.sales_orders.models.SalesOrder",
        canonical_fields=(
            "our_sales_order_number_for_customer",
            "delivery_po_number",
            "supplier",
            "customer",
            "carrier",
            "product",
            "pick_up_location",
            "delivery_location",
            "status",
            "payment_status",
            "total_amount",
        ),
        field_groups=(
            "logistics",
            "billing_contact_snapshot",
            "billing_address_snapshot",
            "shipping_contact_snapshot",
            "shipping_address_snapshot",
        ),
        depends_on=("suppliers", "customers", "carriers", "locations", "products"),
        natural_keys=("our_sales_order_number_for_customer",),
    ),
    "sales_order_items": EntityContract(
        entity="sales_order_items",
        phase="transaction_line_item",
        target_model="tenant_apps.sales_orders.models.SalesOrderItem",
        canonical_fields=("sales_order", "line_number", "notes"),
        field_groups=("base_line_item",),
        depends_on=("sales_orders", "products"),
        natural_keys=("sales_order", "line_number"),
    ),
    "carrier_purchase_orders": EntityContract(
        entity="carrier_purchase_orders",
        phase="transaction_header",
        target_model="tenant_apps.purchase_orders.models.CarrierPurchaseOrder",
        canonical_fields=(
            "our_carrier_po_num",
            "carrier",
            "supplier",
            "linked_order",
            "sales_order",
            "pick_up_location",
            "delivery_location",
            "product",
            "departments_of_carrier",
        ),
        field_groups=(
            "logistics",
            "billing_contact_snapshot",
            "billing_address_snapshot",
            "shipping_contact_snapshot",
            "shipping_address_snapshot",
        ),
        depends_on=("purchase_orders", "sales_orders", "carriers", "suppliers", "locations", "products"),
        natural_keys=("our_carrier_po_num",),
        notes=("This is the Golden Schema freight-order / Carrier PO header.",),
    ),
    "carrier_po_items": EntityContract(
        entity="carrier_po_items",
        phase="transaction_line_item",
        target_model="tenant_apps.purchase_orders.models.CarrierPOItem",
        canonical_fields=("carrier_purchase_order", "line_number", "notes"),
        field_groups=("base_line_item",),
        depends_on=("carrier_purchase_orders", "products"),
        natural_keys=("carrier_purchase_order", "line_number"),
    ),
    "invoices": EntityContract(
        entity="invoices",
        phase="transaction_header",
        target_model="tenant_apps.invoices.models.Invoice",
        canonical_fields=(
            "invoice_number",
            "customer",
            "sales_order",
            "due_date",
            "our_sales_order_number_for_customer",
            "delivery_po_number",
            "status",
            "payment_status",
            "total_amount",
            "tax_amount",
        ),
        field_groups=(
            "logistics",
            "accounts_payable_contact_snapshot",
            "billing_contact_snapshot",
            "billing_address_snapshot",
            "shipping_contact_snapshot",
            "shipping_address_snapshot",
        ),
        depends_on=("customers", "sales_orders", "products"),
        natural_keys=("invoice_number",),
    ),
    "invoice_items": EntityContract(
        entity="invoice_items",
        phase="transaction_line_item",
        target_model="tenant_apps.invoices.models.InvoiceItem",
        canonical_fields=("invoice", "line_number", "unit_price", "line_total"),
        field_groups=("base_line_item",),
        depends_on=("invoices", "products"),
        natural_keys=("invoice", "line_number"),
    ),
}


def load_batch_manifest(path: str | Path) -> dict[str, Any]:
    """Load a JSON batch manifest from disk."""

    manifest_path = Path(path)
    with manifest_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def validate_batch_manifest(payload: dict[str, Any]) -> BatchManifest:
    """Validate the GA-01.1 batch manifest shape.

    The manifest is contract-only at this phase. It declares ownership and source
    bindings without enabling row transformation or writes.
    """

    missing = [field for field in BATCH_MANIFEST_REQUIRED_FIELDS if not payload.get(field)]
    if missing:
        raise ValueError(f"Batch manifest missing required fields: {', '.join(missing)}")

    tenant_slug = payload.get("tenant_slug")
    tenant_id = payload.get("tenant_id")
    if not tenant_slug and not tenant_id:
        raise ValueError("Batch manifest must declare tenant_slug or tenant_id.")

    if tenant_id:
        try:
            UUID(str(tenant_id))
        except ValueError as exc:
            raise ValueError("tenant_id must be a valid UUID string.") from exc

    sources: list[SourceBinding] = []
    for index, source in enumerate(payload.get("sources", []), start=1):
        entity = source.get("entity")
        if entity not in ENTITY_CONTRACTS:
            raise ValueError(f"Source #{index} declares unknown entity '{entity}'.")

        source_format = str(source.get("format", "")).lower()
        if source_format not in SUPPORTED_SOURCE_FORMATS:
            raise ValueError(
                f"Source #{index} for '{entity}' uses unsupported format '{source_format}'."
            )

        path_value = str(source.get("path", "")).strip()
        if not path_value:
            raise ValueError(f"Source #{index} for '{entity}' is missing a path.")

        sources.append(
            SourceBinding(
                entity=entity,
                format=source_format,
                path=path_value,
                sheet=source.get("sheet"),
                notes=str(source.get("notes", "")),
            )
        )

    if not sources:
        raise ValueError("Batch manifest must declare at least one source binding.")

    return BatchManifest(
        batch_name=str(payload["batch_name"]),
        source_system=str(payload["source_system"]),
        tenant_slug=str(tenant_slug) if tenant_slug else None,
        tenant_id=str(tenant_id) if tenant_id else None,
        sources=tuple(sources),
    )


def resolve_manifest_tenant(manifest: BatchManifest):
    """Resolve and verify the tenant selector declared in the manifest."""

    from apps.tenants.models import Tenant

    tenant = None
    if manifest.tenant_id:
        tenant = Tenant.objects.filter(id=manifest.tenant_id).first()
        if tenant is None:
            raise ValueError(f"No tenant found for tenant_id={manifest.tenant_id}.")

    if manifest.tenant_slug:
        slug_match = Tenant.objects.filter(slug=manifest.tenant_slug).first()
        if slug_match is None:
            raise ValueError(f"No tenant found for tenant_slug={manifest.tenant_slug}.")
        if tenant and slug_match.id != tenant.id:
            raise ValueError("tenant_id and tenant_slug resolve to different tenants.")
        tenant = slug_match

    if tenant is None:
        raise ValueError("Unable to resolve tenant selector from batch manifest.")

    return tenant


def build_contract_preview(manifest: BatchManifest, *, resolved_tenant: Any | None = None) -> dict[str, Any]:
    """Build a stable contract preview payload for the management command/tests."""

    ordered_entities = manifest.ordered_entities()
    entity_summaries = []
    sources_by_entity: dict[str, list[SourceBinding]] = {}
    for source in manifest.sources:
        sources_by_entity.setdefault(source.entity, []).append(source)

    for entity in ordered_entities:
        contract = ENTITY_CONTRACTS[entity]
        entity_summaries.append(
            {
                "entity": entity,
                "phase": contract.phase,
                "target_model": contract.target_model,
                "depends_on": list(contract.depends_on),
                "natural_keys": list(contract.natural_keys),
                "field_groups": list(contract.field_groups),
                "expanded_fields": list(contract.expanded_fields),
                "sources": [
                    {
                        "format": source.format,
                        "path": source.path,
                        "sheet": source.sheet,
                    }
                    for source in sources_by_entity.get(entity, [])
                ],
            }
        )

    return {
        "batch_name": manifest.batch_name,
        "source_system": manifest.source_system,
        "tenant_slug": manifest.tenant_slug or getattr(resolved_tenant, "slug", None),
        "tenant_id": manifest.tenant_id or str(getattr(resolved_tenant, "id", "")),
        "ordered_entities": list(ordered_entities),
        "entity_summaries": entity_summaries,
        "side_effects_suppressed": list(SIDE_EFFECT_SUPPRESSION_RULES),
        "journal_fields": list(BATCH_JOURNAL_FIELDS),
        "error_report_fields": list(ERROR_REPORT_FIELDS),
        "next_phase_files": list(NEXT_PHASE_FILES),
    }
