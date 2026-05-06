# B2B Extranet Portal Contract

**Status:** B2B-01.1 contract and document-source inventory only  
**Contract version:** `b2b-01.1.v1`

This runbook defines the canonical contract for the future ProjectMeats B2B extranet portal. It is a planning/contract artifact only. It does **not** add public endpoints, guest routes, or counterpart-facing UI in this ticket.

## Scope and current constraints

- The `B2B-02` trade engine rollout is complete, so weights/dates now have a canonical backend/frontend contract before external access is designed.
- ProjectMeats already has a **legacy demo guest mode** via `/api/v1/auth/guest-login/`, documented in `docs/features/GUEST_MODE.md`.
- That demo guest mode provisions an internal trial tenant with broad CRUD access and must **not** be reused for counterpart access.
- Existing internal APIs remain authenticated, tenant-aware, and staff/user scoped. This ticket does not weaken those requirements.

## Canonical invariants

### 1. Portal identity and auth model

1. **No internal-auth reuse:** the B2B extranet must not reuse `/api/v1/auth/guest-login/`, username/password login, JWT token bootstrap, or any internal staff/user session flow.
2. **Portal access is signed-grant only:** counterpart access must use opaque, revocable, time-bound grants scoped to a single tenant and a narrow set of records/documents.
3. **Tenant-explicit access:** every future portal request must resolve tenant scope from the signed grant itself, not from ambient browser state or anonymous `X-Tenant-ID` headers.
4. **Read-only by default:** B2B portal users may read approved partner-safe data only; no write surface is implied by this contract.

### 2. Allowed document and record scope

Only the following categories are eligible for future portal exposure, and only through guest-safe serializers/view models:

1. `invoice_summary`
2. `invoice_pdf`
3. `sales_order_status`
4. `purchase_order_status`
5. `fulfillment_tracking`
6. `fulfillment_bol`
7. `fulfillment_pod`

### 3. Explicit prohibitions

1. **No direct `AIDocument` exposure** in portal payloads or links.
2. **No internal route reuse** (`/workspace`, `/records/*`, internal React record pages, or admin URLs).
3. **No demo guest tenant bridging** from `guest-login`, `create_guest_tenant`, or the internal guest-mode tenant.
4. **No anonymous global lookup** by invoice/order number without a signed grant bound to one tenant and one counterpart subject.

### 4. Signed-grant lifecycle

Every future portal grant must carry or derive these fields:

1. `tenant_id`
2. `grant_id`
3. `subject_email`
4. `resource_scope`
5. `document_sources`
6. `expires_at`
7. `revoked_at`
8. `created_by`

Lifecycle requirements:

- Grants must be opaque random secrets at issuance time and stored only as hashes at rest.
- Expiry and revocation must be checked before every portal read.
- Portal access must emit audit evidence tied to the tenant, grant, and source record/document.

## Canonical source files

| Concern | Source |
| --- | --- |
| Portal contract | `docs/runbooks/B2B_EXTRANET_PORTAL.md` |
| Security constants and future grant helper seam | `backend/apps/core/security.py` |
| Legacy demo guest mode (forbidden for portal reuse) | `docs/features/GUEST_MODE.md`, `backend/apps/core/views.py`, `backend/apps/core/urls.py` |
| Tenant/public routing boundary | `backend/projectmeats/urls.py`, `backend/apps/core/urls.py` |
| Execution status | `MASTER_PLAN.md`, `.github/EPIC_TICKETS.md`, `.github/MASTER_PLAN.md` |

## First implementation files to create in follow-up tickets

### Backend

1. `backend/apps/core/security.py` — signed-grant issuance/verification helpers
2. `backend/apps/core/urls.py` — dedicated portal auth/bootstrap namespace (not the legacy guest-login path)
3. `backend/projectmeats/urls.py` — portal route include once public endpoints actually exist
4. `backend/tenant_apps/invoices/serializers.py` — guest-safe invoice summary/detail serializers
5. `backend/tenant_apps/fulfillments/serializers.py` — guest-safe tracking/delivery serializers
6. `backend/apps/core/tests/test_b2b_portal_contract.py` — contract guardrails

### Frontend

1. `frontend/src/pages/Portal/*` — dedicated counterpart routes
2. `frontend/src/services/portalApi.ts` — portal-specific service layer
3. `frontend/src/routes/*` — portal-only route tree with no internal-app shell reuse

## Non-goals for B2B-01.1

- No public endpoints or portal React pages yet.
- No signed-grant database model yet.
- No document download implementation yet.
- No partner email/send flow yet.

## Validation

```bash
bash scripts/verify_golden_state.sh
cd backend && python manage.py test apps.tenants apps.core tenant_apps.invoices tenant_apps.fulfillments
```

## Rollback

- Revert the runbook, security constants, validator, and contract tests together.
- Do not introduce or leave behind public portal routes from this ticket.
