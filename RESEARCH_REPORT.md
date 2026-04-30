# RESEARCH_REPORT.md

## Executive summary

The backend Golden Schema refactor created the right normalized contract, but the current frontend universal form stack is still only partially ready for nested objects and normalized line-item arrays. React Hook Form is already in place and `useFieldArray` already exists, so this is **not** a form-library rewrite. The urgent work is to make the surrounding schema/default/error/visibility/reset logic path-aware and preserve the React #185 fix by avoiding prop-derived local state.

On the AI side, `ai_assistant` already has tenant-safe document storage and a strong document parsing path, but business extraction is still prompt-shaped JSON, not serializer-backed structured output. The missing piece is a serializer allowlist + strict JSON schema generation + server-side serializer validation for the new `extract-to-schema` endpoint.

## Discovery scope

### Frontend audited

1. `frontend/src/features/system/DynamicFormEngine.tsx`
2. `frontend/src/components/Shared/UniversalEntityForm.tsx`
3. `frontend/src/components/Shared/EntityFormSurface.tsx`
4. Existing DynamicFormEngine / UniversalEntityForm stability tests

### Backend audited

1. `backend/tenant_apps/ai_assistant/views.py`
2. `backend/tenant_apps/ai_assistant/models.py`
3. `backend/tenant_apps/ai_assistant/serializers.py`
4. `backend/tenant_apps/ai_assistant/swarm/executor.py`
5. `backend/tenant_apps/ai_assistant/swarm/router.py`
6. `backend/tenant_apps/ai_assistant/services/document_parser.py`
7. `backend/apps/system/views/forms_schema.py`
8. `backend/apps/system/services/entity_introspection.py`

## Frontend findings

### 1. The form stack already uses React Hook Form

`DynamicFormEngine.tsx` already imports and uses:

1. `useForm`
2. `Controller`
3. `useWatch`
4. `useFieldArray`

This is important because the line-item UI can be added inside the current architecture instead of replacing it.

### 2. `useFieldArray` exists, but only as a mostly top-level array editor

Current support is centered around `inline_form_array` fields. That means the stack can already append/remove row objects, but it is still fundamentally tuned for flat schemas and shallow arrays.

### 3. Dot-notation is only partially supported

React Hook Form itself can register dotted names, and the inline array path builder already uses string paths like:

1. `line_items.0.quantity`
2. `line_items.0.package_type`

But the rest of the form stack still treats most field keys as flat strings. The gaps are in:

1. Zod schema construction
2. default value building
3. conditional visibility/dependency lookups
4. error lookup
5. submit normalization
6. read-only/view-mode rendering

That means `billing_address.city` may bind in RHF, but the surrounding logic may still fail to validate it, clear it, render its errors, or normalize it correctly.

### 4. The React #185 fix must not be broken

The current stabilization depends on **direct external resource consumption** in `UniversalEntityForm` and **stable memo/signature patterns** in `DynamicFormEngine`. The core anti-loop rule is:

> do not mirror externally supplied schema/record data into local component state through effects

If nested-form support is implemented by introducing new prop -> effect -> setState mirroring, the loop bug is likely to come back.

### 5. `UniversalEntityForm` augmentation is still flat-key oriented

Schema augmentation for entities like supplier/customer/contact/location is curated around top-level fields. If nested mixin structures arrive without a normalization layer, the augmenter will either:

1. drop them
2. flatten them incorrectly
3. mislabel them

### 6. Minimal frontend implementation surface

The real frontend work is concentrated in:

1. `frontend/src/components/Shared/UniversalEntityForm.tsx`
2. `frontend/src/features/system/DynamicFormEngine.tsx`

Supporting changes may be needed for shared searchable-select rendering in line-item rows, but the epic does **not** require a brand-new frontend form system.

## Backend AI findings

### 1. Parsing is stronger than extraction

The current `ai_assistant` lane already supports:

1. tenant-safe `AIDocument` uploads
2. email attachment ingestion into `AIDocument`
3. tabular parsing for csv/xls/xlsx
4. non-tabular parsing through Unstructured
5. parse metadata persisted back to the document

### 2. Business extraction is still prompt-based, not contract-based

Purchase-order extraction exists in `swarm/executor.py`, but it is still fundamentally:

1. regex fallback
2. prompt the model for JSON
3. `json.loads(...)`

That is not sufficient for the new Golden Schema because:

1. nested objects must match serializer shape
2. enums must be exact
3. extra properties must be rejected
4. line items must have predictable row structure

### 3. Structured outputs are not yet used in `ai_assistant`

The repo does use JSON-output patterns elsewhere, but `ai_assistant` itself does not currently use:

1. serializer-backed JSON schema generation
2. strict `response_format` JSON schema outputs
3. Pydantic models for extracted entity payloads

### 4. Existing UI/model schema generation is not enough

`forms_schema.py` and entity introspection are useful references, but they are not a safe extraction contract because they are UI/model oriented rather than serializer-write-payload exact.

The extraction endpoint should use an explicit `entity_type -> serializer` allowlist and generate the extraction schema from the serializer layer, not directly from models or UI form metadata.

### 5. Minimal backend implementation surface

The best backend surface is:

1. new service file in `backend/tenant_apps/ai_assistant/services/`
2. new request/response serializer(s)
3. new view/route in `backend/tenant_apps/ai_assistant/`
4. targeted tests in `backend/tenant_apps/ai_assistant/tests/`

This can stay additive and stateless. No migration is required unless extraction history/caching is later persisted.

## QA findings

### Highest-signal validation approach

Use targeted frontend Vitest and targeted Django tests first. This epic’s risks are:

1. hook-state stability
2. array/reset correctness
3. strict enum/schema validation
4. endpoint contract safety

Those are faster and more deterministic to prove with focused unit/API tests than with broad e2e coverage first.

### Highest-risk failure modes

1. nested `form.reset(...)` reintroducing React #185 / max update depth
2. stale array rows surviving reset or conditional clear
3. path-based visibility/errors/defaults still behaving as flat keys
4. hallucinated enum values in AI extraction
5. extra JSON properties slipping through extraction
6. drift between routed endpoint contract and internal serializer assumptions

## Required upgrades

### Frontend

1. Introduce path-aware helpers for get/set/error access in `DynamicFormEngine`
2. Build nested Zod objects from dotted/nested schema keys instead of literal flat keys
3. Normalize backend nested schema into a renderable frontend schema without local-state mirroring
4. Extend inline array rendering to support normalized line-item schemas and item-level related-entity fields
5. Make `UniversalEntityForm` submit/reset/view normalization recursive
6. Add an autofill hook/button that safely injects extracted drafts into RHF state

### Backend

1. Add an allowlisted `entity_type -> serializer` registry
2. Build strict JSON schema from serializer writable fields
3. Add `POST /api/v1/ai-assistant/extract-to-schema/`
4. Parse documents using the existing document parser
5. Call the LLM with strict structured output
6. Validate extracted JSON with the target serializer before returning it

## Recommended implementation order

1. Write the architectural blueprint
2. Build backend extraction service + endpoint first so the UI has a real contract
3. Upgrade `UniversalEntityForm` and `DynamicFormEngine` for nested paths/arrays
4. Add the autofill component and wire it to `form.reset(...)`
5. Extend targeted frontend/backend tests
6. Produce the verification audit and residual polish list

## Blocking / partial constraints

1. The previous backend refactor still documents exact workbook parity as blocked because the Excel files are not in-repo.
2. FK resolution from extracted text to concrete DB IDs will need a conservative strategy; the safest initial version is draft extraction into serializer-shaped JSON for review, not autonomous record creation for every entity type.
3. The repo already has some unrelated OpenAPI baseline drift in other AI surfaces; this epic should avoid widening that drift.

## Bottom line

This epic is feasible with a relatively small implementation surface because the hard foundations already exist:

1. React Hook Form + `useFieldArray`
2. tenant-safe document ingest and parsing
3. universal-form abstractions
4. recent React architecture stabilization

The real work is synchronization:

1. make the frontend path-aware and reset-safe
2. make AI extraction serializer-backed and enum-safe
3. join the two with a draft-autofill review flow instead of manual data entry
