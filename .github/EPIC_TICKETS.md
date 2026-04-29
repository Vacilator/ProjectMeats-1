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
  - **Status:** Done
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
  - **Completion evidence destination:** shipped in `.github/MASTER_PLAN.md` (PR: #4765)

- [x] **EH-01.2 manifest-required-secret-parity**
  - **Status:** Done
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
  - **Completion evidence destination:** shipped in `.github/MASTER_PLAN.md` (PR: #4764)

- [x] **EH-01.3 pr-security-gates-and-dependabot-scope**
  - **Status:** Done
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
  - **Completion evidence destination:** shipped in `.github/MASTER_PLAN.md` (PR: #4766)

- [x] **EH-01.4 rollback-release-automation-alignment**
  - **Status:** Done
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
  - **Completion evidence destination:** shipped in `.github/MASTER_PLAN.md` (PR: #4769)

### Epic EH-02 - Tenant isolation + data integrity

- [x] **EH-02.1 fail-closed-tenant-rls-runtime**
  - **Status:** Done
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
  - **Completion evidence destination:** shipped in `.github/MASTER_PLAN.md` (PR: #4771)

- [x] **EH-02.2 platform-idempotency-keys**
  - **Status:** Done
  - **Why now:** Duplicate POST/retry behavior remains ad hoc across uploads, executions, and integrations.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 12
  - **Scope:** Added a tenant-scoped idempotency layer in `apps.core` and applied the first protected slice to `POST /api/v1/tenant-workforms/{id}/execute/`.
  - **Non-goals:** No attempt to retrofit every POST endpoint in one PR.
  - **Primary domain:** backend
  - **Likely touched paths:** `backend/apps/core/models.py`, `backend/apps/core/services/idempotency.py`, `backend/apps/core/migrations/0008_idempotencykey.py`, `backend/apps/system/workform_views.py`, `backend/apps/system/tests/test_tenant_workform_execute_permissions.py`, `manifests/RLS_POLICIES.md`
  - **Dependencies:** EH-02.1
  - **Blockers:** None
  - **Acceptance criteria:** Replayed requests with the same idempotency key no longer duplicate `TenantWorkFormExecution` writes or Celery enqueue for the protected execute endpoint, and mismatched payload reuse returns a stable 409 conflict.
  - **Validation commands:** `cd backend && python manage.py makemigrations --check`; `cd backend && python manage.py test apps.system.tests.test_tenant_workform_execute_permissions apps.system.tests.test_workform_execute_circuit_breaker apps.core.tests.test_audit_rls_compliance`
  - **Tenant/RLS impact:** Medium; store must be tenant-aware
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Disable the middleware for the targeted routes and keep the persistence table additive.
  - **Completion evidence destination:** shipped in `.github/MASTER_PLAN.md` (PR: #4773)

- [x] **EH-02.3 chat-session-tenant-fk-rls**
  - **Status:** Done
  - **Why now:** AI chat persistence still relies on JSON-stamped tenant context instead of tenant-native storage.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 12 / Phase 13 dependency
  - **Scope:** Added tenant FKs + backfill + RLS to `ChatSession` and `ChatMessage`, migrated AI chat reads/writes to tenant-native filtering with legacy fallback, updated out-of-band chat writers, and extended the RLS registry.
  - **Non-goals:** No autonomy control plane yet.
  - **Primary domain:** backend
  - **Likely touched paths:** `backend/tenant_apps/ai_assistant/models.py`, `backend/tenant_apps/ai_assistant/views.py`, `backend/tenant_apps/ai_assistant/session_utils.py`, `backend/tenant_apps/integrations/services/email_ingestion.py`, `backend/tenant_apps/ai_assistant/migrations/0016_chatmessage_tenant_chatsession_tenant_and_more.py`, `manifests/RLS_POLICIES.md`
  - **Dependencies:** EH-02.1
  - **Blockers:** None
  - **Acceptance criteria:** Chat data is tenant-native, tenant-scoped, legacy chat rows backfill safely, and the new chat tables are covered by RLS regression + audit tests.
  - **Validation commands:** `cd backend && python manage.py makemigrations --check`; `cd backend && python manage.py test tenant_apps.ai_assistant apps.core.tests.test_audit_rls_compliance`; `cd backend && python manage.py migrate --plan | sed -n '/ai_assistant\\.0016/,+8p'`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Dual-read/write during rollout; revert readers before removing additive schema.
  - **Completion evidence destination:** shipped in `.github/MASTER_PLAN.md` (PR: #4774)

### Epic EH-03 - Contract-first platform

- [x] **EH-03.1 openapi-ai-and-high-churn-surface-coverage**
  - **Status:** Done
  - **Why now:** AI and other high-churn endpoints still lack explicit schema annotations, which blocks safe client generation.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Type safety gate + Phase 12
  - **Scope:** Add OpenAPI coverage to AI/high-churn backend endpoints and align the baseline artifact.
  - **Non-goals:** No frontend consumer refactor yet.
  - **Primary domain:** backend/contracts
  - **Likely touched paths:** `backend/projectmeats/settings/base.py`, `backend/tenant_apps/ai_assistant/serializers.py`, `backend/tenant_apps/ai_assistant/views.py`, relevant schema generation config/tests, `manifests/openapi/openapi-schema.baseline.json`
  - **Dependencies:** EH-02.1
  - **Blockers:** None
  - **Acceptance criteria:** Touched endpoints appear explicitly in the baseline schema with stable request/response shapes.
  - **Validation commands:** `cd backend && python manage.py spectacular --validate --file /tmp/projectmeats-openapi.yaml`; `cd backend && python manage.py spectacular --validate --format openapi-json --file /tmp/projectmeats-openapi.json`; `cd backend && python manage.py test tenant_apps.ai_assistant apps.core.tests.test_api_error_contracts --keepdb --noinput`; `python scripts/check_openapi_backcompat.py --baseline manifests/openapi/openapi-schema.baseline.json --candidate /tmp/projectmeats-openapi.json`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Keep backward-compatible aliases until consumers are updated.
  - **Completion evidence destination:** shipped in `.github/MASTER_PLAN.md` (PR: #4775)

- [x] **EH-03.2 openapi-ts-mobile-typegen**
  - **Status:** Done
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
  - **Completion evidence destination:** shipped in `.github/MASTER_PLAN.md` (PR: #4777)

### Epic EH-04 - Frontend enterprise compliance

- [x] **EH-04.1 tenant-aware-query-keys-and-cache-clear-removal**
  - **Status:** Done
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
  - **Completion evidence destination:** shipped in `.github/MASTER_PLAN.md` (PR: #4779)

- [x] **EH-04.2 search-contract-unification**
  - **Status:** Done
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
  - **Completion evidence destination:** shipped in `.github/MASTER_PLAN.md` (PR: #4780)

- [x] **EH-04.3 floweditor-decomposition-phase-1**
  - **Status:** Done
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
  - **Completion evidence destination:** shipped in `.github/MASTER_PLAN.md` (PR: #4782)

### Epic EH-05 - Runtime / ops reliability

- [x] **EH-05.1 non-dev-redis-readiness-gate**
  - **Status:** Done
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
  - **Completion evidence destination:** shipped in `.github/MASTER_PLAN.md` (PR: #4783)

### Epic EH-02 - Deferred execution item with EH-05 dependency

- [x] **EH-02.4 atomic-workflow-collaboration-locks**
  - **Status:** Done (PR #4785)
  - **Why now:** Current workflow lock semantics are not safe for concurrent multi-node execution.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 12
  - **Scope:** Replace `get` + `set` lock acquisition with an atomic distributed primitive and wire it into runtime/collaboration paths.
  - **Non-goals:** No full real-time collaboration product surface in this ticket.
  - **Primary domain:** backend
  - **Likely touched paths:** `backend/tenant_apps/workflows/services/locking.py`, collaboration endpoints/tests
  - **Dependencies:** EH-02.1, EH-05.1
  - **Blockers:** None
  - **Acceptance criteria:** Concurrent lock acquisition is deterministic and covered by race/concurrency tests.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.workflows.tests.test_collaboration_websocket_security tenant_apps.workflows.tests.test_workflow_tasks_rls_context tenant_apps.workflows.services.tests.test_workflow_executor`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** Requires Redis in non-dev semantics
  - **Risk level:** High
  - **Rollback:** Revert the guarded lock service + workflow lock actions to restore the prior passive lock behavior while keeping websocket collaboration isolated.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **EH-05.2 observability-and-rollback-drill**
  - **Status:** Done (PR #4787)
  - **Why now:** Production observability and rollback readiness are not yet at enterprise baseline.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Operational excellence + Phase 12
  - **Scope:** Require lane-wide observability ownership and validate rollback procedures in UAT.
  - **Non-goals:** No unrelated dashboard redesign.
  - **Primary domain:** ops
  - **Likely touched paths:** `docs/runbooks/INCIDENT_RESPONSE.md`, `.github/scripts/deployment-rollback.sh`, `manifests/GOLDEN_FILES.md`, relevant workflows/docs
  - **Dependencies:** EH-05.1
  - **Blockers:** None
  - **Acceptance criteria:** UAT rollback drill and non-dev observability expectations are explicitly documented and reproducible.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `bash .github/scripts/check_infrastructure.sh`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** Medium
  - **Risk level:** Medium
  - **Rollback:** Revert the rollback-script/doc/validator updates if they diverge from validated rollout behavior.
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
  - **Blockers:** EH-06.1
  - **Acceptance criteria:** Semantic indexing is real and health-gated, lineage is end-to-end, and exports avoid local `/tmp`.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.integrations tenant_apps.ai_assistant apps.core.tests.test_viewset_permissions`; `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** High
  - **Risk level:** High
  - **Rollback:** Keep new index/export paths additive and feature-gated until lineage and retry behavior are validated.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`
