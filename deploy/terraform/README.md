# ProjectMeats Infrastructure Desired-State Scaffold

**Status:** GA-02.1 scaffold + GA-02.3 async envelope contract  
**Purpose:** capture the current launch-critical deployment topology and Celery worker envelope as code structure without changing live infrastructure

This directory is the Terraform-backed **desired-state contract** for ProjectMeats infrastructure. It does **not** provision or mutate any environments yet. Its job is to make the current runtime topology explicit, show what is still manual, and codify the current Celery queue ownership / worker envelope so follow-on GA work can add runtime automation without guesswork.

## Current runtime reality

The live deployment control plane remains GitHub Actions:

- `.github/workflows/main-pipeline.yml`
- `.github/workflows/reusable-deploy.yml`

Those workflows are the current source of truth for:

- runner-driven database migrations over the bastion tunnel
- immutable image deployment using environment-specific SHA tags and optional digests
- host-level nginx proxy rendering and reload
- backend/frontend container deployment and post-deploy smoke gates

Key host paths already used in production workflows:

- Backend runtime env file: `/root/projectmeats/backend/.env`
- Frontend runtime config: `/opt/pm/frontend/env/env-config.js`
- Backup retention directory: `/root/projectmeats/db_backups/<environment>/`
- Host nginx site: `/etc/nginx/sites-available/projectmeats-<environment>`

## Desired topology contract

This scaffold models three application environments:

| Environment | Git branch | Backend lane | Frontend lane | Public domain |
| --- | --- | --- | --- | --- |
| `development` | `development` | `dev-backend` | `dev-frontend` | `dev.meatscentral.com` |
| `uat` | `uat` | `uat-backend` | `uat-frontend` | `uat.meatscentral.com` |
| `production` | `main` | `production-backend` | `production-frontend` | `meatscentral.com` |

Each environment currently assumes:

- one primary host running host-level nginx plus Docker containers
- backend published on host port `0.0.0.0:8000` by the current workflow
- frontend bound to `127.0.0.1:8080`
- runner-managed migrations using `python manage.py migrate --fake-initial --noinput`
- local backup retention on the host under `/root/projectmeats/db_backups/<environment>/`

## GA-02.3 async worker contract

Queue ownership is now explicit in Django settings and mirrored here as desired-state data:

| Queue | Primary workloads | Saturation guardrail |
| --- | --- | --- |
| `pm.ops` | Beat fan-out, lightweight maintenance, future low-risk operational work | shared with realtime worker; watch for noisy-neighbor spillover |
| `pm.email` | Inbox sync, invitation email, outbound tenant webhooks | warn `>50`, critical `>100`, or oldest task `>10m` |
| `pm.workforms` | WorkForm execution, workflow actions, workflow-trigger fan-out | warn `>20`, critical `>50`, or oldest task `>5m` |
| `pm.ai` | AI suggestions, RLHF compilation, watchdog jobs | warn `>5`, critical `>10`, or oldest task `>15m` |
| `pm.etl` | Reserved for controlled ETL/import windows only | any backlog outside an active ETL window is abnormal |

Worker envelopes remain a documented contract in this scaffold:

| Worker | Queues | Envelope | Notes |
| --- | --- | --- | --- |
| `pm-worker-realtime` | `pm.email`, `pm.ops` | `--autoscale=4,1` | absorbs email/webhook/ops fan-out without starving interactive flows |
| `pm-worker-workforms` | `pm.workforms` | `--autoscale=4,2` | keeps execution latency bounded for tenant-facing workflow traffic |
| `pm-worker-ai` | `pm.ai` | `--autoscale=2,1` | constrains expensive AI work so it cannot overrun realtime queues |
| `pm-worker-etl` | `pm.etl` | `--concurrency=1` | only started during controlled import windows |
| `pm-celery-beat` | `pm.ops`, `pm.ai` | single beat process | dispatches scheduled ops and AI jobs into explicit queues |

## Manual vs. codified ownership

| Concern | Current reality | Ownership in this scaffold |
| --- | --- | --- |
| Droplet / host inventory | Manual knowledge + workflow secrets | Documented only |
| Host nginx runtime shape | Workflow-rendered and mirrored by `deploy/nginx/host-reverse-proxy.conf.template` | Documented only |
| Backend/frontend container contract | Fully codified in `.github/workflows/reusable-deploy.yml` | Referenced |
| Backend bind address | Currently `0.0.0.0:8000` in the workflow and visible here as a known seam | Documented only |
| Runtime file locations | Codified in workflow shell steps | Referenced |
| Backup directory convention | Codified in workflow shell steps | Referenced |
| PITR / restore procedure | Codified in `docs/runbooks/DISASTER_RECOVERY.md` and backup verification hooks | Referenced |
| Redis/Valkey queue topology | Explicit queue names / saturation thresholds are codified in Django settings + this scaffold | Referenced |
| Worker autoscaling envelope | Codified as desired-state only; live worker rollout is still manual | Documented only |
| Alerting / telemetry routing | Partially implicit via env + Sentry | Deferred to later GA-02 follow-ups |

## What ships in GA-02.1 + GA-02.3

1. Terraform files that validate locally and describe the desired topology.
2. An explicit environment map for domains, branches, lanes, host ports, and runtime paths.
3. A queue / worker envelope contract for Celery workloads, including autoscale bounds and queue saturation thresholds.
4. A no-surprises contract showing what is still manual versus already codified elsewhere in the repo.
5. Golden-state enforcement so this scaffold and its registry entry cannot drift out of the repository unnoticed.

## Explicit non-goals

GA-02.1 does **not**:

- provision cloud resources
- modify GitHub environments or secret names
- automate remote worker container rollout
- add queue-depth alarms or broker autoscaling
- replace the Golden Pipeline deployment workflows

## Follow-on tickets

- **GA-02.4**: codify Redis eviction policy, queue-health alarms, and broker distress handling

## Validation

```bash
bash scripts/verify_golden_state.sh
bash .github/scripts/check_infrastructure.sh
terraform -chdir=deploy/terraform fmt -check
terraform -chdir=deploy/terraform init -backend=false
terraform -chdir=deploy/terraform validate
```

## Rollback

If this scaffold is inaccurate, revert the GA-02.1 PR. No live infrastructure changes are introduced by this directory.
