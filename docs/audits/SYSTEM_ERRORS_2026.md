# SYSTEM_ERRORS_2026 (Repository Diagnostic Sweep)

**Generated**: 2026-03-31

Scope (requested):
1. Backend: find APIViews/ViewSets overriding `perform_create` / `get_queryset` without explicit tenant enforcement.
2. Frontend: unhandled promise rejections, missing ErrorBoundary around lazy routes, excessive `any` in API contracts, non-standard data fetching.
3. Output: actionable findings and remediation directions.

> Notes on methodology
> - This is a *heuristic* sweep. Some ViewSets inherit tenant filtering from base classes (e.g., `TenantFilteredModelViewSet`) so a missing `.filter(tenant=...)` inside the override is not automatically a bug.
> - For shared-schema multi-tenancy, **correctness requires BOTH**:
>   - Application filtering by `request.tenant`
>   - DB enforcement via RLS (`app.current_tenant` set + policies)

---

## A) Backend multi-tenancy enforcement findings

### A1) `perform_create` overrides: candidates lacking explicit tenant assignment

Heuristic scan found **3** candidates where the first ~60 lines after `def perform_create(self, serializer):` did not include `request.tenant` / `tenant=`.

1) `backend/apps/core/views.py`
- `perform_create` saves **user preferences**, scoped by `user=self.request.user`.
- This is not tenant-owned data; **OK** (but ensure endpoints never leak other users’ prefs).

2) `backend/tenant_apps/ai_assistant/views.py` (`ChatSessionViewSet.perform_create`)
- Saves chat sessions owned by `request.user`.
- Tenant isolation is enforced in `get_queryset()` via `owner=self.request.user`.
- **Risk**: If any other endpoint later filters by tenant without owner, these records may be ambiguous. Consider optionally persisting `tenant_id` on chat sessions if product requirements evolve.

3) `backend/tenant_apps/workflows/mixins.py`
- Mixin `perform_create` calls `super().perform_create(serializer)` and invalidates cache.
- **OK** assuming the parent `perform_create` sets tenant/created_by correctly.

**Recommendation:**
- For tenant-owned models, enforce a single base pattern:
  - `get_queryset()` always tenant-filtered (or via tenant base class)
  - `perform_create()` always sets `tenant=request.tenant`
  - For write paths, assert RLS context where needed (`set_current_tenant()` inside transaction) when policies require.

### A2) `get_queryset` overrides: candidates lacking explicit tenant filtering

Heuristic scan flagged **11** `get_queryset` bodies without inline `tenant=` filtering. Most are expected and safe:
- System/tenants admin views should filter by user permissions rather than tenant FK.
- Some tenant app viewsets use base class filtering (`TenantFilteredModelViewSet`) so `super().get_queryset()` is already tenant-scoped.

**High-signal check to perform during remediation:**
- Confirm `TenantFilteredModelViewSet.get_queryset()` always applies `.filter(tenant=request.tenant)` and returns `.none()` when tenant context is missing.
- Confirm the middleware asserts `app.current_tenant` session variable for DB RLS.

### A3) RLS/session variable enforcement gaps (pattern-level)

Even when `request.tenant` filtering is correct, you can still get:
- false “0 results” if RLS session vars aren’t set
- hard 500s if RLS policies reject writes and app treats it as unexpected

**Recommended standard:**
- For complex write endpoints (uploads, multi-row writes, background actions), assert tenant RLS session variables inside a transaction:
  - `apps.tenants.rls.set_current_tenant(tenant_id)`
  - optionally also `cursor.execute('SET app.current_tenant = %s', [tenant_id])` for defense-in-depth

---

## B) Frontend reliability / error handling findings

### B1) Unhandled promise rejections
- No global `window.addEventListener('unhandledrejection', ...)` handler was found.
- This is not inherently wrong because most requests are wrapped in `try/catch`, but it reduces observability.

**Recommendation:**
- Add an `unhandledrejection` handler (and optionally `error` handler) that logs to the centralized logger and Sentry (when enabled) with redaction.

### B2) ErrorBoundary coverage for lazy routes
- `frontend/src/App.tsx` wraps the app in `ProductionErrorBoundary`.
- Lazy-loaded routes (`CockpitPage`, `WorkFormsEditor`) are wrapped in `<Suspense fallback={<Skeleton/>}>`.
- Admin workspace routes are additionally wrapped in `AdminErrorBoundary`.

**Status:** Coverage looks strong; no immediate action required.

### B3) `any` usage in API boundaries (signal)
`any` occurs widely across the codebase, including in data payloads and API contracts.

Examples/patterns:
- `Record<string, any>` / `value: any` in form submission and autosave plumbing
- JSON-like “flow_data” and node definitions typed as `any`

**Risk:**
- schema drift causes 400s/500s and runtime UI failures that TS cannot catch.

**Recommendation:**
- Introduce a “no-`any` at the API boundary” rule:
  - keep `unknown` from API
  - validate/parse via zod or explicit type guards
  - then pass typed data into UI

### B4) Data fetching not using React Query
The following files were detected using `useEffect` with direct `businessApi`/`apiClient` calls (non-exhaustive list):
- `frontend/src/pages/Suppliers.tsx`
- `frontend/src/pages/Customers.tsx`
- `frontend/src/pages/Contacts.tsx`
- `frontend/src/pages/Inquiries.tsx`
- `frontend/src/pages/Suppliers/Plants.tsx`
- `frontend/src/pages/Customers/Locations.tsx`
- `frontend/src/pages/Admin/OptionLists/index.tsx`
- `frontend/src/pages/Admin/Configurations/index.tsx`
- `frontend/src/pages/Fulfillments.tsx`
- many widgets (Cockpit dashboard) and several modals

**Risk:**
- inconsistent caching
- duplicated loading/error state handling
- increased chance of unhandled rejection

**Recommendation:**
- Migrate high-traffic list/detail screens to React Query (or the standardized caching layer if different), starting with:
  - Suppliers/Customers list + detail
  - Contacts
  - Inquiries
  - Option Lists

---

## C) Immediate high-signal regressions to fix next

1) **Quick Actions JWT gate**
- `QuickActionsContext` currently checks `localStorage.authToken` only; JWT sessions store `accessToken`.
- Impact: Quick Actions may appear empty / fail to show workforms even though unified fetch code exists.

---

## D) Remediation checklist (for V3.5 roadmap)

- Backend: tenant enforcement
  - [ ] Confirm all tenant-owned ViewSets inherit a tenant-filtering base class and never return cross-tenant rows.
  - [ ] Confirm write paths assert RLS tenant vars for sensitive/complex writes.

- Frontend: reliability
  - [ ] Add global unhandled rejection handler + Sentry capture.
  - [ ] Migrate top list/detail pages to React Query.
  - [ ] Reduce `any` at API boundary (introduce parsers/validators).



---

## Reconnaissance Update — 2026-03-31T19:15:05Z

### Backend tenant enforcement (heuristic)
- `get_queryset` suspects (no inline tenant filter detected): **11** (showing up to 20)
- `backend/apps/core/models.py:411`
- `backend/apps/core/views.py:292`
- `backend/apps/email_integration/views/oauth_views.py:329`
- `backend/apps/tenants/views.py:57`
- `backend/apps/tenants/views.py:760`
- `backend/tenant_apps/ai_assistant/views.py:80`
- `backend/tenant_apps/ai_assistant/views.py:110`
- `backend/tenant_apps/ai_assistant/views.py:694`
- `backend/tenant_apps/fulfillments/admin.py:50`
- `backend/tenant_apps/inquiries/admin.py:67`
- `backend/tenant_apps/inquiries/admin.py:114`

- `perform_create` suspects (no inline tenant assignment detected): **6** (showing up to 20)
- `backend/apps/core/views.py:296`
- `backend/tenant_apps/ai_assistant/views.py:86`
- `backend/tenant_apps/ai_assistant/views.py:424`
- `backend/tenant_apps/workflows/mixins.py:194`
- `backend/tenant_apps/workflows/views.py:901`
- `backend/tenant_apps/workflows/views.py:3430`


### Frontend reliability sweep (signal)
- Global `unhandledrejection` handler occurrences: **1**
- `frontend/src/utils/globalErrorHandlers.ts`

- Files with direct API calls outside services and without React Query (heuristic): **79** (showing up to 20)
- `frontend/src/apps/admin-studio/components/ChoiceListEditor.tsx`
- `frontend/src/components/AIAssistant/AIAgentWidget.tsx`
- `frontend/src/components/AIAssistant/HITLReviewCard.tsx`
- `frontend/src/components/Admin/ChoiceListEditor.tsx`
- `frontend/src/components/Admin/SystemChoiceManager.tsx`
- `frontend/src/components/Admin/TenantChoiceOverride.tsx`
- `frontend/src/components/Admin/VirtualFieldManager.tsx`
- `frontend/src/components/Calls/InquiryCallModal.tsx`
- `frontend/src/components/Cockpit/AIOverviewCard.tsx`
- `frontend/src/components/Cockpit/EntityProfileHeader.tsx`
- `frontend/src/components/Cockpit/NotesAndCallsDrawer.tsx`
- `frontend/src/components/Cockpit/PinnedToolsBar.tsx`
- `frontend/src/components/Cockpit/RelationMindMap.tsx`
- `frontend/src/components/Cockpit/SmartSearch.tsx`
- `frontend/src/components/FlowEditor/HistoryDrawer.tsx`
- `frontend/src/components/FlowEditor/Modals/EntityMapperModal.tsx`
- `frontend/src/components/FlowEditor/NodeContextMenu.tsx`
- `frontend/src/components/FlowEditor/WorkflowSharing.tsx`
- `frontend/src/components/FlowEditor/analytics/WorkflowAnalyticsDashboard.tsx`
- `frontend/src/components/FlowEditor/utils/workflowPersistence.ts`
- … +59 more

- Files with explicit `any` in services/types (signal-only): **12** (showing up to 20)
- `frontend/src/services/apiService.ts`
- `frontend/src/services/authService.ts`
- `frontend/src/services/nodeValidationService.ts`
- `frontend/src/services/optionListsService.ts`
- `frontend/src/services/quickActionsService.test.ts`
- `frontend/src/services/quickActionsService.ts`
- `frontend/src/services/schemaService.ts`
- `frontend/src/services/tenantFormService.ts`
- `frontend/src/services/tenantService.ts`
- `frontend/src/services/workflowExecutionService.ts`
- `frontend/src/services/workformsApi.ts`
- `frontend/src/types/lodash-debounce.d.ts`
