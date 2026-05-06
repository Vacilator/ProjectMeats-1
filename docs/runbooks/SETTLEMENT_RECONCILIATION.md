# Settlement Reconciliation Runbook

**Status:** B2B-03.1 through B2B-03.5 contract with webhook ingest, raw journal, deterministic exact-match posting,
and accountant review queue overrides plus provider-managed Stripe Treasury normalization
**Contract version:** `b2b-03.5.v1`

This runbook defines the canonical **settlement ingestion and reconciliation contract** for ProjectMeats. It now covers
the shipped webhook-first ingest path, the raw settlement event journal, deterministic reconciliation that posts exact
matches into `PaymentTransaction`, the accountant review queue used to manually post or reject non-exact cases, and a
provider-managed Stripe Treasury adapter that normalizes upstream webhook payloads into the same contract.

## Scope and current constraints

- `tenant_apps.invoices.models.PaymentTransaction` already exists and is the only shipped posted-payment ledger. Future
  settlement work must reconcile into that model instead of inventing a second payment ledger.
- `tenant_apps.integrations` now owns the tenant-scoped settlement source registry, the public tenant-path settlement
  ingest endpoint, the replay-safe raw event journal, and the async reconciliation task handoff.
- The implementation remains **webhook-first** because providers can push signed payment/settlement events immediately,
  while direct bank-feed coupling introduces longer credential, polling, and normalization work.
- Current execute-mode reconciliation is intentionally strict: only deterministic exact matches auto-post; ambiguous or
  incomplete cases remain reviewable instead of guessing.

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

### 5. Deterministic reconciliation contract

1. **Canonical auto-post ledger target:** `PaymentTransaction` remains the only posted-payment record.
2. **Current exact-match targets:** `invoice`, `sales_order`, and `purchase_order`.
3. **Current exact-match locator families:** downstream providers must supply one of the canonical business references
   already used in ProjectMeats records, specifically invoice number, sales order number, or purchase order number
   (including the existing legacy alias fields mirrored in the models).
4. **One event, at most one posted payment:** a single settlement event may link to zero or one `PaymentTransaction`;
   replays must reuse the same linkage instead of creating a second posted payment row.
5. **No fuzzy auto-posting:** if multiple candidates match, no candidates match, the outstanding amount differs, or the
   direction is unsupported, the event must remain non-posting and carry an explicit machine-readable reason code.
6. **Current review reason codes:** `missing_reference`, `reference_not_found`, `amount_mismatch`,
    `ambiguous_match`, and `unsupported_direction`.
7. **Current exact-match posting reason codes:** `exact_invoice_match`, `exact_sales_order_match`,
    `exact_purchase_order_match`.
8. **Current manual review outcomes:** tenant admins may relink a queued event to an `invoice`, `sales_order`, or
   `purchase_order`, producing `manual_invoice_override`, `manual_sales_order_override`, or
   `manual_purchase_order_override`; they may also reject a queued event with `accountant_rejected`.
9. **Current review audit fields:** `reviewed_by`, `reviewed_at`, and `review_note` on `SettlementEvent`.
10. **Current provider-managed adapter:** `stripe_treasury` may authenticate with the manifest-defined
    `STRIPE_SETTLEMENT_WEBHOOK_SECRET` and must still write the exact upstream body to `raw_payload` while projecting a
    canonical JSON object into `normalized_payload`.

### 6. Explicit prohibitions

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

## Current implementation files

1. `backend/tenant_apps/integrations/settlement_contract.py` - frozen names/constants for downstream settlement work.
2. `backend/tenant_apps/integrations/{models.py,serializers.py,views.py,urls.py}` - settlement source/event journal and
   authenticated ingest endpoint.
3. `backend/tenant_apps/integrations/reconciliation.py` - deterministic exact-match reconciliation service plus
   accountant override/reject helpers.
4. `backend/tenant_apps/integrations/tasks.py` - async validation plus reconciliation execution entrypoint.
5. `backend/tenant_apps/integrations/migrations/0002_*.py` and `0003_*.py` - additive journal schema and reconciliation
   linkage fields, plus `0004_*.py` for review audit metadata.
6. `backend/tenant_apps/invoices/models.py` - continues as the canonical posted-payment ledger; no new settlement ledger
   model should be introduced.
7. `backend/tenant_apps/integrations/tests.py` - contract guardrails for adapter, auth, replay, and exact-vs-review
   outcomes.
8. `frontend/src/services/settlementEventsService.ts` and `frontend/src/pages/Accounting/SettlementQueue.tsx` -
   accountant review queue UI and service layer.
9. `backend/tenant_apps/integrations/providers/stripe_treasury.py` - provider signature verification and canonical
   normalization for `stripe_treasury`.

## Current non-goals

- No fuzzy matching by amount/date/customer-only heuristics.
- No polling/cursor-based bank-feed adapter yet.
- No tenant-stored provider secret bypass for Stripe Treasury; the webhook secret must stay manifest-defined.

## Validation

```bash
bash scripts/verify_golden_state.sh
cd backend && python manage.py test tenant_apps.invoices tenant_apps.integrations
```

## Rollback

- Revert the runbook, settlement contract module, tests, and golden-file enforcement together.
- Do not leave behind a partial ingest endpoint or bank-feed adapter from this ticket.
