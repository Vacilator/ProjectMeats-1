# Copilot Squad Instructions (Copilot CLI)

These instructions are loaded automatically by **GitHub Copilot CLI** from `.github/instructions/**/*.instructions.md`.

## Goal
Use a reliable “Copilot Squad” workflow in this repo: **parallelize** investigation + validation, keep changes **surgical**, and always verify against our golden standards.

## Canonical source-of-truth (must not contradict)
- Execution status / priorities: `MASTER_PLAN.md` (canonical)
- PR execution log: `.github/MASTER_PLAN.md` (append-only)
- Golden pipeline rules: `docs/GOLDEN_PIPELINE.md`
- Golden registry: `manifests/GOLDEN_FILES.md`
- Roadmaps (`ROADMAP.md`, `UI_ROADMAP.md`) are reference-only unless explicitly promoted in `MASTER_PLAN.md`

## Shipping discipline (mandatory)
Ship every batch via: **new branch → PR → merge to `Meats-Central/ProjectMeats:development`**

## Squad Operating Mode (Fleet)
- Prefer **Fleet mode** for non-trivial tasks.
  - In Copilot CLI: run `/fleet` to enable parallel subagents.
  - Use `/tasks` to see running subagents and shell sessions.

## Standard Roles (Use as subagent prompts)
1) **Repo Scout**
   - Find the smallest set of files involved.
   - Identify constraints from: `MASTER_PLAN.md`, `manifests/GOLDEN_FILES.md`, `docs/GOLDEN_PIPELINE.md`, `.github/instructions/`.

2) **Change Implementer**
   - Make minimal, complete code edits.
   - Follow stack-specific rules:
     - Backend: shared-schema multi-tenancy + `tenant=request.tenant` filtering.
     - Frontend: service-layer APIs + theme tokens (no hardcoded colors).
     - Workflows/CI: golden pipeline rules (docker run, SHA tags, etc.).

3) **Verifier**
   - Run only existing checks.
   - Prefer targeted tests first, then broader suites if risk is high.
   - Always capture clear pass/fail.

4) **PR/Release Scribe**
   - Summarize deliverables, acceptance criteria, testing, risks, rollback.
   - Ensure any “never miss again” guardrail is proposed when appropriate.

## Safety / Quality Gates
- Always run `/diff` before declaring work done.
- For risky changes, run `/review` to get a high-signal code review.
- Don’t add new tooling unless required; use existing npm/pip/test scripts.

## Quick Commands (Copilot CLI)
- `/fleet` enable parallel squad
- `/tasks` manage background work
- `/diff` review local changes
- `/review` run code-review agent on current diff
- `/mcp`, `/skills`, `/lsp` manage extensions and code intelligence
