# ProjectMeats V3 — Architecture Overview (Golden Standard)

This document is the **handoff-quality** architecture reference for V3.0. It complements:
- `docs/ARCHITECTURE.md` (broader system design)
- `docs/GOLDEN_PIPELINE.md` (CI/CD + deployment invariants)
- `manifests/RLS_POLICIES.md` (authoritative RLS policy registry)

---

## 1) Multi‑Tenant Data Model (Shared Schema + RLS)

ProjectMeats uses **shared-schema multi-tenancy**:
- Business models in `backend/tenant_apps/**` inherit from `apps.core.models.TenantAwareModel`.
- Tenant isolation is enforced at **two layers**:
  1. **Application layer**: ViewSets filter by `tenant=request.tenant` (middleware resolves tenant).
  2. **Database layer (Defense in Depth)**: PostgreSQL **Row-Level Security** policies use the session var:
     `current_setting('app.current_tenant')::uuid`.

Key invariants:
- **Never** use django-tenants / schema switching.
- Any migration that creates a tenant-aware table must include an RLS policy (`RunSQL`).

See: `manifests/RLS_POLICIES.md`.

---

## 2) PM‑AS (ProjectMeats Autonomous Swarm)

PM‑AS is the AI “control plane” for document understanding, chat, and automation.

### 2.1 Request Flow (User Chat)
1. Frontend widget `AIAgentWidget` sends messages to the AI API (`/api/v1/ai-assistant/...`).
2. The backend resolves the active OpenAI model via `apps.system.services.ai_model_resolver`.
3. `SwarmOrchestrator` routes and executes a bounded tool loop:
   - Builds a system prompt with integration state (e.g., Outlook connected/expired)
   - Calls OpenAI Chat Completions
   - Optionally executes tools via `ToolExecutor` (bounded rounds)
   - Returns a final assistant response and trace

### 2.2 Abuse / Cost Guardrails
AI endpoints are protected with **DRF throttling**:
- Global anon/user throttles in settings
- Endpoint-scoped throttles for AI chat + feedback to limit billing attack surface

Primary files:
- `backend/tenant_apps/ai_assistant/swarm/router.py`
- `backend/tenant_apps/ai_assistant/views.py`

---

## 3) WorkForms Engine (React Flow → Executor)

WorkForms are represented as **React Flow graphs** (nodes + edges) and executed by a backend traversal engine.

### 3.1 Canvas + Node/Edge Contracts
- Frontend FlowEditor defines nodeTypes/edgeTypes and UI contracts (handles, configuration panels).
- Control-flow semantics (loop/error edges) are encoded into:
  - node `type`
  - edge `type`
  - edge `sourceHandle` / `targetHandle`

### 3.2 Execution Engine
- The backend executor traverses the graph deterministically.
- Loop nodes schedule bounded per-item sub-executions.
- Action nodes are wrapped in try/except; exceptions route via an outgoing `error` edge if present.

Primary files:
- `backend/apps/system/services/workform_engine.py`
- `backend/apps/system/tasks.py`

---

## 4) Frontend Service Layer

All frontend network calls go through centralized clients:
- `businessApi` for standard authenticated business endpoints
- `workformsApi` for WorkForms editor endpoints

This guarantees:
- consistent tenant header injection (`X-Tenant-ID`)
- consistent auth token handling / refresh
- centralized error mapping

---

## 5) Operational Golden Rules

- CI/CD uses the **Golden Pipeline** templates and patterns.
- Deployments use immutable image tags (`${env}-${sha}`) and `docker run` on target droplets.

See: `docs/GOLDEN_PIPELINE.md`.
