# Mirror Protocol Complete

## Deliverables

- Plant detail page now uses the static hardcoded Air Gap form for Edit Plant instead of routing complex plant edits through a modal.
- Cockpit breadcrumbs mask UUID-only labels to human-readable entity detail labels.
- AI widget now connects to a tenant-aware inbox websocket and surfaces pending review counts.
- PR validation now fails if `useQueries` appears under `frontend/src/features/system/`.

## Expected Results

- `Edit Plant` on `/plants/:id` swaps into the static hardcoded plant form and avoids the modal/dynamic-form loop path entirely.
- Breadcrumbs no longer expose raw UUIDs when a readable entity label is unavailable.
- The AI widget no longer attempts a dead `/ws/ai/inbox/` connection path; it uses JWT + tenant query params and can recover from a missing access token by refreshing before connect.

## Acceptance Criteria

- Plant detail swaps into the hardcoded plant form when Edit Plant is clicked, without crashing.
- BreadcrumbBar shows `Plant Details`-style fallbacks instead of UUIDs.
- Staff AI inbox websocket connections receive pending review counts; non-staff connect safely with zeroed snapshots.
- CI blocks future `useQueries` reintroduction in the form engine surface area.

## Risks and Mitigations

- **Legacy plant route drift**: fixed by keeping the current Air Gap/static-form path instead of reintroducing complex modal form mounting.
- **AI inbox leakage**: non-staff websocket consumers get a zeroed snapshot and do not join the tenant inbox broadcast group.
- **Reconnect churn**: widget socket uses bounded backoff and refresh-before-connect when the access token is unavailable.

## Rollback

- Revert the plant hardcoded edit-form path together with the inbox websocket route/client changes and the PR validation guardrail.
