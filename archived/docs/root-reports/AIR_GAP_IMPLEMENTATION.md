# AIR GAP IMPLEMENTATION

## Deliverables

- Replaced the `PlantDetail` modal edit path with a true full-component swap that destroys the detail tree before rendering the edit form inline.
- Replaced universal record view-mode modal editing with route-backed edit rendering at `/records/:entityType/:id/edit`, covering invoice-style universal record edits without reopening `UniversalEntityForm` inside a modal.
- Added focused regressions for the plant air-gap path and the universal invoice record edit route.

## Files modified

- `frontend/src/pages/Suppliers/PlantDetail.tsx`
  - Removed the modal-backed edit mount.
  - Added `isEditing` early-return rendering so the detail view unmounts before `EntityFormSurface` edit mode renders inline.

- `frontend/src/pages/Entities/UniversalEntityRecordPage.tsx`
  - Removed modal-backed `editOpen` state.
  - Rewired all view-mode edit triggers to navigate to the standalone edit route.

- `frontend/src/pages/Entities/UniversalEntityRecordRoute.tsx`
  - Added `mode` support so the same route wrapper can render both view and edit modes.

- `frontend/src/App.tsx`
  - Added `/records/:entityType/:id/edit` route for route-backed air-gap editing.

- `frontend/src/pages/Suppliers/PlantDetail.workflows.test.tsx`
  - Added regression coverage proving plant edit swaps to an inline form surface and removes the heavy detail tree.

- `frontend/src/pages/Entities/UniversalEntityRecordRoute.airGap.test.tsx`
  - Added regression coverage proving invoice/universal record edit navigates to a standalone edit route and renders inline instead of modal.

## Form-engine audit

- `frontend/src/components/Shared/UniversalEntityForm.tsx`
- `frontend/src/features/system/DynamicFormEngine.tsx`

No `useEffect`-driven `form.setFieldsValue(...)` loops matching the requested Ant Design failure pattern were present in these files on current `development`, so no deletion was applied there in this batch.

## Expected result

- `Edit Plant` no longer reuses the modal/detail/form tree combination that was producing the React #185 loop.
- Universal record edit flows, including invoice-style detail pages, now render on a dedicated edit route instead of reopening the edit form inside the detail page modal path.
