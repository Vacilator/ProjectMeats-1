# EPIC_TICKETS.md — Execution Backlog

> **Status:** ordered execution backlog
> **Canonical priority source:** root `MASTER_PLAN.md`
> **Standards:** `.github/SDLC_PROTOCOLS.md`
> **Last Restructured:** 2026-05-11

## Operating Rules

1. This file is **execution-ordered from top to bottom**.
2. Always take the **first unchecked ticket** (marked `Status: Ready`).
3. Only ONE ticket should be `Status: Ready` at any time.
4. Cross-epic dependency tickets must be placed after their final blocker in file order.
5. If a prerequisite is incomplete, the next ticket is `Status: Blocked` with explicit blocker.
6. After merge, append shipped evidence to `.github/MASTER_PLAN.md` and check the ticket `[x]`.
7. **Never reorder shipped tickets** — they are historical record.

## Execution Priority (Current)

| Priority | Ticket | Phase | Domain |
|----------|--------|-------|--------|
| Shipped | UX-37.1 aicommandcenter-trade-table-and-modal-inline-style-extraction | Phase 37 | frontend |
| Ready | UX-37.2 aicommandcenter-confidence-intent-record-inline-style-extraction | Phase 37 | frontend |
| Blocked | UX-37.3 cockpit-workspace-search-and-catalog-cleanup | Phase 37 | frontend |
| Blocked | UX-37.4 workspace-terminology-alignment | Phase 37 | frontend |
| Blocked | UX-37.5 aicommandcenter-shortcut-deeplink-confidence-regression-hardening | Phase 37 | frontend |
| Shipped | UX-36.1 command-center-four-section-ia-and-workflows-demotion | Phase 36 | frontend |
| Shipped | UX-36.2 workforms-monitoring-single-drill-in-surface | Phase 36 | frontend |
| Shipped | UX-36.3 process-cockpit-legacy-retirement-and-secondary-copy-alignment | Phase 36 | frontend |
| Shipped | UX-35.1 command-center-ia-route-canonicalization | Phase 35 | frontend |
| Shipped | UX-35.2 canonical-search-entrypoint-unification | Phase 35 | frontend |
| Shipped | UX-35.3 shared-command-center-shell-extraction | Phase 35 | frontend |
| Shipped | UX-35.4 cockpit-surface-reduction | Phase 35 | frontend |
| Shipped | UX-35.5 action-required-process-consolidation-and-copy-polish | Phase 35 | frontend |
| Shipped | CTE-04.1 draft-sales-order-generation | Phase 16 | backend |
| Shipped | CTE-04.2 sales-order-approval-pdf | Phase 16 | backend |
| Shipped | CTE-04.3 carrier-rfq-match | Phase 16 | backend |
| Shipped | CTE-04.4 carrier-reply-parser | Phase 16 | backend |
| Shipped | CTE-04.5 happy-path-orchestrator-e2e | Phase 16 | full-stack |
| Shipped | CTE-04.6 structured-logging-trace-ids | Phase 16 | backend |
| Shipped | CTE-04.7 unified-inquiry-po-form | Phase 16 | frontend |
| Shipped | CTE-05.1 trade-session-lineage-schema | Phase 16 | backend |
| Shipped | CTE-06.1 domain-event-contracts | Phase 16 | backend |
| Shipped | CTE-06.2 celery-saga-consumers | Phase 16 | backend |
| Shipped | CTE-07.1 select-for-update-transition-locking | Phase 16 | backend |
| Shipped | CTE-07.2 idempotency-key-enforcement | Phase 16 | backend |
| Shipped | CTE-08.1 exception-queue-dead-letter | Phase 16 | backend |
| Shipped | INFRA-01.1 backend-test-factory-library | Phase 16 | backend |
| Shipped | CTE-08.2 trades-requiring-intervention-dashboard | Phase 16 | full-stack |
| Shipped | RT-01.1 end-to-end-inquiry-to-po-template | Phase 17 | backend |
| Shipped | RT-02.1 ai-inbox-auto-sync | Phase 17 | backend |
| Shipped | RT-02.2–04 (AI parsing + feedback + cockpit routing) | Phase 17 | full-stack |
| Shipped | RT-03.1–03 (cockpit + React Flow + dynamic headers) | Phase 17 | frontend |
| Shipped | RT-04.1–02 (contact enrichment + cockpit visualization) | Phase 17 | full-stack |
| Shipped | AMB-01.1 contextual-suggestion-contract-and-heuristic-rules | Phase 19 | backend/docs/ai |
| Shipped | AMB-01.2 contextual-suggestions-endpoint-and-service | Phase 19 | backend/ai |
| Shipped | AMB-02.1 ambient-suggestions-component-and-service-hook | Phase 19 | frontend |
| Shipped | AMB-02.2 record-page-header-integration-and-action-wiring | Phase 19 | frontend |
| Shipped | AMB-03.1 product-anomaly-baseline-service-and-threshold-contract | Phase 19 | backend/data |
| Shipped | RT-04.3 quick-master-data-creation-in-context | Phase 17 | full-stack |
| Shipped | RT-05 (editor stabilization) | Phase 17 | frontend |
| Shipped | RT-06–09 (scale & analytics) | Phase 18 | full-stack |
| Shipped | RT-10 (template library) | Phase 18 | full-stack |
| Shipped | AMB-01–04 (ambient AI) | Phase 19 | full-stack |

## Dependency Graph

```
Phase 37 (UX-37.1→UX-37.5 operator surface completion) — next execution lane

Phase 36 (UX-36.1→UX-36.3 operator execution simplification) — completed on development

Phase 35 (UX-35.1→UX-35.5 frontend simplification) — completed on development

Phase 16 (CTE-04→CTE-08) ─────────┐
                                    ├──▶ Phase 17 (RT-01→RT-04) ──▶ RT-05
                                    │                                  │
Phase 19 (AMB-01→AMB-04)           │                                  │
    (independent, can parallel)     ▼                                  ▼
                              Phase 18 (RT-06→RT-09) ──────────▶ RT-10
```

---

## Shipped Tickets (Compact Reference)

<details>
<summary><strong>Phase 14 — GA & Enterprise Hardening (23 tickets, ALL SHIPPED)</strong></summary>

| Ticket | Title | PR |
|--------|-------|-----|
| GA-01.1 | day-0-etl-source-contracts | #4813 |
| GA-01.2 | etl-journal-and-dry-run-engine | #4814 |
| GA-01.3 | etl-master-data-import-pass | #4816 |
| GA-01.4 | etl-transactional-import-and-reconciliation | #4817 |
| GA-02.1 | infra-desired-state-and-iac-scaffold | #4818 |
| GA-02.2 | postgres-pitr-verification-and-restore-drill | #4819 |
| GA-02.3 | celery-worker-scaling-envelope | #4820 |
| GA-02.4 | redis-eviction-and-queue-health-guardrails | #4821 |
| GA-03.1 | retention-inventory-and-archive-contract | #4822 |
| GA-03.2 | seven-year-archive-command | #4823 |
| GA-03.3 | pii-redaction-for-logging-and-sentry | #4832 |
| GA-03.4 | governance-schedules-and-evidence-runbook | #4842 |
| GA-04.1 | tour-provider-and-user-preference-contract | #4844 |
| GA-04.2 | cockpit-empty-state-system | #4846 |
| GA-04.3 | transactional-surface-empty-states | #4848 |
| GA-04.4 | onboarding-telemetry-and-resume-controls | #4850 |
| GA-05.1 | vite-pwa-app-shell-foundation | #4852 |
| GA-05.2 | connectivity-state-and-offline-banner | #4854 |
| GA-05.3 | warehouse-critical-optimistic-mutations | #4856 |
| GA-05.4 | offline-replay-and-warehouse-e2e | #4858 |
| UI-01.1 | modal-lifecycle-lockdown | #4836 |
| UI-01.2 | null-safety-formatters | #4838 |
| UI-01.3 | breadcrumb-uuid-resolution-engine | #4840 |

</details>

<details>
<summary><strong>Phase 12 — Enterprise Hardening & Tech Debt (16 tickets, ALL SHIPPED)</strong></summary>

| Ticket | Title | PR |
|--------|-------|-----|
| EH-00.1 | enterprise-audit-doc-batch | #4860 |
| EH-01.1 | drift-gate-depth | #4863 |
| EH-01.2 | manifest-required-secret-parity | #4751/#4764 |
| EH-01.3 | pr-security-gates-and-dependabot-scope | #4766 |
| EH-01.4 | rollback-release-automation-alignment | #4769 |
| EH-02.1 | fail-closed-tenant-rls-runtime | #4771 |
| EH-02.2 | platform-idempotency-keys | #4773/#4776 |
| EH-02.3 | chat-session-tenant-fk-rls | #4871 |
| EH-02.4 | atomic-workflow-collaboration-locks | #4890 |
| EH-03.1 | openapi-ai-and-high-churn-surface-coverage | #4775 |
| EH-03.2 | openapi-ts-mobile-typegen | #4777/#4562 |
| EH-04.1 | tenant-aware-query-keys-and-cache-clear-removal | #4874 |
| EH-04.2 | search-contract-unification | #4876 |
| EH-04.3 | floweditor-decomposition-phase-1 | #4878 |
| EH-05.1 | non-dev-redis-readiness-gate | #4889 |
| EH-05.2 | observability-and-rollback-drill | #4891 |

</details>

<details>
<summary><strong>Phase 13 — Next-Gen AI (2 tickets, ALL SHIPPED)</strong></summary>

| Ticket | Title | PR |
|--------|-------|-----|
| EH-06.1 | autonomous-control-plane-foundation | #4892 |
| EH-06.2 | semantic-index-lineage-and-durable-exports | #4893 |

</details>

<details>
<summary><strong>Phase 15 — B2B Network & Settlement (14 tickets, ALL SHIPPED)</strong></summary>

| Ticket | Title | PR |
|--------|-------|-----|
| B2B-02.1 | trade-invariants-contract-and-surface-audit | — |
| B2B-02.2 | backend-trade-engine-service-and-tests | — |
| B2B-02.3 | transactional-api-adoption-for-orders-invoices-fulfillments | — |
| B2B-02.4 | frontend-display-and-input-normalization | — |
| B2B-01.1 | guest-portal-access-contract | — |
| B2B-01.2 | portal-grant-and-document-registry-schema | — |
| B2B-01.3 | public-portal-read-apis-and-audit-trail | — |
| B2B-01.4 | frontend-public-portal-shell-and-magic-link | #4907 |
| B2B-01.5 | operator-issue-resend-revoke-controls | — |
| B2B-03.1 | settlement-ingest-contract | — |
| B2B-03.2 | settlement-event-store-and-public-ingest | — |
| B2B-03.3 | reconciliation-engine-into-paymenttransaction | — |
| B2B-03.4 | accounting-settlement-queue-and-override-ui | — |
| B2B-03.5 | bank-feed-provider-adapter | — |

</details>

<details>
<summary><strong>Phase 16 — Core Trading Engine (22 tickets, ALL SHIPPED)</strong></summary>

| Ticket | Title | PR |
|--------|-------|-----|
| CTE-01.1 | inquiry-happy-path-contract-and-routing-fields | #4923 |
| CTE-01.2 | ai-email-extractor-to-inquiry-draft | — |
| CTE-01.3 | inventory-availability-contract-and-routing-service | — |
| CTE-01.4 | live-inquiry-alerting-and-operator-review-queue | — |
| CTE-02.1 | supplier-match-engine-for-broker-route | #4929 |
| CTE-02.2 | outbound-supplier-rfq-email-service | #4930 |
| CTE-02.3 | structured-supplier-reply-parser | #4931 |
| CTE-02.4 | draft-supplier-po-generation-from-quotes | #4932 |
| CTE-03.1 | generic-order-approval-state-machine | #4933 |
| CTE-03.2 | supplier-po-review-and-approve-screen | #4934 |
| CTE-03.3 | supplier-po-approved-pdf-generation-and-email | #4935 |

</details>

---

## Active Backlog (Execution Order)

### Phase 37 — Operator Surface Completion (Remaining: 4 tickets)

#### Epic UX-37: AICommandCenter polish + cockpit workspace cleanup

- [ ] **UX-37.1 aicommandcenter-trade-table-and-modal-inline-style-extraction**
  - **Status:** Shipped
  - **Why now:** `AICommandCenter.tsx` is now the single primary operator home, but the file still carries a large inline-style cluster around the trade table and detail modal that hides styling drift from the existing standards guardrails.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 37
  - **Scope:** Convert the trade-table cells, route tags, modal metadata rows, inquiry/source links, and related action-row inline styles in `AICommandCenter.tsx` into named styled-components without changing behavior.
  - **Non-goals:** No query logic changes, no shortcut behavior changes, and no cockpit/dashboard work in this ticket.
  - **Primary domain:** frontend/command-center
  - **Likely touched paths:** `frontend/src/pages/AICommandCenter.tsx`, `frontend/src/pages/AICommandCenter.test.tsx`
  - **Dependencies:** Phase 36 shipped on `development`
  - **Blockers:** None
  - **Acceptance criteria:** The first half of the `AICommandCenter.tsx` inline-style cluster is extracted into named styled-components; no behavior or copy changes regress in the trade table or detail modal.
  - **Validation commands:** `npm -C frontend run verify-standards`; `cd frontend && npm exec -- vitest run src/pages/AICommandCenter.test.tsx`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert the styled-component extraction PR while keeping the Phase 35/36 routing model intact.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`
  - **Shipped evidence:** PR #5319

- [ ] **UX-37.2 aicommandcenter-confidence-intent-record-inline-style-extraction**
  - **Status:** Ready
  - **Why now:** After the trade-table/modal cluster is extracted, the remaining inline-style debt in `AICommandCenter.tsx` is concentrated in the confidence pill, intent label, open-record button, shortcut hint bar, and minor input/button wrappers.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 37
  - **Scope:** Finish the remaining `AICommandCenter.tsx` inline-style removal by extracting the confidence score, intent highlight, entity-record opener, shortcut hint bar, and search/refresh wrappers into tokenized styled-components.
  - **Non-goals:** No cockpit/dashboard cleanup and no new shortcut coverage yet.
  - **Primary domain:** frontend/command-center
  - **Likely touched paths:** `frontend/src/pages/AICommandCenter.tsx`, `frontend/src/pages/AICommandCenter.test.tsx`
  - **Dependencies:** UX-37.1
  - **Blockers:** UX-37.1 must clear the table/modal cluster first
  - **Acceptance criteria:** `AICommandCenter.tsx` has no remaining `style={{}}` operator-surface drift; confidence/intent/shortcut surfaces render through named tokenized wrappers.
  - **Validation commands:** `npm -C frontend run verify-standards`; `cd frontend && npm exec -- vitest run src/pages/AICommandCenter.test.tsx`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert the second extraction PR while preserving the already-shipped Phase 37.1 wrappers.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **UX-37.3 cockpit-workspace-search-and-catalog-cleanup**
  - **Status:** Blocked on UX-37.2
  - **Why now:** Once the primary operator surface is styled cleanly again, the next highest-noise pocket is the Cockpit Workspace: it still renders a SmartSearch forwarding stub and still offers new `AILearningMetricsWidget` additions even though that widget was already demoted from the default landing path.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 37
  - **Scope:** Remove the `SmartSearch` forwarding stub from `CockpitDashboard.tsx`, replace it with static Command Center search guidance, and remove `AILearningMetricsWidget` from new catalog additions while preserving saved-layout rendering for existing users.
  - **Non-goals:** No changes to widget-grid layout behavior, pinned tools, or route structure.
  - **Primary domain:** frontend/cockpit
  - **Likely touched paths:** `frontend/src/pages/Cockpit/CockpitDashboard.tsx`, `frontend/src/pages/Cockpit/CockpitDashboard.test.tsx`
  - **Dependencies:** UX-37.2
  - **Blockers:** UX-37.2 keeps the operator-surface cleanup sequence single-threaded
  - **Acceptance criteria:** `CockpitDashboard.tsx` no longer renders the SmartSearch forwarder; new catalog additions cannot add `AILearningMetricsWidget`; saved layouts still render existing widget instances.
  - **Validation commands:** `npm -C frontend run verify-standards`; `cd frontend && npm exec -- vitest run src/pages/Cockpit/CockpitDashboard.test.tsx`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Restore the SmartSearch/catalog entry while keeping the Command Center-first redirects intact.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **UX-37.4 workspace-terminology-alignment**
  - **Status:** Blocked on UX-37.3
  - **Why now:** After the cockpit search/catalog cleanup, the remaining operator drift is almost entirely naming: Header onboarding labels, workspace document titles, and tour copy still have room to standardize around the Command Center-first model.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 37
  - **Scope:** Align the surviving Header/Cockpit workspace/tour copy so the secondary workspace terminology is consistent everywhere it remains user-facing.
  - **Non-goals:** No route changes, no tour logic changes, and no new data-fetching work.
  - **Primary domain:** frontend/copy
  - **Likely touched paths:** `frontend/src/components/Layout/Header.tsx`, `frontend/src/components/Layout/Header.test.tsx`, `frontend/src/pages/Cockpit/index.tsx`, `frontend/src/components/Cockpit/CockpitTour.tsx`, `frontend/src/components/Onboarding/CockpitWelcomeEmptyState.tsx`
  - **Dependencies:** UX-37.3
  - **Blockers:** UX-37.3 must settle the surviving cockpit shell before the last terminology pass
  - **Acceptance criteria:** Surviving workspace labels/tour strings are consistent with the Command Center-first model; related tests are updated in the same PR.
  - **Validation commands:** `npm -C frontend run verify-standards`; `cd frontend && npm exec -- vitest run src/components/Layout/Header.test.tsx src/components/Onboarding/CockpitWelcomeEmptyState.test.tsx src/pages/Cockpit/CockpitDashboard.test.tsx`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** None
  - **Risk level:** Low
  - **Rollback:** Revert the terminology-only PR without touching routes or workspace logic.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [ ] **UX-37.5 aicommandcenter-shortcut-deeplink-confidence-regression-hardening**
  - **Status:** Blocked on UX-37.4
  - **Why now:** Once the operator-surface refactors land, the remaining gap is guardrail coverage: `AICommandCenter.test.tsx` still lacks dedicated shortcut, `?item=` deep-link, and confidence-threshold assertions for the Command Center-first flow.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 37
  - **Scope:** Add focused `AICommandCenter.test.tsx` coverage for Alt+1-4 shortcuts, `?item=` modal routing, confidence-threshold variants, and overview AI inbox preview limits.
  - **Non-goals:** No production code change unless a newly exposed bug requires a targeted fix.
  - **Primary domain:** frontend/tests
  - **Likely touched paths:** `frontend/src/pages/AICommandCenter.test.tsx`
  - **Dependencies:** UX-37.4
  - **Blockers:** UX-37.4 keeps the one-ready-ticket rule intact before the additive guardrail batch
  - **Acceptance criteria:** The Command Center shortcut/deep-link/confidence flows have dedicated regression coverage that fails if future simplification work reintroduces drift.
  - **Validation commands:** `npm -C frontend run verify-standards`; `cd frontend && npm exec -- vitest run src/pages/AICommandCenter.test.tsx`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** None
  - **Risk level:** Low
  - **Rollback:** Revert the additive test-only PR if necessary while keeping prior production simplifications in place.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Phase 36 — Operator Execution Surface Simplification (Remaining: 0 tickets)

#### Epic UX-36: Command Center compression + execution drill-in cleanup

- [x] **UX-36.1 command-center-four-section-ia-and-workflows-demotion**
  - **Status:** Shipped on `development` (PR #5315)
  - **Why now:** Command Center is now the primary operator home, but it still carries five top-level tabs even though the canonical north star is four sections or fewer and the current Workflows tab overlaps with the separate execution drill-in surface.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 36
  - **Scope:** Reduce `/command-center` to four top-level sections or fewer by demoting the Workflows tab into the surviving execution drill-in path, preserve canonical URL context (`q`, `item`, relevant legacy handoffs), and align visible labels/redirects with that slimmer IA.
  - **Non-goals:** No backend/API changes, no WorkForms analytics redesign, and no retirement of WorkForms Monitoring in this ticket.
  - **Primary domain:** frontend/navigation
  - **Likely touched paths:** `frontend/src/pages/AICommandCenter.tsx`, `frontend/src/pages/AICommandCenter.test.tsx`, `frontend/src/App.tsx`, `frontend/src/components/Layout/Header.tsx`, `frontend/src/config/navigation.ts`, `frontend/src/pages/WorkForms/Monitoring.tsx`
  - **Dependencies:** Phase 35 shipped on `development`
  - **Blockers:** None
  - **Acceptance criteria:** Command Center exposes four top-level sections or fewer; the top-level Workflows tab is removed/demoted; legacy `tab=workflows` entrypoints resolve safely to the intended execution drill-in destination; search/deep-link context does not regress.
  - **Validation commands:** `npm -C frontend run verify-standards`; `cd frontend && npm exec -- vitest run src/pages/AICommandCenter.test.tsx src/components/Layout/Header.test.tsx src/pages/WorkForms/Monitoring.test.tsx src/routes/LegacyCommandCenterTabRedirect.test.tsx`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Restore the top-level Workflows tab while keeping harmless redirect aliases and canonical search helpers intact.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **UX-36.2 workforms-monitoring-single-drill-in-surface**
  - **Status:** Shipped on `development` (PR #5316)
  - **Why now:** Even after Command Center copy cleanup, `/workforms/monitoring` still mixes execution analytics with a Cockpit-era legacy monitor, so the execution drill-in model is not yet clean.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 36
  - **Scope:** Simplify `/workforms/monitoring` into one execution drill-in surface for analytics, active runs, and explicit step-level follow-through while removing competing queue-shell affordances.
  - **Non-goals:** No new analytics features and no trade-engine/backend changes.
  - **Primary domain:** frontend/workforms
  - **Likely touched paths:** `frontend/src/pages/WorkForms/Monitoring.tsx`, `frontend/src/pages/WorkForms/Monitoring.test.tsx`, `frontend/src/pages/Cockpit/ProcessMonitor.tsx`, `frontend/src/pages/WorkForms/ExecutionDetails.tsx`
  - **Dependencies:** UX-36.1
  - **Blockers:** UX-36.1 must establish the top-level demotion target first
  - **Acceptance criteria:** WorkForms Monitoring is clearly execution drill-in only; it no longer reads like a second action-required queue surface; Command Center remains the sole triage home.
  - **Validation commands:** `npm -C frontend run verify-standards`; `cd frontend && npm exec -- vitest run src/pages/WorkForms/Monitoring.test.tsx src/pages/AICommandCenter.test.tsx src/pages/WorkForms/ExecutionDetails.test.tsx`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Restore the prior monitoring composition while leaving harmless copy/route improvements in place.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **UX-36.3 process-cockpit-legacy-retirement-and-secondary-copy-alignment**
  - **Status:** Shipped on `development` (PR #5317)
  - **Why now:** After the execution drill-in path is simplified, the remaining ProcessCockpit-era code/tests/comments and secondary workspace labels become pure maintenance and UX drag.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 36
  - **Scope:** Retire dead ProcessCockpit-era surfaces and finish secondary workspace naming cleanup across cockpit/workspace headers, navigation, and residual tests/comments while preserving safe legacy redirects.
  - **Non-goals:** No Command Center search rewrite and no dashboard/widget redesign in this ticket.
  - **Primary domain:** frontend/cleanup
  - **Likely touched paths:** `frontend/src/pages/Cockpit/ProcessCockpitPage.tsx`, `frontend/src/pages/Cockpit/ProcessCockpitPage.test.tsx`, `frontend/src/pages/Cockpit/ProcessCockpitPage.stability.test.tsx`, `frontend/src/pages/Cockpit/index.tsx`, `frontend/src/config/navigation.ts`, `frontend/src/components/Onboarding/CockpitWelcomeEmptyState.tsx`
  - **Dependencies:** UX-36.2
  - **Blockers:** UX-36.2 must preserve the surviving execution drill-in flow first
  - **Acceptance criteria:** No active route depends on ProcessCockpitPage; secondary workspace copy no longer implies a parallel primary operator home; legacy links keep landing safely.
  - **Validation commands:** `npm -C frontend run verify-standards`; `cd frontend && npm exec -- vitest run src/components/Onboarding/CockpitWelcomeEmptyState.test.tsx src/components/Layout/Header.test.tsx src/pages/Cockpit/CockpitDashboard.test.tsx`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Re-enable retired legacy wrappers/tests if needed while preserving already-shipped canonical redirects.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`


### Phase 35 — Frontend Surface Simplification & Command Center Consolidation (Remaining: 0 tickets)

#### Epic UX-35: Command Center as the single operator home

- [x] **UX-35.1 command-center-information-architecture-and-route-canonicalization**
  - **Status:** Shipped on `development` (PR #5309)
  - **Why now:** `/command-center` is already the intended operator hub, but the live app still presents overlapping Cockpit and Process routes that split the user mental model.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 35
  - **Scope:** Make Command Center the single canonical operator hub in top-level routing/navigation, normalize legacy redirects (`/trader-cockpit`, `/process-cockpit`, `/activity`, `/cockpit/process-monitor`), and align visible labels/deep links without changing backend contracts.
  - **Non-goals:** No KPI redesign, no widget reduction, no backend/API changes, no queue implementation merge yet.
  - **Primary domain:** frontend/navigation
  - **Likely touched paths:** `frontend/src/App.tsx`, `frontend/src/config/navigation.ts`, `frontend/src/pages/Cockpit/index.tsx`, `frontend/src/components/Layout/Sidebar.tsx`, `frontend/src/components/Layout/Header.tsx`, `docs/SHORTCUTS.md`
  - **Dependencies:** None
  - **Blockers:** None
  - **Acceptance criteria:** Command Center is the only primary operator-hub destination in navigation; legacy URLs redirect safely to the correct Command Center state; visible labels and deep links no longer present duplicate top-level homes for the same workflow.
  - **Validation commands:** `npm -C frontend run verify-standards`; `cd frontend && npm exec -- vitest run src/pages/AICommandCenter.test.tsx src/pages/Cockpit/ProcessCockpitPage.test.tsx src/pages/Cockpit/ProcessCockpitPage.stability.test.tsx`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Restore previous labels/routes while keeping newly added legacy redirects intact.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **UX-35.2 canonical-search-entrypoint-unification**
  - **Status:** Shipped on `development` (PR: #5310)
  - **Why now:** Search-first UX is fragmented across Header search, SmartSearch, CommandPalette, and keyboard shortcuts, which undermines the canonical Command Center model.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 35
  - **Scope:** Align Header search, SmartSearch, CommandPalette, and keyboard shortcuts onto one canonical search contract and URL behavior.
  - **Non-goals:** No search backend contract changes and no new ranking logic.
  - **Primary domain:** frontend/search
  - **Likely touched paths:** `frontend/src/components/Layout/Header.tsx`, `frontend/src/components/Navigation/CommandPalette.tsx`, `frontend/src/components/Cockpit/SmartSearch.tsx`, `frontend/src/pages/Cockpit/CockpitDashboard.tsx`, `frontend/src/components/Cockpit/CommandBar.tsx`, `frontend/src/hooks/useGlobalShortcuts.ts`
  - **Dependencies:** UX-35.1
  - **Blockers:** None
  - **Acceptance criteria:** `Ctrl/Cmd+K` and `/` invoke one canonical search behavior; Header and Cockpit search no longer compete; search URL/query semantics are stable from both the app shell and Command Center surfaces.
  - **Validation commands:** `npm -C frontend run verify-standards`; `cd frontend && npm exec -- vitest run src/utils/canonicalSearch.test.ts src/components/Layout/Header.test.tsx src/pages/Cockpit/CockpitDashboard.test.tsx src/pages/AICommandCenter.test.tsx src/components/Navigation/CommandPalette.test.tsx`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Restore previous shortcut aliases while preserving the shared canonical handler.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **UX-35.3 shared-command-center-shell-extraction**
  - **Status:** Shipped on `development` (PR: #5311)
  - **Why now:** `AICommandCenter` and surviving Cockpit surfaces still duplicate shell/header/tab/quick-action layout primitives.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 35
  - **Scope:** Extract shared operator shell primitives for page header, tab switcher, quick-actions row, and stat layout so the surviving surfaces share one presentation system.
  - **Non-goals:** No new data-fetching behavior and no backend changes.
  - **Primary domain:** frontend/components
  - **Likely touched paths:** `frontend/src/pages/AICommandCenter.tsx`, `frontend/src/pages/Cockpit/CockpitDashboard.tsx`, `frontend/src/components/Shared/CockpitPanel.tsx`, `frontend/src/components/Shared/StatCardGrid.tsx`, `frontend/src/components/Cockpit/CommandBar.tsx`
  - **Dependencies:** UX-35.2
  - **Blockers:** None
  - **Acceptance criteria:** Shared shell components own the duplicated layout primitives; Command Center and surviving Cockpit views render with one consistent shell structure; no behavior regression in touched views.
  - **Validation commands:** `cd frontend && npm exec -- vitest run src/pages/AICommandCenter.test.tsx src/pages/Cockpit/CockpitDashboard.test.tsx`; `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert individual pages back to local wrappers while retaining any harmless shared primitives.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **UX-35.4 cockpit-dashboard-top-level-surface-reduction**
  - **Status:** Shipped on `development` (PR: #5312)
  - **Why now:** `MASTER_PLAN.md` calls for a minimalist cockpit with four top-level sections or fewer, but `CockpitDashboard` still carries widget-catalog and edit-mode complexity as a primary surface.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 35
  - **Scope:** Reduce the surviving dashboard/operator landing experience to four top-level sections or fewer and demote widget-catalog/edit-mode complexity out of the primary path.
  - **Non-goals:** No feature deletion and no downstream entity-page redesign.
  - **Primary domain:** frontend/dashboard
  - **Likely touched paths:** `frontend/src/pages/Cockpit/CockpitDashboard.tsx`, `frontend/src/components/Widgets/index.ts`, `frontend/src/components/Widgets/WidgetCard.tsx`, `frontend/src/components/Cockpit/PinnedToolsBar.tsx`, `frontend/src/hooks/useCockpitStats.ts`
  - **Dependencies:** UX-35.3
  - **Blockers:** None
  - **Acceptance criteria:** The default operator landing surface exposes four top-level sections or fewer; secondary tools remain reachable by drill-in/deep link; loading/empty/error states still behave correctly.
  - **Validation commands:** `cd frontend && npm exec -- vitest run src/pages/Cockpit/CockpitDashboard.test.tsx src/components/Onboarding/CockpitWelcomeEmptyState.test.tsx`; `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Restore the prior dashboard layout while preserving any additive shared shell improvements.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **UX-35.5 action-required-process-ops-consolidation-and-copy-polish**
  - **Status:** Shipped on `development` (PR: #5313)
  - **Why now:** The repo still has overlapping action-required/process-ops concepts and mixed Command Center/Cockpit terminology across queue surfaces and empty states.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 35
  - **Scope:** Consolidate overlapping action-required/process-ops surfaces into one Command Center model and finish the user-facing copy/empty-state/drill-in polish needed to make that model obvious.
  - **Non-goals:** No trade-engine changes and no new analytics features.
  - **Primary domain:** frontend/operations
  - **Likely touched paths:** `frontend/src/pages/AICommandCenter.tsx`, `frontend/src/pages/WorkForms/Monitoring.tsx`, `frontend/src/pages/Cockpit/ProcessMonitor.tsx`, `frontend/src/components/Onboarding/CockpitWelcomeEmptyState.tsx`, `frontend/src/components/Layout/Header.tsx`, `frontend/src/App.tsx`
  - **Dependencies:** UX-35.4
  - **Blockers:** None
  - **Acceptance criteria:** One canonical action-required/process-ops experience remains; legacy routes resolve to the intended Command Center state; visible copy consistently uses the chosen Command Center terminology and clear next-action guidance.
  - **Validation commands:** `npm -C frontend run verify-standards`; `cd frontend && npm exec -- vitest run src/pages/AICommandCenter.test.tsx src/pages/Cockpit/ProcessCockpitPage.test.tsx src/pages/Cockpit/ProcessCockpitPage.stability.test.tsx src/components/Navigation/CommandPalette.test.tsx src/components/Onboarding/CockpitWelcomeEmptyState.test.tsx src/components/Layout/Header.test.tsx src/components/Integrations/IngestionMonitor.test.tsx src/pages/WorkForms/Monitoring.test.tsx src/routes/LegacyCommandCenterTabRedirect.test.tsx`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Restore prior queue routing/copy while keeping harmless redirect aliases and shared shell helpers.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Phase 16 — Core Trading Engine (Remaining: 0 tickets)

#### Epic CTE-04: Sales & Logistics Cascade

- [x] **CTE-04.1 draft-sales-order-generation-from-fulfill-or-approved-source**
  - **Status:** Shipped on `development` (PR #4952)
  - **Why now:** The engine needs one deterministic way to create draft sales orders either directly from `FULFILL` inquiries or from approved supplier sourcing.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 4
  - **Scope:** Auto-generate draft `SalesOrder` rows from either (a) direct `FULFILL` inquiry routing or (b) approved supplier POs, persisting route/source lineage and avoiding duplicate sales-order creation.
  - **Implementation Specification (Sprint Package 11):**
    1. Create `tenant_apps.sales_orders.services.draft_sales_order` seam with `create_draft_from_fulfill(inquiry)` and `create_draft_from_approved_source(purchase_order)` entry points
    2. Auto-populate SO fields using enriched Supplier Plant Contact data (Plant Contact Type, Title, Documents Responsible For)
    3. Wire as next step after BidSelection node / after approved supplier PO dispatch (CTE-03.3)
    4. Add full lineage tracking: source_email_id → inquiry_id → bid_id (if broker) → sales_order_id
    5. Deduplication: check `SalesOrder.custom_data['source_inquiry_id']` before creating
    6. Generate PDF attachment using existing PDF service pattern (reuse from CTE-03.3)
    7. Emit telemetry: `sales_order.draft_created`, `sales_order.pdf_generated`
    8. Add `POST /api/v1/inquiries/{id}/create-sales-order-draft/` endpoint
    9. Add `POST /api/v1/purchase-orders/{id}/create-sales-order-draft/` endpoint
    10. Surface "Approve & Send to Customer" Quick Action in Process Cockpit
  - **Pattern reference:** Follow `tenant_apps.inquiries.services.supplier_quote_po_draft` (CTE-02.4) exactly
  - **Non-goals:** Customer email send (that is CTE-04.2); carrier logistics (CTE-04.3).
  - **Primary domain:** backend/orders
  - **Likely touched paths:** `backend/tenant_apps/sales_orders/services/draft_sales_order.py`, `backend/tenant_apps/sales_orders/views.py`, `backend/tenant_apps/inquiries/views.py`, `backend/tenant_apps/purchase_orders/views.py`, related tests
  - **Dependencies:** CTE-03.3
  - **Blockers:** None
  - **Acceptance criteria:** A single draft `SalesOrder` creation path exists for both happy-path branches, with explicit source linkage back to inquiry and/or supplier PO; idempotent on retry; cross-tenant fail-closed; telemetry fires; PDF generated.
  - **Test reference:** Rowena/TX PO 226052 example — exercises both FULFILL (direct) and BROKER (approved PO) paths.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.sales_orders tenant_apps.purchase_orders tenant_apps.inquiries`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert draft sales-order generation and preserve upstream inquiry/supplier-PO approvals.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **CTE-04.2 sales-order-approval-pdf-and-customer-email**
  - **Status:** Shipped on `development` (PR #4955)
  - **Why now:** Customer-facing commitments need the same approval/PDF/email rigor as supplier POs before the engine can claim end-to-end automation.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 4
  - **Scope:** Extend the generic approval flow to `SalesOrder`, build the customer review/approve/send path, and tie customer-facing PDF generation plus outbound email to the approved sales-order transition.
  - **Non-goals:** No carrier RFQ yet.
  - **Primary domain:** frontend/backend/documents
  - **Likely touched paths:** `backend/tenant_apps/sales_orders/`, document-generation/email services, customer-facing review UI/services/tests
  - **Dependencies:** CTE-04.1
  - **Blockers:** None
  - **Acceptance criteria:** Sales-order approval generates the customer PDF/email exactly once and keeps explicit audit/send history tied to the approved order.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.sales_orders apps.integrations tenant_apps.workflows`; `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Disable sales-order approval side effects before reverting state/UI changes.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **CTE-04.3 carrier-rfq-match-and-outbound-freight-inquiry**
  - **Status:** Shipped on `development` (PR #4956)
  - **Why now:** Once the commercial trade is approved, logistics procurement needs the same deterministic RFQ fan-out for carriers.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 4
  - **Scope:** Match carriers/logistics providers for approved sales/order lanes and send outbound freight inquiry RFQs tied to the source sales order and/or supplier PO.
  - **Non-goals:** No carrier reply parsing yet.
  - **Primary domain:** backend/logistics/integrations
  - **Likely touched paths:** `backend/tenant_apps/carriers/`, `backend/tenant_apps/purchase_orders/`, `backend/tenant_apps/sales_orders/`, outbound email services/tests
  - **Dependencies:** CTE-04.2
  - **Blockers:** None
  - **Acceptance criteria:** Approved trades can generate auditable outbound carrier RFQs with explicit source-order linkage and recipient selection rules.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.purchase_orders tenant_apps.sales_orders tenant_apps.carriers apps.integrations`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** Medium
  - **Rollback:** Disable carrier RFQ send path and retain source-order linkage for manual logistics handling.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **CTE-04.4 structured-carrier-reply-parser-and-draft-carrier-po**
  - **Status:** Shipped — merged via PR #4959
  - **Why now:** Carrier responses need to become draft logistics commitments instead of staying trapped in unstructured inbox replies.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 4
  - **Scope:** Parse carrier replies with OpenAI structured outputs, normalize freight quote/acceptance data, and generate draft `CarrierPurchaseOrder` rows linked to the originating trade documents.
  - **Non-goals:** No auto-approval or auto-dispatch.
  - **Primary domain:** backend/ai/logistics
  - **Likely touched paths:** `backend/apps/integrations/`, `backend/tenant_apps/purchase_orders/`, `backend/tenant_apps/ai_assistant/`, `backend/tenant_apps/carriers/`, tests
  - **Dependencies:** CTE-04.3
  - **Blockers:** None
  - **Acceptance criteria:** Positive carrier replies can create draft `CarrierPurchaseOrder` rows with source-order lineage and explicit confidence/error handling.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.purchase_orders tenant_apps.carriers tenant_apps.ai_assistant apps.integrations`; `cd backend && python manage.py makemigrations --check`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Disable carrier-reply automation and preserve normalized freight quotes/source-email journals for manual carrier PO creation.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **CTE-04.5 hardcoded-happy-path-orchestrator-and-end-to-end-regressions**
  - **Status:** Shipped — merged via PR #4961
  - **Why now:** The final value of Phase 16 is the deterministic end-to-end happy path, not a collection of isolated document generators.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Epic 4
  - **Scope:** Wire the hardcoded state-machine orchestrator across inquiry routing, sourcing, approval, sales, and logistics; add end-to-end regression coverage and operator audit surfaces proving the happy path is traceable from source inquiry to downstream commercial documents.
  - **Non-goals:** No visual editor mapping yet.
  - **Primary domain:** backend/frontend integration
  - **Likely touched paths:** orchestration services across `tenant_apps/inquiries`, `tenant_apps/purchase_orders`, `tenant_apps/sales_orders`, notification/review UI surfaces, end-to-end tests, `MASTER_PLAN.md`
  - **Dependencies:** CTE-04.4
  - **Blockers:** None
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

- [x] **CTE-04.7 unified-inquiry-po-form-consolidation**
  - **Status:** Shipped — merged via PR #4970
  - **Why now:** Form fragmentation increases maintenance burden and UX inconsistency; a single UnifiedForm eliminates duplicate logic and enables direct AI Inbox → form routing.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / Sprint Execution Package 12
  - **Scope:** Create a single `UnifiedForm` component supporting modes: create / edit / clone / view / draft for both Inquiry and Purchase Order entities. Integrate Plant Contact Type + conditional field logic into PO form sections. Ensure AI Inbox "action required" items open directly into correct mode with pre-filled parsed payload. Add localStorage autosave every 30 seconds.
  - **Implementation Specification (Sprint Package 12):**
    1. Create `frontend/src/components/UnifiedForm/UnifiedForm.tsx` as a single form component with mode prop
    2. Mode-specific field visibility via `useFormMode()` hook (create shows all, view disables all, edit enables editable, clone pre-fills, draft marks as unverified)
    3. Integrate `PlantContactType` dropdown + conditional fields + multi-selects matching backend schema
    4. Wire `AIInboxItem.parsed_payload` → `UnifiedForm(mode='draft', initialValues=payload)`
    5. localStorage autosave: `useLocalStorageDraft(entityType, entityId)` hook with 30s debounce
    6. Backward compatibility: existing InquiryForm and PurchaseOrderForm remain as thin wrappers delegating to UnifiedForm
  - **Non-goals:** Replacing all forms in one go (incremental rollout); mobile form variants.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/components/UnifiedForm/`, `frontend/src/components/AIInbox/`, `frontend/src/pages/Inquiries/`, `frontend/src/pages/PurchaseOrders/`
  - **Dependencies:** CTE-04.1 (SO generation uses the form), RT-02.4 (inbox routing)
  - **Blockers:** None
  - **Acceptance criteria:** A single form component handles Inquiry and PO create/edit/view/clone/draft modes; AI Inbox items open with parsed payload pre-filled; autosave works; existing forms still function via wrapper; zero regressions in existing Workform templates.
  - **Validation commands:** `npm -C frontend run test:ci`; `npm -C frontend run verify-standards`
  - **Tenant/RLS impact:** Low (frontend only; backend already tenant-safe)
  - **Secrets/infra impact:** None
  - **Risk level:** Medium (large form refactor)
  - **Rollback:** Remove UnifiedForm import; existing forms remain functional.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic CTE-05 - Trade lineage & traceability


#### Epic CTE-05: Trade Lineage & Visualization

- [x] **CTE-05.1 trade-session-lineage-contract-and-schema** *(Shipped — PR #4963)*
  - **Status:** Shipped
  - **Why now:** Without a durable lineage identifier, operators cannot prove which inquiry or inbound email spawned a downstream supplier/sales/carrier document.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / 16b / Epic 5
  - **Scope:** Design and add the canonical `trade_id` / `TradeSession` lineage contract generated at inquiry creation and cascaded into `PurchaseOrder`, `SalesOrder`, and `CarrierPurchaseOrder`, including source-email linkage fields and additive schema rules.
  - **Non-goals:** No lineage UI yet.
  - **Primary domain:** backend/contracts
  - **Likely touched paths:** `backend/tenant_apps/inquiries/`, `backend/tenant_apps/purchase_orders/`, `backend/tenant_apps/sales_orders/`, `backend/apps/integrations/`, additive migrations/tests, `manifests/RLS_POLICIES.md`
  - **Dependencies:** CTE-04.5
  - **Blockers:** None
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

- [x] **CTE-05.2 trade-lineage-visualization-on-detail-surfaces**
  - **Status:** ✅ Shipped (PR #4981)
  - **Why now:** A lineage key only creates operator value when users can see the trade path and current state directly on detail pages.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / 16b / Epic 5
  - **Scope:** Build a lineage visualization component for relevant detail screens that renders inquiry -> supplier PO -> sales order -> carrier PO progression plus current state and exception markers.
  - **Non-goals:** No new orchestration logic.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/pages/**/Detail*.tsx`, new lineage component(s), `frontend/src/services/`, supporting backend serializers/tests
  - **Dependencies:** CTE-05.1
  - **Blockers:** None
  - **Acceptance criteria:** Operators can open a downstream document and see the complete trade lineage and current workflow state without log-diving.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`; `cd backend && python manage.py test tenant_apps.purchase_orders tenant_apps.sales_orders`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert lineage UI/serializer additions while preserving the backend lineage data.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic CTE-06 - Event-driven state transitions (Saga Pattern)


#### Epic CTE-06: Domain Events & Saga Consumers

- [x] **CTE-06.1 domain-event-contract-for-approved-trade-transitions** *(Shipped — PR #4964)*
  - **Status:** Shipped
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

- [x] **CTE-06.2 celery-saga-consumers-for-trade-side-effects**
  - **Status: ✅ Shipped (pre-existing implementation)
  - **Why now:** PDF generation, outbound email, and downstream entity creation must move off the request thread into reliable asynchronous consumers.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / 16b / Epic 6
  - **Scope:** Implement Celery/Saga consumers that react to approved-state domain events and perform downstream work such as generating sales orders, blasting PDFs/emails, and progressing logistics state.
  - **Non-goals:** No exception dashboard yet.
  - **Primary domain:** backend/async
  - **Likely touched paths:** `backend/projectmeats/celery.py`, `backend/tenant_apps/**/tasks.py`, order/inquiry transition services, document/email services, tests
  - **Dependencies:** CTE-06.1
  - **Blockers:** None — lower execution priority than CTE-05.2
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


#### Epic CTE-07: Distributed Concurrency Hardening

- [x] **CTE-07.1 select-for-update-transition-locking**
  - **Status: ✅ Shipped (PR #4980)
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

- [x] **CTE-07.2 idempotency-key-enforcement-on-ai-and-webhook-creators**
  - **Status:** ✅ Shipped (PR #4969)
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


#### Epic CTE-08: Exception Handling & Intervention

- [x] **CTE-08.1 exception-queue-model-and-trade-halt-contract**
  - **Status:** ✅ Shipped (PR #4971)
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

- [x] **CTE-08.2 trades-requiring-intervention-dashboard**
  - **Status:** Shipped on `development` (PR #4998)
  - **Why now:** Operators need a dedicated control tower to see halted trades, understand failure causes, and recover them without database spelunking.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 16 / 16b / Epic 8
  - **Scope:** Build the “Trades Requiring Intervention” dashboard and supporting APIs, surfacing exception-queue entries, lineage context, current trade state, and operator recovery affordances.
  - **Non-goals:** No automated self-healing beyond explicit retry/requeue controls.
  - **Primary domain:** frontend/backend operations
  - **Likely touched paths:** new frontend dashboard page/components, supporting backend serializers/views/services, notification hooks, tests
  - **Dependencies:** CTE-08.1
  - **Blockers:** None
  - **Acceptance criteria:** Failed automated trade steps become visible in a dedicated operator dashboard with actionable lineage and intervention context.
  - **Validation commands:** `cd backend && python manage.py test apps.core tenant_apps.inquiries tenant_apps.purchase_orders tenant_apps.sales_orders`; `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert the dashboard/UI/API while preserving exception-queue data for manual recovery.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic AMB-01 - Next-Best-Action (NBA) engine


---

### Phase 19 — Ambient AI & Contextual Next-Best-Actions (8 tickets)

> **Note:** Phase 19 is independent of Phases 17/18 and can execute in parallel once Phase 16 completes.

- [x] **AMB-01.1 contextual-suggestion-contract-and-heuristic-rules**
  - **Status:** Shipped on `development` (PR #5005)
  - **Why now:** Ambient AI cannot execute safely until there is one canonical suggestion payload and one deterministic rule layer that names what context is evaluated per entity.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 19 / Epic AMB-01
  - **Scope:** Define the `POST /api/v1/ai-assistant/suggestions/contextual/` contract (`entity_type`, `entity_id`, `current_state`), suggestion payload schema, heuristic rule inputs/outputs, cache semantics, and LLM-bounded escalation rules.
  - **Non-goals:** No UI surface or executable actions yet.
  - **Primary domain:** backend/docs/ai
  - **Likely touched paths:** `backend/tenant_apps/ai_assistant/serializers.py`, `backend/tenant_apps/ai_assistant/views.py`, `backend/tenant_apps/ai_assistant/services/`, `openapi-schema.json`, `manifests/openapi/openapi-schema.baseline.json`, `MASTER_PLAN.md`
  - **Dependencies:** CTE-08.2
  - **Blockers:** None
  - **Acceptance criteria:** The contract names request/response shape, confidence/rationale fields, cache behavior, and deterministic heuristic-first escalation into `gpt-4o-mini` without implementation guesswork.
  - **Validation commands:** `bash scripts/verify_golden_state.sh`; `cd backend && python manage.py spectacular --validate --file /tmp/projectmeats-openapi.yaml`
  - **Tenant/RLS impact:** Medium; context lookups must remain tenant-scoped and fail closed when entity ownership is ambiguous.
  - **Secrets/infra impact:** Medium; LLM use depends on existing AI credentials but must degrade gracefully when absent.
  - **Risk level:** Medium
  - **Rollback:** Revert the additive contract/docs baseline only; no runtime suggestion endpoint should ship from this ticket.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **AMB-01.2 contextual-suggestions-endpoint-and-service**
  - **Status:** Shipped on `development` (PR #5005)
  - **Why now:** Record pages need a fast backend suggestion source before any ambient UI can render contextual recommendations.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 19 / Epic AMB-01
  - **Scope:** Implement the contextual suggestion service and `POST /api/v1/ai-assistant/suggestions/contextual/` endpoint with tenant-safe entity loading, heuristic evaluation, bounded `gpt-4o-mini` enrichment, telemetry, and graceful no-suggestion fallbacks.
  - **Non-goals:** No page-header UI integration yet.
  - **Primary domain:** backend/ai
  - **Likely touched paths:** `backend/tenant_apps/ai_assistant/views.py`, `backend/tenant_apps/ai_assistant/services/`, `backend/tenant_apps/ai_assistant/tests/`, `backend/projectmeats/urls.py`, `openapi-schema.json`, `manifests/openapi/openapi-schema.baseline.json`
  - **Dependencies:** AMB-01.1
  - **Blockers:** None
  - **Acceptance criteria:** The endpoint returns deterministic structured suggestions, falls back cleanly when AI infra is unavailable, and never evaluates or returns cross-tenant entity context.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.ai_assistant apps.tenants`; `cd backend && python manage.py spectacular --validate --file /tmp/projectmeats-openapi.yaml`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** Medium
  - **Risk level:** High
  - **Rollback:** Feature-flag or disable the endpoint/service while leaving additive telemetry tables or schema in place if needed.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic AMB-02 - Inline page suggestion cards

- [x] **AMB-02.1 ambient-suggestions-component-and-service-hook**
  - **Status:** Shipped on `development` (PR #5005)
  - **Why now:** The frontend needs one stable ambient suggestion surface before record pages can render proactive AI recommendations consistently.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 19 / Epic AMB-02
  - **Scope:** Build `AmbientSuggestions`, add the service-layer client/hook for contextual suggestions, and ensure query keys/dependencies stay memoized and page-safe.
  - **Non-goals:** No record-page injection or action execution yet.
  - **Primary domain:** frontend
  - **Likely touched paths:** new `frontend/src/components/AIAssistant/AmbientSuggestions.tsx`, `frontend/src/services/aiService.ts`, new hook under `frontend/src/hooks/`, related tests
  - **Dependencies:** AMB-01.2
  - **Blockers:** None
  - **Acceptance criteria:** A standalone component can fetch and render contextual suggestions via the approved service layer without unstable query identities or chat-widget coupling.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci -- AmbientSuggestions`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** Low
  - **Risk level:** Medium
  - **Rollback:** Revert the new component/hook and leave backend suggestion generation untouched.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **AMB-02.2 record-page-header-integration-and-action-wiring**
  - **Status:** Shipped on `development` (PR #5006)
  - **Why now:** Ambient recommendations only become useful once the record header surfaces can display and execute them in context.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 19 / Epic AMB-02
  - **Scope:** Inject `AmbientSuggestions` into `UniversalEntityRecordPage.tsx` and `EntityProfileHeader.tsx`, add one-click execution wiring for safe actions, and keep the banner subtle/dismissible.
  - **Non-goals:** No anomaly detection or email drafting yet.
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/pages/UniversalEntityRecordPage.tsx`, `frontend/src/components/Shared/EntityProfileHeader.tsx`, `frontend/src/components/AIAssistant/`, related tests/E2E
  - **Dependencies:** AMB-02.1
  - **Blockers:** None
  - **Acceptance criteria:** Record pages render a stable, animated ambient suggestion banner only when suggestions exist, and actions route through approved service-layer APIs without chat-widget dependence.
  - **Validation commands:** `npm -C frontend run verify-standards`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None directly
  - **Secrets/infra impact:** Low
  - **Risk level:** Medium
  - **Rollback:** Remove the header injections and keep the standalone component available for future use.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Epic AMB-03 - Predictive anomaly detection

- [x] **AMB-03.1 product-anomaly-baseline-service-and-threshold-contract**
  - **Status:** Shipped
  - **Why now:** Form-level anomaly warnings need one canonical baseline/threshold service before any UI can warn operators about suspicious values.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 19 / Epic AMB-03
  - **Scope:** Define and implement the 90-day historical baseline service for price/weight/value outliers, including per-product aggregation rules, threshold semantics, and tenant-safe access patterns.
  - **Non-goals:** No form UX yet.
  - **Primary domain:** backend/data
  - **Likely touched paths:** `backend/tenant_apps/ai_assistant/services/` or `backend/apps/core/services/`, relevant transactional apps/tests, optional analytics endpoint wiring
  - **Dependencies:** AMB-02.2
  - **Blockers:** None
  - **Acceptance criteria:** A deterministic service can evaluate whether submitted values deviate materially from tenant history, returning baseline context suitable for a soft warning.
  - **Validation commands:** `cd backend && python manage.py test apps.core tenant_apps.products tenant_apps.sales_orders tenant_apps.purchase_orders`
  - **Tenant/RLS impact:** High
  - **Secrets/infra impact:** None
  - **Risk level:** High
  - **Rollback:** Revert the additive baseline service and any supporting endpoint without altering stored transactional data.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **AMB-03.2 universal-form-soft-warning-anomaly-flow**
  - **Status:** Shipped
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

- [x] **AMB-04.1 contextual-email-draft-service-and-outlook-contract**
  - **Status:** Shipped
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

- [x] **AMB-04.2 supplier-customer-ambient-draft-actions**
  - **Status:** Shipped
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

---


---

## Phase 17: Process Runtime Intelligence & Unified Operations

> **Execution gate:** All Phase 17 tickets are blocked behind Phase 16 CTE contracts shipping on `development`.
> **Canonical reference:** `MASTER_PLAN.md` → Phase 17

- [x] **RT-01.1 end-to-end-inquiry-to-po-process-workform-template**
  - **Status: ✅ Shipped (PR #4974)
  - **Why now:** The complete multi-trigger EndToEndInquiryToPOProcess template is the runtime foundation that all other Phase 17 epics depend on.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 17 / Epic RT-01
  - **Scope:** Create and register the production-ready JSON template with all 5 triggers (New Inquiry, Direct Customer PO, Standalone Bid, Manual SO, Trader PO), "no preceding process" safety check, FormProcess group, ForEachSupplier loop, DoUntilDueDate, BidSelection (margin logic), Generate/Send Sales Order, PO wait logic, Supplier Plant Department Contacts integration (Plant Contact Type dropdown + conditional fields + multi-selects), and telemetry events for every major step.
  - **Non-goals:** Editor rendering of the template (that is RT-05).
  - **Primary domain:** backend/workforms
  - **Likely touched paths:** `backend/tenant_apps/workflows/templates/`, `backend/tenant_apps/workflows/services/`, `backend/tenant_apps/workflows/tests/`, `docs/FORM_PROCESS_TESTING_GUIDE.md`
  - **Dependencies:** Phase 16 CTE contracts (CTE-01 through CTE-04)
  - **Blockers:** Phase 16 CTE contracts
  - **Acceptance criteria:** Template JSON validates against schema; runtime registration succeeds; all 5 trigger paths execute in isolated tenant test; telemetry events fire for each major step; 33 test cases pass per FORM_PROCESS_TESTING_GUIDE.md.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.workflows --noinput`; `bash scripts/verify_golden_state.sh`
  - **Tenant/RLS impact:** High (template executes tenant-scoped data)
  - **Secrets/infra impact:** None
  - **Risk level:** High (complex template with multiple execution paths)
  - **Rollback:** Remove template registration; existing templates unaffected (additive-only).
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-02.1 ai-inbox-15-minute-auto-sync-and-login-refresh**
  - **Status:** ✅ Shipped (PR #4954)
  - **Why now:** Reliable auto-sync is the foundation for AI Inbox production readiness.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 17 / Epic RT-02
  - **Scope:** Implement Celery beat task for 15-minute email sync cycle plus frontend polling with instant login refresh trigger.
  - **Non-goals:** Parsing engine overhaul (that is RT-02.2).
  - **Primary domain:** backend/celery + frontend/polling
  - **Likely touched paths:** `backend/apps/integrations/tasks.py`, `backend/projectmeats/celery.py`, `frontend/src/services/aiInboxService.ts`, `frontend/src/hooks/useAIInbox.ts`
  - **Dependencies:** Existing email ingestion seam (shipped)
  - **Blockers:** Phase 16 CTE contracts (sequencing gate)
  - **Acceptance criteria:** Celery beat fires every 15 minutes; frontend detects new items within 30s of login; no duplicate syncs within window.
  - **Validation commands:** `cd backend && python manage.py test apps.integrations --noinput`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Medium (sync is tenant-scoped)
  - **Secrets/infra impact:** Low (uses existing Microsoft Graph credentials)
  - **Risk level:** Low
  - **Rollback:** Disable Celery beat task; manual sync remains functional.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-02.2 ai-inbox-parsing-engine-overhaul**
  - **Status: ✅ Shipped (PR #4975)
  - **Why now:** Reliable extraction of PO numbers and form fields enables auto-creation of missing dependencies.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 17 / Epic RT-02
  - **Scope:** Overhaul parsing engine to extract PO numbers, all universal form fields, and auto-create missing dependencies (Supplier → Customer → Contact → Plant) in correct creation order with idempotent retry.
  - **Non-goals:** Feedback training loop (that is RT-02.3).
  - **Primary domain:** backend/ai_assistant
  - **Likely touched paths:** `backend/tenant_apps/ai_assistant/services/email_parser.py`, `backend/tenant_apps/ai_assistant/services/dependency_resolver.py`, `backend/tenant_apps/{suppliers,customers,contacts}/`
  - **Dependencies:** RT-02.1
  - **Blockers:** RT-02.1
  - **Acceptance criteria:** Parser extracts PO numbers from Rowena/TX PO 226052 test case; missing dependencies auto-created in correct order; idempotent on retry; no orphan records on failure.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.ai_assistant --noinput`
  - **Tenant/RLS impact:** High (creates tenant-scoped records)
  - **Secrets/infra impact:** Low
  - **Risk level:** Medium (dependency creation order matters)
  - **Rollback:** Disable auto-creation; manual entry remains available.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-02.3 ai-inbox-feedback-loop-training**
  - **Status: ✅ Shipped (PR #4977)
  - **Why now:** Thumbs up/down + mandatory comment enables continuous model improvement.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 17 / Epic RT-02
  - **Scope:** Add thumbs up/down + mandatory comment feedback UI on every parsed inbox item; persist feedback in tenant-scoped table; wire to model retraining pipeline signal.
  - **Implementation Specification (Sprint Package 14 — Production Grade):**
    1. Enhance thumbs up/down with AI-suggested correction fields and full provenance (original email + parsed payload + user changes)
    2. Create `AIFeedbackLog` model: `id, inbox_item_id, tenant_id, feedback_type(positive/negative), original_payload(JSON), corrected_payload(JSON), user_comment, user_id, created_at`
    3. Queue feedback for model retraining via Celery task `ai_assistant.tasks.queue_feedback_for_training`
    4. Add retry/parse-status badges in Process Cockpit for every ingested email (parsed/failed/corrected/retried)
    5. Auto-create missing dependencies using typed contact structure: Supplier → Contact → Plant (in correct FK order)
    6. Test with exact Rowena/TX PO 226052 example (both success + parse-failure + correction paths)
    7. Emit telemetry: `ai_feedback.submitted`, `ai_feedback.correction_applied`, `ai_dependency_autocreate.executed`
  - **Non-goals:** Actual model retraining automation (future).
  - **Primary domain:** frontend + backend/ai_assistant
  - **Likely touched paths:** `frontend/src/components/AIInbox/`, `backend/tenant_apps/ai_assistant/models.py`, `backend/tenant_apps/ai_assistant/views.py`, `backend/tenant_apps/ai_assistant/services/`, `backend/tenant_apps/ai_assistant/tasks.py`
  - **Dependencies:** RT-02.2
  - **Blockers:** RT-02.2
  - **Acceptance criteria:** Every parsed item shows feedback buttons; comment required on thumbs-down; AI-suggested corrections shown for negative feedback; full provenance stored; feedback persists and is queryable for training; missing dependencies auto-created in correct order; retry badges visible in Cockpit.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.ai_assistant --noinput`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** None
  - **Risk level:** Low
  - **Rollback:** Hide feedback UI; data persists for future use.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-02.4 ai-inbox-process-cockpit-routing**
  - **Status: ✅ Shipped (PR #4978)
  - **Why now:** "Action required" items must route into Process Cockpit with editable draft forms.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 17 / Epic RT-02
  - **Scope:** Route every "action required" inbox item directly into Process Cockpit with editable draft form pre-populated with full parsed payload.
  - **Non-goals:** Process Cockpit infrastructure (that is RT-03).
  - **Primary domain:** frontend + backend
  - **Likely touched paths:** `frontend/src/pages/ProcessCockpit/`, `frontend/src/components/AIInbox/`, `backend/tenant_apps/ai_assistant/views.py`
  - **Dependencies:** RT-02.2, RT-03.1
  - **Blockers:** RT-02.2, RT-03.1
  - **Acceptance criteria:** "Action required" items have "Open in Cockpit" action; clicking opens editable draft form with parsed payload; form saves create proper entity records.
  - **Validation commands:** `npm -C frontend run test:ci`; `cd backend && python manage.py test tenant_apps.ai_assistant --noinput`
  - **Tenant/RLS impact:** Medium
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Remove routing button; items remain in inbox.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-03.1 process-cockpit-consolidation**
  - **Status:** ✅ Shipped (PR #4980)
  - **Why now:** Single entry point for all process monitoring eliminates fragmented UX.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 17 / Epic RT-03
  - **Scope:** Consolidate Workforms Monitoring, In Progress, History, Operational Tasks, and AI Inbox into a single `/process-cockpit` route with tabbed/filtered views.
  - **Non-goals:** React Flow diagrams (that is RT-03.2).
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/pages/ProcessCockpit/`, `frontend/src/routes/`, `frontend/src/components/Navigation/`
  - **Dependencies:** Phase 16 CTE contracts (sequencing gate)
  - **Blockers:** Phase 16 CTE contracts
  - **Acceptance criteria:** `/process-cockpit` loads with all five consolidated views; existing deep links redirect; no data loss from consolidation.
  - **Validation commands:** `npm -C frontend run test:ci`; `npm -C frontend run verify-standards`
  - **Tenant/RLS impact:** Low (presentation layer only; backend APIs unchanged)
  - **Secrets/infra impact:** None
  - **Risk level:** Low
  - **Rollback:** Revert route; original pages remain functional.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-03.2 per-entity-react-flow-process-diagram**
  - **Status:** ✅ Shipped (PR #4981)
  - **Why now:** Visual process flow per entity is the key differentiator for the cockpit.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 17 / Epic RT-03
  - **Scope:** Add "View Process Flow" button on every entity record (Inquiry, SO, PO, Bid) that opens a scoped React Flow diagram showing the entity's execution path with current step highlighted.
  - **Non-goals:** Editable flow (that is RT-05).
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/components/ProcessFlow/`, `frontend/src/components/FlowEditor/`, `frontend/src/pages/ProcessCockpit/`
  - **Dependencies:** RT-03.1
  - **Blockers:** RT-03.1
  - **Acceptance criteria:** Each entity type renders a correct process flow diagram; current step is visually highlighted; diagram loads in < 2s.
  - **Validation commands:** `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Low (reads existing execution data)
  - **Secrets/infra impact:** None
  - **Risk level:** Medium (React Flow performance with complex graphs)
  - **Rollback:** Hide "View Process Flow" button; cockpit remains functional.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-03.3 cockpit-dynamic-header-and-failure-messaging**
  - **Status:** ✅ Shipped (PR #4986)
  - **Why now:** Clickable nodes with contact details and clear failure messaging eliminate "forever-running" confusion.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 17 / Epic RT-03
  - **Scope:** Implement dynamic header on flow diagrams with clickable nodes showing contact details (Plant Contact Type, Title, Responsibilities), status, docs, and plain-English inputs/outputs. Improve failure messaging to eliminate ambiguous "forever-running" states.
  - **Non-goals:** Full editor capabilities (that is RT-05).
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/components/ProcessFlow/`, `frontend/src/components/FlowEditor/nodes/`
  - **Dependencies:** RT-03.2
  - **Blockers:** RT-03.2
  - **Acceptance criteria:** Clicking a node shows enriched contact details; failed steps show clear error messages with recovery hints; no process shows "running" for > 24h without explanation.
  - **Validation commands:** `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Low
  - **Secrets/infra impact:** None
  - **Risk level:** Low
  - **Rollback:** Revert node click handlers; basic flow remains visible.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-04.1 node-plant-contact-enrichment**
  - **Status:** ✅ Shipped (PR #4984)
  - **Why now:** Workform nodes must intelligently use Plant Contact Type, Title, and "Responsible For" for RFQ/PO recipient selection.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 17 / Epic RT-04
  - **Scope:** Update SendEmail/RFQ node, Purchase Order Form Nodes, and BidSelection to resolve recipients using Plant Contact Type, Title, and "Responsible For" multi-selects from the enriched contact model.
  - **Non-goals:** UI visualization of contacts (that is RT-04.2).
  - **Primary domain:** backend/workforms
  - **Likely touched paths:** `backend/tenant_apps/workflows/services/`, `backend/tenant_apps/workflows/nodes/`, `backend/tenant_apps/suppliers/`
  - **Dependencies:** Plant Contact model enhancements (shipped in Phase 14.5)
  - **Blockers:** Phase 16 CTE contracts (sequencing gate)
  - **Acceptance criteria:** SendEmail node resolves correct recipient from Plant Contact Type; PO node includes contact title in generated documents; BidSelection respects "Responsible For" assignment.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.workflows --noinput`
  - **Tenant/RLS impact:** Medium (queries tenant-scoped contacts)
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert to manual recipient selection; existing node behavior unchanged.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-04.2 cockpit-contact-visualization**
  - **Status:** ✅ Shipped (PR #4987)
  - **Why now:** Operators need to see which contact is responsible at each process step.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 17 / Epic RT-04
  - **Scope:** Surface enriched Plant Contact data (Type, Title, Responsibilities, email, phone) in all Workform nodes and Process Cockpit flow visualizations.
  - **Non-goals:** Contact editing in cockpit (read-only display).
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/components/ProcessFlow/`, `frontend/src/components/FlowEditor/nodes/`, `frontend/src/pages/ProcessCockpit/`
  - **Dependencies:** RT-04.1, RT-03.2
  - **Blockers:** RT-04.1, RT-03.2
  - **Acceptance criteria:** Process flow nodes display assigned contact name/type; clicking shows full contact details; missing contacts show clear "unassigned" indicator.
  - **Validation commands:** `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Low
  - **Secrets/infra impact:** None
  - **Risk level:** Low
  - **Rollback:** Hide contact display; nodes remain functional.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-04.3 quick-master-data-creation-in-context**
  - **Status:** Shipped
  - **Why now:** Operators must be able to create missing dependencies without leaving the process context.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 17 / Epic RT-04
  - **Scope:** Add quick master-data creation flows (Supplier, Customer, Contact, Plant) inside AI Inbox review panels and form nodes when missing dependencies are detected during parsing or execution.
  - **Non-goals:** Full master-data management UI (existing pages handle that).
  - **Primary domain:** frontend + backend
  - **Likely touched paths:** `frontend/src/components/AIInbox/`, `frontend/src/components/QuickCreate/`, `backend/tenant_apps/{suppliers,customers,contacts}/views.py`
  - **Dependencies:** RT-02.2, RT-04.1
  - **Blockers:** AMB-03.1 and all earlier unchecked tickets remain ahead in file order
  - **Acceptance criteria:** Missing dependency triggers inline creation form; created entity immediately available in the process context; no page navigation required.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.suppliers tenant_apps.customers --noinput`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** High (creates tenant-scoped records)
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Remove inline creation; operators use existing master-data pages.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-05.1 editor-visual-support-for-complex-nodes**
  - **Status:** Shipped
  - **Why now:** The editor must render FormProcess groups, ForEach/DoUntil nodes, conditional fields, and multi-selects for the EndToEndInquiryToPOProcess template.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 17 / Epic RT-05
  - **Scope:** Add visual rendering support in the Workform Editor for FormProcess group containers, ForEach/DoUntil loop nodes, conditional field visibility, and multi-select configuration panels.
  - **Non-goals:** Full template editing (just rendering/display for now).
  - **Primary domain:** frontend/editor
  - **Likely touched paths:** `frontend/src/components/FlowEditor/nodes/`, `frontend/src/components/FlowEditor/panels/`, `frontend/src/components/FlowEditor/`
  - **Dependencies:** RT-01.1 (template must exist to render), RT-03.2 (React Flow enhancements)
  - **Blockers:** RT-01.1, RT-03.2, plus RT-01–RT-04 must be verified on dev
  - **Acceptance criteria:** EndToEndInquiryToPOProcess template loads in editor without errors; groups/loops/conditions render with correct visual hierarchy; auto-layout produces readable graph.
  - **Validation commands:** `npm -C frontend run test:ci`; `npm -C frontend run verify-standards`
  - **Tenant/RLS impact:** None (editor is presentation-only)
  - **Secrets/infra impact:** None
  - **Risk level:** Medium (complex visual rendering)
  - **Rollback:** Revert new node renderers; existing simple nodes remain unchanged.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-05.2 create-variant-workflow**
  - **Status:** Shipped
  - **Why now:** Operators need to create process variants without rebuilding from scratch.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 17 / Epic RT-05
  - **Scope:** Add "Create Variant" action in the editor that clones an existing process template into a new editable version with variant metadata, preserving lineage to the source template.
  - **Non-goals:** Version diffing or merge capabilities.
  - **Primary domain:** frontend + backend/workforms
  - **Likely touched paths:** `frontend/src/components/FlowEditor/`, `backend/tenant_apps/workflows/views.py`, `backend/tenant_apps/workflows/services/`
  - **Dependencies:** RT-05.1
  - **Blockers:** RT-05.1
  - **Acceptance criteria:** "Create Variant" produces a valid clone with new ID and variant metadata; source lineage is preserved; original template is unchanged.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.workflows --noinput`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Medium (creates tenant-scoped template)
  - **Secrets/infra impact:** None
  - **Risk level:** Low
  - **Rollback:** Remove variant action; existing templates and clone behavior unchanged.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

---

## Phase 18: Process Intelligence Scale & Self-Service Operations

> **Execution gate:** All Phase 18 tickets are blocked behind Phase 17 runtime (RT-01 through RT-04) shipping on `development`.
> **Canonical reference:** `MASTER_PLAN.md` → Phase 18

- [x] **RT-06.1 in-app-email-notification-service**
  - **Status:** Shipped
  - **Why now:** Operators need real-time awareness of process events without polling the cockpit.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 18 / Epic RT-06
  - **Scope:** Build a tenant-scoped notification service that emits in-app and email notifications for every major EndToEndInquiryToPOProcess event (new bid received, due date approaching, PO received, approval needed, process failure). Route notifications using Plant Contact Type + Responsibilities from the enriched contact model.
  - **Non-goals:** User preference UI (that is RT-06.3).
  - **Primary domain:** backend/notifications + celery
  - **Likely touched paths:** `backend/apps/core/services/notifications.py`, `backend/apps/core/models.py`, `backend/tenant_apps/workflows/services/`, `backend/apps/integrations/tasks.py`
  - **Dependencies:** Phase 17 RT-01 (telemetry events), existing email service (shipped)
  - **Blockers:** Phase 17 RT-01 through RT-04
  - **Acceptance criteria:** Each major process event triggers in-app notification within 60s; email sent to correct contact based on Plant Contact Type; notifications tenant-scoped; no duplicate notifications for same event.
  - **Validation commands:** `cd backend && python manage.py test apps.core.tests.test_notifications tenant_apps.workflows --noinput`
  - **Tenant/RLS impact:** High (notification records are tenant-scoped)
  - **Secrets/infra impact:** Low (uses existing email service credentials)
  - **Risk level:** Medium
  - **Rollback:** Disable notification Celery task; processes continue without notifications.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-06.2 quick-action-center-panel**
  - **Status:** Shipped
  - **Why now:** Operators need one-click access to common actions without navigating through forms.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 18 / Epic RT-06
  - **Scope:** Create a persistent "Quick Actions" panel component rendered in the Process Cockpit sidebar and on every entity detail page. Actions include: Approve Bid, Send RFQ, Generate SO, Reject PO, Escalate, etc. Actions are context-aware (only show relevant actions for current entity state).
  - **Non-goals:** Approval workflow logic (that is RT-07).
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/components/QuickActions/`, `frontend/src/pages/ProcessCockpit/`, `frontend/src/pages/Entities/`
  - **Dependencies:** Phase 17 RT-03.1 (Process Cockpit exists)
  - **Blockers:** Phase 17 RT-01 through RT-04
  - **Acceptance criteria:** Quick Actions panel visible on cockpit and entity pages; only context-appropriate actions shown; clicking action executes immediately or opens minimal confirmation; panel loads in < 500ms.
  - **Validation commands:** `npm -C frontend run test:ci`; `npm -C frontend run verify-standards`
  - **Tenant/RLS impact:** Low (presentation layer; actions use existing tenant-scoped APIs)
  - **Secrets/infra impact:** None
  - **Risk level:** Low
  - **Rollback:** Hide Quick Actions panel; all actions remain available through normal navigation.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-06.3 notification-user-preferences**
  - **Status:** Shipped
  - **Why now:** Users must control notification frequency to prevent overload.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 18 / Epic RT-06
  - **Scope:** Add user preference settings for notification frequency: realtime (immediate), daily digest, weekly digest, or off per event category. Store preferences in existing UserPreferences model. Add preferences UI in user settings page.
  - **Non-goals:** Advanced routing rules (use Plant Contact data from RT-06.1).
  - **Primary domain:** backend + frontend
  - **Likely touched paths:** `backend/apps/core/models.py`, `backend/apps/core/views.py`, `frontend/src/pages/Settings/`, `frontend/src/components/NotificationPreferences/`
  - **Dependencies:** RT-06.1
  - **Blockers:** RT-06.1
  - **Acceptance criteria:** Users can set per-category notification frequency; digest jobs aggregate and send at configured intervals; "off" suppresses completely; default is "realtime" for new users.
  - **Validation commands:** `cd backend && python manage.py test apps.core --noinput`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Medium (preferences are user+tenant scoped)
  - **Secrets/infra impact:** None
  - **Risk level:** Low
  - **Rollback:** Remove preference UI; all notifications default to realtime.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-06.4 notification-contact-routing-intelligence**
  - **Status:** Shipped
  - **Why now:** Notifications must reach the right person based on their role in the process.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 18 / Epic RT-06
  - **Scope:** Enhance notification routing to resolve recipients from Plant Contact Type + "Responsible For" multi-selects. Financial events → Accounting contacts; QA events → QA contacts; Procurement events → Procurement contacts. Fallback to process owner when no matching contact found.
  - **Non-goals:** Custom routing rules editor.
  - **Primary domain:** backend
  - **Likely touched paths:** `backend/apps/core/services/notifications.py`, `backend/tenant_apps/suppliers/`, `backend/tenant_apps/workflows/services/`
  - **Dependencies:** RT-06.1, Phase 17 RT-04.1 (contact enrichment)
  - **Blockers:** RT-06.1
  - **Acceptance criteria:** Financial events notify Accounting contacts; QA events notify QA contacts; missing contact type falls back to process owner with warning; no notification sent to contacts outside executing tenant.
  - **Validation commands:** `cd backend && python manage.py test apps.core.tests.test_notifications --noinput`
  - **Tenant/RLS impact:** High (cross-references tenant contact data)
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Revert to process-owner-only routing; notifications still delivered.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-07.1 approval-gate-node-type**
  - **Status:** Shipped
  - **Why now:** Configurable approval steps are critical for governance in the trading process.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 18 / Epic RT-07
  - **Scope:** Introduce a new `ApprovalGate` node type that can be inserted into FormProcess groups or after BidSelection. The node pauses process execution until an authorized approver acts. Support approval rules based on: margin threshold, credit limit, supplier risk score, order value, and custom field conditions.
  - **Non-goals:** Multi-level sequential approvals (future; this is single-gate).
  - **Primary domain:** backend/workforms
  - **Likely touched paths:** `backend/tenant_apps/workflows/nodes/approval_gate.py`, `backend/tenant_apps/workflows/services/`, `backend/tenant_apps/workflows/models.py`
  - **Dependencies:** Phase 17 RT-01 (template exists), RT-06.1 (notifications for approval routing)
  - **Blockers:** Phase 17 RT-01 through RT-04, RT-06.1
  - **Acceptance criteria:** ApprovalGate pauses execution; rule engine evaluates conditions correctly; timeout triggers escalation; approved resumes process; rejected terminates with reason; existing nodes unchanged.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.workflows --noinput`
  - **Tenant/RLS impact:** High (approval records are tenant-scoped)
  - **Secrets/infra impact:** None
  - **Risk level:** High (blocks process execution; must be reliable)
  - **Rollback:** Remove ApprovalGate from templates; processes execute without gate (auto-approve behavior).
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-07.2 cockpit-approval-panel**
  - **Status:** Shipped
  - **Why now:** Pending approvals must be visible and actionable from the Process Cockpit.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 18 / Epic RT-07
  - **Scope:** Surface pending approvals in the Process Cockpit with React Flow visualization (approval gate node highlighted amber), one-click approve/reject buttons, approval history, and delegation option. Integrate with contact types so correct department is shown.
  - **Non-goals:** Custom approval form fields (use standard approve/reject + comment).
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/components/ProcessFlow/`, `frontend/src/pages/ProcessCockpit/`, `frontend/src/components/ApprovalPanel/`
  - **Dependencies:** RT-07.1, Phase 17 RT-03.2 (React Flow diagrams)
  - **Blockers:** RT-07.1
  - **Acceptance criteria:** Pending approvals show in cockpit with count badge; clicking opens approval detail with context; approve/reject executes immediately; React Flow highlights gate node; approval history visible.
  - **Validation commands:** `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Low (reads tenant-scoped approval data)
  - **Secrets/infra impact:** None
  - **Risk level:** Medium
  - **Rollback:** Hide approval panel; approvals still actionable via direct API.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-07.3 approval-gate-template-example**
  - **Status:** Shipped
  - **Why now:** The EndToEndInquiryToPOProcess template should demonstrate the approval pattern.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 18 / Epic RT-07
  - **Scope:** Add an example ApprovalGate to the EndToEndInquiryToPOProcess template after BidSelection with rules: margin < 5% requires manager approval, order value > $50k requires finance approval. Keep existing template paths unchanged (gate is additive).
  - **Non-goals:** Multiple sequential gates (one gate per insertion point for now).
  - **Primary domain:** backend/workforms
  - **Likely touched paths:** `backend/tenant_apps/workflows/templates/`, `backend/tenant_apps/workflows/tests/`
  - **Dependencies:** RT-07.1
  - **Blockers:** RT-07.1
  - **Acceptance criteria:** Template validates with approval gate; existing trigger paths still work; gate fires for low-margin or high-value orders; gate is skipped for qualifying orders.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.workflows --noinput`
  - **Tenant/RLS impact:** Medium (approval record created per gate evaluation)
  - **Secrets/infra impact:** None
  - **Risk level:** Low (additive to existing template)
  - **Rollback:** Remove gate from template; all paths auto-approve.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-08.1 financial-calculated-fields-service**
  - **Status:** Shipped
  - **Why now:** Traders need real-time financial visibility without manual calculation.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 18 / Epic RT-08
  - **Scope:** Add background Celery job that computes and caches: Outstanding Amount, Margin %, Payment Status for Sales Orders and Purchase Orders. Store in existing `custom_data` JSONField (no schema changes). Refresh within 5 minutes of SO/PO status change.
  - **Non-goals:** Invoice generation (that is RT-08.2).
  - **Primary domain:** backend/celery
  - **Likely touched paths:** `backend/apps/core/services/financials.py`, `backend/apps/integrations/tasks.py`, `backend/tenant_apps/sales_orders/`, `backend/tenant_apps/purchase_orders/`
  - **Dependencies:** Phase 17 RT-01 (process events trigger recalculation)
  - **Blockers:** Phase 17 RT-01 through RT-04
  - **Acceptance criteria:** Calculated fields update within 5 minutes of status change; margin calculation correct to 2 decimal places; outstanding amount reflects all linked POs; payment status derived from invoice state.
  - **Validation commands:** `cd backend && python manage.py test apps.core.tests.test_financials tenant_apps.sales_orders tenant_apps.purchase_orders --noinput`
  - **Tenant/RLS impact:** High (computes across tenant-scoped orders)
  - **Secrets/infra impact:** None
  - **Risk level:** Medium (calculation accuracy critical)
  - **Rollback:** Disable Celery task; fields show "calculating..." placeholder.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-08.2 auto-invoice-generation**
  - **Status:** Shipped
  - **Why now:** Manual invoice creation is error-prone and delays payment cycles.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 18 / Epic RT-08
  - **Scope:** Auto-generate invoice records when final PO status transitions to "received". Attach invoice PDF to entity record. Route invoice notification to Accounting department contact (Plant Contact Type). No schema changes — use existing Invoice model if present or create additive model.
  - **Non-goals:** Payment processing or bank integration.
  - **Primary domain:** backend
  - **Likely touched paths:** `backend/tenant_apps/invoices/`, `backend/apps/core/services/financials.py`, `backend/apps/integrations/tasks.py`
  - **Dependencies:** RT-08.1, RT-06.1 (notification for routing)
  - **Blockers:** RT-08.1
  - **Acceptance criteria:** Invoice auto-generated on PO "received" transition; PDF attached to record; Accounting contact notified; idempotent on retry; no duplicate invoices.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.invoices --noinput`
  - **Tenant/RLS impact:** High (creates tenant-scoped invoice records)
  - **Secrets/infra impact:** None
  - **Risk level:** High (financial document accuracy critical)
  - **Rollback:** Disable auto-generation; manual invoice creation remains available.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-08.3 cockpit-financials-tab**
  - **Status:** Shipped
  - **Why now:** Traders need aggregated financial views within the process context.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 18 / Epic RT-08
  - **Scope:** Add a "Financials" tab inside the Process Cockpit showing per-trade financial summary (margin, outstanding, payment status) and aggregated portfolio view (total outstanding, average margin, overdue count). Use computed fields from RT-08.1.
  - **Implementation Specification (Sprint Package 13 — Real-Time Margin & Risk Dashboard):**
    1. Add live-calculated fields to React Flow node headers: Margin %, Outstanding Amount, Credit Risk Indicator, Supplier Risk Score
    2. Create "Financial Snapshot" panel in Process Cockpit with real-time WebSocket/polling updates (reuse existing polling pattern)
    3. Embed metrics in every entity detail page header (SO detail, PO detail, Inquiry detail)
    4. Leverage Accounting department contacts (Plant Contact Type) for automated invoice routing notifications
    5. Per-trade view: margin breakdown (cost vs sell), payment aging, outstanding vs collected
    6. Portfolio aggregate view: total outstanding, average margin, overdue count, risk distribution chart
    7. One-click drill-down from aggregate → individual trade → React Flow node detail
  - **Non-goals:** Full accounting system (this is visibility only).
  - **Primary domain:** frontend
  - **Likely touched paths:** `frontend/src/pages/ProcessCockpit/`, `frontend/src/components/Financials/`, `frontend/src/services/financialsApi.ts`, `frontend/src/components/FlowEditor/nodes/`
  - **Dependencies:** RT-08.1
  - **Blockers:** RT-08.1
  - **Acceptance criteria:** Financials tab loads with per-trade and aggregated views; data refreshes on tab focus; overdue items highlighted; export to CSV available; metrics appear in React Flow node headers; Accounting contact routing works.
  - **Validation commands:** `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Low (reads computed data from backend)
  - **Secrets/infra impact:** None
  - **Risk level:** Low
  - **Rollback:** Hide Financials tab; other cockpit tabs unchanged.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-09.1 analytics-service-and-dashboard**
  - **Status:** Shipped
  - **Why now:** Traders need data-driven insights into their process performance.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 18 / Epic RT-09
  - **Scope:** Create analytics backend service that aggregates telemetry events into: win-rate by supplier, average margin trend, process cycle time, top contacts by activity. Build "Analytics" view in Process Cockpit with interactive charts. Filter by date range, trader, or specific Workform run.
  - **Non-goals:** Real-time streaming analytics (batch aggregation is sufficient).
  - **Primary domain:** backend + frontend
  - **Likely touched paths:** `backend/apps/core/services/analytics.py`, `backend/apps/core/views.py`, `frontend/src/pages/ProcessCockpit/Analytics/`, `frontend/src/components/Charts/`
  - **Dependencies:** Phase 17 RT-01 (telemetry events as data source), RT-06.1 (additional events)
  - **Blockers:** Phase 17 RT-01 through RT-04
  - **Acceptance criteria:** Dashboard loads within 3s with up to 10k process records; charts are interactive (hover, click-through); filters update in real-time; data is tenant-scoped.
  - **Validation commands:** `cd backend && python manage.py test apps.core.tests.test_analytics --noinput`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** High (aggregates across tenant-scoped data)
  - **Secrets/infra impact:** None
  - **Risk level:** Medium (query performance with large datasets)
  - **Rollback:** Hide Analytics tab; telemetry data preserved for future use.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-09.2 analytics-export-and-metrics-surface**
  - **Status:** Shipped
  - **Why now:** Key metrics should be accessible outside the dedicated analytics page.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 18 / Epic RT-09
  - **Scope:** Add CSV/PDF export for all analytics views. Surface key metrics (win-rate, avg margin, cycle time) on the main dashboard widget and per-entity React Flow header. Define analytics event standards in WORKFORMS_DEVELOPER_GUIDE.md.
  - **Non-goals:** Custom report builder (pre-defined views only).
  - **Primary domain:** frontend + backend
  - **Likely touched paths:** `frontend/src/pages/Dashboard/`, `frontend/src/components/ProcessFlow/`, `backend/apps/core/views.py`, `docs/WORKFORMS_DEVELOPER_GUIDE.md`
  - **Dependencies:** RT-09.1
  - **Blockers:** RT-09.1
  - **Acceptance criteria:** Export produces valid CSV/PDF with correct data; dashboard widget shows 3 key metrics; React Flow header shows cycle time for active process; WORKFORMS_DEVELOPER_GUIDE.md documents event standards.
  - **Validation commands:** `cd backend && python manage.py test apps.core.tests.test_analytics --noinput`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Medium (export respects tenant boundaries)
  - **Secrets/infra impact:** None
  - **Risk level:** Low
  - **Rollback:** Remove export buttons and metric widgets; analytics page remains.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-10.1 template-library-page**
  - **Status:** Shipped
  - **Why now:** Self-service template discovery reduces dependency on developers.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 18 / Epic RT-10
  - **Scope:** Create a "Template Library" page showing the official EndToEndInquiryToPOProcess template plus published variants. Include search, category filters, version badges, and usage statistics. "Create New from Main Process" button clones the core template into an editable variant with restricted modification zones (locked nodes, required connections).
  - **Implementation Specification (Sprint Package 15 — Template Library + Variant):**
    1. Template Library page at `/templates` with grid/list toggle, search by name/tag, category filter (trading, logistics, approval)
    2. Each template card shows: name, version, last published date, usage count, author, status badge (active/draft/deprecated)
    3. "Create New from Main Process" button: deep-clones EndToEndInquiryToPOProcess, marks core nodes as `locked: true` (cannot delete), marks required connections as `required: true` (cannot disconnect)
    4. Variant editor: unlocked zones (configurable branches) allow adding/removing nodes; locked zones show lock icon + tooltip explaining why
    5. Validation on publish: ensures all required connections present, no orphan nodes, at least one trigger connected
    6. Surface library inside Workform Editor sidebar ("Browse Templates") and Process Cockpit ("Start from Template")
    7. Editor validation prevents golden-pipeline violations (no removed triggers from core template, no broken required paths)
  - **Non-goals:** Marketplace or cross-tenant template sharing.
  - **Primary domain:** frontend + backend
  - **Likely touched paths:** `frontend/src/pages/TemplateLibrary/`, `backend/tenant_apps/workflows/views.py`, `backend/tenant_apps/workflows/services/template_library.py`, `frontend/src/components/FlowEditor/`
  - **Dependencies:** Phase 17 RT-05.2 (Create Variant), RT-06 through RT-09 verified on dev, Items 11-14 verified on dev
  - **Blockers:** RT-06 through RT-09 verified on dev
  - **Acceptance criteria:** Library page shows all published templates with metadata; "Create New" produces valid restricted clone; locked nodes cannot be deleted; required connections enforced on publish; usage stats accurate; editor sidebar integration works; golden-pipeline violations blocked.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.workflows --noinput`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Medium (templates are tenant-scoped)
  - **Secrets/infra impact:** None
  - **Risk level:** Medium (restriction enforcement complexity)
  - **Rollback:** Hide Template Library page; editor remains accessible directly.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **RT-10.2 template-version-history-and-publish**
  - **Status:** Shipped
  - **Why now:** Operators need confidence that published templates are stable and reversible.
  - **Canonical source reference:** `MASTER_PLAN.md` -> Phase 18 / Epic RT-10
  - **Scope:** Add version history tracking for templates (every save creates a version). Add one-click "Publish" action that promotes a draft version to active. Add "Revert to Version" for rollback. Show version diff in editor.
  - **Implementation Specification (Sprint Package 15 — continued):**
    1. `TemplateVersion` model: id, template_id, version_number (auto-increment), schema_snapshot (JSON), author_id, created_at, status (draft/published/archived)
    2. Every editor save creates new version (draft status)
    3. "Publish" action: validates template → sets version status to published → updates template.active_version_id
    4. "Revert to Version" action: creates new version from selected historical version's schema_snapshot
    5. Version diff UI: side-by-side node comparison showing added (green), removed (red), modified (yellow) nodes
    6. Active processes always run on their version_at_start — publishing new version does NOT affect running processes
    7. Version history panel in editor shows timeline with author, date, change summary
  - **Non-goals:** Collaborative editing or merge conflict resolution.
  - **Primary domain:** backend + frontend
  - **Likely touched paths:** `backend/tenant_apps/workflows/models.py`, `backend/tenant_apps/workflows/services/`, `frontend/src/components/FlowEditor/`, `frontend/src/pages/TemplateLibrary/`
  - **Dependencies:** RT-10.1
  - **Blockers:** RT-10.1
  - **Acceptance criteria:** Every template save creates immutable version record; publish promotes version to active; revert restores previous version; version diff shows added/removed/modified nodes; active processes continue on their original version.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.workflows --noinput`; `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** Medium (version records are tenant-scoped)
  - **Secrets/infra impact:** None
  - **Risk level:** Medium (version management complexity)
  - **Rollback:** Disable version UI; templates save directly without history (current behavior).
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

---

## Sprint Execution Packages (Items 11–15)

> Historical execution packages for five major deliverables that have already shipped.
> Each package mapped to one or more existing tickets and captured the implementation blueprint used during delegation.
> **Historical gating rule:** Package 15 ran only after Packages 11–14 were verified on development.

| Package | Ticket(s) | Summary | Gate |
|---------|-----------|---------|------|
| **11** | CTE-04.1 | Draft Sales Order Generation + End-to-End Closure | Shipped |
| **12** | CTE-04.7 | Unified Inquiry & PO Form Consolidation | Shipped |
| **13** | RT-08.3 | Real-Time Margin & Risk Dashboard in Cockpit | Shipped |
| **14** | RT-02.3 | AI Feedback & Continuous Improvement Loop | Shipped |
| **15** | RT-10.1 + RT-10.2 | Template Library + One-Click Variant | Shipped |

### Execution Order & Dependencies

```
Package 11 (CTE-04.1) ─────┬──▶ Package 12 (CTE-04.7)
                            │
                            └──▶ Package 13 (RT-08.3) [parallel after RT-08.1]
                                 Package 14 (RT-02.3) [parallel after RT-02.2]

Packages 12+13+14 verified ──▶ Package 15 (RT-10.1 + RT-10.2)
```

### Cross-cutting Requirements (All Packages)
- Additive-only: never remove or modify existing nodes/models
- Reuse existing telemetry event patterns (`docs/WORKFORMS_DEVELOPER_GUIDE.md`)
- All backend changes require RLS policy verification
- All frontend changes must use service layer APIs and theme tokens
- Each package ships via: new branch → PR → merge to development
- Test reference: Rowena/TX PO 226052 example exercises all paths

---

## Identified Gaps — High-Impact Additions

> These tickets were identified during the 2026-05-07 comprehensive audit as high-ROI items missing from the backlog. They are ordered by impact and slotted into the appropriate phase dependency chain.

### Gap 1: Cross-Phase — Test Infrastructure (High ROI, Low Risk)

- [x] **INFRA-01.1 backend-test-fixtures-factory-library**
  - **Status:** Shipped
  - **Why now:** Every Phase 16–18 ticket requires tenant-scoped test data. A factory library (factory_boy) eliminates repetitive fixture creation and reduces test setup from ~30 lines to ~3 lines per test.
  - **Scope:** Create `backend/apps/core/tests/factories.py` with TenantFactory, UserFactory, InquiryFactory, SupplierFactory, PurchaseOrderFactory, SalesOrderFactory, ContactFactory, PlantFactory. All factories auto-create tenant hierarchy.
  - **Primary domain:** backend/testing
  - **Dependencies:** None (can ship immediately)
  - **Blockers:** None — **READY TO SHIP**
  - **Acceptance criteria:** All existing tests continue to pass; new factories produce valid tenant-scoped records; factory usage documented in TESTING_INSTRUCTIONS.md.
  - **Validation commands:** `cd backend && python manage.py test --noinput`
  - **Tenant/RLS impact:** None (test infrastructure only)
  - **Risk level:** Low
  - **Rollback:** Remove factories; existing tests unchanged.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **INFRA-01.2 frontend-msw-mock-service-worker-setup**
  - **Status:** Shipped
  - **Why now:** Frontend tests that hit real APIs are flaky. MSW provides deterministic API mocking that works with Vitest and matches OpenAPI contracts.
  - **Scope:** Add MSW (Mock Service Worker) setup to frontend test infrastructure. Create handlers for core API endpoints (auth, tenants, workflows, entities). Integrate with existing Vitest config.
  - **Primary domain:** frontend/testing
  - **Dependencies:** None
  - **Blockers:** None — **READY TO SHIP**
  - **Acceptance criteria:** MSW intercepts API calls in tests; existing tests pass; flaky API-dependent tests stabilized; documented in TESTING_INSTRUCTIONS.md.
  - **Validation commands:** `npm -C frontend run test:ci`
  - **Tenant/RLS impact:** None
  - **Risk level:** Low
  - **Rollback:** Remove MSW setup; tests revert to current behavior.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Gap 2: Phase 16 — Observability Bridge (High Impact)

- [x] **CTE-04.6 structured-logging-and-trace-ids-for-trading-pipeline**
  - **Status:** Shipped
  - **Why now:** The trading pipeline (CTE-01 through CTE-04) has no structured logging. When processes fail in production, debugging requires manual log correlation. Adding trace IDs now (while the pipeline is fresh) is 10x cheaper than retrofitting later.
  - **Scope:** Add a `trade_trace_id` UUID that propagates through all CTE services (inquiry → RFQ → reply → PO → SO). Emit structured JSON logs at each service boundary with trace_id, tenant_id, entity_id, step_name, duration_ms. Wire into existing Sentry transaction tracing.
  - **Primary domain:** backend
  - **Dependencies:** CTE-04.5 (after happy-path orchestrator exists)
  - **Blockers:** None — lower execution priority than CTE-05.2
  - **Acceptance criteria:** Every trade execution gets a unique trace_id; all service logs include it; Sentry shows end-to-end trace; log aggregation can filter by trace_id.
  - **Validation commands:** `cd backend && python manage.py test apps.core.tests.test_structured_logging --noinput`
  - **Tenant/RLS impact:** Low (logging only)
  - **Risk level:** Low
  - **Rollback:** Remove trace_id propagation; services continue without tracing.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Gap 3: Phase 17 — API Contract Safety (High ROI)

- [x] **RT-00.1 openapi-schema-snapshot-regression-gate**
  - **Status:** Shipped
  - **Why now:** Phase 17–18 adds many new API endpoints. Without a schema regression gate, breaking changes can slip into production. This is a one-time CI addition that protects all future work.
  - **Scope:** Add CI step that generates OpenAPI schema and diffs against committed snapshot. Fail PR if schema changes without explicit `--update-schema` flag. Protects against accidental field removal, type changes, or endpoint deletion.
  - **Primary domain:** CI/CD + backend
  - **Dependencies:** Phase 16 CTE contracts (stabilized API surface)
  - **Blockers:** CTE-04.5
  - **Acceptance criteria:** CI fails on undeclared schema changes; `make update-schema` regenerates snapshot; schema diff shown in PR comment.
  - **Validation commands:** `cd backend && python manage.py spectacular --validate --fail-on-warn`
  - **Tenant/RLS impact:** None
  - **Risk level:** Low
  - **Rollback:** Remove CI step; schema changes go undetected (current behavior).
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Gap 4: Cross-Phase — Performance Baseline (Medium Impact)

- [x] **INFRA-02.1 lighthouse-ci-budget-for-critical-pages**
  - **Status:** Shipped
  - **Why now:** Phase 17 (Process Cockpit) and Phase 18 (Analytics Dashboard) add heavy React Flow + chart components. Without a performance budget, page load can degrade silently. Adding Lighthouse CI now sets the baseline before new pages ship.
  - **Scope:** Add Lighthouse CI to PR pipeline for 5 critical pages: Dashboard, Process Cockpit, Entity Detail, Workflow Editor, Template Library. Set budgets: FCP < 2s, TTI < 4s, Bundle size < 500KB per route.
  - **Primary domain:** CI/CD + frontend
  - **Dependencies:** None (can ship immediately against current pages)
  - **Blockers:** None — **READY TO SHIP**
  - **Acceptance criteria:** Lighthouse runs on every PR; budget violations fail the check; baseline scores documented.
  - **Validation commands:** `npm -C frontend run build && npx lighthouse-ci`
  - **Tenant/RLS impact:** None
  - **Risk level:** Low
  - **Rollback:** Remove Lighthouse CI step.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

### Gap 5: Phase 18 — Data Integrity Safety Net (High Impact)

- [x] **RT-08.0 financial-calculation-reconciliation-job**
  - **Status:** Shipped
  - **Why now:** RT-08.1 introduces computed financial fields. If calculations drift from source data (e.g., due to missed events), financial reports become unreliable. A reconciliation job catches drift within 24h.
  - **Scope:** Background Celery job (daily) that recomputes all financial fields from source records and flags any drift > 0.01%. Emit alert to operations team. Auto-correct if drift is below threshold.
  - **Primary domain:** backend/celery
  - **Dependencies:** RT-08.1 (financial calculated fields must exist first)
  - **Blockers:** RT-08.1
  - **Acceptance criteria:** Daily reconciliation completes for all tenants; drift > threshold triggers alert; auto-correction preserves audit trail; job completes within 10 minutes for 10k records.
  - **Validation commands:** `cd backend && python manage.py test apps.core.tests.test_financial_reconciliation --noinput`
  - **Tenant/RLS impact:** High (iterates all tenant data)
  - **Risk level:** Medium
  - **Rollback:** Disable reconciliation job; financial fields still update via events.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

---

## Phase 20: UI/UX — Stupidly Simple & Powerful

- [x] **UX-20.1 dashboard-simplification-and-4-widget-cap**
  - **Status:** Shipped (PR #5017)
  - **Why now:** All runtime backlog (55 tickets) shipped. User feedback: dashboard is cluttered. Reduce to ≤4 core sections for maximum clarity.
  - **Scope:** Audit current dashboard, remove/consolidate widgets to ≤4, implement spacious card-based layout with generous whitespace. Sections: AI Inbox, Live Activity, Quick Actions, Recent History.
  - **Primary domain:** frontend
  - **Dependencies:** None
  - **Blockers:** None
  - **Acceptance criteria:** Dashboard renders ≤4 top-level sections; no functionality lost (moved to sub-pages); Lighthouse performance score ≥90; zero TypeScript errors.
  - **Validation commands:** `cd frontend && npx tsc --noEmit && npm run test -- --passWithNoTests`
  - **Tenant/RLS impact:** None
  - **Risk level:** Low
  - **Rollback:** Revert to previous dashboard layout.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **UX-20.2 universal-ctrl-k-command-palette**
  - **Status:** Shipped (already implemented)
  - **Why now:** Keyboard-first navigation is the #1 UX gap. Ctrl+K should be the primary way to navigate, search entities, and trigger actions.
  - **Scope:** Enhance existing CommandPalette with: global entity search (customers, suppliers, orders, contacts), recent items, quick actions (create order, send RFQ), and fuzzy matching.
  - **Primary domain:** frontend
  - **Dependencies:** UX-20.1
  - **Blockers:** UX-20.1
  - **Acceptance criteria:** Ctrl+K opens palette from any page; search returns entities within 200ms; top 5 recent items shown by default; keyboard navigation (arrows + enter) works throughout.
  - **Validation commands:** `cd frontend && npx tsc --noEmit && npm run test -- --passWithNoTests`
  - **Tenant/RLS impact:** None (frontend-only, uses existing API)
  - **Risk level:** Low
  - **Rollback:** Hide palette behind feature flag.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **UX-20.3 keyboard-shortcuts-and-documentation**
  - **Status:** Shipped (PR #5018)
  - **Why now:** Power users need one-keystroke actions. Document all shortcuts in docs/SHORTCUTS.md.
  - **Scope:** Add keyboard shortcuts for: navigation (g+d = dashboard, g+i = inbox, g+c = cockpit), actions (n = new, e = edit, Esc = close), and table operations (j/k = up/down, Enter = open). Create docs/SHORTCUTS.md.
  - **Primary domain:** frontend
  - **Dependencies:** UX-20.2
  - **Blockers:** UX-20.2
  - **Acceptance criteria:** All shortcuts work without conflicts; docs/SHORTCUTS.md created; "?" key shows shortcut overlay.
  - **Validation commands:** `cd frontend && npx tsc --noEmit && npm run test -- --passWithNoTests`
  - **Tenant/RLS impact:** None
  - **Risk level:** Low
  - **Rollback:** Remove shortcut bindings.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

## Phase 21: Full End-to-End Automation (Email → Fulfillment)

- [x] **AUTO-21.1 celery-auto-pipeline-email-to-fulfillment**
  - **Status:** Shipped (PR #5019)
  - **Why now:** Close the final 5% human gaps. Auto-create PO → confirm with supplier → update inventory → generate SO → trigger fulfillment → generate invoice.
  - **Scope:** New Celery task chain: auto_process_approved_email → create_purchase_order → await_supplier_confirmation → update_inventory → generate_sales_order → trigger_fulfillment → generate_invoice. Each step emits telemetry events.
  - **Primary domain:** backend/celery
  - **Dependencies:** UX-20.1 (cockpit must be simplified first for monitoring)
  - **Blockers:** UX-20.1
  - **Acceptance criteria:** End-to-end pipeline processes test email within 5 minutes; each step logged in ExecutionEventLog; human fallback triggered on <98% confidence; all steps idempotent.
  - **Validation commands:** `cd backend && python manage.py test tenant_apps.workflows.tests.test_auto_pipeline --noinput`
  - **Tenant/RLS impact:** High (creates records across multiple tenant models)
  - **Risk level:** Medium
  - **Rollback:** Disable Celery task; manual processing continues.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **AUTO-21.2 confidence-scoring-dashboard**
  - **Status:** Shipped (PR #5020)
  - **Why now:** Visibility into AI parsing quality. Show confidence scores per email, per field, with drill-down.
  - **Scope:** New Cockpit panel showing: average confidence by day, lowest-confidence emails, field-level breakdown, trend chart. Filter by date range and entity type.
  - **Primary domain:** frontend + backend API
  - **Dependencies:** AUTO-21.1
  - **Blockers:** AUTO-21.1
  - **Acceptance criteria:** Dashboard loads within 2s; shows last 30 days by default; export to CSV; confidence threshold configurable per tenant.
  - **Validation commands:** `cd frontend && npx tsc --noEmit && npm run test -- --passWithNoTests`
  - **Tenant/RLS impact:** Medium (queries tenant-scoped AI feedback data)
  - **Risk level:** Low
  - **Rollback:** Hide dashboard tab.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

## Phase 22: Repo + CI/CD + Golden Pipeline Perfection

- [x] **CICD-22.1 golden-files-full-audit-and-sync**
  - **Status:** Shipped (PR #5140)
  - **Why now:** Ensure zero drift between golden files and actual state. Audit GOLDEN_FILES.md, env.manifest.json, and all golden docs.
  - **Scope:** Run full audit against manifests/GOLDEN_FILES.md. Fix any drift. Add CI check that fails on golden file drift. Update all golden docs with current status.
  - **Primary domain:** CI/CD + docs
  - **Dependencies:** AUTO-21.1 (automation must be stable before locking pipeline)
  - **Blockers:** AUTO-21.1
  - **Acceptance criteria:** `bash scripts/verify_golden_state.sh` passes; CI check added to PR validation; all golden docs reflect current state.
  - **Validation commands:** `bash scripts/verify_golden_state.sh && bash .github/scripts/validate-workflows.sh`
  - **Tenant/RLS impact:** None
  - **Risk level:** Low
  - **Rollback:** Remove CI check.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`

- [x] **CICD-22.2 archive-non-canonical-files**
  - **Status:** Shipped (PR #5140)
  - **Why now:** Clean repo of stale/duplicate documentation. Move non-canonical files to .archive/.
  - **Scope:** Identify files that duplicate or contradict canonical sources. Move to archived/ with git history preserved. Update any references.
  - **Primary domain:** docs
  - **Dependencies:** CICD-22.1
  - **Blockers:** CICD-22.1
  - **Acceptance criteria:** No duplicate documentation outside archived/; all references updated; repo passes lint checks.
  - **Validation commands:** `git status && bash scripts/verify_golden_state.sh`
  - **Tenant/RLS impact:** None
  - **Risk level:** Low
  - **Rollback:** Restore from archived/.
  - **Completion evidence destination:** `.github/MASTER_PLAN.md`
