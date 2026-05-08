> [!IMPORTANT]
> ARCHIVED (Historical)
>
> This document is retained for historical context only and is **not canonical**.
> The canonical source of truth for priorities and definitions of done is **/MASTER_PLAN.md**.
> Roadmaps in **/ROADMAP.md** and **/UI_ROADMAP.md** are reference-only unless promoted in MASTER_PLAN.

# V4.0 Autonomous AI Roadmap (Assistant → Agent)

**Status**: Vision / Architecture Plan (no code)

## Goal
Move from “AI suggests” to “AI executes recurring operational tasks” with a strict Human‑in‑the‑Loop (HITL) approval layer.

## Existing foundation to leverage
- Celery task execution + scheduling
- Tenant audit trails (immutable history)
- Tenant outbound webhooks + API keys (PR #4306) for notifying external systems

## Core concepts
### 1) Agent Tasks (recurring)
Examples:
- Follow up on overdue POs
- Notify customers of shipment delays
- Reconcile invoices with discrepancies

### 2) Agent Runs
Each run produces **Proposed Actions**; nothing destructive happens without approval unless explicitly configured.

### 3) Human‑in‑the‑Loop dashboard
- Daily inbox of proposals
- Approve / reject / edit
- Audit every decision

## Proposed backend models
- `AgentTask` (tenant, name, schedule, scope, policy)
- `AgentRun` (task, started_at, status, logs)
- `ProposedAction` (run, action_type, payload, risk_level)
- `ActionApproval` (who approved, when, notes)

## Execution pipeline
1. Trigger (schedule/event)
2. Gather context (tenant data)
3. Plan actions (LLM)
4. Render proposals (UI)
5. On approval → enqueue Celery execution
6. Emit tenant webhooks for external stakeholders

## Safety guarantees
- Tenant isolation: always filter by `tenant=request.tenant` and rely on RLS
- Approval required for:
  - outbound emails
  - status transitions
  - financial mutations
- Rate limits + kill switch per tenant

## Frontend
- `AI Approvals` page in Settings / Admin
- Per proposal: show “why”, “what will change”, rollback path

## Definition of Done
- A single recurring task can run end‑to‑end with:
  - proposals
  - approval
  - execution
  - audit log entry
  - webhook notification
