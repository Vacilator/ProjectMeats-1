# Task: Add backend endpoint (Django + DRF, tenant-safe)

## Purpose
Add a new API endpoint in the backend that is **tenant-isolated**, permissioned, and aligned with ProjectMeats architecture.

## Inputs
- Endpoint intent (resource, CRUD vs custom action)
- Expected request/response payload shape
- Tenant context expectations (always tenant-scoped)

## Outputs
- DRF ViewSet / APIView + Serializer(s)
- Router/urls wiring under `/api/v1/`
- Tests proving tenant isolation + permissions
- If model changes: safe migrations + RLS policy where required

## Step-by-step execution
0. **Relay → synthesize (Lead Engineer)**
   - After fleet agents complete, run a Lead Engineer synthesis pass to unify findings into one patch plan.
1. **Confirm canonical constraints**
   - Read: `docs/architecture/ARCHITECTURE.md`
   - Read: `.github/instructions/backend.instructions.md`
2. **Model & multi-tenancy**
   - In `backend/tenant_apps/**`, ensure models inherit `TenantAwareModel`.
   - Never manually re-implement tenant managers/fields.
3. **Serializer**
   - Use `ModelSerializer` with explicit `fields`.
   - Validate input; never trust client payload.
4. **ViewSet**
   - Add `permission_classes`.
   - Override `get_queryset()` and filter by `tenant=request.tenant`.
   - Override `perform_create()` and set `tenant=request.tenant`.
5. **Routing**
   - Ensure it is under `/api/v1/`.
   - Avoid breaking existing endpoints; add aliases instead of removals.
6. **Tests**
   - Add APITestCase(s):
     - same user, different tenants → cannot access cross-tenant records
     - permissions enforced
7. **Validation**
   - Run:
     - `cd backend && python manage.py makemigrations --check`
     - `cd backend && python manage.py test`

## Validation & tests (required)
- `cd backend && python manage.py makemigrations --check`
- `cd backend && python manage.py test`

## Risks & rollback
- Risk: cross-tenant data leak if `get_queryset()` is not filtered.
- Rollback: revert PR; migrations should be additive-only when possible.

## Handoff checklist
- [ ] Tenant isolation verified in code and tests
- [ ] Permissions defined and tested
- [ ] Endpoint documented (route + payload)
