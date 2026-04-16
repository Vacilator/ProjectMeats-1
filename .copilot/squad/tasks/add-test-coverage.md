# Task: Add test coverage (high-signal, stable)

## Purpose
Add automated tests that prevent regressions without flakiness.

## Inputs
- Target behavior and acceptance criteria
- Where the defect/regression could occur

## Outputs
- New/updated tests in the relevant layer:
  - backend: Django/DRF tests
  - frontend: Vitest + RTL tests
  - e2e: Playwright
  - mobile: Jest

## Step-by-step execution
1. Write acceptance criteria first (Given/When/Then).
2. Choose minimal test level that catches regression.
3. Prefer deterministic assertions.
4. Run relevant suite(s) only; expand if risk is high.

## Validation
- Backend: `cd backend && python manage.py test`
- Frontend: `npm --prefix frontend run test:ci`
- E2E: `npm --prefix frontend run test:e2e`
- Mobile: `npm --prefix mobile run test`

## Risks & rollback
- Risk: flaky tests create delivery drag.
- Rollback: revert test-only changes if necessary.

## Handoff checklist
- [ ] Tests are deterministic
- [ ] Repro steps documented
