> [!IMPORTANT]
> ARCHIVED (Historical)
>
> This document is retained for historical context only and is **not canonical**.
> The canonical source of truth for priorities and definitions of done is **/MASTER_PLAN.md**.
> Roadmaps in **/ROADMAP.md** and **/UI_ROADMAP.md** are reference-only unless promoted in MASTER_PLAN.

# V4.0 — Farm-to-Fork Traceability Engine (Recall Saver)

**Status**: Vision / Architecture Plan (no code)

## Why this matters
A USDA/FDA recall is an existential risk if we cannot answer, in minutes:
- **Where did this lot go?**
- **What did it become?** (rework, blending, repack)
- **Who received it?** (customer + location + shipment)
- **What else is impacted?** (“blast radius”)

The moat: fast, auditable traceability that can produce a **USDA‑compliant recall report** from a single lot/incident.

## Current architecture snapshot (as‑is)
- **Backend**: Django + DRF, shared‑schema multi‑tenancy
- **Tenant isolation**: `tenant` FK + PostgreSQL RLS (`app.current_tenant`)
- **Async**: Celery + Redis
- **Extensibility**: tenant webhooks + API keys (for outward notifications)

## Current data model gaps
ProjectMeats has strong business entities (products, plants, POs/SOs, carriers) but **does not yet model physical traceability primitives**:
- “Lot / batch / case / pallet” identity
- Transformations (split, blend, rework, repack)
- Shipment lineage (what lots moved on which shipment)

This engine proposes new **lot lineage** models + fast query patterns.

---

## Proposed design: “Lot Lineage Graph” inside Postgres
We can achieve graph‑like queries without adding a new datastore by introducing **event edges** and using **recursive CTEs**.

### Core concept
Represent traceability as a directed acyclic graph (DAG):
- Nodes: **lots** (inputs/outputs)
- Edges: **transformations** (blend/split/rework) and **movements** (ship/receive)

### New tenant-aware models (Phase 1)
> All models inherit `TenantAwareModel` and must ship with RLS policies.

#### 1) `InventoryLot`
Represents a uniquely traceable lot (or sub-lot) of a product.
- `tenant`
- `id` (uuid)
- `lot_code` (string, indexed, unique per tenant)
- `master_product` → `products.MasterProduct`
- `source_supplier` → `suppliers.Supplier` (nullable)
- `produced_at` (datetime, nullable)
- `received_at` (datetime, nullable)
- `expires_on` (date, nullable)
- `uom`, `quantity_on_hand`, `quantity_initial`
- `qa_status` (enum: ok/quarantine/recalled/destroyed)
- optional: `plant_est_num_snapshot` for compliance snapshots

#### 2) `LotEvent`
Append‑only event ledger for traceability.
- `tenant`
- `id` (uuid)
- `event_type` (enum: RECEIVE, TRANSFORM, SHIP, ADJUST, QUARANTINE, RECALL)
- `occurred_at`
- `actor_user` (nullable)
- `location` → plant/location reference (nullable)
- `metadata` (json)

#### 3) `LotEdge`
Edge from an input lot to an output lot with a quantity.
- `tenant`
- `event` → `LotEvent`
- `input_lot` → `InventoryLot`
- `output_lot` → `InventoryLot`
- `quantity_in`, `quantity_out` (or `ratio`)

#### 4) `ShipmentLot`
Joins lots to shipments / fulfillment records.
- `tenant`
- `shipment` → fulfillment/shipment model (or new `Shipment`)
- `lot` → `InventoryLot`
- `quantity`
- `customer` + `customer_location`

> Note: If shipments are not modeled in enough detail yet, Phase 1 can attach `ShipmentLot` to Sales Orders + delivery locations.

### Why an event ledger + edges?
- Fast blast radius queries (recursive traversal)
- Works with relational storage + RLS
- Gives strong auditability (“who created/edited traceability entries”)

---

## Blast Radius Analysis (recursive query)
Given a flagged lot, we need to trace forward to:
- downstream lots produced from it
- shipments that contained those lots
- customers/locations impacted

### Forward traversal (downstream)
Pseudo‑SQL:
```sql
WITH RECURSIVE downstream AS (
  SELECT
    le.input_lot_id,
    le.output_lot_id,
    1 AS depth
  FROM lot_edge le
  WHERE le.tenant_id = :tenant
    AND le.input_lot_id = :root_lot

  UNION ALL

  SELECT
    le.input_lot_id,
    le.output_lot_id,
    d.depth + 1
  FROM lot_edge le
  JOIN downstream d
    ON le.input_lot_id = d.output_lot_id
  WHERE le.tenant_id = :tenant
    AND d.depth < :max_depth
)
SELECT * FROM downstream;
```

### Shipments + customer locations
```sql
SELECT DISTINCT
  sl.customer_id,
  sl.customer_location_id,
  sl.shipment_id,
  sl.lot_id
FROM shipment_lot sl
WHERE sl.tenant_id = :tenant
  AND sl.lot_id IN (:root_lot, :downstream_lot_ids);
```

### Backward traversal (upstream)
Same pattern, reverse join (`output_lot_id → input_lot_id`) to answer “where did this come from?”

### Performance considerations
- Indexes:
  - `lot_edge(tenant_id, input_lot_id)`
  - `lot_edge(tenant_id, output_lot_id)`
  - `inventory_lot(tenant_id, lot_code)`
  - `shipment_lot(tenant_id, lot_id)`
- Precompute cached closures for very large graphs (optional Phase 2): `lot_closure` table updated asynchronously.

---

## API design
All endpoints are tenant‑scoped + permission‑gated (compliance officer / tenant admin).

- `GET /api/v1/traceability/lots/?q=<lot_code>`
- `GET /api/v1/traceability/lots/<id>/` (details + QA status)
- `GET /api/v1/traceability/lots/<id>/blast-radius/?depth=10`
  - returns: downstream lots + impacted shipments + customers/locations
- `GET /api/v1/traceability/lots/<id>/upstream/?depth=10`
- `POST /api/v1/traceability/recalls/` (creates recall report artifact)

### Recall report artifact
- store a generated report as:
  - immutable JSON payload (for audit)
  - optional PDF export
  - references to lots + shipments

---

## UI/UX: Traceability Dashboard
### Primary workflows
1) **Search Lot**
- search bar: lot_code / supplier / product
- status pill: OK / Quarantine / Recalled

2) **Blast Radius View**
- Summary cards:
  - impacted lots count
  - impacted shipments count
  - impacted customer locations count
  - earliest/latest ship dates
- Tabs:
  - Impacted Customers/Locations (table + CSV export)
  - Impacted Shipments (table)
  - Lineage Graph (collapsible tree / graph)
  - Audit Trail (who marked recall/quarantine)

3) **One‑click USDA Recall Report**
- generates a standardized report:
  - product name
  - lot codes
  - supplier + plant establishment number
  - list of recipients (customer location addresses)
  - timeline of events

### Accessibility / performance
- Tables virtualized for large lists
- Export to CSV using existing streaming export patterns

---

## Rollout plan
### Phase 1 (MVP)
- Model `InventoryLot`, `LotEvent`, `LotEdge`, `ShipmentLot`
- Basic blast radius + upstream endpoints
- Dashboard with tables + CSV export

### Phase 2 (Scale)
- Asynchronous closure cache
- Partial lot tracing (quantity propagation)
- Integrate with webhooks: emit `traceability.recall.created`

### Phase 3 (Interop)
- Integrate with inbound EDI/ASN to auto-create lot events

---

## Open questions (to validate with QA/compliance)
- What minimum fields are required for a USDA‑compliant recall packet per product class?
- Do we need case‑level traceability (SSCC/pallet IDs) for target customers?
- Do we need lot commingling rules (blend percentages) to determine partial recalls?
