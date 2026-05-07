# TOOL_CONTRACT_AUDIT

## Deliverables + expected results
1. **Guaranteed tool resolution in `SwarmOrchestrator`**
   - Every assistant turn that contains `tool_calls` now receives a matching `role: "tool"` reply, even when `ToolExecutor.execute(...)` raises unexpectedly.
   - Loop-control and non-retryable warning messages are deferred until after the tool-response batch closes, keeping the OpenAI Chat Completions message contract valid.
2. **Replay-history sanitization**
   - Trailing unanswered assistant `tool_calls` are stripped from replayed history before the next OpenAI request.
   - Orphaned `tool` messages are dropped from replay history instead of being resent to OpenAI.
3. **Regression coverage**
   - Added swarm tests for:
     - unexpected tool execution exceptions,
     - trailing unanswered `tool_calls` replay sanitization,
     - legal ordering of deferred `system` warnings after `tool` replies.

## Acceptance criteria
1. A raised tool execution error no longer causes an OpenAI 400 about missing tool responses.
2. The next OpenAI round receives a contract-valid history with one `role: "tool"` message per `tool_call_id`.
3. Reloaded chat history cannot forward trailing unanswered assistant `tool_calls` back to OpenAI.
4. Fault injection demonstrates graceful assistant recovery text rather than a transport-level 400.

## Dependencies
1. Existing `ToolExecutor.execute(...)` structured error payloads remain the first-line tool failure shape.
2. All chat requests still flow through `SwarmOrchestrator.run_tool_loop(...)`, which is now the enforced contract boundary.

## Risk register + mitigations
1. **Over-sanitizing historical messages** (Medium x Medium)
   - Mitigation: only unresolved assistant `tool_calls` and orphaned `tool` replies are stripped; valid assistant/tool pairs are preserved.
2. **Warning guidance lost after deferral** (Low x Medium)
   - Mitigation: deferred `system` messages are still appended immediately after the tool batch, so the assistant still receives the non-retryable/loop guidance on the next round.
3. **Unexpected non-string tool payloads** (Low x Medium)
   - Mitigation: tool content is coerced to a transport-safe string before being appended.

## Testing strategy
1. `cd backend && source /venv/bin/activate && python manage.py test tenant_apps.ai_assistant.test_swarm_email_tools --keepdb --noinput`
2. `cd backend && source /venv/bin/activate && python manage.py test tenant_apps.ai_assistant --keepdb --noinput`
   - Result in this environment: the new tool-contract tests passed; the broader suite has one unrelated pre-existing environment failure because `openpyxl` is missing from the current runtime even though it is declared in repo dependencies.
3. `cd backend && source /venv/bin/activate && python manage.py makemigrations --check`

## Rollback / safe-change approach
1. Revert the router sanitizer + deferred-warning batch together if OpenAI replay behavior regresses.
2. Keep the regression tests in place so any future reimplementation of the tool loop must preserve the assistant/tool ordering contract.

## Fault injection result
- Simulated `fetch_emails` failure: `Exception("Simulated Outlook Crash")`
- Observed outcome: the router appended a `role: "tool"` failure message with the matching `tool_call_id`, then the next assistant turn recovered with:
  - `"I attempted to fetch your emails, but the Outlook integration encountered an error: Simulated Outlook Crash."`
- Observed non-outcome: no OpenAI 400 about missing tool messages.
