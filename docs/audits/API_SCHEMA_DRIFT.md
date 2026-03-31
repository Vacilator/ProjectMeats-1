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

