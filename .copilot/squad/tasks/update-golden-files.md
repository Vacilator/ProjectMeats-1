# Task: Update Golden Files (registry + enforcement)

## Purpose
Update authoritative registries so future work stays consistent and discoverable.

## Inputs
- What changed (schema, env vars, CI, architecture)

## Outputs
- Updated `manifests/GOLDEN_FILES.md` and any other golden registries
- If needed: added enforcement mechanism (validation script/CI gate)

## Step-by-step execution
1. Identify the “golden” owner file(s) that must be updated.
2. Update `manifests/GOLDEN_FILES.md` with:
   - concern
   - golden file path
   - authority rationale
3. If an invariant was added/changed, add an enforcement mechanism:
   - script under `scripts/`
   - CI check (only if consistent with Golden Pipeline)
4. If env vars/secrets changed:
   - update `config/env.manifest.json` first
   - run `python config/manage_env.py audit`

## Validation
- `python config/manage_env.py audit` (when env vars involved)

## Risks & rollback
- Risk: drift between docs and reality.
- Rollback: revert PR.

## Handoff checklist
- [ ] Golden registry updated
- [ ] Enforcement added where appropriate
