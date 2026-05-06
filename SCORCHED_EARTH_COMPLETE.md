# Scorched Earth Complete

## Deliverables
- Added `frontend/src/pages/Plants/StandalonePlantEditForm.tsx`, a clean-room Ant Design plant editor that uses a single `useQuery` for plant fetch and a single `useMutation` for save.
- Rewired `frontend/src/pages/Plants/PlantDetailView.tsx` so edit mode fully unmounts the detail view surface and mounts only the standalone editor.
- Hardened AI inbox websocket auth so JWTs are accepted from both `?access_token=` query params and websocket subprotocols, and the consumer now accepts the `pm.ai.inbox` subprotocol when requested.
- Added focused frontend/backend regression coverage for the standalone plant flow and the websocket handshake path.

## Expected Results
- Clicking **Edit Plant** no longer routes through the universal form engine and therefore avoids the React Error 185 loop class for this page.
- The AI inbox widget can authenticate more reliably in environments where either query params or websocket subprotocols are preferred during the handshake.

## Acceptance Criteria
- Plant edit mode mounts the standalone form and unmounts the inline detail surface.
- The standalone form loads plant data without `useQueries` and without `useEffect`-driven `form.setFieldsValue()` loops.
- Saving plant changes uses the approved frontend service layer and closes back to the detail view.
- AI inbox websocket auth succeeds when the JWT is supplied via query param or websocket subprotocol.

## Dependencies
- Existing plant REST endpoints exposed through `apiService`.
- Existing Channels JWT auth middleware and AI inbox consumer routing.
- Global React Query provider already present in the application shell.

## Risk Register
| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Plant schema drifts away from the standalone form fields | Medium | Medium | Keep the form mapped strictly to the current `Plant` service contract and cover it with focused tests. |
| Websocket handshake behavior differs across environments | Medium | High | Accept both query-param and subprotocol JWT transport paths, and cover the subprotocol path with backend tests. |
| Detail view shows stale data after save | Low | Medium | Edit mode fully unmounts; returning to detail remounts the view surface and fetch path. |

## Testing Strategy
- `cd backend && python manage.py test tenant_apps.ai_assistant.test_inbox_websocket tenant_apps.workflows.tests.test_collaboration_websocket_security --noinput`
- `cd frontend && npm run type-check`
- `cd frontend && npm run verify-standards`
- `cd frontend && npm run test:ci -- PlantDetailView StandalonePlantEditForm AIAgentWidget`

## Rollback Plan
- Revert the scorched-earth PR to restore the previous Plant detail/edit wiring and websocket handshake behavior.
- Because the change is frontend/component and middleware only, rollback is code-only and does not require schema or data migration.
