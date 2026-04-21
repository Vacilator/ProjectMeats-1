> [!IMPORTANT]
> ARCHIVED (Historical)
>
> This document is retained for historical context only and is **not canonical**.
> The canonical source of truth for priorities and definitions of done is **/MASTER_PLAN.md**.
> Roadmaps in **/ROADMAP.md** and **/UI_ROADMAP.md** are reference-only unless promoted in MASTER_PLAN.

# V4.0 — Enterprise Interoperability Gateway (EDI + API)

**Status**: Vision / Architecture Plan (no code)

## Why this matters
Whale customers rarely email PDFs. They send EDI.
- X12 **850** Purchase Orders
- X12 **810** Invoices
- X12 **856** Advance Ship Notice (ASN)

The moat: a hardened gateway that translates enterprise machine contracts into ProjectMeats entities, safely and repeatably.

## Current architecture snapshot (as‑is)
- Django + DRF shared‑schema
- Workforms / UniversalEntityForm patterns exist (schema-driven forms)
- Celery + Redis available for async processing
- Tenant Webhooks + API keys exist (outbound events foundation)

---

## Proposed system: “Gateway” as a bounded microservice (recommended)
### Why separate service?
- EDI parsing/validation libraries and throughput concerns
- Security boundary: inbound external payloads deserve isolation
- Operational reality: partners require retries, acknowledgments, audit logs

### Service roles
1) **EDI Transport**
- AS2/SFTP/VAN adapters (vendor-specific)
- inbound/outbound mailboxing

2) **EDI Parser/Validator**
- translate raw X12 into canonical JSON
- validate segments + partner-specific implementation guides

3) **Mapping Layer**
- map canonical JSON → internal “integration contracts”
- map to Workforms / SalesOrder creation

4) **Acknowledgment + Observability**
- 997/999 functional acknowledgments
- idempotency keys
- message replay, dead-letter queue

---

## Data model (in Gateway)
### `Partner`
- tenant_id
- partner_name
- transport_config (encrypted)
- implementation_guide_profile (json)

### `InboundMessage`
- tenant_id
- partner_id
- message_type (X12_850, X12_810, X12_856)
- raw_payload (stored securely)
- canonical_payload (json)
- status (received/validated/mapped/processed/failed)
- idempotency_key
- received_at

### `OutboundMessage`
similar, with delivery attempts + acknowledgments

---

## Mapping: inbound EDI 850 → Sales Order / UniversalEntityForm
### Canonical JSON for an 850
Normalize into:
- header: buyer, ship_to, requested ship date, po_number
- line_items[]: sku, qty, uom, price (if present), allowances/charges

### Mapping strategy
1) **Partner mapping table**
- partner_sku → internal product (MasterProduct / SKU)
- ship_to codes → internal customer location

2) **Creation path**
- Option A (recommended): create a **SalesOrder** directly via a dedicated service layer
- Option B: create a Workform submission against a SalesOrder form template

### Idempotency rules
- idempotency_key = partner_id + po_number + version
- if already processed, return 200 and emit a “duplicate ignored” audit event

---

## Gateway → Core API contract
### Authentication
- Gateway uses Tenant API Key (already exists) with scoped permissions:
  - `integration:edi:write`
  - `integration:edi:read`

### Endpoints (core)
- `POST /api/v1/integrations/edi/inbound/850/` (canonical JSON)
- `POST /api/v1/integrations/edi/inbound/856/`
- `POST /api/v1/integrations/edi/inbound/810/`

Core returns:
- created entity IDs
- warnings/errors

---

## Outbound flows
- SalesOrder accepted → send 855 (if needed)
- Shipment created → send 856 ASN
- Invoice issued → send 810

Outbound is event-driven:
- Core emits event → webhook → Gateway enqueues outbound message

---

## Public-facing REST API documentation (for ERPs)
### Documentation structure (repo)
- `docs/api/overview.md`
- `docs/api/authentication.md` (API keys, scoping, rotation)
- `docs/api/tenancy.md` (X-Tenant-ID, RLS expectations)
- `docs/api/resources/` (SalesOrders, PurchaseOrders, InventoryLots, Shipments)
- `docs/api/webhooks.md` (event types, signatures)

### Versioning strategy
- `/api/v1/` stable
- additive changes only; deprecate with long runway

---

## Rollout plan
### Phase 1 (pilot)
- One partner, one message type (850)
- Manual mapping table
- Observability dashboard (message status)

### Phase 2
- Add 856/810
- Add transport adapters (AS2/SFTP)

### Phase 3
- Partner self-service onboarding portal

---

## Business feasibility checks
- Do we have a whale prospect requiring EDI now?
- Which transport (AS2 vs SFTP vs VAN) is required by target partners?
- Are we prepared to maintain partner-specific implementation guides?
