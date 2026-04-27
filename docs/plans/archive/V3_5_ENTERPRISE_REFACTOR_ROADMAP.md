> [!IMPORTANT]
> ARCHIVED (Historical)
>
> This document is retained for historical context only and is **not canonical**.
> The canonical source of truth for priorities and definitions of done is **/MASTER_PLAN.md**.
> Roadmaps in **/ROADMAP.md** and **/UI_ROADMAP.md** are reference-only unless promoted in MASTER_PLAN.

# V3.5 ENTERPRISE REFACTOR ROADMAP (Remediation Blueprint)

**Created**: 2026-03-31

This roadmap is synthesized from:
- `docs/audits/SYSTEM_ERRORS_2026.md`
- `docs/audits/UI_UX_DEBT_2026.md`
- `docs/audits/API_SCHEMA_DRIFT.md`

## Guiding Principle
**Freeze feature development** until:
- tenant isolation is provably correct (app + RLS)
- API boundary is type-safe enough to prevent recurring 400/500 regressions
- UI primitives are consolidated to an enterprise-grade standard set

---

## Phase 1 — Critical Path (500s, 400s, RLS violations)

### 1.1 Tenant enforcement hardening
- Validate tenant base ViewSet behavior:
  - `TenantFilteredModelViewSet.get_queryset()` always tenant filters
  - returns `.none()` when tenant is missing
- Standardize write enforcement:
  - ensure tenant set on creates
  - assert RLS vars in complex writes where needed

### 1.2 API boundary error normalization
- Ensure write endpoints return structured 400s with actionable messages (no raw tracebacks)
- Add global frontend `unhandledrejection` handler to capture + surface actionable error UI

### 1.3 JWT/legacy auth drift cleanup (blocking UX bugs)
- Fix Quick Actions JWT gating (accessToken vs authToken)
- Audit any other “legacy-only” token checks in contexts/services

**Acceptance criteria:**
- No tenant-scoped endpoint can return cross-tenant data.
- Common failure modes yield 400 with structured payload.
- No “empty UI due to token key mismatch” regressions.

---

## Phase 2 — Component Consolidation (The Great Deletion Part 2)

### 2.1 Tables
- Choose one primary table primitive (AntD Table + wrapper)
- Replace:
  - `AdminTable` and/or `ResponsiveTable` duplication where feasible
- Standardize pagination, empty states, row-click drilldowns

### 2.2 Modals
- Standardize on AntD `Modal` + one thin wrapper
- Remove feature-local modal shells where they are redundant

### 2.3 Spacing/layout tokens
- Enforce a single spacing scale via CSS vars/theme

**Acceptance criteria:**
- One table abstraction used across core CRUD.
- One modal abstraction.
- Consistent spacing across pages.

---

## Phase 3 — UX / Flow Alignment (Nested drill-downs, routing correctness)

### 3.1 Hierarchy routing
- Ensure URLs reflect entity drill-downs:
  - suppliers → plants → contacts
  - customers → locations → contacts

### 3.2 Consistent navigation patterns
- row-click drilldowns
- consistent breadcrumbs
- deep-link safe tabs (already adopted in WorkForms + Cockpit)

**Acceptance criteria:**
- A user can navigate hierarchy without losing context and without “state-only” navigation.

---

## Phase 4 — Performance & Query Efficiency

### 4.1 Frontend
- Replace ad-hoc `useEffect` fetching with React Query for core lists
- Add memoization only where measured (avoid cargo-cult)

### 4.2 Backend
- Eliminate N+1 with `select_related/prefetch_related` and aggregate annotations where needed
- Enforce query plan guardrails for high-traffic endpoints

**Acceptance criteria:**
- Largest lists render without N+1.
- Network calls deduped and cached appropriately.



---

## Reconnaissance Update — 2026-03-31T19:15:05Z

### Immediate P0 adds (from field failures)
- **Fail-open fetch** pattern for mixed legacy/new sources (Quick Actions, selectors, Catalog).
- Separate navigation semantics:
  - WorkForms -> editor (`/workforms/editor/:id`)
  - Legacy forms -> submission runner (`/workforms/in-progress/:submissionId`)
- Stabilize `/api/v1/workflows/available-forms/` to be legacy-only to prevent cross-model coupling.
