> [!IMPORTANT]
> ARCHIVED (Historical)
>
> This document is retained for historical context only and is **not canonical**.
> The canonical source of truth for priorities and definitions of done is **/MASTER_PLAN.md**.
> Roadmaps in **/ROADMAP.md** and **/UI_ROADMAP.md** are reference-only unless promoted in MASTER_PLAN.

# V4.0 — Automated Vendor Risk & Compliance Tracking

**Status**: Vision / Architecture Plan (no code)

## Why this matters
Operational risk in food logistics is dominated by “paperwork drift”:
- HACCP/BRC/3rd-party certifications expire
- COIs lapse for carriers
- plants operate without current safety docs

The moat: compliance automation that prevents violations **before** they occur and enforces **hard stops** in execution when legally required.

## Current architecture snapshot (as‑is)
- Tenant models exist for Suppliers/Plants/Carriers
- Carriers already have `insurance_expiry` fields
- Suppliers/Customers have certificate type fields, but no expiration/verification workflow
- Celery is available for watchdog jobs

---

## Proposed schema
> All models tenant-aware + RLS. Make this system append-only where possible.

### `ComplianceDocument`
Represents an uploaded/registered compliance artifact.
- `tenant`
- `id` (uuid)
- `document_type` (enum: HACCP, BRC, SQF, COI, USDA_GRANT, OTHER)
- `status` (enum: pending_review, verified, rejected, expired)
- `issued_on` (date, optional)
- `expires_on` (date, indexed)
- `verified_at` (datetime, optional)
- `verified_by` (user, optional)
- `source_entity_type` + `source_entity_id` (Generic FK)
- `file` (upload) or `external_url`
- `metadata` (json: policy number, insurer, plant_est_num, etc)

### `ComplianceRequirement`
Configures what is required for certain actions.
- tenant
- applies_to (supplier/plant/carrier)
- required_doc_types[]
- enforcement_mode (warn_only / hard_stop)

### `ComplianceViolation`
Append-only record of violations.
- tenant
- entity reference
- violation_type
- discovered_at
- resolved_at
- resolution_notes

---

## Automated watchdog (Celery)
### Behavior
Daily job:
1) find documents expiring in **30/14/7/1 days**
2) create/refresh alerts
3) email tenant admins + show UI notifications

### Task design
- task: `compliance.scan_expirations`
- idempotent: dedupe by (tenant, doc_id, threshold_days)
- emits webhook events:
  - `compliance.document.expiring`
  - `compliance.document.expired`

---

## Hard-stop validation in Workforms engine
### Requirement
A Purchase Order (or workflow execution) **cannot proceed** if:
- associated Plant has expired HACCP/BRC/etc.
- associated Carrier COI is expired

### Enforcement points
1) API validation
- In PO create/execute endpoints, check compliance requirements.

2) Workflow engine gate
- Before executing a Workform node that represents “Execute PO” or “Schedule Pickup”, evaluate compliance.
- If hard-stop triggered:
  - mark execution as blocked
  - write an audit event
  - surface UI error with remediation steps

### UX
- On PO screen:
  - Compliance status badge (Green/Yellow/Red)
  - “View documents” drawer
  - clear blocking message + upload link

---

## API design
- `GET /api/v1/compliance/documents/?entity_type=plant&entity_id=<id>`
- `POST /api/v1/compliance/documents/` (upload)
- `POST /api/v1/compliance/documents/<id>/verify/` (tenant admin only)
- `GET /api/v1/compliance/violations/`
- `GET /api/v1/compliance/requirements/`

---

## Rollout plan
### Phase 1 (warn-only)
- introduce docs + UI
- watchdog warnings

### Phase 2 (hard-stop)
- enable enforcement on selected doc types
- add override flow (superadmin only, audited)

---

## Open questions
- Which doc types are legally required by customer segment?
- Should we support multi-file bundles (COI + endorsements)?
- Do we need external verification integrations (e.g., insurer APIs)?
