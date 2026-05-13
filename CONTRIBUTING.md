# Contributing to ProjectMeats

> **Full contributing guide**: [`docs/getting-started/CONTRIBUTING.md`](docs/getting-started/CONTRIBUTING.md)

This file is the canonical entry point required by GitHub. It summarises the most critical policies and points to the detailed guide.

---

## ⚡ Quick Start

1. Read the **[full contributing guide](docs/getting-started/CONTRIBUTING.md)** before opening a PR.
2. Install the local hygiene hooks from an environment that already has the backend dependencies available:
   ```bash
   python3 -m pip install pre-commit
   pre-commit install
   ```
3. Run the infrastructure drift gate before every commit:
   ```bash
   bash .github/scripts/check_infrastructure.sh
   ```
4. Follow the **[branch naming convention](#branch-naming)** and **[branch hygiene policy](#branch-hygiene)**.

---

## 🔍 Golden-State Verification (Mandatory)

Every CI/CD workflow enforces infrastructure drift checks automatically. Developers **must** run the same check locally:

```bash
bash .github/scripts/check_infrastructure.sh
```

(Internally, this runs `scripts/verify_golden_state.sh` plus workflow validation.)

Before opening a PR, run the same targeted hygiene pass that CI uses for branch diffs:

```bash
pre-commit run --from-ref origin/development --to-ref HEAD
```

If you touch workflows, Golden Pipeline docs, branch-protection docs, or the golden-file registry, pre-commit now replays the Golden guardrails automatically via `scripts/verify_golden_state.sh`.

The script verifies:

| Check | Description |
|-------|-------------|
| `env.manifest.json` exists | Secret source-of-truth is present |
| `manage_env.py` has `audit_secrets` | Secret audit tooling is functional |
| SSH bastion tunnel (port 5433) | Migrations use the secure tunnel pattern |
| Docker `--network host` | Migration containers use host networking |
| Frontend container health check | Frontend is checked directly (not via proxy) |
| No `django-tenants` in `requirements.txt` | Shared-schema multi-tenancy only |
| `GOLDEN_PIPELINE.md` exists | Deployment documentation is present |
| `CONFIGURATION_AND_SECRETS.md` exists | Secrets documentation is present |
| No archived-doc references in workflows | Workflows reference live documentation |
| `run-name:` in `main-pipeline.yml` | Pipeline has a descriptive run name |

**Every workflow run also executes this check as its first job.** A failing golden-state check blocks the entire pipeline.

PR validation now also publishes a markdown evidence report summarizing the required PR checks and uploads it as a workflow artifact. Same-repo PRs receive the same report as a sticky PR comment.

See [`docs/GOLDEN_PIPELINE.md`](docs/GOLDEN_PIPELINE.md) for the full reference.

---

## 🌳 Branch Naming

All branches **must** follow: `<type>/<short-description>`

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/add-customer-export` |
| `fix/` | Bug fixes | `fix/login-validation-error` |
| `chore/` | Maintenance | `chore/update-dependencies` |
| `refactor/` | Refactoring | `refactor/payment-service` |
| `hotfix/` | Emergency fixes | `hotfix/security-patch` |
| `docs/` | Documentation | `docs/update-api-guide` |
| `test/` | Test additions | `test/add-integration-tests` |
| `ci/` | CI/CD changes | `ci/update-workflow` |

---

## 🧷 PR-Only Policy (Mandatory)

**Do not commit directly to `development`, `uat`, or `main`.**

All changes must follow:
1. Create a new branch
2. Open a Pull Request targeting `development`
3. Merge via PR (squash merge preferred) and delete the branch

This ensures review history, CI checks, and reliable rollbacks.

---

## 🧹 Branch Hygiene

**Critical: feature branches must be deleted after merging.**

| Rule | Policy |
|------|--------|
| Delete merged branches | Within **24 hours** of merge |
| Stale branch threshold | **30 days** of inactivity |
| Automated cleanup | Weekly (`.github/workflows/branch-cleanup.yml`) |
| Protected branches | `development`, `uat`, `main` — **never delete** |

The automated [`branch-cleanup.yml`](.github/workflows/branch-cleanup.yml) workflow runs every Monday at 02:00 UTC and:
- Tags stale branch tips under `archive/*` (recovery path).
- Deletes branches already merged into `development`, `uat`, or `main`.
- Deletes feature branches with **no commits in the last 30 days**.
- Can be triggered manually with `dry_run=true` to preview changes without deleting anything.

**Manual cleanup commands:**
```bash
# List merged branches
git branch -r --merged origin/development | grep -v "HEAD\|development\|main\|uat"

# Delete a remote branch
git push origin --delete <branch-name>

# Prune local stale references
git fetch --all --prune
```

---

## 📋 Pre-PR Checklist

Before opening a pull request, verify **all** items below:

- [ ] `bash scripts/verify_golden_state.sh` passes locally
- [ ] `pre-commit run --from-ref origin/development --to-ref HEAD` passes locally
- [ ] Branch follows naming convention (`<type>/<description>`)
- [ ] All new models inherit from `TenantAwareModel`
- [ ] ViewSets filter by `tenant=request.tenant`
- [ ] New tenant-aware tables include RLS policy in migration
- [ ] Frontend uses `businessApi` / `workformsApi` (no raw `axios`)
- [ ] Colors use theme tokens (no hardcoded hex values)
- [ ] Tests pass: `python manage.py test` (backend), `npm test` (frontend)
- [ ] `python manage.py makemigrations --check` produces no new files
- [ ] Documentation updated in the same PR

---

## 🔗 Key References

| Resource | Location |
|----------|----------|
| Full Contributing Guide | [`docs/getting-started/CONTRIBUTING.md`](docs/getting-started/CONTRIBUTING.md) |
| Branch Workflow Checklist | [`docs/getting-started/branch-workflow-checklist.md`](docs/getting-started/branch-workflow-checklist.md) |
| Golden Pipeline | [`docs/GOLDEN_PIPELINE.md`](docs/GOLDEN_PIPELINE.md) |
| Architecture | [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) |
| Configuration & Secrets | [`docs/CONFIGURATION_AND_SECRETS.md`](docs/CONFIGURATION_AND_SECRETS.md) |
| Design System | [`docs/guides/DESIGN_SYSTEM.md`](docs/guides/DESIGN_SYSTEM.md) |
| Copilot Instructions | [`.github/copilot-instructions.md`](.github/copilot-instructions.md) |
