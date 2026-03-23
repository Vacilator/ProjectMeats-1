# V3.0 Final Push — Enterprise-Grade Perfection

**Objective:** Execute a consolidation + polish push that converts ProjectMeats from “feature-rich” to **enterprise-grade, maintainable, scalable, and fast** — without breaking the currently-working WorkForms Editor (additive-only rule).

**North Star Outcomes**
- **DRY UI**: schema-driven entity create/edit flows (replace hardcoded modals).
- **Scale**: React Flow usable at 150–1000 nodes (no DOM lag).
- **Resilience**: WorkFlow execution supports loop/try-catch semantics.
- **Polish**: consistent loaders, keyboard UX, theme compliance, and animation quality.

**Non‑Negotiables / Guardrails**
- **Additive-only** for WorkForms Editor: no breaking schema or node contracts; use deprecation + aliasing.
- **Tenant isolation**: all new endpoints/actions remain RLS-compatible and tenant-filtered.
- **Service layer**: frontend network calls go through `businessApi` / `workformsApi` / `apiClient` patterns.
- **Small PR cadence**: each checklist block below is designed to ship as an isolated PR with tests.

---

## PHASE 1 — CODE CONSOLIDATION & DRY PURGE

### 1.1 Finalize `UniversalEntityForm.tsx` (from scaffold → production)
**Current scaffold:** `frontend/src/components/Shared/UniversalEntityForm.tsx`

#### Deliverables
- A stable **schema contract** (backend) and a deterministic **schema→UI mapping** (frontend).
- FK fields become **searchable** by default (SearchableSelect behavior).
- Array/list fields render/edit as multi-select (tags or multiple select).
- Form submission is consistent across create/edit flows, with standardized validation & error display.

#### Backend contract checklist
- [ ] Define schema endpoint (one of):
  - `GET /api/v1/system/forms/schema/?entity_type=...` (recommended)
  - or `GET /api/v1/system/entities/{type}/schema/`
- [ ] Response includes for each field:
  - `key`, `label`, `type`, `required`, `help_text`, `placeholder`
  - `relationship`: `{ kind: 'fk'|'m2m'|'choice', entity_type: string, display_field?: string }`
  - `ui`: `{ widget?: 'searchable_select'|'textarea'|'date'|'money'|'phone'|'email', read_only?: boolean }`
- [ ] Includes field order + grouping metadata (sections/steps) so UI isn’t random.
- [ ] Enforce tenant access + permissions (same as entity viewset) and avoid leaking cross-tenant schema choices.

#### Frontend implementation checklist
- [ ] Replace placeholder schema call with the real endpoint.
- [ ] Add a mapping layer:
  - backend `type` → DynamicFormEngine field types
  - relationship metadata → SearchableSelect injection
  - arrays/m2m → multi-select
- [ ] Standardize:
  - [x] loading skeleton
  - submit button disable states
  - toast error mapping (`err.response?.data?.detail|error|message`)
- [ ] Add Vitest coverage for mapping + rendering.

#### Definition of Done
- UniversalEntityForm can render at least **Inquiries** and **Orders** create forms correctly.
- FK fields are searchable and do not require giant dropdown lists.

---

### 1.2 “Great Deletion”: migrate legacy hardcoded modals → UniversalEntityForm
**Known hardcoded modals (inventory):**
- `frontend/src/components/Shared/CreateOrderModal.tsx`
- `frontend/src/components/Shared/CreateClaimModal.tsx`
- `frontend/src/components/Shared/CreateInvoiceModal.tsx`
- `frontend/src/components/Fulfillment/CreateFulfillmentModal.tsx`
- `frontend/src/components/Inquiry/CreateInquiryModal.tsx`
- `frontend/src/components/FormSubmission/QuickCreateModal.tsx` (may remain as a thin wrapper)

#### Migration protocol (safe + incremental)
- [ ] Wrap each legacy modal with a feature flag (config-driven) to allow phased rollout.
- [ ] Implement UniversalEntityForm for the corresponding `entityType`.
- [ ] Run side-by-side QA:
  - payload parity
  - required fields parity
  - validation parity
  - auto-populated/cascaded values preserved
- [ ] Swap route/CTA to UniversalEntityForm.
- [ ] Keep legacy modal temporarily behind flag.
- [ ] Delete legacy modal once:
  - prod telemetry shows success
  - no open bugs in that flow for 1–2 deploys

#### Definition of Done
- At least 2 “top traffic” create flows (Inquiry + Sales Order OR Purchase Order) are fully migrated.
- The legacy modal files are deleted or quarantined behind a disabled-by-default flag.

---

### 1.3 Flow Editor: delete/merge legacy config panels into `DynamicConfigPanel`
**Target:** route node config UI through `frontend/src/components/FlowEditor/ConfigPanel/DynamicConfigPanel.tsx`

#### Inventory starting points
- Config panel components:
  - `frontend/src/components/FlowEditor/ConfigPanel/*`
- Misc panels:
  - `frontend/src/components/FlowEditor/panels/*`

#### Checklist
- [ ] Identify “legacy” panels not used by `DynamicConfigPanel` and mark them deprecated.
- [x] Panel Purge (Batches 2 & 3): remove legacy node-type routing and delete legacy config panels so nodes fall back to `DynamicConfigPanel`.
- [ ] For each node type, ensure the config schema is resolved via the dynamic registry and rendered via `DynamicConfigPanel`.
- [ ] Remove duplicate panel logic (validation, defaulting, help text) from per-node components.
- [ ] Bundle-size validation: ensure panel deletion reduces code.

#### Definition of Done
- There is **one** config path for node config UI; legacy panels are removed or no longer referenced.

---

## PHASE 2 — WORKFLOW ENGINE SCALE

### 2.1 React Flow viewport virtualization / performance budget
#### Checklist
- [ ] Profile baseline: 150 nodes / 300 edges (record FPS + interaction latency).
- [ ] Enable React Flow performance flags where available (e.g., render-only-visible, memoization patterns).
- [ ] Implement node virtualization strategy:
  - avoid rendering off-viewport nodes
  - memoize node components
  - throttle expensive layout computations
- [ ] Add a perf harness page (dev-only) to reproduce node-heavy graphs.

#### Definition of Done
- 150 nodes feels smooth; 500 nodes is usable (no major DOM thrash).

---

### 2.2 Implement `LoopNode` (array iteration)
#### Requirements
- Additive-only: new node type, no changes to existing node semantics.

#### Checklist
- [ ] Define node contract (inputs/outputs):
  - input array expression
  - item variable name
  - body sub-workflow (container)
  - output aggregation strategy (collect results)
- [ ] Backend execution:
  - deterministic ordering
  - max iteration safety cap
  - per-iteration tracing/ActivityLog
- [ ] Frontend:
  - node UI + config schema
  - visualization of loop scope

---

### 2.3 Implement `ErrorEdge` / try-catch routing
#### Checklist
- [ ] Define error propagation model:
  - which node failures route to error edges
  - what error payload is passed along
- [ ] Update executor to support:
  - normal edges vs error edges
  - structured error payload (code/message/nodeId)
- [ ] UI:
  - visually distinct edge type
  - config panel support

---

## PHASE 3 — AI SWARM MATURATION

### 3.1 RLHF pipeline completion (JSONL generation + scheduled jobs)
#### Checklist
- [ ] Finalize an idempotent job that compiles `AIFeedbackLog` → JSONL instruction sets.
- [ ] Redaction policy: strip PII/secrets and tenant-identifying data.
- [x] DevOps IaC scripting for Nginx (Password Auth) — automated `nginx -t && systemctl reload nginx` in CI/CD.
- [x] Database-driven Auto-Tuner — persist active model id in `SystemConfiguration.active_openai_model_id`.
- [ ] Schedule:
  - management command + cron (or Celery beat)
  - alerting on failures
- [ ] Storage:
  - versioned artifacts (date + git sha)

---

### 3.2 AIAgentWidget polish + HITL review cards
#### Checklist
- [ ] Smooth expand/collapse and “glow” states for action_required.
- [ ] Stable polling/backoff with skeleton loaders.
- [x] AI file upload UI (Paperclip + immediate upload + filename pill).
- [ ] Review cards UX:
  - summarize pending items
  - allow resolve/approve actions
  - clear empty state

---

### 3.3 Swarm analytics in Cockpit
#### Checklist
- [ ] Expose basic metrics to Cockpit:
  - # feedback items
  - accuracy trend (accepted vs corrected)
  - time-to-resolution
- [ ] Tenant-safe aggregation (no cross-tenant blending).

---

## PHASE 4 — INDUSTRY-LEADING UX/UI

### 4.1 Global loading + error states
- [ ] Replace ad-hoc spinners with consistent Skeleton loaders for all data-fetching surfaces.
- [ ] Standardize toast/error mapping and empty states.

### 4.2 Keyboard-first UX + command surfaces
- [ ] Canonical shortcut map (discoverable).
- [ ] Ensure CommandPalette and editors don’t require mouse.

### 4.3 Search quality & performance
- [ ] Fuzzy-search tuning and debounce standards.
- [ ] Results rendering virtualization where needed.

### 4.4 Theme compliance
- [ ] Strict AntD + CSS token compliance; eliminate hardcoded colors.
- [ ] WCAG checks on critical flows.

---

## Execution cadence (recommended)
- Phase 1 is a sequence of small PRs. Once UniversalEntityForm is production-ready, the deletion/migration becomes a repeatable conveyor belt.
- Phases 2–4 can run in parallel, but **Phase 1 must start first** to stop the duplication bleed.
