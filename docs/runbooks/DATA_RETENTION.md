# Data Retention & Archive Contract

## Goal

- Define the canonical 7-year archive inventory for high-value transactional records and the first additive archive command.
- Keep retention, legal-hold, and restore expectations tenant-explicit in the shared-schema + RLS architecture.
- Separate business-record retention from infrastructure disaster recovery and from future PII-redaction work.

## What ships in GA-03.1

1. A contract-only retention inventory in `backend/apps/core/services/data_governance.py`.
2. This runbook as the authoritative operator/design reference for record-retention scope.
3. Focused regression coverage that locks the archive targets, exemptions, legal-hold fields, and restore expectations.

## What ships in GA-03.2

1. `python manage.py archive_historical_records` as the dry-run-first operator entrypoint.
2. Additive tenant-aware evidence tables:
   - `ArchiveBatch`
   - `ArchiveRecordSnapshot`
   - `ArchiveLegalHold`
3. Execute mode that writes archive snapshot evidence only. It does **not** purge live rows.
4. Active legal holds enforced before any snapshot is written.

## Non-goals

- No Celery schedule or object-storage configuration yet.
- No destructive data movement or live-row purge in GA-03.2.
- No centralized logging/Sentry redaction implementation yet; that belongs to GA-03.3.
- No attempt to reuse soft-delete restore endpoints as archive restore.

## Archive inventory (7-year retained classes)

| Archive class | Models | Why retained |
| --- | --- | --- |
| Transactional headers | `PurchaseOrder`, `CarrierPurchaseOrder`, `SalesOrder`, `Invoice`, `Fulfillment` | Preserve the commercial and logistics chain of custody. |
| Transactional line items | `PurchaseOrderItem`, `CarrierPOItem`, `SalesOrderItem`, `InvoiceItem`, `FulfillmentProduct` | Preserve auditable quantities, pricing, and shipped-product evidence. |
| Settlement and dispute records | `PaymentTransaction`, `Claim` | Preserve proof of payment movement and dispute resolution. |
| Storage/inventory execution records | `ColdStorageEntry` | Preserve physical inventory custody evidence tied to retained transactions. |

All archive-eligible records in GA-03.1 are retained for **7 years** and require a legal-hold check before any future automation may move them.

## Explicit exemptions in GA-03.1

These records are intentionally out of scope for the first archive contract:

1. **Tenant master data** (`Customer`, `Supplier`, `Carrier`, `Contact`, `Plant`, `Location`)
   - archived transactions still reference live business relationships
   - archival behavior for master data is deferred until a richer restoration strategy exists
2. **Workflow definitions and execution telemetry**
   - operational retention needs a different policy from the financial 7-year window
   - deferred to the GA-03.4 governance/evidence lane
3. **AI documents, communications, and observability payloads**
   - they need centralized redaction rules first
   - deferred to GA-03.3
4. **Soft-deleted rows**
   - soft-delete restore is not archive restore
   - do not treat existing `/restore/` endpoints as archive recovery

## Legal-hold contract

GA-03.2 now ships `ArchiveLegalHold`, and archive execution honors this minimum shape:

- `tenant_id`
- `scope_model`
- `scope_selector`
- `reason_code`
- `placed_by`
- `placed_at`
- `released_by`
- `released_at`

Archive execution must skip any record or batch selected by an active legal hold and record that skip in operator evidence.

## Restore expectations

Business-record archive restore is distinct from `docs/runbooks/DISASTER_RECOVERY.md`:

- **Disaster recovery** restores databases or environments after infra incidents.
- **Archive restore** rehydrates retained business records for a specific tenant/audit/dispute need.

GA-03.1 sets the following restore contract for later tickets:

1. restore is **operator-only**
2. restore is **tenant-explicit**
3. restore is **batch-based**, using archive manifests/evidence rather than ad-hoc row edits
4. restore must preserve tenant/RLS boundaries throughout the rehydration flow
5. restore implementation is deferred beyond GA-03.2

## Operator evidence requirements

Every future archive or restore action must produce evidence containing:

- `tenant_id`
- `archive_batch_id`
- `retention_cutoff_date`
- `model_label`
- `record_count`
- `legal_hold_skips`
- `requested_by`
- `approved_by`
- `restored_by`
- `restored_at`

## Delivery boundaries across GA governance tickets

| Ticket | Scope |
| --- | --- |
| `GA-03.1` | define inventory, exemptions, legal-hold fields, restore expectations |
| `GA-03.2` | implement dry-run-first archive command, RLS-backed evidence tables, and legal-hold enforcement |
| `GA-03.3` | centralize PII redaction for logging, Celery, and Sentry |
| `GA-03.4` | formalize schedules, evidence operations, and workflow/telemetry governance |

## Relationship to other canonical sources

- `MASTER_PLAN.md` remains the canonical execution/status document.
- `.github/EPIC_TICKETS.md` remains the ordered execution backlog.
- `docs/runbooks/DISASTER_RECOVERY.md` remains the source of truth for infra/database recovery.
- `manifests/GOLDEN_FILES.md` must register this runbook as an authoritative retention source.
