# ERROR 185 Root Cause

## Exact failure chain

The surviving React #185 loop was **not** in the page shells. It was in the shared form-loader path mounted by those shells:

1. **`frontend/src/pages/Suppliers/PlantDetail.tsx`** and **`frontend/src/pages/Suppliers/Plants.tsx`** open `EntityFormSurface` for Plant edit/create.
2. The same shared loader pattern is also used by invoice-related record surfaces, so the crash reproduced outside Plants even though the visible trigger differed.
3. Inside **`frontend/src/components/Shared/EntityFormSurface.tsx`**, the loader was rebuilding FK `useQueries` inputs from unstable upstream form-seed references.

Before the fix, the hot path was:

- `initialValues` arrived as a fresh object reference from callers such as `Plants.tsx`.
- `derivedInitialValues` recomputed from that fresh object.
- `mergedInitialValues` and `augmentedSchema` recomputed from that new seed.
- `fkQueryOptions` was memoized with the **`augmentedSchema` object reference** in its dependency list.
- React Query received a brand-new `queries` array and called `queryObserver.setOptions(...)` repeatedly during render.

That is the loop the stack trace was showing.

## Offending lines neutralized

### 1. Shared loader seed/object churn

**File:** `frontend/src/components/Shared/EntityFormSurface.tsx`

- **Lines 90-118**: added a deep-stable wrapper for incoming `initialValues`.
- **Lines 152-160**: `derivedInitialValues` now depends on the stable seed, not a fresh prop object.
- **Lines 260-279**: FK query options now depend on `fkFieldSignature` and `hasAugmentedSchema` instead of the mutable `augmentedSchema` object reference.

This is the primary fix for `queryObserver.setOptions`.

### 2. Caller feeding fresh modal seed objects

**File:** `frontend/src/pages/Suppliers/Plants.tsx`

- **Lines 199-206**: hoisted Plant modal `initialValues` into `useMemo`.

This removes one of the concrete callers that kept retriggering the shared loader with identical-but-new objects.

### 3. Form-engine hidden-field state loop

**File:** `frontend/src/features/system/DynamicFormEngine.tsx`

- **Lines 635-666**: replaced whole-form `useWatch()` churn with dependency-key watching only.
- **Lines 971-988**: tightened multiselect sanitation so it only writes when values actually changed.
- **Lines 1044-1072**: hidden-field clearing now uses a current snapshot from `getValues()` and only reruns when visibility-driving dependencies change.

This removes the secondary render cascade that could compound the loader loop once the modal mounted.

### 4. Smaller React Query option churn in mounted siblings

**File:** `frontend/src/components/Entities/EntityWorkflowStatusPanel.tsx`

- **Lines 38-54**: wrapped the query config in `useMemo` so `refetchInterval` is no longer recreated every render.

**File:** `frontend/src/pages/Inquiries.tsx`

- The inquiries list query now uses a stable, positional `queryKey` via `useMemo` instead of an inline object literal.

## Regression coverage added

- **`frontend/src/components/Shared/EntityFormSurface.test.tsx`**
  - Added a cached-query regression ensuring parent rerenders with identical seed objects do **not** churn the shared form surface.
- **`frontend/src/features/system/DynamicFormEngine.visibleWhenClear.test.tsx`**
  - Added a regression ensuring multiple hidden dependent fields are cleared without looping.

## Result

The rogue reference was the shared loader’s FK `useQueries` option array being rebuilt from unstable schema/seed object identities. Stabilizing that boundary, plus narrowing the form-engine watcher scope, removes the `setOptions` loop that was still driving React Error #185.
