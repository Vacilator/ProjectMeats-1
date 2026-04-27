# ProjectMeats Development Roadmap (Reference)

**Authority:** This is **REFERENCE ONLY**. It is not maintained as a source of current truth.

For current priorities, status, and evidence, see **`MASTER_PLAN.md` (canonical)**.

**Copilot Squad (repo governance):** `.copilot/squad/README.md` documents the enterprise squad roles + reusable tasks for this repo.

---

## 🔎 Discovery Backlog (last refreshed 2026-04-27)

This is a lightweight pointer list from squad discovery. **Execute via `MASTER_PLAN.md` (canonical) + `.github/MASTER_PLAN.md` (PR log)**.

- P0 Security/RLS correctness:
  - Fix cross-tenant exposure risk in `apps/system` config/choice endpoints (remove `is_staff` global bypass; tenant admins are `is_staff=True`).
  - Make invitation email Celery task tenant/RLS safe (pass tenant_id; wrap task ORM in tenant_rls).
  - Workflow webhooks RLS ordering + legacy endpoint fail-closed; integrations OAuth callback RLS ordering; prevent WorkForms activation bypass on create.
- P0 CI hardening:
  - Default deploy-by-digest for UAT/Prod and digest-align migrations.
  - Manifest-driven required secrets gate per lane; docs drift lint for Golden migration rules.
- P0 Frontend standards/a11y:
  - Remove remaining FlowEditor/WorkForms named colors (white/black) and replace console.* with logger.*.
  - Make WorkForms cards/modals keyboard accessible (semantic controls + dialog semantics/focus).
- P1 Mobile parity:
  - Fix switch-tenant persistence; normalize errors; define auth expiry/401 behavior.

---

## 📊 Overall Progress (historical; non-canonical)

This file previously displayed “100% complete” progress claims. Those claims are **not authoritative** and are intentionally not treated as current status.

If any statement here conflicts with `MASTER_PLAN.md`, treat this file as outdated/historical context.

---

## Phase Status Overview (historical)

This table is preserved for context. Phase completion is not tracked here anymore.

| Phase | Focus Area |
|-------|------------|
| Phase 1 | UI/UX Enhancement |
| Phase 2 | AI-Powered Forms |
| Phase 3 | Search Intelligence |
| Phase 4 | Admin Management |
| Phase 5 | Integrations |
| Phase 6 | Security & Performance |
| Phase 7 | Workform Editor |
| Phase 8 | Caching & Parallelization |
| Phase 9 | Security Scanning & SBOM |

---

## 🎯 Phase 7: Intelligent Workform Editor (Historical summary)

**Status:** Historical notes only (verify current status in `MASTER_PLAN.md` / `.github/MASTER_PLAN.md`).

### Completed Features ✅

- **7.1** AI-Powered Field Suggestions **[100% COMPLETE]** ✨
  - OpenAI integration with gpt-4o-mini (PR #3388)
  - Redis caching (10-min TTL, ~90% cost reduction) (PR #3388)
  - Enhanced AISuggestionsPanel with loading states (PR #3388)
  - Graceful degradation to static suggestions (PR #3388)
  - 8 unit tests for connectivity validation (PR #3388)
  - Infrastructure diagnostics tool (197 lines) (PR #3388)
  - Management command: `python manage.py check_infrastructure` (commit 7c105fb0)
  - **Note**: Awaits OpenAI API key in UAT/Production (code is production-ready)

- **7.2** Enhanced Drag-and-Drop **[100% COMPLETE]**
  - Smart grid snapping with animations (PR #3309, #3342)
  - Container styling utilities (PR #3343)
  - Magnetic drag-and-drop hook (PR #3344)
  - Snap preview overlay (PR #3345)
  - 1,315 lines, 34 unit tests

- **7.3** Real-Time Collaboration **[100% COMPLETE]** (PR #3412)
  - Redis pub/sub messaging for live updates
  - Multi-user presence indicators
  - Conflict resolution strategies
  - Activity audit trail

- **7.4** Advanced Node Types **[100% COMPLETE]**
  - Conditional branching with 11 operators (PR #3346)
  - Loop constructs: for-each, while, for-range (PR #3346)
  - Parallel execution paths (existing)
  - 797 lines, theme-compliant

- **7.5** Performance Optimization **[100% COMPLETE]**
  - Viewport virtualization for 1000+ nodes (PR #3347)
  - Real-time FPS/memory monitoring (PR #3347)
  - Optimistic updates with auto-save (PR #3347)
  - Performance overlay component (PR #3347)
  - 1,384 lines, 40 unit tests
  - **10x faster rendering, 60fps sustained**

- **7.6** Accessibility & i18n **[100% COMPLETE]**
  - Keyboard navigation (arrows, Tab, Enter, vim) (PR #3348)
  - Screen reader support with ARIA live regions (PR #3348)
  - Focus management for modals (PR #3348)
  - WCAG 2.1 AAA compliant (PR #3348)
  - Internationalization rollout complete (en/es/fr + RTL + locale formatting)
  - Follow-up improvements tracked: #3586–#3592
  - 802 lines, fully accessible

**Development Principles** (all upheld throughout):
- ✅ Additive-Only Changes (never break existing workflows)
- ✅ Multi-Tenant Safety (works across all tenants)
- ✅ Performance First (profile before optimizing)

---

## 🔐 Phase 6: Security & Performance (Historical summary)

**Status:** Historical notes only (verify current status in `MASTER_PLAN.md` / `.github/MASTER_PLAN.md`).

### Delivered Features ✅

- **6.2** Security Hardening (OWASP Top 10, 85% coverage) - **DEPLOYED**
- **6.3** E2E Test Coverage (31 Playwright tests, 5 browsers) - **DEPLOYED**
- **6.4** Sentry Integration (Error tracking, APM, Session Replay) - **DEPLOYED** ✨ NEW
- **6.5** Frontend Optimization (performance utilities) - **DEPLOYED**
- **6.6** Load Testing (Locust framework, 3 profiles) - **DEPLOYED**
- **6.7** RLS Audit (38 tenant-aware models; 45 tables with tenant isolation; 48 isolation policies) - **DEPLOYED**
- **6.8** Workflow Execution Engine (6 action types, production-ready) - **DEPLOYED** Feb 28

### Phase 6 Achievements

- 🔒 **100% HIGH Priority Data Protected** (17/17 workflow models with RLS)
- ✅ Database-level tenant isolation enforced
- ✅ Performance monitoring infrastructure in place
- ✅ **Real-time error tracking with Sentry** (PR #3389)
- ✅ Workflow actions now execute (not just log)
- ✅ 31 E2E tests across 5 browsers
- ✅ Load testing framework operational
- ✅ **Privacy-compliant error monitoring** (GDPR, 10% sampling)

---

## ✅ Recently Completed Phases (Mar 2026)

### Phase 2: AI-Powered Forms & Workflows ✅ [100% COMPLETE]

**Status**: Complete  
**Completion Date**: March 3, 2026

#### Completed Features ✅

- **2.1** AI Field Suggestions **[100% COMPLETE]** (PR #3388)
  - OpenAI integration with gpt-4o-mini
  - Redis caching (10-min TTL, ~90% cost reduction)
  - Enhanced AISuggestionsPanel with loading states
  - Graceful degradation to static suggestions

- **2.2** Template Library **[100% COMPLETE]** (PR #3408)
  - Management command: `seed_industry_templates`
  - 2 pre-built templates (Beef Purchase, Credit Check)
  - `is_system_template` flag on TenantForm model
  - Industry Templates tab in Catalog UI

- **2.3** Entity Cascading **[100% COMPLETE]** (PR #3409)
  - Cascading field relationships (parent → child)
  - CascadingFieldService with dynamic model filtering
  - API endpoint: `/form-fields/{id}/cascade-options/`
  - useCascadingField hook with auto-refresh

- **2.4** Form Version Control **[100% COMPLETE]** (PR #3410)
  - TenantFormVersion model with snapshot storage
  - FormVersionService: snapshot/rollback/diff/history
  - 5 API endpoints for versioning operations
  - useFormVersioning hook for frontend

- **2.5** Enhanced Inheritance **[100% COMPLETE]** (PR #3411)
  - Field inheritance with type validation
  - FieldInheritanceService with computed validation
  - 3 API endpoints for validation operations
  - useFieldValidation hook with local + server validation

**Key Files**:
- `backend/tenant_apps/workflows/services/cascading.py`
- `backend/tenant_apps/workflows/services/versioning.py`
- `backend/tenant_apps/workflows/services/inheritance.py`
- `frontend/src/hooks/useCascadingField.ts`
- `frontend/src/hooks/useFormVersioning.ts`
- `frontend/src/hooks/useFieldValidation.ts`

---

### Phase 3: Search Intelligence ✅ [100% COMPLETE]

**Status**: Complete  
**Completion Date**: March 3, 2026

#### Completed Features ✅ (PR #3412)

- **3.1** Mind-Map Visualizations
  - react-flow integration for visual search results
  - Entity relationship mapping

- **3.2** Real-Time Search Updates
  - WebSocket-based live updates
  - Redis pub/sub for cross-tenant notifications

- **3.3** NLP Query Refinement
  - Natural language processing for search queries
  - Intelligent query expansion and correction

- **3.4** Continuous Search
  - Suggestions as you type (300ms debounce)
  - 10-minute TTL Redis caching
  - SearchIntelligenceService with multi-entity support
  - ContinuousSearch components (input + suggestions dropdown)

**Key Files**:
- `backend/tenant_apps/search/services.py` - SearchIntelligenceService
- `frontend/src/components/Search/ContinuousSearch.tsx`
- `frontend/src/hooks/useContinuousSearch.ts`

---

### Phase 7.3: Real-Time Collaboration ✅ [100% COMPLETE]

**Status**: Complete  
**Completion Date**: March 3, 2026

#### Completed Features ✅ (PR #3413)

- **Distributed Node Locking**
  - WorkflowLockManager with Redis backend
  - 60-second TTL locks with auto-renewal
  - User ownership tracking
  - Heartbeat mechanism (30-second intervals)
  - useNodeLocking hook with auto-cleanup

**Key Files**:
- `backend/tenant_apps/workflows/services/locking.py`
- `frontend/src/hooks/useNodeLocking.ts`

---

### Phase 8: Caching & Parallelization ✅ [100% COMPLETE]

**Status**: Complete  
**Completion Date**: March 3, 2026

#### Completed Features ✅ (PR #3414)

- **8.1** Redis Query Result Caching
  - CacheService with 10-minute TTL
  - Deterministic cache key generation
  - Pattern-based invalidation support
  - useCachedQuery hook with refresh

- **8.2** CDN Integration for Static Assets
  - CDNMiddleware for URL rewriting
  - StaticFileCacheHeadersMiddleware (1-hour cache)
  - DigitalOcean Spaces configuration ready

- **8.3** Parallel Task Execution
  - ParallelExecutor with ThreadPoolExecutor
  - Max 10 concurrent workers
  - Execute with caching support
  - useParallelCachedQueries hook

- **8.4** Background Job Processing
  - Celery tasks: cache_workflow_data, parallel_tenant_sync, batch_export_workflows
  - Group/chord patterns for map-reduce
  - useBackgroundTask hook with polling
  - useBatchBackgroundTasks for bulk operations

- **8.5** Edge Caching Strategies
  - Cache-Control headers for static files
  - CDN configuration for DigitalOcean Spaces
  - Public asset caching (1-hour TTL)

**Key Files**:
- `backend/apps/core/caching.py` - CacheService, ParallelExecutor
- `backend/apps/core/cdn.py` - CDN middleware
- `backend/apps/core/tasks.py` - Celery background tasks
- `frontend/src/hooks/useCachedQuery.ts`
- `frontend/src/hooks/useBackgroundTask.ts`

---

### Phase 9: Security Scanning & SBOM ✅ [100% COMPLETE]

**Status**: Complete  
**Completion Date**: March 3, 2026

#### Completed Features ✅ (PR #3415, #3416)

- **9.1** Security Headers & Middleware
  - SecurityHardeningMiddleware with strict CSP policies
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - Permissions-Policy for camera, microphone, geolocation
  - RateLimitMiddleware for auth endpoints (10 req/min)
  - Integrated into MIDDLEWARE stack in settings/base.py

- **9.2** Automated Dependency Scanning CI
  - Workflow: `.github/workflows/21-security-scan.yml`
  - Python: safety (dependency vulnerabilities) + bandit (code security)
  - JavaScript: npm audit (frontend dependencies)
  - Docker: Trivy container image scanning
  - Runs on: PRs, pushes, daily schedule (3 AM UTC)

- **9.3** RLS Policy Audit Tool
  - Management command: `audit_rls_compliance`
  - Validates all TenantAwareModel descendants have RLS policies
  - Reports missing policies with table names
  - Color-coded output: ✓ PASS / ✗ MISSING
  - Usage: `python manage.py audit_rls_compliance`

- **9.4** SBOM Generation
  - Management command: `generate_sbom`
  - Creates JSON SBOM (Software Bill of Materials)
  - Lists all Python packages with versions, licenses
  - Includes security vulnerabilities via safety-db
  - Output: `sbom.json` with timestamp
  - Usage: `python manage.py generate_sbom`

**Key Files**:
- `backend/apps/core/middleware/hardening.py` - Security middleware (CSP, rate limiting)
- `.github/workflows/21-security-scan.yml` - Automated security scanning
- `backend/apps/core/management/commands/audit_rls_compliance.py` - RLS audit tool
- `backend/apps/core/management/commands/generate_sbom.py` - SBOM generator

**Security Improvements**:
- 🔒 Content Security Policy blocks XSS attacks
- 🚫 Rate limiting prevents brute-force attacks
- ✅ Automated vulnerability detection in CI/CD
- 📋 Software supply chain transparency (SBOM)
- 🔐 Database-level tenant isolation verified

---

## 🔒 Blocked Phases (Awaiting External Dependencies)

### Phase 5: Integrations ✅ [100% COMPLETE]

**Status**: Complete  
**Completion Date**: February 28, 2026

#### Completed Features ✅

- **5.1** Microsoft OAuth Integration **[100% COMPLETE]**
  - OAuth2 utilities with `/api/v1` sub-path routing
  - Token encryption service (Fernet + PBKDF2)
  - Microsoft Graph provider with redirect URI resolver
  - Secure token storage (encrypted access/refresh tokens)
  - Configuration: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID

- **5.2** API Routing Alignment **[100% COMPLETE]**
  - Migrated from subdomain to `/api/v1` sub-path pattern
  - Updated environment manifest with new base URLs
  - Network routing documentation in GOLDEN_FILES.md
  - Nginx configuration verified for `/api/` proxy

- **5.5** Email Ingestion Engine **[100% COMPLETE]**
  - EmailLog model with status workflow (logged → ai_parsing → order_created/failed/ignored)
  - EmailIngestionService with multi-tenant polling
  - Microsoft Graph API integration (last 7 days, order keywords)
  - Duplicate prevention via unique message_id constraint
  - AI extraction signal handler (auto-triggers on new EmailLog)

- **5.6** Background Processing & Monitoring **[100% COMPLETE]**
  - Celery tasks: sync_tenant_emails (5-min schedule), sync_single_tenant (manual)
  - Celery app configuration with Redis broker and beat scheduler
  - API endpoints: POST /email/sync/, GET /email/logs/
  - IngestionMonitor frontend component (AntD List, status tags, sync button)
  - Integrated into IntegrationsSection (shows if Microsoft connected)

- **5.7** Monitoring UIs & Node Integration **[100% COMPLETE]**
  - EmailIngestionMonitorWidget for Cockpit Dashboard (compact 5-email view)
  - Integrated widget into CockpitDashboard catalog (Integrations category)
  - OutlookEmailNode activation check (verifies MICROSOFT_CLIENT_ID env var)
  - GOLDEN_FILES.md updated: Microsoft Graph marked as ✅ Verified in dev

- **5.8** Infrastructure Diagnostics **[100% COMPLETE]**
  - `check_infrastructure` management command (commit 7c105fb0)
  - Tests OpenAI, Redis, and Sentry connectivity
  - Colored status output for easy visual scanning
  - Usage: `docker exec pm-backend python manage.py check_infrastructure`

**Key Files**:
- `backend/apps/integrations/microsoft/utils.py` - OAuth utilities
- `backend/apps/integrations/microsoft/encryption.py` - Token encryption
- `backend/apps/integrations/providers/microsoft.py` - Graph API provider
- `backend/apps/integrations/models.py` - EmailLog model
- `backend/apps/integrations/signals.py` - AI extraction hook
- `backend/apps/integrations/tasks.py` - Celery background tasks
- `backend/projectmeats/celery.py` - Celery app configuration
- `backend/apps/core/management/commands/check_infrastructure.py` - Infrastructure diagnostics
- `backend/tenant_apps/workflows/nodes/outlook_email.py` - Outlook email node with activation check
- `frontend/src/components/Integrations/IngestionMonitor.tsx` - Monitoring UI (Settings page)
- `frontend/src/components/Widgets/EmailIngestionMonitorWidget.tsx` - Dashboard widget
- `manifests/env.manifest.json` - Microsoft secrets configuration

**Deployment Requirements**:
1. Create migrations: `python manage.py makemigrations && python manage.py migrate`
2. Start Celery workers: `celery -A projectmeats worker --loglevel=info`
3. Start Celery beat: `celery -A projectmeats beat --scheduler django_celery_beat.schedulers:DatabaseScheduler`
4. Configure REDIS_URL environment variable
5. Register Microsoft Azure AD application for production secrets

---

## 📈 Deliverables Summary

### PRs Merged (Recent)

- ✅ **PR #3336**: Hotfix - Settings env() fix
- ✅ **PR #3337**: Sentry SDK implementation
- ✅ **PR #3338**: Microsoft OAuth scaffolding
- ✅ **PR #3334**: OpenAI + Redis wiring
- ✅ **PR #3333**: Security compliance audit
- ✅ **PR #3332**: Ops tooling hardening

### Infrastructure Status

**Turnkey System**: When external secrets are added to GitHub, the following features will activate instantly with zero code changes:

- 🔐 **Sentry APM**: Real-time error tracking and performance monitoring
- 🤖 **OpenAI**: AI-powered field suggestions and NLP
- ⚡ **Redis**: Caching, real-time updates, session management
- 🔗 **Microsoft OAuth**: Outlook/365 integration

---

## 📋 Technical Debt Status

### RLS Hardening Progress

| Priority | Complete | Remaining | Progress |
|----------|----------|-----------|----------|
| **HIGH** | 8/8 | 0 | `[████████████████████] 100%` |
| **MEDIUM** | 12/12 | 0 | `[████████████████████] 100%` |
| **LOW** | 4/4 | 0 | `[████████████████████] 100%` |
| **TOTAL** | **24/24** | **0** | `[████████████████████] 100%` |

**Latest Audit (2026-03-22)**: `python manage.py audit_rls_compliance` → **38/38 models compliant** ✅

---

## 🎯 Next Milestones

### Q1 2026 (Completed)
- [x] Complete Phase 6 infrastructure wiring
- [x] Phase 7.2: Enhanced Drag-and-Drop
- [x] Phase 7.3: Real-time collaboration (Redis-based locking)
- [x] Phase 7.4: Advanced Node Types (conditionals, loops)
- [x] Phase 7.5: Performance Optimization (virtualization)
- [x] Phase 7.6: Accessibility & Keyboard Navigation
- [x] Phase 2: AI-powered forms (OpenAI integration, templates)
- [x] Phase 3: Search intelligence (NLP, real-time updates)
- [x] Phase 8: Caching & parallelization (Redis, CDN, Celery)
- [x] Phase 9: Security scanning & SBOM

### Q2 2026 (Upcoming)
- [x] Phase 7.6: Complete i18n rollout – hooks integrated into Workform Editor, Cockpit, WorkForms; mobile (React Native) parity achieved (en/es/fr, RTL-ready)
- [ ] Production deployment of all features
- [ ] **External service credentials** – all code is production-ready; the following secrets must be configured in UAT/Production GitHub Environments to activate each feature:
  - `OPENAI_API_KEY` → activates AI field suggestions (gpt-4o-mini, graceful fallback already live)
  - `SENTRY_DSN` → activates real-time error tracking and APM
  - `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID` → activates Outlook/365 email ingestion
  - `REDIS_URL` → activates caching, Celery workers, and real-time collaboration in UAT/Prod
- [x] RLS policy completion for MEDIUM/LOW priority tables (tracked in #3588)

---

## 🤖 AI Integration Preparation (February 28, 2026)

**Status**: ✅ Complete - Ready for OpenAI Key

### What Was Built

**1. AI Manifest Standards** (PR #3379)
- Golden prompt template: `/manifests/ai_standards/suggestion_engine_v1.prompt`
- Prompter service: `backend/tenant_apps/workflows/services/prompter.py`
- System role: "Meat Industry Workflow Architect"
- JSON schema for 8 node types, max 3 suggestions constraint
- Unit tests for template loading and context injection

**2. AI Graceful Degradation** (PR #3380)
- `SuggestNodesView` API endpoint with error handling
- Catches: missing API key, network failures, OpenAI errors
- Returns static fallback suggestions by tenant industry type
- Frontend: `AISuggestionBadge` component (green=AI, yellow=static)

**3. Repository Consolidation** (PR #3381)
- Moved `.github/MASTER_PLAN.md` → `MASTER_PLAN.md` (root)
- Updated `README.md` with Quick Links section  
- Enhanced `copilot-instructions.md` with AI agent rules

### Plug-and-Play Activation

When `OPENAI_API_KEY` is added: AI suggestions activate instantly, Badge: yellow → green, Confidence: 0.0 → 0.85-0.95

---

## 📚 Related Documentation

- **Master Plan (canonical)**: `MASTER_PLAN.md`
- **PR execution log (append-only)**: `.github/MASTER_PLAN.md`
- **Architecture**: `docs/architecture/ARCHITECTURE.md`
- **AI Instructions**: `.github/copilot-instructions.md`
- **Golden Files**: `/manifests/GOLDEN_FILES.md`
- **Security Compliance**: `/manifests/RLS_POLICIES.md`

---

## 🏗️ Repository Consolidation & Infrastructure (100% Complete)

**Status**: ✅ Complete (February 27, 2026)

### Golden Audit & Hardening (3 PRs)

1. **Golden Audit Script** (PR #3376)
   - Automated SSH/DB connectivity testing (6 environment lanes)
   - Workflow integration with `98-ops-db-surgery.yml`
   - Color-coded reporting with pass/fail status
   - Usage: `./scripts/golden-audit.sh`

2. **PR Template with Migration/RLS Checklist** (PR #3376)
   - Mandatory Migration Verification section
   - Row-Level Security (RLS) Impact Assessment
   - Multi-tenancy compliance checks
   - Theme/styling standards enforcement
   - Accessibility (WCAG 2.1 AA) checklist
   - Security review requirements

3. **Component Audit & Dead Code Removal** (PR #3377)
   - Analyzed 9 admin-studio components
   - Removed unused Input.tsx (0 imports)
   - Verified component organization is correct
   - No components require moving to /shared

### Manifests Directory (Already Complete)

✅ `/manifests` - Single source of truth  
✅ `GOLDEN_FILES.md` - Authoritative file registry  
✅ `RLS_POLICIES.md` - 38 tenant-aware models compliant; 45 tables with tenant isolation; 48 isolation policies  
✅ `env.manifest.json` - Environment variable registry  
✅ `CODEOWNERS` - Review enforcement for critical paths

### Impact

- **Prevents**: Migration-related deployment failures, cross-tenant leaks
- **Enforces**: Zero Tolerance RLS, security-first practices
- **Standardizes**: PR quality, architectural consistency
- **Validates**: SSH connectivity across all environment lanes

---

**Legend**:
- ✅ Complete | 🚀 Active | ⏳ Planned | 🔒 Blocked | 🎯 Primary Focus

**Progress Bar Scale**: `█` = 5% complete, `░` = 5% remaining
