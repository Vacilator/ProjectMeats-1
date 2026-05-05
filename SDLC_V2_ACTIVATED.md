# SDLC V2 Activated

## Deliverables

1. **AI PR Gatekeeper**: `.github/workflows/ai-pr-reviewer.yml` plus `scripts/ci/ai_pr_guard.py` now review pull request diffs against `.cursorrules` and `.github/SDLC_PROTOCOLS.md`, request changes on hard-fail violations, and fail the workflow to block unsafe merges.
2. **Architecture Decision Records**: `docs/adr/0001-record-architecture-decisions.md`, `0002-the-air-gap-form-pattern.md`, and `0003-eradication-of-usequeries.md` now preserve the rationale behind the core frontend guardrails.
3. **Context Bundler**: `scripts/dev/bundle_ai_context.sh` plus `make ai-task` now package the next unchecked epic ticket, the Golden Schema digest, and `.cursorrules` into a paste-ready AI prompt.
4. **Never-miss-again guardrails**: `scripts/verify_golden_state.sh`, `manifests/GOLDEN_FILES.md`, `manifests/env.manifest.json`, `.github/workflows/README.md`, and `docs/guides/BRANCH_PROTECTION_SETUP.md` now register and verify the new enforcement surfaces.

## Acceptance criteria

- Pull requests to `development` and `main` receive an AI gate review that can request changes for Golden Rule violations.
- Major architectural changes now require ADRs in `docs/adr/`.
- `make ai-task` generates a context bundle that includes the next unchecked ticket, Golden Schema digest, and `.cursorrules`.

## Dependencies

- `.cursorrules`
- `.github/SDLC_PROTOCOLS.md`
- `.github/EPIC_TICKETS.md`
- `backend/apps/system/models/`
- `manifests/env.manifest.json`

## Risks and mitigations

- **AI reviewer secret availability**: the gatekeeper uses manifest-defined `OPENAI_API_KEY` and fails closed when it is unavailable.
- **PR review spam**: the reviewer reuses or dismisses its own marked reviews instead of endlessly stacking duplicates.
- **Context bundle size drift**: the bundler emits a schema digest rather than dumping the full model directory, while still pointing AI agents back to the canonical schema path.

## Testing strategy

- `bash scripts/verify_golden_state.sh`
- `bash .github/scripts/check_infrastructure.sh`
- `python config/manage_env.py audit`
- `make ai-task`

## Rollback

Revert `.github/workflows/ai-pr-reviewer.yml`, `scripts/ci/ai_pr_guard.py`, `scripts/dev/bundle_ai_context.sh`, the ADR directory additions, and the associated documentation and validator updates as one batch.
