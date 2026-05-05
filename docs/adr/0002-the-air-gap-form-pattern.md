# ADR 0002: The Air Gap form pattern

- **Status:** Accepted
- **Date:** 2026-05-05

## Context

Complex edit flows in Cockpit and entity detail pages hit catastrophic React runtime failures, including Error 185 and max-update-depth loops, when large or schema-driven forms were mounted inside Ant Design `<Modal>` containers. The modal lifecycle amplified mount/unmount churn, loader races, and unstable query identities, especially for high-field-count and dynamic-schema surfaces.

## Decision

ProjectMeats will not place complex forms directly inside Ant Design `<Modal>` containers.

For forms with more than 10 fields, schema-driven rendering, or high-churn data dependencies, we must use the **Air Gap** pattern:

1. Resolve data in a stable loader/container boundary.
2. Swap the page or panel body to a dedicated form component.
3. Keep the form surface presentational and fed by stable props.
4. Delete the obsolete modal implementation instead of leaving commented code behind.

## Consequences

- We trade a smaller modal UX for predictable render lifecycles and safer form orchestration.
- The rule is enforced through `.cursorrules`, the AI PR gatekeeper, and future ADRs.
- Rollback means restoring the last known-good component-swap flow, not reintroducing modal-mounted complex forms.
