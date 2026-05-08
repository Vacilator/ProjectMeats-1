# AI Inbox Resolution

## Deliverables
- Routed AI email-review notifications to `/my-tasks?tab=ai-review&draft=<id>` at the producer (`backend/apps/integrations/signals.py`) and preserved the same routing via notification serialization fallback (`backend/tenant_apps/workflows/serializers.py`).
- Enriched the pending review API payload with operational queue metadata (`sender`, `intent_label`, `source_subject`, `source_summary`, `source_document_name`, `review_entity_type`, `review_target_url`).
- Added an operational **AI Review Queue** tab to `frontend/src/pages/MyTasks/MyTasks.tsx`.
- Added `frontend/src/components/AIAssistant/AIDraftReviewModal.tsx` to open a draft, show source context, hydrate the form with AI guesses, save the entity, and resolve the draft.
- Moved the stale integrations-side draft CTA to the queue by updating `frontend/src/components/Integrations/IngestionMonitor.tsx`.
- Added tenant-scoped auto-sync orchestration via `POST /api/v1/integrations/email/auto-sync/`, the existing `integrations.sync_single_tenant` task, and a 15-minute Celery beat cadence for scheduled inbox refresh.
- Added an app-level `AIInboxSyncProvider` that requests an immediate sync after authenticated session bootstrap and re-queues inbox refresh every 15 minutes while the user stays logged in.
- Added thumbs-up / thumbs-down feedback controls to AI Inbox items and the draft review modal, requiring a note for thumbs-down submissions before they can be queued for retraining.
- Extended `AIFeedbackLog` metadata so inbox feedback captures operator sentiment, optional comment, submitting user, and retraining queue state without replacing the existing review/resolve flow.

## Expected Results
- AI draft notifications now land on an operational review hub instead of Settings.
- Staff users can review a pending AI draft, open a hydrated entity form, save the real record, and clear the draft from the queue.
- The old settings-side review entrypoint now forwards users to the operational queue instead of trapping them in Integrations.
- AI Inbox ingestion now gets a login-time refresh plus a steady 15-minute background cadence without blocking the UI or bypassing tenant scoping.
- Operators can now leave quick AI quality feedback directly from the inbox list or review modal, and negative feedback always includes the missing context for retraining.

## Acceptance Criteria
- Pending AI draft notifications route to `/my-tasks?tab=ai-review`.
- My Tasks exposes a visible AI review queue with actionable draft rows.
- Reviewing a draft opens a populated form and resolving the save removes it from the queue.
- Logged-in sessions queue an inbox sync immediately after authentication settles.
- Logged-in sessions continue queueing inbox sync every 15 minutes, and the AI Inbox view refreshes when that sync completes.
- Every AI Inbox row exposes thumbs-up / thumbs-down feedback controls.
- Thumbs-down feedback cannot be submitted without a reason/comment.
- Feedback and corrected draft saves are both marked as queued for retraining.

## Dependencies
- Existing `AIFeedbackLog` pending-review/resolve endpoints.
- Existing `EntityFormSurface` / `UniversalEntityForm` save flow.
- Existing `EmailReviewDraft` notification producer in `apps.integrations.signals`.
- Existing `EmailIngestionService`, Celery routing, and tenant-aware `sync_ai_feedback_queue_for_tenant`.
- Existing `AIFeedbackViewSet` and pending-review resolve API for tenant-scoped AI review actions.

## Risks + Mitigations
- **Mixed legacy/new notification data:** mitigated with a serializer fallback that rewrites legacy settings URLs into the queue route.
- **Unsupported draft entity types:** mitigated by a modal fallback that still shows the parsed payload even when no supported form mapping exists.
- **Queue data drift:** mitigated by deriving queue metadata from the stored draft payload and linked `AIDocument`, not a parallel table.
- **Duplicate sync storms across tabs:** mitigated with client-side coalescing before auto-sync requests are enqueued.
- **Login-path regressions:** mitigated by keeping auto-sync soft-fail and asynchronous so auth completion never depends on inbox polling success.
- **Accidentally clearing unresolved drafts on simple feedback:** mitigated by keeping feedback submission separate from queue resolution and only resolving when corrected data is saved.
- **Low-signal negative feedback:** mitigated by requiring a reason before thumbs-down can be submitted.

## Testing Strategy
- `python backend/manage.py test backend.apps.integrations.test_email_review_drafts backend.tenant_apps.ai_assistant.tests.test_review_queue_api backend.tenant_apps.workflows.tests.test_user_notification_serializer`
- `npx vitest run src/components/AIAssistant/AIDraftReviewModal.test.tsx src/pages/MyTasks/MyTasks.aiReview.test.tsx src/components/Integrations/IngestionMonitor.test.tsx src/pages/Suppliers/PlantDetail.workflows.test.tsx`
- `source /venv/bin/activate && python backend/manage.py test tenant_apps.ai_assistant.tests.test_review_queue_api --keepdb --noinput`
- `npm --prefix frontend exec vitest run src/components/AIAssistant/AIInboxFeedbackActions.test.tsx src/components/AIAssistant/AIDraftReviewModal.test.tsx src/pages/MyTasks/MyTasks.aiReview.test.tsx`
- `npm run type-check`
- `source /venv/bin/activate && python backend/manage.py test apps.integrations.tests apps.integrations.test_tasks_rls_scope projectmeats.tests.test_celery_config`
- `npm --prefix frontend exec vitest run src/contexts/AIInboxSyncContext.test.tsx src/pages/MyTasks/MyTasks.aiReview.test.tsx src/components/Integrations/IngestionMonitor.test.tsx`

## Rollback
- Revert the notification producer/serializer route normalization and remove the My Tasks AI review queue/modal additions.
- Draft data remains in `EmailReviewDraft` / `AIFeedbackLog`, so rollback is UI-routing safe and additive.
- Auto-sync is additive only; rollback is a git revert of the async endpoint/provider/beat cadence without schema cleanup.

---

## Platform Finalization – PO 226052 End-to-End Test Case

> **Added:** Sprint Capstone (Platform Finalization & Production Handover)

### Test Scenario: Rowena TX PO 226052

**Context:** A supplier sends a PO confirmation email. The AI Inbox must parse it, create a cockpit draft, and route it to Process Cockpit for trader review.

**Input Email:**
```
Subject: PO 226052 - Ground Beef 81/19 40,000 lbs - Rowena TX
From: supplier@example.com
Body:
  Please confirm PO #226052.
  Product: Ground Beef 81/19
  Quantity: 40,000 lbs
  Ship Date: Next Monday
  Facility: Rowena TX Plant
```

**Expected AI Inbox Parse Result:**
| Field | Expected Value |
|-------|---------------|
| `po_number` | "226052" |
| `proteins` | includes "ground beef" |
| `weights` | includes ~40,000 lbs entry |
| `is_actionable` | True |
| `has_po` | True |
| `confidence` | > 0.7 |

**Expected Cockpit Draft:**
| Field | Expected Value |
|-------|---------------|
| `form_type` | "purchase_order" |
| `form_data.po_number` | "226052" |
| `form_data.protein_type` | contains "beef" |
| `status` | "pending_review" |

**Automated Test:** `test_parse_rowena_tx_po_226052` in `backend/tenant_apps/workflows/tests/test_platform_finalization.py`

### Cockpit Routing Verification

1. Parsed email → `cockpit_routing.create_draft_from_parsed_email()` → draft created
2. Draft appears in Process Cockpit "Action Required" tab
3. Trader can edit draft form (pre-filled with parsed payload)
4. On save → PO entity created → draft resolved → removed from queue

### Contact Resolution Integration

When the AI Inbox detects a PO email:
1. `resolve_rfq_contacts_for_send` identifies relevant contacts by Plant Contact Type
2. If contacts are missing → `MissingDependencyQuickCreate` widget appears
3. Contacts with matching certifications/shipping prefs are prioritized
4. Document attachments (spec sheets, certifications) are auto-linked

### Test Commands

```bash
# Run the specific PO 226052 test
source /venv/bin/activate
python manage.py test tenant_apps.workflows.tests.test_platform_finalization.PlatformFinalizationTests.test_parse_rowena_tx_po_226052

# Run full AI inbox + cockpit routing tests
python manage.py test tenant_apps.workflows.tests.test_platform_finalization.PlatformFinalizationTests.test_inbox_parser_cockpit_routing
```
