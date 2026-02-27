# ProjectMeats Manifests Directory

This directory contains the **single source of truth** for system configuration and state.

## Files

### `env.manifest.json`
Complete environment variable registry with GitHub secret mappings (Version 5.1)

### `GOLDEN_FILES.md` (This File)
Index of all authoritative sources for AI agents and developers

### `RLS_POLICIES.md`
PostgreSQL Row-Level Security policy registry (33 policies across 25 tables)

### `TECHNICAL_DEBT.md`
Tracking for models requiring RLS hardening (8/24 complete - all HIGH priority done)

## Golden File Registry

| Concern | Golden File | Authority |
|---------|-------------|-----------|
| **Environment Variables** | `/manifests/env.manifest.json` | AUTHORITATIVE |
| **Database Schema** | Django migrations | Applied state |
| **RLS Policies** | `/manifests/RLS_POLICIES.md` | Audit log |
| **CI/CD Standards** | `.github/workflows/reusable-deploy.yml` | Template |
| **Architecture** | `docs/ARCHITECTURE.md` | Design doc |
| **Phase Roadmap** | `.github/MASTER_PLAN.md` | Progress |

## AI Agent Protocol

1. **Check this directory FIRST** before making assumptions
2. **Never guess** environment variable names - read `env.manifest.json`
3. **Never assume** RLS state - check `RLS_POLICIES.md`
4. **Always verify** before creating migrations

## See Also

- `.github/copilot-instructions.md` - AI development standards
- `docs/ARCHITECTURE.md` - System design
- `.github/MASTER_PLAN.md` - Project roadmap
