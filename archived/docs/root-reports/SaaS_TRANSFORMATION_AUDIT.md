# SaaS Transformation Audit

## Deliverables

1. **Plant business-continuity escape hatch**
   - Added `frontend/src/pages/Plants/HardcodedPlantForm.tsx`.
   - Updated `frontend/src/pages/Plants/PlantDetailView.tsx` to swap into the static Ant Design plant form instead of opening the dynamic form engine for edits.
   - Removed the plant edit path from the local detail-page button flow so the edit action no longer depends on the unstable dynamic schema loop.

2. **AI Inbox operational hub**
   - Kept the existing draft-review modal flow and reframed `frontend/src/pages/MyTasks/MyTasks.tsx` around an **AI Inbox** tab.
   - Swapped the queue rendering to an AntD table with sender, detected intent, received time, and **Review & Save** actions.
   - Updated `frontend/src/components/AIAssistant/AIDraftReviewModal.tsx` copy to align with the inbox workflow.

3. **Ambient AI suggestion banner**
   - Added `frontend/src/components/AIAssistant/AmbientSuggestions.tsx`.
   - Injected it into `frontend/src/components/Cockpit/EntityProfileHeader.tsx`.
   - Extended `frontend/src/services/aiService.ts` and backend `tenant_apps.ai_assistant` APIs to support contextual suggestion requests.

4. **Autonomous inbox watchdog + realtime push**
   - Added a contextual suggestions API in `backend/tenant_apps/ai_assistant/views.py`, `serializers.py`, and `urls.py`.
   - Added AI inbox websocket plumbing with `backend/tenant_apps/ai_assistant/consumers.py`, `routing.py`, and `backend/projectmeats/asgi.py`.
   - Extended `backend/tenant_apps/ai_assistant/tasks/watchdog.py` to mirror pending `EmailReviewDraft` rows into `AIFeedbackLog` and broadcast inbox events.
   - Updated `backend/apps/integrations/tasks.py` so background inbox sync immediately refreshes the AI Inbox mirror after email polling.

## Expected results

- **Edit Plant** now renders a static, isolated form instead of hitting the dynamic render loop path.
- AI-generated review work lands in an operational **AI Inbox** instead of staying buried behind integrations settings.
- Record pages can surface lightweight **Ambient AI** next-best actions without opening the chat widget first.
- Background email sync can proactively populate AI review items and notify active users through websocket inbox events.

## Acceptance criteria

- Plant detail edit action swaps to the hardcoded form and no longer depends on the dynamic form engine.
- AI Inbox shows pending review items and opens the review modal from the table action.
- Contextual suggestion requests return structured suggestion payloads for supported entities.
- Background email sync mirrors pending drafts into `AIFeedbackLog` and emits websocket notification payloads for tenant users.

## Dependencies

- Existing AI draft review queue + modal shipped earlier in the session.
- Existing Channels middleware / tenant websocket auth in `backend/projectmeats/asgi.py`.
- Existing `EmailReviewDraft` creation path in `apps.integrations.signals`.

## Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Static plant form drifts from dynamic schema fields over time | Medium | Medium | Keep the form limited to the continuity-critical plant fields and document it as a deliberate escape hatch. |
| Ambient suggestions become noisy | Medium | Low | Current backend suggestions are conservative, heuristic, and capped to three actions. |
| AI inbox websocket messages reach the wrong audience | Low | High | Group names are tenant + user scoped and reuse authenticated tenant websocket middleware. |
| Duplicate AI feedback rows from repeated inbox sync | Low | Medium | Watchdog mirrors by `document_id=draft.id` and updates unresolved rows instead of duplicating them. |

## Testing strategy

- `source /venv/bin/activate && cd backend && python manage.py test apps.integrations.test_email_review_drafts tenant_apps.ai_assistant.tests.test_review_queue_api`
- `cd frontend && npx vitest run src/pages/MyTasks/MyTasks.aiReview.test.tsx src/pages/Plants/PlantDetailView.test.tsx src/components/AIAssistant/AmbientSuggestions.test.tsx src/components/AIAssistant/AIDraftReviewModal.test.tsx`
- `cd frontend && npm run type-check`

## Rollback

- Revert the branch to restore the routed plant edit flow, remove the ambient suggestion entry points, and fall back to the pre-existing AI draft queue without realtime inbox push.
