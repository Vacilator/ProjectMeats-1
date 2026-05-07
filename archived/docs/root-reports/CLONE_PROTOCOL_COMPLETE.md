# Clone Protocol Complete

## Deliverables
- Added a dedicated plant edit route in `frontend/src/App.tsx`:
  - `/plants/:id/edit` → `UniversalEntityRecordPage entityType="plant" basePath="/plants" mode="edit"`
- Removed the nested `isEditing` / inline edit-surface branch from `frontend/src/pages/Suppliers/PlantDetail.tsx`.
- Rewired the **Edit Plant** button in `frontend/src/pages/Suppliers/PlantDetail.tsx` to navigate to `/plants/:id/edit`, matching the supplier route-based edit pattern.
- Added the same route-based **Edit Plant** entrypoint to `frontend/src/pages/Plants/PlantDetailView.tsx`.

## Structural Alignment
- **Supplier benchmark:** `UniversalEntityRecordPage` uses `Edit` → `navigate(editPath)` and renders the edit form on a dedicated route.
- **Plant after clone:** both plant detail entrypoints now use `Edit Plant` → `navigate('/plants/:id/edit')`.
- The dedicated edit route renders the plant form via the same `UniversalEntityRecordPage` + `EntityFormSurface` structure the supplier flow already uses.

## Phase 3 Outcome
- Searched `EntityFormSurface.tsx` and `UniversalEntityForm.tsx` for plant-specific edit/hydration hacks.
- No explicit `entityType === 'plant'` edit-path special cases were present, so no form-engine hack removal was required.

## Acceptance Criteria
- Plant detail pages no longer mount their own edit form tree inline.
- Plant edit now runs through the same dedicated edit-route pattern as the working supplier flow.
- The old nested plant edit branch was removed.

## Testing Strategy
- `npx vitest run src/pages/Suppliers/PlantDetail.workflows.test.tsx`
- Included in the broader frontend regression run for the AI inbox work.
- `npm run type-check`

## Rollback
- Revert the `/plants/:id/edit` route and restore the old local `isEditing` implementation in `Suppliers/PlantDetail.tsx`.
- No data model or API changes were required for this clone protocol.
