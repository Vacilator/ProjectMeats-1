# Golden Schema ETL Runbook

**Status:** GA-01.1 scaffold only  
**Contract version:** `ga01.1.v1`

This runbook defines the **normalized import contract** for the Day 0 ETL lane. It does **not** execute writes yet. GA-01.1 establishes the manifest shape, entity ordering, tenant-assertion rules, side-effect suppression rules, and the journal/error-report shapes that GA-01.2 will persist.

## Scope and current constraint

- The repository does **not** currently contain the real customer ERP workbooks or exports.
- GA-01.1 therefore standardizes a **normalized source contract** that adapters must produce before import execution.
- Raw workbook headers can vary, but the normalized keys and model targets below are the canonical import surface.

## Command entrypoint

```bash
cd backend
python manage.py import_golden_legacy_data \
  --tenant-id <tenant-uuid> \
  --source-manifest apps/core/tests/fixtures/etl/source_manifest.json
```

Current behavior:
- validates the JSON source manifest
- requires explicit tenant assertion
- asserts tenant RLS context
- prints the dry-run contract summary
- writes **no** business rows, history rows, or ETL journal rows

## Tenant assertion and fail-closed rules

1. The operator must provide `--tenant-id` or `--tenant-slug`.
2. The manifest may also assert `tenant_id` and/or `tenant_slug`.
3. If the manifest tenant and command tenant differ, the command fails closed.
4. Any future tenant-scoped ORM must run inside `with tenant_rls(str(tenant.id), strict=True):`
5. Every resolved tenant-aware FK must still be filtered with `tenant=tenant`.

## Required side-effect suppression

Future ETL passes must suppress all of the following during dry-run and initial write modes:

- `model_signals`
- `purchase_order_history`
- `tenant_cache_bumps`
- `emails`
- `webhooks`
- `celery_tasks`

This is necessary because current business models already have save-time behavior that is correct for interactive app usage but unsafe for bulk ETL.

## Source manifest shape

```json
{
  "version": 1,
  "batch_key": "sample-day-0-batch",
  "tenant": {
    "tenant_id": null,
    "tenant_slug": null,
    "asserted_by": "command"
  },
  "files": [
    {
      "entity": "suppliers",
      "format": "csv",
      "relative_path": "suppliers.csv",
      "sheet_name": null,
      "header_row": 1,
      "line_item_entity": null,
      "source_document_key_column": null,
      "source_line_number_column": null
    }
  ]
}
```

Supported formats: `csv`, `xls`, `xlsx`

## Deterministic entity order

### Master-data order

`products -> plants -> locations -> suppliers -> customers -> carriers -> contacts`

### Transaction-header order

`purchase_orders -> sales_orders -> invoices -> carrier_pos`

### Line-item linkage

| Header entity | Line-item entity | Parent FK |
| --- | --- | --- |
| purchase_orders | purchase_order_items | purchase_order |
| sales_orders | sales_order_items | sales_order |
| invoices | invoice_items | invoice |
| carrier_pos | carrier_po_items | carrier_purchase_order |

## Normalized entity contracts

The following entities are part of the GA-01.1 contract surface:

### Master data

| Entity | Target model | Primary match keys | Key normalized fields |
| --- | --- | --- | --- |
| products | `apps.system.models.product.Product` | `product_code` | `product_code`, `name`, `description`, `category`, `protein_type`, `fresh_or_frozen`, `package_type`, `carton_type`, `unit_weight`, `uom`, `pcs_per_carton`, `namp_code`, `usda_code`, `ub_code`, `edible_or_inedible`, `net_or_catch`, `tested_product`, `is_active` |
| plants | `tenant_apps.plants.models.Plant` | `plant_est_num`, `(supplier_source_key, name)` | `supplier_source_key`, `name`, `plant_est_num`, `plant_type`, `address`, `city`, `state`, `zip_code`, `country`, `booking_contact_email`, `booking_contact_phone`, `capacity`, `is_active` |
| locations | `tenant_apps.locations.models.Location` | `code`, `plant_est_num`, `(name, city, state)` | `code`, `name`, `location_type`, `address`, `city`, `state`, `zip_code`, `country`, `phone`, `email`, `contact_name`, `supplier_source_key`, `customer_source_key`, `plant_est_num`, `is_active` |
| suppliers | `tenant_apps.suppliers.models.Supplier` | `name`, `email`, `phone` | `name`, `contact_person`, `email`, `phone`, `street_address`, `city`, `state`, `zip_code`, `country`, `payment_terms`, `credit_limit`, `account_line_of_credit`, `shipping_offered`, `how_to_book_pickup`, `offer_contracts`, `offers_export_documents`, `plant_location_source_key` |
| customers | `tenant_apps.customers.models.Customer` | `name`, `email`, `phone` | `name`, `contact_person`, `email`, `phone`, `street_address`, `city`, `state`, `zip_code`, `country`, `payment_terms`, `credit_limit`, `account_line_of_credit`, `industry`, `type_of_certificate`, `will_pickup_load`, `plant_location_source_key` |
| carriers | `tenant_apps.carriers.models.Carrier` | `code`, `mc_number`, `dot_number`, `name` | `code`, `name`, `carrier_type`, `contact_person`, `phone`, `email`, `address`, `city`, `state`, `zip_code`, `country`, `mc_number`, `dot_number`, `payment_terms`, `credit_limit`, `how_to_make_appointment`, `my_customer_num_from_carrier` |
| contacts | `tenant_apps.contacts.models.Contact` | `email`, `(first_name, last_name, company)`, `(first_name, last_name, phone)` | `first_name`, `last_name`, `email`, `phone`, `phone_type`, `company`, `title`, `department`, `notes`, `supplier_source_key`, `customer_source_key`, `plant_source_key`, `location_source_key` |

### Transaction headers

| Entity | Target model | Primary match keys | Key normalized fields |
| --- | --- | --- | --- |
| purchase_orders | `tenant_apps.purchase_orders.models.PurchaseOrder` | `order_number`, `our_purchase_order_number_to_supplier` | `order_number`, `supplier_source_key`, `product_code`, `status`, `payment_status`, `order_date`, `delivery_date`, `total_amount`, `outstanding_amount`, `our_purchase_order_number_to_supplier`, `my_customer_number_from_supplier`, `supplier_confirmation_order_number`, `carrier_source_key`, `carrier_release_number`, `how_to_make_appointment`, billing/shipping snapshot fields, `notes` |
| sales_orders | `tenant_apps.sales_orders.models.SalesOrder` | `our_sales_order_num`, `our_sales_order_number_for_customer` | `our_sales_order_num`, `our_sales_order_number_for_customer`, `supplier_source_key`, `customer_source_key`, `carrier_source_key`, `product_code`, `plant_location_source_key`, `pickup_location_source_key`, `delivery_location_source_key`, `contact_source_key`, `delivery_po_number`, `carrier_release_number`, `how_to_make_appointment`, `quantity`, `total_weight`, `weight_unit`, `status`, `payment_status`, `outstanding_amount`, `total_amount`, billing/shipping snapshot fields, `notes` |
| invoices | `tenant_apps.invoices.models.Invoice` | `invoice_number` | `invoice_number`, `customer_source_key`, `sales_order_source_key`, `product_code`, `due_date`, `our_sales_order_number_for_customer`, `delivery_po_number`, `payment_terms`, `carrier_release_number`, `how_to_make_appointment`, `type_of_protein`, `description_of_product_item`, `quantity`, `total_weight`, `weight_unit`, `edible_or_inedible`, `tested_product`, `unit_price`, `total_amount`, `tax_amount`, `status`, `payment_status`, `outstanding_amount`, AP/billing/shipping snapshot fields |
| carrier_pos | `tenant_apps.purchase_orders.models.CarrierPurchaseOrder` | `our_carrier_po_num` | `our_carrier_po_num`, `carrier_source_key`, `supplier_source_key`, `plant_location_source_key`, `pickup_location_source_key`, `delivery_location_source_key`, `product_code`, `purchase_order_source_key`, `sales_order_source_key`, `carrier_name`, `payment_terms`, `credit_limits`, `carrier_release_number`, `how_to_make_appointment`, `type_of_protein`, `fresh_or_frozen`, `package_type`, `net_or_catch`, `edible_or_inedible`, `total_weight`, `weight_unit`, `quantity`, `departments_of_carrier` |

### Transaction line items

| Entity | Target model | Header linkage | Key normalized fields |
| --- | --- | --- | --- |
| purchase_order_items | `tenant_apps.purchase_orders.models.PurchaseOrderItem` | `document_number -> purchase_orders.order_number` | `document_number`, `line_number`, `product_code`, `protein_type`, `fresh_or_frozen`, `package_type`, `quantity`, `uom`, `net_or_catch`, `edible_or_inedible`, `tested_product`, `total_net_weight`, `notes` |
| sales_order_items | `tenant_apps.sales_orders.models.SalesOrderItem` | `document_number -> sales_orders.our_sales_order_num` | `document_number`, `line_number`, `product_code`, `protein_type`, `fresh_or_frozen`, `package_type`, `quantity`, `uom`, `net_or_catch`, `edible_or_inedible`, `tested_product`, `total_net_weight`, `notes` |
| invoice_items | `tenant_apps.invoices.models.InvoiceItem` | `document_number -> invoices.invoice_number` | `document_number`, `line_number`, `product_code`, `protein_type`, `fresh_or_frozen`, `package_type`, `quantity`, `uom`, `net_or_catch`, `edible_or_inedible`, `tested_product`, `total_net_weight`, `unit_price`, `line_total` |
| carrier_po_items | `tenant_apps.purchase_orders.models.CarrierPOItem` | `document_number -> carrier_pos.our_carrier_po_num` | `document_number`, `line_number`, `product_code`, `protein_type`, `fresh_or_frozen`, `package_type`, `quantity`, `uom`, `net_or_catch`, `edible_or_inedible`, `tested_product`, `total_net_weight`, `notes` |

## Canonical targeting rules

- Suppliers, customers, and carriers target canonical financial fields such as `payment_terms` and `credit_limit`, not legacy aliases like `accounting_payment_terms` or `credit_limits`.
- Purchase orders, sales orders, and invoices target canonical logistics aliases such as `carrier_release_number`, `how_to_make_appointment`, `our_purchase_order_number_to_supplier`, and `delivery_po_number`.
- `carrier_pos` currently keeps the existing `credit_limits` field because that model does not yet expose a canonical `credit_limit` alias.
- Product lookups use `system.Product` by `product_code`. Unknown products should be treated as match failures until a later ticket defines a safe create path.
- `carrier_pos` uses the existing `CarrierPurchaseOrder` model. Do not introduce a second freight-order header.

## Journal and error-report shapes

GA-01.2 will persist journals, but the shape is already fixed now:

- **Batch journal**: `batch_key`, tenant identity, mode, contract version, manifest checksum, suppressed side effects, ownership assertion source, status, aggregate counts
- **Row journal**: entity, source file, sheet name, source row number, source document key, source line number, dedupe key, action, target model, target pk, error code, error message

Stable error codes:

- `missing_tenant`
- `tenant_mismatch`
- `foreign_tenant_reference`
- `missing_required_field`
- `unknown_choice`
- `ambiguous_match`
- `not_found`
- `duplicate_source_key`
- `orphan_line_item`
- `header_without_items`
- `global_product_create_disallowed`

## Safe rollout and rollback

- GA-01.1 introduces **no migrations** and **no imported rows**.
- Rollback is a straight revert of the ETL scaffold, tests, and this runbook.
- Future journal persistence must be additive, tenant-aware, and include PostgreSQL RLS policy updates.

## Next files for GA-01.2+

GA-01.1 establishes the first deterministic implementation surfaces:

- `backend/apps/core/services/etl/contracts.py`
- `backend/apps/core/services/etl/mapping_registry.py`
- `backend/apps/core/services/etl/context.py`
- `backend/apps/core/management/commands/import_golden_legacy_data.py`
- `backend/apps/core/tests/test_etl_contracts.py`
- `backend/apps/core/tests/test_import_golden_legacy_data_command.py`
