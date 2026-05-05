# ProjectMeats Manifests Directory

This directory contains the **single source of truth** for system configuration and state.

## Files

### `env.manifest.json`
Complete environment variable registry with GitHub secret mappings (Version 5.1)

### `GOLDEN_FILES.md` (This File)
Index of all authoritative sources for AI agents and developers

### `RLS_POLICIES.md`
PostgreSQL Row-Level Security policy registry (audit log; see file for latest counts)

### `ai_standards/`
AI prompt engineering standards and templates for consistent AI behavior

### `ai_standards/suggestion_engine_v1.prompt`
Golden template for workflow suggestion engine with meat industry context

## Golden File Registry

| Concern | Golden File | Authority |
|---------|-------------|-----------|
| **Environment Variables** | `/manifests/env.manifest.json` | AUTHORITATIVE |
| **API Contract (OpenAPI baseline)** | `/manifests/openapi/openapi-schema.baseline.json` | ENFORCEMENT (CI) |
| **Database Schema** | Django migrations | Applied state |
| **RLS Policies** | `/manifests/RLS_POLICIES.md` | Audit log |
| **CI/CD Standards** | `.github/workflows/reusable-deploy.yml` | Template |
| **Runtime Readiness Gate** | `backend/projectmeats/health.py`, `.github/workflows/reusable-deploy.yml` | ENFORCEMENT |
| **Rollback automation** | `.github/scripts/deployment-rollback.sh`, `docs/runbooks/INCIDENT_RESPONSE.md` | AUTHORITATIVE |
| **Disaster recovery** | `docs/runbooks/DISASTER_RECOVERY.md` | AUTHORITATIVE |
| **Business record retention** | `docs/runbooks/DATA_RETENTION.md`, `backend/apps/core/services/data_governance.py`, `backend/apps/core/management/commands/archive_historical_records.py` | AUTHORITATIVE |
| **Infrastructure desired state / IaC scaffold** | `deploy/terraform/README.md`, `deploy/terraform/*.tf` | AUTHORITATIVE scaffold |
| **Non-dev observability ownership** | `docs/GOLDEN_PIPELINE.md`, `docs/runbooks/INCIDENT_RESPONSE.md`, `manifests/env.manifest.json` | AUTHORITATIVE |
| **Architecture** | `docs/architecture/ARCHITECTURE.md` | Design doc |
| **Execution status / priorities** | `MASTER_PLAN.md` | CANONICAL |
| **Roadmaps** | `ROADMAP.md`, `UI_ROADMAP.md` | Reference-only unless promoted in `MASTER_PLAN.md` |
| **Incident response** | `docs/runbooks/INCIDENT_RESPONSE.md` | AUTHORITATIVE |
| **Copilot Squad Governance** | `.copilot/squad/squad.json` | AUTHORITATIVE |
| **Copilot Squad Roles** | `.copilot/squad/roles/*.md` | AUTHORITATIVE |
| **Copilot Squad Tasks** | `.copilot/squad/tasks/*.md` | AUTHORITATIVE |
| **Copilot Squad Validator** | `scripts/validate_copilot_squad.sh` | ENFORCEMENT |
| **Copilot Squad Wrapper** | `scripts/gh-copilot` | TOOLING |
| **Cockpit Continuous Browsing** | `frontend/src/components/Cockpit/SmartSearch.tsx` | Continuous search UX + navigation path updates |
| **Cockpit Navigation State** | `frontend/src/contexts/CockpitNavigationContext.tsx` | Breadcrumb/path source of truth |
| **FlowEditor Config Renderer** | `frontend/src/components/FlowEditor/ConfigPanel/DynamicConfigPanel.tsx` | Schema-driven node config UI (standard path) |
| **FlowEditor Config Schemas** | `frontend/src/components/FlowEditor/config/nodeConfigSchemas.ts` | Declarative config definitions per node type |
| **FlowEditor Config Types** | `frontend/src/components/FlowEditor/config/types.ts` | Schema field type system contract |
| **Smart Auto-Map** | `frontend/src/components/FlowEditor/utils/autoMappingService.ts` | Upstream variable inference + mapping suggestions |
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

## Infrastructure Connectivity (Quad Services Stack)

**Diagnostic Tool**: `scripts/infrastructure_diagnostics.py`  
**Management Command**: `python manage.py check_infrastructure`  
**Reference note**: Treat `manifests/env.manifest.json`, `docs/GOLDEN_PIPELINE.md`, and `docs/runbooks/INCIDENT_RESPONSE.md` as the source of truth for current non-dev Redis and Sentry expectations. This registry section defines the verification surfaces, not a static environment-status matrix.

| Service | Verification Surface | Purpose |
|---------|----------------------|---------|
| **Redis / Valkey** | `python manage.py check_infrastructure --require-redis-readiness`; `/api/v1/ready/` | Caching, channels, Celery broker, non-dev readiness gating |
| **OpenAI** | `python manage.py check_infrastructure`; `/api/v1/health/` integration summary | AI-powered workflow suggestions, parsing, and assistant services |
| **Sentry** | manifest-defined `SENTRY_ENABLED` / `SENTRY_DSN` contract plus `/api/v1/health/` review | Real-time error tracking, APM, performance monitoring |
| **Microsoft Graph** | `python manage.py check_infrastructure`; `/api/v1/health/` integration summary | Email ingestion, Outlook integration, OAuth authentication |

**Readiness Gate**: `/api/v1/health/` remains the broad liveness/integration surface, while backend deploy and smoke gates in non-dev must use `/api/v1/ready/`. For backend lanes, `/api/v1/ready/` now requires Redis/Valkey-backed cache and channels unless `REQUIRE_REDIS_READINESS` is explicitly disabled for that lane.

## Non-dev observability and rollback ownership

- **Backend lane owner**: validates `REDIS_URL` / `VALKEY_URL` readiness, backend `SENTRY_ENABLED` / `SENTRY_DSN` expectations, and `/api/v1/health/` integration summaries before traffic is reopened.
- **Frontend lane owner**: validates direct container health on `127.0.0.1:8080`, the deployed immutable frontend digest, and the shared `SENTRY_DSN` runtime pass-through contract.
- **Rollback drill source of truth**: use `.github/scripts/deployment-rollback.sh` for development and explicit immutable `BACKEND_IMAGE_REF` / `FRONTEND_IMAGE_REF` inputs for UAT/production, following `docs/runbooks/INCIDENT_RESPONSE.md`.

### Dev Environment Verification Summary (March 3, 2026)

**Infrastructure Status**: 🎉 **100% VERIFIED** (4/4 services operational)

#### ✅ Redis (Verified via PR #3397)
- **Broker**: Celery task queue operational
- **Cache**: 10-minute TTL for AI suggestions
- **Tasks**: `sync_tenant_emails` scheduled every 5 minutes
- **Beat Scheduler**: `django_celery_beat.schedulers:DatabaseScheduler` active
- **Evidence**: Email ingestion background tasks deployed and running

#### ✅ OpenAI (Verified via PR #3388)
- **Model**: gpt-4o-mini for cost-efficient suggestions
- **Integration**: `SuggestNodesView` API endpoint operational
- **Caching**: Redis-backed with ~90% cost reduction
- **Fallback**: Graceful degradation to static suggestions
- **Evidence**: AI suggestions panel deployed with loading states

#### ✅ Sentry (Verified via PR #3389)
- **DSN**: Initialized in Django settings
- **APM**: Application performance monitoring enabled
- **Sampling**: 10% transaction sampling (GDPR-compliant)
- **Session Replay**: Privacy-focused monitoring active
- **Evidence**: Error tracking infrastructure deployed

#### ✅ Microsoft Graph (Verified via PR #3391, #3396, #3397)
- **OAuth**: Token encryption service (Fernet + PBKDF2)
- **Email Ingestion**: `EmailLog` model with status workflow
- **API Integration**: Last 7 days, order keyword filtering
- **Monitoring UIs**: Dashboard widget + Settings page monitor
- **Evidence**: Email ingestion engine deployed and operational

**Run Diagnostics**:
```bash
# Via Management Command Workflow (recommended)
gh workflow run 99-ops-management-command.yml \
  -f environment=dev \
  -f command=check_infrastructure

# Via Ops Surgery Workflow (alternative)
gh workflow run 98-ops-db-surgery.yml \
  -f environment=dev-backend \
  -f type=shell \
  -f script="python scripts/infrastructure_diagnostics.py"

# Direct SSH execution (requires server access)
ssh user@dev.meatscentral.com \
  "docker exec pm-backend python manage.py check_infrastructure"
```

**Verification Criteria** (All Met for Dev Environment):
- ✅ **Redis**: Stores/retrieves test values, Celery beat scheduler operational
- ✅ **OpenAI**: API handshake successful, gpt-4o-mini model accessible
- ✅ **Sentry**: DSN initialized, error tracking middleware active
- ✅ **Microsoft Graph**: OAuth token encryption functional, email polling operational

**Last Audit**: February 28, 2026 (Microsoft Graph verified in dev environment)  
**Next Audit**: Scheduled after user configures remaining external services (Redis, OpenAI, Sentry)

## AI Agent Protocol

1. **Check this directory FIRST** before making assumptions
2. **Never guess** environment variable names - read `env.manifest.json`
3. **Never assume** RLS state - check `RLS_POLICIES.md`
4. **Always verify** before creating migrations

## See Also

- `.github/copilot-instructions.md` - AI development standards
- `docs/architecture/ARCHITECTURE.md` - System design
- `MASTER_PLAN.md` - Project roadmap (root-level authoritative copy)
