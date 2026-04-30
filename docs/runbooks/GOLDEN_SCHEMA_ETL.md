# Golden Schema ETL Runbook

## Goal
- Import historical Excel/CSV/database-export data into the Golden Schema without manual re-entry.
- Keep ETL tenant-explicit, dry-run-first, and side-effect-free until operators choose to execute.
- Give GA-01.2 a deterministic contract for journal storage, row transforms, and reconciliation.

## What ships in GA-01.1
1. Contract-only backend scaffolding in `backend/apps/core/services/etl/`.
2. `import_golden_legacy_data` management command that validates a batch manifest and prints the deterministic import plan.
3. Example batch manifest fixture for a legacy Excel/CSV bundle.
4. This runbook, which is the operator/design reference for the next ETL tickets.

## What ships in GA-01.2
1. Restart-safe ETL journal tables in `backend/apps/core/models.py`.
2. A dry-run engine that journals row decisions (`would_create`, `would_update`, `would_skip`, `error`) without writing business rows.
3. Deterministic rerun behavior keyed by tenant + manifest checksum + dry-run options.
4. Command output that persists batch summaries and row journals for operator review before GA-01.3 introduces write-capable passes.

## Non-goals
- No write-capable master-data or transactional imports yet.
- No webhook/email/signal-driven runtime side effects.
- No Phase 15 partner portal, conversion, or settlement work.

## Deliverables + expected results
1. **Deterministic entity order**
   - Master data loads before transactional headers.
   - Transactional headers load before line items.
2. **Canonical Golden field groups**
   - Reusable mapping groups for financial terms, logistics, snapshot fields, and line items mirror the Golden Schema mixins.
3. **Tenant-explicit batch manifests**
    - Every ETL batch declares a tenant selector before any future write mode can run.
4. **Side-effect suppression contract**
    - Execute-mode ETL must suppress runtime emails, partner webhooks, notification fan-out, and async sync dispatch.
5. **Restart-safe dry-run journals**
   - Batch-level and row-level journals persist deterministic dry-run classifications so operators can rerun the same manifest safely.

## Deterministic import order
### Master data
1. `locations`
2. `plants`
3. `suppliers`
4. `customers`
5. `carriers`
6. `contacts`
7. `products`

### Transactional data
1. `purchase_orders`
2. `purchase_order_items`
3. `sales_orders`
4. `sales_order_items`
5. `carrier_purchase_orders`
6. `carrier_po_items`
7. `invoices`
8. `invoice_items`

## Mapping contract by entity
| Entity | Target model | Identity / dedupe keys | Canonical field groups |
| --- | --- | --- | --- |
| `locations` | `tenant_apps.locations.models.Location` | `name`, `city`, `state_zip` | `contact_snapshot` |
| `plants` | `tenant_apps.locations.models.Location` (plant-typed rows) | `name`, `plant_est_number` | `contact_snapshot` |
| `suppliers` | `tenant_apps.suppliers.models.Supplier` | `name`, `email` | `financial_terms` |
| `customers` | `tenant_apps.customers.models.Customer` | `name`, `email` | `financial_terms` |
| `carriers` | `tenant_apps.carriers.models.Carrier` | `code`, `name` | `financial_terms` |
| `contacts` | `tenant_apps.contacts.models.Contact` | `email`, `phone`, `name` | none |
| `products` | `apps.system.models.Product` | `product_code` | none |
| `purchase_orders` | `tenant_apps.purchase_orders.models.PurchaseOrder` | `order_number` | `logistics`, `billing_*`, `shipping_*` |
| `purchase_order_items` | `tenant_apps.purchase_orders.models.PurchaseOrderItem` | `purchase_order`, `line_number` | `base_line_item` |
| `sales_orders` | `tenant_apps.sales_orders.models.SalesOrder` | `our_sales_order_number_for_customer` | `logistics`, `billing_*`, `shipping_*` |
| `sales_order_items` | `tenant_apps.sales_orders.models.SalesOrderItem` | `sales_order`, `line_number` | `base_line_item` |
| `carrier_purchase_orders` | `tenant_apps.purchase_orders.models.CarrierPurchaseOrder` | `our_carrier_po_num` | `logistics`, `billing_*`, `shipping_*` |
| `carrier_po_items` | `tenant_apps.purchase_orders.models.CarrierPOItem` | `carrier_purchase_order`, `line_number` | `base_line_item` |
| `invoices` | `tenant_apps.invoices.models.Invoice` | `invoice_number` | `logistics`, `accounts_payable_*`, `billing_*`, `shipping_*` |
| `invoice_items` | `tenant_apps.invoices.models.InvoiceItem` | `invoice`, `line_number` | `base_line_item` |

## Batch manifest contract
Each legacy import batch must provide a JSON manifest before execute mode is allowed.

### Required top-level fields
- `batch_name`
- `source_system`
- `sources`
- one of `tenant_slug` or `tenant_id`

### Source entry fields
- `entity`
- `format` (`csv`, `xlsx`, `json`, `database_export`)
- `path`
- optional `sheet`
- optional `notes`

Rows for GA-01.2 dry runs must already use canonical field names that match the Golden Schema ETL contract. Richer source-to-canonical transforms are deferred to GA-01.3/GA-01.4.

### Example
```json
{
  "batch_name": "acme-q1-history",
  "source_system": "legacy_excel_bundle",
  "tenant_slug": "acme-meats",
  "sources": [
    {
      "entity": "suppliers",
      "format": "xlsx",
      "path": "imports/acme/suppliers.xlsx",
      "sheet": "Suppliers"
    },
    {
      "entity": "purchase_orders",
      "format": "xlsx",
      "path": "imports/acme/purchase_orders.xlsx",
      "sheet": "Purchase Orders"
    }
  ]
}
```

## Tenant ownership assertion
1. Every batch manifest must declare `tenant_slug` or `tenant_id`.
2. The management command must resolve that selector to a real `Tenant` before preview/execute work continues.
3. When GA-01.2 adds row transforms and journals, all tenant-scoped ORM in management commands or background work must run inside `tenant_rls(...)`.
4. The ETL engine must never infer tenant ownership from spreadsheet contents alone.

## Side-effect suppression rules
When execute mode is added, the ETL path must suppress:
1. outbound emails
2. integration webhooks
3. notification fan-out
4. background sync dispatch

The import path should rely on an explicit ETL journal/reconciliation surface instead of normal runtime side effects.

## Dry-run journal contract (GA-01.2)
### Batch journal model
- `ETLImportBatch`
- tenant-aware, restart-safe run header keyed by manifest checksum + dry-run options
- stores:
  - manifest payload/checksum
  - command options
  - counters (`would_create`, `would_update`, `would_skip`, `error`)
  - summary payload
  - resume cursor / checkpoint metadata

### Row journal model
- `ETLImportRowJournal`
- one row per source-path + source-sheet + source-row-number within a batch
- stores:
  - `source_identifier`
  - `normalized_lookup_key`
  - `planned_action`
  - `target_model`
  - `target_identifier`
  - `error_code`
  - `error_message`
  - `raw_payload`
  - `normalized_payload`
  - `warnings`

### Dry-run execution rules
1. Resolve the tenant from the manifest, then run all tenant-aware ORM under `tenant_rls(...)`.
2. Persist only ETL journal tables; do not create or update supplier/customer/order/invoice rows.
3. Re-running the same manifest for the same tenant must reuse the existing batch and upsert the same row journals instead of duplicating them.

## Planned journal + error report contract
### Import journal fields
- `batch_id`
- `batch_name`
- `tenant_id`
- `tenant_slug`
- `source_system`
- `entity`
- `source_path`
- `source_sheet`
- `source_row_number`
- `source_identifier`
- `normalized_lookup_key`
- `planned_action`
- `target_model`
- `target_identifier`
- `status`
- `error_code`
- `error_message`
- `side_effects_suppressed`

### Error report fields
- `entity`
- `source_path`
- `source_sheet`
- `source_row_number`
- `source_identifier`
- `error_code`
- `error_message`
- `canonical_field`

## Dependencies
1. GA-01.1 defines the contract only.
2. GA-01.2 adds journal storage + dry-run transforms.
3. GA-01.3 should add write-capable master-data import.
4. GA-01.4 should add transactional import + reconciliation output.

## Risk register + mitigations
1. **Cross-tenant import risk** (High x High)
   - Mitigation: tenant selector required in every manifest and tenant resolution before any future write mode.
2. **Legacy spreadsheet drift** (High x Medium)
   - Mitigation: keep manifest-driven source declarations and explicit field-group contracts instead of hard-coding one spreadsheet shape.
3. **ETL accidentally triggers runtime side effects** (High x High)
   - Mitigation: side-effect suppression rules are part of the contract before execute mode exists.

## Testing strategy
1. `bash scripts/verify_golden_state.sh`
2. `bash .github/scripts/check_infrastructure.sh`
3. `cd backend && python manage.py test apps.core.tests.test_golden_schema_etl_contracts apps.core.tests.test_golden_schema_etl_journal apps.core.tests.test_import_golden_legacy_data_command --verbosity 2`
4. `cd backend && python manage.py makemigrations --check`

## Rollback / safe-change approach
1. Revert the ETL contract module, management command, tests, and this runbook together.
2. No data rollback is required in GA-01.1 because no import writes occur.
