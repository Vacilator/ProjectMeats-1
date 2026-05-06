# Settlement Reconciliation Runbook

**Status:** B2B-03.1 contract and webhook-first adapter plan only  
**Contract version:** `b2b-03.1.v1`

This runbook defines the canonical **settlement ingestion and reconciliation contract** for ProjectMeats. It is a
planning/contract artifact only. It does **not** add public ingest endpoints, settlement source models, or
execute-mode auto-reconciliation in this ticket.

## Scope and current constraints

- `tenant_apps.invoices.models.PaymentTransaction` already exists and is the only shipped posted-payment ledger. Future
  settlement work must reconcile into that model instead of inventing a second payment ledger.
- `tenant_apps.integrations` already owns tenant-scoped API keys, webhook secrets, and signed delivery behavior, but it
  does **not** yet expose an inbound settlement endpoint or raw settlement event journal.
- The first implementation target is a **webhook-first adapter** because providers can push signed payment/settlement
  events immediately, while direct bank-feed coupling introduces longer credential, polling, and normalization work.
- This ticket freezes the contract and enforcement surfaces for downstream work. It does not ship live settlement
  ingestion.

## Canonical invariants

### 1. Ledger ownership

1. **Canonical posted-payment ledger:** `tenant_apps.invoices.models.PaymentTransaction`.
2. **No duplicate ledger model:** downstream settlement work must create a raw-event journal first and only create or
   update `PaymentTransaction` records after tenant resolution, idempotency checks, and reconciliation rules pass.
3. **Supported posting targets:** a settlement may post to exactly one of `invoice`, `sales_order`, or `purchase_order`
   on `PaymentTransaction`, reusing the existing polymorphic payment model.

### 2. Raw-event journal contract

Every future settlement ingest record must preserve the original provider payload before matching or posting. The raw
event journal must carry at least:

1. `tenant_id`
2. `provider_code`
3. `external_event_id`
4. `provider_account_reference`
5. `event_type`
6. `direction`
7. `occurred_at`
8. `amount`
9. `currency`
10. `raw_payload`
11. `raw_payload_sha256`
12. `received_at`

`raw_payload_sha256` must be the lowercase SHA-256 hex digest of the exact UTF-8 encoded `raw_payload` string stored in
the journal row. If the payload is JSON, hash the stored raw string exactly as received/persisted; do not re-serialize,
reorder keys, or normalize whitespace before hashing.

Required lifecycle states for the raw journal:

1. `received`
2. `validated`
3. `duplicate`
4. `ready_to_post`
5. `posted`
6. `ignored`
7. `failed`

### 3. Idempotency contract

1. **Primary idempotency key:** `tenant_id + provider_code + external_event_id`.
2. **Fallback idempotency digest:** if the provider lacks a stable event id, use a deterministic digest over
   `tenant_id + provider_code + provider_account_reference + occurred_at + amount + direction + raw_payload_sha256`.
3. **Replay rule:** duplicate raw events may update audit metadata, but they must not create duplicate
   `PaymentTransaction` rows or post twice against the same business record.
4. **Tenant boundary:** idempotency is tenant-scoped; the same upstream event id in different tenants must not collide.

### 4. Webhook-first adapter contract

1. **Initial ingest mode:** `webhook`.
2. **Accepted auth patterns for the first adapter:** tenant-issued API keys and provider/HMAC signature verification.
3. **Reuse existing integration ownership:** downstream settlement ingress belongs in `tenant_apps.integrations` and
   must mirror the repo's existing secret, signature, and retry patterns instead of creating a second integration
   subsystem.
4. **Deferred adapters:** direct bank-feed polling/coupling and file-based importers are follow-on integrations after
   the raw journal and webhook path exist.

### 5. Explicit prohibitions

1. **No raw event -> `PaymentTransaction` direct write** without a durable journal row and idempotency check.
2. **No cross-tenant matching** based on shared references or provider account ids.
3. **No bank-feed-first MVP** for `B2B-03.1`; the contract intentionally starts from webhook push semantics.

## Why webhook-first wins the MVP

- Webhooks let providers push payment/settlement events with a stable event id, which makes replay detection easier
  than bank polling or file drops.
- Webhooks align with the repo's existing integrations primitives: API keys, opaque secrets, and HMAC-style verification
  patterns already exist in `tenant_apps.integrations`.
- Bank-feed coupling would force this ticket to solve provider-specific credential storage, polling schedules,
  normalization variance, and partial-history backfill before the raw journal contract is even frozen.
- A webhook-first path keeps `B2B-03.2` focused on auditable ingress and event journaling, while later tickets can add
  bank adapters that normalize into the same contract.

## Canonical source files

| Concern | Source |
| --- | --- |
| Settlement contract | `docs/runbooks/SETTLEMENT_RECONCILIATION.md` |
| Backend contract seam | `backend/tenant_apps/integrations/settlement_contract.py` |
| Tenant integration ownership | `backend/tenant_apps/integrations/models.py`, `backend/tenant_apps/integrations/tasks.py` |
| Canonical payment ledger | `backend/tenant_apps/invoices/models.py` |
| Execution status | `MASTER_PLAN.md`, `.github/EPIC_TICKETS.md`, `.github/MASTER_PLAN.md` |

## First implementation files for follow-up tickets

1. `backend/tenant_apps/integrations/settlement_contract.py` - frozen names/constants for downstream settlement work.
2. `backend/tenant_apps/integrations/{models.py,serializers.py,views.py,urls.py}` - raw journal model and authenticated
   ingest endpoint in `B2B-03.2`.
3. `backend/tenant_apps/invoices/models.py` - continues as the canonical posted-payment ledger; no new settlement ledger
   model should be introduced.
4. `backend/tenant_apps/integrations/tests.py` - contract guardrails for adapter, auth, and idempotency invariants.

## Non-goals for B2B-03.1

- No public or provider-facing ingest endpoint yet.
- No settlement source/event journal model or migration yet.
- No auto-match or execute-mode reconciliation yet.
- No direct bank-feed adapter yet.

## Validation

```bash
bash scripts/verify_golden_state.sh
cd backend && python manage.py test tenant_apps.invoices tenant_apps.integrations
```

## Rollback

- Revert the runbook, settlement contract module, tests, and golden-file enforcement together.
- Do not leave behind a partial ingest endpoint or bank-feed adapter from this ticket.
