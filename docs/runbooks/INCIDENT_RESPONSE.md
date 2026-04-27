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
- **Health checks failing:** backend should be checked at `/api/v1/health/` and frontend via direct container port `127.0.0.1:8080/` (not reverse proxy).

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
- Roll back frontend and/or backend using the last known-good immutable image tag.
- If migrations ran and broke behavior, follow the rollback procedure in the deployment scripts and validate schema compatibility.

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
