# UI_UX_DEBT_2026 (Enterprise UI/UX Consolidation Audit)

**Generated**: 2026-03-31

Goal: Identify UI duplication and inconsistencies vs tier-1 enterprise SaaS patterns (Salesforce Lightning, Ant Design Pro), especially around tables, modals, spacing tokens, and nested entity drill-down UX.

---

## 1) Duplicated UI primitives (high signal)

### Tables
Observed multiple table implementations:
- `frontend/src/components/Shared/ResponsiveTable.tsx` (custom)
- `frontend/src/components/Admin/AdminTable.tsx` (custom)
- Raw HTML tables in some pages (e.g., WorkForms history)
- AntD tables in other surfaces

**Debt / risk:**
- inconsistent sorting/filtering/pagination UX
- inconsistent mobile behavior
- duplicated accessibility fixes

**Recommendation (enterprise baseline):**
- Standardize on AntD `Table` + a single wrapper for responsiveness and common column renderers.
- Deprecate “one-off” custom tables where feasible.

### Modals
Numerous modal patterns:
- `frontend/src/components/Modal/Modal.tsx` (custom)
- Many feature-local modals (FlowEditor modals, form-builder modals, inquiry modals, fulfillment modals)

**Debt / risk:**
- inconsistent keyboard trap/escape behavior
- inconsistent z-index layering
- inconsistent padding/spacing

**Recommendation:**
- Standardize on AntD `Modal` and create one minimal wrapper for:
  - default width/breakpoints
  - consistent footer layout
  - safe scroll behavior
  - focus management

---

## 2) Spacing/padding token consistency

Patterns show mixed styling strategies:
- styled-components with hardcoded padding values
- CSS variables in some surfaces
- occasional bespoke sizing

**Recommendation:**
- Establish a shared spacing scale (e.g., 4/8/12/16/24/32) and enforce via theme tokens / CSS vars.
- Avoid per-component padding “guessing”.

---

## 3) Nested entity flows (Grandparent → Parent → Child)

Target enterprise flow:
- List view → row click → detail view
- Detail view has child tabs/sections with embedded child lists
- URL structure reflects hierarchy

Current drift indicators (needs confirm per module):
- Some pages still rely on flat routes and local state expand/collapse
- Some list pages use explicit name links/buttons rather than row-click drilldowns

**Recommendation:**
- Make hierarchy navigation URL-first and consistent:
  - `/suppliers/:id/plants`
  - `/suppliers/:id/plants/:plantId/contacts`
  - `/customers/:id/locations`
  - `/customers/:id/locations/:locationId/contacts`

---

## 4) “Great Deletion Part 2” candidates

Candidates for refactor/deletion (pattern-based):
- redundant table components (keep 1)
- redundant modal wrappers (keep 1)
- redundant card/list primitives when AntD covers the use case

**Non-breaking strategy:**
- Wrap old components around new primitives first, then delete internal duplication.

