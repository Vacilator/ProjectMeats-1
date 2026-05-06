# MASTER_PLAN.md (Canonical)

**Status**: 🔄 Living document (canonical source of truth)  
**Last Updated**: 2026-05-06  
**Primary Focus**: Phase 15 execution continues with `B2B-03.3 reconciliation-engine-into-paymenttransaction` now in PR #4911 after the settlement event-store lane shipped in PR #4910; downstream accountant queue work remains staged and Phase 16 Core Trading Engine execution remains sealed

This file is the **canonical plan + current truth snapshot**.
- **PR execution log (append-only):** `.github/MASTER_PLAN.md`
- **Reference roadmaps:** `ROADMAP.md`, `UI_ROADMAP.md` (may contain outdated “100% complete” claims; do not treat as authoritative)

---

## Current Execution Snapshot (as of 2026-05-06)

### What is true right now
- **WorkForms E2E** is shipped end-to-end (execute + monitoring + notifications + Quick Actions + Gmail connector MVP).
- **Primary execution focus (P0):** continue Phase 15 from the top of `.github/EPIC_TICKETS.md` with `B2B-03.3 reconciliation-engine-into-paymenttransaction`, now open in PR #4911 after `B2B-03.2 settlement-event-store-and-public-ingest-endpoint` shipped tenant-scoped settlement sources, the raw event journal, a fail-closed public ingest path, and async validation without touching `PaymentTransaction` yet.
- **Strategic enterprise audit is now complete:** the repo has a fresh baseline in `GAP_ANALYSIS_REPORT.md`, `STRATEGIC_BLUEPRINT.md`, `.github/TECH_DEBT_REGISTER.md`, `.github/SDLC_PROTOCOLS.md`, and `.github/EPIC_TICKETS.md`. Those files translate the current gap analysis into execution-ordered, machine-readable work without replacing this canonical plan.
- **Phase 14 execution is sealed:** the full GA / UX stabilization lane is now shipped on `development` across `GA-01` ETL (PRs #4813, #4814, #4816, #4817), `GA-02` infrastructure + DR guardrails (PRs #4818-#4821), `GA-03` governance (PRs #4822, #4823, #4832, #4842), `Phase 14.5 / UI-01` stabilization (PRs #4836, #4838, #4840), `GA-04` onboarding (PRs #4844, #4846, #4848, #4850), and `GA-05` edge resilience (PRs #4852, #4854, #4856, #4858). Phase 12 has now restarted with `EH-01.1 drift-gate-depth` shipped in PR #4863, the previously merged `EH-01.2 manifest-required-secret-parity` work revalidated from PRs #4751/#4764, the already-merged `EH-01.3 pr-security-gates-and-dependabot-scope` hardening revalidated from PR #4766, `EH-01.4 rollback-release-automation-alignment` revalidated as already shipped via PR #4769, `EH-02.1 fail-closed-tenant-rls-runtime` revalidated as already shipped via PR #4771, `EH-02.2 platform-idempotency-keys` revalidated as already shipped via PRs #4773/#4776, `EH-02.3 chat-session-tenant-fk-rls` shipped in PR #4871, `EH-03.1 openapi-ai-and-high-churn-surface-coverage` revalidated as already shipped via PR #4775, `EH-03.2 openapi-ts-mobile-typegen` revalidated as already shipped via PRs #4777 and #4562, `EH-04.1 tenant-aware-query-keys-and-cache-clear-removal` shipped in PR #4874, `EH-04.2 search-contract-unification` shipped in PR #4876, and `EH-04.3 floweditor-decomposition-phase-1` shipped in PR #4878, promoting `EH-05.1 non-dev-redis-readiness-gate` as the next ready hardening item.
- **Phase 15 planning is complete and execution is now open:** the B2B Network epics remain architecturally sealed below, the full `B2B-02` trade-engine rollout (`B2B-02.1` through `B2B-02.4`) plus `B2B-01.1 guest-portal-access-contract-and-doc-source-inventory`, `B2B-01.2 portal-grant-and-document-registry-schema`, `B2B-01.3 public-portal-read-apis-and-audit-trail`, `B2B-01.4 frontend-public-portal-shell-and-magic-link-consume`, `B2B-01.5 operator-issue-resend-revoke-controls`, `B2B-03.1 settlement-ingest-contract-and-webhook-first-adapter-plan`, and `B2B-03.2 settlement-event-store-and-public-ingest-endpoint` have shipped, and `B2B-03.3 reconciliation-engine-into-paymenttransaction` is currently under review in PR #4911.
- **Phase 16 planning is now complete:** the Core Trading Engine happy-path state machine plus distributed hardening epics are documented below and translated into atomic blocked tickets at the bottom of `.github/EPIC_TICKETS.md`. This remains planning-only and stays blocked behind the active Phase 15 trade-invariants lane.
- **AI email/document lane** is now fail-closed through Graph attachment ingest and parser lifecycle hardening: tabular uploads parse safely, Outlook attachments bridge into `AIDocument`, unsupported attachment kinds are rejected pre-download, repeated same-session ingests dedupe with provenance, AI sessions are tenant-bound, attachment ingest requires a session-staged allowlist from `fetch_emails`, and `parse_document` now persists explicit processing/completed/failed metadata while raising structured parser/auth/unreachable errors.
- **Newly shipped since last snapshot (evidence; see `.github/MASTER_PLAN.md`)**:
  - Phase 15 settlement event store: added additive tenant-aware `SettlementSource` and `SettlementEvent` models plus RLS-backed migration coverage in `tenant_apps.integrations`; added authenticated settlement source management endpoints, a public tenant-path settlement ingest receiver, and async event validation that preserves tenant context without writing `PaymentTransaction` rows yet; and added focused backend coverage plus RLS manifest/validator updates for fail-closed auth, duplicate event collapse, and replay-safe raw journaling (PR #4910).
  - Phase 15 settlement contract: added the authoritative `docs/runbooks/SETTLEMENT_RECONCILIATION.md` runbook, a new `backend/tenant_apps/integrations/settlement_contract.py` backend contract seam that freezes the webhook-first adapter and replay-safe idempotency rules, a `PaymentTransaction` contract note plus focused backend regression coverage in `tenant_apps.invoices.tests` and `tenant_apps.integrations.tests`, and golden-file registry/validator enforcement so downstream settlement ingress work starts from one canonical ledger + raw-event journal contract (PR #4909).
  - Phase 15 operator portal controls: added authenticated tenant-scoped portal-grant operator endpoints for target list/create plus resend, revoke, and grant-centric history in `backend/apps/core/portal_views.py`; added backend grant-summary/request/history serializers and focused portal operator API coverage; added a new `frontend/src/services/portalGrantService.ts` service plus `frontend/src/components/Portal/SharePortalLinkPanel.tsx` so invoice and freight-order operators can issue, resend, revoke, and inspect grant history without reusing the public portal client; and wired those controls into `frontend/src/pages/Accounting/Invoices.tsx` and `frontend/src/pages/FreightOrders.tsx` with focused frontend regression coverage for the operator panel and service contract (PR #4908).
  - Phase 15 frontend portal shell: added a logged-out `/portal/tenants/:tenantId/grants/:grantId` route outside the internal app layout, a dedicated `portalService` client that strips internal auth/tenant headers, token-consume + URL-replace handling for portal magic links, and a guest-safe invoice/document/tracking shell in `frontend/src/pages/Portal/GuestInvoiceView.tsx`; coupled that shell to a new aggregate backend `/snapshot/` endpoint so one-time grants are consumed once and partial-scope grants render empty sections instead of false expired-link failures; and added focused backend/frontend regression coverage for the snapshot contract and deterministic expired-link UX (PR #4907).
  - Phase 15 public portal read APIs: added anonymous signed-grant invoice summary, curated document metadata, and fulfillment tracking endpoints under the tenant path in `backend/apps/core/portal_views.py`; added guest-safe invoice/fulfillment serializers plus portal-safe document metadata responses; established path-driven RLS + atomic grant consumption for bounded-use links; and wrote append-only `TenantAuditEvent` access records so guest reads now fail closed and leave structured audit evidence for the next portal/frontend lane (PR #4906).
  - Phase 15 portal grant/document schema: added additive tenant-aware `PortalGrant`, `PortalDocumentReference`, and `PortalGrantDocumentAccess` models in `backend/apps/core/models.py`; added fail-closed internal serializers that bind tenant context, require explicit resource/document allowlists, store grant tokens only as SHA-256 hashes at rest, and sanitize portal-safe metadata; added focused backend regression coverage for cross-tenant failures and portal-safe serialization; and installed additive RLS policies plus manifest registration for the new core portal tables so `B2B-01.3` can build on a tenant-explicit schema foundation (PR #4905).
  - Phase 15 guest-portal access contract: added the authoritative `docs/runbooks/B2B_EXTRANET_PORTAL.md` runbook, a backend security-constants seam that explicitly forbids reuse of internal guest-login/JWT auth and direct `AIDocument` exposure for counterpart access, and golden-state enforcement so future portal work starts from one signed-grant, tenant-explicit contract (PR #4904).
  - Phase 15 frontend trade normalization: added a shared frontend `trade.ts` helper for exact weight rendering, date-only-safe display formatting, and stable edit-form seeding; adopted the backend `trade_weight` / `trade_timeline` contract across purchase orders, freight orders, sales orders, and invoices; and added focused formatter/trade regression coverage so the frontend no longer drifts on unit casing or calendar-date rendering (PR #4903).
  - Phase 15 transactional API adoption: added shared serializer trade payload builders plus additive `trade_weight` / `trade_timeline` fields across purchase orders, carrier purchase orders, sales orders, invoices, and fulfillment serializers; added focused transactional regression coverage for those payloads; and refreshed the checked-in OpenAPI baseline so downstream consumers see the normalized contract without losing existing fields (PR #4902).
  - Phase 12 FlowEditor decomposition phase 1: extracted the passive overlay/presenter tail out of `UnifiedFlowEditor.tsx` into `FlowEditorPassiveOverlays`, preserving the existing graph mutation/config portal flows in the parent editor while adding focused regression coverage for overlay visibility, delete confirmation, keyboard shortcut help, execution/help/preview overlays, and Joyride wiring (PR #4878).
  - Phase 12 frontend search contract unification: rebuilt the shared frontend `searchService` around the approved business API layer with canonical entity-type normalization, deterministic route/icon/color derivation, and shared ranked/universal/continuous/recent-item helpers; moved Entity Explorer and diagnostics onto that contract; and refreshed focused command/search service regressions so frontend search entrypoints no longer drift on payload shape or recent-item semantics (PR #4876).
  - Phase 14 governance contract: added the authoritative `docs/runbooks/DATA_RETENTION.md` runbook and `backend/apps/core/services/data_governance.py` policy module, defining the 7-year transactional archive inventory, explicit exemptions, future legal-hold shape, archive-restore expectations, and operator evidence contract without shipping archive automation; registered the retention contract in `manifests/GOLDEN_FILES.md` and enforced it through the golden-state validator plus focused backend tests (PR #4822).
  - Phase 14 governance redaction hardening: centralized backend log/Celery/Sentry redaction plus frontend logger/Sentry sanitization, disabled default PII transport, added focused regression coverage for the redaction hooks, refreshed the retention runbook, and inserted the next-up Phase 14.5 UI stabilization block so modal lifecycle lockdown becomes the next execution target (PR #4832).
  - Phase 14.5 UI lifecycle hardening: restricted `CloneInquiryModal` to true open-state mounts on the Inquiries page, added `destroyOnHidden` to the plant/supplier/customer add-products modals, tightened their catalog refetch effects to avoid duplicate hidden-subtree churn, and added a page-level regression that proves the clone modal unmounts on close (PR #4836).
  - Phase 14.5 null-safe numeric formatting: added shared numeric coercion plus null-safe currency/fixed-number helpers, routed shared entity detail and invoice/receivable read-only surfaces through that canonical formatter path, and added focused regressions for helper behavior plus zero-valued invoice detail rendering (PR #4838).
  - Phase 14.5 breadcrumb UUID resolution: upgraded the shared app-shell breadcrumb to resolve supported entity-id segments into human-readable names through the approved business service layer, kept stable entity-label fallbacks when lookups miss, and added focused regression coverage for nested supplier/plant breadcrumb rendering (PR #4840).
  - Phase 14 governance schedules + evidence: added a tenant-aware governance posture audit service + `audit_data_governance` management command, scheduled daily `system.audit_data_governance_posture` checks on the `pm.ops` queue, documented the manual GitHub Actions operator path, and refreshed the retention/incident runbooks with explicit evidence capture steps for archive/redaction drift (PR #4842).
  - Phase 14 onboarding transactional empty states: added a reusable transactional onboarding empty-state wrapper, rolled first-run CTA guidance through purchase orders, sales orders, freight orders, invoices, and shared record tabs, and kept status/search-filter empty views separate from true zero-data onboarding states (PR #4848).
  - Phase 14 onboarding telemetry + resume controls: extended the canonical onboarding preference contract with lightweight per-tour telemetry, stopped tours from auto-replaying after intentional skips, and added app-shell help controls to start, resume, or replay the cockpit/workforms tours through the shared onboarding provider (PR #4850).
  - Phase 14 edge resilience PWA foundation: added the canonical Vite PWA/service-worker path, cached the app shell without precaching `env-config.js`, hydrated the last-known runtime config before app import, and documented the new manifest/service-worker output plus runtime-cache boundaries for offline-safe bootstrap (PR #4852).
  - Phase 14 edge resilience connectivity banner: added a shared browser connectivity provider, surfaced offline/reconnecting state through a global app-shell banner plus header pill, and added focused regressions for connectivity transitions and banner rendering while keeping the unrelated `EntityMapperModal` broad-suite failure explicitly out of scope for this batch (PR #4854).
  - Phase 14 edge resilience optimistic operational mutations: added optimistic operational status transitions for purchase, sales, and freight documents plus a tenant-scoped offline replay queue so weak-connectivity status changes stay visible and replay safely on reconnect (PR #4856).
  - Phase 14 edge resilience replay proof + rollout guard: added a runtime/local emergency disable control for the operational offline queue, a diagnostics replay smoke harness, deterministic replay/offline integration coverage, and a targeted Chromium smoke that keeps the rollout guard operator-visible and testable without relying on the unstable repo-wide Playwright baseline (PR #4858).
  - Phase 14 Redis / broker guardrails: pinned the Redis/Valkey `noeviction` policy and memory thresholds in Django settings, surfaced additive Redis guardrail + queue backlog diagnostics in public/operator health tooling, documented the broker-distress response contract in the Terraform scaffold and disaster-recovery architecture/runbooks, and enforced the new contract through backend regression coverage plus the golden-state validator (PR #4821).
  - Phase 14 async worker envelope hardening: made Celery queue ownership explicit (`pm.ops`, `pm.email`, `pm.workforms`, `pm.ai`, `pm.etl`), disabled implicit queue creation, lowered prefetch to `1`, routed beat jobs into named queues, codified worker envelopes and saturation thresholds in `deploy/terraform/`, added backend regression coverage for the queue contract, and enforced the topology through the golden-state validator (PR #4820).
  - Phase 14 disaster-recovery hardening: added `docs/runbooks/DISASTER_RECOVERY.md`, strengthened non-dev pre-migration backup verification with `pg_restore --list`, fixed the ops management/surgery workflow mapping for `production-backend`, aligned backup/DR docs to manifest-defined secret names, and added validator coverage so DR guidance and backup verification cannot silently drift (PR #4819).
  - Phase 14 infrastructure desired-state scaffold: added a non-applying `deploy/terraform/` contract for the current deployment topology, refreshed `INFRASTRUCTURE_ARCHITECTURE.md` to reflect live workflow/runtime paths, registered the scaffold in `GOLDEN_FILES.md`, and added golden-state enforcement so the IaC baseline cannot drift out of the repo unnoticed (PR #4818).
  - Phase 14 ETL transactional import pass: added transactional `import_golden_legacy_data --apply` routing for purchase orders, sales orders, carrier purchase orders, invoices, and line items; persisted explicit ETL batch modes; extended master-data apply coverage to carriers; added fixture-backed reconciliation/idempotency coverage; and updated the Golden Schema ETL runbook for GA-01.4 (PR #4817).
  - Phase 14 ETL dry-run engine: added tenant-safe ETL batch/row journal models with RLS, restart-safe rerun semantics, a journal-write-only `import_golden_legacy_data` dry-run engine, fixture-backed backend coverage for create/update/skip/error classification, and runbook guidance for GA-01.2 (PR #4814).
  - Phase 14 ETL master-data import pass: added `import_golden_legacy_data --apply` for tenant-scoped master-data upserts, ETL execution-context guards that suppress workflow-trigger fan-out, fixture-backed regression coverage for idempotency/cross-tenant safety/blank-email matching, and runbook-contract updates for GA-01.3 (PR #4816).
  - Phase 14 ETL foundation: added contract-only Golden Schema ETL scaffolding with deterministic entity ordering, tenant-explicit batch manifests, preview command output, fixture-backed backend tests, and an operator runbook for the Day 0 migration lane (PR #4813).
  - Core API reliability: fix `apps/core/views.py` legacy imports/`print()` landmines + add smoke tests (PR #4652).
  - Frontend standards: expand `lint:colors` + remove remaining hardcoded colors in MyTasks surfaces (PR #4650); replace high-churn `console.*` with `logger.*` (PR #4654).
  - Backend tenant safety: fail-closed `current/current_theme/admin_permissions` when tenant context is missing/ambiguous (PR #4656); wrap tenant-scoped Celery ORM in `tenant_rls(..., strict=False)` (PR #4657).
  - Mobile: device-safe API base URL + tests (PR #4658); switch builds to EAS (PR #4659).
  - WorkForms editor hot-path stability: derive validation/history/autosave from graph state (PR #32), move node actions out of `nodesWithHandlers` cloning and into editor context (PR #4720), and keep config-panel shadow edits local until Apply/Discard instead of rewriting the full node array on every keystroke (PR #4721).
  - WorkForms execution telemetry foundation: add a tenant-scoped `ExecutionEventLog` model with RLS, persist normalized execution/node/action events from `audit_trail`, and cover successful + failed action spans in backend tests (see `.github/MASTER_PLAN.md` for the shipped PR reference).
  - WorkForms runtime hydration: add persisted `runtime_state` snapshots on `TenantWorkFormExecution`, hydrate node status/current step/error projections from the telemetry stream, and keep execution serializers backward-compatible for legacy rows without runtime state.
  - WorkForms analytics dashboard: expose a tenant-safe execution analytics summary from the backend and upgrade the Monitoring page to show telemetry-backed KPIs, top failing steps, slowest actions, and busiest WorkForms.
  - AI email/document hardening: bridge Outlook attachments into `AIDocument`, preflight attachment metadata, persist provenance + same-session dedupe, hard-bind AI sessions/messages/uploads to `request.tenant`, enforce a session-scoped attachment allowlist before ingest, and normalize `parse_document` lifecycle/error handling for operator-visible status metadata (PRs #4733–#4739).

### P0 priorities (next)
- **Phase 12 - Enterprise Hardening & Tech Debt Eradication (active execution lane)**
  - **Next ready ticket:** `EH-05.1 non-dev-redis-readiness-gate`
  - **Why now:** the first FlowEditor extraction seam is in place, so the next highest-risk platform gap is non-dev runtime safety still allowing Redis/channel fallbacks that undermine the production lock/cache contract.
  - **Near-term execution ordering:** `EH-05.1`, then continue through the remaining ready `EH-05.*` and `EH-06.*` foundations in backlog order.
  - **Definition of ready:** `.github/EPIC_TICKETS.md` exposes exactly one first unchecked `Ready` ticket (`EH-05.1`) and keeps later hardening / planning tickets blocked or queued behind it.

- **Core API reliability**: ✅ shipped (PR #4652). Next: expand smoke coverage for always-on endpoints (health, tenant resolution, auth bootstrap) and keep them in PR gates.

- **Phase 10 Sprint 1 stability gate (shipped)**
  - Mobile viewport hardening (make the existing mobile Playwright specs green; prevent page-level horizontal overflow on iPhone SE)
  - Standardized API error presentation (map backend `code`/`error_code` into deterministic user-safe messages; graceful AI/email “not configured” UX)
  - CI: enforce TypeScript type-check as a required PR gate + add a Drift Gate validator so the check can’t be removed silently
  - Docs: incident response runbook (triage + rollback + tenant isolation/RLS guidance)

- **Security / tenant isolation** (RLS correctness):
  - **P0 data isolation**: remove `is_staff` global bypasses in `apps/system/views/choice_viewsets.py` (tenant admins are promoted to `is_staff=True` via signals; must not yield cross-tenant reads/writes).
  - Make invitation email Celery task tenant/RLS safe (pass `tenant_id`; wrap task ORM in `tenant_rls` before querying invitation).
  - Workflow webhook receiver must set `request.tenant` + `set_current_tenant()` **before** ORM lookup (FORCE RLS correctness).
  - Legacy workflow webhook endpoint must fail closed unless tenant context is resolvable (migrate callers to tenant-path URL).
  - Integrations OAuth callback must set tenant + RLS session vars before writing tenant-scoped rows.
  - WorkForms create must not bypass activation validation when `status=active`. ✅ shipped (runtime validation guardrails in PR #4483; verified by `apps.system.tests.test_workform_runtime_support_validation`).
- **WorkForms runtime/observability**: editor validation/history/autosave, node action routing, local shadow-state staging, execution telemetry, persisted runtime hydration, and the first operator-facing analytics dashboard are now hardened. This batch adds a dry-run-first schema upgrade command that canonicalizes legacy node aliases, stamps workflow schema version metadata, refreshes `form_references` safely, and closes the fresh-database RLS audit gap on `core_comment` before any deeper model cleanup. Next: deterministic schema init / form "fields" model cleanup and any remaining a11y + theme-token hardening.
- **CI guardrails (never-miss-again)**:
  - Deploy-by-digest default for UAT/Prod and digest-align the migration artifact.
  - Manifest-driven required-secret enforcement per lane (remove hardcoded lists).
  - Docs drift prevention: "CURRENT" docs must not recommend forbidden Golden patterns (runner-driven migrations only).
- **Mobile parity**: ✅ shipped foundations (PRs #4658/#4659). Next: switch-tenant persistence, consistent error normalization, and auth expiry/401 behavior parity.
- **AI email/document hardening**: ✅ shipped through fail-closed parser lifecycle/status metadata (PRs #4733–#4739). Next: expose compact provenance + parse-status/retryability badges in the AI widget/document surfaces so operators can distinguish Outlook/manual sources and retryable parser failures without log-diving.

### Squad deep dive plan (as of 2026-04-27)

This is a prioritized, PR-sized execution plan synthesized from squad deep dives (frontend/backend/devops/testing + lead synthesis). It is intentionally biased toward **guardrails first**, then **tenant/RLS correctness**, then **editor stability + standards**, then **mobile parity**.

#### Guiding constraints
- **Shared-schema multi-tenancy + RLS**: fail closed when tenant context is ambiguous; set `set_current_tenant()` **before** tenant-scoped ORM.
- **Golden pipeline**: keep the Drift Gate as the entrypoint; enforce invariants via validators (don’t rely on tribal knowledge).
- **Frontend standards**: no hardcoded colors; use CSS tokens. Avoid runtime `console.*` noise; use `logger`.
- **Testing philosophy**: add unit/integration tests where they give high signal; keep E2E minimal and header/assertion-focused.

#### Proposed PR-sized batches (next)

1) **CI guardrails coverage fix (validators match current pipeline)**
   - Update `.github/scripts/validate-workflows.sh` checks that currently no-op due to `*-deployment.yml` targeting.
   - Add caller-side invariants for `main-pipeline.yml` reusable-workflow jobs (e.g., require `secrets: inherit`; forbid `environment:` on `uses:` jobs).
   - Acceptance: `bash .github/scripts/check_infrastructure.sh` no longer reports “skipping … no *-deployment.yml”; intentional violations fail with clear errors.

2) **CI supply chain hardening (digest pin enforcement)**
   - Validator enforces `jobs.*.services.*.image` and `jobs.*.container.image` are digest-pinned (`@sha256:`).
   - Acceptance: changing a service image from `postgres:15@sha256:...` → `postgres:15` fails the Drift Gate.

3) **CI immutable deploy tag enforcement**
   - Validator asserts remote deploy `docker pull/run` tags are derived from `github.sha` (prevents floating-but-not-latest tags).
   - Acceptance: any deploy step pulling an environment-only tag fails validation.

4) **Frontend theme-token compliance in high-churn surfaces**
   - Remove hardcoded `rgb()/rgba()` from:
     - `CommandPalette` (quick action colors, shadows/overlay)
     - `QuickActionsWidget`
     - `MyTasksWidget` + `MyTasks` page
     - `frontend/src/theme/themeConfig.ts` status tokens
   - Acceptance: `npm -C frontend run lint:colors` passes; no numeric `rgb/rgba` literals remain in those files.

5) **Frontend canonical logging + hooks hygiene**
   - Replace remaining runtime `console.*` in high-churn FlowEditor + contexts + service interceptors with `logger.*`.
   - Remove `react-hooks/exhaustive-deps` suppression in `frontend/src/pages/WorkForms/Execute.tsx` without changing runtime behavior.
   - Acceptance: lint clean for touched files; behavior unchanged for Execute.

6) **WorkForms Editor stability: finish remaining schema-init/model cleanup**
   - Keep the shipped graph-derived validation/history/autosave + local shadow-state staging intact.
   - Finish deterministic schema/registry initialization (remove timer races) and resolve the remaining form "fields" model mismatch.
   - Acceptance: no intermittent empty config panel on first click; saved workflow JSON contains only supported node payload shapes.

7) **Backend tenant ambiguity hardening (medium risk — stage carefully)**
   - Make `entity_lookup` fail-closed for multi-tenant users unless tenant context is explicit (header/domain/subdomain).
   - Add request metadata (tenant resolution source) to make behavior explainable.
   - Acceptance: multi-tenant + no explicit tenant ⇒ 400 with stable code; explicit tenant ⇒ 200.
   - Rollback: feature-flag strictness or revert check.

8) **Backend: remove per-view “default tenant fallback” on creates (incremental rollout)**
   - Stop “self-healing” missing tenant context inside `perform_create()` across selected tenant apps; return 400 instead.
   - Acceptance: creates without tenant context fail closed; creates with tenant context succeed and set correct tenant.

9) **Testing: high-signal additions (low flake)**
   - Frontend unit: `extractFormReferences` (legacy + canonical) coverage.
   - Frontend integration: WorkForms Editor init flows (existing vs clone vs template) by mocking the canvas.
   - Backend: cross-tenant execute spoofing returns 404 and doesn’t enqueue.
   - E2E (minimal): WorkForms Catalog requests include `X-Tenant-ID` matching localStorage.

10) **Mobile parity: WorkForms contract + detail view**
   - Align mobile types with OpenAPI artifact (`workflow_definition`, `/tenant-workforms/*`).
   - Add a real WorkForm detail view (read/execute/observe) with deterministic error handling.

#### Risk register (likelihood × impact)
- **Tenant ambiguity changes** (entity_lookup + create fallbacks): Medium × High → mitigate with feature flags, staged rollout, and explicit 400 errors.
- **Theme token cleanup**: Low × Medium → mitigate with targeted changes + `lint:colors` gate.
- **CI validator tightening**: Low × High → mitigate with clear error messages and local reproduction steps.

#### Testing + validation (definition of done)
- CI/guardrails: `bash .github/scripts/check_infrastructure.sh` and `bash scripts/verify_golden_state.sh`
- Frontend: `npm -C frontend run verify-standards` (and targeted `vitest run` files for new tests)
- Backend: targeted `python manage.py test ...` suites for each change set

## Phase 14: General Availability (GA) & Enterprise Hardening

### Goal
Translate the now-functional ERP into a launch-ready platform with historical-data migration, recoverability, governance, guided adoption, and offline-tolerant field operations.

### Deliverables + expected results
1. **Day 0 ETL pipeline**
   - Dry-run-first management commands and ETL services that transform historical flat-file data into the Golden Schema without triggering runtime side effects.
   - Import journals, reconciliation reports, and restart-safe batching so operators can migrate large datasets with evidence.
2. **Infrastructure + disaster recovery**
   - Codified desired state for Celery workers, Redis memory policy, backup retention, PITR verification, and restore drills.
   - Runbooks and workflow hooks that prove the platform can recover without tribal knowledge.
3. **SOC 2 governance**
   - Automated archival/retention behavior for aged business records plus explicit legal-hold/restore paths.
   - Logging and telemetry redaction so email addresses, phone numbers, and similar PII do not leak to logs/APM.
4. **In-app onboarding**
   - Guided tours and reusable empty-state CTAs so new tenants land in a product experience that teaches itself.
   - Persistent completion state using existing user-preference infrastructure instead of scattered local-only flags.
5. **Edge resilience**
   - App-shell caching, connectivity state, optimistic mutations, and replay-safe queues for delivery/status flows in weak-network environments.

### Epic breakdown

#### Epic 1: Day 0 ETL Pipeline
- **Business value:** unlocks customer onboarding by importing legacy history instead of forcing manual re-entry.
- **Technical scope:** mapping contracts for legacy CSV/XLSX/database exports; Golden Schema row transformers; dry-run reports; import journals; side-effect suppression; tenant-safe batching; reconciliation docs.

#### Epic 2: Infrastructure & Disaster Recovery
- **Business value:** raises confidence that the platform can survive deploy failures, database incidents, and queue backlogs at launch.
- **Technical scope:** PITR validation, restore-drill automation, Celery worker scaling envelopes, Redis eviction policy hardening, queue health visibility, and IaC scaffolding rooted in current `deploy/` + workflow reality.

#### Epic 3: SOC 2 Data Governance
- **Business value:** reduces compliance risk around financial retention and observability leakage.
- **Technical scope:** archive/restore commands, retention manifests, PII redaction filters for Django logging and Sentry payloads, and scheduled enforcement that respects tenant and audit boundaries.

### Phase 14.5: Zero-Defect UI/UX Eradication

#### Goal
Eliminate the recurring modal-crash, null-formatting, and breadcrumb-clarity defects that are eroding trust in the frontend before more guided onboarding or network-resilience work ships.

#### Deliverables + expected results
1. **Modal lifecycle lockdown**
   - Shared modal and drawer surfaces unmount heavy form/query content when closed and explicitly destroy hidden AntD state where needed.
   - Editing flows stop rehydrating stale forms across close/reopen cycles, removing the class of React Error #185 regressions tied to hidden modal state.
2. **Null-safe numeric formatting**
   - Shared formatters and detail views normalize `null`/`undefined` numeric values before `.toFixed()` or currency rendering.
   - Inquiry, invoice, and related record surfaces remain readable even when legacy data contains blank numeric fields.
3. **Breadcrumb UUID resolution**
   - Breadcrumbs resolve entity UUID segments into display names using one canonical route/service-layer lookup strategy.
   - Operators see readable navigation context instead of raw IDs when traversing nested supplier/customer/plant record paths.

#### Acceptance criteria
1. Plants, Inquiries, and shared modal primitives have one documented lifecycle contract: hidden forms do not stay mounted with live hydration loops.
2. Shared numeric/currency formatting paths fail closed to stable values instead of throwing on null-backed fields.
3. Breadcrumbs show human-readable entity labels wherever the route has enough information to resolve them.
4. The new UI/UX block is ordered ahead of remaining GA-04/GA-05 and later B2B feature work.

#### Dependencies
1. `GA-03.3 pii-redaction-for-logging-and-sentry` remains the current in-flight governance ticket and must land before Phase 14.5 becomes the next executable block on `development`.
2. Existing frontend loader/service-layer boundaries (`EntityFormSurface`, route loaders, approved API services) remain the ownership seams; this phase should not invent a parallel data-fetch stack.

#### Risk register + mitigations
1. **Modal refactors reopen render-loop churn elsewhere** (Medium x High)
   - Mitigation: keep Smart Loader ownership at route/container boundaries, gate heavy form mounting on ready/open state, and extend regression coverage around known edit flows.
2. **Formatter centralization misses scattered callsites** (Medium x Medium)
   - Mitigation: audit shared formatter utilities first, then patch remaining leaf views only where no shared path exists.
3. **Breadcrumb resolution adds chatty per-segment fetching** (Medium x Medium)
   - Mitigation: prefer existing route match data or a shared entity-name dictionary/context over bespoke breadcrumb fetches.

#### Testing strategy
1. `npm -C frontend run verify-standards`
2. Targeted Vitest coverage for modal lifecycle and formatter helpers
3. Playwright or route/component regression coverage for the breadcrumb-resolution path when route-loader behavior changes materially

#### Rollback / safe-change approach
1. Ship modal, formatter, and breadcrumb work as separate PR-sized tickets under one epic.
2. If a shared modal contract proves too broad, revert the specific surface and keep the rest of the epic additive.
3. Prefer compatibility fallbacks in breadcrumb rendering over blocking navigation while name resolution matures.

#### Epic 4: In-App User Onboarding
- **Business value:** shortens time-to-value for newly provisioned tenants and reduces support load.
- **Technical scope:** standard tour provider, first-run preference persistence, dashboard/order/record empty states with direct CTAs, and onboarding telemetry to measure completion.

#### Epic 5: Edge Resilience
- **Business value:** keeps warehouse/logistics workflows usable during transient connectivity loss.
- **Technical scope:** Vite PWA/service worker setup, connectivity awareness, offline-safe mutation queuing, optimistic UI for high-frequency field actions, and replay/rollback handling.

### Acceptance criteria
1. Phase 14 is represented consistently across `MASTER_PLAN.md`, `.github/MASTER_PLAN.md`, and `.github/EPIC_TICKETS.md`.
2. `.github/EPIC_TICKETS.md` begins with a single `Ready` GA ticket and every later unchecked ticket is explicitly blocked by dependencies.
3. Each Phase 14 ticket names concrete files, validation commands, and rollback guidance so autonomous continuation can execute without guesswork.
4. No Phase 14 planning text contradicts the Golden Pipeline, manifest authority, or the append-only role of `.github/MASTER_PLAN.md`.

### Dependencies
1. ETL import contracts (`GA-01`) should land before archival/governance automation (`GA-03`) so migrated data is shaped correctly before retention rules run.
2. Disaster-recovery and infra verification (`GA-02`) should land before GA cutover and before edge/offline work depends on stable worker/Redis behavior.
3. Guided onboarding (`GA-04`) should reuse existing `UserPreferences`, `CockpitTour`, and app-shell navigation rather than inventing a second preference system.
4. Edge resilience (`GA-05`) depends on canonical mutation/service surfaces from the shipped operational workflows and must not bypass the existing service layer.

### Risk register + mitigations
1. **Historical import corrupts tenant boundaries** (High x High)
   - Mitigation: require tenant-explicit import manifests, `tenant_rls(...)` in worker/management-command contexts, dry-run-first output, and import journals before write mode.
2. **Disaster-recovery docs drift from live workflows** (Medium x High)
   - Mitigation: root DR work in `.github/workflows/reusable-deploy.yml`, existing backup hooks, and manifest-defined env vars.
3. **PII leaks into logs/APM while observability expands** (High x High)
   - Mitigation: centralize redaction filters in Django logging + Sentry hooks and cover them with tests before enabling broader telemetry.
4. **Onboarding/offline work reintroduces frontend instability** (Medium x Medium)
   - Mitigation: reuse existing Joyride and optimistic React Query patterns, keep loaders page-level, and gate offline queues to a narrow set of business-critical mutations first.

### Testing strategy
1. **Docs/planning validation:** `bash scripts/verify_golden_state.sh` and `bash .github/scripts/check_infrastructure.sh`
2. **Backend execution tickets:** focused `python manage.py test ...` suites plus `python manage.py makemigrations --check` whenever schema/preferences/retention models change.
3. **Frontend execution tickets:** `npm -C frontend run verify-standards`, targeted Vitest coverage, and Playwright only where onboarding/offline behavior materially changes.
4. **Infra/config tickets:** `python config/manage_env.py audit` whenever new secrets, observability variables, or DR workflow inputs are introduced.

### Rollback / safe-change approach
1. Keep Phase 14 rollout additive and epic-scoped; each ticket must be reversible without unwinding unrelated ERP work.
2. Prefer dry-run/reporting modes first for ETL, archival, backup, and restore flows before enabling mutating behavior.
3. Gate user-visible onboarding and offline behavior behind reusable providers/feature flags if rollout risk increases.

## Phase 15: The B2B Network & Financial Settlement

### Goal
Extend ProjectMeats from an internal ERP into a partner-facing B2B network with secure extranet access, deterministic trade math, and automated settlement/reconciliation planning.

### Architecture status
- **Execution status:** `B2B-02.1 trade-invariants-contract-and-surface-audit`, `B2B-02.2 backend-trade-engine-service-and-tests`, `B2B-02.3 transactional-api-adoption-for-orders-invoices-fulfillments`, `B2B-02.4 frontend-display-and-input-normalization`, `B2B-01.1 guest-portal-access-contract-and-doc-source-inventory`, `B2B-01.2 portal-grant-and-document-registry-schema`, `B2B-01.3 public-portal-read-apis-and-audit-trail`, `B2B-01.4 frontend-public-portal-shell-and-magic-link-consume`, `B2B-01.5 operator-issue-resend-revoke-controls`, `B2B-03.1 settlement-ingest-contract-and-webhook-first-adapter-plan`, and `B2B-03.2 settlement-event-store-and-public-ingest-endpoint` are shipped, and execution now continues at `B2B-03.3 reconciliation-engine-into-paymenttransaction` in PR #4911.
- **Backlog placement:** `B2B-03.3` remains the active first unchecked ticket until PR #4911 merges.
- **Execution order:** trade invariants first, then guest portals, then settlement reconciliation.
- **Canonical contract source:** `docs/runbooks/GLOBAL_TRADE_ENGINE.md` plus the non-adopted helper seam in `backend/apps/core/conversions.py`.

### Deliverables + expected results
1. **B2B Extranet (guest portals)**
   - Passwordless, signed, read-only portal access for counterparties to view approved invoice/order state, curated documents, and tracking without consuming paid seats.
   - Strict guest-safe serializers and portal-only frontend routes so internal pricing/margin data never leaks.
2. **Global Trade Engine (determinism)**
   - One canonical weight-conversion contract and one canonical timezone contract across backend, frontend, PDFs, exports, and alerts.
   - Trade/financial calculations remain stable even when counterparties operate in different units or timezones.
3. **Financial Settlement & Reconciliation**
   - Settlement ingest and reconciliation architecture layered on top of the existing invoice/payment foundation, with idempotent event handling and accountant-facing exception review.
   - Invoice/payment state can progress from sent to paid through auditable automated flows instead of manual spreadsheet matching.

### Epic breakdown

#### Epic 1: The B2B Extranet (Guest Portals)
- **Business value:** turns PDF/email handoffs into a secure partner collaboration layer.
- **Technical scope:** signed magic-link grants, tenant-scoped public read APIs, curated document exposure from the document vault, guest-safe read-only serializers, and portal-specific React pages/routes.
- **Guardrail:** do not reuse internal authenticated surfaces or legacy guest-login flows as the B2B portal.

#### Epic 2: The Global Trade Engine (Determinism)
- **Business value:** prevents unit-conversion and timezone drift from breaking margin, alerting, tracking, and customer-facing documents.
- **Technical scope:** centralized conversion service, canonical base-unit storage/display rules, UTC storage plus plant-local rendering rules, and adoption across transactional APIs/PDFs/frontend formatters.
- **Guardrail:** math must use deterministic decimal conversion contracts, not scattered frontend floats or ad hoc timezone rendering.

#### Epic 3: Financial Settlement & Reconciliation
- **Business value:** closes the loop from invoice issued to invoice paid with explainable, auditable matching.
- **Technical scope:** webhook-first settlement ingestion, provider/event journal, idempotent reconciliation engine into the existing `PaymentTransaction` ledger, review queue UI, and optional future bank-feed adapter.
- **Guardrail:** no execute-mode settlement automation without replay-safe identifiers, tenant scoping, and reversal/audit paths.

### Acceptance criteria
1. Phase 15 is represented consistently across `MASTER_PLAN.md`, `.github/MASTER_PLAN.md`, and `.github/EPIC_TICKETS.md`.
2. Phase 15 is clearly marked as execution-open for the next reconciliation-engine lane now that the `B2B-02` rollout, the initial guest-portal execution block through operator controls, and the `B2B-03.1`/`B2B-03.2` settlement foundation lanes are complete; no wording implies the full partner network or settlement automation is already shipped.
3. The backlog has exactly one active first unchecked ticket (`B2B-03.3`, currently in PR #4911), and every downstream Phase 15 ticket remains explicitly blocked behind it.
4. Each Phase 15 ticket identifies concrete repo paths, validation commands, dependencies, and rollback guidance.

### Dependencies
1. **Earlier lanes above Phase 15 are satisfied:** the previously higher-priority Phase 12/14 work that sat above this lane is shipped, so B2B execution can now start at the trade-invariants contract.
2. **Hard blockers from earlier backlog:** fail-closed tenant/RLS runtime, contract-first API coverage, and governance/redaction work must land before external guest access or settlement ingestion become safe.
3. **Execution order within Phase 15:** trade invariants (`B2B-02`) precede portal and settlement execution so displayed weights/dates and reconciliation math share one canonical contract.
4. **Reuse expectations:** partner access should build on existing invitation/auth/notification/document foundations where safe, but must not expose internal-only components or data models directly.

### Risk register + mitigations
1. **Cross-tenant or guest-data leakage** (High x High)
   - Mitigation: tenant-path + signed grant only, guest-safe allowlist serializers, ignore anonymous `X-Tenant-ID`, and audit every portal access.
2. **Unit/timezone drift corrupts customer-visible math** (High x High)
   - Mitigation: land one canonical conversion/time contract first, require deterministic decimal math, and test DST/date-only boundaries explicitly.
3. **Duplicate settlement events create duplicate payments** (High x High)
   - Mitigation: provider event journals, idempotent external keys, transactional reconciliation, and reversal-safe source linkage.
4. **Execution-lane promotion overstates readiness** (Medium x Medium)
   - Mitigation: keep only the current Phase 15 ticket ready, and leave downstream Phase 15/16/19 work blocked until the active prerequisite lane lands.

### Testing strategy
1. **Docs/planning validation:** `bash scripts/verify_golden_state.sh` and `bash .github/scripts/check_infrastructure.sh`
2. **Portal execution tickets:** targeted backend tenant/public-endpoint tests, frontend service-layer tests, and Playwright guest-link smoke coverage when routes ship.
3. **Trade engine execution tickets:** deterministic backend decimal/timezone tests plus frontend formatter/conversion coverage.
4. **Settlement execution tickets:** backend idempotency/reconciliation tests, `python manage.py makemigrations --check`, and infrastructure checks whenever provider secrets/workflows change.

### Rollback / safe-change approach
1. Keep each Phase 15 epic additive and independently reversible.
2. Revoke/disable guest portal grants before reverting portal routes or serializers.
3. Revert display/derived conversion behavior before touching any stored source values.
4. Disable settlement execute-mode first, preserving raw event journals and audit evidence for rollback.

## ARCHITECTURE SEALED

**Execution boundary:** the target Phase 15 B2B Network architecture remains frozen at the design level. The `B2B-02` trade engine lane, the `B2B-01.1` access contract, the additive `B2B-01.2` portal grant/document-registry schema lane, `B2B-01.3` public portal read APIs + audit trail, `B2B-01.4` frontend portal shell + magic-link consume, `B2B-01.5` operator issue/resend/revoke controls, `B2B-03.1` settlement ingest/reconciliation contract lane, and `B2B-03.2` settlement raw-event ingress lane are now shipped, and execution currently continues with `B2B-03.3` settlement reconciliation into `PaymentTransaction` in PR #4911. This does **not** mean the partner network or settlement automation is implemented, shipped, or execution-complete. Downstream Phase 15 work and all Phase 16 tickets remain blocked behind the active Phase 15 rollout.

## Phase 16: The Core Trading Engine (End-to-End Automation)

### Goal
Hardcode the exact happy-path B2B trading pipeline around Inquiry intake, routing, sourcing, approval, sales, and logistics so the core trading engine works deterministically before any future visual editor is mapped onto it.

### Architecture status
- **Execution status:** planned only, not started.
- **Backlog placement:** appended to the bottom of `.github/EPIC_TICKETS.md` after existing higher-priority phases so the current GA lane keeps priority.
- **Execution order once unblocked:** inquiry intake/routing first, then supplier RFQ brokerage, then approval/PDF/email side effects, then sales/logistics cascade, then distributed hardening/lineage.
- **Current repo reality:** `Inquiry`, `PurchaseOrder`, `SalesOrder`, and `CarrierPurchaseOrder` already exist; AI email ingestion and outbound/PDF seams exist in partial form; there is no true inventory source-of-truth model yet.

### Deliverables + expected results
1. **Ingestion & decision node**
   - AI email extraction creates or updates a tenant-safe `Inquiry` and classifies the route as `FULFILL` or `BROKER`.
   - Operators get an immediate action-required alert when a new inquiry enters the pipeline.
2. **Brokerage / RFQ engine**
   - `BROKER` inquiries fan out into supplier RFQs matched by master product/protein, and supplier replies are parsed into normalized quote payloads.
   - Positive quote replies produce draft supplier purchase orders instead of manual re-keying.
3. **Human-in-the-loop approvals**
   - Purchase orders, sales orders, and carrier purchase orders share one explicit approval lifecycle (`draft` -> `pending_review` -> `approved`) even if their storage/status fields differ internally.
   - Approval transitions trigger PDF generation and outbound email exactly once, with audit-safe linkage to the approved document.
4. **Sales & logistics cascade**
   - `FULFILL` inquiries skip supplier brokerage and go straight to draft sales order creation.
   - Approved supplier sourcing or direct fulfillment cascades into sales-order approval, customer send, carrier RFQ, and draft carrier PO generation.

### Epic breakdown

#### Epic 1: The Ingestion & Decision Node
- **Business value:** turns inbound customer demand into a deterministic trade path immediately instead of leaving operators to triage email manually.
- **Technical scope:** connect AI email ingestion to `Inquiry`, define inventory availability/routing as a first-class service, and surface live operator alerts.
- **Guardrail:** do not pretend an inventory source-of-truth exists; define the availability contract explicitly before automating `FULFILL`.

#### Epic 2: The Brokerage / RFQ Engine (Branch A)
- **Business value:** automates the supplier-quote loop for brokered trades while keeping AI output in draft/human-review states.
- **Technical scope:** supplier matching by master product/protein, outbound RFQ email service, structured supplier-reply parsing, and draft `PurchaseOrder` creation.
- **Guardrail:** use AI structured outputs and draft-only order creation; no auto-approved supplier commitments.

#### Epic 3: The Human-in-the-Loop Approval Flow
- **Business value:** keeps traders in control of commitments while removing document-generation and send busywork.
- **Technical scope:** generic approval state machine, review/approve UI, and state-transition side effects for PDF generation and outbound email.
- **Guardrail:** approval side effects must be transition-driven and idempotent; repeated clicks must not send duplicate documents.

#### Epic 4: The Sales & Logistics Cascade
- **Business value:** closes the happy path from inquiry to supplier/customer/carrier documents without manual orchestration.
- **Technical scope:** draft `SalesOrder` generation, customer approval/send, carrier RFQ fan-out, carrier-reply parsing, and draft `CarrierPurchaseOrder` creation.
- **Guardrail:** route-dependent branching must be explicit (`FULFILL` skips supplier branch; `BROKER` requires approved supplier sourcing first).

### 16b: Distributed Hardening & Trade Lineage

#### Epic 5: Trade Lineage & Traceability
- **Business value:** every downstream commercial document can be traced back to the exact inbound demand and source-email origin, which is essential for trader trust, exception handling, and later analytics.
- **Technical scope:** introduce a durable `trade_id` / `TradeSession` concept generated at inquiry creation, cascade it through `PurchaseOrder`, `SalesOrder`, and `CarrierPurchaseOrder`, and expose a lineage visualization on detail screens.
- **Guardrail:** lineage must be additive and audit-safe; do not overload ad hoc `custom_data` blobs as the only source of truth.

#### Epic 6: Event-Driven State Transitions (Saga Pattern)
- **Business value:** removes brittle synchronous chaining so approvals and document-generation side effects can complete reliably without HTTP timeouts.
- **Technical scope:** transition-driven event publishing (e.g. `supplier_po_approved`), Celery consumers for downstream state changes, and replay-safe saga orchestration across supplier/customer/carrier branches.
- **Guardrail:** no approval click should synchronously block on PDF generation, outbound email, and downstream entity creation in one request/response cycle.

#### Epic 7: Concurrency Locks & Idempotency
- **Business value:** prevents double-clicks, webhook retries, or concurrent workers from creating duplicate sales orders, carrier POs, or sends.
- **Technical scope:** transactional state-transition services using `select_for_update()`, explicit `idempotency_key` enforcement on AI/webhook creation paths, and uniqueness/replay guarantees for downstream artifacts.
- **Guardrail:** locking and idempotency must be applied at the domain-transition boundary, not only in UI affordances.

#### Epic 8: The Exception Control Tower (Dead Letter Queue)
- **Business value:** failed automation becomes operator-visible instead of silently stalling trades in the background.
- **Technical scope:** `ExceptionQueue`/dead-letter model, halt semantics on failed trade steps, and a “Trades Requiring Intervention” dashboard with reason codes and recovery context.
- **Guardrail:** automation failures must fail loud with preserved lineage and recovery hints; no silent drop paths.

### Acceptance criteria
1. Phase 16 is represented consistently across `MASTER_PLAN.md`, `.github/MASTER_PLAN.md`, and `.github/EPIC_TICKETS.md`.
2. Phase 16 is clearly marked as **planned only**; no wording implies the core trading engine is already shipped.
3. The backlog continues to have exactly one first unchecked `Ready` ticket above Phase 16, and every Phase 16 ticket is explicitly blocked.
4. Phase 16 tickets explicitly tie AI structured outputs, outbound email, and PDF generation to `PurchaseOrder`, `SalesOrder`, and `CarrierPurchaseOrder` state transitions.
5. Phase 16 hardening tickets explicitly name Celery-driven saga transitions, `select_for_update()` locking, `idempotency_key` enforcement, and trade-lineage propagation.

### Dependencies
1. **Phase 14 remains first:** the active GA lane still owns execution priority.
2. **Phase 15 trade invariants precede execution:** the deterministic trade/time contract from `B2B-02` should exist before the hardcoded trading engine starts mutating live order flows.
3. **Existing model reuse is mandatory:** `Inquiry`, `PurchaseOrder`, `SalesOrder`, `CarrierPurchaseOrder`, `EmailLog`, and current AI/document/email seams should be extended, not replaced with parallel abstractions.
4. **Inventory availability must be formalized:** because the repo lacks a dedicated inventory model, execution must first define the authoritative availability source and reservation semantics.
5. **Distributed hardening follows happy-path definition:** lineage, eventing, idempotency, and exception-queue work must layer on the hardcoded state machine rather than introducing a second orchestration model.

### Risk register + mitigations
1. **No real inventory source-of-truth exists yet** (High x High)
   - Mitigation: make availability contract design the first execution ticket; do not let routing logic infer inventory from ad hoc product hints.
2. **AI misreads supplier/customer/carrier emails and creates wrong drafts** (High x High)
   - Mitigation: use structured outputs, require draft-only creation, persist source-email lineage, and keep human approval before any external commitment.
3. **Approval side effects send duplicate PDFs/emails** (High x High)
   - Mitigation: tie side effects to idempotent state transitions and audit-safe send/document records instead of button-click handlers alone.
4. **Planning language overstates readiness** (Medium x Medium)
   - Mitigation: keep Phase 16 blocked beneath the active backlog and mark it planned-only everywhere.
5. **Distributed race conditions create duplicate downstream documents** (High x High)
   - Mitigation: use event-driven Celery consumers, transactional `select_for_update()` locks, and explicit `idempotency_key` enforcement at creation boundaries.
6. **Failed async steps stall trades invisibly** (High x High)
   - Mitigation: add an exception/dead-letter queue with trade-lineage references and operator-facing intervention surfaces.

### Testing strategy
1. **Docs/planning validation:** `bash scripts/verify_golden_state.sh` and `bash .github/scripts/check_infrastructure.sh`
2. **Execution tickets for ingestion/routing:** targeted backend tests around `tenant_apps.inquiries`, `apps.integrations`, and `tenant_apps.ai_assistant`
3. **Execution tickets for orders/logistics:** targeted tests for `tenant_apps.purchase_orders`, `tenant_apps.sales_orders`, `tenant_apps.carriers`, and associated API/UI surfaces
4. **Execution tickets touching PDFs/email/notifications:** existing backend/frontend suites plus `python manage.py makemigrations --check` for additive schema work
5. **Distributed hardening tickets:** targeted saga/event tests, concurrency/idempotency tests, and UI queue/lineage regressions proving failed async steps are surfaced.

### Rollback / safe-change approach
1. Keep each Phase 16 epic additive and independently reversible.
2. Keep AI-created commercial documents in draft/pending-review states until explicit operator approval.
3. Disable outbound email/PDF side effects before reverting order-state logic if an execution batch regresses.
4. Preserve source-email lineage and approval audit history so failed automation batches can be replayed or cleaned up safely.

## ARCHITECTURE SEALED

**Planning conclusion only:** the target Phase 16 Core Trading Engine architecture is now frozen for planning and backlog decomposition. This seals the intended happy-path seams from inquiry intake through supplier/customer/carrier document generation. It does **not** mean Phase 16 is implemented, shipped, or execution-complete. Current execution priority remains Phase 14 and its named prerequisites.

## Phase 19: Ambient AI & Contextual Next-Best-Actions

### Goal
Evolve the AI from a reactive chat surface into an ambient assistant that can silently evaluate page/entity context, surface high-confidence next-best actions in the record UI, warn on anomalous business inputs before save, and draft operational emails without forcing users into a chat prompt first.

### Architecture status
- **Execution status:** planned only, not started.
- **Backlog placement:** appended to the bottom of `.github/EPIC_TICKETS.md` so the active Phase 14 / Phase 12 lanes and already-planned future phases retain priority.
- **Execution order once unblocked:** contextual suggestion contract/engine first, then inline suggestion surfaces, then anomaly detection in form flows, then contextual email drafting.
- **Current repo reality:** `UniversalEntityRecordPage`, `EntityProfileHeader`, `UniversalEntityForm`, Outlook/email ingestion, and AI assistant service layers already exist, but there is no canonical route-context suggestion endpoint, no ambient banner component, and no anomaly-baseline service tied to form validation.

### Deliverables + expected results
1. **Next-Best-Action engine**
   - Add a fast contextual suggestions API (`POST /api/v1/ai-assistant/suggestions/contextual/`) that accepts `entity_type`, `entity_id`, and `current_state`, then returns structured suggestion objects with action identifiers, UX labels, confidence, rationale, and execution metadata.
   - Combine deterministic heuristics with a bounded LLM assist (`gpt-4o-mini`) so obvious cases stay cheap/fast while still allowing context-rich recommendations.
2. **Ambient inline suggestion UI**
   - Introduce an `AmbientSuggestions` frontend surface that mounts below record headers and quietly fetches contextual suggestions when entity pages load.
   - Suggestions render as subtle, one-click action cards instead of being trapped inside the chat widget.
3. **Predictive anomaly detection**
   - Add a data-aware warning layer to `UniversalEntityForm` so outlier prices/weights/quantities can trigger a soft confirmation before save when they diverge materially from tenant history.
   - Warnings stay advisory and explain the historical baseline used for comparison.
4. **Contextual email drafting**
   - Add ambient drafting actions on Supplier/Customer detail pages that synthesize recent order cadence, outstanding balances, and delay history into an Outlook-ready draft.
   - Draft generation reuses existing integration/auth surfaces rather than introducing a second email stack.

### Epic breakdown

#### Epic AMB-01: The Next-Best-Action (NBA) Engine
- **Business value:** turns latent entity state into proactive, explainable AI suggestions before the user opens chat or asks for help.
- **Technical scope:** define the contextual suggestion contract, add a bounded heuristic + LLM orchestration service, expose the new API endpoint, and capture telemetry/cache semantics for repeated page views.
- **Guardrail:** default to deterministic heuristics first; LLM enrichment must be bounded, tenant-safe, and optional when AI infra is unavailable.

#### Epic AMB-02: Inline Page Suggestion Cards (Ghost UI)
- **Business value:** brings AI recommendations into the operator’s existing workflow instead of requiring chat discovery.
- **Technical scope:** build `AmbientSuggestions`, inject it into `UniversalEntityRecordPage` and `EntityProfileHeader`, and wire action execution through approved service-layer APIs.
- **Guardrail:** suggestion fetches must be referentially stable, page-local, and dismissible; no heavy modal-first UX for simple next actions.

#### Epic AMB-03: Predictive Anomaly Detection
- **Business value:** reduces costly pricing/data-entry mistakes before records are committed.
- **Technical scope:** baseline service for 90-day historical averages and dispersion thresholds, form-safe anomaly checks, and a soft-warning UX that lets informed users proceed explicitly.
- **Guardrail:** anomaly warnings must never silently rewrite submitted values or block save without an operator-visible override path.

#### Epic AMB-04: Contextual Email Drafting
- **Business value:** removes repetitive outreach work by prebuilding relevant check-in/dispute emails at the point of need.
- **Technical scope:** aggregate recent transactional signals, generate personalized drafts, and hand them into the Outlook integration/send flow from supplier/customer pages.
- **Guardrail:** drafts stay reviewable by the user; no autonomous send behavior in this phase.

### Acceptance criteria
1. Phase 19 is represented consistently in `MASTER_PLAN.md`, `.github/MASTER_PLAN.md`, `.github/EPIC_TICKETS.md`, and the session plan without implying execution has started.
2. The backlog contains atomic `AMB-*` tickets with concrete paths, dependencies, validation commands, risks, and rollback notes.
3. Ambient AI remains explicitly queued behind the active execution lane; the first unchecked `Ready` ticket above it does not change.
4. The plan names the canonical backend/frontend seams for contextual suggestions, anomaly checks, and contextual email drafting so a future implementation pass can start without rediscovery.

### Dependencies
1. **Execution priority stays unchanged:** Phase 14, Phase 12 hardening, and already-sealed Phase 15/16 lanes remain ahead in `.github/EPIC_TICKETS.md`.
2. **AI review queue groundwork exists:** the newly shipped AI inbox/review surfaces provide an operational precedent for proactive AI review UX but do not unblock or reorder Ambient AI.
3. **Outlook/email integration must stay canonical:** contextual email drafting must reuse the existing integrations/service-layer seams and tenant-scoped auth models.
4. **Universal forms/record pages remain the integration point:** anomaly detection and ghost UI depend on the current `UniversalEntityForm`, `UniversalEntityRecordPage`, and `EntityProfileHeader` surfaces staying canonical.

### Risk register + mitigations
1. **Suggestion spam or low-value recommendations** (Medium x High)
   - Mitigation: require explicit confidence/rationale fields, start with high-signal heuristics, and support page-level dismissal/telemetry before expanding breadth.
2. **Latency/cost regressions from per-page LLM calls** (High x Medium)
   - Mitigation: heuristics first, short-lived tenant-safe caching, bounded `gpt-4o-mini` use, and graceful no-suggestion fallback when infra is unavailable.
3. **False-positive anomaly warnings slow operators down** (Medium x Medium)
   - Mitigation: use configurable thresholds, show baseline context, and keep warnings soft/overrideable instead of hard-blocking save.
4. **Contextual drafts expose sensitive/internal wording** (Medium x High)
   - Mitigation: draft-only output, reuse tenant-safe data aggregations, and keep the final send step explicitly user-controlled.

### Testing strategy
1. **Planning/docs validation:** `bash scripts/verify_golden_state.sh` and `bash .github/scripts/check_infrastructure.sh`
2. **NBA engine execution tickets:** targeted backend tests for the contextual suggestion service/API plus graceful-degradation coverage when AI services are unavailable.
3. **Ghost UI execution tickets:** `npm -C frontend run verify-standards`, targeted React tests for stable query wiring/rendering, and route-level regression coverage on record pages.
4. **Anomaly detection + email drafting execution tickets:** backend aggregation tests, frontend form warning tests, and integration tests around Outlook draft creation/auth handoff.

### Rollback / safe-change approach
1. Keep ambient AI execution additive and feature-flagged at the route/component level.
2. Disable contextual suggestions or drafting actions independently if quality/cost regressions appear.
3. Revert anomaly warning hooks before touching existing form validation/save contracts.
4. Preserve telemetry and operator dismissal data if UI surfaces are rolled back so suggestion quality can still be analyzed.

### Historical context (kept for traceability)

## Historical: Recovery Execution Plan (as of 2026-03-27T17:03Z)

We are re-validating and completing the last ~25 prompts with **evidence-based acceptance criteria** and strict shipping discipline.

## State Audit & Remaining P0s (as of 2026-03-27T18:47Z)

### Observed runtime issues
- ✅ Workforms AI Suggestions route drift — **RESOLVED** (PR #3998): frontend calls `POST /api/v1/workflows/suggest-nodes/` and backend also exposes legacy alias `POST /api/v1/suggest-nodes/`.
- AI Chat: lessons memory NameError fixed (PR #4045); remaining 400s should be treated as environment config issues (missing OPENAI_API_KEY) with graceful messaging.
- ✅ Charts: Recharts `ResponsiveContainer` warnings (width/height -1) — **RESOLVED** (PR #4240): set non-zero `minWidth/minHeight` on chart containers to avoid zero-size renders.
- ✅ WorkForms E2E runtime gaps (Workstream B) — **RESOLVED** (PRs #4480–#4487):
  - Notifications persist end-to-end (`actionNotify` → `UserNotification`) + tests (PR #4481)
  - Node runtime support validation + activation guardrails (PR #4483)
  - Playwright execution smoke proving execute + notification (PR #4484)
  - Quick Actions + Catalog reliably list/execute WorkForms (PR #4485)
  - Entity pages show execution history; backend entity_id filter supports JSON string/int (PR #4486)
  - Gmail connector MVP + OAuth hardening + frontend wiring + setup docs (PR #4487)

### Priority execution strategy
1) Quick wins: ✅ suggest-nodes route drift (PR #3998); ✅ chart sizing warnings (PR #4240).
2) Universal Forms + Cockpit Search: make forms truly usable (save/create CTA, key-fields-first + expand-all, single edit toggle, searchable FK by name, per-keystroke refresh where required).
3) Workform Editor UX: connectors top/bottom, remove conflicting collapse buttons, drag body, inline title edit, reorder arrows swap edges, show key config summary in-node.

**Shipping discipline (MANDATORY):** every batch is shipped via **new branch → PR → merge to `development`**.

### Execution order (P0→P1)
1. **Docs plan** (this section + PR log entry) — merge first.
2. ✅ **Cockpit Favorites (industry-grade)** — shipped (backend favorites API + optimistic UX, tenant-safe, RLS-backed). PR: **#4037**.
3. ✅ **Email Ingestion Monitor “Sync Now”:** stable structured error codes + reconnect CTA (no raw decrypt/token exception strings). Verified via backend tests. PR: **#3951**.
4. ✅ **AI Document Upload:** upload endpoint fails closed (201/400 only) with actionable error payloads; regression coverage added. PR: **#4460**.
5. **Verify prior batches:** Universal Forms, Cockpit Search relevance/entity coverage, Workform Editor UX.

### Acceptance criteria (high signal)
- Favorites persist across reload and do not collide across tenants.
- Sync Now never emits raw decrypt error strings; always shows reconnect guidance.
- PDF upload returns 201/400 only (no 500) with actionable error payloads.

---

## Reality Snapshot (as of 2026-03-26)

### What is actively in progress
- **Type-check status:** currently clean (`npm -C frontend run type-check`); keep as a hard gate and only relax with evidence.

### Recently shipped fixes (evidence)
- Cockpit Favorites: backend persistence + optimistic UX + RLS policy — PR #4037
- Reports Summary 500 fixed — PR #3949
- Tenant Lists create 500 fixed/hardened — PR #3950
- Email Ingestion “Sync Now” correctness + pagination + error surfacing — PR #3951
- Docs: canonicalize Master Plan + gap audit + demote non-canonical roadmaps — PR #3952, #3953, #3962
- Forms consolidation: unify inquiry create + add EntityFormSurface + harden UniversalEntityForm + expose key_fields + migrate SalesOrders/Claims — PR #3956, #3957, #3958, #3959, #3969
- Cockpit create UX: +New entity modal fix + +New call purpose/inquiry modal + confirm+navigate after create — PR #3960, #3961, #3966
- FlowEditor: auto-map Apply shows Apply Changes + Form Process node not transparent — PR #3963, #3964
- Backend: prevent RLS-related 500s — PR #3965
- Email sync: find new order emails reliably — PR #3967
- Admin Billing: payment method portal + plan select — PR #3968
- Admin Invitations: avoid 500 when email fails — PR #3970
- Reports: use tenant-aware service + show warnings — PR #3972
- WorkForms Catalog: Quick Run uses /workflows/form-submissions + Templates tab renders FLOW_TEMPLATES — PR #3978
- Quick Actions: use shared JWT-aware apiClient (fixes flaky quick create/quick actions auth) — PR #3980
- Frontend standards: remove remaining hardcoded hex colors; `npm -C frontend run verify-standards` passes — PR #3982
- Forms consolidation: route remaining create entrypoints through EntityFormSurface (schedule call → inquiry, SmartSearch → sales order) — PR #3984
- Plants: fix available-products endpoint routing so GET /plants/{id}/available-products works (was 405) — PR #3986
- UniversalEntityForm: fix invoice schema 404 + required FK validation + better 400 error surfacing — PR #3989
- Inquiries: prevent 500 on /api/v1/inquiries/ when tenant context missing — PR #3990
- WorkForms/Quick Actions runtime restored + hardening (executions, visibility, back-compat): PRs #4452–#4456 (tested: backend + frontend)
- WorkForms: per-step node status rendering (entity record + execution details): PR #4457 (tested: frontend)
- CI: master deploy pipeline workflow display name clarified for Actions feed: PR #4458 (tested: workflow validator)
- AI Assistant: document upload “no 500s” regression coverage (uploads return 201/400 only): PR #4460 (tested: backend)
- Dependencies: merged grouped npm/yarn bumps (root + mobile): PR #4439 (tested: CI)
- Promotion: merged development → uat: PR #4389 (tested: CI + deploy)

### Current blockers / external dependencies
- Some features require environment secrets/infra to activate fully (e.g., OpenAI key, OAuth credentials). Code must degrade gracefully when secrets are missing.

---

## Source-of-Truth Rules

1. **This file** defines:
   - what is “done” vs “in progress” vs “pending”
   - what counts as evidence
   - what we execute next
2. “Done” requires evidence:
   - merged PR/commit + verification note (tests/manual/CI)
3. Plans and historical notes below may be retained for context, but **the snapshot + status tables above override old statements**.

---

## Backlog (High-signal, execution-ordered)

### P0 — Stability / correctness
- **Type safety gate:** `npm run type-check` clean; reduce `any` / runtime prop-shape errors.
- **Graceful degradation / feature flags:** missing secrets/infra (AI, email, Outlook, pgvector) must not crash UX; expose availability in health.
- **Workforms Editor:** maintain hook safety, node config save UX, and layout predictability.

### P0 — Security / tenant isolation (next)
- **TenantMiddleware hardening:** ignore `X-Tenant-ID` for anonymous requests (prevent tenant context injection on `AllowAny` endpoints); add regression tests.
- **Workflow webhooks tenant-safe:** add a new canonical webhook URL embedding `tenant_id` in the path and set RLS tenant explicitly in the receiver view; keep legacy URL temporarily.
- **Email webhooks verification (critical):** Outlook requires unpredictable per-subscription `clientState`; Gmail requires request verification (JWT/secret) so forged requests cannot trigger upstream API calls.
- **Tenant-scope email integration data:** phase in `tenant_id` for EmailAccount/EmailLog (and related tables), then add RLS policies once tenant-scoped.
- **OAuth endpoint de-shadowing:** remove/lock down duplicate legacy OAuth callback routes to prevent accidental re-exposure.

### P0 — WorkForms editor “industry leader” UX (next)
- **Publish readiness preflight + support matrix UI:** block publish when unsupported nodes/missing required config; show actionable remediation.
- **Validation parity:** unify `nodeValidationService` with schema `conditional` + `validationEngine` so hidden fields don’t error and rules match the config panel.
- **Config safety:** keyValue record-mode must never persist arrays into node data (draft UI-only); add unit + Playwright coverage (actionHTTP headers).
- **A11y + testability:** section headers keyboard-accessible (`aria-expanded`), labels wired to inputs (`htmlFor`/`id`), stable `data-testid` selectors.
- **Performance:** lazy-mount heavy hidden fields; debounce text updates to shadow state; remove/gate debug logging.

### P0 — Business usability
- **Cockpit Search relevance:** ranking + fuzzy match + recency; persistent favorites that are tenant-safe (RLS-backed).
- **Mobile responsiveness:** Cockpit + core CRUD forms usable <768px; touch targets; FlowEditor mobile/tablet fallback.
- **Email ingestion monitor:** correctness, diagnostics, reconnect CTA, progress reporting, attachment-aware detection.
- **Admin workspace usability:** option lists/system lists visibility + custom list create/edit flows.

### P1 — CI/CD determinism (next)
- **Remove archived workflows from Actions:** move `.github/workflows/archived/**` out of `.github/workflows/` so they cannot run and bypass guardrails.
- **Immutable CI inputs:** digest-pin workflow `services.*.image` containers (Postgres/pgvector) and stop pushing mutable `latest` tags.
- **Deployment safety gate:** require PR Validation success for the same SHA for UAT/Prod deployments (even if deploy workflow test jobs are temporarily bypassed).

### P0 — WorkForms E2E completion (Workstream B)
**Goal:** Make WorkForms publish + execute + monitor **end-to-end** with deterministic runtime behavior, explainable execution details, and tenant-safe notifications/connectors — while respecting **shared-schema multi-tenancy (Postgres RLS + `app.current_tenant`)** and **Golden Pipeline** constraints.

**Status:** ✅ Completed (PRs #4480–#4487)

**Evidence / shipped:**
- Plan + backlog documented (PR #4480)
- Notifications persisted end-to-end (PR #4481)
- Gmail env manifest keys added (PR #4482)
- Runtime validation + activation guardrails (PR #4483)
- Playwright execution smoke (PR #4484)
- Quick Actions + Catalog WorkForms reliability (PR #4485)
- Entity execution visibility + robust entity_id filtering (PR #4486)
- Gmail connector MVP + OAuth hardening + widget wiring + setup docs (PR #4487)

**Deliverables (Workstream B):**
1) **Node support matrix + publish-time guardrails**
   - Define a canonical “supported nodes/actions” matrix for WorkForms runtime (what executes vs. what is editor-only/unsupported).
   - Add publish-time (and/or “Quick Run” time) validation that blocks unsupported nodes/actions with actionable reasons.
   - **Additive-only constraint:** do not break previously published workflows; guardrails apply to new publishes/edits, with clear compatibility messaging.

2) **Structured validation + explainable errors (execution details)**
   - Persist per-step validation failures and runtime errors into execution details (node id, error code, user-facing message, remediation).
   - UI surfaces errors in WorkForms execution details without leaking raw exceptions; errors must be deterministic and debuggable.

3) **Notifications end-to-end**
   - Implement `ActionExecutor.send_notification` to create tenant-scoped notification records (so `/api/v1/workflows/notifications/*` reflects WorkForms events).
   - Ensure notification creation and reads are **RLS-safe** in shared-schema multi-tenancy (no cross-tenant leakage).
   - Minimal acceptance: a WorkForm run can reliably generate a notification visible to intended recipients.

4) **Quick Actions completeness for WorkForms**
   - Ensure WorkForms “Quick Run / Quick Actions” paths cover supported actions end-to-end (create/update/email/notification) with the same validation + error semantics.
   - Confirm execution status + results are visible post-run (async Celery completion).

5) **Entity workflow status panel**
   - Add/complete an entity-facing status panel showing latest WorkForm execution(s): current step/node, last error (if any), and relevant notifications, with a link into full execution details.

6) **Gmail connector (optional, hardened, explicit setup)**
   - Add optional Google OAuth secrets to `manifests/env.manifest.json` (feature stays disabled when unset; must degrade gracefully).
   - OAuth hardening: tenant binding + CSRF/state validation (and any required PKCE/redirect constraints) with explicit failure modes.
   - Minimal sync stub: smallest “connectivity proof” that confirms auth works (without requiring full ingestion parity on day one).
   - Document explicit user/admin setup steps (required env vars, redirect URLs, scopes, and how to verify connection).

**Acceptance criteria (must meet Golden Pipeline + multi-tenant constraints):**
- Publishing/running a WorkForm with unsupported nodes/actions fails fast with a structured, user-readable explanation (not a Celery log-only failure).
- A WorkForm `actionNotification` produces an actual notification record retrievable via `/api/v1/workflows/notifications/*` and visible only within the correct tenant (RLS).
- Execution details show per-step status + structured errors for async runs (Celery) with no raw exception leakage.
- Gmail connector is explicitly “disabled until configured”; missing secrets never cause 500s; once configured, OAuth flow succeeds with hardened validation.
- All changes remain compliant with shared-schema multi-tenancy and ship through Golden Pipeline gates (type-check, tests, and any required E2E coverage for the WorkForms critical path).

### P1 — Operational excellence
- **Documentation hygiene:** demote/label duplicated roadmaps, remove contradictory “100% complete” claims.
- **CI automation:** promotion PRs dev→uat and uat→prod/main remain green and observable.
- **Copilot Squad governance:** repo-local squad roles/tasks/agents/skills under `.copilot/squad/` + `.github/agents/` + `.github/skills/` with validator `bash scripts/validate_copilot_squad.sh`.

## Phase 12 — Enterprise Hardening & Tech Debt Eradication

**Goal:** convert the current platform from feature-reactive execution into an enterprise-hardened, contract-first, fail-closed system with enforceable SDLC guardrails.

**Primary deliverables**
- Canonical execution artifacts: `.github/TECH_DEBT_REGISTER.md`, `.github/SDLC_PROTOCOLS.md`, `.github/EPIC_TICKETS.md`
- Guardrail epics covering drift detection, secret governance, PR-time security, rollback/release automation, tenant/RLS safety, idempotency, contracts, frontend standards, and non-dev reliability
- Execution ordering that a fresh AI session can follow without relying on tribal knowledge

**Expected results**
- Drift, secret, and documentation mismatches fail early in CI instead of after deploy
- Tenant-scoped reads/writes fail closed when tenant or RLS state is ambiguous
- Frontend/mobile consume generated contracts through approved service layers
- Runtime reliability depends on explicit, production-grade infrastructure rather than dev fallbacks

**Acceptance criteria**
- The first unchecked ticket in `.github/EPIC_TICKETS.md` is executable from docs alone
- `.github/SDLC_PROTOCOLS.md` lists the mandatory reads, commands, and guardrails for every major change type
- High-risk enterprise gaps are mapped to discrete epics with dependencies, tests, and rollback notes
- This file remains the only canonical priority snapshot

**Dependencies**
- `manifests/GOLDEN_FILES.md` for authority mapping
- `docs/GOLDEN_PIPELINE.md` for CI/CD and deployment rules
- `.github/EPIC_TICKETS.md` for execution order
- `.github/TECH_DEBT_REGISTER.md` for gap inventory

**Risk register**
- **Gate tightening causes short-term friction** -> phase in with clear remediation commands and explicit evidence requirements
- **Fail-closed tenant changes expose latent client bugs** -> stage by endpoint family and emit stable error codes
- **Contract-first migration surfaces type drift** -> roll out domain by domain with compatibility wrappers

**Testing strategy**
- Docs/gates: `bash scripts/verify_golden_state.sh`, `bash .github/scripts/check_infrastructure.sh`, `bash scripts/validate_copilot_squad.sh`
- Frontend: `npm -C frontend run verify-standards`
- Backend: targeted `python manage.py test ...` suites per ticket from `backend/`
- Env/secrets when relevant: `python config/manage_env.py audit`

**Rollback / safe-change approach**
- Prefer additive changes, warn-only gates before blocking, and feature-flagged fail-closed rollouts
- Use `.github/MASTER_PLAN.md` only for shipped evidence after merge; correct any docs drift by reverting the affected docs batch and re-deriving order from this file

**Phase 12 epics**
- **EH-00** Canonical docs/governance layer
- **EH-01** SDLC + supply-chain hardening
- **EH-02** Tenant isolation + data integrity
- **EH-03** Contract-first platform
- **EH-04** Frontend enterprise compliance
- **EH-05** Runtime/ops reliability

## Phase 13 — Next-Gen AI & Automation

**Goal:** evolve AI capabilities from hardened chat/document tooling into a governed autonomy platform with durable lineage, semantic retrieval, and operator-grade approvals/telemetry.

**Primary deliverables**
- Persisted autonomy control-plane design and execution backlog
- Canonical AI safety rules in `.github/SDLC_PROTOCOLS.md`
- Sequenced tickets for semantic indexing, Graph resilience, lineage, HITL, telemetry, and export governance

**Expected results**
- AI runs are traceable by tenant, run, tool, and approval state
- Semantic retrieval is real, tenant-safe, and health-gated
- Operator dashboards show explicit empty/degraded states rather than synthetic production metrics

**Acceptance criteria**
- AI/autonomy tickets in `.github/EPIC_TICKETS.md` are blocked on the required Phase 12 safety foundations
- AI persistence and exports are documented as tenant-native and durable-storage-only
- HITL, lineage, and telemetry requirements are explicit enough for independent execution

**Dependencies**
- Phase 12 tenant/RLS, contract, and reliability epics
- Non-dev Redis/observability readiness
- Manifest-defined secrets and external service setup

**Risk register**
- **Unsafe autonomy rollout** -> shadow mode, approval-required mode, then scoped autonomy
- **Vector/RAG platform drift** -> choose one canonical storage strategy and document fallback behavior explicitly
- **External API throttling** -> shared HTTP client with retry budget, jitter, and metrics before broader rollout

**Testing strategy**
- AI lineage, approval, and retry suites
- Graph throttling and parser lifecycle regression tests
- Pgvector-present/absent retrieval tests

**Rollback / safe-change approach**
- Keep autonomy deny-by-default until lineage, approvals, and telemetry exist
- Roll back AI execution changes by disabling the feature flag/control-plane entrypoint, not by bypassing tenant-safe storage rules

**Phase 13 epics**
- **EH-06** AI autonomy platform

---

## Evidence Index (where to look)
- `.github/MASTER_PLAN.md` (append-only PR log)
- `.github/EPIC_TICKETS.md` (execution-ordered backlog)
- `.github/SDLC_PROTOCOLS.md` (normative delivery rules)
- `.github/TECH_DEBT_REGISTER.md` (machine-readable debt inventory)
- `GAP_ANALYSIS_REPORT.md` / `STRATEGIC_BLUEPRINT.md` (non-canonical synthesis snapshots)
- `docs/prompts/last-25-prompts-2026-03-24.md` (prompt backlog inputs)
- Verification artifacts: `PHASE_VERIFICATION_COMPLETE.md`, `EXECUTION_SUMMARY.txt`

---

## Gaps & Improvements (Repo audit output)

This section captures the highest-signal gaps found during repo review, with concrete acceptance criteria.

### 0) Competitive gap analysis (industry leader benchmark, 2026-03-30)
Benchmark context: Salesforce/HubSpot (CRM + search), Airtable/Retool (data UX), Monday/Asana (work mgmt), Make/Zapier (automation), modern multi-tenant SaaS baselines.

#### P0 — Business-critical gaps
1) **Search relevance + entity ranking** (Cockpit/SmartSearch)
- Acceptance: ranked results (not just lists), fuzzy match, recency weighting, consistent result cards.
- Acceptance: favorites persist across reload and are **tenant-safe** (RLS-backed); localStorage can be a fallback but not the source of truth.

2) **Mobile/touch usability**
- Acceptance: Cockpit + core CRUD forms usable <768px; touch targets ≥44px; no clipped modals/menus.
- Acceptance: FlowEditor has a defined mobile/tablet behavior (read-only, simplified view, or explicit “desktop required” messaging).

3) **Graceful degradation for missing secrets/infra (zero tolerance for crashes)**
- Acceptance: backend exposes feature availability (e.g., AI/email/Outlook/RAG) via health/config.
- Acceptance: frontend gates feature UI and shows deterministic “Enable in Settings” CTAs instead of opaque 400/500s.

4) **Email ingestion reliability + diagnostics (Outlook/SendGrid UX parity)**
- Acceptance: stable error codes (auth vs decrypt vs network vs quota vs processing), reconnect CTA on auth/decrypt failures.
- Acceptance: progress/summary reporting for long syncs (partial results OK, no silent timeouts).

5) **Type safety hardening**
- Acceptance: `npm run type-check` is clean; new `any` usage is exceptional and deliberate.

#### P1 — High-value gaps
- Reporting dashboards (drilldown + export).
- Workflow execution monitoring UI (traces, node I/O, retries).
- Admin list builder + bulk ops.
- Form intelligence (auto-populate, conditional fields, cascading selects).
- Webhooks/connectors foundation (start outbound; expand inbound later).

#### P2 — “Polish / expansion” gaps
- Multi-user collaboration for FlowEditor.
- White-label branding depth (tenant email branding + domains).
- Knowledge base + help AI (RAG) with clear off-switch when pgvector not available.
- Predictive analytics (only after data quality + reporting foundations).

### 1) Documentation consistency (avoid contradictory “100% complete” claims)
**Gap:** Multiple docs (e.g. `ROADMAP.md`, `docs/plans/*`) contain “100% complete / all phases complete” statements that conflict with the real operational backlog.

**Plan:**
- Add explicit “REFERENCE ONLY” banners to non-canonical docs.
- Ensure only `MASTER_PLAN.md` claims current-state status.

**Acceptance criteria:**
- No non-canonical doc presents itself as the current source of truth without a pointer to `MASTER_PLAN.md`.

### 2) Verification levels (make “done” unambiguous)
**Gap:** “Merged” is sometimes treated as “verified”. This blurs true readiness.

**Plan:** adopt a lightweight evidence rubric in this master plan:
- **Merged**: PR merged.
- **Tested**: relevant repo tests/scripts run (existing tooling only).
- **Verified (manual)**: user-facing flow spot-checked.

**Acceptance criteria:**
- New “done” entries in the snapshot include at least: PR/commit + verification level.

### 3) Local backend test ergonomics (extensions/infrastructure assumptions)
**Gap:** Some environments cannot run backend tests due to missing PostgreSQL extensions (e.g. `vector` / pgvector).

**Plan:**
- Document a supported local testing path (Docker Postgres image with required extensions, or a fallback test profile).
- Ensure CI remains the authoritative verification channel when local infra is incomplete.

**Acceptance criteria:**
- A contributor can follow existing docs/scripts to run backend tests without bespoke manual DB tinkering.

### 4) Multi-tenant safety + RLS drift prevention
**Gap:** Tenant context and RLS policies remain a recurring failure mode.

**Plan:**
- Every new tenant-aware table migration must include RLS policy (per `docs/workforms/MIGRATION_STANDARDS.md`).
- Keep “tenant-required” API contracts explicit (fail fast with 400/403, not 500).

**Acceptance criteria:**
- No tenant-scoped create endpoints throw unhandled IntegrityError/permission errors in normal use.

### 5) Frontend API contract drift
**Gap:** Some pages historically bypassed the service layer or used inconsistent URL shapes (trailing slash / tenant in path).

**Plan:**
- Enforce “service layer only” (`businessApi` / `workformsApi`) and normalize endpoint shapes.

**Acceptance criteria:**
- New frontend code does not introduce raw axios instances or hardcoded `/api/v1/tenants/{id}` paths.

### 6) Operational reliability (promotion + deploy workflows)
**Gap:** Auto-promotion and deployment workflows are critical and require ongoing observability.

**Plan:**
- Keep promotion workflows green and ensure failures are actionable (clear logs, no silent success).

**Acceptance criteria:**
- Promotion PR creation is reproducible (dev→uat, uat→main/prod) and failures surface as failed jobs (not “success with no-op”).

---

## Appendix: Historical Plan Notes (for context)


---

## 🔧 Phase 7 Stabilization + Cockpit Navigation (Active) ⚠️


**Scope**: Stabilize Phase 7 (Intelligent Workform Editor) with **4 CRITICAL INITIATIVES** + Unified Command Center transformation.

**🚨 CRITICAL INITIATIVES (P0 Priority)**:
1. **Emergency Node Config Blackout** - Registry validation failures block 60%+ of editor functionality
2. **Cockpit Consolidation & Search-First** - Eliminate SmartWizard friction, add Dashboard Hero Search (Stripe/Algolia pattern)
3. **Form Node Configuration & Layout** - Remove deprecation warnings, implement left-to-right auto-layout (Figma/Miro pattern)
4. **WorkForms Strategic Overhaul** - Transform from fragmented pages → Unified Command Center (Salesforce/Make.com pattern)


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


### 🔧 DETAILED IMPLEMENTATION PLANS

---

## 🚨 EMERGENCY: Node Config Blackout & Registry Normalization

**Date Added**: March 17, 2026  
**Severity**: CRITICAL  
**Status**: MERGED — PR #3455, #3460, #3552  
**Priority**: P0 (Previously blocked 60%+ of workflow editor functionality)

### Resolution (Shipped)
- Schema registry now normalizes `field.validation` objects → arrays and treats missing select options as warnings.
- `complexRenderers.tsx` imports/uses `ValidationRuleBuilder` correctly (no `ReferenceError`).
- FlowEditor node handler injection is hardened to avoid `a is not a function` runtime failures.

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
> * Append PR entry to `.github/MASTER_PLAN.md` (append-only PR log) and update canonical status in `MASTER_PLAN.md`.

#### III. 📝 VERIFICATION TASKS

1. **Configuration Verification:** Once the PR is merged, click an **Action: Send Email** node and verify that the "To", "Subject", and "Body" fields appear immediately.

2. **Wait Node Test:** Verify that clicking a **Timer: Delay** node now shows a numeric duration input and a unit dropdown (Minutes/Hours) instead of a blank panel.

3. **Manual "Save" Audit:** Save a workflow containing a **Form Process Group** and verify that the success toast appears without the `TypeError: a is not a function` error appearing in the background console.

4. **Schema Robustness Check:** Verify that the console no longer logs "Invalid schema" warnings for the `createRecord` or `outlookEmail` nodes.

---

## 📍 Cockpit Consolidation & Search-First Operations

**Date Added**: March 17, 2026  
**Priority**: P0 (Eliminates 2-3 click navigation friction)  
**Status**: MERGED — PR #3542 (breadcrumb + quick actions), PR #3552 (hero search + nav stability), PR #3553 (plan/audit log)

### I. ANALYSIS: Cockpit Consolidation & Search-First Operations

The "Smart Wizard" has failed to provide architectural value and currently creates navigation friction. Per your mandate, we are moving to a **Search-First Cockpit** where the dashboard acts as a high-powered command center, and the search bar—currently in the header—is mirrored prominently on the dashboard landing page to eliminate extra clicks.

#### Risk Audit

* **Navigation Desync**: Consolidation requires removing routes from `App.tsx` and `navigation.ts`. If references remain in the `Sidebar.tsx`, it will trigger 404s.
* **Contextual Overlap**: Having search in both the Header and the Dashboard requires strict state management through the `CockpitNavigationContext` to ensure results and breadcrumbs remain consistent regardless of which bar was used.

#### Execution Strategy

1. **Decommission SmartWizard**: Delete `SmartWizard.tsx`, remove its entry from the `v1` routes and sidebar configuration.
2. **Dashboard Hero Search**: Inject a prominent "Hero" version of the `SmartSearch` input into the top of `CockpitDashboard.tsx`. This component will utilize the same `useCockpitNavigation` logic to maintain a "Continuous Browsing" experience.
3. **Sidebar Logic Fix**: Apply the `NavigationMenu.tsx` patch to resolve the "snap-back" parent-child clicking bug.

### II. 🤖 COPILOT CLI DELEGATION

**Mode:** `plan`  
**Agent:** `claude-sonnet-4.5`

**Detailed Prompt:**

> **Context:** Senior Lead Architect for ProjectMeats. We are consolidating the Cockpit and enforcing the "Search-First" UI standard.
>
> **Objective 1: Decommission SmartWizard**
> 1. Delete `frontend/src/pages/Cockpit/SmartWizard.tsx`.
> 2. Remove all routes for `/cockpit/wizard` from `frontend/src/App.tsx`.
> 3. Update `frontend/src/config/navigation.ts` to remove the "Smart Wizard" menu item.
>
> **Objective 2: Dashboard Hero Search Integration**
> 1. Modify `frontend/src/pages/Cockpit/CockpitDashboard.tsx`.
> 2. Import the `SmartSearch` component and place a prominent, centered instance at the top of the dashboard (above the widgets).
> 3. Style this dashboard-level search bar to look like an industry-standard "Omnibox" (e.g., similar to Stripe or Algolia landing pages).
> 4. Ensure it shares state with the `Header.tsx` search bar via `CockpitNavigationContext`.
>
> **Objective 3: Sidebar Navigation Fix**
> 1. Modify `frontend/src/components/Navigation/NavigationMenu.tsx`.
> 2. **Memoize `filteredItems`** to prevent reference mismatches on re-renders.
> 3. Update the `useEffect` responsible for active-route expansion to check `lastPathnameRef.current`. It should ONLY trigger auto-expansion when the user navigates to a different page, not on every re-render, to allow manual parent toggles to persist.
>
> **Objective 4: Progress Audit**
> 1. Retrieve `.github/MASTER_PLAN.md`.
> 2. Mark "Smart Wizard Consolidation" as completed and update Phase progress.

### III. 📝 MY TASKS

1. **Search Redundancy Test**: Open the Dashboard and type a search query into the new "Hero" bar. Verify that clicking a result correctly updates the Header breadcrumbs and switches the view to the record detail without modal popups.

2. **Sidebar Stress Test**: Click a parent nav item (e.g., "Suppliers"), then immediately click another parent (e.g., "Customers") without clicking a child link. Verify the first parent stays collapsed/expanded as intended and doesn't "snap back" to the active route.

3. **Production Deployment Verification**: Confirm the removal of the Wizard code reduces the frontend bundle size and that no orphaned CSS classes from the wizard remain in `theme.ts`.

---

## 🎨 Form Node Configuration & Layout Fixes

**Date Added**: March 17, 2026  
**Priority**: P1 (UX inconsistency + user confusion)  
**Status**: MERGED — PR #3552 (formStep deprecation cleanup + LR auto-layout)

### I. ANALYSIS: File State Retrieval & Context Assessment

1. **The Issue:** The Dynamic Configuration panels are loading, but they lack smart pre-configuration. The `FormProcess` node needs left-to-right auto-layout for its child steps and process-specific configurations. Furthermore, the `Form` node (specifically `formStep` or `formStepSingle`) is displaying an inaccurate "Deprecated" warning, causing confusion since it is the primary node in use.

2. **Risk Audit (RLS/Data Leak & Standards):**
   * *Architecture Compliance:* Modifying the configuration schemas (`nodeConfigSchemas.ts`) carries no direct database risk, but we must ensure any default entity selections respect `TenantAwareModel` patterns downstream.
   * *Debt Reminder:* We still have high-priority technical debt to migrate `PurchaseOrder` and `Invoice` to `TenantAwareModel` with strict `app.current_tenant` RLS enforcement.

3. **Execution Strategy:**
   * **First:** Fulfill the Master Protocol by retrieving the `.github/MASTER_PLAN.md`.
   * **Second:** Patch `frontend/src/components/FlowEditor/config/nodeConfigSchemas.ts` to completely strip the deprecation warnings from `formStep` and `formStepSingle`. We will elevate them back to primary status.
   * **Third:** Direct the Copilot agent to update the layout engine (e.g., `frontend/src/components/FlowEditor/utils/autoLayout.ts` or `containerLayout.ts`) to enforce a horizontal (`LR`) layout specifically for `formProcess` and `formProcessGroup` children.
   * **Fourth:** Log the architectural refinements to `MASTER_PLAN.md`.

### II. 🤖 COPILOT CLI DELEGATION <plan mode>

**@copilot** Execute the following commands in sequence to establish the smart configurations and fix the layout/deprecation issues.

1. **Verify State:**

```bash
cat .github/MASTER_PLAN.md
```

2. **Patch the Node Config Schemas (Remove Deprecation):**

```bash
cat << 'EOF' > patch_schemas.js
const fs = require('fs');
const path = './frontend/src/components/FlowEditor/config/nodeConfigSchemas.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Clean up formStepSchema deprecation
content = content.replace(/displayName: 'Form Step \\(Deprecated\\)',/g, "displayName: 'Form Step',");
content = content.replace(/description: '\\[DEPRECATED\\].*?',/g, "description: 'Standard form step for data collection',");
content = content.replace(/tags: \\['form', 'deprecated'\\],/g, "tags: ['form', 'data-collection'],");

// Remove the deprecation section entirely from formStepSchema
content = content.replace(/\{\s*id: 'deprecation',\s*title: 'Migration Notice',[\s\S]*?fields: \[[\\s\\S]*?\]\s*\},/g, "");

// 2. Clean up formStepSingle registration at the bottom of the file
content = content.replace(/displayName: 'Form \\(Legacy\\)',/g, "displayName: 'Form',");
content = content.replace(/description: '\\[DEPRECATED\\].*?',/g, "description: 'Single-page form for data collection',");

fs.writeFileSync(path, content);
console.log("nodeConfigSchemas.ts patched successfully. Deprecation warnings removed.");
EOF
node patch_schemas.js
rm patch_schemas.js
```

3. **Update Container Auto-Layout to Left-to-Right (LR):**

```bash
# We will use sed to patch the layout direction for Form Process containers.
# Assuming Dagre or similar layout engine is used in autoLayout.ts or containerLayout.ts
# Since we need to inspect the file first to know the exact syntax:
cat frontend/src/components/FlowEditor/utils/autoLayout.ts | grep -i "direction" || echo "Need to inspect layout logic further"

# @copilot: Please inspect `frontend/src/components/FlowEditor/utils/autoLayout.ts` and `frontend/src/components/FlowEditor/utils/containerLayout.ts`.
# Modify the layout algorithm so that if a node's parent is a `formProcess` or `formProcessGroup`, the layout orientation is strictly 'LR' (Left-to-Right) instead of 'TB' (Top-to-Bottom).
```

4. **Update Master Plan:**

```bash
echo "\n- [x] $(date +'%Y-%m-%d %H:%M') Cleaned up inaccurate deprecation warnings on Form nodes in nodeConfigSchemas.ts. Initiated Left-to-Right auto-layout logic for FormProcess containers to improve UX flow." >> .github/MASTER_PLAN.md
```

### III. 📝 MY TASKS

1. **Frontend Verification:** Open the local workspace. Drag a "Form" node onto the canvas and verify that the "Migration Notice" and "Deprecated" tags are completely gone from the configuration panel.

2. **FormProcess Testing:** Drag a "Form Process" node and add child steps. Verify that the visual layout engine correctly aligns them horizontally (left-to-right) within the container.

3. **RLS Migration Preparation:** Review the `PurchaseOrder` and `Invoice` models in the backend. I need to prepare the raw SQL for `ENABLE ROW LEVEL SECURITY` and the associated `CREATE POLICY` to bind them securely to `app.current_tenant`. I will schedule this for the next active sprint block.

---


---

## 🎯 Cockpit & WorkForms Strategic Overhaul - Unified Command Center

**Date Added**: March 17, 2026  
**Priority**: P0 (Transforms fragmented pages → Unified operational hub)  
**Status**: ✅ COMPLETE — Cockpit consolidation + WorkForms command-center views shipped (see PR log in `.github/MASTER_PLAN.md`)

### Completed (Shipped)
- Cockpit breadcrumb + quick actions routing (PR #3542)
- Dashboard Hero SmartSearch + SmartWizard decommission + nav stability (PR #3552, #3553)
- FlowEditor stability hardening in support of the unified command center (PR #3552)

### I. ANALYSIS: Context Retrieval → Risk Audit → Strategic Overhaul

Based on the mandatory protocol, I have audited the current state of the Cockpit and WorkForms modules. We are transitioning from a fragmented "Page-by-Page" architecture to a **Unified Command Center** standard. The goal is to ensure that a user can manage their entire operational day—from tracking high-priority tasks to monitoring live workflow executions—without leaving the Cockpit/Dashboard hub.

#### Risk Audit

* **Editor Persistence:** The "Golden Standard" for the `UnifiedFlowEditor` must be preserved. We are enhancing the *monitoring* of those flows, not modifying the *builder* logic.
* **Data Isolation (RLS):** Overhauling "My Tasks" and "History" requires absolute certainty that the `ActionItemsAPIView` and `FormSubmission` queries are strictly filtered by `app.current_tenant` to prevent cross-tenant data leaks.
* **Handler Injection:** We must resolve the recurring `TypeError: a is not a function` in the editor nodes to ensure that "Smart Auto-Map" and "Save" operations are stable during this consolidation.

#### Execution Strategy

1. **Dashboard Consolidation:** Decommission the non-functional "Smart Wizard." Mirror the Global Search (Header) as a "Hero Omnibox" on the Dashboard.
2. **WorkForms "Smart" Pivot:**
   * **My Tasks:** Implement industry-standard prioritization (Urgency × Value).
   * **Monitoring (New):** Build a "Punch-In" view where users can click an active process and see exactly where it is stuck.
   * **Catalog:** Refactor into a high-fidelity "Template Library" with one-click triggers.
3. **Stability Pass:** Apply the `schemaRegistry` and `handlerInjection` fixes to end the configuration "blackout" once and for all.

### II. 🤖 COPILOT CLI DELEGATION <plan mode>

**Agent:** `claude-sonnet-4.5`

**Detailed Prompt:**

> **Context:** Senior Lead Architect for ProjectMeats. We are consolidating the Cockpit and overhauling WorkForms to meet industry-leader standards (Salesforce/Make.com).
>
> **Objective 1: Cockpit & Search Consolidation**
>
> 1. **Decommission Wizard:** Delete `frontend/src/pages/Cockpit/SmartWizard.tsx` and remove its routes from `App.tsx`.
> 2. **Dashboard Hero Search:** In `CockpitDashboard.tsx`, inject a prominent, centered instance of the `SmartSearch` component at the top.
> 3. **Sidebar Parent Logic:** Update `NavigationMenu.tsx`. Memoize `filteredItems` and update the `useEffect` to only auto-expand parents when `location.pathname` changes, resolving the "parent-lock" clicking bug.
>
> **Objective 2: WorkForms "Smart" Sub-Pages**
>
> 1. **My Tasks (Smart Sorting):** Update `MyTasks.tsx`. Integrate a sorting matrix that weighs tasks by `due_date` and `related_po_value`. Use the `QuickStatsWidget` logic to highlight "At Risk" tasks.
> 2. **Process Monitoring ("Punch-In"):** Create `frontend/src/pages/WorkForms/Monitoring.tsx`.
>    - Display a table of active `FormSubmissions`.
>    - Clicking a row must open a read-only `UnifiedFlowEditor` that highlights the "Current Node" (e.g., a Wait node or Pending Approval).
>    - Display "Who, When, Why" details in a side-panel for the active node.
> 3. **Catalog (Library Standard):** Update `Catalog.tsx`. Organize workflows by "Protein Type" and "Department". Add a "Quick Run" button that triggers the workflow immediately.
>
> **Objective 3: Critical Editor Fixes (Configuration Restoration)**
>
> 1. **Registry Normalization:** Update `schemaRegistry.ts` to allow `validation` as an object (auto-wrap in array) and allow `info` types to skip the `label` requirement.
> 2. **Handler Injection:** In `UnifiedFlowEditor.tsx`, ensure `onEdit`, `onDelete`, and `onSave` are injected into **ALL** node data objects.
> 3. **Entity-Field Cascade:** Update `EntityFieldPicker.tsx`. Add a `useEffect` to re-fetch fields whenever the `initialEntityType` prop changes.
>
> **Strict Compliance:**
> * All data fetching must use `BusinessApi`.
> * Append PR entry to `.github/MASTER_PLAN.md` (append-only PR log) and update canonical status in `MASTER_PLAN.md`.

### III. 📝 MY TASKS

1. **Manual "Punch-In" Audit:** Once the Monitoring page is live, trigger a "Purchase Order Approval" flow. Verify you can "punch-in" from the monitor and see the approval node highlighted in the visual flow.

2. **Search State Test:** Verify that searching in the Dashboard "Hero" bar updates the Header breadcrumbs and switches the view seamlessly to the record detail.

3. **Task Sorting Formula:** Define the specific arithmetic for "Urgency" (e.g., $10k POs with < 2 days remaining get top priority) for the Smart Tasks view.

4. **Production Readiness:** Verify that `api/v1/system/entities/` endpoints are correctly resolving for the new "Monitoring" table view.

**Status**: We will not proceed to Phase 9 until the Cockpit is a verified operational hub.

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
- [x] 2.2: Template Library (import/export workflows)
- [x] 2.3: Entity Cascading (protein → cuts automation)
- [x] 2.4: Form Process Groups Version Control
- [x] 2.5: Enhanced Inheritance (type-checking for forms)

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
   - [x] 2.2: Template Library (import/export workflows)
   - [x] 2.3: Entity Cascading (protein → cuts automation)
   - [x] 2.4: Form Process Groups Version Control
   - [x] 2.5: Enhanced Inheritance (type-checking for forms)

**Blocker**: ✅ **RESOLVED** - All infrastructure operational

**Target Completion**: Q2 2026 (infrastructure unblocked, ready for feature development)

---

## Phase 3: Search Intelligence [~] ✅ INFRASTRUCTURE VERIFIED

**Status**: ✅ Infrastructure Verified (March 3, 2026) - Ready for Feature Development  
**Estimated Effort**: 26-33 hours (4 todos)

### Planned Deliverables
- [x] 3.1: Mind-Map Visualizations (react-flow integration)
- [x] 3.2: Real-Time Search Updates (WebSocket-based)
- [x] 3.3: NLP Query Refinement (natural language via OpenAI)
- [x] 3.4: Continuous Search (suggestions as you type, Redis-cached)

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
  - 17 workflow tables with PostgreSQL RLS policies (Migration 0015)
  - **RLS Debt Cleared (2026-03-22)**: `audit_rls_compliance` now reports **38/38 tenant-aware models compliant** (MEDIUM/LOW closed).
  - Files: `backend/tenant_apps/workflows/models.py`, `workflows/migrations/0015_sync_workflow_rls_state.py`, `manifests/RLS_POLICIES.md`

### Blocked Deliverable
- [x] 6.4: ✅ COMPLETE Sentry Integration (error tracking, APM) 🔒

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

## Phase 7: Intelligent Workform Editor [x] 100% COMPLETE

**Status**: ✅ Complete — March 2026  
**Start Date**: February 2026  
**Progress**: 100% (11/11 sub-phases complete)

### Completed Deliverables
- [x] 7.1: AI-Powered Field Suggestions ✅ **COMPLETED** Feb 28, 2026
  - **PR**: #3388 (Infrastructure Diagnostics & AI Engine)
  - Backend: SuggestNodesView with OpenAI integration (gpt-4o-mini)
  - Frontend: Enhanced AISuggestionsPanel with loading states
  - Redis caching with 10-minute TTL (~90% cost reduction)
  - Graceful degradation to static suggestions
  - 8 unit tests for connectivity checks
  - **Files**: 
    - `backend/apps/core/management/commands/check_infrastructure.py` (management command)
    - `backend/tenant_apps/workflows/views.py` (+89 lines)
    - `frontend/src/components/FlowEditor/components/AISuggestionsPanel.tsx` (+120 lines)
  - **Status**: Code complete, awaiting infrastructure audit

- [x] 7.2: Enhanced Drag-and-Drop ✅ **COMPLETED** (All Sub-Features)
  - [x] Smart snapping and positioning (PR #3309)
  - [x] Container management with nesting (PRs #3343-#3345, #3374)
  - [x] Visual connection indicators (PR #3375)
  - [x] Batch operations (PR #3373)

- [x] 7.3: Real-Time Collaboration ✅ **COMPLETED** (PR #3412)
  - Multi-user editing with Redis pub/sub
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
- `backend/apps/core/management/commands/check_infrastructure.py` (management command)

**Development Principles**:
- ✅ **Additive-Only Changes**: Never break existing workflows
- ✅ **Multi-Tenant Safety**: Changes work across ALL tenants
- ✅ **Performance First**: Sub-100ms render times achieved
- ✅ **User Experience**: Progressive enhancement, undo/redo, graceful degradation

**Remaining Work**:
- All 11 sub-phases complete. External secrets (OPENAI_API_KEY, REDIS_URL for UAT/Prod) required to fully activate AI suggestions and real-time collaboration in production environments.

**Total Lines Delivered**: ~7,000+ lines of production code, 374+ unit tests

---

## Phase 8: Advanced Caching & Parallelization [~] ✅ INFRASTRUCTURE VERIFIED

**Status**: ✅ Infrastructure Verified (March 3, 2026) - Ready for Feature Development  
**Target Start**: Q2 2026 (April) - **Infrastructure Ready**

### Planned Deliverables
- [x] 8.0: Three-Tier Product Strategy (Golden List + Tenant Preferences + Tenant Custom Products)
- [x] 8.1: Redis Query Result Caching
- [x] 8.2: CDN Integration for Static Assets
- [x] 8.3: Parallel Task Execution (Celery workers)
- [x] 8.4: Background Job Processing (Celery) - **Partially Complete** (email ingestion operational)
- [x] 8.5: Edge Caching Strategies

**Infrastructure Verification**:
- ✅ Redis operational for caching backend
- ✅ Celery workers operational in dev
- ✅ Celery beat scheduler operational
- ✅ Background tasks running (email ingestion every 5 minutes)

**Blocker**: ✅ **RESOLVED** - Redis and Celery infrastructure operational

**Note**: Phase 8.4 (Background Job Processing) is partially operational with email ingestion tasks. Additional parallel execution patterns can now be implemented.

---

## Phase 9: Security Scanning & SBOM [x] COMPLETE

**Status**: ✅ Complete (March 2026)
**Completion Date**: March 2026

### Planned Deliverables
- [x] 9.1: Automated SBOM Generation
- [x] 9.2: Container Image Scanning (Trivy/Grype)
- [x] 9.3: Dependency Vulnerability Scanning
- [x] 9.4: License Compliance Checking
- [x] 9.5: Security Audit Reports

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
   - ✅ **System-wide RLS**: `audit_rls_compliance` = **38/38 tenant-aware models compliant** (2026-03-22)
   - **Status**: 🎉 **100% COMPLETE**
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
- **Total Phases**: 10
- **Complete**: 9/10 phases (P1–P9 @ 100%)
- **In Progress**: 0 phases
- **Blocked**: 0 phases
- **Planned**: 1 phase (Phase 10: DRY/Canonical Architecture)
- **Progress**: 90% (Phases 1-9 complete) + **Phase 10 Planned**

### By Category
- **UI/UX**: 100% (Phase 1 complete)
- **Admin**: 100% (Phase 4 complete)
- **Security**: 100% (Phase 6 + Phase 9 complete)
- **AI/ML**: 100% (Phase 2 complete, Phase 7 complete)
- **Integrations**: 100% (Phase 5 complete)
- **Performance**: 100% (Phase 6 complete, Phase 8 complete)

> **Note**: All features are code-complete and operational in dev. Full UAT/Production activation requires configuring external service secrets (`OPENAI_API_KEY`, `SENTRY_DSN`, `MICROSOFT_*`, `REDIS_URL`) in GitHub Environment Secrets — see Q2 2026 milestones in ROADMAP.md.

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
- [x] 7.2: Enhanced Drag-and-Drop  # BEFORE
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

### Phase-Specific / Initiative Docs
- Phase 3: `docs/PHASE3_QUICK_START.md`
- Phase 5: `docs/PHASE5_IMPLEMENTATION_REPORT.md`, `docs/PHASE5_EXECUTION_SUMMARY.md`, `docs/PHASE5_API_CONTRACT.md`
- Phase 7: `docs/PHASE7_RECOVERY_COMPLETE.md`
- V3.5/V4 planning (archived): `docs/plans/archive/V3_5_ENTERPRISE_REFACTOR_ROADMAP.md`, `docs/plans/archive/V4_0_IDEAL_STATE_GAP_ANALYSIS.md`, `docs/plans/archive/V4_0_UX_EXCELLENCE.md`

---

## Phase 10: DRY/Canonical Architecture Standardization [ ] PLANNED

**Status**: 📋 PLANNED - Evidence-based refactor from comprehensive 10-agent deep-dive audit  
**Priority**: P0 (Foundation for sustainable scaling)  
**Estimated Effort**: 180-220 hours (60+ todos across 8 tracks)  
**Target Start**: April 2026  
**Audit Date**: April 13, 2026

---

### 📊 AUDIT EXECUTIVE SUMMARY

**10 parallel deep-dive agents** analyzed the entire codebase against DRY/canonical methodology standards:

| Audit Area | Compliance | Critical Issues | Files Affected |
|------------|------------|-----------------|----------------|
| Frontend Forms | 35% | 2,640 LOC duplicate Inquiry code | 30+ modals |
| UI Components (Atomic) | 42% | 4x SearchableSelect, 1% Storybook | 276 components |
| Hooks & Services | 65% | NotificationsContext fetch(), 184 `any` | 20+ files |
| Backend Models | 42% | 8 models wrong base, timestamps chaos | 21 model files |
| Backend Views | 32% | 105+ violations, 4 missing perms | 20 views files |
| Multi-Tenant | 95% | 3 minor gaps (advisory only) | ✅ Secure |
| Mobile/Responsive | 42% | No PWA, 95 max-width violations | 238 files |
| AI Integration | 54% | 0% prompts in DB, no pgvector | 47 Python files |
| Flow Engine | 85% | Hardcoded prefix routing | 78 node types |
| Documentation/Types | 48% | 184 `any`, 24.9% return hints | 300+ files |

**Total Critical Violations**: 150+  
**Estimated Code Reduction**: 5,000+ lines (duplicate elimination)

---

### 🔴 TRACK 1: CRITICAL SECURITY & DATA INTEGRITY (Week 1)

#### 10.1.1: Backend Missing Permissions [CRITICAL]
**Severity**: 🔴 DATA LEAKAGE RISK  
**Effort**: 2 hours

**4 ViewSets with NO permission_classes:**
| File | Class | Line | Fix |
|------|-------|------|-----|
| `backend/tenant_apps/ai_assistant/views.py` | `AIFeedbackViewSet` | 671 | Add `permission_classes = [IsAuthenticated]` |
| `backend/tenant_apps/bug_reports/views.py` | `BugReportViewSet` | 10 | Add `permission_classes = [IsAuthenticated]` |
| `backend/tenant_apps/workflows/views.py` | `TenantWorkflowViewSet` | ~1300 | Verify explicit permissions |
| `backend/tenant_apps/workflows/views.py` | `UserNotificationViewSet` | ~1500 | Verify explicit permissions |

#### 10.1.2: Backend Missing Tenant Filtering [CRITICAL]
**Severity**: 🔴 CROSS-TENANT DATA EXPOSURE  
**Effort**: 4 hours

**17 ViewSets missing tenant filter in `get_queryset()`:**
- `apps/tenants/views.py:ActivityLogViewSet` - Returns `.all()`, no filter
- `tenant_apps/ai_assistant/views.py:ChatSessionViewSet` - No tenant filter
- `tenant_apps/ai_assistant/views.py:ChatMessageViewSet` - No tenant filter
- `tenant_apps/bug_reports/views.py:BugReportViewSet` - Returns `.all()`
- `apps/tenants/views.py:TenantUserViewSet` - Missing tenant scope
- Plus 12 more in invoices, customers, suppliers, plants, purchase_orders

**Fix Pattern:**
```python
def get_queryset(self):
    return self.queryset.filter(tenant=self.request.tenant)
```

#### 10.1.3: Frontend NotificationsContext fetch() Bypass [CRITICAL]
**Severity**: 🔴 BYPASSES AUTH INTERCEPTORS  
**Effort**: 3 hours

**File**: `frontend/src/contexts/NotificationsContext.tsx`

**9 direct `fetch()` calls bypassing service layer:**
- Line 161: `fetch(\`${API_BASE}/notifications/\`)`
- Line 183: `fetch(\`${API_BASE}/notifications/unread-count/\`)`
- Line 200: `fetch(\`${API_BASE}/notifications/${id}/read/\`)`
- Line 208: `fetch(\`${API_BASE}/notifications/mark-all-read/\`)`
- Line 218: `fetch(\`${API_BASE}/notifications/${id}/\`)`
- Line 230: `fetch(\`${API_BASE}/action-items/\`)`
- Line 257: `fetch(\`${API_BASE}/action-items/counts/\`)`
- Lines 307, 331: `fetch(\`${API_BASE}/notification-preferences/\`)`

**Fix**: Create `frontend/src/services/notificationsService.ts` using `apiClient`

---

### 🟠 TRACK 2: FRONTEND FORM CONSOLIDATION (Weeks 2-4)

#### 10.2.1: Eliminate Inquiry Form Duplication [HIGH]
**Severity**: 🟠 2,640 LINES DUPLICATE CODE  
**Effort**: 16 hours

**Files to Consolidate:**
| File | Lines | Action |
|------|-------|--------|
| `frontend/src/components/Inquiry/InquiryCreateModal.tsx` | 859 | **REFACTOR** → Schema-driven |
| `frontend/src/components/Inquiry/CloneInquiryModal.tsx` | 430 | **DELETE** → Use initialValues |
| `frontend/src/components/Inquiry/InquiryDetailModal.tsx` | 671 | Add edit mode support |
| `frontend/src/components/Inquiry/InquiryTemplateModal.tsx` | 680 | **DELETE** → Merge with create |

**Target**: Single `UnifiedInquiryForm` component supporting create/edit/view/clone modes

#### 10.2.2: Consolidate SearchableSelect (4 Duplicates) [HIGH]
**Severity**: 🟠 1,125 LINES DUPLICATE CODE  
**Effort**: 8 hours

**4 Implementations to Merge:**
1. `frontend/src/components/Shared/SearchableSelect.tsx` (415 LOC) - Fuse.js
2. `frontend/src/components/FormSubmission/SearchableSelect.tsx` (215 LOC) - API
3. `frontend/src/components/ui/Select.tsx` (60 LOC) - Basic
4. `frontend/src/components/Shared/MultiSelect.tsx` (195 LOC) - Array

**Target**: Single configurable `<SearchableSelect variant="local|api|multi" />`

#### 10.2.3: Standardize Validation (RHF + Zod Everywhere) [HIGH]
**Effort**: 12 hours

**Progress**: ✅ Batch 1 shipped — PR #4366 (added `useZodForm` + migrated `ScheduleCallModal` to RHF+Zod)

**Current State**: 3 validation patterns
- Pattern 1: React Hook Form + Zod (5+ files ✅)
- Pattern 2: Manual useState (20+ components ❌)
- Pattern 3: Per-field auto-save (FormSubmission ❌)

**Files Using Manual Validation:**
- `InquiryCreateModal.tsx` - 11+ useState calls
- `CreateFulfillmentModal.tsx` - Manual checks
- Plus 16+ more modals

**Target**: 100% React Hook Form + Zod

#### 10.2.4: Add Mode Support (Create/Edit/View/Clone) [MEDIUM]
**Effort**: 10 hours

**Progress**: ✅ Partial shipped — PR #4365 (UniversalEntityForm now supports clone mode)

**Current Mode Support Matrix:**
| Component | Create | Edit | View | Clone |
|-----------|--------|------|------|-------|
| UniversalEntityForm | ✅ | ✅ | ✅ | ✅ |
| All Inquiry modals | ✅ only | ❌ | ❌ | ❌ |
| All other modals | ✅ only | ❌ | ❌ | ❌ |

**Target**: All entity forms support 4 modes via single `mode` prop

---

### 🟠 TRACK 3: ATOMIC DESIGN STANDARDIZATION (Weeks 3-5)

#### 10.3.1: Create Missing Atom Components [HIGH]
**Effort**: 8 hours

**Progress**: ✅ Shipped — PR #4362 (added canonical atoms)

**Existing Atoms** (10 files): Button, Card, Icon, Select, CountrySelect, StateSelect, PhoneInput

**Atoms Delivered:**
- `frontend/src/components/ui/atoms/Input.tsx` - Text input (currently hardcoded everywhere)
- `frontend/src/components/ui/atoms/Badge.tsx` - Status indicators
- `frontend/src/components/ui/atoms/Checkbox.tsx` - Form checkboxes
- `frontend/src/components/ui/atoms/Radio.tsx` - Radio buttons
- `frontend/src/components/ui/atoms/Label.tsx` - Form labels
- `frontend/src/components/ui/atoms/Textarea.tsx` - Multi-line input

#### 10.3.2: Decompose Mega-Components [HIGH]
**Effort**: 16 hours

**Components Exceeding 300 LOC Limit:**
| File | Lines | Target |
|------|-------|--------|
| `Shared/UniversalEntityForm.tsx` | 1,188 | Split into 4 components |
| `Shared/EntityDetailModal.tsx` | 856 | Split into 3 components |
| `Layout/Header.tsx` | 300+ | Extract atoms/molecules |
| `Admin/VirtualFieldManager.tsx` | 1,000+ | Split into modules |

#### 10.3.3: Fix CSS Variable Violations [MEDIUM]
**Effort**: 4 hours

**Hardcoded Colors Found:**
- `ReportBugButton.tsx` - `rgba(0,0,0,0.15)` shadow
- Multiple files with `#` hex colors

**Missing CSS Variables:**
- `--color-primary-dark` (used but not defined)
- `--color-surface-fff` (typo)
- `--color-bg-tertiary` (used but not defined)

#### 10.3.4: Replace Inline SVGs with Icon Component [MEDIUM]
**Effort**: 6 hours

**Files with Inline SVGs:**
- `Layout/Header.tsx` - SearchIcon, LockIcon inline
- `Navigation/NavigationMenu.tsx` - ChevronIcon inline
- Multiple other components

**Target**: All icons use `<Icon name="..." />` component

---

### 🟠 TRACK 4: BACKEND SERVICE LAYER PATTERN (Weeks 3-5)

#### 10.4.1: Extract Business Logic from Views [CRITICAL]
**Effort**: 40 hours

**95% of business logic currently in views (should be 0%)**

**Top Offenders:**
| File | Lines | Issue |
|------|-------|-------|
| `tenant_apps/ai_assistant/views.py:ChatBotAPIViewSet` | 255+ | Chat logic, RLS setup, Swarm orchestration |
| `tenant_apps/workflows/views.py` | 4,135 | 6 `transaction.atomic()` blocks |
| `apps/core/views.py` | 1,145 | Token creation, entity lookup |

**Services to Create:**
- `SwarmChatService` - Extract from ChatBotAPIViewSet
- `FormFieldService` - Extract from FormStepFieldsAPIView
- `WorkflowExecutionService` - Already exists, needs expansion

#### 10.4.2: Create TenantAwareMixin for DRY perform_create [HIGH]
**Effort**: 4 hours

**40+ lines duplicated across 15+ ViewSets:**
```python
# DUPLICATED in carriers/views.py, contacts/views.py, etc.
def perform_create(self, serializer):
    tenant = None
    if hasattr(self.request, 'tenant') and self.request.tenant:
        tenant = self.request.tenant
    # ... 30+ more lines identical
```

**Target**: Single `TenantAwareMixin.perform_create()` inherited by all ViewSets

#### 10.4.3: Fix Oversized ViewSets (28 Violations) [MEDIUM]
**Effort**: 20 hours

**ViewSets > 200 Lines:**
- `apps/tenants/views.py:TenantViewSet` (388 lines)
- `apps/tenants/views.py:TenantUserViewSet` (313 lines)
- `apps/tenants/views.py:TenantConfigurationViewSet` (258 lines)
- `tenant_apps/ai_assistant/views.py:ChatBotAPIViewSet` (255+ lines)

**Target**: All ViewSets < 50 lines, delegate to services

---

### 🟠 TRACK 5: BACKEND MODELS & SERIALIZERS (Week 4)

#### 10.5.1: Standardize Timestamp Fields [CRITICAL]
**Effort**: 4 hours

**3 Different Naming Conventions Found:**
1. `created_on`/`modified_on` (TenantAwareModel standard ✓)
2. `created_at`/`updated_at` (ChatMessage, FormSubmission ✗)
3. `date_time_stamp` (Invoice, PurchaseOrder ✗)

**Files Affected:**
- `apps/core/models.py` - Mixed timestamps
- `tenant_apps/ai_assistant/models.py` - Uses `created_at`
- `tenant_apps/workflows/models.py` - Mixed timestamps
- `tenant_apps/contacts/models.py:201` - Uses `created_at`

**Target**: ALL models use `created_on`/`modified_on`

#### 10.5.2: Fix Models Using Wrong Base Class [CRITICAL]
**Effort**: 8 hours

**8 Models Should Inherit TenantAwareModel:**
| File | Model | Current | Fix |
|------|-------|---------|-----|
| `workflows/models.py:988` | FormSubmission | `models.Model` | `TenantAwareModel` |
| `workflows/models.py:1091` | FormStepSubmission | `models.Model` | `TenantAwareModel` |
| `workflows/models.py:1188` | FormSubmissionFile | `models.Model` | `TenantAwareModel` |
| `workflows/models.py:1278` | FormSubmissionEvent | `models.Model` | `TenantAwareModel` |
| `workflows/models.py:1426` | StepAssignment | `models.Model` | Remove redundant FK |
| `workflows/models.py:1570` | UserNotification | `models.Model` | Remove redundant FK |
| `workflows/models.py:1711` | UserNotificationPreferences | `models.Model` | Remove redundant FK |
| `cockpit/models.py:207` | UserWorkspaceLayout | `models.Model` | Add tenant scope |

#### 10.5.3: Add Meta Class to 20 Serializers [HIGH]
**Effort**: 6 hours

**Serializers Missing Explicit Meta:**
- `apps/core/serializers.py:UserPreferencesSerializer`
- `apps/system/serializers.py:SystemChoiceItemSerializer`
- `apps/tenants/serializers.py:TenantSerializer`
- `tenant_apps/carriers/serializers.py:CarrierSerializer`
- `tenant_apps/customers/serializers.py:CustomerSerializer`
- Plus 15 more in products, bug_reports, cockpit, fulfillments, inquiries, etc.

#### 10.5.4: Add help_text to 40+ Serializer Fields [MEDIUM]
**Effort**: 8 hours

**Fields Missing help_text (needed for frontend tooltips):**
- `carriers/serializers.py:departments_array`
- `customers/serializers.py:industry_array, preferred_protein_types`
- `products/serializers.py:description_of_product_item, namp, ub, usda`
- Plus 35+ more fields

---

### 🟠 TRACK 6: MOBILE & PWA READINESS (Weeks 5-6)

#### 10.6.1: Create PWA Manifest [CRITICAL]
**Effort**: 2 hours

**Missing Files:**
- `frontend/public/manifest.json` - PWA metadata
- `frontend/public/icon-192.png` - App icon
- `frontend/public/icon-512.png` - Splash icon
- `frontend/public/service-worker.js` - Offline support

#### 10.6.2: Fix Mobile-First CSS Violations [HIGH]
**Effort**: 12 hours

**95 max-width media queries (should use min-width):**
- `components/Calls/InquiryCallModal.tsx` - 6 violations
- `components/Inquiry/InquiryCreateModal.tsx` - 6 violations
- `components/Layout/Header.tsx` - 4 violations
- `pages/Accounting/*` - 9 violations
- Plus 70+ more

**Target**: Convert all to mobile-first `@media (min-width: ...)`

#### 10.6.3: Fix Touch Target Violations [HIGH]
**Effort**: 4 hours

**Components with < 44px touch targets:**
- `Layout/Sidebar.tsx` - nav items `height: 32px`
- `Navigation/NavigationMenu.tsx` - `min-width: 20px/18px`
- `IconPicker.tsx` - icons likely 16-24px

#### 10.6.4: Fix Horizontal Scroll Issues [MEDIUM]
**Effort**: 4 hours

**Components Causing Overflow:**
- `TenantSelector.tsx` - `min-width: 220px` breaks on <320px
- `FloatingAssistButton.tsx` - `min-width: 240px` breaks on <360px
- `FlowEditor/ConfigPanel` - `min-width: 480px` breaks on <600px

---

### 🟠 TRACK 7: AI ARCHITECTURE (Weeks 6-7)

#### 10.7.1: Create AIPrompt Database Model [CRITICAL]
**Effort**: 8 hours

**Current State**: 100% hardcoded prompts

**Hardcoded Locations:**
- `views.py:47-53` - SWARM_SYSTEM_PROMPT
- `swarm/router.py:31-100` - build_swarm_system_prompt() (70 lines)
- `swarm/agents/meat_sme.py:22-30` - SYSTEM_PROMPT
- `services/rlhf_compiler.py` - DEFAULT_SYSTEM_PROMPT

**Target Model:**
```python
class AIPrompt(TenantAwareModel):
    name = CharField()  # 'system_architect', 'meat_sme'
    role = CharField()  # 'system', 'agent', 'tool'
    content = TextField()  # The actual prompt
    version = IntegerField()
    is_active = BooleanField()
```

#### 10.7.2: Implement pgvector Queries [HIGH]
**Effort**: 12 hours

**Current State**: pgvector models exist but NO similarity search

**Evidence** (`models.py:279`):
```python
embedding = models.JSONField(
    default=list,
    help_text='Embedding vector as JSON array (pgvector optional).',  # ← Never used
)
```

**MeatSMEAgent uses keyword search:**
```python
service = UniversalSearchService(tenant=tenant)  # ← Not pgvector!
```

**Target**: Implement `SELECT * FROM tbl WHERE embedding <-> query_vec < threshold`

#### 10.7.3: Add Form-State Context to AI Widget [MEDIUM]
**Effort**: 6 hours

**Current Context** (`aiContext.ts:30-66`):
- ✅ Page path
- ✅ Active entity type/ID
- ❌ Form field values (MISSING)
- ❌ Validation errors (MISSING)
- ❌ Current workflow step (MISSING)

**Target**: AI suggestions aware of form content

---

### 🟠 TRACK 8: DOCUMENTATION & TYPE SAFETY (Weeks 7-8)

#### 10.8.1: Eliminate 184 `any` Types [HIGH]
**Effort**: 16 hours

**Top Offenders:**
| File | Count |
|------|-------|
| `components/FormSubmission/hooks/useWorkflowContext.ts` | 13 |
| `components/FlowEditor/utils/autoMappingService.ts` | 10 |
| `hooks/useFormVersioning.ts` | 9 |
| `services/workformsApi.ts` | 8 |
| `services/tenantFormService.ts` | 8 |
| Plus 88 more files... | 136 |

#### 10.8.2: Add Python Return Type Hints [HIGH]
**Effort**: 8 hours

**Current Coverage**: 24.9% (FAILING)

**Top Violators:**
- `tenant_apps/workflows/views.py` - 21 functions missing
- `tenant_apps/customers/views.py` - 2 functions
- `tenant_apps/invoices/views.py` - 2 functions
- `apps/system/permissions.py` - 2 functions

#### 10.8.3: Create Storybook Stories [MEDIUM]
**Effort**: 12 hours

**Current Coverage**: 1% (3/276 components)

**Priority Components:**
1. All atoms (10 files)
2. SearchableSelect, Modal, Form molecules
3. Key organisms

#### 10.8.4: Create GLOSSARY.md [LOW]
**Effort**: 4 hours

**Missing**: Domain terminology documentation

**Terms to Define**: workflow, node, form, tenant, invoice, supplier, inquiry, fulfillment, etc.

---

### 📋 PHASE 10 SUMMARY

| Track | Todos | Hours | Priority |
|-------|-------|-------|----------|
| Track 1: Security & Data | 3 | 9 | 🔴 CRITICAL (Week 1) |
| Track 2: Form Consolidation | 4 | 46 | 🟠 HIGH (Weeks 2-4) |
| Track 3: Atomic Design | 4 | 34 | 🟠 HIGH (Weeks 3-5) |
| Track 4: Backend Services | 3 | 64 | 🟠 HIGH (Weeks 3-5) |
| Track 5: Models/Serializers | 4 | 26 | 🟠 HIGH (Week 4) |
| Track 6: Mobile/PWA | 4 | 22 | 🟠 HIGH (Weeks 5-6) |
| Track 7: AI Architecture | 3 | 26 | 🟠 MEDIUM (Weeks 6-7) |
| Track 8: Docs/Types | 4 | 40 | 🟡 MEDIUM (Weeks 7-8) |

**TOTAL**: 29 major todos, ~267 hours (6-8 weeks with 2 developers)

### Success Metrics (Technical Debt)

| Metric | Current | Target |
|--------|---------|--------|
| Form Code Duplication | 3,500+ LOC | 0 LOC |
| SearchableSelect Implementations | 4 | 1 |
| ViewSets with Permission Classes | 92% | 100% |
| ViewSets with Tenant Filtering | 66% | 100% |
| Business Logic in Views | 95% | <5% |
| TypeScript `any` Usage | 184 | <10 |
| Mobile-First CSS Compliance | 18% | 95% |
| PWA Readiness | 0% | 100% |
| AI Prompts in Database | 0% | 100% |
| Storybook Coverage | 1% | 50%+ |

---

# 🚀 PHASE 10B: FEATURE ENHANCEMENTS & INDUSTRY BEST PRACTICES

**Status**: 📋 PLANNED - Feature gaps identified via 6-agent deep-dive  
**Priority**: P1 (Competitive differentiation)  
**Estimated Effort**: 400-500 hours (80+ todos across 10 tracks)  
**Target Start**: After Phase 10A technical debt  
**Research Date**: April 13, 2026

---

## 📊 FEATURE GAP EXECUTIVE SUMMARY

**6 parallel feature-analysis agents** compared ProjectMeats against industry leaders (Camunda, n8n, Typeform, Retool):

| Feature Area | Current Score | Industry Benchmark | Gap Priority |
|--------------|---------------|-------------------|--------------|
| Frontend Design System | 6/10 | Compound components, headless UI | 🟠 HIGH |
| Universal Forms | 7/10 | Schema-driven, conditional branching | 🔴 CRITICAL |
| Workflow Editor | 7/10 | Undo/redo ✅, parallel execution ❌ | 🔴 CRITICAL |
| Workflow Execution | 5/10 | State machines, retry policies | 🔴 CRITICAL |
| UX/Collaboration | 4/10 | Comments, @mentions, sharing | 🔴 CRITICAL |
| Backend Infrastructure | 7/10 | Job monitoring, API versioning | 🟠 HIGH |
| AI/ML Integration | 6/10 | Streaming, vector RAG, moderation | 🟠 HIGH |

**Total Missing Features**: 60+  
**Industry Leader Gap**: ~30% behind Camunda/n8n/Retool

---

## 🎯 PRIORITY 1: FRONTEND DESIGN SYSTEM (Per User Request)

### TRACK F1: Component Architecture Enhancements

#### F1.1: Headless Component Library [HIGH]
**Industry Standard**: Radix UI, Headless UI patterns - separate logic from presentation
**Effort**: 24 hours

**Current Gap**: Components tightly couple logic and UI rendering
**Target**: Create headless versions of core components

**Components to Create:**
```
frontend/src/components/headless/
├── useSelect.ts      # Select logic (open/close, selection, keyboard nav)
├── useModal.ts       # Modal logic (focus trap, escape key, overlay click)
├── useDropdown.ts    # Dropdown logic (positioning, keyboard nav)
├── useAutocomplete.ts # Autocomplete logic (filtering, highlighting)
├── useTooltip.ts     # Tooltip logic (positioning, delay, trigger)
├── useAccordion.ts   # Accordion logic (expand/collapse, keyboard)
└── index.ts          # Re-export all
```

**Benefits**:
- Swap UI without rewriting logic
- Better testability (logic isolated)
- Consistent behavior across variants

#### F1.2: Compound Component Pattern [HIGH]
**Industry Standard**: `<Select><Select.Option /></Select>` pattern
**Effort**: 16 hours

**Current Gap**: No compound component implementations
**Target**: Refactor 5 core components to compound pattern

**Priority Components:**
| Component | Current | Target |
|-----------|---------|--------|
| Select | `<Select options={[]}/>` | `<Select><Select.Option value="1">One</Select.Option></Select>` |
| Menu | Props-based | `<Menu><Menu.Item>Edit</Menu.Item></Menu>` |
| Tabs | AntD wrapper | `<Tabs><Tabs.Tab>Tab 1</Tabs.Tab></Tabs>` |
| Accordion | Props-based | `<Accordion><Accordion.Item>Content</Accordion.Item></Accordion>` |
| Form | Props-based | `<Form><Form.Field name="email"><Input /></Form.Field></Form>` |

#### F1.3: Polymorphic Component Support [MEDIUM]
**Industry Standard**: `as` prop for flexible rendering
**Effort**: 8 hours

**Target Pattern:**
```tsx
// Render Button as link
<Button as="a" href="/dashboard">Go to Dashboard</Button>

// Render Card as article
<Card as="article">Content</Card>
```

**Implementation**: Create `PolymorphicComponent` utility type

#### F1.4: Design Token System [HIGH]
**Industry Standard**: Token-based theming (spacing, typography, shadows)
**Effort**: 12 hours

**Current Gap**: Only color tokens exist
**Target**: Full token system

**Token Categories to Create:**
```typescript
// frontend/src/styles/tokens.ts
export const tokens = {
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' },
  radius: { sm: '4px', md: '8px', lg: '16px', full: '9999px' },
  shadow: { sm: '0 1px 2px...', md: '0 4px 6px...', lg: '0 10px 15px...' },
  typography: { xs: '12px', sm: '14px', md: '16px', lg: '18px', xl: '24px' },
  animation: { fast: '150ms', normal: '300ms', slow: '500ms' },
  zIndex: { dropdown: 1000, modal: 1100, tooltip: 1200, toast: 1300 },
};
```

---

## 🎯 PRIORITY 2: UNIVERSAL FORMS (Per User Request)

### TRACK F2: Form System Enhancements

#### F2.1: Repeatable Field Groups ("Add Another") [CRITICAL]
**Industry Standard**: Formik FieldArray, React Hook Form useFieldArray
**Effort**: 20 hours

**Current Gap**: No dynamic field arrays
**Use Cases**: Line items, contacts, phone numbers, addresses

**Implementation:**
```tsx
// Target API
<FieldArray name="lineItems">
  {({ fields, append, remove }) => (
    <>
      {fields.map((field, index) => (
        <LineItemRow key={field.id} index={index} onRemove={() => remove(index)} />
      ))}
      <Button onClick={() => append({ product: '', qty: 1, price: 0 })}>
        + Add Line Item
      </Button>
    </>
  )}
</FieldArray>
```

**Files to Create:**
- `frontend/src/components/Forms/FieldArray.tsx`
- `frontend/src/hooks/useFieldArray.ts`
- `frontend/src/components/FormSubmission/RepeatableFieldGroup.tsx`

#### F2.2: Conditional Step Branching [CRITICAL]
**Industry Standard**: Typeform logic jumps, JotForm conditional logic
**Effort**: 24 hours

**Current Gap**: Fixed step order only
**Target**: Dynamic step sequences based on answers

**Implementation:**
```typescript
// Step config with branching
{
  steps: [
    { id: 'type', fields: ['order_type'] },
    { 
      id: 'domestic', 
      showWhen: { field: 'order_type', equals: 'domestic' },
      fields: ['state', 'city'] 
    },
    { 
      id: 'international', 
      showWhen: { field: 'order_type', equals: 'international' },
      fields: ['country', 'customs_info'] 
    },
    { id: 'review' }  // Always shown
  ]
}
```

**Files to Create:**
- `frontend/src/components/FormSubmission/ConditionalStepRenderer.tsx`
- `frontend/src/hooks/useStepBranching.ts`

#### F2.3: Calculated Fields (Formula Engine) [HIGH]
**Industry Standard**: Excel-like formulas in form fields
**Effort**: 16 hours

**Current Gap**: No field-to-field calculations
**Target**: `total = quantity * price` auto-calculation

**Implementation:**
```typescript
// Field config
{
  name: 'total',
  type: 'calculated',
  formula: '{{quantity}} * {{unit_price}}',
  dependencies: ['quantity', 'unit_price']
}
```

**Use Cases:**
- Order totals
- Tax calculations
- Date arithmetic (days between)
- Conditional values

#### F2.4: Matrix/Grid Questions [MEDIUM]
**Industry Standard**: Survey platforms (SurveyMonkey, Typeform)
**Effort**: 12 hours

**Current Gap**: No table-like field groups
**Target**: Rating matrices, satisfaction grids

**Implementation:**
```tsx
<MatrixField
  rows={['Quality', 'Price', 'Service']}
  columns={['Poor', 'Fair', 'Good', 'Excellent']}
  type="radio" // or "checkbox"
/>
```

#### F2.5: Form Template Library [HIGH]
**Industry Standard**: Pre-built templates for common use cases
**Effort**: 16 hours

**Current Gap**: Only 1 hardcoded template
**Target**: 10+ cloneable templates

**Templates to Create:**
1. Customer Onboarding
2. Supplier Application
3. Product Inquiry
4. Order Request
5. Quality Inspection
6. Complaint/Feedback
7. Quote Request
8. Contract Review
9. Compliance Checklist
10. Employee Evaluation

---

## 🎯 PRIORITY 3: WORKFORMS/WORKFLOWS (Per User Request)

### TRACK F3: Workflow Editor Enhancements

#### F3.1: Real-Time Collaborative Editing [CRITICAL]
**Industry Standard**: Figma, Google Docs, Notion
**Effort**: 40 hours

**Current Gap**: No multi-user editing
**Target**: See who's editing, cursor presence, conflict resolution

**Implementation Components:**
- WebSocket consumer for workflow room (extend existing `WorkflowCollaborationConsumer`)
- Yjs/Automerge CRDT for conflict-free editing
- Presence indicators (avatars, colored cursors)
- Typing indicators on node comments

**Files to Create:**
```
frontend/src/components/FlowEditor/
├── CollaborationProvider.tsx   # WebSocket connection manager
├── PresenceIndicator.tsx       # Show who's online
├── CursorOverlay.tsx           # Render other users' cursors
├── ConflictResolver.tsx        # Handle merge conflicts
└── hooks/useCollaboration.ts   # Hook for collaboration state
```

#### F3.2: Workflow Version Diff View [HIGH]
**Industry Standard**: Git diff, Notion version history
**Effort**: 16 hours

**Current Gap**: No visual comparison between versions
**Target**: Side-by-side diff of workflow definitions

**Implementation:**
- JSON-diff library for node/edge changes
- Visual highlighting (added=green, removed=red, changed=yellow)
- Restore/rollback capability

#### F3.3: Node Comments & Discussion Threads [HIGH]
**Industry Standard**: Figma comments, Miro notes
**Effort**: 20 hours

**Current Gap**: Only UtilityNode comment type (no discussions)
**Target**: Per-node comment threads with @mentions

**Implementation:**
```tsx
<NodeCommentThread nodeId="node_123">
  <Comment author="john@example.com" timestamp="2026-04-13">
    @jane Should this node trigger on weekends?
  </Comment>
  <CommentReply>...</CommentReply>
</NodeCommentThread>
```

### TRACK F4: Workflow Execution Engine Enhancements

#### F4.1: Parallel Execution Backend [CRITICAL]
**Industry Standard**: Temporal, Camunda parallel gateways
**Effort**: 32 hours

**Current Gap**: ParallelPathNode exists in UI but backend executes sequentially
**Target**: True parallel branch execution

**Implementation:**
- Celery task groups for parallel branches
- Sync barrier node (wait for all branches)
- Error handling per branch (continue vs fail-all)

#### F4.2: Retry Strategy & Dead Letter Queue [CRITICAL]
**Industry Standard**: Exponential backoff, DLQ for inspection
**Effort**: 16 hours

**Current Gap**: Only boolean `continue_on_error` flag
**Target**: Configurable retry policies

**Retry Config:**
```python
class RetryPolicy:
    max_attempts: int = 3
    backoff_type: str = 'exponential'  # or 'fixed'
    initial_delay_seconds: int = 60
    max_delay_seconds: int = 3600
    retry_on_exceptions: list = ['TimeoutError', 'ConnectionError']
```

#### F4.3: Workflow Timeout Enforcement [HIGH]
**Industry Standard**: Temporal workflow/activity timeouts
**Effort**: 12 hours

**Current Gap**: WaitStateNode has deadline config but not enforced
**Target**: Hard timeouts with escalation

**Implementation:**
- Celery task with `time_limit` and `soft_time_limit`
- Timeout events trigger escalation workflow
- Dashboard shows timed-out workflows

#### F4.4: HTTP Request Node [HIGH]
**Industry Standard**: n8n HTTP node, Zapier webhooks
**Effort**: 16 hours

**Current Gap**: No generic HTTP/REST node type
**Target**: Call external APIs from workflows

**Config:**
```json
{
  "type": "http_request",
  "method": "POST",
  "url": "https://api.example.com/orders",
  "headers": { "Authorization": "Bearer {{secret.api_key}}" },
  "body": { "order_id": "{{workflow.order_id}}" },
  "retry": { "max_attempts": 3, "backoff": "exponential" }
}
```

### TRACK F5: Workflow Monitoring Enhancements

#### F5.1: My Tasks Dashboard [CRITICAL]
**Industry Standard**: Asana, Monday.com task views
**Effort**: 20 hours

**Current Gap**: StepAssignment model exists but no user-facing queue
**Target**: "My Pending Actions" dashboard

**Features:**
- Filter by: workflow, priority, due date
- Sort by: oldest first, due soon, priority
- Quick actions: approve, reject, reassign
- Notifications integration

#### F5.2: SLA Framework [HIGH]
**Industry Standard**: ServiceNow, Zendesk SLA management
**Effort**: 24 hours

**Current Gap**: Zero SLA implementation
**Target**: Define, track, and alert on SLAs

**Implementation:**
```python
class WorkflowSLA(TenantAwareModel):
    workflow = ForeignKey(TenantWorkflow)
    name = CharField()  # "Quote Response"
    target_hours = IntegerField()  # 24
    warning_threshold_percent = IntegerField()  # 80 (warn at 19.2 hours)
    escalation_to = ForeignKey(User)
    breach_action = CharField()  # 'notify', 'reassign', 'escalate'
```

#### F5.3: Workflow Analytics Dashboard [MEDIUM]
**Industry Standard**: Camunda Optimize, Power BI
**Effort**: 20 hours

**Current Gap**: Partial metrics exist, no unified dashboard
**Target**: Executive-level workflow insights

**Metrics:**
- Active/completed/failed workflow counts
- Average completion time by workflow type
- Bottleneck detection (slowest steps)
- User productivity (tasks completed per user)
- Error rate by node type

---

## 🎯 PRIORITY 4: UX & COLLABORATION

### TRACK F6: Collaboration Features

#### F6.1: Entity Comments & @Mentions [CRITICAL]
**Industry Standard**: Salesforce Chatter, HubSpot activity
**Effort**: 24 hours

**Current Gap**: Only StepNotes for forms, no general commenting
**Target**: Comment on any entity (Customer, Order, Supplier)

**Implementation:**
```python
class Comment(TenantAwareModel):
    content_type = ForeignKey(ContentType)  # Generic relation
    object_id = UUIDField()
    body = TextField()
    mentions = ManyToManyField(User)  # @mentioned users
    parent = ForeignKey('self', null=True)  # For replies
    resolved_at = DateTimeField(null=True)  # For actionable comments
```

**Frontend:**
- Rich text editor with @mention autocomplete
- Comment thread component
- Notification on mention

#### F6.2: Entity Sharing & Permissions [HIGH]
**Industry Standard**: Google Docs sharing, Notion permissions
**Effort**: 20 hours

**Current Gap**: WorkflowSharing exists but not generalized
**Target**: Share any entity with specific users/roles

**Permissions Levels:**
- Viewer (read-only)
- Commenter (read + comment)
- Editor (read + write)
- Admin (full control + share)

#### F6.3: Global Keyboard Shortcuts Modal [MEDIUM]
**Industry Standard**: VS Code, Figma shortcut overlay
**Effort**: 8 hours

**Current Gap**: Only flow editor has shortcut modal
**Target**: App-wide discoverable shortcuts

**Implementation:**
- Press `?` to open shortcut overlay
- Categorized by section (Navigation, Actions, Forms)
- Searchable
- Print/export capability

### TRACK F7: Data Table Enhancements

#### F7.1: Column Customization [HIGH]
**Industry Standard**: Airtable, Notion tables
**Effort**: 12 hours

**Current Gap**: Fixed columns
**Target**: Show/hide/reorder columns per user

**Implementation:**
- Column visibility checkboxes
- Drag-and-drop reorder
- Save to localStorage per table
- Reset to default option

#### F7.2: Saved Views/Filters [HIGH]
**Industry Standard**: Salesforce list views, Airtable views
**Effort**: 16 hours

**Current Gap**: No saved filter presets
**Target**: Name and save filter combinations

**Implementation:**
```typescript
interface SavedView {
  id: string;
  name: string;  // "My Active Customers"
  filters: FilterConfig[];
  sort: SortConfig;
  columns: ColumnConfig[];
  isDefault: boolean;
  isShared: boolean;  // Share with team
}
```

#### F7.3: Bulk Actions [HIGH]
**Industry Standard**: Gmail bulk select, Notion multi-select
**Effort**: 12 hours

**Current Gap**: Only FlowEditor has batch operations
**Target**: Multi-select rows for bulk actions

**Actions:**
- Delete selected
- Update field on selected
- Export selected
- Assign to user
- Tag/label

---

## 🎯 PRIORITY 5: BACKEND INFRASTRUCTURE

### TRACK F8: API & Integration Enhancements

#### F8.1: API Versioning [CRITICAL]
**Industry Standard**: Stripe `/v1/`, GitHub Accept header
**Effort**: 8 hours

**Current Gap**: No versioning strategy
**Target**: URL-based versioning with deprecation policy

**Implementation:**
- Add `/api/v1/` prefix to all endpoints
- Version header: `API-Version: 2026-04-01`
- Deprecation warnings in response headers

#### F8.2: Celery Monitoring Dashboard [HIGH]
**Industry Standard**: Flower, custom admin views
**Effort**: 8 hours

**Current Gap**: No job visibility
**Target**: Real-time job monitoring

**Options:**
- Deploy Flower (10-minute setup)
- Custom Django admin dashboard
- Integrate with Sentry for failures

#### F8.3: Usage Metering & Quotas [HIGH]
**Industry Standard**: Stripe metering, AWS usage tracking
**Effort**: 24 hours

**Current Gap**: No usage limits or billing integration
**Target**: Track and enforce tier limits

**Metered Dimensions:**
- API calls per month
- Workflow executions
- Storage (GB)
- AI chat messages
- Users per tenant

### TRACK F9: AI/ML Enhancements

#### F9.1: Streaming AI Responses [CRITICAL]
**Industry Standard**: ChatGPT, Claude streaming
**Effort**: 16 hours

**Current Gap**: No SSE/WebSocket streaming
**Target**: Real-time token streaming

**Implementation:**
- Server-Sent Events endpoint
- OpenAI `stream=True` parameter
- Frontend streaming UI component

#### F9.2: Vector Similarity Search (pgvector) [HIGH]
**Industry Standard**: Pinecone, Weaviate, pgvector
**Effort**: 16 hours

**Current Gap**: Embeddings stored but only keyword search used
**Target**: Semantic search with vector similarity

**Implementation:**
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector column
ALTER TABLE ai_assistant_vectormemory 
  ADD COLUMN embedding_vec vector(1536);

-- Similarity query
SELECT * FROM ai_assistant_vectormemory
WHERE embedding_vec <-> query_vector < 0.3
ORDER BY embedding_vec <-> query_vector
LIMIT 10;
```

#### F9.3: AI Output Moderation [HIGH]
**Industry Standard**: OpenAI Moderation API
**Effort**: 8 hours

**Current Gap**: No content filtering
**Target**: Filter harmful AI responses

**Implementation:**
- Call OpenAI Moderation API before returning response
- Block categories: hate, violence, self-harm, sexual
- Log flagged responses for review

---

## 📋 PHASE 10B SUMMARY

| Track | Description | Todos | Hours | Priority |
|-------|-------------|-------|-------|----------|
| F1 | Frontend Design System | 4 | 60 | 🔴 P1 |
| F2 | Universal Forms | 5 | 88 | 🔴 P1 |
| F3 | Workflow Editor | 3 | 76 | 🔴 P1 |
| F4 | Workflow Execution | 4 | 76 | 🔴 P1 |
| F5 | Workflow Monitoring | 3 | 64 | 🟠 P2 |
| F6 | Collaboration | 3 | 52 | 🔴 P1 |
| F7 | Data Tables | 3 | 40 | 🟠 P2 |
| F8 | Backend Infrastructure | 3 | 40 | 🟠 P2 |
| F9 | AI/ML | 3 | 40 | 🟠 P2 |

**TOTAL**: 31 major todos, ~536 hours (12-16 weeks with 2 developers)

---

### Success Metrics (Feature Enhancements)

| Metric | Current | Target | Industry Benchmark |
|--------|---------|--------|-------------------|
| Design System Score | 6/10 | 9/10 | Radix UI, Headless UI |
| Form Builder Features | 7/10 | 9/10 | Typeform, JotForm |
| Workflow Editor Features | 7/10 | 9/10 | Camunda, n8n |
| Collaboration Score | 4/10 | 8/10 | Notion, Figma |
| UX Feature Completeness | 6/10 | 9/10 | Retool, Monday.com |
| AI Integration Depth | 6/10 | 9/10 | ChatGPT, Jasper |

---

### Dependency Graph (Phase 10B)

```
F1 (Design System) ─────────────────────────────────┐
                                                    ▼
F2 (Forms) ──────┬──────────────────────────► F6 (Collaboration)
                 │                                  │
F3 (Editor) ─────┤                                  │
                 │                                  │
F4 (Execution) ──┴─────► F5 (Monitoring) ◄──────────┘
                                 │
F8 (Backend) ────────────────────┤
                                 │
F9 (AI) ─────────────────────────┘
```

### Implementation Order (Recommended)

**Sprint 1-2 (Weeks 1-4)**: Foundation
- F1.4 Design Token System
- F2.1 Repeatable Field Groups
- F4.2 Retry Strategy & DLQ
- F8.1 API Versioning

**Sprint 3-4 (Weeks 5-8)**: Core Features
- F2.2 Conditional Step Branching
- F3.1 Real-Time Collaboration
- F4.1 Parallel Execution Backend
- F6.1 Entity Comments

**Sprint 5-6 (Weeks 9-12)**: Enhancement
- F1.1 Headless Component Library
- F5.1 My Tasks Dashboard
- F7.1-F7.3 Data Table Enhancements
- F9.1 Streaming AI Responses

**Sprint 7-8 (Weeks 13-16)**: Polish
- F1.2 Compound Components
- F3.2 Version Diff View
- F5.2 SLA Framework
- F9.2 Vector Similarity Search

---

# 🎯 PHASE 10: STRATEGIC ROADMAP & DELIVERABLES

## Executive Summary

**Project**: ProjectMeats Phase 10 - DRY/Canonical Architecture Standardization  
**Duration**: 20 weeks (5 months)  
**Total Effort**: ~1,160 hours (~29 developer-weeks)  
**ROI**: +50% developer velocity, -70% production incidents, +40% user engagement  

### Business Impact

| Metric | Current State | Target State | Impact |
|--------|---------------|--------------|--------|
| **Mobile Usability** | Broken (<768px) | Full responsive | +50% addressable market |
| **Search Relevance** | Poor (no fuzzy match) | Top 3 relevant 90% | +35% user engagement |
| **Production Incidents** | ~8/month | <2/month | -75% support burden |
| **Developer Velocity** | 6 features/sprint | 10 features/sprint | +67% delivery speed |
| **Form Abandonment** | ~30% estimated | <10% | +20% conversion |
| **Workflow Adoption** | 40% (editor crashes) | 80%+ | +100% automation usage |

### Strategic Priorities (Ranked by ROI × Urgency)

1. **P0 CRITICAL** (Weeks 1-6): Security + Mobile + Stability
2. **P1 HIGH** (Weeks 7-12): Technical Debt + DRY Architecture
3. **P2 MEDIUM** (Weeks 13-16): Feature Enhancements
4. **P3 POLISH** (Weeks 17-20): Advanced Features + Documentation

---

## 📊 COMPREHENSIVE RISK REGISTER

### Security Risks (MUST FIX WEEK 0-1)

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| **SEC-1** | Cross-Tenant Data Exposure (17 ViewSets missing tenant filters) | 70% | CRITICAL | Add `filter(tenant=request.tenant)` to all `get_queryset()` | Backend |
| **SEC-2** | Missing Permission Classes (4 ViewSets) | 85% | CRITICAL | Add `permission_classes = [IsAuthenticated]` | Backend |
| **SEC-3** | NotificationsContext bypasses JWT (9 raw fetch calls) | 95% | HIGH | Create notificationsService.ts using apiClient | Frontend |
| **SEC-4** | Multi-Tenant Isolation Tests SKIPPED in CI | 100% | CRITICAL | Enable 8 stub tests in `test_isolation.py` | Backend |

### Technical Debt Risks

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| **TD-1** | Form Duplication Refactor Regression (2,640 LOC) | 60% | HIGH | Write E2E tests for each mode BEFORE refactoring | Frontend |
| **TD-2** | View → Service Extraction API Breaks | 55% | HIGH | Document API contracts first; gradual rollout with feature flag | Backend |
| **TD-3** | Timestamp Field Migration Chaos (3 conventions) | 65% | MEDIUM | Phase migrations: add → read → remove over 3 weeks | Backend |
| **TD-4** | SearchableSelect Consolidation Regression | 40% | MEDIUM | Create comprehensive test matrix for all variants | Frontend |
| **TD-5** | Type Safety Bikeshedding (184 `any` types) | 45% | LOW | Batch by FILE not by type; target 80% not 100% | Frontend |

### Execution Risks

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| **EX-1** | Refactoring without tests (10.9% frontend coverage) | HIGH | CRITICAL | Write tests BEFORE refactoring any component | Both |
| **EX-2** | Mobile CSS breaks desktop (238 files affected) | 50% | MEDIUM | Test on REAL devices, not just Chrome DevTools | Frontend |
| **EX-3** | Feature creep vs core stability | HIGH | HIGH | Strict backlog prioritization; defer P3 if needed | PM |
| **EX-4** | Workflow Editor Crashes (8,700 untested lines) | MEDIUM | HIGH | Add E2E tests before any FlowEditor changes | Frontend |

---

## 📅 SPRINT-BY-SPRINT TIMELINE

### 🔴 WEEK 0: SECURITY BLOCKERS (MANDATORY BEFORE PHASE 10)

**Duration**: 1 day (6 hours)  
**Status**: BLOCKING - Cannot proceed until complete

| Task | Hours | Deliverable | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Fix 17 ViewSets missing tenant filters | 3 | All `get_queryset()` methods filter by `tenant=request.tenant` | No cross-tenant data in any API response |
| Add permission_classes to 4 ViewSets | 1 | AIFeedbackViewSet, BugReportViewSet, TenantWorkflowViewSet, UserNotificationViewSet have `[IsAuthenticated]` | Unauthenticated requests return 401 |
| Enable multi-tenant isolation tests | 2 | Remove `@skip` from `test_isolation.py`, implement 8 stub tests | Tests pass in CI pipeline |

**Exit Criteria**: All security tests pass; no unauthenticated API access possible

---

### 🔴 SPRINT 1 (Weeks 1-2): FOUNDATION SECURITY & MOBILE

**Theme**: "Make it safe and usable on phones"  
**Effort**: 80 hours

#### Deliverables

| ID | Deliverable | Hours | Expected Result |
|----|-------------|-------|-----------------|
| S1.1 | NotificationsService Migration | 8 | All 9 fetch() calls replaced with apiClient; JWT refresh works |
| S1.2 | Type-check CI Gate | 4 | `npm run type-check` required on all PRs; 0 errors to merge |
| S1.3 | Cockpit Mobile Responsive | 16 | Dashboard usable <768px; touch targets ≥44px; no horizontal scroll |
| S1.4 | CRUD Forms Mobile | 20 | Orders, Inquiries, Customers forms work on iPhone SE (375px) |
| S1.5 | API Error Standardization | 12 | All errors use ErrorResponse interface; 400 vs 500 vs 503 distinct |
| S1.6 | Graceful AI Degradation | 8 | Missing OPENAI_API_KEY shows friendly message, not 500 |
| S1.7 | Graceful Email Degradation | 12 | Email errors have structured codes; reconnect CTA for auth failures |

#### Acceptance Criteria

- [x] Zero unauthenticated API access possible (DRF default permission is IsAuthenticated; public endpoints are explicitly allowlisted + tested)
- [x] Mobile users can create orders from field (iPhone SE 375px) (E2E: mobile_purchase_orders_create, mobile_inquiries_375, mobile_sales_orders_create; PRs #4397, #4399, #4401)
- [x] Mobile users can create customers from field (iPhone SE 375px) (E2E: mobile_customers_create; PR #4406)
- [x] TypeScript errors block PR merge (PR validation includes `npm run type-check`)
- [x] Missing OpenAI key shows "AI not configured" message, not crash (stable 503 error contract + frontend details messaging)
- [x] Email sync errors show actionable guidance (Sync Now returns structured code/error_code + reconnect CTA; tests in apps.integrations)

#### Testing Requirements

- [x] Add Playwright tests for mobile viewport (375px, 768px) (frontend/e2e/mobile_viewports.spec.ts; PR #4382)
- [x] Add API contract tests for error responses (PR #4381; upload 4xx mapping PR #4379)
- [x] Add NotificationsContext unit tests (Vitest: `frontend/src/contexts/NotificationsContext.test.tsx`, 14 tests; stderr noise cleaned in PR #4388)

---

### 🟠 SPRINT 2 (Weeks 3-4): CORE TECHNICAL DEBT

**Theme**: "Consolidate duplicate code"  
**Effort**: 88 hours

#### Deliverables

| ID | Deliverable | Hours | Expected Result |
|----|-------------|-------|-----------------|
| S2.1 | SearchableSelect Consolidation | 24 | 4 implementations → 1 component with variant prop |
| S2.2 | Atomic Design: 6 Core Atoms | 16 | Button, Input, Badge, Tag, Avatar, Spinner in component library |
| S2.3 | FormField Registry Foundation | 24 | Type-safe field registry with JSON Schema validation |
| S2.4 | TenantAwareModel Migration (8 models) | 16 | FormSubmission, ChatMessage, etc. use TenantAwareModel |
| S2.5 | Timestamp Standardization (Phase 1) | 8 | Add `created_at`/`updated_at` aliases to all models |

#### Acceptance Criteria

- [ ] SearchableSelect variants: local, API, static, multi-value all work
- [ ] 6 atoms have Storybook stories
- [ ] FormField registry generates fields from JSON Schema
- [ ] All 8 models inherit TenantAwareModel
- [ ] No Django model uses `created_on` or `date_time_stamp` directly

#### Testing Requirements

- [x] Unit tests for SearchableSelect variants (local, API, static, multi-value) (PR #4410)
- [ ] Storybook visual regression tests for atoms
- [ ] Integration tests for FormField registry

---

### 🟠 SPRINT 3-4 (Weeks 5-8): DRY ARCHITECTURE

**Theme**: "Single source of truth for everything"  
**Effort**: 160 hours

#### Deliverables

| ID | Deliverable | Hours | Expected Result |
|----|-------------|-------|-----------------|
| S3.1 | Inquiry Form Consolidation | 32 | 4 modals (2,640 LOC) → 1 InquiryForm with mode prop |
| S3.2 | Service Layer Extraction (workflows) | 40 | 6 transaction.atomic blocks → workflow_service.py |
| S3.3 | Service Layer Extraction (AI) | 24 | ChatBotAPIViewSet business logic → ai_service.py |
| S3.4 | Mega-Component Decomposition | 32 | InquiryCreateModal (859→300 LOC), FormBuilder (457→200 LOC) |
| S3.5 | FlowEditor Node Registry | 16 | Hardcoded prefix routing → NodeRegistry with type-safe registration |
| S3.6 | API Client Standardization | 16 | All frontend API calls use apiClient; zero raw fetch/axios |

#### Acceptance Criteria

- [ ] InquiryForm supports modes: create, edit, clone, template
- [ ] workflow_service.py handles all workflow business logic
- [ ] ai_service.py handles all AI business logic
- [ ] InquiryCreateModal < 400 LOC
- [ ] NodeRegistry supports dynamic node type registration
- [ ] `grep -r "fetch\(" frontend/src/` returns 0 results (except apiClient)

#### Testing Requirements

- [ ] E2E tests for Inquiry create/edit/clone/template workflows
- [ ] Unit tests for workflow_service.py
- [ ] Unit tests for ai_service.py
- [ ] Integration tests for NodeRegistry

---

### 🟡 SPRINT 5-6 (Weeks 9-12): FEATURE ENHANCEMENTS

**Theme**: "Match industry leaders"  
**Effort**: 144 hours

#### Deliverables

| ID | Deliverable | Hours | Expected Result |
|----|-------------|-------|-----------------|
| S5.1 | Repeatable Field Groups | 32 | FieldArray component with add/remove/reorder |
| S5.2 | Conditional Step Branching | 24 | Branch node type with condition editor |
| S5.3 | Parallel Workflow Execution | 32 | Backend executes ParallelPathNode branches concurrently |
| S5.4 | Entity Comments System | 24 | Comments on any entity with @mentions |
| S5.5 | Search Ranking Algorithm | 16 | Fuzzy match + recency boost + relevance scoring |
| S5.6 | Workflow Retry & DLQ | 16 | Failed steps retry 3x; dead letter queue for failures |

#### Acceptance Criteria

- [ ] Form builder can create repeatable field groups
- [ ] Workflow editor supports if/else branching
- [ ] Parallel workflow paths execute in separate Celery tasks
- [ ] Entity detail pages have comment thread
- [ ] Search returns relevant results for typos ("bef" → "beef")
- [ ] Failed workflow steps retry automatically; failures visible in queue

#### Testing Requirements

- [ ] Unit tests for FieldArray validation
- [ ] E2E tests for conditional workflow execution
- [ ] Load tests for parallel execution (10 concurrent branches)
- [ ] Integration tests for comment system with notifications

---

### 🟢 SPRINT 7-8 (Weeks 13-16): ADVANCED FEATURES

**Theme**: "Delight power users"  
**Effort**: 128 hours

#### Deliverables

| ID | Deliverable | Hours | Expected Result |
|----|-------------|-------|-----------------|
| S7.1 | Real-Time Workflow Collaboration | 40 | Multi-user editing with operational transforms |
| S7.2 | Version Diff View | 24 | Side-by-side comparison of workflow versions |
| S7.3 | My Tasks Dashboard | 24 | Unified view of assigned tasks across all workflows |
| S7.4 | Streaming AI Responses | 16 | SSE-based AI chat with typing indicators |
| S7.5 | Data Table Enhancements | 24 | Column resize, custom views, bulk actions |

#### Acceptance Criteria

- [ ] 2 users can edit same workflow with conflict resolution
- [ ] Version history shows visual diff of changes
- [ ] Task dashboard shows SLA warnings and filters
- [ ] AI responses stream character-by-character
- [ ] Data tables support column resize and saved views

#### Testing Requirements

- [ ] E2E tests for multi-user editing scenarios
- [ ] Visual regression tests for diff view
- [ ] Performance tests for streaming (1000 tokens/sec)

---

### 🔵 SPRINT 9-10 (Weeks 17-20): POLISH & DOCUMENTATION

**Theme**: "Production-ready excellence"  
**Effort**: 96 hours

#### Deliverables

| ID | Deliverable | Hours | Expected Result |
|----|-------------|-------|-----------------|
| S9.1 | Storybook Coverage (1%→30%) | 32 | 80+ component stories with variants |
| S9.2 | Incident Response Runbook | 8 | Decision trees for database, email, auth, deployment failures |
| S9.3 | Workflow Engine Deep Dive Doc | 8 | Architecture, action executor patterns, extension guide |
| S9.4 | Frontend Development Guide | 8 | Component patterns, data fetching, adding new pages |
| S9.5 | First Feature Tutorial | 4 | End-to-end guide: model → API → frontend → deploy |
| S9.6 | Vector Similarity Search | 16 | pgvector embeddings used for semantic search |
| S9.7 | API Versioning (v2 headers) | 12 | Version negotiation via Accept-Version header |
| S9.8 | Load Testing (100 tenants) | 8 | Locust tests verify <500ms P95 with 100 concurrent tenants |

#### Acceptance Criteria

- [ ] Storybook has 80+ stories covering all major components
- [ ] New developers can debug production issues using runbook
- [ ] Workflow extension guide enables custom action development
- [ ] Tutorial takes new developer from 0 → deployed feature
- [ ] Semantic search returns contextually relevant results
- [ ] API supports v1 and v2 simultaneously
- [ ] System handles 100 tenants with <500ms P95 response time

---

## 📈 SUCCESS METRICS DASHBOARD

### Technical Health Metrics

| Metric | Current | Sprint 2 | Sprint 4 | Sprint 8 | Target |
|--------|---------|----------|----------|----------|--------|
| TypeScript `any` types | 184 | 120 | 60 | <20 | <20 |
| Frontend test coverage | 10.9% | 20% | 35% | 50% | 50% |
| Backend test coverage | 90% | 90% | 92% | 95% | 95% |
| Storybook coverage | 1% | 10% | 20% | 30% | 30% |
| Code duplication (LOC) | 6,000+ | 4,000 | 2,000 | <1,000 | <1,000 |
| API contract violations | Unknown | 0 | 0 | 0 | 0 |

### User Experience Metrics

| Metric | Current | Sprint 2 | Sprint 4 | Sprint 8 | Target |
|--------|---------|----------|----------|----------|--------|
| Mobile usability score | 2/10 | 6/10 | 8/10 | 9/10 | 9/10 |
| Search relevance (top 3) | 40% | 60% | 80% | 90% | 90% |
| Form abandonment rate | ~30% | 20% | 15% | <10% | <10% |
| Workflow editor crashes | ~5/week | 2/week | <1/week | 0 | 0 |
| P0 incidents/month | ~8 | 4 | 2 | <2 | <2 |

### Industry Benchmark Scores

| Dimension | Current | Target | Benchmark |
|-----------|---------|--------|-----------|
| Design System | 6/10 | 9/10 | Radix UI |
| Form Builder | 7/10 | 9/10 | Typeform |
| Workflow Editor | 5/10 | 9/10 | Camunda, n8n |
| Collaboration | 4/10 | 8/10 | Notion, Figma |
| AI Integration | 6/10 | 9/10 | ChatGPT |

---

## 🧪 TESTING STRATEGY FOR REFACTORING

### Pre-Refactoring Requirements

**CRITICAL RULE**: Never refactor code with <30% test coverage. Write tests FIRST.

| Component | Current Coverage | Required Before Refactor | Test Type |
|-----------|-----------------|--------------------------|-----------|
| InquiryCreateModal | 0% | 70% | E2E + Unit |
| SearchableSelect | 0% | 80% | Unit + Visual |
| UnifiedFlowEditor | 0% | 50% | E2E + Integration |
| NotificationsContext | Unit tests added (14, Vitest) | 80% | Unit + Integration |
| workflow_service.py | N/A (new) | 90% | Unit |

### Test Pyramid for Phase 10

```
                    ┌────────────────┐
                    │   E2E Tests    │  (10%) - Critical user journeys
                    │   Playwright   │  - Mobile viewports
                    └───────┬────────┘  - Cross-browser
                            │
              ┌─────────────┴─────────────┐
              │    Integration Tests      │  (30%) - API contracts
              │    Jest + Supertest       │  - Service interactions
              └─────────────┬─────────────┘  - Database operations
                            │
        ┌───────────────────┴───────────────────┐
        │           Unit Tests                  │  (60%) - Components
        │       Jest + Testing Library          │  - Services
        └───────────────────────────────────────┘  - Utilities
```

### Critical Path E2E Tests (Must Add)

1. **Workflow Execution Flow**
   - Create workflow → Add nodes → Execute → Verify completion
   - Test parallel execution with 3 branches
   - Test conditional branching with true/false paths

2. **Form Submission Flow**
   - Create form → Fill fields → Submit → Verify data
   - Test repeatable fields (add/remove/reorder)
   - Test conditional field visibility

3. **Mobile User Journeys**
   - Login on iPhone SE → Navigate cockpit → Create order
   - Search for customer → View details → Add note
   - Check tasks → Complete workflow step

---

## 📚 DOCUMENTATION REQUIREMENTS

### Critical Documentation Gaps (Must Create)

| Document | Priority | Hours | Content |
|----------|----------|-------|---------|
| `docs/runbooks/INCIDENT_RESPONSE.md` | P0 | 4 | Decision trees for database, email, auth, deployment failures |
| `docs/operations/TROUBLESHOOTING.md` | P0 | 3 | Common issues with diagnostic steps |
| `docs/getting-started/YOUR_FIRST_FEATURE.md` | P0 | 2 | Model → API → Frontend → Deploy tutorial |
| `docs/backend/WORKFLOW_ENGINE_GUIDE.md` | P1 | 4 | Architecture, action executors, extension patterns |
| `docs/frontend/DEVELOPMENT_GUIDE.md` | P1 | 3 | Component patterns, data fetching, testing |
| `docs/operations/BACKUP_RECOVERY.md` | P1 | 2 | PostgreSQL backup, disaster recovery |

### Documentation Quality Scorecard

| Criteria | Current | Target |
|----------|---------|--------|
| Getting Started | 7/10 | 9/10 |
| Architecture | 8/10 | 9/10 |
| API Reference | 5/10 | 8/10 |
| Operations/Runbooks | 2/10 | 8/10 |
| Code Documentation | 5/10 | 7/10 |
| Feature Development | 4/10 | 8/10 |
| **Overall** | **4.4/10** | **8/10** |

---

## 🔄 USER JOURNEY IMPROVEMENTS

### Priority User Journey Fixes

| Journey | Current Friction | Fix | Sprint |
|---------|------------------|-----|--------|
| **New Tenant Onboarding** | 4 separate config pages | Create setup wizard with progress indicator | S5 |
| **Inquiry Creation** | No draft/autosave | Add localStorage autosave every 30s | S2 |
| **Fulfillment Management** | No batch operations | Add bulk status update | S5 |
| **WorkForms Editor** | Steep learning curve | Add template library with one-click activation | S7 |
| **Task Delegation** | Feature not prominent | Add delegate button to task list | S5 |
| **Global Search** | Only in Cockpit ⌘K | Extend SmartSearch to all entities | S5 |

### Expected User Impact

| Improvement | User Impact | Metric |
|-------------|-------------|--------|
| Autosave forms | -70% form abandonment | Conversion rate |
| Setup wizard | -50% onboarding time | Time to first value |
| Batch operations | -50% repetitive task time | Task completion time |
| Template library | -70% editor confusion | Workflow creation rate |
| Task delegation | +30% delegation usage | Feature adoption |
| Global search | -40% time to find records | Search efficiency |

---

## 🎯 PHASE 10 DELIVERABLES SUMMARY

### Total Scope

| Category | Todos | Hours | Sprints |
|----------|-------|-------|---------|
| Security Blockers | 6 | 18 | Week 0-1 |
| Technical Debt | 29 | 267 | S1-S4 |
| Feature Enhancements | 31 | 536 | S5-S8 |
| Canonical Methodologies (10C) | 18 | 260 | Throughout |
| Documentation | 6 | 18 | S9-S10 |
| Testing Infrastructure | 8 | 64 | Throughout |
| **TOTAL** | **98** | **~1,163** | **20 weeks** |

### Milestone Checkpoints

| Milestone | Week | Gate Criteria |
|-----------|------|---------------|
| **M1: Security Complete** | 1 | Zero unauthenticated access; tenant isolation verified |
| **M2: Mobile Ready** | 4 | Cockpit + CRUD forms work on iPhone SE |
| **M3: DRY Foundation** | 8 | <2,000 LOC duplication; all services extracted |
| **M4: Feature Parity** | 12 | Industry benchmark scores ≥8/10 |
| **M5: Production Ready** | 16 | <2 P0 incidents/month; 50% test coverage |
| **M6: Excellence** | 20 | Documentation score ≥8/10; load tested for 100 tenants |

---

## 🧱 PHASE 10C — Canonical Platform Methodologies (Additive Enhancements)

This section incorporates additional DRY/canonical standards for **(1) frontend/UI**, **(2) universal forms**, and **(3) workforms/workflows (edit + execute + track)**, plus platform-wide methodologies (contracts, mobile readiness, AI).

### 10C.0 Recommended Implementation Order

1) **Contract-first OpenAPI + type generation** (prevents drift everywhere)
2) **Unified Forms manifest + density + permissions overlay** (biggest frontend DRY multiplier)
3) **Workflow tracking primitives** (assignments + event store + versioning)
4) **Reliability primitives** (idempotency, soft delete, export)
5) **Tenant branding tokens** (makes UI reuse truly multi-tenant)
6) **Mobile wrapper strategy** (WORA + push notification readiness)
7) **AI reasoning engine** (RAG + tool use + prompt registry + doc understanding)

### 10C.1 Contract-First API + Type Generation (SSOT)

**Goal**: one source of truth for API shape → backend validation + docs + frontend types/hook usage.

**Methodology**:
- **Backend**: standardize OpenAPI generation (DRF Spectacular style) and treat it as the contract.
- **Frontend**: generate TypeScript types/clients from OpenAPI (e.g., Orval-style approach) and ban hand-rolled request/response types for those endpoints.

**Acceptance Criteria**:
- OpenAPI spec is generated in CI.
- Frontend uses generated types for critical domains (inquiries, orders, workflows, workforms).
- Contract drift becomes a CI failure (not a production bug).

### 10C.2 Unified Forms: Mode + Context + Sections (Simplified/Basic/Detailed)

**Goal**: one form definition renders correctly across:
- container: modal / inline / full-page
- mode: create / edit / view(read-only)
- density: simplified(key fields) / basic(common fields) / detailed(all)

**Methodology**:
- **Field manifest / schema** defines field importance and section membership.
- **Container/Presenter split**: smart controller handles data + mutations; presentational form renders sections/fields.
- **Permission overlay**: per field/section `visible_to` + `editable_by` based on tenant role.

**Acceptance Criteria**:
- Any entity form can render in 3 densities without duplicating JSX.
- View-mode is truly read-only (no hidden mutations, no onChange side effects).

### 10C.3 Workforms/Workflows: Execution + Tracking as First-Class

**Goal**: enterprise-grade tracking for:
- pending actions (current user vs others)
- role/user assignment
- step transitions
- triggers/outputs/conditions
- auditability and replay

**Canonical additions**:
1) **Inbox/Outbox pattern** via assignment/task records (blocking vs non-blocking tasks)
2) **Event store** (FlowEvent / ExecutionEvent) capturing transitions with snapshots
3) **Rule engine** for conditions/triggers (json-logic style rules mirrored backend/frontend)
4) **Versioned blueprint**: submissions always reference a definition version

**Acceptance Criteria**:
- “Pending for X” view works without ad-hoc logic.
- Every step transition produces an immutable event record.
- A workflow instance can be reconstructed for audits.

### 10C.4 Reliability Primitives

- **Idempotency keys** for all state-changing workflow/form submissions (prevents double-click/double-submit).
- **Soft deletes** for critical definitions/instances + **tenant export** (data portability/compliance).

### 10C.5 Tenant Branding via Design Tokens

**Goal**: one component codebase, tenant-specific branding.

**Methodology**:
- Store tenant theme tokens in tenant config.
- Hydrate CSS variables at runtime (no hardcoded colors).

### 10C.6 Mobile Readiness (WORA)

**Goal**: “write once, render anywhere” for web + mobile browser + (future) iOS/Android wrapper.

**Methodology**:
- Mobile-first UI for core journeys.
- Prefer a wrapper strategy (Capacitor-style) for fastest reuse.
- Add push notifications for workflow assignments (FCM) when ready.

### 10C.7 AI Ahead of Industry Leaders (Contextual Reasoning Engine)

**Goal**: AI as a functional layer (not a chatbot): schema-aware suggestions + tool use + doc understanding.

**Methodology**:
- **RAG + tool use**: AI reads current schema/blueprint and proposes valid values/actions.
- **Prompt registry**: prompts are versioned data (not hardcoded strings) with tenant overrides.
- **Doc understanding pipeline**: attachments → extraction → schema mapping → “confirm suggested fields”.

**Acceptance Criteria**:
- AI suggestions can be applied as real UI actions (button-driven mutations).
- Missing AI secrets degrades gracefully (no 500s).

---

**Master Plan Version**: 3.1.0  
**Strategic Roadmap Added**: 2026-04-13  
**Phase 10C Added**: 2026-04-13  
**Maintained By**: Development Team + AI Assistants  
**Next Review**: May 15, 2026  
**Phase 10 Estimated Completion**: August 2026

---
