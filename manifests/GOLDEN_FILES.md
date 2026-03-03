# ProjectMeats Manifests Directory

This directory contains the **single source of truth** for system configuration and state.

## Files

### `env.manifest.json`
Complete environment variable registry with GitHub secret mappings (Version 5.1)

### `GOLDEN_FILES.md` (This File)
Index of all authoritative sources for AI agents and developers

### `RLS_POLICIES.md`
PostgreSQL Row-Level Security policy registry (33 policies across 25 tables)

### `ai_standards/`
AI prompt engineering standards and templates for consistent AI behavior

### `ai_standards/suggestion_engine_v1.prompt`
Golden template for workflow suggestion engine with meat industry context

## Golden File Registry

| Concern | Golden File | Authority |
|---------|-------------|-----------|
| **Environment Variables** | `/manifests/env.manifest.json` | AUTHORITATIVE |
| **Database Schema** | Django migrations | Applied state |
| **RLS Policies** | `/manifests/RLS_POLICIES.md` | Audit log |
| **CI/CD Standards** | `.github/workflows/reusable-deploy.yml` | Template |
| **Architecture** | `docs/ARCHITECTURE.md` | Design doc |
| **Phase Roadmap** | `ROADMAP.md` + `MASTER_PLAN.md` | Progress |
| **AI Prompts** | `/manifests/ai_standards/` | Templates |

## Environment Structure (6-Lane System)

ProjectMeats uses **environment-scoped secrets** across 6 deployment lanes:

| Environment | Backend Lane | Frontend Lane | Purpose |
|-------------|--------------|---------------|---------|
| **Development** | `dev-backend` | `dev-frontend` | Active development, CI/CD testing |
| **UAT** | `uat-backend` | `uat-frontend` | Staging, pre-production validation |
| **Production** | `production-backend` | `production-frontend` | Live system, customer-facing |

**Key Principles**:
- Each lane has isolated GitHub Environment Secrets
- Secrets follow explicit mappings in `env.manifest.json`
- No shared secrets except `SSH_PASSWORD` (UAT/Prod only)
- All lanes accessible via `.github/workflows/98-ops-db-surgery.yml`

## Network Routing

**API Routing Standard**: The API is served via the `/api/v1` sub-path on the primary domain. **No separate API subdomains are used.**

**Examples**:
- Development: `https://dev.meatscentral.com/api/v1/`
- UAT: `https://uat.meatscentral.com/api/v1/`
- Production: `https://meatscentral.com/api/v1/`

**Implementation**:
- Frontend: Nginx proxies `/api/v1/*` to backend container (port 8000)
- Backend: Django serves all API endpoints under `/api/v1/` prefix
- OAuth: Redirect URIs use primary domain + `/api/v1/integrations/oauth/callback/`
- Configuration: `REACT_APP_API_BASE_URL` in `manifests/env.manifest.json`

## Infrastructure Connectivity (Trinity of Services)

**Diagnostic Tool**: `backend/scripts/infrastructure_diagnostics.py`

| Service | Dev Status | UAT Status | Prod Status | Purpose |
|---------|-----------|-----------|-------------|---------|
| **Redis** | ⏳ Pending Audit | ⏳ Not Configured | ⏳ Not Configured | Caching, real-time features, AI response caching |
| **OpenAI** | ⏳ Pending Audit | ⏳ Not Configured | ⏳ Not Configured | AI-powered workflow suggestions, field recommendations |
| **Sentry** | ⏳ Pending Audit | ⏳ Not Configured | ⏳ Not Configured | Real-time error tracking, APM, performance monitoring |
| **Microsoft Graph** | ✅ **Verified** | ⏳ Not Configured | ⏳ Not Configured | Email ingestion, Outlook integration, OAuth authentication |

**Status Definitions**:
- ✅ **Verified**: Connectivity test passed, service operational (multi-tenant isolation confirmed)
- ⏳ **Pending Audit**: Credentials configured, awaiting diagnostic run
- ⚠️ **Degraded**: Service reachable but with issues
- ❌ **Failed**: Connection failed or credentials invalid
- 🔒 **Not Configured**: Credentials not yet added to GitHub Secrets

**Run Diagnostics**:
```bash
# Via Ops Surgery Workflow (recommended)
gh workflow run 98-ops-db-surgery.yml \
  -f environment=dev-backend \
  -f type=shell \
  -f script="python scripts/infrastructure_diagnostics.py"

# Locally in Django shell
cd backend
python scripts/infrastructure_diagnostics.py
```

**Verification Criteria**:
- **Redis**: Successfully stores and retrieves test value with 30s TTL
- **OpenAI**: API handshake succeeds, model list returned
- **Sentry**: DSN loaded, test event captured
- **Microsoft Graph**: OAuth token encryption working, email ingestion service operational, multi-tenant isolation verified

**Last Audit**: February 28, 2026 (Microsoft Graph verified in dev environment)  
**Next Audit**: Scheduled after user configures remaining external services (Redis, OpenAI, Sentry)

## AI Agent Protocol

1. **Check this directory FIRST** before making assumptions
2. **Never guess** environment variable names - read `env.manifest.json`
3. **Never assume** RLS state - check `RLS_POLICIES.md`
4. **Always verify** before creating migrations

## See Also

- `.github/copilot-instructions.md` - AI development standards
- `docs/ARCHITECTURE.md` - System design
- `.github/MASTER_PLAN.md` - Project roadmap
