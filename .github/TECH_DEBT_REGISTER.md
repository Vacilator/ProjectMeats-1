# TECH_DEBT_REGISTER.md

> **Status:** active machine-readable debt inventory  
> **Canonical priority source:** root `MASTER_PLAN.md`  
> **Execution backlog:** `.github/EPIC_TICKETS.md`

| Debt ID | Domain | Finding | Severity | Effort | File Paths | Remediation Strategy | Linked Epic | Status |
|---|---|---|---|---|---|---|---|---|
| TD-FE-001 | Frontend | Tenant-aware server-state keys are inconsistent and rely on global cache clearing | High | M | `frontend/src/App.tsx`, `frontend/src/pages/Customers.tsx`, `frontend/src/pages/Suppliers.tsx`, `frontend/src/hooks/useFavorites.ts` | Add tenant-aware query key factory, migrate tenant-scoped queries, remove app-level cache clear hack | EH-04 | ✅ Resolved (PR #5459) |
| TD-FE-002 | Frontend | Legacy `useEffect` fetching and manual cache logic still dominate | High | L | `frontend/src/pages/SalesOrders/SalesOrders.tsx`, `frontend/src/pages/PurchaseOrders.tsx`, `frontend/src/contexts/ThemeContext.tsx`, `frontend/src/hooks/useCachedQuery.ts` | Replace with TanStack Query hooks and retire `useCachedQuery` | EH-04 | ✅ Resolved (PR #5460) |
| TD-FE-003 | Frontend | Service layer is bypassed from pages/components and `businessApi` is only an alias | High | M | `frontend/src/services/businessApi.ts`, `frontend/src/components/Cockpit/SmartSearch.tsx`, `frontend/src/components/Navigation/CommandPalette.tsx`, `frontend/src/contexts/ThemeContext.tsx` | Enforce domain services/hooks and ban direct raw client imports outside service modules | EH-03 | ✅ Partially Resolved — API import boundary lint added (PR #5466); no active violations; full service layer rewrite deferred |
| TD-FE-004 | Frontend | No OpenAPI-generated TS types; handwritten `any` payloads drift | High | L | `manifests/openapi/openapi-schema.baseline.json`, `frontend/src/services/workformsApi.ts`, `frontend/src/services/schemaService.ts`, `frontend/src/components/Cockpit/SmartSearch.tsx` | Generate frontend/mobile contract artifacts from OpenAPI and replace handwritten DTO hotspots | EH-03 | Open |
| TD-FE-005 | Frontend | Search UX is fragmented across multiple endpoints and result contracts | High | L | `frontend/src/components/Navigation/CommandPalette.tsx`, `frontend/src/components/Cockpit/SmartSearch.tsx`, `frontend/src/components/Search/ContinuousSearch.tsx` | Create one search SDK/result taxonomy and phase all surfaces onto it | EH-04 | Open |
| TD-FE-006 | Frontend | FlowEditor is monolithic and coexists with dual graph libraries | High | XL | `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx`, `frontend/src/components/Workflow/PurchaseOrderWorkflow.tsx`, `frontend/src/components/EntityGraph/EntityGraph.tsx` | Split editor into store/modules and standardize on `@xyflow/react` | EH-04 | Open |
| TD-FE-007 | Frontend | Theme-token, logging, a11y, and page test compliance is incomplete | Medium-High | L | `frontend/src/pages/PurchaseOrders.tsx`, `frontend/src/apps/admin-studio/components/SchemaEditor.tsx`, `frontend/src/components/Admin/AdminErrorBoundary.tsx`, `frontend/src/pages/SalesOrders/SalesOrders.tsx` | Expand token/logger enforcement, consolidate boundaries, add a11y + interaction coverage | EH-04 | ✅ Partially Resolved — SchemaEditor ARIA labels (PR #5466); SupplierBidPanel keyboard + aria-labels (PR #5479-#5480); MyTrades card a11y (PR #5479); InquiryDetailModal close aria-label (PR #5479); color lint + render stability lint pass ✅; remaining: broader page-level audit |
| TD-BE-001 | Backend | Tenant/RLS setup still contains fail-open paths in middleware and tasks | Critical | M | `backend/apps/tenants/middleware.py`, `backend/apps/tenants/rls.py`, `backend/apps/core/tasks.py`, `backend/apps/tenants/tasks.py` | Fail closed when tenant/RLS session state cannot be asserted and remove `strict=False` from protected paths | EH-02 | ✅ Partially Resolved — Middleware hardened: silent pass→logged, no-tenant API warning, dead code removed (PR #5514). All tasks already use strict=True. No strict=False usage found. |
| TD-BE-002 | Backend | First-batch tenant idempotency shipped, but remaining mutating APIs still lack explicit idempotency coverage or exemption guidance | High | M | `backend/apps/core/services/idempotency.py`, `backend/tenant_apps/ai_assistant/views.py`, `backend/apps/system/workform_views.py` | Keep the shipped core idempotency layer for workform execute + AI document upload, then extend or explicitly exempt remaining mutating APIs such as chat and feedback paths | EH-02 | Open |
| TD-BE-003 | Backend | AI chat persistence is not tenant-native and lacks RLS | High | L | `backend/tenant_apps/ai_assistant/models.py`, `backend/tenant_apps/ai_assistant/views.py`, `manifests/RLS_POLICIES.md` | ~~Add `tenant` FK, backfill, add RLS policies~~ Already done in migration 0016 | EH-02 | ✅ Resolved |
| TD-BE-004 | Backend | Collaboration locking is non-atomic and effectively unused | High | M | `backend/tenant_apps/workflows/services/locking.py` | Replace with atomic Redis locking and wire it into collaboration/runtime flows | EH-02 | Open |
| TD-BE-005 | Backend | Soft delete is only partial across tenant business entities | Medium | L | `backend/apps/core/models.py`, `backend/tenant_apps/customers/models.py`, `backend/tenant_apps/suppliers/models.py` | Define retention classes and migrate high-value entities to a standard delete strategy | EH-02 | Open |
| TD-BE-006 | Backend | Redis/channels/cache semantics are not production-grade across non-dev lanes | High | M | `backend/projectmeats/settings/base.py`, `backend/apps/system/services/workform_circuit_breaker.py`, `manifests/GOLDEN_FILES.md` | Require Redis/Valkey in non-dev and add readiness/deploy gates | EH-05 | Open |
| TD-BE-007 | Backend | RAG/pgvector architecture is mixed between JSON embeddings and vector queries | Medium | L | `backend/tenant_apps/ai_assistant/models.py`, `backend/tenant_apps/workflows/services/prompter.py`, `backend/projectmeats/settings/test.py` | Pick one canonical vector strategy with explicit fallback and backfill plan | EH-06 | Open |
| TD-BE-008 | Backend | OpenAPI annotations and service layering are uneven on AI/high-churn endpoints | Medium | M | `backend/tenant_apps/ai_assistant/views/`, `backend/tenant_apps/workflows/views.py`, `backend/apps/tenants/views.py`, `backend/apps/system/views/choice_viewsets.py` | Add schema annotations and split oversized view modules into service-oriented boundaries | EH-03 | ✅ Partially Resolved — views.py decomposed into 10-module package (PR #5461); OpenAPI annotations still needed |
| TD-OPS-001 | Ops | Drift gate is too shallow to catch stale docs and authority drift | High | M | `scripts/verify_golden_state.sh`, `.github/scripts/check_infrastructure.sh`, `.github/workflows/README.md`, `docs/guides/BRANCH_PROTECTION_SETUP.md` | Expand drift validation to docs, workflow reality, rollback assets, and canonical refs | EH-01 | Open |
| TD-OPS-002 | Ops | Secret governance is not fully generated from the manifest | High | M | `manifests/env.manifest.json`, `.github/workflows/reusable-deploy.yml` | Generate required-secret behavior from the manifest and add parity checks | EH-01 | Open |
| TD-OPS-003 | Ops | PR-time security, Dependabot scope, release automation, and rollback assets are incomplete | High | L | `.github/workflows/pr-validation.yml`, `.github/workflows/15-dependabot-merge-when-green.yml`, `.github/scripts/deployment-rollback.sh`, `docs/runbooks/INCIDENT_RESPONSE.md` | Add PR-time security gates, restrict bot auto-merge, align rollback docs/scripts, and create release workflow | EH-01, EH-05 | Open |
| TD-OPS-004 | Ops | E2E coverage thresholds and production observability are below enterprise expectations | Medium | L | `frontend/e2e/*.spec.ts`, `pyproject.toml`, `frontend/package.json`, `manifests/GOLDEN_FILES.md` | Add narrow PR smoke, nightly broader suites, coverage thresholds, and lane-wide alerting/ownership | EH-05 | ✅ Partially Resolved — Python fail_under=50, Vitest thresholds added (PR #5461); E2E smoke + alerting still needed |
| TD-AI-001 | AI | No persisted autonomy control plane exists | Critical | L | `backend/tenant_apps/ai_assistant/swarm/__init__.py`, `backend/tenant_apps/ai_assistant/swarm/router.py`, `backend/tenant_apps/ai_assistant/views.py` | Introduce persisted run/task/approval models and governed execution flow | EH-06 | Open |
| TD-AI-002 | AI | Semantic indexing service is missing/inconsistent | Critical | L | `backend/tenant_apps/integrations/services/email_ingestion.py`, `backend/tenant_apps/ai_assistant/services/memory_service.py`, `backend/tenant_apps/ai_assistant/services/tenant_memory_service.py` | Add real semantic indexing service and vector-first retrieval with lexical fallback | EH-06 | Open |
| TD-AI-003 | AI | Graph retry/backoff, lineage, HITL, telemetry, and export governance are incomplete | High | L | `backend/tenant_apps/integrations/services/email_ingestion.py`, `frontend/src/components/AIAssistant/AIAgentWidget.tsx`, `frontend/src/components/Cockpit/AILearningMetricsWidget.tsx`, `backend/tenant_apps/ai_assistant/services/rlhf_compiler.py` | Add shared HTTP client, lineage model, approvals workbench, real telemetry, and durable export storage | EH-06 | Open |

---

## Guardrails Added (Phase 59–61)

| Guardrail | Type | Script/Config | Added In |
|-----------|------|---------------|----------|
| Query key tenant scoping lint | CI lint | `frontend/.eslint/scripts/check-query-key-scoping.cjs` / `npm run lint:query-keys` | PR #5459 |
| Console error monitor (dev) | Dev tool | `frontend/src/components/DevTools/ConsoleErrorMonitor.tsx` | PR #5458 |
| Python coverage threshold | CI gate | `pyproject.toml` `fail_under = 50` | PR #5461 |
| Vitest coverage threshold | CI gate | `frontend/vite.config.ts` coverage.thresholds | PR #5461 |
| API import boundary lint | CI lint | `frontend/.eslint/scripts/check-api-import-boundaries.cjs` / `npm run lint:api-boundaries` | PR #5466 |
| Idempotent RLS policy lint | CI lint | `.github/scripts/check-idempotent-rls.sh` | PR #5471 |
| Frontend deploy API check advisory | CI/CD | Advisory-only API routing check when `run_backend_lane=false` in reusable-deploy.yml | PR #5478 |

## Features Added (Phase 60)

| Feature | Domain | Description | PRs |
|---------|--------|-------------|-----|
| TradeDocument model + API | Backend | Document tracking per trade session/stage with sent/received direction, auto-gen hooks, email integration | PR #5463 |
| TradeDocumentsPanel | Frontend | Stage-grouped document viewer with upload, direction badges, collapsible sections | PR #5464 |
| Stepper document links | Frontend | Click workflow steps to see stage actions + related documents in popover | PR #5465 |

## Bug Fixes (Phase 62–67)

| Fix | Domain | Description | PRs |
|-----|--------|-------------|-----|
| React #185 modal render loop | Frontend | `afterOpenChange` gate in EntityFormSurface delays UEF mounting until antd Modal animation completes | PR #5467 |
| Email sync fallback | Backend | Synchronous fallback via `EmailIngestionService.poll_tenant_by_id()` when Celery broker unavailable | PR #5467 |
| Trade session status cascade | Backend | Added `_update_trade_session_status_from_doc` calls in inquiry→PO (ordered) and SO→CarrierPO (logistics) | PR #5467 |
| Console 404 floods | Frontend | Home, RecordActivityFeed, CockpitApprovalPanel, aiService — try/catch + retry:false | PR #5468 |
| Cascade RFQ/existing-PO gap | Backend | RFQ success and existing_po paths now create trade docs + advance status | PR #5468 |
| All cascade idempotency gaps | Backend | SO→CarrierPO, CarrierPO→Fulfillment, Fulfillment→Invoice "already exists" paths now advance trade session status | PR #5469 |
| Stepper a11y | Frontend | ARIA role/label/tabIndex on clickable step nodes, aria-expanded on expand buttons | PR #5469 |
| Deployment: idempotent RLS migration | Backend | Migration 0016 `CREATE POLICY` wrapped in `DO $$/EXCEPTION WHEN duplicate_object` for idempotency | PR #5470 |
| Cockpit 404 hardening | Frontend | NextActionChips, AnalyticsDashboard, FinancialsPanel, InterventionDashboard, AILearningMetrics — try/catch + retry:false | PR #5470 |
| OAuth broad except narrowed | Backend | `integrations/views.py` OAuth callback: removed `Exception` from except tuple, kept only `BadSignature/SignatureExpired` | PR #5470 |
| Trade doc logging upgrade | Backend | `_create_trade_document` failure now logs `error` instead of `warning` | PR #5470 |
| Console errors: 4 more components | Frontend | WorkflowStatusBar, ProcessFlowHeader (2 queries), TradeLineageFlow, PartyRoleBadges — try/catch + retry:false | PR #5472 |
| React index keys | Frontend | BreadcrumbBar: remove index from key; WorkflowExecutionDetails: stable composite key | PR #5472 |
| Frontend deploy API check advisory | Ops | API routing check made advisory (warning only) for frontend-only deploys when backend is unreachable | PR #5478 |
| Tenant safety: InquiryTemplate counter | Backend | Added `tenant=request.tenant` to InquiryTemplate usage counter update (was unscoped) | PR #5479 |
| Hardcoded #fff removed | Frontend | ActionBannerCTA color changed to `rgb(var(--color-primary-foreground, 255 255 255))` | PR #5479 |
| A11y: SupplierBidPanel keyboard | Frontend | Added onKeyDown handler, aria-labels on all icon-only buttons + Add/RequestAll buttons | PR #5479, #5480 |
| A11y: InquiryDetailModal close | Frontend | Added aria-label="Close inquiry details" to close button | PR #5479 |
| A11y: MyTrades trade card headers | Frontend | Added role, tabIndex, aria-expanded, onKeyDown to trade card headers | PR #5479 |
| Cascade error logging detail | Backend | _create_trade_document failure now logs stage, trade_session_id for faster incident diagnosis | PR #5480 |

## Features Added (Phase 60–67b)

| Feature | Domain | Description | PRs |
|---------|--------|-------------|-----|
| TradeDocument model + API | Backend | Document tracking per trade session/stage with sent/received direction, auto-gen hooks, email integration | PR #5463 |
| TradeDocumentsPanel | Frontend | Stage-grouped document viewer with upload, direction badges, collapsible sections | PR #5464 |
| Stepper document links | Frontend | Click workflow steps to see stage actions + related documents in popover | PR #5465 |
| RFQ email dispatch wired | Backend | request-bid and request-all-bids endpoints now actually send RFQ emails via Microsoft Graph | PR #5472 |
| Bid response → bid record update | Backend | Email reply parser now updates InquiryProductSupplierBid rows (status, pricing, dates) | PR #5472 |
| SupplierBidPanel date/location | Frontend | Respond-by, fulfillment date, ship-to location columns with inline editing | PR #5472 |
| Stepper actionable items | Frontend | Required actions now clickable with arrow indicators and onActionClick callback | PR #5472 |
| Trade session context on inquiry | Backend + Frontend | Inquiry detail now shows real trade session status/step, extended action banner for 10+ trade stages | PR #5473 |
| Searchable supplier dropdown | Frontend | Replaced free-text Input with searchable Select querying suppliersApi.list() in SupplierBidPanel | PR #5475 |
| accept_bid cascade advance | Backend | After accepting a bid, checks all products have accepted bids, then calls advance_orchestrator() | PR #5475 |
| Stepper entity navigation | Frontend | InquiryDetailModal + MyTrades stepper deep-links to PO/SO/CarrierPO records via onActionClick | PR #5475, #5476 |
| Action banner CTA buttons | Frontend | "Go to PO", "Go to SO", "Go to Carrier PO" buttons in WorkflowActionBanner with entity navigation | PR #5476 |
| customerId prop for ship-to | Frontend | Pass customerId to SupplierBidPanel so ship-to dropdown loads correct customer locations | PR #5477 |
| Rejected inquiry banner | Frontend | Show "Inquiry Rejected" banner with reason when inquiry.status === 'rejected' | PR #5477 |
| Stepper deep-linking: fulfillment/invoice | Frontend | Fixed entity linkage for fulfillment/invoice steps (uses custom_data IDs, not PO FK) | PR #5479 |
| Trade list entity IDs | Backend | Trade sessions list now returns linked entity IDs for stepper deep-linking | PR #5479 |
| Orchestrator None fallback | Backend | Unknown/blank route now returns None instead of defaulting to DRAFT_SALES_ORDER | PR #5479 |
| Audit trail endpoint | Backend | Synthesized audit trail from entity timestamps, trade documents, admin log on all trade ViewSets | PR #5513 |
| RecordActivityFeed re-enabled | Frontend | Activity feed query re-enabled now that backend audit-trail endpoint exists | PR #5513 |
| ESLint non-FlowEditor cleanup | Frontend | Fixed 36 remaining non-FlowEditor ESLint warnings (unused imports, useless fragments, unused vars) | PR #5513 |
| Tenant middleware fail-closed | Backend | Hardened middleware: silent pass→logged, no-tenant API warning, dead code removed (TD-BE-001) | PR #5514 |
