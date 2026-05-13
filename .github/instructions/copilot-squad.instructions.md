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
ALWAYS do the following for every batch of changes made: create a new branch, create a new PR, and merge to development.

Ship every batch via: **new branch → PR → merge to `Meats-Central/ProjectMeats:development`**

**CRITICAL: The PR must be MERGED before declaring work done.** Do not call task_complete
or tell the user work is shipped until:
1. PR is created targeting `development`
2. CI checks pass (wait for them — do not assume)
3. PR is merged (use `gh pr merge`)
4. Merge commit is verified on `upstream/development` (use `git fetch upstream && git log`)

## Anti-Hallucination Protocol (MANDATORY)

AI agents have a documented failure mode called **Hallucinated Completion** where they
claim work is done when files were never actually modified. To prevent this:

### Before claiming any task is done:
1. **Run `git diff --stat`** to verify files were actually modified
2. **Run type-check/lint/test** to verify changes compile and pass
3. **Never claim a file was edited without showing the actual diff or edit output**
4. **If a test or build was "running" but you moved on, go back and check the result**

### Verification checklist (run before every task_complete):
- `git diff --stat` shows expected files changed
- TypeScript compilation passes (`npx tsc --noEmit`)
- Relevant lint passes (`npm run lint:colors`, `npm run lint:render-stability`)
- PR created AND merged (not just created)
- No TODO items remain in SQL `todos` table with status != 'done'

### If context was compacted or you lost track:
- Re-read `plan.md` and SQL todos to recover state
- Re-run `git diff --stat` to see what was actually done vs planned
- Do NOT assume prior work completed — verify with filesystem checks

## Execution Quality Standards

### Depth and completeness
- When fixing a bug class (e.g., React #185), do a **project-wide sweep** — not just the
  reported crash site. Use grep/glob to find ALL instances of the pattern.
- When told to do something "comprehensively", scan every relevant file, not just the
  obvious ones. Use existing linters (render stability, colors, etc.).
- One-off fixes are insufficient. Always propose or add a **guardrail** (lint rule, CI check,
  instruction update) that prevents the bug class from recurring.

### Proactive continuation
- After completing delegated work, check for remaining backlog (`EPIC_TICKETS.md`, SQL todos)
- If backlog is empty, identify concrete improvement opportunities (tech debt, test gaps,
  performance, accessibility) and propose them
- Never sit idle asking "what next?" when there are unchecked items or obvious gaps

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
