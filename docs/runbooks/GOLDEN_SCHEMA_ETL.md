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

## Non-goals
- No row transforms yet.
- No bulk writes into business tables yet.
- No import journal model or reconciliation persistence yet.

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

## Planned journal + error report contract (GA-01.2)
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
2. GA-01.2 should add journal storage + dry-run transforms.
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
3. `cd backend && python manage.py test apps.core apps.tenants`
4. `cd backend && python manage.py makemigrations --check`

## Rollback / safe-change approach
1. Revert the ETL contract module, management command, tests, and this runbook together.
2. No data rollback is required in GA-01.1 because no import writes occur.
