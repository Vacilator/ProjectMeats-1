# ADR 0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-05-05

## Context

ProjectMeats relies on long-lived architectural constraints that are easy for new developers and fresh AI sessions to miss. Patterns such as the Air Gap component-swap and the Gordian Knot ban on `useQueries` inside dynamic form surfaces came from real production failures, but the rationale was living only in transient chat history and scattered docs.

## Decision

We will use Architecture Decision Records (ADRs) in `docs/adr/` for every major architectural rule or pattern change.

Each ADR must:

1. Describe the production context and failure mode that led to the decision.
2. State the final rule in imperative terms.
3. Capture the consequences, including tradeoffs and rollback constraints.
4. Link back to enforcement surfaces such as `.cursorrules`, `.github/SDLC_PROTOCOLS.md`, workflows, or validators when relevant.

ADR numbering is append-only and chronological. Existing ADRs are immutable except for narrowly scoped corrections that do not change the original decision.

## Consequences

- Future AI agents get stable rationale, not just current instructions.
- Architectural changes now require both implementation and durable documentation.
- Repo guardrails can validate the presence of ADRs and fail fast when the rationale ledger drifts.
