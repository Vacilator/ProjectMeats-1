"""Contract types for Golden Schema ETL scaffolding."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any, TypedDict

GOLDEN_ETL_CONTRACT_VERSION = "ga01.1.v1"
SOURCE_MANIFEST_VERSION = 1


class SourceFormat(StrEnum):
    CSV = "csv"
    XLS = "xls"
    XLSX = "xlsx"


SUPPORTED_SOURCE_FORMATS = tuple(source_format.value for source_format in SourceFormat)


class SourceShape(StrEnum):
    MASTER_ROWS = "master_rows"
    TRANSACTION_HEADERS = "transaction_headers"
    TRANSACTION_LINE_ITEMS = "transaction_line_items"


class SideEffect(StrEnum):
    MODEL_SIGNALS = "model_signals"
    PURCHASE_ORDER_HISTORY = "purchase_order_history"
    TENANT_CACHE_BUMPS = "tenant_cache_bumps"
    EMAILS = "emails"
    WEBHOOKS = "webhooks"
    CELERY_TASKS = "celery_tasks"


REQUIRED_SUPPRESSED_SIDE_EFFECTS = tuple(side_effect.value for side_effect in SideEffect)


class ErrorCode(StrEnum):
    MISSING_TENANT = "missing_tenant"
    TENANT_MISMATCH = "tenant_mismatch"
    FOREIGN_TENANT_REFERENCE = "foreign_tenant_reference"
    MISSING_REQUIRED_FIELD = "missing_required_field"
    UNKNOWN_CHOICE = "unknown_choice"
    AMBIGUOUS_MATCH = "ambiguous_match"
    NOT_FOUND = "not_found"
    DUPLICATE_SOURCE_KEY = "duplicate_source_key"
    ORPHAN_LINE_ITEM = "orphan_line_item"
    HEADER_WITHOUT_ITEMS = "header_without_items"
    GLOBAL_PRODUCT_CREATE_DISALLOWED = "global_product_create_disallowed"


ERROR_CODES = tuple(error_code.value for error_code in ErrorCode)

MASTER_ENTITY_ORDER = (
    "products",
    "plants",
    "locations",
    "suppliers",
    "customers",
    "carriers",
    "contacts",
)

TRANSACTION_ENTITY_ORDER = (
    "purchase_orders",
    "sales_orders",
    "invoices",
    "carrier_pos",
)

LINE_ITEM_ENTITY_ORDER = (
    "purchase_order_items",
    "sales_order_items",
    "invoice_items",
    "carrier_po_items",
)

ALL_ETL_ENTITIES = MASTER_ENTITY_ORDER + TRANSACTION_ENTITY_ORDER + LINE_ITEM_ENTITY_ORDER

LINE_ITEM_PARENT_MAP = {
    "purchase_orders": {
        "item_entity": "purchase_order_items",
        "header_model": "tenant_apps.purchase_orders.models.PurchaseOrder",
        "item_model": "tenant_apps.purchase_orders.models.PurchaseOrderItem",
        "item_fk": "purchase_order",
        "related_name": "items",
    },
    "sales_orders": {
        "item_entity": "sales_order_items",
        "header_model": "tenant_apps.sales_orders.models.SalesOrder",
        "item_model": "tenant_apps.sales_orders.models.SalesOrderItem",
        "item_fk": "sales_order",
        "related_name": "items",
    },
    "invoices": {
        "item_entity": "invoice_items",
        "header_model": "tenant_apps.invoices.models.Invoice",
        "item_model": "tenant_apps.invoices.models.InvoiceItem",
        "item_fk": "invoice",
        "related_name": "items",
    },
    "carrier_pos": {
        "item_entity": "carrier_po_items",
        "header_model": "tenant_apps.purchase_orders.models.CarrierPurchaseOrder",
        "item_model": "tenant_apps.purchase_orders.models.CarrierPOItem",
        "item_fk": "carrier_purchase_order",
        "related_name": "items",
    },
}

CANONICAL_ALIAS_TARGETS = {
    "suppliers": ("payment_terms", "credit_limit", "account_line_of_credit"),
    "customers": ("payment_terms", "credit_limit", "account_line_of_credit"),
    "carriers": ("payment_terms", "credit_limit"),
    "purchase_orders": (
        "our_purchase_order_number_to_supplier",
        "supplier_confirmation_order_number",
        "carrier_release_number",
        "how_to_make_appointment",
    ),
    "sales_orders": (
        "our_sales_order_number_for_customer",
        "delivery_po_number",
        "carrier_release_number",
        "how_to_make_appointment",
    ),
    "invoices": (
        "our_sales_order_number_for_customer",
        "delivery_po_number",
        "carrier_release_number",
        "how_to_make_appointment",
    ),
    "carrier_pos": ("carrier_release_number", "how_to_make_appointment"),
}


class SourceFileSpec(TypedDict):
    entity: str
    format: str
    relative_path: str
    sheet_name: str | None
    header_row: int
    line_item_entity: str | None
    source_document_key_column: str | None
    source_line_number_column: str | None


class TenantAssertionSpec(TypedDict):
    tenant_id: str | None
    tenant_slug: str | None
    asserted_by: str


class SourceManifest(TypedDict):
    version: int
    batch_key: str
    tenant: TenantAssertionSpec
    files: list[SourceFileSpec]


@dataclass(frozen=True)
class ValidatedSourceManifestFile:
    entity: str
    format: str
    relative_path: str
    sheet_name: str | None
    header_row: int
    line_item_entity: str | None
    source_document_key_column: str | None
    source_line_number_column: str | None


@dataclass(frozen=True)
class ValidatedTenantAssertion:
    tenant_id: str | None
    tenant_slug: str | None
    asserted_by: str


@dataclass(frozen=True)
class ValidatedSourceManifest:
    version: int
    batch_key: str
    tenant: ValidatedTenantAssertion
    files: tuple[ValidatedSourceManifestFile, ...]


@dataclass(frozen=True)
class ImportBatchJournal:
    batch_key: str
    tenant_id: str
    tenant_slug: str
    mode: str
    contract_version: str
    source_manifest_checksum: str
    side_effects_suppressed: tuple[str, ...]
    ownership_asserted: bool
    ownership_source: str
    started_at: str | None
    finished_at: str | None
    status: str
    counts: dict[str, int]


@dataclass(frozen=True)
class ImportRowJournal:
    batch_key: str
    entity: str
    source_file: str
    sheet_name: str | None
    source_row_number: int
    source_document_key: str | None
    source_line_number: int | None
    dedupe_key: str
    action: str
    target_model: str
    target_pk: str | None
    error_code: str | None
    error_message: str | None


class ManifestValidationError(ValueError):
    """Raised when a source manifest does not satisfy the GA-01.1 contract."""


_TOP_LEVEL_KEYS = frozenset({"version", "batch_key", "tenant", "files"})
_TENANT_KEYS = frozenset({"tenant_id", "tenant_slug", "asserted_by"})
_FILE_KEYS = frozenset(
    {
        "entity",
        "format",
        "relative_path",
        "sheet_name",
        "header_row",
        "line_item_entity",
        "source_document_key_column",
        "source_line_number_column",
    }
)


def validate_source_manifest(raw_manifest: Any) -> ValidatedSourceManifest:
    """Validate and normalize the GA-01.1 source manifest shape."""

    if not isinstance(raw_manifest, dict):
        raise ManifestValidationError("Source manifest must be a JSON object.")

    _reject_unknown_keys(raw_manifest, _TOP_LEVEL_KEYS, "manifest")
    _require_keys(raw_manifest, ("version", "batch_key", "tenant", "files"), "manifest")

    version = raw_manifest["version"]
    if version != SOURCE_MANIFEST_VERSION:
        raise ManifestValidationError(f"Unsupported manifest version {version!r}; expected {SOURCE_MANIFEST_VERSION}.")

    batch_key = raw_manifest["batch_key"]
    if not isinstance(batch_key, str) or not batch_key.strip():
        raise ManifestValidationError("Manifest batch_key must be a non-empty string.")

    tenant = _validate_tenant_assertion(raw_manifest["tenant"])
    files = _validate_files(raw_manifest["files"])

    return ValidatedSourceManifest(
        version=version,
        batch_key=batch_key.strip(),
        tenant=tenant,
        files=tuple(files),
    )


def _validate_tenant_assertion(raw_tenant: Any) -> ValidatedTenantAssertion:
    if not isinstance(raw_tenant, dict):
        raise ManifestValidationError("Manifest tenant assertion must be an object.")

    _reject_unknown_keys(raw_tenant, _TENANT_KEYS, "tenant")
    _require_keys(raw_tenant, ("tenant_id", "tenant_slug", "asserted_by"), "tenant")

    asserted_by = raw_tenant["asserted_by"]
    if asserted_by not in {"command", "manifest"}:
        raise ManifestValidationError("tenant.asserted_by must be 'command' or 'manifest'.")

    tenant_id = _normalize_optional_string(raw_tenant["tenant_id"])
    tenant_slug = _normalize_optional_string(raw_tenant["tenant_slug"])

    return ValidatedTenantAssertion(
        tenant_id=tenant_id,
        tenant_slug=tenant_slug,
        asserted_by=asserted_by,
    )


def _validate_files(raw_files: Any) -> list[ValidatedSourceManifestFile]:
    if not isinstance(raw_files, list) or not raw_files:
        raise ManifestValidationError("Manifest files must be a non-empty list.")

    validated_files: list[ValidatedSourceManifestFile] = []
    for index, raw_file in enumerate(raw_files):
        if not isinstance(raw_file, dict):
            raise ManifestValidationError(f"files[{index}] must be an object.")

        _reject_unknown_keys(raw_file, _FILE_KEYS, f"files[{index}]")
        _require_keys(
            raw_file,
            ("entity", "format", "relative_path", "sheet_name", "header_row", "line_item_entity"),
            f"files[{index}]",
        )

        entity = raw_file["entity"]
        if entity not in ALL_ETL_ENTITIES:
            raise ManifestValidationError(f"files[{index}].entity {entity!r} is not supported.")

        file_format = raw_file["format"]
        if file_format not in SUPPORTED_SOURCE_FORMATS:
            raise ManifestValidationError(f"files[{index}].format {file_format!r} is not supported.")

        relative_path = raw_file["relative_path"]
        if not isinstance(relative_path, str) or not relative_path.strip():
            raise ManifestValidationError(f"files[{index}].relative_path must be a non-empty string.")

        header_row = raw_file["header_row"]
        if not isinstance(header_row, int) or header_row < 1:
            raise ManifestValidationError(f"files[{index}].header_row must be an integer >= 1.")

        line_item_entity = _normalize_optional_string(raw_file.get("line_item_entity"))
        if line_item_entity is not None and line_item_entity not in LINE_ITEM_ENTITY_ORDER:
            raise ManifestValidationError(f"files[{index}].line_item_entity {line_item_entity!r} is not supported.")

        validated_files.append(
            ValidatedSourceManifestFile(
                entity=entity,
                format=file_format,
                relative_path=relative_path.strip(),
                sheet_name=_normalize_optional_string(raw_file.get("sheet_name")),
                header_row=header_row,
                line_item_entity=line_item_entity,
                source_document_key_column=_normalize_optional_string(raw_file.get("source_document_key_column")),
                source_line_number_column=_normalize_optional_string(raw_file.get("source_line_number_column")),
            )
        )

    return validated_files


def _reject_unknown_keys(payload: dict[str, Any], allowed_keys: frozenset[str], context: str) -> None:
    unknown_keys = sorted(set(payload) - allowed_keys)
    if unknown_keys:
        raise ManifestValidationError(f"Unknown keys in {context}: {', '.join(unknown_keys)}.")


def _require_keys(payload: dict[str, Any], required_keys: tuple[str, ...], context: str) -> None:
    missing_keys = [key for key in required_keys if key not in payload]
    if missing_keys:
        raise ManifestValidationError(f"Missing required keys in {context}: {', '.join(missing_keys)}.")


def _normalize_optional_string(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ManifestValidationError("Optional string values must be strings or null.")
    normalized = value.strip()
    return normalized or None
