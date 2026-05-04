# Critical Bug Resolution

## Scope

Resolved the two UI crash classes called out in the modal lifecycle review:

1. **Null-safe numeric formatting** in the inquiry detail flow
2. **Fresh modal unmount / mount-after-ready** for shared entity-form modal flows, including Plant edit

## What changed

### 1. Null formatting guardrails

Patched the inquiry rendering path so legacy `null` numeric fields can no longer crash the UI:

- `frontend/src/components/Inquiry/InquiryDetailModal.tsx`
- `frontend/src/components/Inquiry/SmartProductAutocomplete.tsx`
- `frontend/src/components/Inquiry/numberFormatting.ts`

Key fixes:

- replaced unsafe `.toFixed()` usage with numeric coercion + fallback formatting
- switched `actual_total || desired_total` and `total_actual || total_desired` to `??` so real zero values stay zero
- normalized quantity display for missing numeric values
- made average-price previews safe for `null`, `undefined`, stringly numbers, and zero values

### 2. Modal lifecycle lockdown

Hardened the shared form surface used by Plant edit flows:

- `frontend/src/components/Shared/EntityFormSurface.tsx`
- `frontend/src/components/Shared/UniversalEntityForm.tsx`
- `frontend/src/pages/Inquiries.tsx`

Key fixes:

- modal variant now **returns `null` when closed**, so the entire surface unmounts even if a parent keeps it mounted
- `EntityFormSurface` now owns the **mount-after-ready** decision for modal flows
- the heavy form mounts only after schema / record / FK options are ready
- modal flows render `UniversalEntityForm` as **inline content** inside the modal shell so the shared loader boundary stays outside the form body
- modal close interactions now honor the child form’s submitting state
- inquiry detail modal is now conditionally mounted from the page so its local state resets on close

## Architectural outcome

The persistent Plant loop in this codebase was not a simple page-level modal toggle bug. The actual problem was shared loader identity churn in `EntityFormSurface` combined with heavy form mounting before the loader was fully settled. The fix was to keep the smart loader at the surface boundary and delay form mounting until the loader is ready, while forcing full teardown on close.

## Regression coverage

Added focused regressions for both classes of failures:

- `frontend/src/components/Shared/EntityFormSurface.test.tsx`
- `frontend/src/components/Inquiry/InquiryDetailModal.test.tsx`

These cover:

- modal form content not mounting before loader readiness
- modal form teardown when closed
- inquiry detail rendering with legacy `null` numeric values and zero totals
