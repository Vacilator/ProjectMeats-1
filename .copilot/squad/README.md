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
