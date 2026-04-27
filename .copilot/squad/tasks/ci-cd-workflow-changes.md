# Task: Create CI/CD workflow changes (Golden Pipeline compliant)

## Purpose
Update GitHub Actions workflows without violating ProjectMeats’ **Golden Standard** deployment reliability.

## Inputs
- Desired workflow change
- Target environment lane(s) affected

## Outputs
- Updated workflow YAML with golden rules preserved
- Updated docs if behavior changes

## Step-by-step execution
0. **Relay → synthesize (Lead Engineer)**
   - After fleet agents complete, run a Lead Engineer synthesis pass to unify findings into one patch plan.
1. Read constraints:
   - `docs/GOLDEN_PIPELINE.md`
   - `.github/instructions/workflows.instructions.md`
2. Ensure:
   - remote deploy uses `docker run` (no docker-compose)
   - SHA-tagged images, no `:latest` in production
   - parallel frontend/backend swimlanes
   - migrations are runner-driven and idempotent (`--fake-initial`)
3. If secrets/env vars change:
   - update `manifests/env.manifest.json`
   - never echo secrets
4. Validate golden state:
   - `bash scripts/verify_golden_state.sh`

## Validation & tests (required)
- `bash scripts/verify_golden_state.sh`

## Risks & rollback
- Risk: broken deployments.
- Rollback: revert PR; redeploy last known good SHA.

## Handoff checklist
- [ ] Golden rules explicitly checked
- [ ] Rollback steps included
