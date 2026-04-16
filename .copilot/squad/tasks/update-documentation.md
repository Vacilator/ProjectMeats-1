# Task: Update documentation (canonical alignment)

## Purpose
Update documentation while preserving **canonical truth hierarchy**.

## Inputs
- Change summary
- Which docs are affected

## Outputs
- Updated docs with correct authority labels

## Step-by-step execution
1. Confirm hierarchy:
   - `MASTER_PLAN.md` is canonical.
   - `ROADMAP.md` is reference-only unless explicitly promoted.
   - `.github/MASTER_PLAN.md` is append-only PR log.
2. Make updates with:
   - clear headings
   - minimal duplication
   - links to authoritative sources
3. Ensure commands are correct and copy-pastable.

## Validation
- Spell-check mentally; ensure links/paths exist.

## Risks & rollback
- Risk: contradictory status claims.
- Rollback: revert PR.

## Handoff checklist
- [ ] No contradictions with MASTER_PLAN
- [ ] Correct authority labels preserved
