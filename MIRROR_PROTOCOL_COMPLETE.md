# Mirror Protocol Complete

## Deliverables

- Plant detail page now uses a record-header layout with modal edit entrypoint instead of a read-only inline universal form wall.
- Cockpit breadcrumbs mask UUID-only labels to human-readable entity detail labels.
- AI widget now connects to a tenant-aware inbox websocket and surfaces pending review counts.
- PR validation now fails if `useQueries` appears under `frontend/src/features/system/`.

## Expected Results

- `Edit Plant` on `/plants/:id` opens `EntityFormSurface` in modal mode without adding another inline read-only form layer.
- Breadcrumbs no longer expose raw UUIDs when a readable entity label is unavailable.
- The AI widget no longer attempts a dead `/ws/ai/inbox/` connection path; it uses JWT + tenant query params and can recover from a missing access token by refreshing before connect.

## Acceptance Criteria

- Plant detail renders `EntityProfileHeader` and opens edit in modal mode.
- BreadcrumbBar shows `Plant Details`-style fallbacks instead of UUIDs.
- Staff AI inbox websocket connections receive pending review counts; non-staff connect safely with zeroed snapshots.
- CI blocks future `useQueries` reintroduction in the form engine surface area.

## Risks and Mitigations

- **Legacy plant route drift**: fixed by mirroring the existing Location/Supplier record-header pattern instead of inventing a new one.
- **AI inbox leakage**: non-staff websocket consumers get a zeroed snapshot and do not join the tenant inbox broadcast group.
- **Reconnect churn**: widget socket uses bounded backoff and refresh-before-connect when the access token is unavailable.

## Rollback

- Revert the plant detail page layout/modal edit changes together with the inbox websocket route/client changes and the PR validation guardrail.
