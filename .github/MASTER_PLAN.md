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
