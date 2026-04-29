# Incident Response Runbook

This runbook standardizes how we triage, mitigate, and recover from incidents in ProjectMeats.

## Goals
- Restore service quickly and safely
- Protect tenant isolation and data integrity
- Capture learnings and add guardrails (“never miss again”)

## Severity (S)
- **S1 (Critical):** data leak/cross-tenant access, auth bypass, production outage
- **S2 (High):** partial outage, degraded core workflows, widespread errors
- **S3 (Medium):** localized issue, workaround exists
- **S4 (Low):** cosmetic, low impact

## First 10 minutes (always do this)
1. **Identify scope:** environment (dev/uat/prod), frontend/backend/both, number of tenants/users affected.
2. **Stabilize:** stop the bleeding (feature flag off, rollback deploy, disable job) before deep diagnosis.
3. **Check for tenant isolation risk:** any hint of cross-tenant access is **S1**.

## Fast signals (where to look)
- **Sentry:** error spikes, auth failures (401/403), DB errors (RLS), request URLs
- **GitHub Actions:** last deployment run, migration job logs, health-check failures
- **Backend container logs:** startup errors, migration mismatches, 5xx loops

## Golden Pipeline triage (deployment/migrations)
Authoritative reference: `docs/GOLDEN_PIPELINE.md`

Common failure modes:
- **Unapplied migrations detected:** run `python manage.py makemigrations` and commit generated files (CI blocks drift).
- **"relation already exists" redeploy:** use idempotent migrations: `python manage.py migrate --fake-initial --noinput`.
- **Health checks failing:** backend should be checked at `/api/v1/ready/` for UAT/production readiness, `/api/v1/health/` for diagnostics, and frontend via direct container port `127.0.0.1:8080/` (not reverse proxy).

## Tenant isolation / RLS triage (S1)
If there is any hint of cross-tenant exposure:
1. **Assume S1 and escalate immediately.**
2. Validate app-layer scoping: ViewSets must filter by `request.tenant` and fail-closed when missing.
3. Validate DB-layer isolation:
   - Confirm RLS enabled and policies exist:
     - `SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE rowsecurity = true;`
     - `SELECT schemaname, tablename, policyname FROM pg_policies WHERE policyname LIKE '%tenant_isolation%';`
4. If needed, **rollback to last known-good SHA-tagged image** (immutable tags are mandatory).

## Auth incidents (JWT/session)
- If users are unexpectedly logged out or stuck in refresh loops:
  - Verify 401/403 handling is centralized in the frontend API layer.
  - Confirm no direct `fetch()` bypasses exist for authenticated endpoints.

## Rollback playbook (preferred over risky hotfixes)
- **Development / tag-retained hosts:** use `.github/scripts/deployment-rollback.sh` with the same registry/image names as the deploy workflow.
- **UAT / Production:** prefer digest-based manual rollback using the previous successful deploy’s immutable image refs from GitHub Actions.
- If migrations ran and broke behavior, restore the database backup before retrying traffic and validate schema compatibility.

### Quick rollback command

```bash
# Script accepts development|uat|production (and dev/prod aliases)
export REGISTRY=registry.digitalocean.com/meatscentral
export FRONTEND_IMAGE=projectmeats-frontend
export BACKEND_IMAGE=projectmeats-backend

bash .github/scripts/deployment-rollback.sh development all
```

The rollback script expects the live deploy filesystem layout:
- Backend env file: `/root/projectmeats/backend/.env`
- Backend volumes: `/root/projectmeats/media`, `/root/projectmeats/staticfiles`
- Frontend env config: `/opt/pm/frontend/env/env-config.js`
- Frontend bind: `127.0.0.1:8080 -> 80`

### Manual immutable rollback (required for UAT/Production if digest refs changed)

1. Open the last known-good `main-pipeline.yml` / `reusable-deploy.yml` run in GitHub Actions.
2. Copy the previous backend/frontend digest refs from the deploy logs.
3. SSH to the target host and rerun the container with that digest:

```bash
docker run -d --name pm-backend \
  --restart unless-stopped \
  -p 8000:8000 \
  --env-file /root/projectmeats/backend/.env \
  -v /root/projectmeats/media:/app/media \
  -v /root/projectmeats/staticfiles:/app/staticfiles \
  registry.digitalocean.com/meatscentral/projectmeats-backend@sha256:<previous-digest>
```

4. Verify health directly on the container endpoints:
   - Backend: `curl http://127.0.0.1:8000/api/v1/ready/` (UAT/production), `curl http://127.0.0.1:8000/api/v1/health/` (diagnostics)
   - Frontend: `curl -L http://127.0.0.1:8080/`

### Database rollback note

UAT/Production migrations create backups under `/root/projectmeats/db_backups/<environment>/`.
If schema changes caused the incident, restore the matching backup before reintroducing traffic.

## Communication
- S1/S2: notify stakeholders immediately with:
  - what’s broken, who is impacted, and current mitigation
  - next update time (not ETA)
  - whether tenant isolation risk exists

## Post-incident (required)
1. Write a short postmortem:
   - root cause, contributing factors, customer impact
   - detection gap + how to detect earlier
2. Add a guardrail:
   - CI check, validator, test, or golden-file contract
3. Update canonical docs if behavior/process changed:
   - `MASTER_PLAN.md` (canonical), `.github/MASTER_PLAN.md` (execution log)
