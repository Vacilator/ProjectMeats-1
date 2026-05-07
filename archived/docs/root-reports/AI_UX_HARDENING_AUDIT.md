# AI UX Hardening Audit

## Outcome
- Outlook OAuth now persists durable encrypted refresh tokens across both integration surfaces and refreshes expired Microsoft access tokens before the UI reports the connection as expired.
- Chat history is grouped by recency in both the widget and full-page assistant, and auto-scroll now uses sticky bottom behavior instead of repeated smooth-scroll jumps.
- Non-retryable tool failures now inject an explicit "do not retry, ask the user" system instruction into the tool loop and block repeat attempts for the rest of the run.
- Synced actionable emails no longer fall straight into `ignored`; they are classified with `gpt-4o-mini`, converted into review drafts, and surfaced through in-app notifications plus the ingestion monitor.

## Phase 1: OAuth persistence
- Reused the canonical tenant-scoped `ExternalAuthProvider` model as the authoritative encrypted credential store.
- Hardened `EmailAccount` token storage to encrypt access and refresh tokens at rest, support legacy plaintext reads during migration, and sync Outlook/Gmail credentials back into `ExternalAuthProvider`.
- Added automatic Outlook refresh-token usage in the workflow-email surface and in `/api/v1/integrations/oauth/status/`, so hard refreshes no longer force a reconnect when a refresh token is present.

## Phase 2: Chat UX overhaul
- Added grouped session history buckets: **Today**, **Previous 7 Days**, **Older**.
- Updated the widget to use the service-layer chat session APIs for session create/list/load flows.
- Added a shared sticky auto-scroll hook and applied it to the widget and full-page assistant so scrolling only snaps when the user is already near the bottom.
- Added a full-page session history rail so prior chats can be restored without relying on external page state.

## Phase 3: Tool loop circuit breaker
- Preserved structured tool error payloads from the executor.
- Added router-side detection for non-retryable tool errors.
- Injected an exact error-aware system instruction that tells the model not to retry the tool and to ask the human for the missing information.
- Blocked subsequent attempts to call the same failed tool again during that run.

## Phase 4: Proactive ingestion pipeline
- Added AI email classification via `gpt-4o-mini` for synced emails.
- Introduced `EmailReviewDraft` as the persistent review queue record for actionable categories:
  - `purchase_order`
  - `bill_of_lading`
  - `new_customer`
- Added `draft_created` email-log status so actionable messages are distinguishable from `ignored`.
- Created high-priority in-app notifications that route users directly to the email integrations review surface.
- Extended the ingestion monitor UI to highlight actionable drafts and expose a direct **Review Draft** action.

## Verification
- Backend regressions cover:
  - canonical provider sync from encrypted workflow email credentials
  - OAuth status refresh behavior
  - actionable email draft + notification creation
  - non-retryable tool-loop clarification behavior
- Frontend regressions cover:
  - grouped session history bucketing
  - sticky auto-scroll behavior
  - ingestion monitor draft review affordance

## Acceptance criteria status
- **Outlook stays connected after hard refresh:** met.
- **Chat history is grouped and scroll jitter is reduced:** met.
- **Non-retryable tool failures trigger clarifying behavior instead of loops:** met.
- **Actionable synced emails create drafts and expose review actions:** met.
