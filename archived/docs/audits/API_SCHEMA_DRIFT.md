# API_SCHEMA_DRIFT (Type Safety Alignment Audit)

**Generated**: 2026-03-31

Goal: Reduce 400 Bad Request and runtime payload mismatches by aligning backend schemas (drf-spectacular + Django choices) with frontend TypeScript types.

---

## 1) drf-spectacular configuration (backend)

Evidence:
- `backend/projectmeats/settings/base.py` includes `drf_spectacular`
- DRF `DEFAULT_SCHEMA_CLASS` set to `drf_spectacular.openapi.AutoSchema`
- `SPECTACULAR_SETTINGS` present (API metadata configured)

**Recommendation:**
- Ensure the OpenAPI schema is generated in CI and used to generate TypeScript client/types (or at least compared for drift).

---

## 2) High-signal drift: documents upload type mismatch

Backend:
- `tenant_apps.ai_assistant.serializers.AIDocumentSerializer` returns fields including:
  - `content_type`
  - `file_size`
  - `processing_status`
  - `original_filename`

Frontend type:
- `frontend/src/types/index.ts:UploadedDocument` includes:
  - `file_type`
  - `document_type`
  - `extracted_text`, `extracted_data`

**Risk:**
- UI may assume fields that backend doesn’t return (or names differ), causing undefined access and incomplete UX.

**Recommendation:**
- Either:
  1) Update frontend type(s) to match backend serializer exactly (preferred), or
  2) Extend backend serializer to include compatible aliases (e.g., `file_type` mirroring `content_type`) in an additive manner.

---

## 3) Choices alignment (backend TextChoices/IntegerChoices)

Backend contains many `models.TextChoices` (examples):
- `apps.core.models.WeightUnitChoices`
- `tenant_apps.workflows.models.FormSubmissionStatus`, `StepSubmissionStatus`
- `apps.system.models.tenant_workform.WorkFormStatusChoices`

Frontend contains many string unions (various files under `frontend/src/types/`).

**Risk:**
- Status strings or enum values drift (case/underscore) → 400s on POST/PATCH or silent UI breakage.

**Recommendation:**
- Generate TS enums/unions from OpenAPI schema.
- Add a small “schema drift” unit test comparing:
  - backend choices → schema → generated types
  - frontend unions used in forms/mutations

---

## 4) Suggested enforcement

- Prefer `unknown` at API boundary → parse into typed objects.
- Add zod/type-guards for high-churn payloads:
  - Workflows
  - Forms/submissions
  - Quick Actions
  - Documents



---

## Reconnaissance Update — 2026-03-31T19:15:05Z

### drf-spectacular config evidence
- `backend/projectmeats/urls.py`
- `backend/projectmeats/settings/base.py`


### High-signal mismatch search: 'lbs'
- Frontend files mentioning `lbs`: **7** (showing up to 10)
- `frontend/src/workforms/templates/Meatscentral-Inquiry-Flow-Template.ts`
- `frontend/src/pages/Processes.tsx`
- `frontend/src/pages/PurchaseOrders.tsx`
- `frontend/src/components/Inquiry/InquiryCreateModal.tsx`
- `frontend/src/components/Inquiry/InquiryTemplateModal.tsx`
- `frontend/src/components/FormSubmission/FormSubmissionModal.tsx`
- `frontend/src/components/FlowEditor/nodes/SmartWorkFormNode.tsx`

- Backend files mentioning `lbs`: **14** (showing up to 10)
- `backend/apps/core/models.py`
- `backend/apps/system/management/commands/seed_system_choices.py`
- `backend/apps/tenants/utils/test_data_seeder.py`
- `backend/apps/core/management/commands/seed_logistics_data.py`
- `backend/apps/core/management/commands/seed_all_modules.py`
- `backend/tenant_apps/inquiries/models.py`
- `backend/tenant_apps/inquiries/views.py`
- `backend/tenant_apps/purchase_orders/models.py`
- `backend/tenant_apps/purchase_orders/tests.py`
- `backend/tenant_apps/invoices/models.py`
- … +4 more


### Recommendation
- Treat choice values as **API-contract**, not UI strings. Generate TS enums/unions from OpenAPI and map UI labels separately.
