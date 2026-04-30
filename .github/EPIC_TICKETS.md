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

- [ ] **GA-01.4 etl-transactional-import-and-reconciliation**
  - **Status:** Ready
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

- [ ] **GA-02.1 infra-desired-state-and-iac-scaffold**
  - **Status:** Blocked
  - **Why now:** Launch operations currently rely on workflow/runtime knowledge that needs a codified desired state before DR and autoscaling changes can be trusted.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 2
  - **Scope:** Inventory the current deploy/runtime topology and create the first IaC scaffold for launch-critical resources (droplets, workers, Redis, backup storage, alerting assumptions) without contradicting the Golden Pipeline.
  - **Non-goals:** No production cutover or environment secret renaming.
  - **Primary domain:** ops/docs
  - **Likely touched paths:** `deploy/`, new `deploy/terraform/`, `.github/workflows/reusable-deploy.yml`, `docs/architecture/INFRASTRUCTURE_ARCHITECTURE.md`, `docs/runbooks/INCIDENT_RESPONSE.md`
  - **Dependencies:** GA-01.4
  - **Blockers:** GA-01.4 keeps launch-critical data migration as the first execution lane.
  - **Acceptance criteria:** One deterministic desired-state document/scaffold exists, maps to current workflow reality, and names what is still manually managed versus codified.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** High
  - **Risk level:** Medium
  - **Rollback:** Revert IaC/docs scaffolding only; do not change live infrastructure until follow-up tickets land.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **GA-02.2 postgres-pitr-verification-and-restore-drill**
  - **Status:** Blocked
  - **Why now:** Pre-migration backups exist, but GA needs provable PITR/restore capability rather than ad hoc dump retention.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 2
  - **Scope:** Add PITR validation and a restore-drill runbook/workflow that verifies backups can be restored safely and documents RPO/RTO expectations.
  - **Non-goals:** No database engine migration.
  - **Primary domain:** ops/backend
  - **Likely touched paths:** `.github/workflows/reusable-deploy.yml`, `.github/workflows/99-ops-management-command.yml`, `docs/guides/DATABASE_SYNC_GUIDE.md`, `docs/runbooks/DISASTER_RECOVERY.md`, `manifests/env.manifest.json`
  - **Dependencies:** GA-02.1
  - **Blockers:** GA-02.1
  - **Acceptance criteria:** PITR/restore steps are executable from repo docs/workflows, backup retention rules are explicit, and operators can prove a restore path before GA.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`; `python config/manage_env.py audit`
  - **Tenant/RLS impact:** Medium; restored environments must preserve tenant isolation guarantees.
  - **Secrets/infra impact:** High
  - **Risk level:** High
  - **Rollback:** Revert workflow/doc changes if the restore drill introduces unsafe or contradictory operational guidance.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **GA-02.3 celery-worker-scaling-envelope**
  - **Status:** Blocked
  - **Why now:** Launch traffic and new async workloads need bounded worker concurrency/autoscaling guidance before queues back up under real tenants.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 2
  - **Scope:** Define and enforce Celery worker scaling envelopes, queue priorities, and saturation guardrails for email ingestion, workform execution, AI processing, and future ETL/import jobs.
  - **Non-goals:** No new async product features.
  - **Primary domain:** backend/ops
  - **Likely touched paths:** `backend/projectmeats/settings/base.py`, `backend/projectmeats/celery.py`, `backend/apps/{integrations,system,core}/tasks.py`, `docs/runbooks/DISASTER_RECOVERY.md`, `deploy/terraform/`
  - **Dependencies:** GA-02.1
  - **Blockers:** GA-02.1
  - **Acceptance criteria:** Worker concurrency/autoscale settings are explicit per workload class, queue backlog thresholds are documented, and task execution stays tenant-safe under worker reuse.
  - **Validation commands:** `cd backend && python manage.py test apps.integrations apps.system`; `bash .github/scripts/check_infrastructure.sh`
  - **Tenant/RLS impact:** High in worker contexts
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Revert scaling config/docs and restore previous Celery settings if queue health regresses.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **GA-02.4 redis-eviction-and-queue-health-guardrails**
  - **Status:** Blocked
  - **Why now:** Redis underpins Celery and caching, so GA needs explicit memory policy and queue health guardrails before offline queues and ETL bursts arrive.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 2
  - **Scope:** Define Redis eviction policy, queue-health checks, and operator guidance for broker saturation or stale task buildup.
  - **Non-goals:** No new cache-heavy feature work.
  - **Primary domain:** ops/backend
  - **Likely touched paths:** `deploy/`, `docs/runbooks/DISASTER_RECOVERY.md`, `docs/guides/DEVELOPMENT_WORKFLOW.md`, `manifests/env.manifest.json`, backend health/diagnostic scripts
  - **Dependencies:** GA-02.3
  - **Blockers:** GA-02.3
  - **Acceptance criteria:** Redis memory/eviction policy is documented and validated, queue-health alarms/diagnostics exist, and operator steps for broker distress are explicit.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`; `python config/manage_env.py audit`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** Medium
  - **Risk level:** Medium
  - **Rollback:** Revert Redis/ops guidance and restore prior runtime settings if the new policy is unsafe.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic GA-03 - SOC 2 data governance

- [ ] **GA-03.1 retention-inventory-and-archive-contract**
  - **Status:** Blocked
  - **Why now:** GA needs a defensible retention strategy before operators start migrating or scaling historical data.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 3
  - **Scope:** Inventory which records must be retained, archived, masked, or exempted via legal hold, then define the archival contract and restore path.
  - **Non-goals:** No actual record archiving yet.
  - **Primary domain:** backend/docs
  - **Likely touched paths:** `backend/apps/core/services/data_governance.py`, `backend/apps/core/management/commands/`, `docs/runbooks/DATA_RETENTION.md`, `MASTER_PLAN.md`
  - **Dependencies:** GA-02.4
  - **Blockers:** GA-02.4
  - **Acceptance criteria:** The repo names the 7-year archive targets, exemptions, legal-hold model, and restore expectations without conflicting with current runtime behavior.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `cd backend && python manage.py test apps.core`
  - **Tenant/RLS impact:** High for archived tenant data
  - **Secrets/infra impact:** Low
  - **Risk level:** High
  - **Rollback:** Revert the retention contract/docs only; no records should move during this ticket.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **GA-03.2 seven-year-archive-command**
  - **Status:** Blocked
  - **Why now:** The retention contract is not enforceable until a dry-run-first archival command exists.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 3
  - **Scope:** Build the management command/service that archives or snapshots aged transactional records after 7 years, supports legal holds, and writes audit evidence.
  - **Non-goals:** No destructive purges of live rows without archive proofs.
  - **Primary domain:** backend
  - **Likely touched paths:** `backend/apps/core/services/data_governance.py`, `backend/apps/core/management/commands/archive_historical_records.py`, `backend/apps/core/tests/`, new migrations, `docs/runbooks/DATA_RETENTION.md`
  - **Dependencies:** GA-03.1
  - **Blockers:** GA-03.1
  - **Acceptance criteria:** Archive mode supports dry-run and execute paths, legal-hold records are skipped safely, and audit evidence records what moved when and why.
  - **Validation commands:** `cd backend && python manage.py test apps.core`; `cd backend && python manage.py archive_historical_records --dry-run`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium if archive storage configuration is added
  - **Risk level:** High
  - **Rollback:** Leave additive archive metadata in place, disable execute mode, and restore from archive manifests if needed.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **GA-03.3 pii-redaction-for-logging-and-sentry**
  - **Status:** Blocked
  - **Why now:** GA observability cannot expand while logs/APM still risk emitting raw emails, phone numbers, or payload fragments.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 3
  - **Scope:** Add central redaction filters for Django logging, Celery task logs, and Sentry events/spans; ensure sensitive fields are scrubbed before transport.
  - **Non-goals:** No product analytics dashboards.
  - **Primary domain:** backend/frontend observability
  - **Likely touched paths:** `backend/projectmeats/settings/base.py`, `backend/projectmeats/settings/production.py`, `frontend/src/utils/sentry.ts`, `frontend/src/utils/logger.ts`, `docs/runbooks/DATA_RETENTION.md`
  - **Dependencies:** GA-03.1
  - **Blockers:** GA-03.1
  - **Acceptance criteria:** Sensitive patterns are redacted centrally, regression tests prove redaction, and Sentry/log output remains diagnostically useful.
  - **Validation commands:** `cd backend && python manage.py test apps.core`; `npm -C frontend run verify-standards`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Revert filters atomically if they break observability, but never leave partially scrubbed paths in place.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **GA-03.4 governance-schedules-and-evidence-runbook**
  - **Status:** Blocked
  - **Why now:** Governance work is incomplete until archival/redaction have scheduled enforcement and operator evidence collection.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 3
  - **Scope:** Add scheduled enforcement hooks, evidence checklist/runbooks, and operational verification paths for retention/redaction posture.
  - **Non-goals:** No new customer-facing features.
  - **Primary domain:** ops/docs
  - **Likely touched paths:** `backend/projectmeats/celery.py`, `backend/apps/system/tasks.py`, `.github/workflows/99-ops-management-command.yml`, `docs/runbooks/DATA_RETENTION.md`, `docs/runbooks/INCIDENT_RESPONSE.md`
  - **Dependencies:** GA-03.2, GA-03.3
  - **Blockers:** GA-03.2 and GA-03.3
  - **Acceptance criteria:** Scheduled jobs and operator runbooks exist for archive/redaction checks, and evidence paths are explicit for audits.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `cd backend && python manage.py test apps.system apps.core`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** Medium
  - **Risk level:** Medium
  - **Rollback:** Revert scheduling/runbook changes together if they create noisy or unsafe operational loops.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic GA-04 - In-app user onboarding

- [ ] **GA-04.1 tour-provider-and-user-preference-contract**
  - **Status:** Blocked
  - **Why now:** New tenants currently land in a blank-feeling experience and tour state is scattered across local-only onboarding hooks.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 4
  - **Scope:** Standardize guided-tour orchestration by reusing `react-joyride`, `CockpitTour`, FlowEditor onboarding hooks, and `UserPreferences` so first-run state is durable per user.
  - **Non-goals:** No full empty-state rollout yet.
  - **Primary domain:** frontend/backend
  - **Likely touched paths:** `frontend/src/App.tsx`, `frontend/src/components/Cockpit/CockpitTour.tsx`, `frontend/src/components/Onboarding/`, `frontend/src/components/FlowEditor/hooks/useOnboardingTour.tsx`, `backend/apps/core/{models,serializers,views}.py`, new migrations/tests
  - **Dependencies:** GA-03.4
  - **Blockers:** GA-03.4
  - **Acceptance criteria:** Tour completion state uses one canonical storage shape, can be reset/replayed safely, and does not rely on page-specific localStorage flags alone.
  - **Validation commands:** `cd backend && python manage.py test apps.core`; `npm -C frontend run verify-standards`
  - **Tenant/RLS impact:** Low on shared user-preference data
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert provider/preference changes together and fall back to the existing Cockpit-local tour behavior.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **GA-04.2 cockpit-empty-state-system**
  - **Status:** Blocked
  - **Why now:** The first tenant experience should teach actions immediately on the dashboard instead of showing inert whitespace.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 4
  - **Scope:** Create a reusable empty-state pattern for dashboard/cockpit surfaces with direct CTA buttons and help text tailored to first-run workflows.
  - **Non-goals:** No rollout to every entity page yet.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/pages/Cockpit/CockpitDashboard.tsx`, `frontend/src/components/Admin/EmptyState.tsx`, `frontend/src/components/Widgets/`, `frontend/src/components/Onboarding/`
  - **Dependencies:** GA-04.1
  - **Blockers:** GA-04.1
  - **Acceptance criteria:** Cockpit/dashboard empty states route users directly into first actions and remain theme-compliant/accessibility-safe.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** None
  - **Risk level:** Low
  - **Rollback:** Revert the cockpit empty-state components without affecting existing data-fetch logic.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **GA-04.3 transactional-surface-empty-states**
  - **Status:** Blocked
  - **Why now:** Orders, freight, and document-heavy surfaces still need “create your first X” guidance to prevent first-run abandonment.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 4
  - **Scope:** Roll the empty-state CTA system through priority transaction/list surfaces (purchase orders, sales orders, freight orders, invoices, document vault-adjacent pages).
  - **Non-goals:** No redesign of mature populated states.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/pages/{PurchaseOrders.tsx,FreightOrders.tsx}`, `frontend/src/pages/SalesOrders/SalesOrders.tsx`, `frontend/src/pages/Accounting/Invoices.tsx`, `frontend/src/pages/Entities/UniversalEntityRecordPage.tsx`, shared empty-state components/tests
  - **Dependencies:** GA-04.2
  - **Blockers:** GA-04.2
  - **Acceptance criteria:** Priority transactional list/record surfaces show actionable first-run CTAs with no broken navigation paths.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** None
  - **Risk level:** Low
  - **Rollback:** Revert touched page-level empty-state branches only.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **GA-04.4 onboarding-telemetry-and-resume-controls**
  - **Status:** Blocked
  - **Why now:** GA needs evidence that onboarding works and lets users skip/resume without getting trapped.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 4
  - **Scope:** Track onboarding completion/skip/resume events and add a simple help/restart surface in the app shell.
  - **Non-goals:** No marketing analytics layer.
  - **Primary domain:** frontend/backend
  - **Likely touched paths:** `frontend/src/components/Layout/Header.tsx`, `frontend/src/components/Onboarding/`, `frontend/src/contexts/AuthContext.tsx`, `backend/apps/core/{models,serializers,views}.py`, tests
  - **Dependencies:** GA-04.1, GA-04.3
  - **Blockers:** GA-04.1 and GA-04.3
  - **Acceptance criteria:** Users can restart or dismiss tours intentionally, completion data is persisted predictably, and onboarding regressions are covered by tests.
  - **Validation commands:** `cd backend && python manage.py test apps.core`; `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Low
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert telemetry/resume controls while leaving the base tour provider intact.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic GA-05 - Edge resilience (PWA + optimistic UI)

- [ ] **GA-05.1 vite-pwa-app-shell-foundation**
  - **Status:** Blocked
  - **Why now:** Warehouse-mode resilience starts with a cacheable app shell and offline-safe bootstrap.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 5
  - **Scope:** Add the PWA/service-worker foundation to the Vite frontend, define offline cache boundaries, and ensure the app shell can render safely when the network drops temporarily.
  - **Non-goals:** No broad offline write queue yet.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/vite.config.ts`, `frontend/package.json`, `frontend/src/index.tsx`, `frontend/public/`, new `frontend/src/pwa/`
  - **Dependencies:** GA-04.4
  - **Blockers:** GA-04.4
  - **Acceptance criteria:** The frontend has one canonical service-worker/PWA registration path, the app shell caches without breaking authenticated boot, and build/test docs are updated.
  - **Validation commands:** `npm -C frontend run build`; `npm -C frontend run verify-standards`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** Low
  - **Risk level:** Medium
  - **Rollback:** Remove PWA registration and revert Vite/package changes together.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **GA-05.2 connectivity-state-and-offline-banner**
  - **Status:** Blocked
  - **Why now:** Users need immediate feedback when the network drops before we optimistically queue mutations.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 5
  - **Scope:** Add connectivity detection and a shared offline/reconnecting banner tied into the app shell and priority operational surfaces.
  - **Non-goals:** No queued mutation replay yet.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/App.tsx`, `frontend/src/components/Layout/Header.tsx`, new `frontend/src/contexts/ConnectivityContext.tsx`, `frontend/src/components/common/`
  - **Dependencies:** GA-05.1
  - **Blockers:** GA-05.1
  - **Acceptance criteria:** The app announces offline/reconnecting state clearly, does not spam re-renders, and remains accessible.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** None
  - **Risk level:** Low
  - **Rollback:** Revert the connectivity provider/banner and keep the app shell changes isolated.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **GA-05.3 warehouse-critical-optimistic-mutations**
  - **Status:** Blocked
  - **Why now:** Offline readiness matters most on status/delivery actions where field users expect instant feedback despite weak connectivity.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 5
  - **Scope:** Apply optimistic React Query mutations and replay-safe local queuing to the narrow set of warehouse/logistics-critical actions (for example delivered/arrived/status transitions).
  - **Non-goals:** No blanket optimistic behavior across all forms.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/components/Operations/documentOperations.ts`, `frontend/src/components/Operations/OperationalDocumentActions.tsx`, `frontend/src/hooks/useFavorites.ts`, new offline queue utilities/hooks, related tests
  - **Dependencies:** GA-05.2
  - **Blockers:** GA-05.2
  - **Acceptance criteria:** Priority mutations update the UI immediately, roll back cleanly on hard failure, and queue/replay safely through brief connectivity gaps.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Medium on client cache scoping
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert optimistic queueing on the targeted actions and fall back to current mutation/invalidation flow.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **GA-05.4 offline-replay-and-warehouse-e2e**
  - **Status:** Blocked
  - **Why now:** GA needs proof that optimistic/offline behavior survives reconnects and does not silently desync.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 14 / Epic 5
  - **Scope:** Add replay/recovery tests plus a rollout guard for offline mode on warehouse/logistics-critical surfaces.
  - **Non-goals:** No mobile-native offline implementation.
  - **Primary domain:** frontend/testing
  - **Likely touched paths:** `frontend/e2e/`, `frontend/src/contexts/ConnectivityContext.tsx`, `frontend/src/components/Operations/`, `frontend/src/pages/FreightOrders.tsx`, `frontend/src/pages/SalesOrders/`
  - **Dependencies:** GA-05.3
  - **Blockers:** GA-05.3
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

- [ ] **EH-01.1 drift-gate-depth**
  - **Status:** Blocked
  - **Why now:** The current golden verification is false-green for stale authority docs and workflow reality drift, which undermines every later ticket.
  - **Canonical source reference:** `MASTER_PLAN.md` -> P0/P1 CI guardrails + Phase 12
  - **Scope:** Expand repo drift validation so authoritative/current docs and workflow reality are checked together, and force `docs/reference/GOLDEN_PIPELINE.md` to act as a pointer or parity-checked reference to `docs/GOLDEN_PIPELINE.md` instead of an independent authority.
  - **Non-goals:** No secret policy generation, no deploy topology redesign, no product feature work.
  - **Primary domain:** CI/docs
  - **Likely touched paths:** `scripts/verify_golden_state.sh`, `.github/scripts/check_infrastructure.sh`, `.github/workflows/README.md`, `docs/guides/BRANCH_PROTECTION_SETUP.md`, `docs/reference/GOLDEN_PIPELINE.md`
  - **Dependencies:** EH-00.1
  - **Blockers:** Phase 14 GA tickets now define the canonical top-of-backlog work and must execute first
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

- [ ] **EH-01.2 manifest-required-secret-parity**
  - **Status:** Blocked
  - **Why now:** Secret requirements are still duplicated in workflow logic instead of being generated from the manifest.
  - **Canonical source reference:** `MASTER_PLAN.md` -> CI guardrails + Phase 12
  - **Scope:** Make required-secret behavior per lane derive from `manifests/env.manifest.json`.
  - **Non-goals:** No new secret creation, no unrelated workflow refactors.
  - **Primary domain:** CI/config
  - **Likely touched paths:** `manifests/env.manifest.json`, `.github/workflows/reusable-deploy.yml`, `.github/scripts/validate-environment.sh`, `config/manage_env.py`
  - **Dependencies:** EH-01.1
  - **Blockers:** EH-01.1 must land first so docs/workflow parity checks exist
  - **Acceptance criteria:** Workflow-required vs optional secrets match the manifest exactly and validation fails on divergence.
  - **Validation commands:** `python config/manage_env.py audit`; `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** High; touches deploy lanes and GitHub Environment secret expectations
  - **Risk level:** High
  - **Rollback:** Revert to last known good workflow/validator pair and rerun secret audit before retrying.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **EH-01.3 pr-security-gates-and-dependabot-scope**
  - **Status:** Blocked
  - **Why now:** PR validation lacks supply-chain/security depth and Dependabot can still auto-merge sensitive workflow/Docker changes.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 12
  - **Scope:** Add PR-time security gates and restrict bot auto-merge to safe dependency surfaces.
  - **Non-goals:** No full dependency remediation campaign.
  - **Primary domain:** CI/security
  - **Likely touched paths:** `.github/workflows/pr-validation.yml`, `.github/workflows/15-dependabot-merge-when-green.yml`, `.github/CODEOWNERS`
  - **Dependencies:** EH-01.2
  - **Blockers:** EH-01.2 should define manifest-driven expectations before stricter PR enforcement
  - **Acceptance criteria:** Critical workflow/Docker changes require human review and PR validation includes explicit security scanning.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** Medium
  - **Risk level:** Medium
  - **Rollback:** Revert the gating workflow and bot policy together if CI becomes unusable.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **EH-01.4 rollback-release-automation-alignment**
  - **Status:** Blocked
  - **Why now:** Rollback scripts/docs are stale and release automation is missing, which weakens every higher-risk change.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 12 / Operational excellence
  - **Scope:** Align rollback assets with reusable deploy reality and add explicit release workflow/governance.
  - **Non-goals:** No change to product runtime code.
  - **Primary domain:** ops/docs
  - **Likely touched paths:** `.github/scripts/deployment-rollback.sh`, `docs/runbooks/INCIDENT_RESPONSE.md`, `.github/workflows/*release*.yml`, `.github/workflows/README.md`
  - **Dependencies:** EH-01.3
  - **Blockers:** EH-01.3
  - **Acceptance criteria:** Rollback instructions match live deploy paths/ports and one release creation path is documented or automated.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** Medium
  - **Risk level:** Medium
  - **Rollback:** Revert to previous rollback doc/script versions if mismatches are introduced.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic EH-02 - Tenant isolation + data integrity

- [ ] **EH-02.1 fail-closed-tenant-rls-runtime**
  - **Status:** Blocked
  - **Why now:** Fail-open tenant/RLS behavior is the most dangerous correctness gap left in backend runtime.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Security / tenant isolation + Phase 12
  - **Scope:** Make tenant-scoped HTTP and task paths fail closed when tenant or RLS session state cannot be asserted.
  - **Non-goals:** No broad schema redesign beyond what is required for fail-closed behavior.
  - **Primary domain:** backend
  - **Likely touched paths:** `backend/apps/tenants/middleware.py`, `backend/apps/tenants/rls.py`, `backend/apps/core/tasks.py`, `backend/apps/tenants/tasks.py`, relevant regression tests
  - **Dependencies:** EH-01.2
  - **Blockers:** EH-01.2
  - **Acceptance criteria:** Tenant-scoped requests/tasks abort safely when RLS cannot be set, and regression tests cover the failure path.
  - **Validation commands:** `cd backend && python manage.py test apps.tenants apps.core.tests.test_audit_rls_compliance apps.system.tests.test_get_request_tenant_resolution tenant_apps.workflows.tests.test_viewset_tenant_fail_closed`; `bash scripts/verify_golden_state.sh`
  - **Tenant/RLS impact:** High; fail-closed behavior is the core objective
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Gate stricter behavior behind a flag only if absolutely necessary; never revert to silent cross-tenant continuation.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **EH-02.2 platform-idempotency-keys**
  - **Status:** Blocked
  - **Why now:** Duplicate POST/retry behavior remains ad hoc across uploads, executions, and integrations.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 12
  - **Scope:** Add a tenant-scoped idempotency layer and apply it to the first high-risk mutation endpoints.
  - **Non-goals:** No attempt to retrofit every POST endpoint in one PR.
  - **Primary domain:** backend
  - **Likely touched paths:** new middleware/store under `backend/apps/core/` or `backend/apps/system/`, `backend/tenant_apps/ai_assistant/views.py`, `backend/apps/system/workform_views.py`
  - **Dependencies:** EH-02.1
  - **Blockers:** EH-02.1
  - **Acceptance criteria:** Replayed requests with the same idempotency key do not duplicate writes for the targeted endpoints.
  - **Validation commands:** `cd backend && python manage.py test apps.system.tests.test_tenant_workform_execute_permissions apps.system.tests.test_workform_execute_circuit_breaker tenant_apps.ai_assistant`
  - **Tenant/RLS impact:** Medium; store must be tenant-aware
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Disable the middleware for the targeted routes and keep the persistence table additive.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **EH-02.3 chat-session-tenant-fk-rls**
  - **Status:** Blocked
  - **Why now:** AI chat persistence still relies on JSON-stamped tenant context instead of tenant-native storage.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 12 / Phase 13 dependency
  - **Scope:** Add `tenant` FK + RLS to `ChatSession` and `ChatMessage`, backfill, migrate reads/writes, and update `manifests/RLS_POLICIES.md` so the new policies are governed by the same registry as the rest of the platform.
  - **Non-goals:** No autonomy control plane yet.
  - **Primary domain:** backend
  - **Likely touched paths:** `backend/tenant_apps/ai_assistant/models.py`, `backend/tenant_apps/ai_assistant/views.py`, new migrations, `manifests/RLS_POLICIES.md`
  - **Dependencies:** EH-02.1
  - **Blockers:** EH-02.1
  - **Acceptance criteria:** Chat data is tenant-native, tenant-scoped, and covered by RLS regression tests.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.ai_assistant apps.core.tests.test_audit_rls_compliance`; `cd backend && python manage.py showmigrations | grep ai_assistant`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Dual-read/write during rollout; revert readers before removing additive schema.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic EH-03 - Contract-first platform

- [ ] **EH-03.1 openapi-ai-and-high-churn-surface-coverage**
  - **Status:** Blocked
  - **Why now:** AI and other high-churn endpoints still lack explicit schema annotations, which blocks safe client generation.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Type safety gate + Phase 12
  - **Scope:** Add OpenAPI coverage to AI/high-churn backend endpoints and align the baseline artifact.
  - **Non-goals:** No frontend consumer refactor yet.
  - **Primary domain:** backend/contracts
  - **Likely touched paths:** `backend/tenant_apps/ai_assistant/views.py`, `backend/tenant_apps/ai_assistant/urls.py`, relevant schema generation config/tests, `manifests/openapi/openapi-schema.baseline.json`
  - **Dependencies:** EH-02.1
  - **Blockers:** EH-02.1
  - **Acceptance criteria:** Touched endpoints appear explicitly in the baseline schema with stable request/response shapes.
  - **Validation commands:** `cd backend && python manage.py spectacular --validate --file /tmp/projectmeats-openapi.yaml`; `cd backend && python manage.py test tenant_apps.ai_assistant apps.core.tests.test_api_error_contracts`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Keep backward-compatible aliases until consumers are updated.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **EH-03.2 openapi-ts-mobile-typegen**
  - **Status:** Blocked
  - **Why now:** Frontend/mobile type drift cannot be reduced until generated contract artifacts exist.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Type safety gate + Mobile parity + Phase 12
  - **Scope:** Generate and adopt TS/mobile types for the first covered domains.
  - **Non-goals:** No total frontend rewrite.
  - **Primary domain:** frontend/mobile/contracts
  - **Likely touched paths:** `manifests/openapi/openapi-schema.baseline.json`, `frontend/src/services/*`, `mobile/src/*`, generation scripts/config
  - **Dependencies:** EH-03.1
  - **Blockers:** EH-03.1
  - **Acceptance criteria:** Covered domains consume generated types and validation/build commands remain green.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`; `npm -C mobile run type-check`; `npm -C mobile run test`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Use compatibility wrappers and keep old handwritten DTOs until the generated path is stable.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic EH-04 - Frontend enterprise compliance

- [ ] **EH-04.1 tenant-aware-query-keys-and-cache-clear-removal**
  - **Status:** Blocked
  - **Why now:** Frontend tenant safety still relies on a global query-cache clear workaround.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Type safety gate / Cockpit Search / Phase 12
  - **Scope:** Introduce tenant-aware query keys and remove the app-level cache clearing hack after migration.
  - **Non-goals:** No search contract unification in this ticket.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/App.tsx`, `frontend/src/lib/` or `frontend/src/hooks/` query-key helper, `frontend/src/pages/Customers.tsx`, `frontend/src/pages/Suppliers.tsx`, `frontend/src/hooks/useHealth.ts`, `frontend/src/hooks/useWorkFormPermissions.ts`
  - **Dependencies:** EH-03.2
  - **Blockers:** EH-03.2
  - **Acceptance criteria:** Touched tenant-scoped queries include tenant identity in the key, and tenant-switch behavior no longer depends on `queryClient.clear()`.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** High on the client-side trust boundary
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Keep the cache-clear fallback behind a temporary guard until migrated surfaces are verified.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **EH-04.2 search-contract-unification**
  - **Status:** Blocked
  - **Why now:** Search surfaces still speak different contracts and ranking semantics.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Cockpit Search relevance + Phase 12
  - **Scope:** Create one search SDK/result taxonomy and move command/search surfaces onto it without changing user-facing entrypoints.
  - **Non-goals:** No unrelated UI redesign.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/components/Navigation/CommandPalette.tsx`, `frontend/src/components/Cockpit/SmartSearch.tsx`, `frontend/src/components/Search/ContinuousSearch.tsx`, shared search service/hooks
  - **Dependencies:** EH-04.1
  - **Blockers:** EH-04.1
  - **Acceptance criteria:** Search surfaces share one contract and have deterministic ranking/tenant scoping behavior.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Keep existing UI shells and compatibility adapters until the unified service proves stable.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **EH-04.3 floweditor-decomposition-phase-1**
  - **Status:** Blocked
  - **Why now:** `UnifiedFlowEditor.tsx` is too large and too risky to keep extending without module boundaries.
  - **Canonical source reference:** `MASTER_PLAN.md` -> WorkForms runtime/observability + Phase 12
  - **Scope:** Establish the first safe decomposition boundary and regression harness for FlowEditor.
  - **Non-goals:** No full editor rewrite and no real-time collaboration.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx`, supporting FlowEditor modules/tests, `frontend/src/components/Workflow/PurchaseOrderWorkflow.tsx`, `frontend/src/components/EntityGraph/EntityGraph.tsx`
  - **Dependencies:** EH-04.1, EH-03.2
  - **Blockers:** EH-04.1 and EH-03.2
  - **Acceptance criteria:** The first extracted module boundary lands with regression coverage and no dual-library expansion.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci -- src/components/FlowEditor`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Keep behavior behind additive extraction boundaries and revert the extraction if editor regressions appear.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic EH-05 - Runtime / ops reliability

- [ ] **EH-05.1 non-dev-redis-readiness-gate**
  - **Status:** Blocked
  - **Why now:** Locks, channels, cache, and circuit breakers cannot be considered production-grade while non-dev can fall back to memory semantics.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Graceful degradation / feature flags + Phase 12
  - **Scope:** Require Redis/Valkey readiness for non-dev environments and document the gate.
  - **Non-goals:** No AI control-plane work yet.
  - **Primary domain:** backend/ops
  - **Likely touched paths:** `backend/projectmeats/settings/base.py`, `.github/workflows/reusable-deploy.yml`, `manifests/GOLDEN_FILES.md`, runtime health checks
  - **Dependencies:** EH-01.4
  - **Blockers:** EH-01.4
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
  - **Blockers:** EH-02.1 and EH-05.1
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
  - **Dependencies:** EH-02.3, EH-05.2
  - **Blockers:** EH-02.3 and EH-05.2
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
  - **Blockers:** EH-06.1, EH-05.1, and EH-03.1
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
