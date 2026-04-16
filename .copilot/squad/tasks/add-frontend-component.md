# Task: Add frontend component (React + TS + Tailwind/theme tokens)

## Purpose
Add a UI component that is **accessible**, **theme-compliant**, and **type-safe**, integrated via the approved service layer.

## Inputs
- UX requirement + target page/surface
- Data dependencies (API endpoints)
- Accessibility expectations

## Outputs
- New component(s) in `frontend/src/**`
- Typed props and state
- Tests (unit/e2e as appropriate)

## Step-by-step execution
1. **Confirm styling & API constraints**
   - Read: `.github/instructions/frontend.instructions.md`
   - Read: `docs/DESIGN_SYSTEM.md`
   - Use tokens / CSS variables (Tailwind config maps to CSS vars).
2. **Component implementation**
   - Functional components + strict TS.
   - Ensure keyboard navigation and ARIA labels where needed.
3. **Data access**
   - Use the repo’s service layer clients (do not bypass standardized clients).
4. **Performance**
   - Avoid unnecessary renders; use memoization intentionally.
5. **Tests**
   - Unit test for rendering and critical interactions.
   - If workflow-critical: add/extend Playwright tests.
6. **Validation**
   - `npm --prefix frontend run type-check`
   - `npm --prefix frontend run verify-standards`
   - `npm --prefix frontend run test:ci`

## Validation & tests (required)
- `npm --prefix frontend run type-check`
- `npm --prefix frontend run verify-standards`
- `npm --prefix frontend run test:ci`

## Risks & rollback
- Risk: hardcoded colors or styling regressions.
- Rollback: revert PR.

## Handoff checklist
- [ ] No hardcoded colors
- [ ] Uses approved API client/service layer
- [ ] Accessible interactions validated
