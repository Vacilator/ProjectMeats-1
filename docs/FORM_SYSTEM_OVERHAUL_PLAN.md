# Form Systems Full Overhaul - Project Plan & Status

> **Document Created**: January 29, 2026  
> **Last Updated**: January 29, 2026  
> **Status**: 🚧 In Progress

## Overview

**Goal**: Comprehensive enhancement of forms on both the frontend Quick Actions modal and the backend admin form builder to be intuitive, smart, efficient, dynamic, powerful, and extensible.

**Approach**: Phase by priority - critical fixes first, then UX polish, then new capabilities.

---

## 🚨 CRITICAL BUG: Field Types Not Reaching Frontend

### Problem
All form fields display as "text" type in the frontend modal, even when the backend admin shows proper field types (select, email, etc.).

### Root Cause Analysis
The issue is in **`/backend/tenant_apps/workflows/signals.py` line 125**:

```python
field_meta = entity_fields_meta.get(field.field_key, {})
field_type = field_meta.get('type', 'text')  # ← Defaults to 'text' if lookup fails!
```

**Data Flow (Where It Breaks)**:
1. `TenantFormField` model stores `field_key` (e.g., "supplier") but NOT `field_type`
2. `_build_form_snapshot()` tries to look up type from `FieldRegistry.get_fields_for_entity()`
3. The lookup returns metadata keyed by field name, but it's being searched with wrong key format
4. Lookup fails silently → defaults to `'text'`
5. Frontend receives all fields as `type: 'text'`

**Contrast with Working System**:
The `DataSchemaField` model (used in Schema Builder) **explicitly stores** `field_type` as a CharField:
```python
field_type = models.CharField(max_length=20, choices=FieldType.choices, default=FieldType.TEXT)
```

### Fix Required (Phase 0)
**Option B (Robust Fix)**: Add `field_type` CharField to `TenantFormField` model, similar to `DataSchemaField`.

### Priority
🔴 **CRITICAL** - Must be fixed BEFORE other Phase 1 work, as all field rendering depends on correct types.

---

## Current State Analysis

### Frontend FormSubmissionModal
**Location**: `/frontend/src/components/FormSubmission/FormSubmissionModal.tsx`

**Working Features**:
- ✅ Multi-step navigation with progress indicator
- ✅ Auto-save with 500ms debounce
- ✅ 20+ field types rendered
- ✅ Conditional field visibility (hide_fields)
- ✅ Searchable multi-select
- ✅ Professional styled-components UI

**Critical Gaps**:
- ❌ **Field types all showing as "text"** (root cause identified above)
- ❌ Validation rules stored but never executed
- ❌ Auto-populate configured but never triggers
- ❌ Quick Create button exists in FormField.tsx but not in modal
- ❌ File/image upload not implemented

### Backend Admin Form Builder
**Location**: `/backend/tenant_apps/workflows/` + Django Admin templates

**Working Features**:
- ✅ Step-based visual builder (Alpine.js)
- ✅ Drag-drop field reordering
- ✅ Conditional rules builder
- ✅ Field mapping with fuzzy matching
- ✅ Form preview modal
- ✅ 10 entity types, 20 field types

**Enhancement Opportunities**:
- ⚠️ UI could be modernized
- ⚠️ No field templates/presets
- ⚠️ No analytics or insights
- ⚠️ No form import/export

---

## Phase 0: Field Type Bug Fix (IMMEDIATE)

### 0.1 Fix Field Type Lookup in Form Snapshot
**Priority**: 🔴 CRITICAL | **Effort**: Low-Medium | **Status**: 🚧 In Progress

**Root Cause**: `_build_form_snapshot()` in signals.py fails to retrieve field types from FieldRegistry.

**Fix (Option B: Store field_type in Model)**:
- [x] Add `field_type = models.CharField(max_length=30, default='text')` to TenantFormField
- [x] Create migration
- [x] Update admin form builder to save field_type when field is added
- [x] Update signals.py to use stored field_type with registry as fallback

**Files modified**:
- `backend/tenant_apps/workflows/models.py`
- `backend/tenant_apps/workflows/signals.py`
- `backend/templates/admin/workflows/tenantform/change_form.html`

---

## Phase 1: Critical Fixes (Foundation)

### 1.1 Validation Rules Execution
**Priority**: 🔴 Critical | **Effort**: Medium | **Status**: ⬜ Not Started

**Problem**: `validation_rules` are stored in field config but never enforced.

**Implementation**:
- [ ] Create `validateField(value, rules)` utility function
- [ ] Support validation types:
  - `min_length` / `max_length` for text
  - `min` / `max` for numbers
  - `pattern` (regex) for custom formats
  - `email` / `url` / `phone` format validators
- [ ] Integrate into `handleBlur` and `handleSubmit`
- [ ] Display validation errors per field
- [ ] Block step navigation if validation fails
- [ ] Add visual indicators (red border, error message)

**Files to modify**:
- `frontend/src/components/FormSubmission/FormSubmissionModal.tsx`
- Create: `frontend/src/utils/formValidation.ts`

### 1.2 Auto-Populate Implementation
**Priority**: 🔴 Critical | **Effort**: Medium | **Status**: ⬜ Not Started

**Problem**: `field.config.auto_populate.source_step` is set but value never copied.

**Implementation**:
- [ ] On step navigation, check target step fields for auto_populate config
- [ ] Copy values from source step/field to target field
- [ ] Support modes:
  - `copy`: Direct value transfer
  - `lookup`: Fetch related entity data via API
- [ ] Show "Auto-filled from [Step Name]" indicator
- [ ] Allow user override of auto-filled values
- [ ] Trigger auto-populate on source field change

**Files to modify**:
- `frontend/src/components/FormSubmission/FormSubmissionModal.tsx`
- May need backend endpoint: `GET /api/v1/workflows/entity-lookup/{entity_type}/{id}/`

### 1.3 Quick Create Modal for FK Fields
**Priority**: 🟠 High | **Effort**: Low | **Status**: ⬜ Not Started

**Problem**: FormField.tsx has Quick Create but FormSubmissionModal doesn't.

**Implementation**:
- [ ] Add "+ Create New" button to select/foreignkey fields
- [ ] Open QuickCreateModal when clicked
- [ ] On entity creation, refresh options and select new entity
- [ ] Pass entity type from field's `related_entity_type`

**Files to modify**:
- `frontend/src/components/FormSubmission/FormSubmissionModal.tsx`
- Import: `QuickCreateModal` from existing component

### 1.4 File Upload Implementation
**Priority**: 🟠 High | **Effort**: Medium | **Status**: ⬜ Not Started

**Problem**: File/image types recognized but not rendered.

**Implementation**:
- [ ] Create FileUploadField component with:
  - Drag-drop zone
  - File preview (image thumbnail, file icon)
  - Progress indicator
  - Remove button
- [ ] Add upload endpoint: `POST /api/v1/workflows/form-submissions/{id}/upload/`
- [ ] Store file reference in form data
- [ ] Support image preview for image type
- [ ] File size/type validation

**Files to create**:
- `frontend/src/components/FormSubmission/FileUploadField.tsx`

**Files to modify**:
- `frontend/src/components/FormSubmission/FormSubmissionModal.tsx`
- `backend/tenant_apps/workflows/views.py` (upload endpoint)

---

## Phase 2: UX Polish

### 2.1 Backend Admin UI Modernization
**Priority**: 🟡 Medium | **Effort**: High | **Status**: ⬜ Not Started

**Enhancements**:
- [ ] Refresh Alpine.js components with modern styling
- [ ] Add animations for drag-drop operations
- [ ] Improve color scheme consistency
- [ ] Better visual hierarchy in step cards
- [ ] Cleaner modal designs
- [ ] Dark mode support improvements

**Files to modify**:
- `backend/static/admin/css/form_builder.css`
- `backend/templates/admin/workflows/tenantform/change_form.html`

### 2.2 Field Templates & Presets
**Priority**: 🟡 Medium | **Effort**: Medium | **Status**: ⬜ Not Started

**Implementation**:
- [ ] Create common field groups:
  - **Address**: street, city, state, zip, country
  - **Contact Info**: phone, email, website
  - **Business Info**: name, tax_id, payment_terms
- [ ] "Add Template" button in step editor
- [ ] One-click add all fields in template
- [ ] Store templates in database for tenant customization

**Files to create**:
- `backend/tenant_apps/workflows/models.py` - FieldTemplate model
- `backend/tenant_apps/workflows/services/templates.py`

### 2.3 Field Groups (Collapsible Sections)
**Priority**: 🟡 Medium | **Effort**: Medium | **Status**: ⬜ Not Started

**Implementation**:
- [ ] Allow grouping fields within a step
- [ ] Collapsible accordion UI
- [ ] Group labels and descriptions
- [ ] Drag fields between groups
- [ ] Update form snapshot to include groups

**Files to modify**:
- Frontend modal: Add group rendering
- Backend model: Add FormFieldGroup model
- Admin template: Group management UI

### 2.4 Smart Search for Large Dropdowns
**Priority**: 🟡 Medium | **Effort**: Medium | **Status**: ⬜ Not Started

**Implementation**:
- [ ] Threshold check: >50 options triggers API search
- [ ] Debounced search input (300ms)
- [ ] Backend endpoint: `GET /api/v1/workflows/entity-search/{type}/?q=`
- [ ] Loading state during search
- [ ] "Load more" pagination for results

**Files to modify**:
- `frontend/src/components/FormSubmission/FormSubmissionModal.tsx`
- `backend/tenant_apps/workflows/views.py`

### 2.5 Accessibility Improvements
**Priority**: 🟡 Medium | **Effort**: Low | **Status**: ⬜ Not Started

**Implementation**:
- [ ] Add ARIA labels to all form controls
- [ ] `aria-required`, `aria-invalid`, `aria-describedby`
- [ ] Keyboard navigation for multi-select
- [ ] Focus management on step change
- [ ] Screen reader announcements for auto-save

**Files to modify**:
- `frontend/src/components/FormSubmission/FormSubmissionModal.tsx`

---

## Phase 3: New Capabilities

### 3.1 New Field Types
**Priority**: 🟢 Enhancement | **Effort**: High | **Status**: ⬜ Not Started

**Rich Text Editor**:
- [ ] Integrate Quill or TipTap editor
- [ ] Basic formatting (bold, italic, lists, links)
- [ ] HTML sanitization on save

**Signature Field**:
- [ ] Canvas-based signature capture
- [ ] Save as base64 image
- [ ] Clear button

**Rating Field**:
- [ ] Star rating (1-5)
- [ ] Configurable max stars
- [ ] Half-star option

**Slider Field**:
- [ ] Range input with labels
- [ ] Min/max configuration
- [ ] Step size option

**Files to create**:
- `frontend/src/components/FormSubmission/fields/RichTextField.tsx`
- `frontend/src/components/FormSubmission/fields/SignatureField.tsx`
- `frontend/src/components/FormSubmission/fields/RatingField.tsx`
- `frontend/src/components/FormSubmission/fields/SliderField.tsx`

### 3.2 Form Import/Export
**Priority**: 🟢 Enhancement | **Effort**: Medium | **Status**: ⬜ Not Started

**Implementation**:
- [ ] Export form config as JSON
- [ ] Import form from JSON
- [ ] Validate imported structure
- [ ] Map entity types between tenants
- [ ] Admin action: "Copy to Tenant"

**Files to create**:
- `backend/tenant_apps/workflows/services/import_export.py`
- Admin template: Import modal

### 3.3 Analytics Dashboard
**Priority**: 🟢 Enhancement | **Effort**: Medium | **Status**: ⬜ Not Started

**Metrics**:
- [ ] Form completion rate
- [ ] Average completion time
- [ ] Step drop-off analysis
- [ ] Field error frequency
- [ ] Submissions over time chart

**Implementation**:
- [ ] Store analytics events in FormSubmissionEvent model
- [ ] Dashboard widget in admin
- [ ] Filter by date range, form, step

**Files to create**:
- `backend/tenant_apps/workflows/models.py` - FormSubmissionEvent
- `backend/templates/admin/workflows/analytics.html`

### 3.4 Preview with Test Data
**Priority**: 🟢 Enhancement | **Effort**: Low | **Status**: ⬜ Not Started

**Implementation**:
- [ ] "Fill with Test Data" button in preview
- [ ] Generate realistic fake data per field type
- [ ] Use Faker-like patterns for names, emails, etc.
- [ ] Show conditional rule triggers with test data

**Files to modify**:
- `backend/templates/admin/workflows/tenantform/change_form.html`
- Alpine.js: Add `generateTestData()` function

---

## Phase 4: Future-Proofing

### 4.1 Mobile Optimization
**Priority**: 🔵 Future | **Effort**: Medium | **Status**: ⬜ Not Started

- [ ] Touch-friendly input sizes (min 44px)
- [ ] Swipe navigation between steps
- [ ] Collapsible step indicator on mobile
- [ ] Virtual keyboard-aware layout
- [ ] Mobile-first CSS breakpoints

### 4.2 Internationalization (i18n)
**Priority**: 🔵 Future | **Effort**: High | **Status**: ⬜ Not Started

- [ ] Extract all strings to translation files
- [ ] Field label translations per tenant
- [ ] RTL language support
- [ ] Date/number format localization
- [ ] Backend: Store translations in JSONField

### 4.3 Performance Optimization
**Priority**: 🔵 Future | **Effort**: Medium | **Status**: ⬜ Not Started

- [ ] Memoize rule evaluation
- [ ] Lazy load field components
- [ ] Virtual scrolling for long forms
- [ ] Optimize re-renders with React.memo
- [ ] Bundle size analysis and splitting

---

## Implementation Order

### Sprint 0: CRITICAL BUG FIX ✅
- [x] 0.1 Fix Field Type Lookup in Form Snapshot

### Sprint 1: Foundation
- [ ] 1.1 Validation Rules Execution
- [ ] 1.2 Auto-Populate Implementation
- [ ] 1.3 Quick Create Modal Integration

### Sprint 2: File Handling & Search
- [ ] 1.4 File Upload Implementation
- [ ] 2.4 Smart Search for Large Dropdowns

### Sprint 3: UX Polish
- [ ] 2.1 Backend Admin UI Modernization
- [ ] 2.5 Accessibility Improvements

### Sprint 4: Organization
- [ ] 2.2 Field Templates & Presets
- [ ] 2.3 Field Groups (Collapsible Sections)

### Sprint 5: New Fields
- [ ] 3.1 New Field Types (Rich Text, Signature, Rating, Slider)

### Sprint 6: Advanced Features
- [ ] 3.2 Form Import/Export
- [ ] 3.3 Analytics Dashboard
- [ ] 3.4 Preview with Test Data

### Sprint 7+: Future
- [ ] 4.1 Mobile Optimization
- [ ] 4.2 Internationalization
- [ ] 4.3 Performance Optimization

---

## Success Criteria

### Phase 0 Complete When:
- [x] Field types correctly propagate from backend to frontend

### Phase 1 Complete When:
- [ ] All validation rules execute and display errors
- [ ] Auto-populate copies values between steps
- [ ] Quick Create works for all FK fields
- [ ] File uploads work with preview

### Phase 2 Complete When:
- [ ] Admin UI feels modern and consistent
- [ ] Field templates reduce form setup time
- [ ] Large dropdowns search via API
- [ ] Forms pass accessibility audit

### Phase 3 Complete When:
- [ ] 4 new field types available
- [ ] Forms can be exported/imported
- [ ] Analytics show useful insights
- [ ] Preview generates realistic test data

---

## Technical Notes

### Key Files Reference
```
Frontend:
├── frontend/src/components/FormSubmission/
│   ├── FormSubmissionModal.tsx  # Main modal (1000+ lines)
│   ├── FormField.tsx            # Base field renderer
│   ├── FormStep.tsx             # Step wrapper
│   ├── QuickCreateModal.tsx     # Entity creation modal
│   └── fields/                  # NEW: Field-specific components

Backend:
├── backend/tenant_apps/workflows/
│   ├── models.py                # TenantForm, FormStep, FormField, etc.
│   ├── views.py                 # API endpoints
│   └── services/
│       ├── field_registry.py    # Field type definitions
│       └── form_service.py      # Form processing logic
├── backend/templates/admin/workflows/
│   └── tenantform/change_form.html  # Admin form builder
└── backend/static/admin/css/form_builder.css
```

### API Endpoints to Add
```
POST /api/v1/workflows/form-submissions/{id}/upload/
GET  /api/v1/workflows/entity-search/{type}/?q=
GET  /api/v1/workflows/entity-lookup/{type}/{id}/
POST /api/v1/workflows/forms/{id}/export/
POST /api/v1/workflows/forms/import/
GET  /api/v1/workflows/forms/{id}/analytics/
```

---

## PR History

| PR | Description | Status |
|----|-------------|--------|
| TBD | Phase 0: Field type fix | 🚧 In Progress |
| TBD | Phase 1.1: Validation rules | ⬜ Not Started |
| TBD | Phase 1.2: Auto-populate | ⬜ Not Started |
| TBD | Phase 1.3: Quick create | ⬜ Not Started |
| TBD | Phase 1.4: File upload | ⬜ Not Started |
