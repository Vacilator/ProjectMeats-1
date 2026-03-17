# ProjectMeats Master Plan - Phase Tracking & Technical Debt

<<<<<<< HEAD
**Status**: 🔄 LIVING DOCUMENT  
**Last Updated**: March 13, 2026  
**Current Focus**: Phase 7 Intelligent Workform Editor (~90% complete) + **All Infrastructure VERIFIED** ✅  
**Overall Progress**: 88.6% (62/70 todos) - **0 Blocked** 🎉  
**Infrastructure Status**: Phase 2, 3, 5, 8 fully operational in dev
=======
This file is the **PR-referenceable execution log** for ongoing initiatives. It complements the repo-root `MASTER_PLAN.md` (the living plan).

## Active Initiative: Phase 7 Stabilization + Cockpit Navigation

### Scope
- Cockpit “continuous browsing” navigation + relationships.
- MyTasks workflow execution dashboard stability.
- Intelligent Workform Editor (entity-first nodes, smart inheritance, node cleanup, config UX).

### PR Log (append-only)

> Fill in as PRs are opened/merged.

- 2026-03-17 — PR #3531 (branch `fix/cockpit-entity-detail`) — merged to `development`  
  - Cockpit relations: entity_graph now returns safe empty querysets, resilient counts/samples, and tolerant IDs to avoid zero-related responses.  
  - FlowEditor stability: inject `onSave` into node data; guard `onEdit` in FormProcessGroupNode; EntityFieldPicker refetches on entity type change.  
  - Inquiry UX: SmartProductAutocomplete uses BusinessApi `system/products` with optional protein filter and protein-change requery.  
  - MyTasks: clears stale executions and shows tenant-safe empty messaging for 403/404 instead of noisy failures.

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

- 2026-03-15 — Cockpit: Process Monitor (WorkForms monitoring) — Commit: 336fdc8f (PR: #3495)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3495
  - Cockpit: add `/cockpit/process-monitor` page listing active FormSubmissions with current step, assignee, elapsed time, and SLA due state.
  - Backend: add `/api/v1/workflows/form-submissions/process-monitor/` endpoint (tenant-safe; supports assigned_to/status/form filters).
  - Detail pivot: clicking a row opens a read-only UnifiedFlowEditor view and highlights the active step node when it can be identified from flow_data.
  - Verified: GitHub Actions run 23112710137 succeeded (dev deploy green). Deployed tags: `development-336fdc8f8274d6b0b4742b6f881aee4ae2e87014` (pm-frontend + pm-backend).

- 2026-03-15 — FlowEditor: validation normalization hardening — Commit: 5b9e5f34 (PR: #3497)
  - PR: https://github.com/Meats-Central/ProjectMeats/pull/3497
  - schemaRegistry: wrap single-object `field.validation` into an array (backward compatible) to prevent `.forEach` crashes.
  - LiveFormPreview: normalize `field.validation` to an array before iterating.
  - Verified: GitHub Actions run 23112951974 succeeded (dev deploy green). Deployed tags: `development-5b9e5f34da6f80c51f807483caa3910de6d339d9` (pm-frontend + pm-backend).

- 2026-03-17 — FlowEditor: restore dynamic config sections (PR pending)
  - Fix TabbedConfigPanel strict whitelist that hid non-form node sections (triggers, actions, conditions).
  - General tab now shows all non-advanced sections; Advanced tab shows only advanced sections.
  - Impact: All node types render their schema-driven configuration panels again.
>>>>>>> upstream/development

---

## 🔧 Phase 7 Stabilization + Cockpit Navigation (Active)

**Scope**: Stabilize Phase 7 (Intelligent Workform Editor) and fix Cockpit continuous browsing + relations.

**Objectives**:
- Cockpit: Continuous Search navigation path + breadcrumb jumping; related-entity panels return contacts, recent orders, related products.
- MyTasks: Remove “Failed to load workflows” by fixing workflow execution API stability and tenant/RLS correctness.
- FlowEditor: Entity-first Form nodes, Smart Auto-Map inheritance suggestions, remove redundant multi-step container from palette, fix collapsed group node rendering, and remove raw JSON from standard config.

**Implementation Notes (High Level)**:
- RLS session-variable setup must be compatible with existing policies (`app.current_tenant` vs `app.current_tenant_id`) and must persist across ORM queries.
- Workflow submissions must remain tenant-safe; FormSubmission tenant field must match DB/migrations.
- Config UX: DynamicConfigPanel remains canonical; raw JSON editor is removed from standard user flow.

**Planned Touchpoints**:
- Backend: `apps/tenants/middleware.py`, `apps/core/services/entity_graph.py`, `apps/core/services/universal_search.py`, `tenant_apps/workflows/models.py`, `tenant_apps/workflows/views.py`
- Frontend: `components/Cockpit/SmartSearch.tsx`, `pages/Cockpit/CockpitDashboard.tsx`, `pages/MyTasks/MyTasks.tsx`, `services/schemaService.ts`, `FlowEditor/*`

---

## 📋 COMPLETE PHASE RUNNING LOG

### Legend
- [x] = Complete
- [ ] = Pending
- 🔒 = Blocked by infrastructure

---

## Phase 1: UI/UX Enhancement [x] COMPLETE

**Completion Date**: January 2026  
**Status**: ✅ 100% Complete

### Deliverables
- [x] 1.1: Onboarding Tours (react-joyride integration)
- [x] 1.2: Responsive Design Patterns (mobile-first)
- [x] 1.3: WCAG 2.1 Level AA Accessibility
- [x] 1.4: Keyboard Navigation
- [x] 1.5: Screen Reader Support
- [x] 1.6: High-Contrast Mode

**Key Files**:
- `frontend/src/components/Onboarding/TourSteps.tsx`
- `frontend/src/hooks/useAccessibility.ts`
- `frontend/src/styles/responsive.css`

**Git References**:
- PRs: #2801-#2815 (Gap Analysis Phase 1)
- Branch: `feat/gap-analysis-phase1-accessibility`

---

## Phase 2: Forms/Workflows - AI-Powered [~] ✅ INFRASTRUCTURE VERIFIED

**Status**: ✅ Infrastructure Verified (March 3, 2026) - Ready for Feature Development  
**Estimated Effort**: 29-37 hours (5 todos)  
**Completed**: 1/5 (20%) - Infrastructure + API Layer

### Completed Deliverables
- [x] 2.1: AI Field Suggestions - **FULLY OPERATIONAL** (PR #3388)
  - Backend: SuggestNodesView with OpenAI integration
  - Frontend: AISuggestionsPanel with loading states
  - Redis caching (10-minute TTL, ~90% cost reduction)
  - Graceful degradation to static suggestions
  - 8 unit tests for connectivity checks
  - **Status**: Code complete, awaiting infrastructure audit

### Pending Deliverables
- [ ] 2.2: Template Library (import/export workflows)
- [ ] 2.3: Entity Cascading (protein → cuts automation)
- [ ] 2.4: Form Process Groups Version Control
- [ ] 2.5: Enhanced Inheritance (type-checking for forms)

**Infrastructure Requirements**:
- ✅ OpenAI API Key (verified operational March 3, 2026)
- ✅ Redis Instance (verified operational March 3, 2026)

**Infrastructure Verification**:
- ✅ OpenAI gpt-4o-mini model accessible
- ✅ Redis caching operational (10-min TTL)
- ✅ Graceful degradation to static suggestions functional
- ✅ 8 unit tests passing for connectivity validation

**Next Steps**:
1. ✅ ~~Infrastructure audit~~ **COMPLETE** (March 3, 2026)
2. ✅ ~~Update manifests/GOLDEN_FILES.md~~ **COMPLETE**
3. Complete remaining Phase 2 features:
   - [ ] 2.2: Template Library (import/export workflows)
   - [ ] 2.3: Entity Cascading (protein → cuts automation)
   - [ ] 2.4: Form Process Groups Version Control
   - [ ] 2.5: Enhanced Inheritance (type-checking for forms)

**Blocker**: ✅ **RESOLVED** - All infrastructure operational

**Target Completion**: Q2 2026 (infrastructure unblocked, ready for feature development)

---

## Phase 3: Search Intelligence [~] ✅ INFRASTRUCTURE VERIFIED

**Status**: ✅ Infrastructure Verified (March 3, 2026) - Ready for Feature Development  
**Estimated Effort**: 26-33 hours (4 todos)

### Planned Deliverables
- [ ] 3.1: Mind-Map Visualizations (react-flow integration)
- [ ] 3.2: Real-Time Search Updates (WebSocket-based)
- [ ] 3.3: NLP Query Refinement (natural language via OpenAI)
- [ ] 3.4: Continuous Search (suggestions as you type, Redis-cached)

**Infrastructure Verification**:
- ✅ Redis operational for pub/sub messaging
- ✅ OpenAI available for NLP query processing
- ✅ Cache configuration wired (PR #3334)

**Blocker**: ✅ **RESOLVED** - Redis instance operational

**Target Completion**: Q2 2026 (infrastructure unblocked, ready for feature development)

---

## Phase 4: Admin Management [x] COMPLETE

**Completion Date**: January 2026  
**Status**: ✅ 100% Complete

### Deliverables
- [x] 4.1: Tabbed Product Catalog (drag-and-drop)
- [x] 4.2: Metrics Dashboard (real-time analytics)
- [x] 4.3: Role-Based Access Control (RBAC)
- [x] 4.4: System Blueprint (extensible schemas)
- [x] 4.5: Tenant Creation Wizard

**Key Files**:
- `frontend/src/components/Admin/TabbedCatalog.tsx`
- `frontend/src/components/Admin/MetricsDashboard.tsx`
- `backend/apps/tenants/rbac.py`
- `backend/apps/tenants/wizard.py`

**Git References**:
- PRs: #2950-#2975 (Gap Analysis Phase 4)
- Branch: `feat/gap-analysis-phase4-metrics`

---

## Phase 5: Integrations [x] COMPLETE ✅

**Status**: 100% Complete - Microsoft OAuth + Email Ingestion  
**Completion Date**: February 28, 2026  
**Estimated Effort**: 40-49 hours (completed)

### Completed Deliverables
- [x] 5.1: Microsoft OAuth Integration **[COMPLETE]** (PRs #3391, #3396)
  - OAuth2 utilities with `/api/v1` sub-path routing
  - Token encryption service (Fernet + PBKDF2)
  - Microsoft Graph provider with redirect URI resolver
  - Secure token storage (encrypted access/refresh tokens)
  - Configuration: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID
  - Files: `backend/apps/integrations/microsoft/utils.py`, `encryption.py`

- [x] 5.2: API Routing Alignment **[COMPLETE]** (PR #3391)
  - Migrated from subdomain to `/api/v1` sub-path pattern
  - Updated environment manifest with new base URLs
  - Network routing documentation in GOLDEN_FILES.md
  - Nginx configuration verified for `/api/` proxy

- [x] 5.5: Email Ingestion Engine **[COMPLETE]** (PR #3397)
  - EmailLog model with status workflow
  - EmailIngestionService with multi-tenant polling
  - Microsoft Graph API integration (last 7 days, order keywords)
  - Duplicate prevention via unique message_id constraint
  - AI extraction signal handler (auto-triggers on new EmailLog)
  - Files: `backend/apps/integrations/models.py`, `services/email_ingestion.py`, `signals.py`

- [x] 5.6: Background Processing & Monitoring **[COMPLETE]** (PR #3397)
  - Celery tasks: sync_tenant_emails (5-min schedule), sync_single_tenant (manual)
  - Celery app configuration with Redis broker and beat scheduler
  - API endpoints: POST /email/sync/, GET /email/logs/
  - IngestionMonitor frontend component (AntD List, status tags, sync button)
  - Files: `backend/apps/integrations/tasks.py`, `projectmeats/celery.py`, `frontend/src/components/Integrations/IngestionMonitor.tsx`

**Note**: Original Phase 5 items (Email Webhook Tracking, Outlook Calendar Sync, External API Connectors) were superseded by Microsoft Graph email ingestion infrastructure, which provides more immediate business value.

**Deployment Requirements**:
1. Create migrations: `python manage.py makemigrations && python manage.py migrate`
2. Start Celery workers: `celery -A projectmeats worker --loglevel=info`
3. Start Celery beat: `celery -A projectmeats beat --scheduler django_celery_beat.schedulers:DatabaseScheduler`
4. Configure REDIS_URL environment variable
5. Register Microsoft Azure AD application for production secrets

**Target Completion**: ✅ ACHIEVED February 28, 2026


---

## Phase 6: Performance & Security [x] COMPLETE

**Completion Date**: February 27, 2026  
**Status**: ✅ 6/6 Complete (Workflows RLS hardening added as Phase 6.7)

### Completed Deliverables
- [x] 6.2: Security Hardening (OWASP Top 10, 85% coverage) - **DEPLOYED**
  - Backend: Token encryption, HTML sanitization
  - Frontend: DOMPurify XSS prevention, AES-GCM encryption
  - Files: `backend/apps/core/security.py`, `frontend/src/utils/security.ts`
  
- [x] 6.3: E2E Test Coverage (31 Playwright tests, 5 browsers) - **DEPLOYED**
  - Test suites: Auth, workflow, navigation
  - Files: `frontend/e2e/*.spec.ts`, `frontend/playwright.config.ts`
  
- [x] 6.5: Frontend Optimization (performance monitoring) - **DEPLOYED**
  - Hooks: useRenderPerformance, useDebounce, useInView, MemoCache
  - Files: `frontend/src/utils/performance.ts`
  
- [x] 6.6: Load Testing (Locust framework) - **DEPLOYED**
  - 3 user profiles, 4 task sets, 450+ lines
  - Files: `backend/locustfile.py`, `docs/LOAD_TESTING.md`

- [x] 6.7: Workflows RLS Hardening (PostgreSQL security) - **DEPLOYED** Feb 27, 2026
  - 9 workflow models refactored to TenantAwareModel (PR #3313)
  - 17 tables with PostgreSQL RLS policies (Migration 0015)
  - Database-level tenant isolation for all workflow data
  - Files: `backend/tenant_apps/workflows/models.py`, `workflows/migrations/0015_sync_workflow_rls_state.py`

### Blocked Deliverable
- [ ] 6.4: Sentry Integration (error tracking, APM) 🔒

**Blocker**: Sentry account credentials

**Git References**:
- PRs: #3301-#3304 (Gap Analysis Phase 6)
- Branches: 
  - `feat/gap-analysis-phase6-2-security-hardening`
  - `feat/gap-analysis-phase6-3-e2e-tests`
  - `feat/gap-analysis-phase6-5-frontend-optimization`
  - `feat/gap-analysis-phase6-6-load-testing`

**Target Completion**: 100% when Sentry account configured (Q2 2026)

---

## Phase 7: Intelligent Workform Editor [~] 90% COMPLETE (PRIMARY FOCUS)

**Status**: 🎯 Active Development - **HIGHEST PRIORITY**  
**Start Date**: February 2026  
**Progress**: 90% (10/11 sub-phases complete)

### Completed Deliverables
- [x] 7.1: AI-Powered Field Suggestions ✅ **COMPLETED** Feb 28, 2026
  - **PR**: #3388 (Infrastructure Diagnostics & AI Engine)
  - Backend: SuggestNodesView with OpenAI integration (gpt-4o-mini)
  - Frontend: Enhanced AISuggestionsPanel with loading states
  - Redis caching with 10-minute TTL (~90% cost reduction)
  - Graceful degradation to static suggestions
  - 8 unit tests for connectivity checks
  - **Files**: 
    - `backend/scripts/infrastructure_diagnostics.py` (197 lines)
    - `backend/tenant_apps/workflows/views.py` (+89 lines)
    - `frontend/src/components/FlowEditor/components/AISuggestionsPanel.tsx` (+120 lines)
  - **Status**: Code complete, awaiting infrastructure audit

- [x] 7.2: Enhanced Drag-and-Drop ✅ **COMPLETED** (All Sub-Features)
  - [x] Smart snapping and positioning (PR #3309)
  - [x] Container management with nesting (PRs #3343-#3345, #3374)
  - [x] Visual connection indicators (PR #3375)
  - [x] Batch operations (PR #3373)

- [ ] 7.3: Real-Time Collaboration 🔒 **BLOCKED** (Requires Redis WebSocket)
  - Multi-user editing with operational transforms
  - Presence indicators
  - Conflict resolution
  - Activity audit trail

- [x] 7.4: Advanced Node Types ✅ **COMPLETED** (PR #3346)
  - Conditional branching (11 operators, AND/OR logic)
  - Loop constructs (for-each, while, for-range)
  - Parallel execution paths
  - Sub-workflow embedding

- [x] 7.5: Performance Optimization ✅ **COMPLETED** (PR #3347, #3372)
  - Virtualized rendering (10x faster for 1000+ nodes)
  - Optimistic UI updates
  - Incremental auto-save with debouncing
  - Real-time FPS/memory monitoring

- [x] 7.6: Accessibility & I18n ✅ **COMPLETED** (PRs #3348, #3366)
  - WCAG 2.1 AAA compliance
  - Full keyboard navigation (arrow keys, Tab, vim bindings)
  - Screen reader support with ARIA live regions
  - Multi-language support (English/Spanish/French)

### Additional Deliverables (Foundation)
- [x] Workflow graph validation (PR #3351)
- [x] Variable resolver service (PR #3352)
- [x] Performance query optimization (PR #3353)
- [x] Dynamic theme system (PR #3354)
- [x] Workflow version history UI (PR #3356)
- [x] Entity mapping modal (PR #3358)

**Key Files**:
- `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx` (7,000+ lines)
- `backend/tenant_apps/workflows/views.py` (3,600+ lines, 15 endpoints)
- `backend/scripts/infrastructure_diagnostics.py` (197 lines)

**Development Principles**:
- ✅ **Additive-Only Changes**: Never break existing workflows
- ✅ **Multi-Tenant Safety**: Changes work across ALL tenants
- ✅ **Performance First**: Sub-100ms render times achieved
- ✅ **User Experience**: Progressive enhancement, undo/redo, graceful degradation

**Remaining Work**:
- 7.3: Real-Time Collaboration (blocked by Redis WebSocket configuration)

**Total Lines Delivered**: ~7,000+ lines of production code, 374+ unit tests

---

## Phase 8: Advanced Caching & Parallelization [~] ✅ INFRASTRUCTURE VERIFIED

**Status**: ✅ Infrastructure Verified (March 3, 2026) - Ready for Feature Development  
**Target Start**: Q2 2026 (April) - **Infrastructure Ready**

### Planned Deliverables
- [ ] 8.0: Three-Tier Product Strategy (Golden List + Tenant Preferences + Tenant Custom Products)
- [ ] 8.1: Redis Query Result Caching
- [ ] 8.2: CDN Integration for Static Assets
- [ ] 8.3: Parallel Task Execution (Celery workers)
- [ ] 8.4: Background Job Processing (Celery) - **Partially Complete** (email ingestion operational)
- [ ] 8.5: Edge Caching Strategies

**Infrastructure Verification**:
- ✅ Redis operational for caching backend
- ✅ Celery workers operational in dev
- ✅ Celery beat scheduler operational
- ✅ Background tasks running (email ingestion every 5 minutes)

**Blocker**: ✅ **RESOLVED** - Redis and Celery infrastructure operational

**Note**: Phase 8.4 (Background Job Processing) is partially operational with email ingestion tasks. Additional parallel execution patterns can now be implemented.

---

## Phase 9: Security Scanning & SBOM [ ] PLANNED

**Status**: Planning Phase  
**Target Start**: Q2 2026 (May)

### Planned Deliverables
- [ ] 9.1: Automated SBOM Generation
- [ ] 9.2: Container Image Scanning (Trivy/Grype)
- [ ] 9.3: Dependency Vulnerability Scanning
- [ ] 9.4: License Compliance Checking
- [ ] 9.5: Security Audit Reports

**Integration**: GitHub Actions security workflows

---

## 🚨 TECHNICAL DEBT REGISTRY

### Models Missing TenantAwareModel Inheritance

**Impact**: Inconsistent tenant isolation patterns, missing custom_data extensibility

#### HIGH PRIORITY (User-Facing Business Logic)
1. **backend/tenant_apps/contacts/models.py**
   - `Contact(TimestampModel)` → Should be `Contact(TenantAwareModel)`
   - Manual TenantManager - should inherit from TenantAwareModel
   - **Risk**: Contact data could leak across tenants

2. **backend/tenant_apps/invoices/models.py**
   - `Invoice(TimestampModel)` → Should be `Invoice(TenantAwareModel)`
   - `Claim(TimestampModel)` → Should be `Claim(TenantAwareModel)`
   - `PaymentTransaction(TimestampModel)` → Should be `PaymentTransaction(TenantAwareModel)`
   - Manual TenantManager - should inherit
   - **Risk**: Financial data exposure across tenants

3. **backend/tenant_apps/purchase_orders/models.py**
   - `PurchaseOrder(OrderMethodsMixin, TimestampModel)` → Should include `TenantAwareModel`
   - `CarrierPurchaseOrder(TimestampModel)` → Should be `CarrierPurchaseOrder(TenantAwareModel)`
   - `ColdStorageEntry(TimestampModel)` → Should be `ColdStorageEntry(TenantAwareModel)`
   - `PurchaseOrderHistory(TimestampModel)` → Should be `PurchaseOrderHistory(TenantAwareModel)`
   - **Risk**: Order data cross-tenant visibility

4. **backend/tenant_apps/locations/models.py**
   - `Location(TimestampModel)` → Should be `Location(TenantAwareModel)`
   - **Risk**: Address/facility data shared incorrectly

#### MEDIUM PRIORITY (Configuration & Workflow) ✅ **COMPLETE - February 27, 2026**
5. **backend/tenant_apps/workflows/models.py**
   - ✅ `TenantList` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ `TenantForm` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ `TenantFormEntity` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ `TenantFormField` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ `TenantFormRule` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ `TenantWorkflow` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ `TenantWorkflowCondition` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ `TenantWorkflowAction` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ `WorkflowExecutionLog` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ **RLS Policies**: All 17 workflow tables have PostgreSQL RLS enabled (Migration 0015)
   - **Status**: 🎉 **100% COMPLETE (9/9 models + 17 RLS policies)**
   - **Completion**: February 27, 2026 15:30 UTC

6. **backend/tenant_apps/ai_assistant/models.py** ✅ **COMPLETE - February 27, 2026**
   - ✅ `AIConfiguration` → Refactored to inherit from `TenantAwareModel` (PR #3369)
   - **Note**: `ChatSession` and `ChatMessage` use `OwnedModel` (includes tenant via user relationship)
   - **Status**: 🎉 **COMPLETE**
   - **Completion**: February 27, 2026 19:00 UTC

7. **backend/tenant_apps/cockpit/models.py** ✅ **COMPLETE - February 27, 2026**
   - ✅ `ActivityLog` → Refactored to inherit from `TenantAwareModel` (PR #3369)
   - ✅ `ScheduledCall` → Refactored to inherit from `TenantAwareModel` (PR #3369)
   - **Note**: `UserWorkspaceLayout` uses transitive isolation via user relationship
   - **Status**: 🎉 **COMPLETE (2/2 priority models)**
   - **Completion**: February 27, 2026 19:00 UTC

#### LOW PRIORITY (Through Tables & Utility Models) ✅ **COMPLETE - February 27, 2026**
8. **backend/tenant_apps/carriers/models.py** ✅ **COMPLETE**
   - ✅ `Carrier` → Refactored to inherit from `TenantAwareModel` (PR #3370)
   - **Completion**: February 27, 2026 19:15 UTC

9. **backend/tenant_apps/plants/models.py** ✅ **COMPLETE**
   - ✅ `Plant` → Refactored to inherit from `TenantAwareModel` (PR #3370)
   - **Completion**: February 27, 2026 19:15 UTC

10. **backend/tenant_apps/bug_reports/models.py** ✅ **COMPLETE**
    - ✅ `BugReport` → Refactored to inherit from `TenantAwareModel` (PR #3370)
    - **Completion**: February 27, 2026 19:15 UTC

11. **Through Tables** (Many-to-Many relationships)
    - `InquiryProduct(models.Model)` → Consider TenantAwareModel for audit trails
    - `InquiryTemplateProduct(models.Model)` → Consider TenantAwareModel
    - `FulfillmentProduct(models.Model)` → Consider TenantAwareModel

### Remediation Plan

**Phase 1: High Priority Models** ✅ **COMPLETE - February 27, 2026**
- ✅ Week 1: Contact, Invoice, Claim, PaymentTransaction (PR #3308)
- ✅ Week 2-3: PurchaseOrder, CarrierPurchaseOrder, ColdStorageEntry, Location (PR #3310)
- Status: 🎉 **100% COMPLETE (8/8 models)**

**Completion Timeline**:

Week 1 - Contact & Financial Models:
  ✅ Contact: COMPLETED Feb 27 00:36 UTC (PR #3308)
  ✅ Invoice: COMPLETED Feb 27 00:36 UTC (PR #3308)
  ✅ Claim: COMPLETED Feb 27 00:36 UTC (PR #3308)
  ✅ PaymentTransaction: COMPLETED Feb 27 00:36 UTC (PR #3308)

Week 2-3 - Order & Location Models:
  ✅ PurchaseOrder: COMPLETED Feb 27 00:45 UTC (PR #3310)
  ✅ CarrierPurchaseOrder: COMPLETED Feb 27 00:45 UTC (PR #3310)
  ✅ ColdStorageEntry: COMPLETED Feb 27 00:45 UTC (PR #3310)
  ✅ Location: COMPLETED Feb 27 00:45 UTC (PR #3310)

**Impact**: All HIGH priority models (financial data, PII, order data, location data) now enforce database-level tenant isolation via PostgreSQL RLS.

---

**Phase 2: Medium Priority Models** ✅ **100% COMPLETE - February 27, 2026**
- ✅ Week 1-2: All workflow models (9 models) - PR #3313
- ✅ Migration 0014: Added tenant ForeignKey fields to all workflow models
- ✅ Migration 0015: Enabled PostgreSQL RLS on all 17 workflow tables
- ✅ Week 3: AI assistant models - PR #3369 (AIConfiguration)
- ✅ Week 4: Cockpit models - PR #3369 (ActivityLog, ScheduledCall)
- **Status**: 🎉 **100% COMPLETE (12/12 models)**

**Phase 3: Low Priority Models** ✅ **100% COMPLETE - February 27, 2026**
- ✅ Week 1: Carrier, Plant, BugReport - PR #3370
- ✅ Final testing: Migrations generated and merged
- **Status**: 🎉 **100% COMPLETE (3/3 models)**
- **Completion**: February 27, 2026 19:15 UTC

**Summary**: ALL technical debt eliminated. 14/14 models migrated to TenantAwareModel.

**Migration Pattern**:
```python
# Step 1: Update model inheritance
class MyModel(TenantAwareModel):  # Changed from TimestampModel
    # Remove manual tenant field (inherited)
    # Remove manual TenantManager (inherited)
    pass

# Step 2: Create migration
python manage.py makemigrations --name update_mymodel_tenantaware

# Step 3: Add RLS policy in migration
operations = [
    migrations.AlterModelBases(...),
    RunSQL(
        sql="ALTER TABLE app_mymodel ENABLE ROW LEVEL SECURITY; ...",
        reverse_sql="..."
    )
]

# Step 4: Test tenant isolation
# Step 5: Deploy with --fake-initial
```

---

## 📊 PROGRESS METRICS

### Overall Completion
- **Total Phases**: 9
- **Complete**: 3.83 phases (P1 @ 100%, P4 @ 100%, P6 @ 83%, P7 @ 85%)
- **In Progress**: 0 phases (awaiting external credentials)
- **Blocked**: 3 phases (P2, P3, P5) + 1 sub-phase (P6.4)
- **Planned**: 2 phases (P8, P9)
- **Progress**: 75% (42/56 todos) + **100% Technical Debt Complete**

### By Category
- **UI/UX**: 100% (Phase 1 complete)
- **Admin**: 100% (Phase 4 complete)
- **Security**: 85% (Phase 6 @ 83%, Phase 9 pending)
- **AI/ML**: 10% (Phase 2 blocked, Phase 7 in progress)
- **Integrations**: 0% (Phase 5 blocked)
- **Performance**: 60% (Phase 6 partial, Phase 8 pending)

### Infrastructure Blockers

**Status**: 🎉 **ALL DEV INFRASTRUCTURE VERIFIED** (March 3, 2026)

- ~~**OpenAI API**: Blocks 4 todos (Phase 2)~~ ✅ **VERIFIED** - Operational in dev (Mar 3, 2026)
- ~~**Redis**: Blocks 4 todos (Phase 3) + 1 todo (Phase 7.3) + 5 todos (Phase 8)~~ ✅ **VERIFIED** - Operational in dev (Mar 3, 2026)
- ~~**Microsoft OAuth**: Blocks 4 todos (Phase 5)~~ ✅ **VERIFIED** - Phase 5 complete (Feb 28, 2026)
- ~~**Sentry**: Blocks 1 todo (Phase 6.4)~~ ✅ **VERIFIED** - Operational in dev (Feb 28, 2026)

**Total Blocked in Dev**: 0 todos (0%) 🎉  
**Previously Blocked**: 15 todos (21%)  
**All Unblocked**: March 3, 2026 - Full infrastructure stack operational

**Infrastructure Verification Evidence**:
- Redis: Celery workers + beat scheduler operational, email ingestion running
- OpenAI: gpt-4o-mini model accessible, AI suggestions with caching functional
- Sentry: DSN initialized, error tracking middleware active
- Microsoft Graph: OAuth flow operational, email ingestion service running

---

## 🔄 WORKFLOW FOR AI ASSISTANTS

### Standard Operating Procedure

**CRITICAL**: After ANY code changes are committed, immediately update this file:

#### 1. After Completing a Todo
```bash
# Example: Completed Phase 7.2 Enhanced Drag-and-Drop
- [ ] 7.2: Enhanced Drag-and-Drop  # BEFORE
- [x] 7.2: Enhanced Drag-and-Drop  # AFTER

# Add completion note
**Completed**: February 28, 2026
**PR**: #3350
**Files**: UnifiedFlowEditor.tsx, DragHandler.tsx
```

#### 2. After Discovering Technical Debt
```bash
# Add to Technical Debt Registry under appropriate priority
### HIGH PRIORITY
12. **backend/tenant_apps/newapp/models.py**
    - `NewModel(models.Model)` → Should be `NewModel(TenantAwareModel)`
    - **Risk**: [describe tenant isolation risk]
```

#### 3. After Infrastructure Unblocks
```bash
# Update phase status
## Phase 2: Forms/Workflows - AI-Powered [x] COMPLETE  # Changed from BLOCKED

# Update blocker section
**Blocker**: ~~OpenAI API key~~ RESOLVED (March 15, 2026)
```

#### 4. After Each Commit
1. ✅ Update phase checkbox if todo completed
2. ✅ Add completion date and PR reference
3. ✅ Update "Last Updated" date at top
4. ✅ Update progress percentages
5. ✅ Document any new technical debt discovered

### Commit Message Template
```
<type>: <description>

Updates MASTER_PLAN.md:
- [x] Mark Phase X.Y as complete
- Add PR #XXXX reference
- Update progress: XX% -> YY%

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## 📚 REFERENCES

### Key Documentation
- **Architecture**: `docs/architecture/ARCHITECTURE.md`
- **Copilot Instructions**: `.github/copilot-instructions.md`
- **Golden Pipeline**: `docs/reference/GOLDEN_PIPELINE.md`
- **Migration Standards**: `docs/workforms/MIGRATION_STANDARDS.md`
- **Handoff Document**: `docs/HANDOFF.md`

### Phase-Specific Docs
- Phase 1: `docs/plans/PHASE1_INTEGRATION_COMPLETE.md`
- Phase 2: `docs/plans/PHASE2_EXECUTION_COMPLETE.md`
- Phase 3: `docs/plans/PHASE3_DEPLOYMENT_CHECKLIST.md`
- Phase 4: `docs/plans/PHASE4_COMPLETE_IMPLEMENTATION.md`
- Phase 5: `docs/plans/PHASE5_IMPLEMENTATION_SUMMARY.md`
- Phase 6: `docs/plans/PHASE6_SUMMARY.md`, `docs/plans/PHASE_6_*_COMPLETE.md`

---

**Master Plan Version**: 1.0.0  
**Maintained By**: Development Team + AI Assistants  
**Next Review**: March 15, 2026

---

## 🚨 EMERGENCY: Node Config Blackout & Registry Normalization

**Date Added**: March 17, 2026  
**Severity**: CRITICAL  
**Status**: PENDING IMPLEMENTATION

### Root Cause Analysis

Based on a deep architectural audit of the provided source files and error logs, the "blackout" in the node configuration panels is caused by a **systemic failure in the Schema Validation engine** and a **critical missing reference** in the field renderers. While the `Form` and `FormProcess` nodes are functioning because their schemas were recently normalized, the rest of the editor is currently locked in a "fallback" state because the registry is crashing during initialization.

#### I. Root Cause Analysis

1. **The Registry TypeError:** The console log `Uncaught TypeError: c.validation.forEach is not a function` at `schemaRegistry.ts:313` is the primary blocker. The validator expects the `validation` property to be an **Array**, but schemas for `createRecord`, `outlookEmail`, and others define it as an **Object**. This crash prevents the dynamic panel from rendering anything but an empty container (`<div class="sc-cogdcj jDMnzb"></div>`).

2. **Reference Error (Hard Crash):** The log `ReferenceError: ValidationRuleBuilder is not defined` in `complexRenderers.tsx` indicates that nodes using advanced validation (like `actionCreateRecord` or `actionEmail`) trigger a hard crash the moment they are clicked.

3. **Broken Node Callbacks:** The `Uncaught TypeError: a is not a function` in `FormProcessGroupNode.tsx` confirms that the `onEdit` and `onDelete` handlers are not being correctly passed or bound in the `UnifiedFlowEditor`.

#### II. 🤖 COPILOT CLI DELEGATION: EMERGENCY RESTORATION

**Mode:** `plan`  
**Agent:** `claude-opus-4.5` (followed by `claude-sonnet-4.5` in `automode`)

**Detailed Prompt:**

> **Context:** Senior Lead Architect for ProjectMeats. We are performing an EMERGENCY restoration of the FlowEditor Configuration Engine.
>
> **Objective 1: Harden the Schema Registry Validator**
> 1. Modify `frontend/src/components/FlowEditor/config/schemaRegistry.ts`.
> 2. In `validateSchema`, add a defensive normalization step:
> ```typescript
> if (field.validation && !Array.isArray(field.validation)) {
>   field.validation = [field.validation]; // Auto-wrap object into array
> }
> ```
> 3. Update the validator to allow `info` and `button` field types to exist without a `label` property to prevent "missing label" warnings.
>
> **Objective 2: Fix Missing Renderer Imports**
> 1. Locate `frontend/src/components/FlowEditor/config/fieldRenderers/complexRenderers.tsx`.
> 2. Import the `ValidationRuleBuilder` component (verify its location, likely in `ConfigPanel/ValidationRuleBuilder.tsx`).
> 3. Ensure the `renderValidationBuilder` function correctly utilizes the component instead of throwing a `ReferenceError`.
>
> **Objective 3: Normalize All Node Schemas**
> 1. Locate all instances of `validation: { ... }` in `frontend/src/components/FlowEditor/config/nodeConfigSchemas.ts` and convert them to `validation: [{ type: 'required', message: '...' }]`.
> 2. Prioritize fixing `triggerSchema`, `actionCreateRecordSchema`, `actionEmailSchema`, and `timerDelaySchema`.
> 3. For `documentGenerateSchema`, implement a fallback for the `templateId` select: if no dynamic options are present, render a descriptive "Loading Templates..." placeholder.
>
> **Objective 4: Repair Node Event Handlers**
> 1. Update `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx`. Ensure the `onEdit` handler is correctly injected into the `data` object for ALL node types in the `nodesWithHandlers` useMemo.
> 2. In `FormProcessGroupNode.tsx`, ensure `handleConfigure` and `handleSave` check if the callback is a function before execution: `if (typeof data.onEdit === 'function') { data.onEdit(); }`.
>
> **Strict Compliance:**
> * Relocate `<div id="config-portal"></div>` to `frontend/index.html` within the `<body>` to eliminate mount race conditions.
> * Update `.github/MASTER_PLAN.md` with the resolution of "Node Config Blackout & Registry Normalization."

#### III. 📝 VERIFICATION TASKS

1. **Configuration Verification:** Once the PR is merged, click an **Action: Send Email** node and verify that the "To", "Subject", and "Body" fields appear immediately.

2. **Wait Node Test:** Verify that clicking a **Timer: Delay** node now shows a numeric duration input and a unit dropdown (Minutes/Hours) instead of a blank panel.

3. **Manual "Save" Audit:** Save a workflow containing a **Form Process Group** and verify that the success toast appears without the `TypeError: a is not a function` error appearing in the background console.

4. **Schema Robustness Check:** Verify that the console no longer logs "Invalid schema" warnings for the `createRecord` or `outlookEmail` nodes.

