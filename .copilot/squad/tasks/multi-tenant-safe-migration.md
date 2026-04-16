# Task: Implement multi-tenant-safe migration (Django + RLS)

## Purpose
Make schema changes without breaking existing tenants and while preserving defense-in-depth isolation.

## Inputs
- Model/table affected
- Desired schema evolution (add field/table/index)

## Outputs
- New migration file(s)
- RLS policy setup for any new tenant-aware table (when applicable)
- Verified migration plan + rollback steps

## Step-by-step execution
1. Confirm constraints:
   - Shared schema ONLY (no django-tenants)
   - Additive-only when possible
2. Create migration:
   - Add new fields with `null=True` or `default=...` where required.
   - Never modify already-applied migrations.
3. If creating a tenant-aware table:
   - Include `RunSQL` to enable RLS + create policy using `current_setting('app.current_tenant')::uuid`.
4. Verify:
   - `cd backend && python manage.py makemigrations`
   - `cd backend && python manage.py makemigrations --check`
   - `cd backend && python manage.py migrate --plan`

## Validation & tests (required)
- `cd backend && python manage.py makemigrations --check`
- `cd backend && python manage.py migrate --plan`

## Risks & rollback
- Risk: downtime or broken deploy if migrations are missing.
- Rollback: `python manage.py migrate <app> <previous>` where safe; otherwise revert PR and redeploy.

## Handoff checklist
- [ ] Migration files committed
- [ ] RLS policy added for new tenant-aware tables
- [ ] Rollback plan documented
