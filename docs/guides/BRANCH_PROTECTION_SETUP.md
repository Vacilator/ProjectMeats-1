# Branch Protection Setup Guide

**Status**: ✅ CURRENT  
**Category**: Guides  
**Last Updated**: 2026-04-29

---

## Purpose

Prevent branch divergence and enforce the repo's shipping flow:

`development` -> `uat` -> `main`

Use this guide together with:
- `.github/workflows/pr-validation.yml`
- `.github/workflows/ai-pr-reviewer.yml`
- `.github/workflows/main-pipeline.yml`
- `.github/workflows/41-auto-promote-dev-to-uat.yml`
- `.github/workflows/42-auto-promote-uat-to-main.yml`

---

## Required status checks

The current PR gate is `.github/workflows/pr-validation.yml` plus `.github/workflows/ai-pr-reviewer.yml`. Require these checks on protected branches:

- `Infrastructure Drift Gate`
- `Dependency Review`
- `Automation Security`
- `Validate Migrations`
- `Backend Smoke Tests`
- `Backend Tests`
- `Frontend Type Check`
- `Frontend Unit Tests`
- `Frontend Prod Smoke`
- `Mobile Lint/Test/Type Check`
- `Validate Copilot Squad`
- `AI PR Gatekeeper`

If GitHub shows different check labels after a workflow rename, update this guide immediately and keep it aligned with `.github/workflows/pr-validation.yml` and `.github/workflows/ai-pr-reviewer.yml`.

---

## Branch protection rules

### 1. Protect `main`

- **Branch name pattern:** `main`
- Require a pull request before merging
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Require conversation resolution
- Do not allow bypassing the rules

**Why:** only UAT-validated changes should reach production.

### 2. Protect `uat`

- **Branch name pattern:** `uat`
- Require a pull request before merging
- Require status checks to pass before merging
- Restrict direct pushes

**Why:** only development-validated changes should reach UAT.

### 3. Protect `development`

- **Branch name pattern:** `development`
- Require a pull request before merging
- Require status checks to pass before merging
- Restrict direct pushes except documented admin intervention

**Why:** active development still needs the same baseline CI gate.

---

## Promotion automation

- `.github/workflows/41-auto-promote-dev-to-uat.yml` creates PRs from `development` to `uat`
- `.github/workflows/42-auto-promote-uat-to-main.yml` creates PRs from `uat` to `main`

These workflows create PRs only. They do **not** bypass reviews or branch protection.

---

## Hotfix exception process

### Preferred flow
1. Branch from `main` using `hotfix/<description>`
2. Fix and validate the issue
3. Open the emergency PR to `main`
4. Immediately backport through PRs so the change returns to `development`

### Never skip backporting

Any emergency production fix must return to `development` so the promotion chain stays linear.

---

## Monitoring branch health

```bash
git fetch origin

# main should not be ahead of development for long
git log origin/development..origin/main --oneline | wc -l

# uat should not be ahead of development for long
git log origin/development..origin/uat --oneline | wc -l

# main should not be ahead of uat for long
git log origin/uat..origin/main --oneline | wc -l
```

Expected state:
- `development` is ahead of or equal to `uat`
- `uat` is ahead of or equal to `main`
- Any divergence window should be temporary and PR-backed

---

## Setup checklist

1. Go to repository branch protection settings
2. Add rules for `development`, `uat`, and `main`
3. Require the current PR Validation checks listed above
4. Verify direct pushes are blocked
5. Document any temporary admin bypass in the incident/audit trail

---

## Troubleshooting

### "Cannot push to protected branch"
Expected. Open a PR instead.

### "Status checks failed"
Inspect `.github/workflows/pr-validation.yml` or `.github/workflows/ai-pr-reviewer.yml`, fix the failing job, and rerun.

### "main is ahead of development"
Create the missing backport PR immediately and inspect whether a hotfix bypassed the normal promotion flow.
