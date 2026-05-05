# GitHub Actions Workflows

This directory contains the live GitHub Actions entrypoints for ProjectMeats. For deploy rules, always defer to the canonical `docs/GOLDEN_PIPELINE.md`.

## Canonical workflow map

### Delivery and validation
- `.github/workflows/pr-validation.yml`
  - PR gate for `development`, `uat`, and `main`
  - Runs the infrastructure drift gate, migration validation, backend tests, frontend type-check/unit tests, mobile checks, and squad validation
- `.github/workflows/ai-pr-reviewer.yml`
  - AI gatekeeper for pull requests targeting `development` and `main`
  - Uses `.cursorrules` + `.github/SDLC_PROTOCOLS.md` plus deterministic guardrails to request changes on Golden Rule violations
- `.github/workflows/main-pipeline.yml`
  - Push/manual deploy entrypoint for `development`, `uat`, and `main`
  - Routes to `.github/workflows/reusable-deploy.yml`
- `.github/workflows/reusable-deploy.yml`
  - Shared deploy implementation for backend/frontend swimlanes, runner-driven migrations, SHA-tagged images, and post-deploy validation
- `.github/workflows/reusable-postdeploy-smoke.yml`
  - Reusable smoke checks for deployed environments

### Promotion and maintenance
- `.github/workflows/41-auto-promote-dev-to-uat.yml`
  - Creates PRs from `development` -> `uat` after successful dev deployment
- `.github/workflows/42-auto-promote-uat-to-main.yml`
  - Creates PRs from `uat` -> `main` after successful UAT deployment
- `.github/workflows/nightly-drift-gate.yml`
  - Nightly replay of the Golden drift checks
- `.github/workflows/secrets-audit.yml`
  - Audits workflow/environment secrets against `manifests/env.manifest.json`
- `.github/workflows/15-dependabot-merge-when-green.yml`
  - Controlled bot merge flow for approved dependency-only changes
- `.github/workflows/branch-cleanup.yml`
  - Repository hygiene for stale branches
- `.github/workflows/build-dev-image.yml`
  - Manual dev image build helper
- `.github/workflows/db-sync-prod-to-uat.yml`
  - Scheduled production-to-UAT database sync
- `.github/workflows/98-ops-db-surgery.yml`
  - Ops maintenance / database surgery workflow
- `.github/workflows/99-ops-management-command.yml`
  - Runs approved Django management commands in target lanes

## CI/CD flow

```text
development push
  -> .github/workflows/pr-validation.yml (on PRs)
  -> .github/workflows/ai-pr-reviewer.yml (on PRs to development/main)
  -> .github/workflows/main-pipeline.yml
     -> .github/workflows/reusable-deploy.yml (development lane)
     -> .github/workflows/41-auto-promote-dev-to-uat.yml

uat push
  -> .github/workflows/pr-validation.yml (on PRs)
  -> .github/workflows/main-pipeline.yml
     -> .github/workflows/reusable-deploy.yml (uat lane)
     -> .github/workflows/42-auto-promote-uat-to-main.yml

main push
  -> .github/workflows/pr-validation.yml (on PRs)
  -> .github/workflows/ai-pr-reviewer.yml (on PRs to development/main)
  -> .github/workflows/main-pipeline.yml
     -> .github/workflows/reusable-deploy.yml (production lane)
```

## Branches and environments

- Branches: `development`, `uat`, `main`
- Backend environments: `dev-backend`, `uat-backend`, `production-backend`
- Frontend environments: `dev-frontend`, `uat-frontend`, `production-frontend`

## Current principles

1. **PR Validation is the quality gate** before merges.
2. **Main Pipeline is the deploy orchestrator**; it is not split into legacy `11/12/13` workflow files.
3. **Auto-promotion creates PRs only**; it does not bypass required reviews or status checks.
4. **Secrets are manifest-defined** in `manifests/env.manifest.json`.
5. **Golden drift checks must stay green** for PRs and deploys.
6. **Release governance is explicit**: production deploys still flow from `main`, and GitHub Releases are created manually until a dedicated release workflow exists.

## Release and rollback governance

- There is **no standalone release workflow** today; production release boundaries are still the successful deploys triggered from `main`.
- If a GitHub Release is needed, create it manually from the deployed commit SHA:

```bash
gh release create <tag> --target <deployed-sha> --generate-notes
```

- Auto-promotion workflows create reviewable PRs only; they do not create tags or releases.
- Operational rollback uses `.github/scripts/deployment-rollback.sh` for development/tag-retained hosts, while UAT/Production use the previous successful deploy digest refs from GitHub Actions logs.

## Related docs

- Canonical deploy rules: `docs/GOLDEN_PIPELINE.md`
- Branch protection guide: `docs/guides/BRANCH_PROTECTION_SETUP.md`
- PR checklist: `.github/PULL_REQUEST_TEMPLATE.md`

- All workflows use GitHub Actions permissions scoping
- Secrets are managed through GitHub Secrets
- CODEOWNERS enforces review requirements
- Production deployments require environment approval
