# Emergency UI/UX Surgery Complete

## Files modified

- `frontend/src/components/Shared/EntityFormSurface.tsx`
  - Added explicit `destroyOnClose` alongside the existing `destroyOnHidden` + conditional mount flow so modal form state is torn down on close.
- `frontend/src/components/Navigation/Breadcrumb.tsx`
  - Memoized the `useQueries` input array to keep breadcrumb entity-name resolution referentially stable.
  - Replaced opaque UUID fallback labels with contextual labels such as `Supplier Details` and `Plant Details`.
- `frontend/src/components/Navigation/Breadcrumb.test.tsx`
  - Added regression coverage proving failed entity-name lookups no longer render raw UUIDs.

## Verified existing safety already present on development

- `frontend/src/components/Inquiry/InquiryDetailModal.tsx`
  - Uses `formatCurrencyValue`, `formatFixedWithFallback`, and `formatIntegerValue` for null-safe numeric rendering.
- `frontend/src/components/Inquiry/numberFormatting.ts`
  - Coerces invalid numeric inputs before formatting.
- `frontend/src/pages/Accounting/Invoices.tsx`
  - Uses shared `formatCurrency` / `coerceFiniteNumber` boundaries rather than raw `.toFixed()` calls.

## Outcome

- Plant/entity edit modals fully destroy form state on close.
- Breadcrumbs no longer leak raw UUIDs when entity-name resolution fails.
- The current development branch already carries the invoice/inquiry null-safety boundaries required for the `.toFixed()` crash class.
