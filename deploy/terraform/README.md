# ProjectMeats Infrastructure Desired-State Scaffold

**Status:** GA-02.1 scaffold only  
**Purpose:** capture the current launch-critical deployment topology as code structure without changing live infrastructure

This directory is the first Terraform-backed **desired-state contract** for ProjectMeats infrastructure. It does **not** provision or mutate any environments yet. Its job is to make the current runtime topology explicit, show what is still manual, and create a safe starting point for follow-on work in GA-02.2 (PITR / restore drills) and GA-02.3 (Celery worker scaling envelopes).

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

## Manual vs. codified ownership

| Concern | Current reality | Ownership in this scaffold |
| --- | --- | --- |
| Droplet / host inventory | Manual knowledge + workflow secrets | Documented only |
| Host nginx runtime shape | Workflow-rendered and mirrored by `deploy/nginx/host-reverse-proxy.conf.template` | Documented only |
| Backend/frontend container contract | Fully codified in `.github/workflows/reusable-deploy.yml` | Referenced |
| Backend bind address | Currently `0.0.0.0:8000` in the workflow and visible here as a known seam | Documented only |
| Runtime file locations | Codified in workflow shell steps | Referenced |
| Backup directory convention | Codified in workflow shell steps | Referenced |
| PITR / restore procedure | Not yet codified | Deferred to GA-02.2 |
| Redis/Valkey queue topology | Partially implicit | Deferred to GA-02.3 |
| Worker autoscaling envelope | Not codified | Deferred to GA-02.3 |
| Alerting / telemetry routing | Partially implicit via env + Sentry | Deferred to later GA-02 follow-ups |

## What ships in GA-02.1

1. Terraform files that validate locally and describe the desired topology.
2. An explicit environment map for domains, branches, lanes, host ports, and runtime paths.
3. A no-surprises contract showing what is still manual versus already codified elsewhere in the repo.
4. Golden-state enforcement so this scaffold and its registry entry cannot drift out of the repository unnoticed.

## Explicit non-goals

GA-02.1 does **not**:

- provision cloud resources
- modify GitHub environments or secret names
- introduce restore drills or PITR automation
- change Celery concurrency or worker autoscaling
- replace the Golden Pipeline deployment workflows

## Follow-on tickets

- **GA-02.2**: add PITR verification, restore-drill procedure, and backup validation
- **GA-02.3**: codify worker scaling envelopes, queue priorities, and Redis/Valkey runtime expectations

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
