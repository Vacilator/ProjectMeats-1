# TECHNICAL_BLUEPRINT.md

## Objective

Ship a safe AI-to-draft flow for Golden transactional forms without reintroducing the React #185 loop and without weakening serializer validation.

## Deliverables

1. **Frontend nested-form upgrade**
   - `DynamicFormEngine` becomes path-aware for dotted keys.
   - `UniversalEntityForm` can normalize flat backend payloads into nested draft state and flatten them back on submit.
   - Transactional forms gain a standard line-item editor surface.
2. **Backend extraction API**
   - `POST /api/v1/ai-assistant/extract-to-schema/`
   - allowlisted `entity_type -> serializer` registry
   - strict structured output schema derived from writable serializer fields
   - tenant-safe document access + parser reuse
3. **Autofill UX**
   - upload/select document from the form
   - request extraction
   - apply extracted draft to the form with a reset-safe path
4. **Verification artifacts**
   - frontend stability tests
   - backend extraction tests
   - `VERIFICATION_AUDIT.md`

## Expected results

1. Sales orders, purchase orders, invoices, and related transactional forms can render line items and grouped snapshot data cleanly.
2. AI extraction produces enum-restricted, serializer-valid draft payloads instead of best-effort freeform JSON.
3. The form layer can accept extracted drafts without a remount loop or maximum update depth regression.

## Architecture

### 1. Frontend data model: render shape vs API shape

The frontend will use a **form draft shape** optimized for RHF:

1. snapshot groups become dotted paths
   - `billing_contact_name` -> `billing_contact.name`
   - `billing_contact_phone` -> `billing_contact.phone`
   - `billing_address_street` -> `billing_address.street`
   - `shipping_contact_email` -> `shipping_contact.email`
2. line items remain arrays
   - `items[0].protein_type`
   - `items[0].quantity`

The backend API remains the **serializer shape**:

1. flat snapshot fields as currently exposed by DRF serializers
2. nested `items` arrays as currently exposed by DRF serializers

This keeps backend contracts backward-compatible while giving the frontend a real nested editing model.

### 2. Frontend normalization layer

`UniversalEntityForm` will own the translation:

1. **API -> form draft**
   - normalize known flat snapshot fields into dotted/nested objects
   - preserve untouched fields as-is
   - synthesize `items` field definitions for transactional entities when backend schema does not provide them
2. **form draft -> API**
   - resolve dotted paths back into flat serializer keys using schema metadata
   - keep unrendered initial values additive
   - preserve existing FK merge behavior

This avoids requiring an immediate backend forms-schema rewrite.

### 3. Dynamic form engine changes

`DynamicFormEngine` will stop treating `field.key` as a flat object key everywhere.

Required helper behaviors:

1. `getValueAtPath(obj, path)`
2. `setValueAtPath(obj, path, value)`
3. `getErrorAtPath(errors, path)`
4. nested Zod object construction from dotted keys
5. path-aware visibility/dependency clearing

`useFieldArray` already supports dotted/array names, so the change is mostly in the surrounding schema/default/error plumbing.

### 4. Standard transactional line-item UI

All transactional forms use the same inline-array pattern:

1. section label: `Line Items`
2. `Add Item` button
3. per-row card with:
   - protein type
   - product description
   - fresh/frozen
   - package type
   - quantity
   - UOM
   - net/catch
   - edible/inedible
   - tested product
   - total net weight
   - optional pricing/notes where the serializer supports them
4. remove button per row

Initial implementation is entity-aware in `augmentSchemaForFrontend`, not a second generic form engine.

### 5. AI extraction endpoint

**Endpoint:** `POST /api/v1/ai-assistant/extract-to-schema/`

**Request**

1. `document_id`
2. `entity_type`

**Execution flow**

1. resolve and tenant-check the `AIDocument`
2. reuse the existing parser pipeline to get extracted text
3. resolve `entity_type` to an allowlisted DRF serializer
4. generate strict JSON schema from serializer writable fields
5. call OpenAI with structured outputs (`response_format.json_schema`, strict mode)
6. validate returned JSON with the serializer
7. return:
   - validated serializer payload
   - metadata about parser/model/entity type

### 6. Serializer-schema generation rules

The schema generator will:

1. include only writable fields
2. recurse into nested serializers (`items`)
3. emit enums for DRF `ChoiceField`
4. mark arrays with item schemas
5. use `additionalProperties: false`
6. allow null/omission only where the serializer allows blank/null/optional input

High-risk FK fields that the model cannot infer from document text reliably should remain optional and nullable in the extraction schema so the UI can review/fill them later.

### 7. Autofill UX contract

`UniversalEntityForm` gets a small additive control near the form header:

1. upload/select a document
2. run extraction for the current entity type
3. normalize extracted serializer payload into form draft shape
4. call the form reset path only when the extracted draft actually differs

The UX is intentionally review-first:

1. extract
2. inspect the draft in the form
3. save manually

No autonomous entity creation happens inside extraction.

## Dependencies

1. Path-aware frontend helpers must land before nested-draft resets are reliable.
2. Serializer registry must exist before structured extraction can be safely routed.
3. Backend extraction response must exist before the autofill control can use real data.

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---:|---|
| React #185 regression via reset/state mirroring | Medium | High | Keep direct external-data consumption; avoid effect-driven local mirrors |
| Nested path bugs in visibility/errors/defaults | High | High | Centralize path helpers and update every flat-key assumption in touched code |
| Hallucinated enums / extra JSON keys | Medium | High | strict JSON schema + serializer validation |
| FK mismatch from document text | High | Medium | keep FK fields optional/null unless confidently derivable |
| Contract drift between extraction and form draft shape | Medium | Medium | backend returns serializer payload; frontend owns deterministic normalization |

## Acceptance criteria

1. Transactional universal forms render line items and grouped snapshot data.
2. Extracted payloads for allowlisted entity types validate through their DRF serializers.
3. Enum-restricted fields reject hallucinated values.
4. `form.reset(...)` with extracted drafts does not trigger the React #185 regression.
5. Touched API surface appears in generated OpenAPI.

## Testing strategy

### Frontend

1. extend `DynamicFormEngine.stability.test.tsx`
2. extend `DynamicFormEngine.visibleWhenClear.test.tsx`
3. extend `UniversalEntityForm.stability.test.tsx`
4. add focused tests for:
   - dotted-path defaults
   - nested submit flattening
   - inline `items` arrays
   - safe extracted-draft reset

### Backend

1. API tests for `extract-to-schema`
2. unit tests for serializer-schema generation
3. tests proving tenant-scoped document ownership is enforced
4. tests proving invalid enum outputs are rejected

## Rollback plan

1. If nested form rendering destabilizes the UI, rollback the frontend normalization/autofill layer while keeping the backend extraction service additive.
2. If extraction proves too permissive, narrow the allowlist or field coverage instead of relaxing serializer validation.
3. If a specific entity type is unstable, disable that type from the registry without removing the endpoint.
