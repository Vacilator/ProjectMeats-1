# Golden Pipeline Reference Companion

> **Reference-only companion.** For authoritative rules, use `docs/GOLDEN_PIPELINE.md`.
> **Guarded sections** such as deploy method, health-check targets, and secret source-of-truth must stay in parity with `docs/GOLDEN_PIPELINE.md`, `scripts/verify_golden_state.sh`, and `.github/scripts/check_infrastructure.sh`.

This page is intentionally brief. Its job is to route operators to the correct authority, not to restate deploy mechanics, health-check targets, or secret rules from memory.

## Quick links

- Canonical Golden Pipeline rules: `docs/GOLDEN_PIPELINE.md`
- Workflow map and branch flow: `.github/workflows/README.md`
- Branch protection rules: `docs/guides/BRANCH_PROTECTION_SETUP.md`
- Golden file registry: `manifests/GOLDEN_FILES.md`
- Secret/source-of-truth manifest: `manifests/env.manifest.json`

## Workflow entrypoints

- PR validation gate: `.github/workflows/pr-validation.yml`
- Deploy orchestrator: `.github/workflows/main-pipeline.yml`
- Shared deploy implementation: `.github/workflows/reusable-deploy.yml`
- Dev -> UAT promotion: `.github/workflows/41-auto-promote-dev-to-uat.yml`
- UAT -> main promotion: `.github/workflows/42-auto-promote-uat-to-main.yml`

For what each workflow does, read `.github/workflows/README.md`. For which deploy patterns are allowed, defer to `docs/GOLDEN_PIPELINE.md`.

## Drift-gate commands

Run these before and after CI/docs changes:

```bash
bash scripts/verify_golden_state.sh
bash .github/scripts/check_infrastructure.sh
```

If either command fails, fix the named file/rule drift first. Do not update this reference page to “explain around” a failing canonical rule.
