# Gordian Knot Resolution

## Outcome

- Removed the `useQueries` fan-out from `frontend/src/components/Shared/EntityFormSurface.tsx`.
- Replaced it with a single tenant-aware batched `useQuery` that loads foreign-key options via `Promise.all`.
- Updated the `EntityFormSurface` regression coverage to assert the new cached batch-query path stays stable.

## Resolution Path

The Promise.all fix succeeded, so the hardcoded escape hatch was **not** deployed. The already-shipped plant air-gap edit flow remains the operational isolation boundary, and this patch removes the remaining unstable FK preload loop from the form surface itself.
