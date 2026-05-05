# Golden Pipeline (Authoritative)

**Status**: ✅ Golden Standard Achieved

**Last Updated**: 2026-03-22

This document is the **single source of truth** for how ProjectMeats builds, tests, migrates, and deploys across environments.

If you only read one doc before touching CI/CD: read this.

## What “Golden” means here

- Deploys are **repeatable** (immutable images, deterministic jobs)
- Frontend and backend ship in **parallel swimlanes**
- Migrations are **runner-driven** and **idempotent** (safe on redeploy)
- Secrets are **manifest-defined** and **environment-scoped**
- Health checks are **direct-to-container** (not via reverse proxy)

## Source of truth hierarchy

1. **This file** (`docs/GOLDEN_PIPELINE.md`) — canonical rules
2. **Workflows** (`.github/workflows/*.yml`) — executable implementation
3. **Secrets manifest** (`manifests/env.manifest.json`) — exact secret inventory
4. **Golden registry** (`manifests/GOLDEN_FILES.md`) — authoritative file index
5. **RLS registry** (`manifests/RLS_POLICIES.md`) — database tenant isolation audit log

## Golden rules (never violate)

### 1) Remote deployments use `docker run`, never docker-compose

- ✅ `docker pull ...:${ENV}-${SHA}` then `docker run ...`
- ❌ Never `docker-compose up` on remote hosts

Why: docker-compose version drift causes metadata failures (e.g. `KeyError: 'ContainerConfig'`).

### 2) Immutable image tags

- ✅ Must deploy SHA-tagged images: `${environment}-${github.sha}`
- ✅ UAT/Prod must resolve the pulled `${environment}-${github.sha}` tag to a digest and run by that immutable digest
- ✅ Development may remain tag-default unless digest mode is explicitly enabled for validation
- ❌ Never deploy `:latest` in production

### 3) Parallel swimlane architecture

Backend and frontend must build/test/deploy in parallel.

- ✅ `deploy-frontend` **must not** depend on `deploy-backend`
- ✅ both deploy jobs synchronize only on `migrate`

### 4) Migrations are runner-driven (not SSH-from-host)

- ✅ Run migrations from the CI runner using the Golden pattern
- ❌ Never run migrations during container startup
- ❌ Never SSH into a server and run migrations inside the deployed web container

### 5) Secrets are manifest-defined

- ✅ Don’t guess secret names. Use `manifests/env.manifest.json`.
- ✅ Secrets must be GitHub **Environment** secrets (`dev-backend`, `uat-backend`, `production-backend`, etc.).

Audit locally:

```bash
python config/manage_env.py audit
```

## Pipeline anatomy

### PR validation

- Lint/test/build gates run on PRs.
- Migration checks must fail if there are unapplied migrations.
- Dependency review plus workflow/Dockerfile security linting must run in PR validation.
- Workflow, Docker, deploy, and automation-governance changes require human Code Owner review and are never Dependabot auto-merged.

### Deploy pipeline (high level)

1. Build backend image (SHA tag)
2. Build frontend image (SHA tag)
3. Test backend
4. Test frontend
5. **Migrate** (idempotent)
6. Deploy backend (docker run)
7. Deploy frontend (docker run)
8. Post-deploy health checks

### Migrations (idempotent)

Use standard Django migrations:

```bash
python manage.py migrate --fake-initial --noinput
```

Notes:
- `--fake-initial` prevents “relation already exists” issues on redeploys
- ProjectMeats uses **shared-schema** multi-tenancy (no django-tenants)
- Runner-side backend mutation commands (`migrate`, `collectstatic`, `setup_superuser`, `seed_system_products`) must reuse the same resolved backend image ref as the deploy path

### Health checks (golden pattern)

- Backend: check container directly:
  - development / diagnostics: `http://127.0.0.1:8000/api/v1/health/`
  - UAT / production readiness gate: `http://127.0.0.1:8000/api/v1/ready/`
- Frontend: check container directly: `http://127.0.0.1:8080/`

Do **not** validate via reverse proxy ports as the primary health signal.

## References (deep dives)

- Detailed CI/CD reference: `docs/reference/GOLDEN_PIPELINE.md`
- Deployment failure prevention: `docs/PIPELINE_FAILURE_PREVENTION.md`
- Final verification checklist: `docs/PIPELINE_FINAL_VERIFICATION.md`
- Disaster recovery drill: `docs/runbooks/DISASTER_RECOVERY.md`
- Golden state verification script: `scripts/verify_golden_state.sh`

## Quick commands

```bash
# Verify repo golden state
bash scripts/verify_golden_state.sh

# Run a management command on dev/uat/prod (via GitHub Actions)
gh workflow run "🎮 Ops - Run Management Command" \
  --repo Meats-Central/ProjectMeats \
  -f environment=dev \
  -f command=audit_rls_compliance
```

## Rollback and release governance

- **Development / tag-retained hosts:** prefer `.github/scripts/deployment-rollback.sh development <frontend|backend|all>` and let the script fall back to the previous locally retained environment tag.
- **UAT / Production:** treat the previous successful `reusable-deploy.yml` backend/frontend digest refs as the rollback source of truth. Export `BACKEND_IMAGE_REF` / `FRONTEND_IMAGE_REF` using those immutable refs, then run `.github/scripts/deployment-rollback.sh uat|production <frontend|backend|all>`.
- **Database safety:** migration backups live under `/root/projectmeats/db_backups/<environment>/`, and non-dev deploys verify those archives with `pg_restore --list` before migrations continue. Restore the matching backup if schema drift, not just app code, caused the incident.
- **Release path:** there is currently no dedicated release-tag workflow. Production release governance is: merge to `main` -> successful deploy -> optional manual GitHub Release from the deployed commit SHA using `gh release create <tag> --target <sha> --generate-notes`.
- See `docs/runbooks/INCIDENT_RESPONSE.md` for incident triage and `docs/runbooks/DISASTER_RECOVERY.md` for restore drills / PITR verification.

### Non-dev observability ownership

- **Backend lane owner**
  - Confirm `REDIS_URL` / `VALKEY_URL` readiness via `python manage.py check_infrastructure --require-redis-readiness`.
  - Confirm backend Sentry contract from `manifests/env.manifest.json`: `SENTRY_ENABLED=true` for `uat-backend` and `production-backend`, with `SENTRY_DSN` set when backend error tracking is expected.
  - Review `/api/v1/health/` for `integration_summary` / `integration_warnings` after rollback or deploy, and gate traffic reopen on `/api/v1/ready/`.
- **Frontend lane owner**
  - Confirm direct container health on `http://127.0.0.1:8080/`.
  - Confirm frontend Sentry wiring uses the shared `SENTRY_DSN` runtime pass-through defined in the workflow/runtime config.
  - Capture the exact immutable frontend digest used for rollback evidence.

### UAT rollback drill

1. Open the previous successful `reusable-deploy.yml` / `main-pipeline.yml` run for the target UAT deploy.
2. Copy the last known-good backend and frontend immutable refs and export them:

```bash
export BACKEND_IMAGE_REF=registry.digitalocean.com/meatscentral/projectmeats-backend@sha256:<digest>
export FRONTEND_IMAGE_REF=registry.digitalocean.com/meatscentral/projectmeats-frontend@sha256:<digest>
```

3. Run the rollback script on the host:

```bash
bash .github/scripts/deployment-rollback.sh uat all
```

4. Validate:
   - Backend readiness: `curl http://127.0.0.1:8000/api/v1/ready/`
   - Backend observability: `curl http://127.0.0.1:8000/api/v1/health/`
   - Frontend container health: `curl -L http://127.0.0.1:8080/`
   - Lane diagnostics: `gh workflow run 99-ops-management-command.yml --repo Meats-Central/ProjectMeats -f environment=uat -f command='check_infrastructure --require-redis-readiness'`

5. Record the digests, verification output, and any `integration_warnings` in the incident log before reopening traffic.
