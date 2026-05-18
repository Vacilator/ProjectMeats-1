# Golden Pipeline (Authoritative)

**Status**: ✅ Golden Standard Achieved

**Last Updated**: 2026-05-07

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
- PR validation must run pre-commit against the PR diff inside the infrastructure drift gate so local hygiene hooks and CI enforce the same repo rules without blocking on unrelated baseline cleanup.
- Migration checks must fail if there are unapplied migrations.
- Dependency review plus workflow/Dockerfile security linting must run in PR validation.
- PR validation must publish a markdown evidence report summarizing the current run's required checks and upload it as an artifact; same-repo PRs may also receive that report as an in-place PR comment.
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

### Environment-aware performance standard

- `main-pipeline.yml` must resolve exactly one target environment per run:
  - `development` push -> development deploy path
  - `uat` push -> UAT deploy path
  - `main` push -> production deploy path
- Development may prune a single swimlane **only** when the diff is clearly isolated:
  - `backend/**`-only changes may skip the frontend lane
  - `frontend/**`-only changes may skip the backend lane
- Mixed changes, infra/workflow/config changes, shared code, manifests, deploy assets, or anything outside a clearly isolated frontend/backend diff must run the full development path.
- UAT and production must always run the full Golden backend + frontend path, including all current migration, scan, and smoke requirements.
- Do not duplicate the infrastructure drift gate outside the selected reusable deploy path; Golden validation should run once per deploy path, not once in the router and again in the callee.
- Queue-skipping should happen before expensive deploy work so stale development runs fail fast without paying the full validation cost.

### Release automation (post-deploy only)

- `.github/workflows/release.yml` is a **post-production-deploy** step. It may compute semantic versions, changelog notes, and GitHub Releases only after the Golden deploy path has already succeeded.
- Semantic versioning is derived from conventional commits since the previous semantic tag:
  - `BREAKING CHANGE` / `!` → major
  - `feat:` → minor
  - everything else → patch
- Each published GitHub Release must attach an immutable artifact manifest containing:
  - backend image tag `production-${github.sha}`
  - frontend image tag `production-${github.sha}`
  - the resolved DOCR digest refs for both images
  - the source SHA and previous semantic tag
- Auto-promotion workflows may call the release workflow in **preview mode only** to enrich promotion PRs. Preview mode must never create tags, releases, or deployment side effects.
- `.github/workflows/43-release-rollback.yml` is the manual rollback helper. It consumes the attached release manifest, redeploys the recorded digests, and then reruns the direct-to-container smoke checks.
- Guardrails:
  - ✅ keep the existing Golden build/test/migrate/deploy ordering untouched
  - ✅ keep SHA-tagged images and optional deploy-by-digest behavior unchanged
  - ❌ never run migrations during release publication
  - ❌ never run migrations during rollback

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

### Backend process model (dual-process)

The backend container runs **two processes** managed by supervisord:

| Process | Port | Role | Workers |
|---------|------|------|---------|
| **Gunicorn** | 8000 | HTTP/API (REST, admin, static) | 3 (configurable via `GUNICORN_WORKERS`) |
| **Daphne** | 8001 | WebSocket only (`/ws/`) | 1 (single-threaded event loop) |

**Why**: A single Daphne process previously handled both HTTP and WebSocket traffic. A slow WebSocket consumer or stuck channel-layer call would block ALL HTTP requests, causing 504s across the board. Gunicorn's pre-fork multi-worker model means one slow request cannot block other workers.

**Nginx routing**: The frontend container's nginx routes `/ws/` to port 8001 (Daphne) and everything else to port 8000 (Gunicorn).

**Supervisord**: Automatically restarts either process if it crashes. Combined with Docker's `--restart unless-stopped` and the HEALTHCHECK directive, this provides triple-layer recovery.

### Container resource limits (mandatory)

All `docker run` invocations for backend and Celery containers **must** include:

```bash
--memory="${BACKEND_MEMORY_LIMIT:-1536m}" \
--memory-swap="${BACKEND_MEMORY_SWAP:-2g}" \
--memory-reservation="${BACKEND_MEMORY_RESERVATION:-512m}" \
--health-cmd="curl -fsS http://127.0.0.1:8000/api/v1/health/ || exit 1" \
--health-interval=30s \
--health-timeout=10s \
--health-start-period=40s \
--health-retries=3
```

Environment-tunable defaults (set in server `.env` or as `docker run -e` overrides):
- `BACKEND_MEMORY_LIMIT`: 1536m (dev), 2g (uat), 3g (production)
- `GUNICORN_WORKERS`: 3 (dev/uat), 4 (production)
- `GUNICORN_TIMEOUT`: 120s
- `GUNICORN_MAX_REQUESTS`: 1000 (recycles workers to prevent memory leaks)

### Celery worker deployment

The deploy pipeline deploys two additional containers from the **same backend image**:

| Container | CMD Override | Purpose |
|-----------|-------------|---------|
| `pm-celery-worker` | `celery -A projectmeats worker --queues=pm.ops,pm.email,pm.workforms,pm.ai,pm.etl,pm.trade --concurrency=4` | Background task execution |
| `pm-celery-beat` | `celery -A projectmeats beat --scheduler=django_celery_beat.schedulers:DatabaseScheduler` | Periodic task scheduler |

Both containers use the same `--env-file`, DB secrets, and memory limits as the backend.

### Redis/Valkey scaling guidance

If Celery tasks or channel-layer operations cause Redis memory pressure:
1. Check `redis-cli INFO memory` — `used_memory_rss` should be <70% of `maxmemory`
2. Scale the DigitalOcean managed Redis cluster (Database → Resize)
3. Recommended minimum: 1GB eviction-mode for dev, 2GB for production
4. If `pm.ai` queue backs up, consider a dedicated Redis instance for the AI queue

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

# Run the same targeted hygiene pass CI enforces on PR diffs
pre-commit run --from-ref origin/development --to-ref HEAD

# Run a management command on dev/uat/prod (via GitHub Actions)
gh workflow run "🎮 Ops - Run Management Command" \
  --repo Meats-Central/ProjectMeats \
  -f environment=dev \
  -f command=audit_rls_compliance

# Preview or publish a semantic release manually
gh workflow run "📦 Release Automation" \
  --repo Meats-Central/ProjectMeats \
  -f preview_only=true \
  -f source_ref=refs/heads/main

# Roll back production by immutable release manifest
gh workflow run "↩ Roll Back Production Release (By Digest)" \
  --repo Meats-Central/ProjectMeats \
  -f release_tag=v1.2.3
```

## Rollback and release governance

- **Development / tag-retained hosts:** prefer `.github/scripts/deployment-rollback.sh development <frontend|backend|all>` and let the script fall back to the previous locally retained environment tag.
- **UAT / Production:** treat the previous successful `reusable-deploy.yml` backend/frontend digest refs as the rollback source of truth. Export `BACKEND_IMAGE_REF` / `FRONTEND_IMAGE_REF` using those immutable refs, then run `.github/scripts/deployment-rollback.sh uat|production <frontend|backend|all>`.
- **Database safety:** migration backups live under `/root/projectmeats/db_backups/<environment>/`, and non-dev deploys verify those archives with `pg_restore --list` before migrations continue. Restore the matching backup if schema drift, not just app code, caused the incident.
- **Release path:** `.github/workflows/release.yml` is the canonical post-production release workflow. Production governance remains: merge to `main` -> successful Golden deploy -> release publication from the deployed SHA only.
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
