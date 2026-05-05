# ADR 0003: Eradication of useQueries in dynamic form surfaces

- **Status:** Accepted
- **Date:** 2026-05-05

## Context

Dynamic form rendering paths accumulated `useQueries`, inline dependency arrays, and unstable object construction across render cycles. In the Plant edit incident and related DynamicFormEngine failures, these patterns multiplied request churn and contributed to React Error 185 business-continuity outages.

## Decision

Dynamic form surfaces must not use `useQueries` directly.

Instead:

1. Fetch dependent resources in a smart loader/container using stable memoized inputs.
2. Resolve concurrent requests with controlled orchestration such as `Promise.all` or equivalent service-layer batching outside the form surface.
3. Pass resolved values into the presentational form as stable props.
4. Keep `useEffect` dependency arrays referentially stable; do not pass fresh arrays or objects inline.

## Consequences

- Dynamic forms stay deterministic and mount only after data is ready.
- Query orchestration is easier to test and reason about at the page boundary.
- The AI PR gatekeeper can reject diffs that reintroduce `useQueries` into dynamic-form code paths.
