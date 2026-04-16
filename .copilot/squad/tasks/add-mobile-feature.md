# Task: Add mobile feature (React Native + TypeScript)

## Purpose
Add a mobile screen/feature that is **type-safe**, reusable, and consistent with multi-tenant context.

## Inputs
- Feature requirement
- Navigation path and parameters
- API requirements

## Outputs
- New screen/component in `mobile/src/**`
- Navigation wiring (type-safe)
- Tests as appropriate

## Step-by-step execution
1. Read: `.github/instructions/mobile.instructions.md`
2. Implement screen as functional component with typed navigation/route.
3. Prefer shared utilities/types from `/shared` when applicable.
4. Ensure accessibility labels for interactive elements.
5. Validate:
   - `npm --prefix mobile run lint`
   - `npm --prefix mobile run test`

## Validation & tests (required)
- `npm --prefix mobile run lint`
- `npm --prefix mobile run test`

## Risks & rollback
- Risk: duplicated logic vs `/shared`.
- Rollback: revert PR.

## Handoff checklist
- [ ] Types strict (no new `any`)
- [ ] Navigation params typed
- [ ] Basic smoke steps documented
