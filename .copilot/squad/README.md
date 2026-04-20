# ProjectMeats Copilot Squad (Enterprise)

This directory defines an **enterprise-grade Copilot Squad** for the ProjectMeats repository.

## What this is
- **Roles** (authoritative expectations and guardrails): `.copilot/squad/roles/*.md`
- **Reusable task playbooks** (repeatable workflows): `.copilot/squad/tasks/*.md`
- **Machine-readable registry** for agents + tasks + governance: `.copilot/squad/squad.json`

## Authority & governance (read these first)
- Golden Pipeline: `docs/GOLDEN_PIPELINE.md` (and `docs/reference/GOLDEN_PIPELINE.md`)
- Golden Files Registry: `manifests/GOLDEN_FILES.md`
- Canonical execution status: `MASTER_PLAN.md`
- Append-only PR log: `.github/MASTER_PLAN.md`
- Architecture (shared-schema multi-tenancy): `docs/architecture/ARCHITECTURE.md`
- Workforms additive-only standards: `docs/workforms/MIGRATION_STANDARDS.md`

## Shipping discipline (MANDATORY)
All work ships via **new branch → PR → merge to `Meats-Central/ProjectMeats:development`**.

- `MASTER_PLAN.md` is canonical for priorities/“done”.
- `ROADMAP.md` / `UI_ROADMAP.md` are reference-only unless explicitly promoted in `MASTER_PLAN.md`.

## Task taxonomy (v2 — recommended)
Use these “few powerful tasks” for most work:
- `backend-change`
- `frontend-change`
- `mobile-change`
- `db-migration-change` (high risk)
- `ci-cd-change` (high risk)
- `docs-change`
- `golden-registry-change` (high risk)

Legacy `add-*` tasks are kept for compatibility but are marked deprecated in `squad.json`.

## How to use (Copilot CLI)
This squad is designed for **GitHub Copilot CLI** (`copilot`).

1) Start Copilot CLI:
```bash
copilot
```

2) Enable parallel “squad” execution:
- Run `/fleet`
- Monitor parallel work with `/tasks`

3) Select a custom agent:
- Run `/agent` and choose one of the `projectmeats-*` agents

## Collaboration protocol: Relay → Synthesize (MANDATORY)
Copilot fleet subagents do not directly chat with each other mid-run. We enforce collaboration by a **relay + synthesis** pattern:

1) Run parallel domain agents (fleet) to gather findings.
2) Relay the key findings (paste summaries) into a **Lead Engineer** follow-up run.
3) The Lead Engineer produces a single, coherent execution plan: deliverables, acceptance criteria, dependencies, risks, testing, rollback.

**Standard synthesis prompt** (copy/paste):
> “Synthesize the following squad findings into one patch plan. Resolve conflicts, pick a recommended approach, list risks + mitigations, and specify the smallest test suite that proves correctness. Findings: …”

4) Use a reusable playbook via skills:
- Run `/skills list`
- Then invoke the skill (or ask the agent to run it)

## "gh copilot squad run" compatibility
This repo includes a **repo-local wrapper** that can be used with a `gh` alias:

```bash
bash scripts/install_gh_copilot_alias.sh

gh copilot squad run add-backend-endpoint
```

Under the hood, this prints (and can optionally execute) the equivalent `copilot` command using the correct agent + task playbook context.

## Validation
Run the squad validator:
```bash
bash scripts/validate_copilot_squad.sh
```

## Notes
- The squad configuration is **additive-only** and safe to remove via revert.
- Role/task docs are intentionally structured to support automation and validation.
