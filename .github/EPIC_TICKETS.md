# EPIC_TICKETS.md

> **Status:** ordered execution backlog  
> **Canonical priority source:** root `MASTER_PLAN.md`  
> **Standards:** `.github/SDLC_PROTOCOLS.md`

## Operating rules

1. This file is execution-ordered from top to bottom.
2. Always take the **first unchecked ticket**.
3. Only the first unchecked ticket should be marked **Status: Ready**.
4. Cross-epic dependency tickets must be placed after their final blocker in file order, even if their epic heading appeared earlier.
5. If a prerequisite is incomplete, the next ticket must be **Status: Blocked** with an explicit blocker.
6. After merge, append shipped evidence to `.github/MASTER_PLAN.md` and then check the ticket.

## Phase 14 - General Availability (GA) & Enterprise Hardening

### Epic GA-01 - Day 0 ETL pipeline

- [x] **GA-01.1 day-0-etl-source-contracts**
  - **Status:** Shipped (PR #4813)
  - **Why now:** GA is blocked until historical ERP data can enter the Golden Schema without manual re-keying or production side effects.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 1
  - **Scope:** Inventory the actual legacy source shapes (XLSX/CSV/export files), define the canonical field mapping into Golden Schema headers, mixins, and line items, and create the dry-run/reporting contract for the import path.
  - **Non-goals:** No bulk writes into transactional tables yet; no UI work.
  - **Primary domain:** backend/data
  - **Likely touched paths:** `backend/apps/core/services/etl/`, `backend/apps/core/management/commands/`, `backend/apps/core/tests/fixtures/etl/`, `docs/runbooks/GOLDEN_SCHEMA_ETL.md`, `MASTER_PLAN.md`
  - **Dependencies:** None
  - **Blockers:** None
  - **Acceptance criteria:**
    1. A deterministic mapping contract exists for master data plus transactional headers/line items, including side-effect suppression rules.
    2. The ETL design names the import journal/error-reporting shape and how tenant ownership is asserted per batch.
    3. A future AI session can identify the first command/service/test files to create without guessing.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `cd backend && python manage.py test apps.core apps.tenants`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High; ETL batches must be tenant-explicit and management-command ORM must run inside asserted tenant context.
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert the ETL contract/runbook scaffolding only; no imported rows should exist from this ticket.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **GA-01.2 etl-journal-and-dry-run-engine**
  - **Status:** Shipped (PR #4814)
  - **Why now:** Historical imports need restart-safe journaling and dry-run output before any write-capable importer is safe.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 1
  - **Scope:** Add the import journal/payload recording layer plus dry-run transformation engine that validates rows, normalizes identifiers, and reports create/update/skip/error counts without firing signals or side effects.
  - **Non-goals:** No final transactional import orchestration yet.
  - **Primary domain:** backend/data
  - **Likely touched paths:** `backend/apps/core/models.py`, `backend/apps/core/services/etl/`, `backend/apps/core/management/commands/import_golden_legacy_data.py`, new migrations, `backend/apps/core/tests/`
  - **Dependencies:** GA-01.1
  - **Blockers:** None
  - **Acceptance criteria:** Dry-run mode produces deterministic journals/reports, does not emit emails/webhooks, and can be rerun safely on the same input set.
  - **Validation commands:** `cd backend && python manage.py test apps.core`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Leave additive journal schema in place if needed, but disable the command path and revert service wiring.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **GA-01.3 etl-master-data-import-pass**
  - **Status:** Shipped (PR #4816)
  - **Why now:** Transactional imports will fail or duplicate data unless carriers, suppliers, customers, contacts, products, plants, and locations import first.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 1
  - **Scope:** Implement the first write-capable ETL pass for master/reference entities with tenant-aware matching, dedupe keys, audit-safe attribution, and fixture-backed regression coverage.
  - **Non-goals:** No purchase/sales/invoice rows yet.
  - **Primary domain:** backend/data
  - **Likely touched paths:** `backend/apps/core/services/etl/`, `backend/tenant_apps/{suppliers,customers,contacts,products,locations,plants}/`, `backend/apps/core/tests/fixtures/etl/`, `docs/runbooks/GOLDEN_SCHEMA_ETL.md`
  - **Dependencies:** GA-01.2
  - **Blockers:** None
  - **Acceptance criteria:** Master data imports are idempotent per tenant, import journals show matched/created/skipped counts, and no cross-tenant linking is possible.
  - **Validation commands:** `cd backend && python manage.py test apps.core apps.tenants`; `cd backend && python manage.py test tenant_apps.contacts`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert importer code and use journal output to delete or reconcile any seeded test rows before reattempting.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **GA-01.4 etl-transactional-import-and-reconciliation**
  - **Status:** Shipped (PR #4817)
  - **Why now:** The final launch blocker is migrating historical purchase orders, sales orders, freight orders, invoices, and their line items with reconciliation output.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 1
  - **Scope:** Import transactional headers, line items, and snapshot fields in dependency order; add reconciliation reports and operator runbooks for rollback/restart.
  - **Non-goals:** No live integration sync or notification fan-out.
  - **Primary domain:** backend/data
  - **Likely touched paths:** `backend/apps/core/services/etl/`, `backend/tenant_apps/{purchase_orders,sales_orders,invoices}/`, `backend/apps/system/services/entity_introspection.py`, `backend/apps/core/tests/fixtures/etl/`, `docs/runbooks/GOLDEN_SCHEMA_ETL.md`
  - **Dependencies:** GA-01.3
  - **Blockers:** None
  - **Acceptance criteria:** Historical transactions import in a deterministic order, snapshot fields remain immutable, reconciliation output exposes row-level failures, and reruns do not duplicate successful records.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.purchase_orders tenant_apps.sales_orders tenant_apps.invoices`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Disable write mode, revert the importer, and use journal metadata to roll back the affected import batch.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic GA-02 - Infrastructure & disaster recovery

- [x] **GA-02.1 infra-desired-state-and-iac-scaffold**
  - **Status:** Shipped (PR #4818)
  - **Why now:** Launch operations currently rely on workflow/runtime knowledge that needs a codified desired state before DR and autoscaling changes can be trusted.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 2
  - **Scope:** Inventory the current deploy/runtime topology and create the first IaC scaffold for launch-critical resources (droplets, workers, Redis, backup storage, alerting assumptions) without contradicting the Golden Pipeline.
  - **Non-goals:** No production cutover or environment secret renaming.
  - **Primary domain:** ops/docs
  - **Likely touched paths:** `deploy/`, new `deploy/terraform/`, `.github/workflows/reusable-deploy.yml`, `docs/architecture/INFRASTRUCTURE_ARCHITECTURE.md`, `docs/runbooks/INCIDENT_RESPONSE.md`
  - **Dependencies:** GA-01.4
  - **Blockers:** None
  - **Acceptance criteria:** One deterministic desired-state document/scaffold exists, maps to current workflow reality, and names what is still manually managed versus codified.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** High
  - **Risk level:** Medium
  - **Rollback:** Revert IaC/docs scaffolding only; do not change live infrastructure until follow-up tickets land.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **GA-02.2 postgres-pitr-verification-and-restore-drill**
  - **Status:** Shipped (PR #4819)
  - **Why now:** Pre-migration backups exist, but GA needs provable PITR/restore capability rather than ad hoc dump retention.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 2
  - **Scope:** Add PITR validation and a restore-drill runbook/workflow that verifies backups can be restored safely and documents RPO/RTO expectations.
  - **Non-goals:** No database engine migration.
  - **Primary domain:** ops/backend
  - **Likely touched paths:** `.github/workflows/reusable-deploy.yml`, `.github/workflows/99-ops-management-command.yml`, `docs/guides/DATABASE_SYNC_GUIDE.md`, `docs/runbooks/DISASTER_RECOVERY.md`, `manifests/env.manifest.json`
  - **Dependencies:** GA-02.1
  - **Blockers:** None
  - **Acceptance criteria:** PITR/restore steps are executable from repo docs/workflows, backup retention rules are explicit, and operators can prove a restore path before GA.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`; `python config/manage_env.py audit`
  - **Tenant/RLS impact:** Medium; restored environments must preserve tenant isolation guarantees.
  - **Secrets/infra impact:** High
  - **Risk level:** High
  - **Rollback:** Revert workflow/doc changes if the restore drill introduces unsafe or contradictory operational guidance.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **GA-02.3 celery-worker-scaling-envelope**
  - **Status:** Shipped (PR #4820)
  - **Why now:** Launch traffic and new async workloads need bounded worker concurrency/autoscaling guidance before queues back up under real tenants.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 2
  - **Scope:** Define and enforce Celery worker scaling envelopes, queue priorities, and saturation guardrails for email ingestion, workform execution, AI processing, and future ETL/import jobs.
  - **Non-goals:** No new async product features.
  - **Primary domain:** backend/ops
  - **Likely touched paths:** `backend/projectmeats/settings/base.py`, `backend/projectmeats/celery.py`, `backend/apps/{integrations,system,core}/tasks.py`, `docs/runbooks/DISASTER_RECOVERY.md`, `deploy/terraform/`
  - **Dependencies:** GA-02.2
  - **Blockers:** None
  - **Acceptance criteria:** Worker concurrency/autoscale settings are explicit per workload class, queue backlog thresholds are documented, and task execution stays tenant-safe under worker reuse.
  - **Validation commands:** `cd backend && python manage.py test apps.integrations apps.system`; `bash .github/scripts/check_infrastructure.sh`
  - **Tenant/RLS impact:** High in worker contexts
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Revert scaling config/docs and restore previous Celery settings if queue health regresses.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **GA-02.4 redis-eviction-and-queue-health-guardrails**
  - **Status:** Shipped (PR #4821)
  - **Why now:** Redis underpins Celery and caching, so GA needs explicit memory policy and queue health guardrails before offline queues and ETL bursts arrive.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 2
  - **Scope:** Define Redis eviction policy, queue-health checks, and operator guidance for broker saturation or stale task buildup.
  - **Non-goals:** No new cache-heavy feature work.
  - **Primary domain:** ops/backend
  - **Likely touched paths:** `deploy/`, `docs/runbooks/DISASTER_RECOVERY.md`, `docs/guides/DEVELOPMENT_WORKFLOW.md`, `manifests/env.manifest.json`, backend health/diagnostic scripts
  - **Dependencies:** GA-02.3
  - **Blockers:** None
  - **Acceptance criteria:** Redis memory/eviction policy is documented and validated, queue-health alarms/diagnostics exist, and operator steps for broker distress are explicit.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`; `python config/manage_env.py audit`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** Medium
  - **Risk level:** Medium
  - **Rollback:** Revert Redis/ops guidance and restore prior runtime settings if the new policy is unsafe.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic GA-03 - SOC 2 data governance

- [x] **GA-03.1 retention-inventory-and-archive-contract**
  - **Status:** Shipped (PR #4822)
  - **Why now:** GA needs a defensible retention strategy before operators start migrating or scaling historical data.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 3
  - **Scope:** Inventory which records must be retained, archived, masked, or exempted via legal hold, then define the archival contract and restore path.
  - **Non-goals:** No actual record archiving yet.
  - **Primary domain:** backend/docs
  - **Likely touched paths:** `backend/apps/core/services/data_governance.py`, `backend/apps/core/management/commands/`, `docs/runbooks/DATA_RETENTION.md`, `MASTER_PLAN.md`
  - **Dependencies:** GA-02.4
  - **Blockers:** None
  - **Acceptance criteria:** The repo names the 7-year archive targets, exemptions, legal-hold model, and restore expectations without conflicting with current runtime behavior.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `cd backend && python manage.py test apps.core`
  - **Tenant/RLS impact:** High for archived tenant data
  - **Secrets/infra impact:** Low
  - **Risk level:** High
  - **Rollback:** Revert the retention contract/docs only; no records should move during this ticket.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **GA-03.2 seven-year-archive-command**
  - **Status:** Shipped (PR #4823)
  - **Why now:** The retention contract is not enforceable until a dry-run-first archival command exists.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 3
  - **Scope:** Build the management command/service that archives or snapshots aged transactional records after 7 years, supports legal holds, and writes audit evidence.
  - **Non-goals:** No destructive purges of live rows without archive proofs.
  - **Primary domain:** backend
  - **Likely touched paths:** `backend/apps/core/services/data_governance.py`, `backend/apps/core/management/commands/archive_historical_records.py`, `backend/apps/core/tests/`, new migrations, `docs/runbooks/DATA_RETENTION.md`
  - **Dependencies:** GA-03.1
  - **Blockers:** None
  - **Acceptance criteria:** Archive mode supports dry-run and execute paths, legal-hold records are skipped safely, and audit evidence records what moved when and why.
  - **Validation commands:** `cd backend && python manage.py test apps.core`; `cd backend && python manage.py archive_historical_records --dry-run`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium if archive storage configuration is added
  - **Risk level:** High
  - **Rollback:** Leave additive archive metadata in place, disable execute mode, and restore from archive manifests if needed.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **GA-03.3 pii-redaction-for-logging-and-sentry**
  - **Status:** Shipped (PR #4832)
  - **Why now:** GA observability cannot expand while logs/APM still risk emitting raw emails, phone numbers, or payload fragments.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 3
  - **Scope:** Add central redaction filters for Django logging, Celery task logs, and Sentry events/spans; ensure sensitive fields are scrubbed before transport.
  - **Non-goals:** No product analytics dashboards.
  - **Primary domain:** backend/frontend observability
  - **Likely touched paths:** `backend/projectmeats/settings/base.py`, `backend/projectmeats/settings/production.py`, `frontend/src/utils/sentry.ts`, `frontend/src/utils/logger.ts`, `docs/runbooks/DATA_RETENTION.md`
  - **Dependencies:** GA-03.1
  - **Blockers:** None
  - **Acceptance criteria:** Sensitive patterns are redacted centrally, regression tests prove redaction, and Sentry/log output remains diagnostically useful.
  - **Validation commands:** `cd backend && python manage.py test apps.core`; `npm -C frontend run verify-standards`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Revert filters atomically if they break observability, but never leave partially scrubbed paths in place.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic UI-01 - Core UX Stabilization

- [x] **UI-01.1 modal-lifecycle-lockdown**
  - **Status:** Done
  - **Why now:** Hidden modal bodies are still one of the fastest ways to crash record-edit flows through stale hydration loops and React Error #185 regressions.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14.5 / Modal lifecycle lockdown
  - **Scope:** Audit Plants, Inquiries, and shared modal/drawer surfaces; enforce `destroyOnClose={true}` where hidden AntD state can linger; and conditionally mount heavy form/query bodies only while open so edit flows always start from a fresh React tree.
  - **Non-goals:** No redesign of form schemas, record layouts, or unrelated entity pages.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/pages/Plants/`, `frontend/src/pages/Inquiries/`, `frontend/src/components/EntityFormSurface.tsx`, `frontend/src/components/UniversalEntityForm/`, shared modal components, frontend regression tests
  - **Dependencies:** GA-03.3
  - **Blockers:** None
  - **Acceptance criteria:** Hidden modal/drawer flows unmount stale form content on close, shared edit surfaces stop retaining prior-record state across reopen cycles, and regression coverage protects the known Plant/Inquiry crash paths.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert touched modal lifecycle changes together for the affected surfaces and restore the prior open/close behavior only if the new contract regresses stable forms.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md` (PR #4836)

- [x] **UI-01.2 null-safety-formatters**
  - **Status:** Done
  - **Why now:** Detail views still crash when legacy or partially populated rows feed `null` into `.toFixed()` or other numeric/currency formatters.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14.5 / Null-safe numeric formatting
  - **Scope:** Audit shared formatter utilities and high-frequency read-only views, then centralize null-coalescing numeric/currency formatting so legacy blank values render safely instead of throwing.
  - **Non-goals:** No numeric schema migration or backend data backfill.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/utils/formatters.ts`, inquiry/invoice/detail components, related shared display helpers, frontend regression tests
  - **Dependencies:** UI-01.1
  - **Blockers:** None
  - **Acceptance criteria:** Shared numeric/currency formatting paths tolerate `null`/`undefined`, known inquiry/invoice crash paths render stable fallback values, and duplicated inline `.toFixed()` risk is reduced or eliminated in touched surfaces.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert the formatter consolidation and leaf-view patches together if the new boundary distorts displayed values.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md` (PR #4838)

- [x] **UI-01.3 breadcrumb-uuid-resolution-engine**
  - **Status:** Done
  - **Why now:** Operators are still navigating through raw UUID breadcrumb segments, which makes nested supplier/customer/plant paths look broken and slows navigation.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14.5 / Breadcrumb UUID resolution
  - **Scope:** Upgrade breadcrumb rendering to resolve entity UUID/path params into display names via one canonical route-loader or shared dictionary strategy, while preserving stable fallback labels when lookup data is unavailable.
  - **Non-goals:** No full router architecture rewrite or unrelated navigation redesign.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/components/Navigation/Breadcrumb.tsx`, entity service-layer helpers, shared record/detail pages, frontend regression tests
  - **Dependencies:** UI-01.2
  - **Blockers:** None
  - **Acceptance criteria:** Breadcrumbs resolve human-readable labels for supported entity routes, UUID segments no longer dominate nested navigation on key record paths, and fallback behavior remains stable when resolution fails.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Low through entity lookup scope
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert breadcrumb resolution logic while preserving existing route behavior if the shared lookup path introduces incorrect labels or expensive fetch churn.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md` (PR #4840)

- [x] **GA-03.4 governance-schedules-and-evidence-runbook**
  - **Status:** Done
  - **Why now:** Governance work is incomplete until archival/redaction have scheduled enforcement and operator evidence collection.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 3
  - **Scope:** Add scheduled enforcement hooks, evidence checklist/runbooks, and operational verification paths for retention/redaction posture.
  - **Non-goals:** No new customer-facing features.
  - **Primary domain:** ops/docs
  - **Likely touched paths:** `backend/projectmeats/celery.py`, `backend/apps/system/tasks.py`, `.github/workflows/99-ops-management-command.yml`, `docs/runbooks/DATA_RETENTION.md`, `docs/runbooks/INCIDENT_RESPONSE.md`
  - **Dependencies:** GA-03.2, GA-03.3, UI-01.3
  - **Blockers:** None
  - **Acceptance criteria:** Scheduled jobs and operator runbooks exist for archive/redaction checks, and evidence paths are explicit for audits.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `cd backend && python manage.py test apps.system apps.core`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** Medium
  - **Risk level:** Medium
  - **Rollback:** Revert scheduling/runbook changes together if they create noisy or unsafe operational loops.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md` (PR #4842)

### Epic GA-04 - In-app user onboarding

- [x] **GA-04.1 tour-provider-and-user-preference-contract**
  - **Status:** Shipped (PR #4844)
  - **Why now:** New tenants currently land in a blank-feeling experience and tour state is scattered across local-only onboarding hooks.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 4
  - **Scope:** Standardize guided-tour orchestration by reusing `react-joyride`, `CockpitTour`, FlowEditor onboarding hooks, and `UserPreferences` so first-run state is durable per user.
  - **Non-goals:** No full empty-state rollout yet.
  - **Primary domain:** frontend/backend
  - **Likely touched paths:** `frontend/src/App.tsx`, `frontend/src/components/Cockpit/CockpitTour.tsx`, `frontend/src/components/Onboarding/`, `frontend/src/components/FlowEditor/hooks/useOnboardingTour.tsx`, `backend/apps/core/{models,serializers,views}.py`, new migrations/tests
  - **Dependencies:** GA-03.4
  - **Blockers:** None
  - **Acceptance criteria:** Tour completion state uses one canonical storage shape, can be reset/replayed safely, and does not rely on page-specific localStorage flags alone.
  - **Validation commands:** `cd backend && python manage.py test apps.core`; `npm -C frontend run verify-standards`
  - **Tenant/RLS impact:** Low on shared user-preference data
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert provider/preference changes together and fall back to the existing Cockpit-local tour behavior.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md` (PR #4844)

- [x] **GA-04.2 cockpit-empty-state-system**
  - **Status:** Shipped (PR #4846)
  - **Why now:** The first tenant experience should teach actions immediately on the dashboard instead of showing inert whitespace.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 4
  - **Scope:** Create a reusable empty-state pattern for dashboard/cockpit surfaces with direct CTA buttons and help text tailored to first-run workflows.
  - **Non-goals:** No rollout to every entity page yet.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/pages/Cockpit/CockpitDashboard.tsx`, `frontend/src/components/Admin/EmptyState.tsx`, `frontend/src/components/Widgets/`, `frontend/src/components/Onboarding/`
  - **Dependencies:** GA-04.1
  - **Blockers:** None
  - **Acceptance criteria:** Cockpit/dashboard empty states route users directly into first actions and remain theme-compliant/accessibility-safe.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** None
  - **Risk level:** Low
  - **Rollback:** Revert the cockpit empty-state components without affecting existing data-fetch logic.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md` (PR #4846)

- [x] **GA-04.3 transactional-surface-empty-states**
  - **Status:** Shipped (PR #4848)
  - **Why now:** Orders, freight, and document-heavy surfaces still need “create your first X” guidance to prevent first-run abandonment.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 4
  - **Scope:** Roll the empty-state CTA system through priority transaction/list surfaces (purchase orders, sales orders, freight orders, invoices, document vault-adjacent pages).
  - **Non-goals:** No redesign of mature populated states.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/pages/{PurchaseOrders.tsx,FreightOrders.tsx}`, `frontend/src/pages/SalesOrders/SalesOrders.tsx`, `frontend/src/pages/Accounting/Invoices.tsx`, `frontend/src/pages/Entities/UniversalEntityRecordPage.tsx`, shared empty-state components/tests
  - **Dependencies:** GA-04.2
  - **Blockers:** None
  - **Acceptance criteria:** Priority transactional list/record surfaces show actionable first-run CTAs with no broken navigation paths.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** None
  - **Risk level:** Low
  - **Rollback:** Revert touched page-level empty-state branches only.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **GA-04.4 onboarding-telemetry-and-resume-controls**
  - **Status:** Shipped (PR #4850)
  - **Why now:** GA needs evidence that onboarding works and lets users skip/resume without getting trapped.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 4
  - **Scope:** Track onboarding completion/skip/resume events and add a simple help/restart surface in the app shell.
  - **Non-goals:** No marketing analytics layer.
  - **Primary domain:** frontend/backend
  - **Likely touched paths:** `frontend/src/components/Layout/Header.tsx`, `frontend/src/components/Onboarding/`, `frontend/src/contexts/AuthContext.tsx`, `backend/apps/core/{models,serializers,views}.py`, tests
  - **Dependencies:** GA-04.1, GA-04.3
  - **Blockers:** None
  - **Acceptance criteria:** Users can restart or dismiss tours intentionally, completion data is persisted predictably, and onboarding regressions are covered by tests.
  - **Validation commands:** `cd backend && python manage.py test apps.core`; `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Low
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert telemetry/resume controls while leaving the base tour provider intact.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic GA-05 - Edge resilience (PWA + optimistic UI)

- [x] **GA-05.1 vite-pwa-app-shell-foundation**
  - **Status:** Shipped (PR #4852)
  - **Why now:** Warehouse-mode resilience starts with a cacheable app shell and offline-safe bootstrap.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 5
  - **Scope:** Add the PWA/service-worker foundation to the Vite frontend, define offline cache boundaries, and ensure the app shell can render safely when the network drops temporarily.
  - **Non-goals:** No broad offline write queue yet.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/vite.config.ts`, `frontend/package.json`, `frontend/src/index.tsx`, `frontend/public/`, new `frontend/src/pwa/`
  - **Dependencies:** GA-04.4
  - **Blockers:** None
  - **Acceptance criteria:** The frontend has one canonical service-worker/PWA registration path, the app shell caches without breaking authenticated boot, and build/test docs are updated.
  - **Validation commands:** `npm -C frontend run build`; `npm -C frontend run verify-standards`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** Low
  - **Risk level:** Medium
  - **Rollback:** Remove PWA registration and revert Vite/package changes together.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **GA-05.2 connectivity-state-and-offline-banner**
  - **Status:** Shipped (PR #4854)
  - **Why now:** Users need immediate feedback when the network drops before we optimistically queue mutations.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 5
  - **Scope:** Add connectivity detection and a shared offline/reconnecting banner tied into the app shell and priority operational surfaces.
  - **Non-goals:** No queued mutation replay yet.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/App.tsx`, `frontend/src/components/Layout/Header.tsx`, new `frontend/src/contexts/ConnectivityContext.tsx`, `frontend/src/components/common/`
  - **Dependencies:** GA-05.1
  - **Blockers:** None
  - **Acceptance criteria:** The app announces offline/reconnecting state clearly, does not spam re-renders, and remains accessible.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** None
  - **Risk level:** Low
  - **Rollback:** Revert the connectivity provider/banner and keep the app shell changes isolated.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **GA-05.3 warehouse-critical-optimistic-mutations**
  - **Status:** Shipped (PR #4856)
  - **Why now:** Offline readiness matters most on status/delivery actions where field users expect instant feedback despite weak connectivity.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 5
  - **Scope:** Apply optimistic React Query mutations and replay-safe local queuing to the narrow set of warehouse/logistics-critical actions (for example delivered/arrived/status transitions).
  - **Non-goals:** No blanket optimistic behavior across all forms.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/components/Operations/documentOperations.ts`, `frontend/src/components/Operations/OperationalDocumentActions.tsx`, `frontend/src/hooks/useFavorites.ts`, new offline queue utilities/hooks, related tests
  - **Dependencies:** GA-05.2
  - **Blockers:** None
  - **Acceptance criteria:** Priority mutations update the UI immediately, roll back cleanly on hard failure, and queue/replay safely through brief connectivity gaps.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Medium on client cache scoping
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert optimistic queueing on the targeted actions and fall back to current mutation/invalidation flow.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **GA-05.4 offline-replay-and-warehouse-e2e**
  - **Status:** Shipped (PR #4858)
  - **Why now:** GA needs proof that optimistic/offline behavior survives reconnects and does not silently desync.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 5
  - **Scope:** Add replay/recovery tests plus a rollout guard for offline mode on warehouse/logistics-critical surfaces.
  - **Non-goals:** No mobile-native offline implementation.
  - **Primary domain:** frontend/testing
  - **Likely touched paths:** `frontend/e2e/`, `frontend/src/contexts/ConnectivityContext.tsx`, `frontend/src/components/Operations/`, `frontend/src/pages/FreightOrders.tsx`, `frontend/src/pages/SalesOrders/`
  - **Dependencies:** GA-05.3
  - **Blockers:** None
  - **Acceptance criteria:** Replay/reconnect paths are covered by automated tests, offline mode can be disabled safely if regressions appear, and docs explain the operator behavior.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:e2e`
  - **Tenant/RLS impact:** Low
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Disable the rollout flag and revert offline queue code if replay correctness is not proven.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

## Phase 12 - Enterprise Hardening & Tech Debt Eradication

### Epic EH-00 - Canonical docs/governance layer

- [x] **EH-00.1 enterprise-audit-doc-batch**
  - **Status:** Done
  - **Why now:** The repo needed one canonical enterprise hardening backlog before further autonomous execution.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 12 / Phase 13
  - **Scope:** Create the gap report, blueprint, debt register, protocols, and ordered tickets.
  - **Non-goals:** No product code changes.
  - **Primary domain:** docs
  - **Likely touched paths:** `MASTER_PLAN.md`, `.github/MASTER_PLAN.md`, `.github/TECH_DEBT_REGISTER.md`, `.github/SDLC_PROTOCOLS.md`, `.github/EPIC_TICKETS.md`, `GAP_ANALYSIS_REPORT.md`, `STRATEGIC_BLUEPRINT.md`
  - **Dependencies:** None
  - **Blockers:** None
  - **Acceptance criteria:** New planning artifacts exist, canonical hierarchy is explicit, and the first unchecked ticket is executable from docs alone.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`; `bash scripts/validate_copilot_squad.sh`
  - **Tenant/RLS impact:** Documentation only
  - **Secrets/infra impact:** Documentation only
  - **Risk level:** Low
  - **Rollback:** Revert the docs batch and re-derive from root `MASTER_PLAN.md`.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md` after merge

### Epic EH-01 - SDLC + supply-chain hardening

- [x] **EH-01.1 drift-gate-depth**
  - **Status:** Shipped (PR #4863)
  - **Why now:** The current golden verification is false-green for stale authority docs and workflow reality drift, which undermines every later ticket.
  - **Canonical source reference:** `MASTER_PLAN.md` -> P0/P1 CI guardrails + Phase 12
  - **Scope:** Expand repo drift validation so authoritative/current docs and workflow reality are checked together, and force `docs/reference/GOLDEN_PIPELINE.md` to act as a pointer or parity-checked reference to `docs/GOLDEN_PIPELINE.md` instead of an independent authority.
  - **Non-goals:** No secret policy generation, no deploy topology redesign, no product feature work.
  - **Primary domain:** CI/docs
  - **Likely touched paths:** `scripts/verify_golden_state.sh`, `.github/scripts/check_infrastructure.sh`, `.github/workflows/README.md`, `docs/guides/BRANCH_PROTECTION_SETUP.md`, `docs/reference/GOLDEN_PIPELINE.md`
  - **Dependencies:** EH-00.1
  - **Blockers:** None
  - **Acceptance criteria:**
    1. Before the fix is applied, running `bash scripts/verify_golden_state.sh` demonstrates at least one failing parity/drift check for the current doc/workflow contradiction, proving the validator was not already sufficient.
    2. After the fix is applied, drift checks fail when a `CURRENT` doc references nonexistent workflows, wrong branch names, or forbidden deployment patterns.
    3. `docs/reference/GOLDEN_PIPELINE.md` and similar reference docs cannot contradict `docs/GOLDEN_PIPELINE.md` on guarded sections without failing validation.
    4. The validator output tells the operator exactly which file and rule drifted.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** Reads manifest/workflow metadata only
  - **Risk level:** Medium
  - **Rollback:** Revert validator changes and documentation edits together if false positives block legitimate work.
  - **Completion evidence destination:** append shipped PR evidence to `.github/MASTER_PLAN.md`

- [x] **EH-01.2 manifest-required-secret-parity**
  - **Status:** Shipped (PR #4764)
  - **Why now:** Secret requirements are still duplicated in workflow logic instead of being generated from the manifest.
  - **Canonical source reference:** `MASTER_PLAN.md` -> CI guardrails + Phase 12
  - **Scope:** Make required-secret behavior per lane derive from `manifests/env.manifest.json`.
  - **Non-goals:** No new secret creation, no unrelated workflow refactors.
  - **Primary domain:** CI/config
  - **Likely touched paths:** `manifests/env.manifest.json`, `.github/workflows/reusable-deploy.yml`, `.github/scripts/validate-environment.sh`, `config/manage_env.py`
  - **Dependencies:** EH-01.1
  - **Blockers:** None
  - **Acceptance criteria:** Workflow-required vs optional secrets match the manifest exactly and validation fails on divergence.
  - **Validation commands:** `python config/manage_env.py audit`; `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** High; touches deploy lanes and GitHub Environment secret expectations
  - **Risk level:** High
  - **Rollback:** Revert to last known good workflow/validator pair and rerun secret audit before retrying.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **EH-01.3 pr-security-gates-and-dependabot-scope**
  - **Status:** Shipped (PR #4766)
  - **Why now:** PR validation lacks supply-chain/security depth and Dependabot can still auto-merge sensitive workflow/Docker changes.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 12
  - **Scope:** Add PR-time security gates and restrict bot auto-merge to safe dependency surfaces.
  - **Non-goals:** No full dependency remediation campaign.
  - **Primary domain:** CI/security
  - **Likely touched paths:** `.github/workflows/pr-validation.yml`, `.github/workflows/15-dependabot-merge-when-green.yml`, `.github/CODEOWNERS`
  - **Dependencies:** EH-01.2
  - **Blockers:** None
  - **Acceptance criteria:** Critical workflow/Docker changes require human review and PR validation includes explicit security scanning.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** Medium
  - **Risk level:** Medium
  - **Rollback:** Revert the gating workflow and bot policy together if CI becomes unusable.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **EH-01.4 rollback-release-automation-alignment**
  - **Status:** Shipped (PR #4769)
  - **Why now:** Rollback scripts/docs are stale and release automation is missing, which weakens every higher-risk change.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 12 / Operational excellence
  - **Scope:** Align rollback assets with reusable deploy reality and add explicit release workflow/governance.
  - **Non-goals:** No change to product runtime code.
  - **Primary domain:** ops/docs
  - **Likely touched paths:** `.github/scripts/deployment-rollback.sh`, `docs/runbooks/INCIDENT_RESPONSE.md`, `.github/workflows/*release*.yml`, `.github/workflows/README.md`
  - **Dependencies:** EH-01.3
  - **Blockers:** None
  - **Acceptance criteria:** Rollback instructions match live deploy paths/ports and one release creation path is documented or automated.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** Medium
  - **Risk level:** Medium
  - **Rollback:** Revert to previous rollback doc/script versions if mismatches are introduced.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic EH-02 - Tenant isolation + data integrity

- [x] **EH-02.1 fail-closed-tenant-rls-runtime**
  - **Status:** Shipped (PR #4771)
  - **Why now:** Fail-open tenant/RLS behavior is the most dangerous correctness gap left in backend runtime.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Security / tenant isolation + Phase 12
  - **Scope:** Make tenant-scoped HTTP and task paths fail closed when tenant or RLS session state cannot be asserted.
  - **Non-goals:** No broad schema redesign beyond what is required for fail-closed behavior.
  - **Primary domain:** backend
  - **Likely touched paths:** `backend/apps/tenants/middleware.py`, `backend/apps/tenants/rls.py`, `backend/apps/core/tasks.py`, `backend/apps/tenants/tasks.py`, relevant regression tests
  - **Dependencies:** EH-01.2
  - **Blockers:** None
  - **Acceptance criteria:** Tenant-scoped requests/tasks abort safely when RLS cannot be set, and regression tests cover the failure path.
  - **Validation commands:** `cd backend && python manage.py test apps.tenants apps.core.tests.test_audit_rls_compliance apps.system.tests.test_get_request_tenant_resolution tenant_apps.workflows.tests.test_viewset_tenant_fail_closed`; `bash scripts/verify_golden_state.sh`
  - **Tenant/RLS impact:** High; fail-closed behavior is the core objective
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Gate stricter behavior behind a flag only if absolutely necessary; never revert to silent cross-tenant continuation.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **EH-02.2 platform-idempotency-keys**
  - **Status:** Shipped (PRs #4773, #4776)
  - **Why now:** Duplicate POST/retry behavior remains ad hoc across uploads, executions, and integrations.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 12
  - **Scope:** Add a tenant-scoped idempotency layer and apply it to the first high-risk mutation endpoints.
  - **Non-goals:** No attempt to retrofit every POST endpoint in one PR.
  - **Primary domain:** backend
  - **Likely touched paths:** new middleware/store under `backend/apps/core/` or `backend/apps/system/`, `backend/tenant_apps/ai_assistant/views.py`, `backend/apps/system/workform_views.py`
  - **Dependencies:** EH-02.1
  - **Blockers:** None
  - **Acceptance criteria:** Replayed requests with the same idempotency key do not duplicate writes for the targeted endpoints.
  - **Validation commands:** `cd backend && python manage.py test apps.system.tests.test_tenant_workform_execute_permissions apps.system.tests.test_workform_execute_circuit_breaker tenant_apps.ai_assistant`
  - **Tenant/RLS impact:** Medium; store must be tenant-aware
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Disable the middleware for the targeted routes and keep the persistence table additive.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **EH-02.3 chat-session-tenant-fk-rls**
  - **Status:** Shipped (PR #4871)
  - **Why now:** AI chat persistence still relies on JSON-stamped tenant context instead of tenant-native storage.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 12 / Phase 13 dependency
  - **Scope:** Add `tenant` FK + RLS to `ChatSession` and `ChatMessage`, backfill, migrate reads/writes, and update `manifests/RLS_POLICIES.md` so the new policies are governed by the same registry as the rest of the platform.
  - **Non-goals:** No autonomy control plane yet.
  - **Primary domain:** backend
  - **Likely touched paths:** `backend/tenant_apps/ai_assistant/models.py`, `backend/tenant_apps/ai_assistant/views.py`, new migrations, `manifests/RLS_POLICIES.md`
  - **Dependencies:** EH-02.1
  - **Blockers:** None
  - **Acceptance criteria:** Chat data is tenant-native, tenant-scoped, and covered by RLS regression tests.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.ai_assistant apps.core.tests.test_audit_rls_compliance`; `cd backend && python manage.py showmigrations | grep ai_assistant`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Dual-read/write during rollout; revert readers before removing additive schema.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic EH-03 - Contract-first platform

- [x] **EH-03.1 openapi-ai-and-high-churn-surface-coverage**
  - **Status:** Shipped (PR #4775)
  - **Why now:** AI and other high-churn endpoints still lack explicit schema annotations, which blocks safe client generation.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Type safety gate + Phase 12
  - **Scope:** Add OpenAPI coverage to AI/high-churn backend endpoints and align the baseline artifact.
  - **Non-goals:** No frontend consumer refactor yet.
  - **Primary domain:** backend/contracts
  - **Likely touched paths:** `backend/tenant_apps/ai_assistant/views.py`, `backend/tenant_apps/ai_assistant/urls.py`, relevant schema generation config/tests, `manifests/openapi/openapi-schema.baseline.json`
  - **Dependencies:** EH-02.1
  - **Blockers:** None
  - **Acceptance criteria:** Touched endpoints appear explicitly in the baseline schema with stable request/response shapes.
  - **Validation commands:** `cd backend && python manage.py spectacular --validate --file /tmp/projectmeats-openapi.yaml`; `cd backend && python manage.py test tenant_apps.ai_assistant apps.core.tests.test_api_error_contracts`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Keep backward-compatible aliases until consumers are updated.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **EH-03.2 openapi-ts-mobile-typegen**
  - **Status:** Shipped (PRs #4777, #4562)
  - **Why now:** Frontend/mobile type drift cannot be reduced until generated contract artifacts exist.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Type safety gate + Mobile parity + Phase 12
  - **Scope:** Generate and adopt TS/mobile types for the first covered domains.
  - **Non-goals:** No total frontend rewrite.
  - **Primary domain:** frontend/mobile/contracts
  - **Likely touched paths:** `manifests/openapi/openapi-schema.baseline.json`, `frontend/src/services/*`, `mobile/src/*`, generation scripts/config
  - **Dependencies:** EH-03.1
  - **Blockers:** None
  - **Acceptance criteria:** Covered domains consume generated types and validation/build commands remain green.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`; `npm -C mobile run type-check`; `npm -C mobile run test`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Use compatibility wrappers and keep old handwritten DTOs until the generated path is stable.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic EH-04 - Frontend enterprise compliance

- [x] **EH-04.1 tenant-aware-query-keys-and-cache-clear-removal**
  - **Status:** Shipped (PR #4874)
  - **Why now:** Frontend tenant safety still relies on a global query-cache clear workaround.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Type safety gate / Cockpit Search / Phase 12
  - **Scope:** Introduce tenant-aware query keys and remove the app-level cache clearing hack after migration.
  - **Non-goals:** No search contract unification in this ticket.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/App.tsx`, `frontend/src/lib/` or `frontend/src/hooks/` query-key helper, `frontend/src/pages/Customers.tsx`, `frontend/src/pages/Suppliers.tsx`, `frontend/src/hooks/useHealth.ts`, `frontend/src/hooks/useWorkFormPermissions.ts`
  - **Dependencies:** EH-03.2
  - **Blockers:** None
  - **Acceptance criteria:** Touched tenant-scoped queries include tenant identity in the key, and tenant-switch behavior no longer depends on `queryClient.clear()`.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** High on the client-side trust boundary
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Keep the cache-clear fallback behind a temporary guard until migrated surfaces are verified.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **EH-04.2 search-contract-unification**
  - **Status:** Shipped (PR #4876)
  - **Why now:** Search surfaces still speak different contracts and ranking semantics.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Cockpit Search relevance + Phase 12
  - **Scope:** Create one search SDK/result taxonomy and move command/search surfaces onto it without changing user-facing entrypoints.
  - **Non-goals:** No unrelated UI redesign.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/components/Navigation/CommandPalette.tsx`, `frontend/src/components/Cockpit/SmartSearch.tsx`, `frontend/src/components/Search/ContinuousSearch.tsx`, shared search service/hooks
  - **Dependencies:** EH-04.1
  - **Blockers:** None
  - **Acceptance criteria:** Search surfaces share one contract and have deterministic ranking/tenant scoping behavior.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Keep existing UI shells and compatibility adapters until the unified service proves stable.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **EH-04.3 floweditor-decomposition-phase-1**
  - **Status:** Shipped (PR #4878)
  - **Why now:** `UnifiedFlowEditor.tsx` is too large and too risky to keep extending without module boundaries.
  - **Canonical source reference:** `MASTER_PLAN.md` -> WorkForms runtime/observability + Phase 12
  - **Scope:** Establish the first safe decomposition boundary and regression harness for FlowEditor.
  - **Non-goals:** No full editor rewrite and no real-time collaboration.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx`, supporting FlowEditor modules/tests, `frontend/src/components/Workflow/PurchaseOrderWorkflow.tsx`, `frontend/src/components/EntityGraph/EntityGraph.tsx`
  - **Dependencies:** EH-04.1, EH-03.2
  - **Blockers:** None
  - **Acceptance criteria:** The first extracted module boundary lands with regression coverage and no dual-library expansion.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci -- src/components/FlowEditor`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Keep behavior behind additive extraction boundaries and revert the extraction if editor regressions appear.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic EH-05 - Runtime / ops reliability

- [ ] **EH-05.1 non-dev-redis-readiness-gate**
  - **Status:** Ready
  - **Why now:** Locks, channels, cache, and circuit breakers cannot be considered production-grade while non-dev can fall back to memory semantics.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Graceful degradation / feature flags + Phase 12
  - **Scope:** Require Redis/Valkey readiness for non-dev environments and document the gate.
  - **Non-goals:** No AI control-plane work yet.
  - **Primary domain:** backend/ops
  - **Likely touched paths:** `backend/projectmeats/settings/base.py`, `.github/workflows/reusable-deploy.yml`, `manifests/GOLDEN_FILES.md`, runtime health checks
  - **Dependencies:** EH-01.4
  - **Blockers:** None
  - **Acceptance criteria:** Non-dev deployments fail fast when Redis/channel readiness is absent, while dev keeps explicit local fallbacks.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** High
  - **Risk level:** High
  - **Rollback:** Keep the readiness gate configurable per lane until infra is fully provisioned.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic EH-02 - Deferred execution item with EH-05 dependency

- [ ] **EH-02.4 atomic-workflow-collaboration-locks**
  - **Status:** Blocked
  - **Why now:** Current workflow lock semantics are not safe for concurrent multi-node execution.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 12
  - **Scope:** Replace `get` + `set` lock acquisition with an atomic distributed primitive and wire it into runtime/collaboration paths.
  - **Non-goals:** No full real-time collaboration product surface in this ticket.
  - **Primary domain:** backend
  - **Likely touched paths:** `backend/tenant_apps/workflows/services/locking.py`, collaboration endpoints/tests
  - **Dependencies:** EH-02.1, EH-05.1
  - **Blockers:** EH-05.1
  - **Acceptance criteria:** Concurrent lock acquisition is deterministic and covered by race/concurrency tests.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.workflows.tests.test_collaboration_websocket_security tenant_apps.workflows.tests.test_workflow_tasks_rls_context tenant_apps.workflows.services.tests.test_workflow_executor`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** Requires Redis in non-dev semantics
  - **Risk level:** High
  - **Rollback:** Keep the new lock path behind a feature flag until race tests are stable.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **EH-05.2 observability-and-rollback-drill**
  - **Status:** Blocked
  - **Why now:** Production observability and rollback readiness are not yet at enterprise baseline.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Operational excellence + Phase 12
  - **Scope:** Require lane-wide observability ownership and validate rollback procedures in UAT.
  - **Non-goals:** No unrelated dashboard redesign.
  - **Primary domain:** ops
  - **Likely touched paths:** `docs/runbooks/INCIDENT_RESPONSE.md`, `.github/scripts/deployment-rollback.sh`, `manifests/GOLDEN_FILES.md`, relevant workflows/docs
  - **Dependencies:** EH-05.1
  - **Blockers:** EH-05.1
  - **Acceptance criteria:** UAT rollback drill and non-dev observability expectations are explicitly documented and reproducible.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** Medium
  - **Risk level:** Medium
  - **Rollback:** Revert docs/script changes if they diverge from validated rollout behavior.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

## Phase 13 - Next-Gen AI & Automation

### Epic EH-06 - AI autonomy platform

- [ ] **EH-06.1 autonomous-control-plane-foundation**
  - **Status:** Blocked
  - **Why now:** AI tooling is still scaffolded; autonomy must be persisted and governed before it can scale.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 13
  - **Scope:** Add persisted AI run/task/approval models and the first governed execution flow.
  - **Non-goals:** No autonomous write actions without approval.
  - **Primary domain:** backend/AI
  - **Likely touched paths:** `backend/tenant_apps/ai_assistant/models.py`, `backend/tenant_apps/ai_assistant/views.py`, `backend/tenant_apps/ai_assistant/swarm/router.py`, new migrations/tests
  - **Dependencies:** EH-05.2
  - **Blockers:** EH-05.2
  - **Acceptance criteria:** AI runs are tenant-native, persisted, approval-aware, and queryable.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.ai_assistant apps.core.tests.test_viewset_permissions apps.core.tests.test_audit_rls_compliance`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Run in shadow mode first and keep autonomous execution denied by default.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **EH-06.2 semantic-index-lineage-and-durable-exports**
  - **Status:** Blocked
  - **Why now:** Semantic retrieval, lineage, and export governance remain incomplete even after AI parser hardening.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 13
  - **Scope:** Add real semantic indexing, end-to-end lineage, Graph resilience improvements, and durable export storage.
  - **Non-goals:** No broad UI polish beyond the minimum needed to expose lineage/approval state.
  - **Primary domain:** backend/AI/frontend
  - **Likely touched paths:** `backend/tenant_apps/integrations/services/email_ingestion.py`, `backend/tenant_apps/ai_assistant/services/*`, `backend/tenant_apps/ai_assistant/models.py`, `frontend/src/components/AIAssistant/*`
  - **Dependencies:** EH-06.1, EH-05.1, EH-03.1
  - **Blockers:** EH-06.1 and EH-05.1
  - **Acceptance criteria:** Semantic indexing is real and health-gated, lineage is end-to-end, and exports avoid local `/tmp`.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.integrations tenant_apps.ai_assistant apps.core.tests.test_viewset_permissions`; `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** High
  - **Risk level:** High
  - **Rollback:** Keep new index/export paths additive and feature-gated until lineage and retry behavior are validated.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

## Phase 15 - The B2B Network & Financial Settlement

### Epic B2B-02 - Global Trade Engine (determinism)

- [ ] **B2B-02.1 trade-invariants-contract-and-surface-audit**
  - **Status:** Blocked
  - **Why now:** Partner portals and settlement automation will be untrustworthy until weights, units, and time handling share one deterministic contract.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 15 / Epic 2
  - **Scope:** Define the canonical trade-invariants contract for base-unit storage, LBS/KG conversion, UTC storage, and plant-local rendering; identify every current surface that must adopt it.
  - **Non-goals:** No settlement execution, no public portal routes yet.
  - **Primary domain:** backend/frontend contracts
  - **Likely touched paths:** new `backend/apps/core/conversions.py`, `backend/apps/core/services/`, `frontend/src/utils/formatters.ts`, `docs/runbooks/GLOBAL_TRADE_ENGINE.md`, `MASTER_PLAN.md`
  - **Dependencies:** GA-05.4 and any remaining higher-priority unchecked tickets above Phase 15
  - **Blockers:** Phase 14 execution remains active and must complete before Phase 15 work starts
  - **Acceptance criteria:** One explicit conversion/timezone contract exists, impacted backend/frontend/PDF surfaces are inventoried, and deterministic decimal/timezone rules are documented without contradicting current `USE_TZ` or existing unit fields.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `cd backend && python manage.py test apps.core tenant_apps.purchase_orders tenant_apps.sales_orders tenant_apps.invoices`
  - **Tenant/RLS impact:** Medium; tenant-aware plants/locations drive display timezone behavior
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert the contract/runbook planning batch only; no schema or runtime behavior should change in this ticket.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **B2B-02.2 backend-trade-engine-service-and-tests**
  - **Status:** Blocked
  - **Why now:** Backend calculations, exports, and alerts need one canonical service before UI or reconciliation can adopt the invariant safely.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 15 / Epic 2
  - **Scope:** Implement the backend conversion/timezone service with deterministic decimal math, DST-safe datetime helpers, and regression coverage for weight/time invariants.
  - **Non-goals:** No UI rollout yet.
  - **Primary domain:** backend
  - **Likely touched paths:** new `backend/apps/core/conversions.py`, `backend/apps/core/tests/test_conversions.py`, `backend/apps/core/exporting.py`, `backend/apps/core/services/`
  - **Dependencies:** B2B-02.1
  - **Blockers:** B2B-02.1
  - **Acceptance criteria:** Decimal-based unit conversions are deterministic, date-only values do not shift calendar days, and DST boundary tests pass.
  - **Validation commands:** `cd backend && python manage.py test apps.core tenant_apps.purchase_orders tenant_apps.sales_orders tenant_apps.invoices tenant_apps.fulfillments`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** Low directly, but downstream tenant data must consume the service consistently
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert the shared service and callers together, leaving source units/timestamps untouched.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **B2B-02.3 transactional-api-adoption-for-orders-invoices-fulfillments**
  - **Status:** Blocked
  - **Why now:** Portal views, PDFs, and reconciliation logic need normalized API semantics before partner-facing features can be trusted.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 15 / Epic 2
  - **Scope:** Apply the canonical trade engine to transactional serializers/views for purchase orders, sales orders, invoices, fulfillments, and related document exports while preserving backward compatibility.
  - **Non-goals:** No broad frontend rollout yet.
  - **Primary domain:** backend/contracts
  - **Likely touched paths:** `backend/tenant_apps/{purchase_orders,sales_orders,invoices,fulfillments}/serializers.py`, corresponding `views.py`/`tests.py`, `openapi-schema.json`, `manifests/openapi/openapi-schema.baseline.json`
  - **Dependencies:** B2B-02.2
  - **Blockers:** B2B-02.2
  - **Acceptance criteria:** Transactional APIs expose consistent normalized weight/time semantics, OpenAPI stays backward-compatible, and existing internal consumers keep working.
  - **Validation commands:** `cd backend && python manage.py spectacular --validate --file /tmp/projectmeats-openapi.yaml`; `cd backend && python manage.py test tenant_apps.purchase_orders tenant_apps.sales_orders tenant_apps.invoices tenant_apps.fulfillments`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Keep additive fields/helpers and revert callers if downstream consumers regress.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **B2B-02.4 frontend-display-and-input-normalization**
  - **Status:** Blocked
  - **Why now:** Partner and operator interfaces must render the same weights/times from the same canonical contract.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 15 / Epic 2
  - **Scope:** Add one frontend conversion/formatting path for transactional displays and inputs, adopting the backend contract without duplicating business math ad hoc in components.
  - **Non-goals:** No portal-specific routes yet.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/utils/formatters.ts`, new `frontend/src/utils/trade.ts`, `frontend/src/pages/{PurchaseOrders.tsx,FreightOrders.tsx}`, `frontend/src/pages/SalesOrders/SalesOrders.tsx`, `frontend/src/pages/Accounting/Invoices.tsx`, related tests
  - **Dependencies:** B2B-02.3
  - **Blockers:** B2B-02.3
  - **Acceptance criteria:** No touched page shows mixed unit semantics or timezone drift, and formatter/unit tests use deterministic timezones and exact decimal expectations.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert frontend normalization helpers and touched consumers without mutating stored transactional data.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic B2B-01 - B2B Extranet (guest portals)

- [ ] **B2B-01.1 guest-portal-access-contract-and-doc-source-inventory**
  - **Status:** Blocked
  - **Why now:** External access must be designed as a dedicated, read-only B2B portal instead of reusing internal auth or exposing arbitrary documents.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 15 / Epic 1
  - **Scope:** Define the guest-portal access contract, token lifecycle, allowed document sources, public route shape, and guest-safe data scope for invoice/order/tracking access.
  - **Non-goals:** No public endpoints or frontend routes yet.
  - **Primary domain:** backend/docs
  - **Likely touched paths:** new `docs/runbooks/B2B_EXTRANET_PORTAL.md`, `backend/apps/core/security.py`, `backend/projectmeats/urls.py`, `backend/apps/core/urls.py`, `tenant_apps/{invoices,fulfillments}/`, `MASTER_PLAN.md`
  - **Dependencies:** B2B-02.1
  - **Blockers:** B2B-02.1 must define the deterministic trade/time contract first
  - **Acceptance criteria:** The contract explicitly forbids reuse of internal guest-login flows and direct `AIDocument` exposure, defines signed-grant rules, and names the first backend/frontend files to create.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `cd backend && python manage.py test apps.tenants apps.core tenant_apps.invoices tenant_apps.fulfillments`
  - **Tenant/RLS impact:** High; anonymous portal access must stay tenant-explicit and fail closed
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert the planning/runbook contract only; no public routes should exist from this ticket.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **B2B-01.2 portal-grant-and-document-registry-schema**
  - **Status:** Blocked
  - **Why now:** Safe external access requires tenant-aware grant records and curated document references before public endpoints can exist.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 15 / Epic 1
  - **Scope:** Add the portal grant schema, hashed token storage, expiry/revocation semantics, and a curated document registry/attachment reference model for portal-safe document exposure.
  - **Non-goals:** No portal UI yet.
  - **Primary domain:** backend
  - **Likely touched paths:** `backend/apps/core/models.py` or new portal model module, new migrations, `backend/apps/core/serializers.py`, `backend/apps/core/tests/`, `manifests/RLS_POLICIES.md`
  - **Dependencies:** B2B-01.1
  - **Blockers:** B2B-01.1
  - **Acceptance criteria:** Portal grants are tenant-scoped, revocable, one-time or TTL-constrained as designed, and curated document references do not leak raw internal storage paths.
  - **Validation commands:** `cd backend && python manage.py test apps.core apps.tenants`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert the additive schema and keep portal routes disabled if the grant model proves unsafe.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **B2B-01.3 public-portal-read-apis-and-audit-trail**
  - **Status:** Blocked
  - **Why now:** Guest links need dedicated read-only endpoints and audit visibility before a portal frontend can ship.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 15 / Epic 1
  - **Scope:** Create signed-grant public APIs for invoice summary, curated document download metadata, and live fulfillment/tracking state, plus audit logging for every access.
  - **Non-goals:** No authenticated cockpit reuse.
  - **Primary domain:** backend
  - **Likely touched paths:** new `backend/apps/core/portal_views.py`, `backend/apps/core/urls.py`, `backend/projectmeats/urls.py`, guest-safe serializers under `tenant_apps/{invoices,fulfillments}/`, relevant tests
  - **Dependencies:** B2B-01.2, B2B-02.3
  - **Blockers:** B2B-01.2 and B2B-02.3
  - **Acceptance criteria:** Anonymous requests resolve only by signed grant/tenant path, ignore stale anonymous tenant headers, fail closed on expired/revoked/mismatched grants, and record audit evidence.
  - **Validation commands:** `cd backend && python manage.py test apps.core apps.tenants tenant_apps.invoices tenant_apps.fulfillments`; `cd backend && python manage.py spectacular --validate --file /tmp/projectmeats-openapi.yaml`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Low
  - **Risk level:** High
  - **Rollback:** Revoke portal grants and disable the public routes before reverting serializers/views.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **B2B-01.4 frontend-public-portal-shell-and-magic-link-consume**
  - **Status:** Blocked
  - **Why now:** External users need a separate portal shell that does not inherit internal auth or tenant-header assumptions.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 15 / Epic 1
  - **Scope:** Build standalone public portal routes/pages/services for guest invoice/order views, document download metadata, and tracking, including signed-link exchange and deterministic expired-link UX.
  - **Non-goals:** No internal cockpit navigation reuse.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/App.tsx`, new `frontend/src/pages/Portal/GuestInvoiceView.tsx`, new `frontend/src/components/Portal/`, new `frontend/src/services/portalService.ts`, related tests/E2E
  - **Dependencies:** B2B-01.3, B2B-02.4
  - **Blockers:** B2B-01.3 and B2B-02.4
  - **Acceptance criteria:** Portal routes work logged out, do not auto-attach internal auth/tenant headers, strip raw tokens from visible history where applicable, and render only guest-safe data.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`; `npm -C frontend run test:e2e`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Disable public portal routes and revert the portal service/components without impacting internal routes.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **B2B-01.5 operator-issue-resend-revoke-controls**
  - **Status:** Blocked
  - **Why now:** Tenant operators need controlled issuance and revocation of external access once portal links exist.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 15 / Epic 1
  - **Scope:** Add issue/resend/revoke controls and access history visibility to the relevant internal accounting/logistics surfaces.
  - **Non-goals:** No partner self-service write workflows yet.
  - **Primary domain:** frontend/backend
  - **Likely touched paths:** `frontend/src/pages/Accounting/Invoices.tsx`, `frontend/src/pages/FreightOrders.tsx`, new `frontend/src/components/Portal/SharePortalLinkModal.tsx`, backend portal serializers/views/tests
  - **Dependencies:** B2B-01.4
  - **Blockers:** B2B-01.4
  - **Acceptance criteria:** Operators can issue, resend, revoke, and inspect portal grants with audit evidence and no cross-tenant issuance path.
  - **Validation commands:** `cd backend && python manage.py test apps.core apps.tenants`; `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** High on issuance controls
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revoke outstanding grants first, then revert issuance controls and UI affordances.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic B2B-03 - Financial Settlement & Reconciliation

- [ ] **B2B-03.1 settlement-ingest-contract-and-webhook-first-adapter-plan**
  - **Status:** Blocked
  - **Why now:** Financial settlement should start from one replay-safe ingest contract layered on the existing payment ledger instead of ad hoc manual matching.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 15 / Epic 3
  - **Scope:** Define the settlement ingestion/reconciliation contract, starting with a webhook-first adapter and leaving bank-feed providers as follow-on integrations.
  - **Non-goals:** No execute-mode reconciliation yet.
  - **Primary domain:** backend/docs
  - **Likely touched paths:** new `docs/runbooks/SETTLEMENT_RECONCILIATION.md`, `backend/tenant_apps/integrations/`, `backend/tenant_apps/invoices/models.py`, `MASTER_PLAN.md`
  - **Dependencies:** B2B-02.2
  - **Blockers:** B2B-02.2
  - **Acceptance criteria:** The contract reuses `PaymentTransaction` as the canonical payment ledger, defines raw-event journal/idempotency rules, and explains why webhook-first is the MVP over direct bank-feed coupling.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `cd backend && python manage.py test tenant_apps.invoices tenant_apps.integrations`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Revert the planning/runbook contract only; no new ingest endpoints should ship in this ticket.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **B2B-03.2 settlement-event-store-and-public-ingest-endpoint**
  - **Status:** Blocked
  - **Why now:** Reconciliation needs an auditable raw event journal and authenticated ingress before any auto-matching can occur.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 15 / Epic 3
  - **Scope:** Add tenant-scoped settlement source/event models, a signed/HMAC public ingest endpoint or provider webhook endpoint, and async handoff for processing.
  - **Non-goals:** No direct auto-match into invoices yet.
  - **Primary domain:** backend
  - **Likely touched paths:** `backend/tenant_apps/integrations/{models.py,serializers.py,views.py,urls.py,tasks.py}`, new migrations, `backend/projectmeats/urls.py`, backend tests, `manifests/RLS_POLICIES.md`
  - **Dependencies:** B2B-03.1
  - **Blockers:** B2B-03.1
  - **Acceptance criteria:** Provider event IDs are idempotent per tenant, signature validation fails closed, raw events are journaled for replay/review, and async processing preserves tenant context.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.integrations tenant_apps.invoices apps.integrations`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** High if provider secrets are introduced
  - **Risk level:** High
  - **Rollback:** Disable the ingest endpoint and preserve the raw event journal for replay/cleanup before reverting models/tasks.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **B2B-03.3 reconciliation-engine-into-paymenttransaction**
  - **Status:** Blocked
  - **Why now:** The system needs a deterministic matcher from settlement events to invoices/orders before payment status can update automatically.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 15 / Epic 3
  - **Scope:** Implement the reconciliation engine that maps settlement events into `PaymentTransaction` updates, match/review states, and reversible source-event linkage.
  - **Non-goals:** No accountant UI yet.
  - **Primary domain:** backend
  - **Likely touched paths:** new `backend/apps/core/services/settlement_reconciliation.py` or `backend/tenant_apps/invoices/services/`, `backend/tenant_apps/invoices/{models.py,serializers.py,views.py,tests.py}`, related order tests
  - **Dependencies:** B2B-03.2, B2B-02.3
  - **Blockers:** B2B-03.2 and B2B-02.3
  - **Acceptance criteria:** Exact and ambiguous matches are handled deterministically, duplicate/replayed events do not duplicate payments, and mismatches surface explicit reason codes for review.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.invoices tenant_apps.sales_orders tenant_apps.purchase_orders`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Disable execute-mode reconciliation first, preserve the raw event/source journal, and revert matcher writes via source-event linkage.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **B2B-03.4 accounting-settlement-queue-and-override-ui**
  - **Status:** Blocked
  - **Why now:** Accountants need a review queue for unmatched, partial, and disputed settlement items before auto-reconciliation can be trusted operationally.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 15 / Epic 3
  - **Scope:** Build the accountant-facing settlement queue, override flows, and audit display on top of the reconciliation engine.
  - **Non-goals:** No external partner portal reuse.
  - **Primary domain:** frontend/backend
  - **Likely touched paths:** new `frontend/src/pages/Accounting/Settlements.tsx`, `frontend/src/config/navigation.ts`, new `frontend/src/services/settlementService.ts`, `frontend/src/components/Shared/PaymentHistoryList.tsx`, corresponding backend serializers/views/tests
  - **Dependencies:** B2B-03.3
  - **Blockers:** B2B-03.3
  - **Acceptance criteria:** Accountants can review, approve, relink, or reject settlement items with audit evidence, and invoice/payment history surfaces reflect reconciled outcomes.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.invoices tenant_apps.integrations`; `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert the queue UI and override endpoints while leaving raw event journals intact.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **B2B-03.5 bank-feed-provider-adapter-and-secret-parity**
  - **Status:** Blocked
  - **Why now:** Direct bank-feed providers are follow-on work only after the webhook-first settlement path is stable and governed.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 15 / Epic 3
  - **Scope:** Add a provider-specific bank-feed adapter (Plaid/Stripe Treasury or equivalent) using the same settlement journal/reconciliation contract, plus manifest-defined secret handling.
  - **Non-goals:** No bespoke second reconciliation engine.
  - **Primary domain:** integrations/ops
  - **Likely touched paths:** `backend/apps/integrations/providers/`, `backend/apps/integrations/{models.py,views.py}`, `frontend/src/pages/Settings/IntegrationSettings.tsx`, `manifests/env.manifest.json`, relevant workflows/docs
  - **Dependencies:** B2B-03.1, B2B-03.4
  - **Blockers:** B2B-03.1 and B2B-03.4
  - **Acceptance criteria:** Any new provider secrets are manifest-defined, provider adapters feed the same raw event journal/matcher path, and Golden Pipeline workflow rules remain intact.
  - **Validation commands:** `python config/manage_env.py audit`; `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`; `cd backend && python manage.py test apps.integrations tenant_apps.integrations`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** High
  - **Risk level:** Medium
  - **Rollback:** Revert provider/workflow/manifest changes together and keep the webhook-first settlement path intact.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

## Phase 16 - The Core Trading Engine (End-to-End Automation)

### Epic CTE-01 - Inquiry ingestion & routing

- [ ] **CTE-01.1 inquiry-happy-path-contract-and-routing-fields**
  - **Status:** Blocked
  - **Why now:** The hardcoded happy path cannot exist until `Inquiry` explicitly carries the route decision, source-email lineage, requested master product/protein anchors, and downstream document/state references.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 1
  - **Scope:** Audit and extend the existing `tenant_apps.inquiries.models.Inquiry` contract so it can anchor the trading engine, including route flags (`FULFILL`/`BROKER`), source-email references, requested product/protein fields, and linkage to downstream supplier/sales/carrier documents.
  - **Non-goals:** No automated email parsing, routing execution, or outbound side effects yet.
  - **Primary domain:** backend/contracts
  - **Likely touched paths:** `backend/tenant_apps/inquiries/{models.py,serializers.py,views.py,tests.py}`, `backend/apps/integrations/{models.py,signals.py}`, additive migrations, `MASTER_PLAN.md`
  - **Dependencies:** B2B-02.1 and any remaining higher-priority unchecked tickets above Phase 16
  - **Blockers:** Phase 14 remains active; Phase 15 trade-invariants planning/work stays ahead of this execution lane
  - **Acceptance criteria:**
    1. The inquiry contract names the fields required to drive the happy path without guessing.
    2. Inquiry-to-document linkage is defined for supplier PO, sales order, and carrier PO relationships.
    3. The ticket leaves the current backlog ordering intact and does not imply execution has started.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `cd backend && python manage.py test tenant_apps.inquiries apps.integrations`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert additive inquiry-contract changes only; no runtime automation should be active from this ticket.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **CTE-01.2 ai-email-extractor-to-inquiry-draft**
  - **Status:** Blocked
  - **Why now:** The trading engine starts with inbound demand, and the current email ingestion stack stops short of creating a first-class inquiry.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 1
  - **Scope:** Hook AI email ingestion to the `Inquiry` model so qualifying inbound customer-demand emails create or update draft inquiries using OpenAI structured outputs, explicit source-email lineage, and fail-closed parsing.
  - **Non-goals:** No automatic supplier/customer/carrier document generation yet.
  - **Primary domain:** backend/ai/integrations
  - **Likely touched paths:** `backend/apps/integrations/{signals.py,models.py}`, `backend/tenant_apps/integrations/services/email_ingestion.py`, `backend/tenant_apps/ai_assistant/`, `backend/tenant_apps/inquiries/`, related tests
  - **Dependencies:** CTE-01.1
  - **Blockers:** CTE-01.1
  - **Acceptance criteria:**
    1. Structured extraction can create a draft inquiry with source-email traceability.
    2. Failed or ambiguous parses stay fail-closed and operator-visible instead of silently creating bad demand records.
    3. The created inquiry preserves tenant isolation and source provenance.
  - **Validation commands:** `cd backend && python manage.py test apps.integrations tenant_apps.integrations tenant_apps.ai_assistant tenant_apps.inquiries`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Disable the inquiry-creation hook and preserve source-email audit rows for replay before reverting parser wiring.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **CTE-01.3 inventory-availability-contract-and-routing-service**
  - **Status:** Blocked
  - **Why now:** `FULFILL` vs `BROKER` routing is impossible to automate safely because the repo does not yet contain a dedicated inventory source-of-truth model.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 1
  - **Scope:** Define and implement the authoritative inventory availability contract/service, then use it to flag inquiries as `FULFILL` or `BROKER` based on requested product/protein and available stock/reservation rules.
  - **Non-goals:** No RFQ fan-out or supplier/customer email yet.
  - **Primary domain:** backend/inventory
  - **Likely touched paths:** new `backend/apps/core/services/inventory_availability.py` or equivalent domain service, `backend/tenant_apps/inquiries/`, `backend/apps/system/models/product.py`, additive schema/tests, `MASTER_PLAN.md`
  - **Dependencies:** CTE-01.2
  - **Blockers:** CTE-01.2
  - **Acceptance criteria:**
    1. One explicit availability source and routing rule exists; the route does not rely on ad hoc product metadata.
    2. `Inquiry` can be flagged deterministically as `FULFILL` or `BROKER`.
    3. Reservation/availability semantics are documented well enough for future order allocation work.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.inquiries apps.system apps.core`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert routing service and additive schema together, leaving inquiries in manual-triage mode.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **CTE-01.4 live-inquiry-alerting-and-operator-review-queue**
  - **Status:** Blocked
  - **Why now:** Operators need immediate visibility into new inquiries and route decisions before the automated cascade becomes trustworthy.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 1
  - **Scope:** Add real-time or near-real-time operator alerting for new inquiries and route outcomes using existing notification/live-update patterns, plus an inquiry review queue surface for action-required demand.
  - **Non-goals:** No supplier/customer/carrier approvals yet.
  - **Primary domain:** frontend/backend notifications
  - **Likely touched paths:** `backend/tenant_apps/workflows/models.py`, `backend/tenant_apps/inquiries/`, `frontend/src/pages/Inquiries.tsx`, notification services/components, related tests
  - **Dependencies:** CTE-01.3
  - **Blockers:** CTE-01.3
  - **Acceptance criteria:** New inquiries surface an operator-visible “Action Required” alert and a linked review surface without cross-tenant leakage.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.inquiries tenant_apps.workflows`; `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert alerting/UI changes and keep inquiry creation/routing intact.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic CTE-02 - Brokerage / RFQ Engine (Branch A)

- [ ] **CTE-02.1 supplier-match-engine-for-broker-route**
  - **Status:** Blocked
  - **Why now:** Brokered inquiries need a deterministic supplier target list before any outbound RFQ can be generated.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 2
  - **Scope:** Build the supplier-match service that takes a broker-routed inquiry and returns eligible suppliers based on master product/protein, tenant-safe supplier data, and any required commercial filters.
  - **Non-goals:** No outbound email yet.
  - **Primary domain:** backend/matching
  - **Likely touched paths:** `backend/tenant_apps/inquiries/`, `backend/tenant_apps/suppliers/`, `backend/apps/system/models/product.py`, new matching service/tests
  - **Dependencies:** CTE-01.4
  - **Blockers:** CTE-01.4
  - **Acceptance criteria:** Broker-routed inquiries can produce a deterministic supplier candidate list keyed to the master product/protein contract.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.inquiries tenant_apps.suppliers apps.system`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert supplier matching service only; broker inquiries remain manually sourced.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **CTE-02.2 outbound-supplier-rfq-email-service-and-audit-log**
  - **Status:** Blocked
  - **Why now:** Once suppliers are matched, the engine needs a canonical outbound RFQ send path and audit trail rather than ad hoc emails.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 2
  - **Scope:** Implement the outbound supplier RFQ email service for brokered inquiries, persist send/audit records, and tie outbound messages to the inquiry/state machine.
  - **Non-goals:** No reply parsing yet.
  - **Primary domain:** backend/integrations
  - **Likely touched paths:** `backend/tenant_apps/ai_assistant/swarm/executor.py`, `backend/apps/email_integration/`, `backend/apps/integrations/`, `backend/tenant_apps/inquiries/`, related tests
  - **Dependencies:** CTE-02.1
  - **Blockers:** CTE-02.1
  - **Acceptance criteria:** The engine can send RFQs to matched suppliers and persist enough audit metadata to correlate future replies back to the inquiry.
  - **Validation commands:** `cd backend && python manage.py test apps.integrations apps.email_integration tenant_apps.inquiries tenant_apps.ai_assistant`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Disable RFQ send path and retain the audit log for operator replay before reverting integration code.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **CTE-02.3 structured-supplier-reply-parser-and-quote-normalization**
  - **Status:** Blocked
  - **Why now:** Supplier replies need deterministic quote extraction before any draft purchase order can be created safely.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 2
  - **Scope:** Enhance inbound reply parsing to use OpenAI structured outputs for supplier quote replies, normalize affirmative/price/quantity/lead-time data, and tie parsed quotes back to the originating inquiry/RFQ.
  - **Non-goals:** No auto-approval or outbound PO send.
  - **Primary domain:** backend/ai/integrations
  - **Likely touched paths:** `backend/apps/integrations/{signals.py,models.py}`, `backend/tenant_apps/integrations/services/email_ingestion.py`, `backend/tenant_apps/ai_assistant/`, `backend/tenant_apps/inquiries/`, tests
  - **Dependencies:** CTE-02.2
  - **Blockers:** CTE-02.2
  - **Acceptance criteria:** Supplier replies can be normalized into quote payloads with explicit confidence/error states and no freeform draft-order guessing.
  - **Validation commands:** `cd backend && python manage.py test apps.integrations tenant_apps.integrations tenant_apps.ai_assistant tenant_apps.inquiries`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Disable supplier-reply automation and preserve normalized quote journals/source-email lineage for manual review.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **CTE-02.4 draft-supplier-purchase-order-generation-from-quotes**
  - **Status:** Blocked
  - **Why now:** Normalized quotes should create trader-reviewable supplier POs instead of forcing manual re-entry.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 2
  - **Scope:** Generate draft `PurchaseOrder` records from accepted/qualifying supplier quote replies, persist linkage back to the originating inquiry and quote payload, and move the new order into the approval flow rather than sending it externally.
  - **Non-goals:** No automatic supplier send; no sales-order generation yet.
  - **Primary domain:** backend/orders
  - **Likely touched paths:** `backend/tenant_apps/purchase_orders/`, `backend/tenant_apps/inquiries/`, `backend/apps/integrations/`, additive tests/migrations if needed
  - **Dependencies:** CTE-02.3
  - **Blockers:** CTE-02.3
  - **Acceptance criteria:** Supplier quote replies can create draft `PurchaseOrder` rows with exact inquiry/source linkage and explicit pending-review state.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.purchase_orders tenant_apps.inquiries apps.integrations`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert draft-order generation and preserve quote journals for manual PO creation.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic CTE-03 - Human-in-the-loop approval flow

- [ ] **CTE-03.1 generic-order-approval-state-machine-contract**
  - **Status:** Blocked
  - **Why now:** Supplier, sales, and carrier documents need one explicit approval lifecycle before PDF generation and outbound sends can be safely automated.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 3
  - **Scope:** Design and implement the generic approval-state contract that maps `PurchaseOrder`, `SalesOrder`, and `CarrierPurchaseOrder` onto `draft` -> `pending_review` -> `approved`, including transition auditability and compatibility with existing status enums.
  - **Non-goals:** No review UI yet.
  - **Primary domain:** backend/state machine
  - **Likely touched paths:** `backend/tenant_apps/{purchase_orders,sales_orders}/models.py`, shared approval service/state module, serializers/tests, additive migrations if needed
  - **Dependencies:** CTE-02.4
  - **Blockers:** CTE-02.4
  - **Acceptance criteria:** One shared approval contract exists for all three commercial document types without breaking existing order APIs.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.purchase_orders tenant_apps.sales_orders`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert approval contract/service and keep document creation in draft/manual status.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **CTE-03.2 supplier-po-review-and-approve-screen**
  - **Status:** Blocked
  - **Why now:** Traders need a purpose-built review surface to inspect draft supplier POs before the engine commits externally.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 3
  - **Scope:** Build the supplier-PO review/approve UI and API flow that surfaces draft source data, inquiry lineage, parsed quote details, and approval actions on top of the generic approval contract.
  - **Non-goals:** No sales-order or carrier approval screens yet.
  - **Primary domain:** frontend/backend
  - **Likely touched paths:** `frontend/src/pages/` trading/order review surfaces, `frontend/src/services/`, `backend/tenant_apps/purchase_orders/{views.py,serializers.py,tests.py}`, related navigation/tests
  - **Dependencies:** CTE-03.1
  - **Blockers:** CTE-03.1
  - **Acceptance criteria:** Operators can review and approve a draft supplier PO from a dedicated screen without touching generic editor/workflow builder UI.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.purchase_orders`; `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert the review UI/API and preserve draft orders plus approval metadata.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **CTE-03.3 supplier-po-approved-pdf-generation-and-email-send**
  - **Status:** Blocked
  - **Why now:** Supplier PO approval should eliminate document busywork and send the approved commitment immediately through a deterministic side-effect path.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 3
  - **Scope:** Tie `PurchaseOrder` approval transitions to PDF generation and supplier outbound email, making both side effects idempotent, auditable, and driven by explicit approved-state changes rather than ad hoc UI actions.
  - **Non-goals:** No customer/carrier sends yet.
  - **Primary domain:** backend/documents/integrations
  - **Likely touched paths:** `backend/tenant_apps/purchase_orders/`, `backend/tenant_apps/workflows/services/action_executor.py`, document-generation services, email send services, related tests
  - **Dependencies:** CTE-03.2
  - **Blockers:** CTE-03.2
  - **Acceptance criteria:**
    1. Approving a supplier PO generates the approved PDF exactly once.
    2. The supplier email send is tied to the same approval transition and persists audit/send evidence.
    3. Repeated approval clicks or retries do not duplicate sends/documents.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.purchase_orders tenant_apps.workflows apps.integrations`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Disable approval side effects first, preserving approved-state data and audit logs before reverting PDF/email code.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic CTE-04 - Sales & logistics cascade

- [ ] **CTE-04.1 draft-sales-order-generation-from-fulfill-or-approved-source**
  - **Status:** Blocked
  - **Why now:** The engine needs one deterministic way to create draft sales orders either directly from `FULFILL` inquiries or from approved supplier sourcing.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 4
  - **Scope:** Auto-generate draft `SalesOrder` rows from either (a) direct `FULFILL` inquiry routing or (b) approved supplier POs, persisting route/source lineage and avoiding duplicate sales-order creation.
  - **Non-goals:** No customer send yet.
  - **Primary domain:** backend/orders
  - **Likely touched paths:** `backend/tenant_apps/inquiries/`, `backend/tenant_apps/sales_orders/`, `backend/tenant_apps/purchase_orders/`, related tests
  - **Dependencies:** CTE-03.3
  - **Blockers:** CTE-03.3
  - **Acceptance criteria:** A single draft `SalesOrder` creation path exists for both happy-path branches, with explicit source linkage back to inquiry and/or supplier PO.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.sales_orders tenant_apps.purchase_orders tenant_apps.inquiries`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert draft sales-order generation and preserve upstream inquiry/supplier-PO approvals.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **CTE-04.2 sales-order-approval-pdf-and-customer-email**
  - **Status:** Blocked
  - **Why now:** Customer-facing commitments need the same approval/PDF/email rigor as supplier POs before the engine can claim end-to-end automation.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 4
  - **Scope:** Extend the generic approval flow to `SalesOrder`, build the customer review/approve/send path, and tie customer-facing PDF generation plus outbound email to the approved sales-order transition.
  - **Non-goals:** No carrier RFQ yet.
  - **Primary domain:** frontend/backend/documents
  - **Likely touched paths:** `backend/tenant_apps/sales_orders/`, document-generation/email services, customer-facing review UI/services/tests
  - **Dependencies:** CTE-04.1
  - **Blockers:** CTE-04.1
  - **Acceptance criteria:** Sales-order approval generates the customer PDF/email exactly once and keeps explicit audit/send history tied to the approved order.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.sales_orders apps.integrations tenant_apps.workflows`; `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Disable sales-order approval side effects before reverting state/UI changes.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **CTE-04.3 carrier-rfq-match-and-outbound-freight-inquiry**
  - **Status:** Blocked
  - **Why now:** Once the commercial trade is approved, logistics procurement needs the same deterministic RFQ fan-out for carriers.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 4
  - **Scope:** Match carriers/logistics providers for approved sales/order lanes and send outbound freight inquiry RFQs tied to the source sales order and/or supplier PO.
  - **Non-goals:** No carrier reply parsing yet.
  - **Primary domain:** backend/logistics/integrations
  - **Likely touched paths:** `backend/tenant_apps/carriers/`, `backend/tenant_apps/purchase_orders/`, `backend/tenant_apps/sales_orders/`, outbound email services/tests
  - **Dependencies:** CTE-04.2
  - **Blockers:** CTE-04.2
  - **Acceptance criteria:** Approved trades can generate auditable outbound carrier RFQs with explicit source-order linkage and recipient selection rules.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.purchase_orders tenant_apps.sales_orders tenant_apps.carriers apps.integrations`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** Medium
  - **Rollback:** Disable carrier RFQ send path and retain source-order linkage for manual logistics handling.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **CTE-04.4 structured-carrier-reply-parser-and-draft-carrier-po**
  - **Status:** Blocked
  - **Why now:** Carrier responses need to become draft logistics commitments instead of staying trapped in unstructured inbox replies.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 4
  - **Scope:** Parse carrier replies with OpenAI structured outputs, normalize freight quote/acceptance data, and generate draft `CarrierPurchaseOrder` rows linked to the originating trade documents.
  - **Non-goals:** No auto-approval or auto-dispatch.
  - **Primary domain:** backend/ai/logistics
  - **Likely touched paths:** `backend/apps/integrations/`, `backend/tenant_apps/purchase_orders/`, `backend/tenant_apps/ai_assistant/`, `backend/tenant_apps/carriers/`, tests
  - **Dependencies:** CTE-04.3
  - **Blockers:** CTE-04.3
  - **Acceptance criteria:** Positive carrier replies can create draft `CarrierPurchaseOrder` rows with source-order lineage and explicit confidence/error handling.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.purchase_orders tenant_apps.carriers tenant_apps.ai_assistant apps.integrations`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Disable carrier-reply automation and preserve normalized freight quotes/source-email journals for manual carrier PO creation.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **CTE-04.5 hardcoded-happy-path-orchestrator-and-end-to-end-regressions**
  - **Status:** Blocked
  - **Why now:** The final value of Phase 16 is the deterministic end-to-end happy path, not a collection of isolated document generators.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 4
  - **Scope:** Wire the hardcoded state-machine orchestrator across inquiry routing, sourcing, approval, sales, and logistics; add end-to-end regression coverage and operator audit surfaces proving the happy path is traceable from source inquiry to downstream commercial documents.
  - **Non-goals:** No visual editor mapping yet.
  - **Primary domain:** backend/frontend integration
  - **Likely touched paths:** orchestration services across `tenant_apps/inquiries`, `tenant_apps/purchase_orders`, `tenant_apps/sales_orders`, notification/review UI surfaces, end-to-end tests, `MASTER_PLAN.md`
  - **Dependencies:** CTE-04.4
  - **Blockers:** CTE-04.4
  - **Acceptance criteria:**
    1. The hardcoded happy path runs deterministically for both `FULFILL` and `BROKER` branches.
    2. Operators can trace the inquiry -> supplier PO -> sales order -> carrier PO chain in one coherent audit path.
    3. The system is ready for a later visual editor to map onto the same state machine instead of inventing separate runtime logic.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `cd backend && python manage.py test tenant_apps.inquiries tenant_apps.purchase_orders tenant_apps.sales_orders apps.integrations tenant_apps.ai_assistant`; `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Disable orchestration entrypoints first and keep all existing document models/audit history intact while reverting the hardcoded engine wiring.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic CTE-05 - Trade lineage & traceability

- [ ] **CTE-05.1 trade-session-lineage-contract-and-schema**
  - **Status:** Blocked
  - **Why now:** Without a durable lineage identifier, operators cannot prove which inquiry or inbound email spawned a downstream supplier/sales/carrier document.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / 16b / Epic 5
  - **Scope:** Design and add the canonical `trade_id` / `TradeSession` lineage contract generated at inquiry creation and cascaded into `PurchaseOrder`, `SalesOrder`, and `CarrierPurchaseOrder`, including source-email linkage fields and additive schema rules.
  - **Non-goals:** No lineage UI yet.
  - **Primary domain:** backend/contracts
  - **Likely touched paths:** `backend/tenant_apps/inquiries/`, `backend/tenant_apps/purchase_orders/`, `backend/tenant_apps/sales_orders/`, `backend/apps/integrations/`, additive migrations/tests, `manifests/RLS_POLICIES.md`
  - **Dependencies:** CTE-04.5
  - **Blockers:** CTE-04.5
  - **Acceptance criteria:**
    1. A durable lineage key exists at the inquiry root and can be followed across downstream commercial documents.
    2. Lineage preserves enough source-email provenance to answer which inbound message initiated the trade.
    3. The schema is additive and tenant-safe.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.inquiries tenant_apps.purchase_orders tenant_apps.sales_orders apps.integrations`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert additive lineage schema together and preserve existing inquiry/order links.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **CTE-05.2 trade-lineage-visualization-on-detail-surfaces**
  - **Status:** Blocked
  - **Why now:** A lineage key only creates operator value when users can see the trade path and current state directly on detail pages.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / 16b / Epic 5
  - **Scope:** Build a lineage visualization component for relevant detail screens that renders inquiry -> supplier PO -> sales order -> carrier PO progression plus current state and exception markers.
  - **Non-goals:** No new orchestration logic.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/pages/**/Detail*.tsx`, new lineage component(s), `frontend/src/services/`, supporting backend serializers/tests
  - **Dependencies:** CTE-05.1
  - **Blockers:** CTE-05.1
  - **Acceptance criteria:** Operators can open a downstream document and see the complete trade lineage and current workflow state without log-diving.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`; `cd backend && python manage.py test tenant_apps.purchase_orders tenant_apps.sales_orders`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert lineage UI/serializer additions while preserving the backend lineage data.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic CTE-06 - Event-driven state transitions (Saga Pattern)

- [ ] **CTE-06.1 domain-event-contract-for-approved-trade-transitions**
  - **Status:** Blocked
  - **Why now:** The happy path is currently planned as deterministic, but downstream state changes will timeout or partially fail if approval side effects stay synchronous.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / 16b / Epic 6
  - **Scope:** Define the domain-event contract for trade-state transitions (e.g. `supplier_po_approved`, `sales_order_approved`, `carrier_po_drafted`) with event payload shape, replay/idempotency semantics, and routing rules.
  - **Non-goals:** No Celery consumers yet.
  - **Primary domain:** backend/contracts
  - **Likely touched paths:** new event contract module/service under `backend/apps/core/` or `backend/tenant_apps/`, order/inquiry services/tests, `MASTER_PLAN.md`
  - **Dependencies:** CTE-05.2
  - **Blockers:** CTE-05.2
  - **Acceptance criteria:** A single explicit event contract exists for approval-driven downstream state transitions, including payload lineage and retry expectations.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.purchase_orders tenant_apps.sales_orders apps.core`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert event-contract scaffolding only; synchronous/manual behavior remains intact.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **CTE-06.2 celery-saga-consumers-for-trade-side-effects**
  - **Status:** Blocked
  - **Why now:** PDF generation, outbound email, and downstream entity creation must move off the request thread into reliable asynchronous consumers.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / 16b / Epic 6
  - **Scope:** Implement Celery/Saga consumers that react to approved-state domain events and perform downstream work such as generating sales orders, blasting PDFs/emails, and progressing logistics state.
  - **Non-goals:** No exception dashboard yet.
  - **Primary domain:** backend/async
  - **Likely touched paths:** `backend/projectmeats/celery.py`, `backend/tenant_apps/**/tasks.py`, order/inquiry transition services, document/email services, tests
  - **Dependencies:** CTE-06.1
  - **Blockers:** CTE-06.1
  - **Acceptance criteria:**
    1. Approved trade transitions publish events that Celery workers consume asynchronously.
    2. Downstream PDF/email/entity-creation work no longer depends on one HTTP request finishing end-to-end.
    3. Retry behavior is explicit and replay-safe.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.purchase_orders tenant_apps.sales_orders apps.integrations tenant_apps.workflows`; `bash scripts/verify_golden_state.sh`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Disable Celery event consumers first and preserve published event/audit records before reverting saga wiring.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic CTE-07 - Concurrency locks & idempotency

- [ ] **CTE-07.1 select-for-update-transition-locking**
  - **Status:** Blocked
  - **Why now:** Double-click approvals and concurrent workers can create duplicate downstream transitions unless state mutations take row-level locks.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / 16b / Epic 7
  - **Scope:** Move order/inquiry approval and transition mutations into transactional services that use `select_for_update()` and explicit guard clauses before emitting events or creating downstream documents.
  - **Non-goals:** No idempotency-key API contract yet.
  - **Primary domain:** backend/concurrency
  - **Likely touched paths:** `backend/tenant_apps/{purchase_orders,sales_orders,inquiries}/views.py`, shared transition services, tests
  - **Dependencies:** CTE-06.2
  - **Blockers:** CTE-06.2
  - **Acceptance criteria:** Trade-state mutation paths explicitly use `select_for_update()` and cannot create duplicate downstream transitions under concurrent calls.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.purchase_orders tenant_apps.sales_orders tenant_apps.inquiries`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert locking/service-layer changes while preserving additive event contracts and lineage data.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **CTE-07.2 idempotency-key-enforcement-on-ai-and-webhook-creators**
  - **Status:** Blocked
  - **Why now:** AI retries, supplier/carrier email replays, and webhook duplication must not create multiple sales orders, carrier POs, or repeated sends.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / 16b / Epic 7
  - **Scope:** Add `idempotency_key` requirements/enforcement to AI-to-database creation endpoints, inbound automation hooks, and event-consumer create paths for downstream trade artifacts.
  - **Non-goals:** No operator intervention queue yet.
  - **Primary domain:** backend/idempotency
  - **Likely touched paths:** `backend/apps/integrations/`, `backend/tenant_apps/ai_assistant/`, `backend/tenant_apps/{inquiries,purchase_orders,sales_orders}/`, additive schema/tests if needed
  - **Dependencies:** CTE-07.1
  - **Blockers:** CTE-07.1
  - **Acceptance criteria:** All AI/webhook-driven trade-creation paths enforce `idempotency_key` semantics and safely treat retries as replays rather than new creations.
  - **Validation commands:** `cd backend && python manage.py test apps.integrations tenant_apps.ai_assistant tenant_apps.inquiries tenant_apps.purchase_orders tenant_apps.sales_orders`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Disable idempotent create-path enforcement only after preserving replay keys/audit data needed to reconcile duplicates.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic CTE-08 - Exception control tower (Dead Letter Queue)

- [ ] **CTE-08.1 exception-queue-model-and-trade-halt-contract**
  - **Status:** Blocked
  - **Why now:** Failed async steps currently risk stalling the trade silently unless the engine has a first-class dead-letter model and halt semantics.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / 16b / Epic 8
  - **Scope:** Add an `ExceptionQueue`/dead-letter model with trade-lineage linkage, failure reason codes, halt state, retry metadata, and ownership semantics for automated trade-step failures.
  - **Non-goals:** No dashboard UI yet.
  - **Primary domain:** backend/ops
  - **Likely touched paths:** new model/service under `backend/tenant_apps/` or `backend/apps/core/`, additive migrations, order/inquiry async services/tests, `manifests/RLS_POLICIES.md`
  - **Dependencies:** CTE-07.2
  - **Blockers:** CTE-07.2
  - **Acceptance criteria:** Any failed automated trade step can create an exception-queue row, halt the affected trade/session, and preserve lineage plus recovery context.
  - **Validation commands:** `cd backend && python manage.py test apps.core tenant_apps.inquiries tenant_apps.purchase_orders tenant_apps.sales_orders`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert additive exception-queue schema and leave failed trades in manual investigation mode.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **CTE-08.2 trades-requiring-intervention-dashboard**
  - **Status:** Blocked
  - **Why now:** Operators need a dedicated control tower to see halted trades, understand failure causes, and recover them without database spelunking.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / 16b / Epic 8
  - **Scope:** Build the “Trades Requiring Intervention” dashboard and supporting APIs, surfacing exception-queue entries, lineage context, current trade state, and operator recovery affordances.
  - **Non-goals:** No automated self-healing beyond explicit retry/requeue controls.
  - **Primary domain:** frontend/backend operations
  - **Likely touched paths:** new frontend dashboard page/components, supporting backend serializers/views/services, notification hooks, tests
  - **Dependencies:** CTE-08.1
  - **Blockers:** CTE-08.1
  - **Acceptance criteria:** Failed automated trade steps become visible in a dedicated operator dashboard with actionable lineage and intervention context.
  - **Validation commands:** `cd backend && python manage.py test apps.core tenant_apps.inquiries tenant_apps.purchase_orders tenant_apps.sales_orders`; `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert the dashboard/UI/API while preserving exception-queue data for manual recovery.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic AMB-01 - Next-Best-Action (NBA) engine

- [ ] **AMB-01.1 contextual-suggestion-contract-and-heuristic-rules**
  - **Status:** Blocked
  - **Why now:** Ambient AI cannot execute safely until there is one canonical suggestion payload and one deterministic rule layer that names what context is evaluated per entity.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 19 / Epic AMB-01
  - **Scope:** Define the `POST /api/v1/ai-assistant/suggestions/contextual/` contract (`entity_type`, `entity_id`, `current_state`), suggestion payload schema, heuristic rule inputs/outputs, cache semantics, and LLM-bounded escalation rules.
  - **Non-goals:** No UI surface or executable actions yet.
  - **Primary domain:** backend/docs/ai
  - **Likely touched paths:** `backend/tenant_apps/ai_assistant/serializers.py`, `backend/tenant_apps/ai_assistant/views.py`, `backend/tenant_apps/ai_assistant/services/`, `openapi-schema.json`, `manifests/openapi/openapi-schema.baseline.json`, `MASTER_PLAN.md`
  - **Dependencies:** CTE-08.2
  - **Blockers:** CTE-08.2 and all earlier unchecked tickets remain ahead in file order.
  - **Acceptance criteria:** The contract names request/response shape, confidence/rationale fields, cache behavior, and deterministic heuristic-first escalation into `gpt-4o-mini` without implementation guesswork.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `cd backend && python manage.py spectacular --validate --file /tmp/projectmeats-openapi.yaml`
  - **Tenant/RLS impact:** Medium; context lookups must remain tenant-scoped and fail closed when entity ownership is ambiguous.
  - **Secrets/infra impact:** Medium; LLM use depends on existing AI credentials but must degrade gracefully when absent.
  - **Risk level:** Medium
  - **Rollback:** Revert the additive contract/docs baseline only; no runtime suggestion endpoint should ship from this ticket.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **AMB-01.2 contextual-suggestions-endpoint-and-service**
  - **Status:** Blocked
  - **Why now:** Record pages need a fast backend suggestion source before any ambient UI can render contextual recommendations.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 19 / Epic AMB-01
  - **Scope:** Implement the contextual suggestion service and `POST /api/v1/ai-assistant/suggestions/contextual/` endpoint with tenant-safe entity loading, heuristic evaluation, bounded `gpt-4o-mini` enrichment, telemetry, and graceful no-suggestion fallbacks.
  - **Non-goals:** No page-header UI integration yet.
  - **Primary domain:** backend/ai
  - **Likely touched paths:** `backend/tenant_apps/ai_assistant/views.py`, `backend/tenant_apps/ai_assistant/services/`, `backend/tenant_apps/ai_assistant/tests/`, `backend/projectmeats/urls.py`, `openapi-schema.json`, `manifests/openapi/openapi-schema.baseline.json`
  - **Dependencies:** AMB-01.1
  - **Blockers:** AMB-01.1
  - **Acceptance criteria:** The endpoint returns deterministic structured suggestions, falls back cleanly when AI infra is unavailable, and never evaluates or returns cross-tenant entity context.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.ai_assistant apps.tenants`; `cd backend && python manage.py spectacular --validate --file /tmp/projectmeats-openapi.yaml`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Feature-flag or disable the endpoint/service while leaving additive telemetry tables or schema in place if needed.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic AMB-02 - Inline page suggestion cards

- [ ] **AMB-02.1 ambient-suggestions-component-and-service-hook**
  - **Status:** Blocked
  - **Why now:** The frontend needs one stable ambient suggestion surface before record pages can render proactive AI recommendations consistently.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 19 / Epic AMB-02
  - **Scope:** Build `AmbientSuggestions`, add the service-layer client/hook for contextual suggestions, and ensure query keys/dependencies stay memoized and page-safe.
  - **Non-goals:** No record-page injection or action execution yet.
  - **Primary domain:** frontend
  - **Likely touched paths:** new `frontend/src/components/AIAssistant/AmbientSuggestions.tsx`, `frontend/src/services/aiService.ts`, new hook under `frontend/src/hooks/`, related tests
  - **Dependencies:** AMB-01.2
  - **Blockers:** AMB-01.2
  - **Acceptance criteria:** A standalone component can fetch and render contextual suggestions via the approved service layer without unstable query identities or chat-widget coupling.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci -- AmbientSuggestions`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** Low
  - **Risk level:** Medium
  - **Rollback:** Revert the new component/hook and leave backend suggestion generation untouched.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **AMB-02.2 record-page-header-integration-and-action-wiring**
  - **Status:** Blocked
  - **Why now:** Ambient recommendations only become useful once the record header surfaces can display and execute them in context.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 19 / Epic AMB-02
  - **Scope:** Inject `AmbientSuggestions` into `UniversalEntityRecordPage.tsx` and `EntityProfileHeader.tsx`, add one-click execution wiring for safe actions, and keep the banner subtle/dismissible.
  - **Non-goals:** No anomaly detection or email drafting yet.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/pages/UniversalEntityRecordPage.tsx`, `frontend/src/components/Shared/EntityProfileHeader.tsx`, `frontend/src/components/AIAssistant/`, related tests/E2E
  - **Dependencies:** AMB-02.1
  - **Blockers:** AMB-02.1
  - **Acceptance criteria:** Record pages render a stable, animated ambient suggestion banner only when suggestions exist, and actions route through approved service-layer APIs without chat-widget dependence.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** Low
  - **Risk level:** Medium
  - **Rollback:** Remove the header injections and keep the standalone component available for future use.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic AMB-03 - Predictive anomaly detection

- [ ] **AMB-03.1 product-anomaly-baseline-service-and-threshold-contract**
  - **Status:** Blocked
  - **Why now:** Form-level anomaly warnings need one canonical baseline/threshold service before any UI can warn operators about suspicious values.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 19 / Epic AMB-03
  - **Scope:** Define and implement the 90-day historical baseline service for price/weight/value outliers, including per-product aggregation rules, threshold semantics, and tenant-safe access patterns.
  - **Non-goals:** No form UX yet.
  - **Primary domain:** backend/data
  - **Likely touched paths:** `backend/tenant_apps/ai_assistant/services/` or `backend/apps/core/services/`, relevant transactional apps/tests, optional analytics endpoint wiring
  - **Dependencies:** AMB-02.2
  - **Blockers:** AMB-02.2
  - **Acceptance criteria:** A deterministic service can evaluate whether submitted values deviate materially from tenant history, returning baseline context suitable for a soft warning.
  - **Validation commands:** `cd backend && python manage.py test apps.core tenant_apps.products tenant_apps.sales_orders tenant_apps.purchase_orders`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert the additive baseline service and any supporting endpoint without altering stored transactional data.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **AMB-03.2 universal-form-soft-warning-anomaly-flow**
  - **Status:** Blocked
  - **Why now:** Operators need anomaly feedback inside the save flow instead of discovering suspect values after records are committed.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 19 / Epic AMB-03
  - **Scope:** Hook anomaly checks into `UniversalEntityForm` save/validation flow, render a soft confirmation warning when values exceed thresholds, and preserve explicit operator override behavior.
  - **Non-goals:** No autonomous correction of submitted values.
  - **Primary domain:** frontend/backend
  - **Likely touched paths:** `frontend/src/components/Shared/UniversalEntityForm.tsx`, `frontend/src/services/aiService.ts` or a dedicated anomaly service, related backend endpoint/tests
  - **Dependencies:** AMB-03.1
  - **Blockers:** AMB-03.1
  - **Acceptance criteria:** Relevant forms surface an advisory anomaly warning with 90-day average context before save, and proceeding requires an explicit user confirmation.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`; `cd backend && python manage.py test tenant_apps.ai_assistant`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** Low
  - **Risk level:** High
  - **Rollback:** Disable the form hook/warning UI first while preserving the baseline service for future reuse.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic AMB-04 - Contextual email drafting

- [ ] **AMB-04.1 contextual-email-draft-service-and-outlook-contract**
  - **Status:** Blocked
  - **Why now:** Supplier/customer pages cannot offer hyper-personalized draft actions until one canonical backend service can summarize recent order, balance, and delay context into a safe email draft payload.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 19 / Epic AMB-04
  - **Scope:** Build the contextual email-draft service/contract that reads the last five orders, outstanding balances, and recent delays, then generates an Outlook-ready draft payload with reviewable subject/body metadata.
  - **Non-goals:** No page action or send UI yet.
  - **Primary domain:** backend/ai/integrations
  - **Likely touched paths:** `backend/tenant_apps/ai_assistant/services/`, `backend/apps/integrations/`, `backend/tenant_apps/{customers,suppliers,sales_orders,invoices}/`, related tests
  - **Dependencies:** AMB-03.2
  - **Blockers:** AMB-03.2
  - **Acceptance criteria:** The service produces tenant-safe draft payloads grounded in recent business context and can gracefully decline when Outlook integration/auth is unavailable.
  - **Validation commands:** `cd backend && python manage.py test apps.integrations tenant_apps.ai_assistant tenant_apps.customers tenant_apps.suppliers tenant_apps.invoices`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** Medium
  - **Rollback:** Disable the draft service/action while preserving existing Outlook integration flows.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **AMB-04.2 supplier-customer-ambient-draft-actions**
  - **Status:** Blocked
  - **Why now:** The final operator value is the one-click ambient action on supplier/customer records that opens a ready-to-review draft.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 19 / Epic AMB-04
  - **Scope:** Add ambient draft-email actions on Supplier and Customer detail pages, wire them to the contextual draft service, and hand the generated payload into the existing Outlook review/send flow.
  - **Non-goals:** No autonomous send behavior.
  - **Primary domain:** frontend/integrations
  - **Likely touched paths:** `frontend/src/pages/Suppliers/`, `frontend/src/pages/Customers/`, `frontend/src/components/AIAssistant/`, `frontend/src/services/`, related tests/E2E
  - **Dependencies:** AMB-04.1
  - **Blockers:** AMB-04.1
  - **Acceptance criteria:** Supplier/customer pages expose a reviewable ambient email-draft action only when context exists, and the final send continues through the approved Outlook integration path.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`; `cd backend && python manage.py test apps.integrations`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** Medium
  - **Risk level:** Medium
  - **Rollback:** Remove the ambient page actions and keep the backend draft service disabled for later reuse.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`
