> [!IMPORTANT]
> ARCHIVED (Historical)
>
> This document is retained for historical context only and is **not canonical**.
> The canonical source of truth for priorities and definitions of done is **/MASTER_PLAN.md**.
> Roadmaps in **/ROADMAP.md** and **/UI_ROADMAP.md** are reference-only unless promoted in MASTER_PLAN.

# V4.0 Ideal State — Competitor Gap Analysis (Tier‑1 Enterprise)

**Status**: Vision / Architecture Plan (no code)

## Why this document exists
ProjectMeats is approaching “mechanically sound” (tests, RBAC, RLS, performance hardening). V4.0 is about **Tier‑1 enterprise capability**: self‑service, analytics, field operations, and finance automation.

## Scope
Four pillars of modern enterprise supply‑chain SaaS:
1. **B2B Client Portal (Self‑Service)**
2. **Embedded BI & Predictive Analytics**
3. **Logistics & IoT Integration (Cold Chain)**
4. **Automated Financial Reconciliation**

## Assumptions (explicit)
If product leadership hasn’t prioritized pillars yet, default sequencing assumption:
1) Automated Financial Reconciliation
2) Field Operations
3) B2B Client Portal
4) Predictive Analytics

These are assumptions and should be reordered based on real user pain.

## Current Architecture Snapshot (as‑is)
- **Backend**: Django + DRF (shared schema multi‑tenancy)
- **Tenant isolation**: `tenant` FK + PostgreSQL RLS policies using `app.current_tenant`
- **Async**: Celery + Redis broker
- **Realtime**: Channels (WebSockets) foundation
- **Observability**: Sentry integrated
- **Extensibility foundation**: Tenant webhooks + API keys (see PR #4306)

## Pillar 1 — B2B Client Portal (Self‑Service)
### What Tier‑1 systems provide
- Customer users log in (role‑scoped) to:
  - View live inventory & availability
  - See **contracted pricing** (customer‑specific)
  - Place orders / reorder from history
  - Track fulfillment and invoices
  - Download docs (COA, BOL, invoice PDFs)

### Gaps to close
- **Customer identity**: portal users tied to customer accounts + roles
- **Pricing engine**: contract pricing, price lists, overrides, effective dates
- **Portal UX**: curated, limited workflows (not “internal cockpit”) 

### Proposed backend modules
**New/extended models** (tenant‑aware where applicable):
- `CustomerPortalUser` (maps auth user ↔ customer, role, permissions)
- `CustomerPriceList` + `CustomerPriceRule`
- `CustomerCatalogVisibility` (which products/inventory items a customer can see)
- `PortalOrderDraft` (optional, if diverging from internal SO flow)

**API endpoints** (read/write constrained by portal role):
- `GET /api/v1/portal/me/`
- `GET /api/v1/portal/catalog/`
- `GET /api/v1/portal/pricing/`
- `POST /api/v1/portal/orders/` (creates Sales Order or draft)
- `GET /api/v1/portal/orders/`

### Frontend modules
- `frontend/src/portal/` (separate route tree + layout)
- Shared “entity views” must be reused via safe components (no admin-only controls)

### Security / tenancy requirements
- Every portal endpoint must:
  - enforce `tenant=request.tenant`
  - enforce role scoping (customer portal roles)
  - remain RLS‑protected at DB level

## Pillar 2 — Embedded BI & Predictive Analytics
### What Tier‑1 systems provide
- Embedded dashboards with drill‑downs
- Forecasting (demand, stockouts)
- Profitability per shipment / customer / supplier

### Gaps to close
- A consistent **analytics layer** (metrics definitions, cache, rollups)
- Data quality signals (confidence + missingness)

### Proposed backend modules
- `apps.analytics/` (system‑level) + `tenant_apps/analytics/` (tenant data models) if needed
- Metric definition registry:
  - `MetricDefinition` (name, SQL template, dimensions)
  - `MetricSnapshot` (tenant, metric, interval, values)

### Data pipeline choices
- Phase 1: DB‑native rollups + Celery scheduled snapshots
- Phase 2: Optional warehouse / OLAP (ClickHouse/BigQuery) if needed

### UI modules
- `frontend/src/components/Analytics/` dashboards
- Standard drilldown navigation patterns (consistent with Cockpit)

## Pillar 3 — Logistics & IoT (Cold Chain)
### What Tier‑1 systems provide
- Carrier location, ETA prediction
- Reefer temperature logs and alerts
- Exceptions workflow (claims, disputes)

### Gaps to close
- Integration adapters for telematics providers
- Normalized telemetry storage and alerting

### Proposed backend modules
- `tenant_apps/telematics/`
  - `TelemetryProvider` (tenant, provider type, auth)
  - `Vehicle` / `Trailer`
  - `ShipmentTrackingSession` (links SO/PO/Fulfillment to tracking)
  - `TelemetryPoint` (timestamped location/temp)

### Async + alerts
- Celery tasks poll or receive webhooks from providers
- Use tenant webhooks (PR #4306) for outbound alerts to customers/ERPs

## Pillar 4 — Automated Financial Reconciliation
### What Tier‑1 systems provide
- **Three‑way matching**: PO + Receiving + Invoice
- Discrepancy detection
- Approval workflows + audit trail

### Gaps to close
- Receiving reports as first‑class records
- Matching engine + rules

### Proposed backend models
- `ReceivingReport` (per PO / line item)
- `VendorInvoice` (captured from uploads / email ingestion)
- `MatchResult` (per invoice line ↔ PO line)
- `DiscrepancyCase` (workflow object)

### Proposed services
- `MatchingService`:
  - match by SKU/product, quantity, unit price tolerance, dates
  - output explainable match reasons

### UI modules
- Reconciliation queue with “exceptions first” UX
- Audit timeline integrates with existing tenant audit trails

## Cross‑cutting platform requirements
- **RBAC**: express roles per portal/finance/ops
- **RLS**: every new tenant table must ship with RLS in migrations
- **Observability**: Sentry capture on backend + frontend for portal flows
- **Exportability**: all tables should support CSV export patterns where appropriate

## Definition of Done (for V4 planning)
- Each pillar has:
  - model list
  - API surface
  - UI module boundaries
  - security constraints
  - migration/RLS notes

