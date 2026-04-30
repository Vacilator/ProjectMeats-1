# SDLC_PROTOCOLS.md

> **Status:** normative execution rules  
> **Canonical priority source:** root `MASTER_PLAN.md`  
> **Shipped evidence log:** `.github/MASTER_PLAN.md`  
> **Execution backlog:** `.github/EPIC_TICKETS.md`

## Source-of-truth hierarchy

1. `manifests/GOLDEN_FILES.md` - authority map
2. `MASTER_PLAN.md` - canonical priorities and current truth
3. `.github/MASTER_PLAN.md` - append-only shipped evidence
4. `docs/GOLDEN_PIPELINE.md` - binding CI/CD and deploy rules; `docs/reference/GOLDEN_PIPELINE.md` is reference-only and must not contradict it
5. `.github/EPIC_TICKETS.md` - ordered execution backlog
6. `.github/TECH_DEBT_REGISTER.md` - debt ledger
7. `GAP_ANALYSIS_REPORT.md` / `STRATEGIC_BLUEPRINT.md` - synthesis only

## Gate matrix

| Change type | Required commands | Blocking rules |
|---|---|---|
| Docs/protocol/backlog | `bash scripts/verify_golden_state.sh` and `bash .github/scripts/check_infrastructure.sh` | Must not contradict canonical docs or Golden Pipeline rules |
| Squad/instruction docs | `bash scripts/validate_copilot_squad.sh` | Must preserve orchestration/agent governance hierarchy |
| Frontend | `npm -C frontend run verify-standards`; add `npm -C frontend run test:ci` when behavior changes | No direct raw client bypass, no hardcoded colors, no unreviewed contract drift |
| Backend | `cd backend && python manage.py test <explicit.dotted.module.path>` | Tenant/RLS fail-closed behavior and explicit serializer/view/service ownership required |
| Config/secrets | `python config/manage_env.py audit` | Manifest is authoritative; no guessed secret names |
| CI/workflows | `bash scripts/verify_golden_state.sh` and `bash .github/scripts/check_infrastructure.sh` | Golden Pipeline invariants are non-negotiable |

## Protocol P-01: Autonomous continuation

- **Trigger:** user says `continue` or `next`, or a vague follow-up arrives after a completed delegated task
- **Required reads:** `.github/SDLC_PROTOCOLS.md` then `.github/EPIC_TICKETS.md`
- **Preconditions:** `EPIC_TICKETS.md` contains at least one unchecked ticket
- **Steps:**
  1. Read the first unchecked ticket.
  2. Confirm it is marked `Ready`.
  3. Read the listed canonical sources and likely touched paths.
  4. Execute the ticket using the squad/orchestration rules from `.github/copilot-instructions.md`.
  5. When the ticket ships, append evidence to `.github/MASTER_PLAN.md` and mark the ticket done.
- **Guardrails / prohibited actions:** do not ask idle “what next?” questions while a ready ticket exists; do not skip dependencies; do not pull work from non-canonical roadmaps.
- **Exit criteria:** one ticket moved from unchecked to checked with evidence destination filled after merge.
- **Rollback / correction:** if the first unchecked ticket is actually blocked or ambiguous, stop, fix `.github/EPIC_TICKETS.md`, and rerun this protocol.

## Protocol P-02: Ticket authoring and lifecycle

- **Trigger:** creating or editing any ticket in `.github/EPIC_TICKETS.md`
- **Required reads:** `MASTER_PLAN.md`, `manifests/GOLDEN_FILES.md`, `docs/GOLDEN_PIPELINE.md`
- **Preconditions:** ticket maps to a current canonical priority or accepted debt item
- **Required fields:** Ticket ID, Epic ID, Title, Status, Why now, Canonical source reference, Scope, Non-goals, Primary domain, Likely touched paths, Dependencies, Blockers, Acceptance criteria, Validation commands, Tenant/RLS impact, Secrets/infra impact, Risk level, Rollback, Completion evidence destination
- **Guardrails / prohibited actions:** no `TBD`, `later`, `as needed`, `...`, or vague verbs without observable outcomes; validation commands must be literal shell commands; no multi-domain monolith tickets
- **Exit criteria:** fresh-session simulation can answer what to edit, how to test, and how to roll back in under five minutes
- **Rollback / correction:** demote ambiguous tickets to `Blocked`, split them, and keep exactly one first unchecked `Ready` ticket

## Protocol P-03: Tenant and RLS safety

- **Trigger:** any backend, workflow, auth, integration, or persistence change touching tenant-aware data
- **Required reads:** `MASTER_PLAN.md`, `manifests/RLS_POLICIES.md`, `.github/instructions/backend.instructions.md`
- **Preconditions:** tenant model ownership and RLS expectations are identified before code changes
- **Exact steps:**
  1. Confirm the data is tenant-scoped.
  2. Assert `request.tenant` and `set_current_tenant()` happen before tenant-scoped ORM.
  3. Ensure persistent models use tenant-native storage, not JSON-stamped tenant context.
  4. Add or update regression tests for ambiguous/missing tenant cases.
- **Guardrails / prohibited actions:** no fail-open tenant fallbacks, no global staff bypasses, no unscoped background ORM on tenant-protected tables
- **Exit criteria:** tenant-ambiguous requests fail closed with stable codes; RLS policies remain accurate
- **Rollback / correction:** gate stricter behavior behind a flag only when necessary, but never reintroduce silent cross-tenant access

## Protocol P-04: API contract and service-layer discipline

- **Trigger:** any API surface or consumer change
- **Required reads:** `manifests/openapi/openapi-schema.baseline.json`, `.github/instructions/frontend.instructions.md`, `.github/instructions/backend.instructions.md`
- **Preconditions:** endpoint ownership and consumer domain are identified
- **Exact steps:**
  1. Update backend schema annotations when endpoint shape changes.
  2. Regenerate or align client-facing types for covered domains.
  3. Consume APIs through approved service modules/hooks only.
  4. Remove direct raw client imports from pages/components for touched domains.
- **Guardrails / prohibited actions:** no unchecked `any` payload creep, no handwritten contract drift when OpenAPI coverage exists
- **Exit criteria:** contract and consumers agree, and touched domains validate through repo commands
- **Rollback / correction:** keep compatibility wrappers while migrating; do not bypass the service layer to “fix quickly”

## Protocol P-05: Secrets, CI, and Golden Pipeline enforcement

- **Trigger:** workflow, deployment, secret, environment, or release changes
- **Required reads:** `docs/GOLDEN_PIPELINE.md`, `manifests/env.manifest.json`, `.github/instructions/workflows.instructions.md`
- **Exact commands:**
  - `bash scripts/verify_golden_state.sh`
  - `bash .github/scripts/check_infrastructure.sh`
  - `python config/manage_env.py audit`
- **Guardrails / prohibited actions:** no guessed secret names, no remote `docker-compose`, no `:latest` deploys, no remote SSH migrations inside web containers, no CI drift that bypasses required gates
- **Exit criteria:** manifests, workflows, docs, and rollback assets agree
- **Rollback / correction:** revert to the last known good workflow state and rerun the commands above before reattempting

## Protocol P-06: Testing and evidence

- **Trigger:** every ticket before completion
- **Required reads:** ticket validation commands plus root `MASTER_PLAN.md`
- **Evidence requirements:**
  - repo-specific commands actually listed in the ticket
  - clear note of where shipped proof will be recorded in `.github/MASTER_PLAN.md`
  - no “done” claims without merge-ready evidence path
- **Guardrails / prohibited actions:** no generic “run tests as needed” instructions, no PR log entry for unmerged work, no future roadmap text in `.github/MASTER_PLAN.md`
- **Exit criteria:** validation commands are explicit and the evidence destination is named
- **Rollback / correction:** mark the ticket blocked, update the commands, and rerun

## Protocol P-07: AI and autonomy safety

- **Trigger:** any AI assistant, semantic retrieval, Graph ingestion, HITL, telemetry, or export change
- **Required reads:** `MASTER_PLAN.md`, `.github/TECH_DEBT_REGISTER.md`, relevant AI ticket block in `.github/EPIC_TICKETS.md`
- **Preconditions:** the specific dependency tickets named on each EH-06 ticket are satisfied; for example EH-06.1 is blocked on EH-02.3 and EH-05.2, not on completion of every ticket in those epics
- **Exact steps:**
  1. Preserve tenant-native persistence and RLS.
  2. Require durable lineage from source event to artifact to action.
  3. Use resilient HTTP clients with timeout, retry, and rate-limit handling.
  4. Store exports in durable managed storage, never local `/tmp`.
- **Guardrails / prohibited actions:** no synthetic production metrics without labels, no autonomous destructive action without approval policy, no fake semantic indexing
- **Exit criteria:** lineage, approvals, telemetry, and rollback strategy are documented and tested for the touched flow
- **Rollback / correction:** disable the autonomy entrypoint/feature flag rather than bypassing safety storage rules

## Protocol P-08: Documentation drift correction

- **Trigger:** any contradiction among planning docs
- **Required reads:** `MASTER_PLAN.md`, `.github/MASTER_PLAN.md`, `docs/GOLDEN_PIPELINE.md`, `manifests/GOLDEN_FILES.md`
- **Exact steps:**
  1. Freeze execution against the drifted doc.
  2. Re-establish the canonical answer from the files above.
  3. Revert or correct the drifted planning doc.
  4. Re-run the docs validation commands.
- **Guardrails / prohibited actions:** do not let optional synthesis docs outrank canonical docs
- **Exit criteria:** one deterministic next ticket remains and all authorities agree
- **Rollback / correction:** if needed, revert the offending docs batch and rebuild order from canonical sources

## Protocol P-09: Smart Loader and referential stability

- **Trigger:** any frontend form, record page, config panel, or React Query refactor
- **Required reads:** `.github/instructions/frontend.instructions.md`, `.github/copilot-instructions.md`, relevant ticket paths in `.github/EPIC_TICKETS.md`
- **Preconditions:** the loader boundary, presentational surface, and mutation ownership are identified before code changes
- **Exact steps:**
  1. Keep data fetching in a Smart Loader route/container; pass resolved data downward as stable props.
  2. Do not put direct `useQuery` / `useMutation` calls inside `*Form.tsx` or other dumb-form surfaces unless the component is explicitly the loader boundary.
  3. Memoize query keys, option objects, dependency arrays, and callbacks so referential equality is stable across renders.
  4. Avoid inline object/array literals in `queryKey`, `useMemo`, `useEffect`, and `useQueries` inputs when those values can be built once from primitive dependencies.
  5. Mount heavy editing surfaces only after schema, record data, and option sets are ready.
- **Guardrails / prohibited actions:** no mount-before-ready form hydration, no inline query-option builders that churn each render, no render-loop fixes without a regression test or production-style browser smoke when runtime churn was user-visible
- **Exit criteria:** the loader boundary is explicit, render inputs are referentially stable, and the touched flow has regression coverage proportionate to the risk
- **Rollback / correction:** move fetching back to the nearest stable route/container boundary and restore memoized identities before adding new behavior

## Protocol P-10: Squad orchestration

- **Trigger:** any multi-domain feature, incident, roadmap, or repo-wide audit
- **Required reads:** `.github/copilot-instructions.md`, `.copilot/squad/squad.json`, `MASTER_PLAN.md`, `.github/EPIC_TICKETS.md`
- **Exact steps:**
  1. Use Fleet/Squad mode for multi-domain work instead of single-threaded implementation.
  2. Split work into at least discovery, implementation, validation, and release/documentation responsibilities.
  3. Keep canonical planning in `MASTER_PLAN.md`, shipped evidence in `.github/MASTER_PLAN.md`, and execution order in `.github/EPIC_TICKETS.md`.
  4. If scope changes midstream, stop or block stale delegated work instead of letting parallel agents continue on an obsolete plan.
- **Guardrails / prohibited actions:** do not invent parallel work outside canonical priorities, do not let subagents contradict canonical docs, and do not leave delegated scopes untracked
- **Exit criteria:** delegated work is either shipped, blocked with a reason, or reflected in the ordered backlog
- **Rollback / correction:** cancel stale agents, restore canonical ordering, and re-seed todos/backlog items before resuming execution
