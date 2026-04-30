# Schema Verification

## Status

Implemented the additive "golden schema" refactor that could be verified from the repo and the explicit directive. The referenced Excel workbooks are **not present in this repository**, so exact workbook-to-ORM parity remains partially blocked.

## Verified source constraints

1. Shared-schema multi-tenancy only
2. Additive-only migrations
3. Tenant-aware business models with RLS on new tenant-scoped tables
4. Existing `CarrierPurchaseOrder` reused as the canonical Carrier PO / freight-order header instead of introducing a second overlapping freight table

## Implemented field and model mapping

| Domain | Implemented canonical shape | Compatibility preserved |
| --- | --- | --- |
| Carrier | `FinancialTermsMixin` on `tenant_apps.carriers.models.Carrier` adds canonical `payment_terms`, `credit_limit`, `account_line_of_credit` | Legacy `accounting_payment_terms` and `credit_limits` remain and sync from canonical fields |
| Customer | `FinancialTermsMixin` on `tenant_apps.customers.models.Customer` adds canonical `payment_terms`, `credit_limit`, `account_line_of_credit` | Legacy `accounting_payment_terms` and `credit_limits` remain |
| Supplier | `FinancialTermsMixin` on `tenant_apps.suppliers.models.Supplier` adds canonical `payment_terms`, `credit_limit`, `account_line_of_credit` | Legacy `accounting_payment_terms` and `credit_limits` remain |
| Purchase Order | `PurchaseOrder` now consumes logistics + billing/shipping snapshot primitives and adds `our_purchase_order_number_to_supplier`, `my_customer_number_from_supplier`, `supplier_confirmation_order_number`, `carrier_release_number`, `how_to_make_appointment` | Legacy `our_purchase_order_num`, `supplier_confirmation_order_num`, `carrier_release_num`, `how_carrier_make_appointment` remain and sync |
| Sales Order | `SalesOrder` now consumes logistics + billing/shipping snapshot primitives and adds `our_sales_order_number_for_customer`, `delivery_po_number`, `carrier_release_number`, `how_to_make_appointment` | Legacy `our_sales_order_num`, `delivery_po_num`, `carrier_release_num` remain and sync |
| Carrier PO / Freight Order | Existing `CarrierPurchaseOrder` is the canonical freight header; API now exposes it at `/api/v1/carrier-pos/` and serializer presents canonical `purchase_order` input/output over model field `linked_order` | Existing table and legacy fields remain intact |
| Invoice | `Invoice` now consumes AP + billing/shipping snapshot primitives and logistics primitives, plus canonical `our_sales_order_number_for_customer` and `delivery_po_number` | Legacy `our_sales_order_num`, `delivery_po_num`, and existing AP fields remain and sync |

## Shared primitives added

Implemented in `backend/apps/core/model_mixins.py`:

1. `ContactSnapshotMixin`
2. `AddressSnapshotMixin`
3. `FinancialTermsMixin`
4. `LogisticsMixin`
5. `BaseLineItem`
6. Prefixed snapshot variants for billing, shipping, and accounts-payable contexts

## Transactional line-item coverage

| Header | New item model | Tenant-aware | RLS policy |
| --- | --- | --- | --- |
| Purchase Order | `PurchaseOrderItem` | Yes (`BaseLineItem`) | Yes |
| Sales Order | `SalesOrderItem` | Yes (`BaseLineItem`) | Yes |
| Carrier PO | `CarrierPOItem` | Yes (`BaseLineItem`) | Yes |
| Invoice | `InvoiceItem` | Yes (`BaseLineItem`) | Yes |

Shared item fields implemented:

1. `protein_type`
2. `product_description` (`system.Product` FK)
3. `fresh_or_frozen`
4. `package_type`
5. `quantity`
6. `uom`
7. `net_or_catch`
8. `edible_or_inedible`
9. `tested_product`
10. `total_net_weight`

## API exposure verified in code

1. Master-data serializers now expose canonical financial fields alongside legacy aliases.
2. Purchase order, sales order, invoice, and carrier PO serializers expose:
   - canonical logistics fields
   - immutable snapshot fields
   - nested line items
3. New Carrier PO route is registered in `backend/tenant_apps/purchase_orders/urls.py`.

## Migrations generated

Generated additive migrations:

1. `tenant_apps/carriers/migrations/0009_golden_schema_refactor.py`
2. `tenant_apps/customers/migrations/0016_golden_schema_refactor.py`
3. `tenant_apps/suppliers/migrations/0020_golden_schema_refactor.py`
4. `tenant_apps/purchase_orders/migrations/0018_golden_schema_refactor.py`
5. `tenant_apps/sales_orders/migrations/0016_golden_schema_refactor.py`
6. `tenant_apps/invoices/migrations/0015_golden_schema_refactor.py`

## Remaining exact-match gaps

These remain blocked until the source Excel files are supplied:

1. Exact field ordering/parity against the five Golden Standard workbooks
2. Confirmation that every workbook-only field has been represented
3. Verification that no workbook-only enum labels differ from current Django choice labels

## Non-schema follow-up noted during verification

The repo still has unrelated OpenAPI baseline drift outside this refactor:

1. `AIDocument` now requires `processing_metadata` and `source_metadata`
2. Baseline expects `TypeOfProteinEnum`
3. Baseline expects `UserNotificationPriorityEnum`

Those issues pre-existed in the current worktree and were not introduced by this schema refactor.
