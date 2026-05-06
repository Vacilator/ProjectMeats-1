# Mirror Protocol Complete

## Deliverables

- Entity form loading stays on the single-key FK batch pattern, and Plant detail continues to mirror the Supplier modal-edit flow.
- Routed detail pages that previously mounted inline form walls (`/plants/:id`, `/suppliers/:supplierId/plants/:plantId`, `/locations/:id`, and the nested contact detail routes) now use record headers with modal edit or read-only profile surfaces.
- Cockpit breadcrumbs mask UUID-only labels to human-readable entity detail labels.
- Email ingestion now creates unresolved `AIFeedbackLog` review items, marks emails as `action_required`, and feeds the AI inbox websocket/action-required badge path.
- PR validation now fails if `useQueries` appears in the form-engine surfaces under `frontend/src/components/Shared/` or `frontend/src/features/system/`.

## Expected Results

- `Edit Plant` on `/plants/:id` opens `EntityFormSurface` in modal mode without adding another inline read-only form layer.
- The nested supplier plant route and standalone location route now use the same stable header + modal-edit pattern instead of swapping in inline form walls.
- Breadcrumbs no longer expose raw UUIDs when a readable entity label is unavailable.
- The AI widget uses the tenant-aware `/ws/ai/inbox/` path with JWT query auth, and new PO review items raise the widget into an action-required state automatically.
- Email ingestion no longer falls into the legacy `ignored` status for operator-reviewed PO intake.

## Acceptance Criteria

- Plant detail renders `EntityProfileHeader` and opens edit in modal mode.
- Routed plant/location/contact detail pages no longer depend on `mode="view"` form walls to render record details.
- BreadcrumbBar shows `Plant Details`-style fallbacks instead of UUIDs.
- Staff AI inbox websocket connections receive unresolved pending review counts; non-staff connect safely with zeroed snapshots.
- New ingested PO emails become `action_required` and emit an `AIFeedbackLog` entry for the AI inbox.
- CI blocks future `useQueries` reintroduction in the form engine surface area.

## Risks and Mitigations

- **Legacy plant route drift**: fixed by mirroring the existing Location/Supplier record-header pattern instead of inventing a new one.
- **AI inbox leakage**: non-staff websocket consumers get a zeroed snapshot and do not join the tenant inbox broadcast group.
- **Legacy ignored rows**: frontend monitor surfaces map legacy `ignored` rows into the same action-required presentation while new writes use `action_required`.
- **Reconnect churn**: widget socket uses bounded backoff and refresh-before-connect when the access token is unavailable.

## Rollback

- Revert the email-ingestion/action-required changes together with the AI inbox unresolved-queue update and the PR validation guardrail if the review workflow needs to fall back.
