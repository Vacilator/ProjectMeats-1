# PIPELINE_SHARDING_COMPLETE

## Deliverables

- Split PR validation so `OpenAPI Artifact` and `Validate Migrations` run independently, while backend tests/smoke no longer wait on schema artifact generation.
- Sharded the Playwright production-preview smoke across 3 concurrent runners in `.github/workflows/pr-validation.yml`.
- Kept mobile OpenAPI consumers wired to the schema artifact by moving their dependency to `openapi-artifact`.
- Shortened the deploy critical path in `.github/workflows/reusable-deploy.yml` by:
  - removing frontend/security-scan gating from the `migrate` job,
  - moving `collectstatic`, `setup_superuser`, and `seed_system_products` into a separate `bootstrap-backend` job,
  - removing the duplicate frontend nginx reload step.
- Hardened the shared pytest tenant harness in `backend/conftest.py` so the default authenticated client now carries both tenant membership and `X-Tenant-ID`.
- Added `backend/tests/integration/test_tenant_fixture_defaults.py` to lock that fixture behavior in place.
- Cleaned the scoped admin-studio warning debt in:
  - `frontend/src/apps/admin-studio/pages/Editor.tsx`
  - `frontend/src/apps/admin-studio/components/SchemaEditor.tsx`
  - `frontend/src/apps/admin-studio/components/VersionHistory.tsx`
- Updated `docs/guides/BRANCH_PROTECTION_SETUP.md` so branch-protection status checks match the new PR workflow graph.

## Expected Results

- Backend and frontend validation start sooner and overlap more in PRs.
- The Playwright smoke no longer bottlenecks on a single runner.
- Development deploys reach the migration/deploy stages sooner because the migration lane no longer waits on frontend/security scan completion.
- Backend pytest consumers stop failing from missing tenant context defaults.

## Acceptance Criteria

- PR validation exposes a distinct `OpenAPI Artifact` job and keeps `Validate Migrations` separate.
- `Frontend Prod Smoke` runs as 3 shards.
- `mobile-checks` downloads the schema artifact from `openapi-artifact`.
- `bootstrap-backend` owns `collectstatic`, `setup_superuser`, and `seed_system_products`, while `migrate` only handles the tunnel, DB checks, backup, and migrations.
- The shared authenticated pytest client always authenticates a tenant member and sets `HTTP_X_TENANT_ID`.
- The admin-studio files changed in this batch no longer emit the specific stale dependency / unused symbol warnings targeted by the audit.

## Dependencies

- Golden Pipeline validator contracts in `.github/scripts/check_infrastructure.sh`
- Existing PR validation job labels documented in `docs/guides/BRANCH_PROTECTION_SETUP.md`
- Root frontend `node_modules` reused temporarily during validation in this worktree

## Risk Register

- **Workflow graph drift** — medium likelihood / high impact. Mitigation: kept rerunning `.github/scripts/check_infrastructure.sh` until the graph matched validator expectations.
- **Bootstrap relocation breaks deploy assumptions** — medium likelihood / medium impact. Mitigation: preserved the exact `collectstatic --noinput --clear`, `setup_superuser`, and `seed_system_products` commands, only moving them off the migration critical path.
- **Pytest harness change surprises tests that expected a non-tenant client** — low likelihood / medium impact. Mitigation: kept `api_client` unchanged and only hardened the authenticated shared fixture.

## Testing Strategy

- `cd backend && pytest tests/integration/test_tenant_fixture_defaults.py -q`
- `cd backend && python manage.py test tenant_apps.workflows.tests.test_webhook_receiver_tenant_path apps.core.tests.test_throttling --noinput`
- `cd backend && python manage.py makemigrations --check`
- `bash .github/scripts/check_infrastructure.sh`
- `cd frontend && npm run verify-standards && npm run type-check`

## Rollback

1. Revert the PR branch to restore the previous workflow graph and tenant fixture behavior.
2. Re-run PR validation to confirm the legacy single-lane graph is back.
3. If deploy timing regresses or bootstrap ordering causes issues, move `collectstatic` / bootstrap commands back into `migrate` using the previous `reusable-deploy.yml` structure.
