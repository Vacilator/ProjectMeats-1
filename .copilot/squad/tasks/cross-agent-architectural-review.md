# Task: Cross-agent architectural review (enterprise gate)

## Purpose
Run a structured, cross-functional review before landing risky or cross-cutting changes.

## Inputs
- PR diff (or proposed change plan)
- Affected domains (backend/frontend/mobile/devops)

## Outputs
- Review report including:
  - deliverables + expected results
  - acceptance criteria
  - dependencies
  - risk register + mitigations
  - testing strategy
  - rollback plan

## Step-by-step execution
1. Architect reviews golden invariant compliance.
2. Lead Engineer reviews cross-layer cohesion.
3. Domain leads review within their domain.
4. Tester verifies acceptance criteria + test plan.
5. Documentation Steward confirms canonical docs alignment.
6. Project Manager confirms scope and user value.

## Validation
- Ensure all blocking rules are satisfied per `squad.json`.

## Risks & rollback
- Risk: process overhead.
- Mitigation: limit to high-risk changes and keep report concise.

## Handoff checklist
- [ ] All required reviewers provided sign-off
- [ ] Clear go/no-go decision recorded
