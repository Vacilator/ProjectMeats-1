# Documentation Standards

## Canonical source of truth

- `MASTER_PLAN.md` is the only canonical source for priorities, sequencing, and definitions of done.
- `.github/MASTER_PLAN.md` is append-only shipped evidence, not a planning source.
- Archived roadmap snapshots are not active planning inputs unless explicitly promoted by `MASTER_PLAN.md`.

## Planning document placement

- Keep the cross-repo master plan in `/MASTER_PLAN.md`.
- Put any new scoped or temporary plan documents under `/docs/plans/`.
- Name new plan files with the `YYYY-MM-*` convention, for example `2026-05-entity-form-hardening.md`.

## Reference hygiene rules

- Do not link archived roadmap files from active contributor entry points such as `README.md`, PR templates, or current docs indexes.
- When a status or priority link is needed, point to `MASTER_PLAN.md`.
- Historical or governance files may mention archived roadmap files only when documenting that they are non-canonical reference material.

## Enforcement

- Local guardrail: `pre-commit` runs `python3 scripts/check_master_plan_references.py`.
- CI guardrail: `.github/workflows/pr-validation.yml` runs the same checker on every PR.

## Rollback

- If the guardrail blocks a legitimate archival reference, add the narrowest possible allowlist entry in `scripts/check_master_plan_references.py`.
- Do not reintroduce roadmap links into active contributor start points to bypass the check.
