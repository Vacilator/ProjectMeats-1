# ProjectMeats - PR Reference Master Plan (GitHub)

This file is the **PR-referenceable execution log** for ongoing initiatives. It complements the repo-root `MASTER_PLAN.md` (the living plan).

## Active Initiative: Phase 7 Stabilization + Cockpit Navigation

### Scope
- Cockpit “continuous browsing” navigation + relationships.
- MyTasks workflow execution dashboard stability.
- Intelligent Workform Editor (entity-first nodes, smart inheritance, node cleanup, config UX).

### PR Log (append-only)

> Fill in as PRs are opened/merged.

- 2026-03-13 — Phase 7 Stabilization + Cockpit Navigation — Commit: 6144c189 (PR: #3447)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3447
  - Cockpit: navigation-path driven continuous browsing + breadcrumb jumping; UUID-safe relationships endpoint.
  - Backend: relationship discovery returns contacts/recent orders/related products; RLS middleware sets+resets both `app.current_tenant` + `app.current_tenant_id`.
  - Workflows: migrations/models aligned for tenant/RLS stability (MyTasks/workflow executions).
  - FlowEditor: entity-first Form config, Smart Auto-Map suggestions, removed raw JSON editor, deprecated multi-step container edit path (migrates to `formProcessGroup`), collapsed group shadow fix.

- 2026-03-13 — Verification follow-up — Commit: f8458630 (PR: #3448)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3448
  - Fix workflow executor verification tests (safe numeric coercion for equals + correct patch target).

- 2026-03-13 — CI security scan fix — Commit: 07473351 (PR: #3449)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3449
  - Restore Secret Detection Scan reliability (gitleaks CLI, no org license dependency) and remove hardcoded superuser password defaults.

- 2026-03-13 — Deployment migration hardening — Commit: 595f729f (PR: #3451)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3451
  - Make `tenant_apps.workflows` migration `0022` idempotent to prevent `DuplicateColumn` failures during redeploy.

- 2026-03-13 — Deployment backfill correction — Commit: d7766aa0 (PR: #3452)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3452
  - Fix `0022` tenant backfill to derive tenant via `workflows_tenantform` join (avoids missing-column errors on existing DBs).

- 2026-03-13 — Deployment workflow resilience — Commit: 60473ebb (PR: #3453)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3453
  - Fix frontend deploy to tolerate unset `SENTRY_*` variables under `set -u` by using safe defaults in runtime config generation.

- 2026-03-15 — FlowEditor config standards shipped — Commit: f3edd946 (PR: #3455)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3455
  - FlowEditor: schema-driven config UX standards, Smart Auto-Map banner, Developer Mode JSON fallback; Vitest reliability hardening.
  - Governance: update GOLDEN_FILES registry and execution log.

- 2026-03-15 — Phase 7.3 WebSockets foundation — Commit: dd3ae119 (PR: #3456)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3456
  - Backend: Django Channels + ASGI ProtocolTypeRouter; tenant-scoped workflow collaboration WebSocket scaffold.
  - Docs: WorkForms developer guide includes WebSocket path convention for real-time editing.

- 2026-03-15 — Phase 8.1 Universal Search caching — Commit: fc197e4b (PR: #3457)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3457
  - Backend: tenant-safe cache for UniversalSearchService results (short TTL), plus hardened entity lookup response and tenant fallback.

- 2026-03-15 — Phase 8.3 Email ingestion fan-out — Commit: 86c2025f (PR: #3458)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3458
  - Backend: Celery fan-out for email ingestion (provider-scoped tasks) with jittered dispatch.

- 2026-03-15 — Entity-First UI Restoration (Portal + Schema Bootstrap) — Commit: a12c8ec4 (PR: #3460)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3460
  - FlowEditor: add static portal containers to Vite index.html, harden portal lifecycle, and fix portal diagnostics.
  - FlowEditor: ensure schemaRegistry is initialized (no fallback schemas for trigger/formStep), restoring entity-first configuration.
  - FlowEditor: Developer Mode JSON editor uses Monaco (fallback to textarea).

- 2026-03-15 — FlowEditor: cascading relation fields — Commit: 9579a247 (PR: #3462)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3462
  - EntityFieldPicker: relation fields (FK/M2M/1-1) can select an upstream variable template to cascade/auto-populate (`cascadeFrom`).
  - DynamicConfigPanel: entity-field-picker renderer passes upstream variables into EntityFieldPicker.

- 2026-03-15 — Cockpit: global search in header (Ctrl+K) — Commit: 2be7d888 (PR: #3466)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3466
  - Move Cockpit search input to `Header.tsx` with global Ctrl/⌘K focus.
  - CockpitDashboard becomes a results view driven by URL `?q=` (SmartSearch controlled query + hideInput).
  - SmartSearch now debounces via `lodash/debounce` (no setTimeout).

- 2026-03-15 — Workflows: ActionItems 500 hardening — Commit: 2b5f2346 (PR: #3468)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3468
  - Return empty results when tenant context is missing (prevents RLS `current_setting()` errors).
  - Always tenant-filter assignments/submissions; catch DB/RLS exceptions and return 200.

- 2026-03-15 — System API: Cockpit typed relationships URL fix — Commit: 6574c740 (PR: #3470)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3470
  - Add explicit typed routes for entity detail + relationships: `/api/v1/system/entities/<type>/<id>/...` (keeps router endpoints intact).

- 2026-03-15 — Cockpit: fix remaining 404s (calendar + fuzzy-related) — Commit: dab20712 (PR: #3472)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3472
  - Add typed `/api/v1/system/entities/<type>/<id>/fuzzy-related/` to match SmartSearch.
  - Add placeholder `/api/v1/calendar/events/` endpoint (returns empty results while Phase 5 calendar integration is blocked).
  - CalendarWidget uses `businessApi` for events fetch.


- 2026-03-15 — Workflows: MyTasks execution loading fix — Commit: 775b2b53 (PR: #3474)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3474
  - Backend: non-admin users can list submissions via assigned_to=me (do not pre-filter by created_by).
  - Frontend: workflowExecutionService uses businessApi + defensive list parsing to avoid map() crashes.

- 2026-03-15 — Workflows: runtime cascadeFrom prefill — Commit: 352c5eaa (PR: #3476)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3476
  - Add `ExecutionFormStep` runtime renderer for `formStep` nodes.
  - Fix `WorkflowExecutionModal` context wiring + hydrate context from `execution.data` for resume.
  - Prefill fields from FlowEditor `cascadeFrom` templates (only fills missing/untouched values).

- 2026-03-15 — FlowEditor: fix FormProcessGroup collapsed outline — Commit: 660dae73 (PR: #3478)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3478
  - Explicitly shrink/grow the React Flow node wrapper on expand/collapse so the expanded outline/shadow does not linger when collapsed.

- 2026-03-15 — Dev deploy unblock: frontend build fixes — Commit: 884c9918 (PR: #3480)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3480
  - Fix Sentry v10 integration usage (React Router v7 tracing + replay integration) and make colorthief loading bundler-safe.
  - Verified: GitHub Actions run 23110092071 succeeded (dev deploy green).

- 2026-03-15 — Hotfix: prevent dev blank load (nodeConfigSchemas TDZ) — Commit: bf382917 (PR: #3482)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3482
  - Fix TDZ crash in `nodeConfigSchemas.ts` by defining `allSchemas` and initializing `schemaRegistry` at end-of-module.
  - Verified: GitHub Actions run 23110337287 succeeded (dev deploy green).

- 2026-03-15 — Hotfix: schemaRegistry validator hardening — Commit: 944cecca (PR: #3484)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3484
  - Prevent page-load crashes by making schema validation ordering-independent (two-pass field ID collection), tolerating non-array `field.validation`, and relaxing label requirement for `info`/`button` fields.
  - Verified: GitHub Actions run 23110537337 succeeded (dev deploy green).

- 2026-03-15 — Hotfix: restore Cockpit search input + dynamic select schema warnings — Commit: 84962d5a (PR: #3486)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3486
  - CockpitDashboard: show SmartSearch input (no more hideInput leading to non-actionable "no results" state).
  - schemaRegistry: treat empty/missing select options as warning (supports dynamic option loading like document templates).
  - Verified: GitHub Actions run 23110718199 succeeded (dev deploy green).

- 2026-03-15 — Cockpit: record pivot + pinned tools — Commit: 8c2f6996 (PR: #3488)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3488
  - Cockpit: record-centric pivot (selected record swaps view to profile + relations) while preserving continuous-browsing breadcrumb.
  - Cockpit: PinnedToolsBar under Header + widget pin-to-tools UX.
  - Backend: expand typed entity detail payload and add gated PATCH for inline editing.
  - Verified: GitHub Actions run 23111772995 succeeded (dev deploy green).

- 2026-03-15 — Cockpit: single global search input — Commit: e787f0df (PR: #3489)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3489
  - CockpitDashboard: SmartSearch now runs header-driven (`hideInput=true`); Header search is the sole input (Ctrl/⌘K).
  - Verified: GitHub Actions run 23111883098 succeeded (dev deploy green).

- 2026-03-15 — FlowEditor: schema validation normalization — Commit: d0b23c47 (PR: #3490)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3490
  - Convert remaining object-shaped validation blocks in nodeConfigSchemas.ts to array-based ValidationRule[] entries.
  - Verified: GitHub Actions run 23112116822 succeeded (dev deploy green).

- 2026-03-15 — Cockpit: header-driven search UX — Commit: 35a83144 (PR: #3491)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3491
  - CockpitDashboard: do not show "No results" when there is no query; show a clear prompt + Focus Search affordance.
  - Header: add stable search input id (global-search-input) for focus.
  - Verified: GitHub Actions run 23112192365 succeeded (dev deploy green).

- 2026-03-15 — FlowEditor: fix entity field cascade + blank sections — Commit: fe595364 (PR: #3493)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3493
  - Fix complex config renderers to call `onChange(value)` (not `onChange(field.id, value)`), restoring EntityFieldPicker cascade/selection and other complex controls.
  - DynamicConfigPanel: pass `onFieldChange` through renderer props; show a non-empty empty-state for sections with no currently unlocked fields.
  - Verified: GitHub Actions run 23112462806 succeeded (dev deploy green).

---

## Consolidated Execution Plan (2026-03-13)

This section consolidates the current work queue into a single execution plan. Work will be delivered as a **sequence of PRs**, each merged into `development`.

### PR A — FlowEditor “Once and For All” Config UX (Frontend)
**Branch:** `fix/floweditor-config-standards`

**Status:** MERGED — https://github.com/Meats-Central/ProjectMeats/pull/3455 (merge commit: `f3edd946`)
Unit tests verified via Vitest. NOTE: `src/components/FlowEditor/__tests__/UnifiedFlowEditor.integration.test.tsx` is temporarily quarantined from Vitest collection due to a deterministic hang under JSDOM.

Deliverables:
- **Entity-first config parity for legacy `formStep`** (schema-driven): add `entityType` + `entity-field-picker` so older workflows remain editable.
- **DynamicConfigPanel renderer completeness for critical node UIs**:
  - `info` blocks render (no more “Unknown field type” placeholders)
  - `ruleBuilder`/`conditionBuilder` renders via `ConditionBuilder` (visual rules)
  - `validation-builder` is wired to `ValidationRuleBuilder`
  - common legacy aliases supported (`checkbox`, `boolean`, `email`, `password`, `codeEditor`)
- **Smart Auto-Map surfaced**: top-of-panel banner with one-click “Apply suggested mappings”.
- **JSON fallback restored**: Advanced tab adds a persisted **Developer Mode** toggle with safe raw JSON editor for `node.data`.
- **Standards enforcement**: legacy `NodeConfigPanel` no longer imports `axios` and uses schema bridge (`EntityFieldPicker` → BusinessApi via schemaService).

Verification (repo scripts):
- `npm run type-check` (or equivalent)
- `npm test` (if present)

### PR B — Governance: Golden Files + Phase 7 progress
Status: Completed as part of PR A (#3455).

### PR C — Phase 7.3: Real-Time Collaboration foundation (Backend)
**Branch:** `feat/phase7-3-channels-foundation`

**Status:** MERGED — https://github.com/Meats-Central/ProjectMeats/pull/3456 (squash commit: `dd3ae119`)

Deliverables:
- Implement **Channels-ready ASGI routing** and WebSocket path conventions:
  - `/ws/workflows/<workflow_id>/collab/?tenant_id=<tenant_uuid>`
- Use existing `REDIS_URL`/`VALKEY_URL` for channel layer (no new secret names; manifest remains source of truth).

### PR D — Phase 8.1: Tenant-safe caching for Universal Search (Backend)
**Branch:** `feat/phase8-1-universal-search-cache`

**Status:** MERGED — https://github.com/Meats-Central/ProjectMeats/pull/3457 (squash commit: `fc197e4b`)

Deliverables:
- Decorator-based caching for `UniversalSearchService.search()` using Redis.
- Cache keys include **tenant id** (and query params) to preserve strict RLS/tenant isolation.

### PR E — Phase 8.3: Email ingestion fan-out (Backend)
**Branch:** `feat/phase8-3-email-ingestion-fanout`

**Status:** MERGED — https://github.com/Meats-Central/ProjectMeats/pull/3458 (squash commit: `86c2025f`)

Deliverables:
- Convert sequential provider polling into Celery fan-out (task per provider/tenant).
- Add backoff/retry and keep provider rate-limits safe.

Execution rules:
- New branch per PR → PR → merge to `development`.
- No direct axios usage in frontend; BusinessApi/workformsApi only.
- Maintain PostgreSQL RLS parity and tenant isolation in all backend changes.

---

## Emergency Restoration Addendum (Priority Queue)

**Priority ordering:**
1. Node configuration stability (DONE — PR #3455, #3460, #3462)
2. Emergency UI/UX + API restoration (NEXT)

### PR F — Emergency UI/UX + API restoration (Frontend + Backend)
**Status:** PLANNED (second item after node configuration fixes)

Problem summary (from console logs / diagnostics):
- Portal rendering race + schema fallback were the top blockers. These are now addressed by:
  - Portal stability: PR #3460
  - Schema registry bootstrap + legacy aliasing: PR #3460 / PR #3455
- Remaining regressions to eradicate:
  - **Global Search UX**: move Cockpit-local search into `Header.tsx` with Ctrl+K global listener.
  - **API routing / RLS disconnects**: fix 500 on `/api/v1/action-items/` and 404s on `/api/v1/calendar/events/` + entity `/relationships/` routing.

Deliverables:
- Frontend:
  - Remove CockpitDashboard search button/input and relocate to `frontend/src/components/Layout/Header.tsx`.
  - Ensure global search drives Cockpit navigation (“Never Leave the Screen”).
- Backend:
  - Fix ActionItems endpoints stability (`backend/tenant_apps/workflows/views.py`): null-safe fields + tenant/RLS-safe query patterns.
  - Verify entity relationships endpoints are registered under `/api/v1/` and accept snake_case entity names.
  - Register/fix `/api/v1/calendar/events/` endpoint (or align frontend to the correct URL).

Verification (manual):
- Ctrl+K from any page opens search.
- Searching “Purchase Order” navigates back to Cockpit details without full reload.
- Action Items endpoints return 200 for an authenticated tenant.
