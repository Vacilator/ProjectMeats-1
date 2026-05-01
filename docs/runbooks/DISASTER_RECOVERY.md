# Disaster Recovery & Restore Drill Runbook

**Status:** ✅ CURRENT  
**Category:** Runbooks  
**Last Updated:** 2026-05-01

---

## Purpose

This runbook documents the current ProjectMeats disaster-recovery contract for non-development lanes.

Today, the repo guarantees:

1. **Pre-migration custom-format backups** for UAT and production under `/root/projectmeats/db_backups/<environment>/`
2. **Backup readability verification** during non-dev deploys using `pg_restore --list`
3. **App-level validation commands** that operators can run after a restore drill

This runbook does **not** claim that provider-side WAL/PITR automation is fully codified in the repo yet. Until a later GA batch codifies that control plane, PITR must be manually verified and recorded during each drill.

## Recovery model

| Lane | Repo-backed recovery artifact | Minimum repo-backed recovery point | Notes |
| --- | --- | --- | --- |
| `development` | best-effort deploy rollback + local diagnostics | previous successful deploy / local backup, if present | no formal DR guarantee |
| `uat` | pre-migration custom dump | latest retained `/root/projectmeats/db_backups/uat/pgdump_*.dump` | preferred drill lane |
| `production` | pre-migration custom dump + provider PITR verification checklist | latest retained `/root/projectmeats/db_backups/production/pgdump_*.dump` unless provider PITR is confirmed tighter | do not drill against the live primary database |

## RPO / RTO expectations

- **Repo-backed minimum RPO:** the latest retained pre-migration custom-format dump for the target lane.
- **Repo-backed minimum RTO:** manual restore time plus post-restore validation time.
- **Provider PITR expectation:** if DigitalOcean/AWS managed Postgres PITR is enabled, record the provider retention window and last restorable timestamp during every drill. Do not claim a tighter RPO than the evidence you captured.

## Manual PITR verification checklist

Perform this in the database provider control plane for the target lane:

1. Confirm point-in-time restore is enabled for the database cluster.
2. Record the retention window shown by the provider.
3. Record the most recent restorable timestamp.
4. Confirm automated backups are healthy and current.
5. Save the evidence in the incident or drill log together with the commit SHA and operator name.

If any of those checks fail, treat the lane as **dump-restore only** until provider PITR is repaired and re-verified.

## Backup artifact verification

Non-dev deploys already create and verify a backup before migrations:

- workflow: `.github/workflows/reusable-deploy.yml`
- path: `/root/projectmeats/db_backups/<environment>/pgdump_<environment>_<timestamp>_<sha>_<run_id>.dump`
- validation: `pg_restore --list` against the retained dump archive

Use the deployment logs to capture the exact backup path before beginning a restore drill.

## Async queue saturation guardrails

GA-02.3 codifies the queue ownership and worker envelope that operators should treat as the current incident-response baseline:

| Queue | Worker lane | Warn | Critical |
| --- | --- | --- | --- |
| `pm.workforms` | `pm-worker-workforms` | backlog `>20` | backlog `>50` or oldest task `>5m` |
| `pm.email` | `pm-worker-realtime` | backlog `>50` | backlog `>100` or oldest task `>10m` |
| `pm.ai` | `pm-worker-ai` | backlog `>5` | backlog `>10` or oldest task `>15m` |
| `pm.etl` | `pm-worker-etl` | backlog `>0` outside an ETL window | any backlog outside a controlled import window |

When a lane breaches critical thresholds:

1. Confirm which queue family is saturating before scaling anything.
2. Preserve `pm.workforms` latency first; do not let AI or ETL work steal workform capacity.
3. Keep ETL isolated to `pm.etl` and stop the ETL worker entirely if live tenant traffic is impacted.
4. Record the queue depth, oldest-task age, and active worker envelope alongside the restore / incident evidence.

## Broker distress playbook

Treat these as the minimum Redis/Valkey runtime guardrails for non-dev lanes:

1. expected eviction policy: `noeviction`
2. memory warning threshold: `70%`
3. memory critical threshold: `85%`
4. diagnostic command: `python manage.py check_infrastructure --require-redis-readiness`

Do **not** respond to memory pressure by changing the eviction policy to an evicting mode or by blanket-purging queues. In a shared broker, that risks cross-tenant task loss.

Preferred sequence under pressure:

1. run the diagnostic command and capture the reported policy / queue-health summary
2. shed `pm.ai` work first if AI backlog is the main contributor
3. stop the `pm-worker-etl` lane if ETL work is active and live traffic is affected
4. keep `pm.workforms` capacity reserved for tenant-facing execution traffic
5. record every manual action in the drill / incident evidence log

## Recommended restore drill lane

Run restore drills against:

- **UAT** when possible
- or an **isolated restore target** that is not serving live production traffic

Do **not** restore directly into the live production primary as part of a drill.

## Restore drill procedure

### 1. Identify the backup artifact

Example on the target host:

```bash
ls -1t /root/projectmeats/db_backups/uat/pgdump_uat_*.dump | head -1
```

### 2. Prepare an isolated restore target

Create a disposable database on the target PostgreSQL server or use a disposable restore host. The target must not be the live production application database.

Example target name:

```bash
projectmeats_restore_drill
```

### 3. Restore the retained dump

The safest repo-aligned pattern is:

1. open the same SSH tunnel pattern used by the Golden Pipeline
2. stream the retained dump from the host
3. restore into the isolated target database

Example:

```bash
export SSHPASS='<ssh-password>'
export SSH_USER='<ssh-user>'
export SSH_HOST='<ssh-host>'
export DB_HOST='<db-host>'
export DB_PORT='5432'
export DB_USER='<db-user>'
export DB_PASSWORD='<db-password>'
export BACKUP_PATH='/root/projectmeats/db_backups/uat/pgdump_uat_<timestamp>_<sha>_<run_id>.dump'

sshpass -e ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  -N -L "5435:${DB_HOST}:${DB_PORT}" \
  "${SSH_USER}@${SSH_HOST}" &
SSH_TUNNEL_PID=$!

export PGPASSWORD="${DB_PASSWORD}"
createdb -h 127.0.0.1 -p 5435 -U "${DB_USER}" projectmeats_restore_drill

sshpass -e ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  "${SSH_USER}@${SSH_HOST}" "cat '${BACKUP_PATH}'" \
  | pg_restore \
      --clean \
      --if-exists \
      -h 127.0.0.1 \
      -p 5435 \
      -U "${DB_USER}" \
      -d projectmeats_restore_drill

kill "${SSH_TUNNEL_PID}"
```

## Post-restore validation

After the restore completes, verify application expectations before declaring the drill successful.

### Database checks

```sql
SELECT COUNT(*) FROM apps_tenants_tenant;
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE rowsecurity = true ORDER BY schemaname, tablename;
SELECT schemaname, tablename, policyname FROM pg_policies WHERE policyname LIKE '%tenant_isolation%' ORDER BY schemaname, tablename, policyname;
```

### App-level verification

Run the standard infrastructure diagnostic through the managed workflow:

```bash
gh workflow run "🎮 Ops - Run Management Command" \
  --repo Meats-Central/ProjectMeats \
  -f environment=uat \
  -f command='check_infrastructure --require-redis-readiness'
```

If you restored a disposable environment that is reachable by the app:

- verify backend readiness: `curl http://127.0.0.1:8000/api/v1/ready/`
- verify backend diagnostics: `curl http://127.0.0.1:8000/api/v1/health/`
- verify frontend container health: `curl -L http://127.0.0.1:8080/`

## Evidence to record

For every drill, record:

1. environment and operator
2. commit SHA and workflow run
3. exact backup artifact path
4. provider PITR retention window and last restorable timestamp
5. restore target used
6. RLS / tenant validation results
7. app-level validation command output
8. follow-up gaps or remediation items

## Related files

- `.github/workflows/reusable-deploy.yml`
- `.github/workflows/99-ops-management-command.yml`
- `docs/GOLDEN_PIPELINE.md`
- `docs/runbooks/INCIDENT_RESPONSE.md`
- `manifests/GOLDEN_FILES.md`
