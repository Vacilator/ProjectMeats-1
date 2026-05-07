# AI Inbox Resolution

## Deliverables
- Routed AI email-review notifications to `/my-tasks?tab=ai-review&draft=<id>` at the producer (`backend/apps/integrations/signals.py`) and preserved the same routing via notification serialization fallback (`backend/tenant_apps/workflows/serializers.py`).
- Enriched the pending review API payload with operational queue metadata (`sender`, `intent_label`, `source_subject`, `source_summary`, `source_document_name`, `review_entity_type`, `review_target_url`).
- Added an operational **AI Review Queue** tab to `frontend/src/pages/MyTasks/MyTasks.tsx`.
- Added `frontend/src/components/AIAssistant/AIDraftReviewModal.tsx` to open a draft, show source context, hydrate the form with AI guesses, save the entity, and resolve the draft.
- Moved the stale integrations-side draft CTA to the queue by updating `frontend/src/components/Integrations/IngestionMonitor.tsx`.

## Expected Results
- AI draft notifications now land on an operational review hub instead of Settings.
- Staff users can review a pending AI draft, open a hydrated entity form, save the real record, and clear the draft from the queue.
- The old settings-side review entrypoint now forwards users to the operational queue instead of trapping them in Integrations.

## Acceptance Criteria
- Pending AI draft notifications route to `/my-tasks?tab=ai-review`.
- My Tasks exposes a visible AI review queue with actionable draft rows.
- Reviewing a draft opens a populated form and resolving the save removes it from the queue.

## Dependencies
- Existing `AIFeedbackLog` pending-review/resolve endpoints.
- Existing `EntityFormSurface` / `UniversalEntityForm` save flow.
- Existing `EmailReviewDraft` notification producer in `apps.integrations.signals`.

## Risks + Mitigations
- **Mixed legacy/new notification data:** mitigated with a serializer fallback that rewrites legacy settings URLs into the queue route.
- **Unsupported draft entity types:** mitigated by a modal fallback that still shows the parsed payload even when no supported form mapping exists.
- **Queue data drift:** mitigated by deriving queue metadata from the stored draft payload and linked `AIDocument`, not a parallel table.

## Testing Strategy
- `python backend/manage.py test backend.apps.integrations.test_email_review_drafts backend.tenant_apps.ai_assistant.tests.test_review_queue_api backend.tenant_apps.workflows.tests.test_user_notification_serializer`
- `npx vitest run src/components/AIAssistant/AIDraftReviewModal.test.tsx src/pages/MyTasks/MyTasks.aiReview.test.tsx src/components/Integrations/IngestionMonitor.test.tsx src/pages/Suppliers/PlantDetail.workflows.test.tsx`
- `npm run type-check`

## Rollback
- Revert the notification producer/serializer route normalization and remove the My Tasks AI review queue/modal additions.
- Draft data remains in `EmailReviewDraft` / `AIFeedbackLog`, so rollback is UI-routing safe and additive.
