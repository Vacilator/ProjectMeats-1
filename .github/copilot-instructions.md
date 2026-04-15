
### Efficiency Metrics

**Before Improvements:**
- Migration-related deployment failures: ~30% of deployments
- Average time to diagnose issues: 2-3 hours
- Repeated issues: Same patterns in 5+ tasks

**After Improvements:**
- Migration-related deployment failures: Target < 5%
- Average time to diagnose: < 30 minutes (with troubleshooting guide)
- Repeated issues: Prevented by automation

---

## Proactive Leadership Mode (MANDATORY)

When planning or executing work, act as a **senior engineer + lead architect + senior project manager**.

### Always Ingest Current Context (Before Proposing Work)
- **MASTER_PLAN.md** is canonical for priorities and definitions of “done”.
- **PR execution log**: `.github/MASTER_PLAN.md` (append-only).
- **Golden files registry**: `manifests/GOLDEN_FILES.md` for schema/env/CI/RLS decisions.
- **Golden pipeline**: `docs/GOLDEN_PIPELINE.md` for any deployment/migration guidance.
- **Recent reality check**: read `git log -20` and scan recent diffs when relevant.

### Proactive Output Requirements (Plans + Implementations)
Every plan/change must include:
- **Deliverables** (what ships) + **expected results** (what improves)
- **Acceptance criteria** (how we know it’s correct)
- **Dependencies** (what blocks what)
- **Risk register** (likelihood × impact) + mitigations
- **Testing strategy** (unit/integration/e2e; gating rules)
- **Rollback / safe-change approach** for risky refactors

### “Never Miss Again” Guardrails
- If a DRY/canonical standard exists, **add an enforcement mechanism**:
  - CI checks (type-check, migration checks, contract checks)
  - lint rules / codemods
  - golden-file references
  - templates (PR template, issue template, runbook templates)

### Delegation & Research
- For repo-wide audits or multi-domain questions, **use parallel subagents**.
- When industry best practices are required, do targeted research and translate into repo-specific actionable items.

### Copilot Squad (Fleet Mode)
When working in **GitHub Copilot CLI** for this repo, default to a “squad” approach using **Fleet mode** (parallel subagents) for anything that touches multiple domains (backend/frontend/CI).

**How to use in Copilot CLI:**
- Run `/fleet` to enable fleet mode (parallel subagents)
- Use `/tasks` to monitor/cancel background subagent work
- Use `/diff` and `/review` before committing or opening PRs

**Recommended squad split:**
- *Explore agent*: locate files, map the flow, identify risks
- *Implementation agent*: make the code changes
- *Validation agent*: run repo scripts/tests (per `TESTING_INSTRUCTIONS.md`)
- *Release agent*: prepare PR notes + rollback steps

**Prompt template:**
“Enable fleet. Spin up parallel agents to (1) find the relevant files/entrypoints, (2) run the smallest test suite that covers the change, and (3) scan docs/golden files for constraints. Report back with a concrete patch plan and risks.”

### Decision-Making
- Default to action and completeness. Only ask questions for true design forks.
- Optimize for: tenant safety, correctness, user outcomes, and long-term maintainability.

---

### Quick Reference: Common Copilot Agent Tasks

**Before Creating PR:**
- [ ] **MANDATORY WORKFLOW**: for every batch of changes, ALWAYS: `git switch -c <new-branch>` → open a PR → merge to `development` to trigger Dev deployment (do not leave work unmerged).
- [ ] Run `.github/scripts/validate-migrations.sh` (if backend changes)
- [ ] Run `.github/scripts/validate-environment.sh` (if config changes)
- [ ] Test migrations on fresh database
- [ ] Ensure pre-commit hooks pass
- [ ] Review architecture decisions in `docs/ARCHITECTURE.md`
- [ ] Update copilot-log.md with lessons learned

**For Migration Changes:**
- [ ] **CRITICAL: Before creating a PR, always run `python manage.py makemigrations` locally. If new files are generated, they MUST be committed. The CI pipeline will now fail any PR that has unapplied migrations, detected via the new pre-commit hook.**
- [ ] **CRITICAL: Before ANY schema change, verify RLS compliance against `manifests/RLS_POLICIES.md`**
- [ ] Never modify applied migrations
- [ ] Use minimal dependencies
- [ ] Add `default=''` to CharField with `blank=True`
- [ ] Test rollback: `python manage.py migrate <app> <previous>`
- [ ] Document complex migrations with docstrings
- [ ] Verify migration plan: `python manage.py migrate --plan`
- [ ] If creating tenant-aware table, include RLS policy in migration with `RunSQL`

**For Deployment Issues:**
- [ ] If the deployment fails with "Unapplied migrations detected", the developer MUST run `git pull`, execute `python manage.py makemigrations`, commit the new file(s), and push to re-trigger the pipeline
- [ ] Check copilot-log.md for similar issues and solutions
- [ ] Review GitHub Actions logs
- [ ] SSH to server and check container logs
- [ ] Compare working vs broken environment variables
- [ ] Follow rollback procedure if needed

**For Admin Changes:**
- [ ] Extend `TenantFilteredAdmin` for tenant models
- [ ] Test with non-superuser account
- [ ] Verify superuser still sees all data
- [ ] Check CSRF_TRUSTED_ORIGINS includes admin domain

### Resources for Copilot Agents

- **copilot-log.md** - 4700+ lines of historical lessons, search for similar issues
- **docs/ARCHITECTURE.md** - Single source of truth for architecture decisions
- **Validation scripts** in `.github/scripts/` - Use these to validate changes
- **Deployment workflows** in `.github/workflows/` - Reference for CI/CD patterns
- **manifests/GOLDEN_FILES.md** - Registry of authoritative source files

**CRITICAL AI AGENT RULE:**
- **ALWAYS** reference `/manifests/GOLDEN_FILES.md` before proposing:
  - Database schema changes
  - RLS policy modifications
  - Environment variable additions
  - CI/CD workflow updates
- Check ROADMAP.md for current priorities and blockers
- Consult MASTER_PLAN.md for granular task context

---

**Last Updated**: 2025-12-05  
**Version**: 4.0 (Shared Schema Only - Removed django-tenants)

---

## Django Migration Best Practices

### Standard Migration Commands

**ProjectMeats uses STANDARD Django migrations (NO django-tenants migrate_schemas).**

```bash
# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Check for unapplied migrations (CI gating)
python manage.py makemigrations --check

# Show migration status
python manage.py showmigrations
```

### Idempotent Migrations with `--fake-initial`

**When to Use:** Production deployments, redeployments, or when tables may already exist.

**Command:**
```bash
python manage.py migrate --fake-initial --noinput
```

**What It Does:**
- Checks if tables from initial migrations already exist
- If they exist, marks those migrations as applied without running them
- Continues with unapplied migrations normally
- Prevents "relation already exists" errors on redeployment

**When NOT to Use:**
- Fresh database setup (not harmful, but unnecessary)
- Development environments where you want to catch schema drift
- When you need to verify initial migrations actually run

**Example Use Case:**
Deploying to a server where manual table creation occurred, or redeploying after a rollback:

```bash
# This will NOT fail even if users table exists
python manage.py migrate --fake-initial

# Output:
# Operations to perform:
#   Apply all migrations: auth, contenttypes, sessions, ...
# Running migrations:
#   Applying contenttypes.0001_initial... FAKED
#   Applying auth.0001_initial... FAKED
#   Applying myapp.0002_new_feature... OK
```

**Safety Guarantees:**
- ✅ Idempotent (safe to run multiple times)
- ✅ Won't skip actual schema changes
- ✅ Only affects initial migrations (0001_initial.py)
- ⚠️ Assumes initial schema is correct (doesn't verify)

**CI/CD Integration:**
Our deployment workflows use `--fake-initial` to ensure reliable redeployments without manual intervention.

**References:**
- Django Docs: https://docs.djangoproject.com/en/4.2/ref/django-admin/#cmdoption-migrate-fake-initial
- Our Implementation: `.github/workflows/11-dev-deployment.yml` (deploy-backend job)

---

## 🔐 Secret Management

### SOURCE OF TRUTH: `config/env.manifest.json`

**All environment variables and GitHub secret mappings are defined in the Environment Manifest.**

### Critical Rules

#### 1. Strict Adherence
- ✅ **ALWAYS** read `config/env.manifest.json` for secret names
- ❌ **NEVER** guess or infer secret names from patterns
- ❌ **NEVER** assume naming conventions are consistent
- ✅ **ALWAYS** use exact `ci_secret_mapping` values in workflows

#### 2. Legacy Naming Patterns
ProjectMeats has **inconsistent naming** by design:
- `SSH_PASSWORD` is **shared** between UAT and Production
- `DEV_SSH_PASSWORD` is **unique** to Development
- Frontend variables use **same name** across environments with different values

**This is intentional and documented in the manifest.**

#### 3. Secret Mapping Types

**Explicit Mapping** (Preferred):
```json
"BASTION_HOST": {
  "ci_secret_mapping": {
    "dev-backend": "DEV_HOST",
    "uat2-backend": "UAT_HOST",
    "prod2-backend": "PROD_HOST"
  }
}
```

**Pattern-Based**:
```json
"SECRET_KEY": {
  "ci_secret_pattern": "{PREFIX}_SECRET_KEY"
}
```
Expands to: `DEV_SECRET_KEY`, `UAT_SECRET_KEY`, `PROD_SECRET_KEY`

**Computed Values**:
```json
"DJANGO_SETTINGS_MODULE": {
  "value_source": "environment_config"
}
```
Derived from manifest's environment configuration.

### Audit Command

**Run before and after secret changes:**

```bash
python config/manage_env.py audit
```

**Output:**
- 🧟 **Zombie Secrets**: In GitHub, NOT in manifest (should be removed or documented)
- ❌ **Missing Secrets**: In manifest, NOT in GitHub (must be added)
- ✅ **Audit Passed**: All secrets are in sync

### Workflow Integration

**❌ WRONG: Guessing Names**
```yaml
env:
  SSH_PASSWORD: ${{ secrets.UAT_SSH_PASSWORD }}  # Does not exist!
```

**✅ CORRECT: Using Manifest**
```yaml
# For UAT/Prod (shared secret)
env:
  SSH_PASSWORD: ${{ secrets.SSH_PASSWORD }}

# For Dev (unique secret)
env:
  SSH_PASSWORD: ${{ secrets.DEV_SSH_PASSWORD }}
```

### Adding New Secrets

1. **Update Manifest First**
   ```bash
   vim config/env.manifest.json
   # Add to appropriate category with mapping
   ```

2. **Choose Mapping Type**
   - Explicit mapping for inconsistent names
   - Pattern-based for consistent naming
   - Computed for derived values

3. **Add to GitHub**
   ```bash
   gh secret set SECRET_NAME --body "value"
   ```

4. **Verify with Audit**
   ```bash
   python config/manage_env.py audit
   ```

### AI Context

For detailed secret handling rules, see:
- **`.github/ai-context/env-handling.md`** - Comprehensive guide for AI and developers
- **`config/env.manifest.json`** - Single source of truth for all mappings

### Troubleshooting

**"Secret not found" in workflow:**
1. Check manifest for environment (e.g., `uat2-backend`)
2. Find variable (e.g., `BASTION_HOST`)
3. Use exact name from `ci_secret_mapping` (e.g., `UAT_HOST`)

**"Zombie secrets" in audit:**
- Legacy secrets no longer in use
- Add to manifest if still needed, or delete from GitHub

**"Missing secrets" in audit:**
- Required by manifest but not in GitHub
- Add immediately to prevent deployment failures


---

## 📋 COMPLETE PHASE 1-9 ROADMAP

### Overview: Gap Analysis Project (February 2026)

**Objective**: Bring ProjectMeats from 79.8% → 90%+ feature parity with industry leaders

**Progress**: 51.7% complete (15/29 todos)

---

### Phase 1: UI/UX Enhancement ✅ [COMPLETE - 100%]

**Status**: Completed January 2026  
**Deliverables**:
- ✅ Onboarding tours with react-joyride (Gap Analysis Phase 1.1)
- ✅ Responsive design patterns (mobile-first)
- ✅ WCAG 2.1 Level AA accessibility compliance
- ✅ Keyboard navigation and screen reader support
- ✅ High-contrast mode support

**Key Files**:
- `frontend/src/components/Onboarding/`
- `frontend/src/hooks/useAccessibility.ts`
- `frontend/src/styles/responsive.ts`

---

### Phase 2: Forms/Workflows - AI-Powered 🔒 [BLOCKED - 0%]

**Status**: BLOCKED - Requires OpenAI API key  
**Estimated Effort**: 29-37 hours (5 todos)

**Planned Features**:
- ❌ Phase 2.1: AI Field Suggestions (contextual recommendations)
- ❌ Phase 2.2: Template Library (import/export workflows)
- ❌ Phase 2.3: Entity Cascading (protein → cuts automation)
- ❌ Phase 2.4: Form Process Groups Version Control
- ❌ Phase 2.5: Enhanced Inheritance (type-checking for forms)

**Key Files** (when unblocked):
- `backend/tenant_apps/workflows/ai_suggestions.py`
- `frontend/src/services/aiNodeSuggestionService.ts`
- `backend/tenant_apps/workflows/template_manager.py`

**Blocker**: OpenAI API key configuration in environment secrets

---

### Phase 3: Search Intelligence 🔒 [BLOCKED - 0%]

**Status**: BLOCKED - Requires Redis instance  
**Estimated Effort**: 26-33 hours (4 todos)

**Planned Features**:
- ❌ Phase 3.1: Mind-Map Visualizations (react-flow)
- ❌ Phase 3.2: Real-Time Search Updates (WebSocket-based)
- ❌ Phase 3.3: NLP Query Refinement (natural language processing)
- ❌ Phase 3.4: Continuous Search (suggestions as you type)

**Key Files** (when unblocked):
- `frontend/src/components/Search/MindMap.tsx`
- `backend/apps/search/nlp_processor.py`
- `backend/apps/search/realtime_index.py`

**Blocker**: Redis instance for caching and real-time data

---

### Phase 4: Admin Management ✅ [COMPLETE - 100%]

**Status**: Completed January 2026  
**Deliverables**:
- ✅ Tabbed product catalog with drag-and-drop
- ✅ Metrics dashboard with real-time analytics
- ✅ Role-Based Access Control (RBAC) system
- ✅ Tenant creation wizard (Gap Analysis Phase 4.5)
- ✅ System Blueprint for extensible schemas

**Key Files**:
- `frontend/src/components/Admin/TabbedCatalog.tsx`
- `frontend/src/components/Admin/MetricsDashboard.tsx`
- `backend/apps/tenants/rbac.py`
- `backend/apps/tenants/wizard.py`

---

### Phase 5: Integrations 🔒 [BLOCKED - 0%]

**Status**: BLOCKED - Requires Microsoft OAuth  
**Estimated Effort**: 40-49 hours (4 todos)

**Planned Features**:
- ❌ Phase 5.1: Email Webhook Tracking (event monitoring)
- ❌ Phase 5.2: Outlook Integration (calendar + email sync)
- ❌ Phase 5.3: External API Connectors (framework)
- ❌ Phase 5.4: Third-Party Sync (bidirectional data)

**Key Files** (when unblocked):
- `backend/apps/integrations/outlook/`
- `backend/apps/integrations/webhooks/`
- `frontend/src/services/outlookApi.ts`

**Blocker**: Microsoft OAuth credentials for Outlook/365 integration

---

### Phase 6: Performance & Security 🚀 [NEAR-COMPLETE - 83%]

**Status**: 5/6 completed, 1 blocked  
**Completion Date**: February 26, 2026

**Completed Features**:
- ✅ Phase 6.2: Security Hardening (OWASP Top 10, 85% coverage) - **DEPLOYED**
- ✅ Phase 6.3: E2E Test Coverage (31 Playwright tests, 5 browsers) - **DEPLOYED**
- ✅ Phase 6.5: Frontend Optimization (performance utilities) - **DEPLOYED**
- ✅ Phase 6.6: Load Testing (Locust framework, 3 profiles) - **DEPLOYED**

**Blocked Feature**:
- 🔒 Phase 6.4: Sentry Integration (real-time error tracking, APM)

**Key Files**:
- `backend/apps/core/security.py` (OWASP compliance)
- `frontend/src/utils/security.ts` (XSS prevention, encryption)
- `frontend/e2e/` (Playwright test suites)
- `frontend/src/utils/performance.ts` (monitoring hooks)
- `backend/locustfile.py` (load testing scenarios)

**Blocker**: Sentry account for error tracking and APM dashboard

---

### Phase 7: Intelligent Workform Editor 📍 [PRIMARY FOCUS - In Progress]

**Status**: Active Development  
**Priority**: **HIGHEST** - All new work should align with Phase 7 objectives

**Core Objectives**:

#### 7.1: AI-Powered Field Suggestions (In Progress)
- Contextual field recommendations based on workflow patterns
- Machine learning from existing workflows across tenants
- Smart defaults based on industry best practices

#### 7.2: Enhanced Drag-and-Drop (In Progress)
- Improved node positioning with smart snapping
- Container management with nested workflows
- Visual connection indicators and validation
- Batch operations (group select, copy, paste)

#### 7.3: Real-Time Collaboration (Planned)
- Multi-user editing with operational transforms
- Presence indicators and cursor tracking
- Conflict resolution strategies
- Activity history and audit trail

#### 7.4: Advanced Node Types (Planned)
- Conditional branching (if/else logic)
- Loop constructs (for-each, while)
- Parallel execution paths
- Sub-workflow embedding

#### 7.5: Performance Optimization (Ongoing)
- Sub-100ms render times for complex workflows
- Virtualized node lists for 1000+ node graphs
- Optimistic UI updates
- Incremental auto-save with debouncing

#### 7.6: Accessibility & I18n (Ongoing)
- WCAG 2.1 AAA compliance
- Full keyboard navigation
- Screen reader support with ARIA labels
- Multi-language support

**Key Files**:
- `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx` (main editor)
- `frontend/src/components/FlowEditor/nodes/` (node types)
- `frontend/src/components/FlowEditor/panels/` (config panels)
- `backend/tenant_apps/workflows/models.py` (workflow data)
- `backend/tenant_apps/workflows/views.py` (API endpoints)

**Development Principles**:
- **Additive-Only Changes**: NEVER break existing workflows (5+ months production data)
- **Multi-Tenant Safety**: All changes work across ALL tenants
- **Performance First**: Profile before optimizing, measure bundle impact
- **User Experience**: Progressive enhancement, clear error messages, undo/redo

---

### Phase 8: Advanced Caching & Parallelization ⏳ [PLANNED - Q2 2026]

**Status**: Planning Phase  
**Estimated Start**: April 2026

**Planned Features**:
- Redis-based query result caching
- CDN integration for static assets
- Parallel task execution for workflows
- Background job processing with Celery
- Edge caching strategies

**Dependencies**: Redis infrastructure (also blocks Phase 3)

---

### Phase 9: Security Scanning & SBOM 🔐 [PLANNED - Q2 2026]

**Status**: Planning Phase  
**Estimated Start**: May 2026

**Planned Features**:
- Automated SBOM (Software Bill of Materials) generation
- Container image scanning with Trivy/Grype
- Dependency vulnerability scanning
- License compliance checking
- Security audit reports

**Integration**: GitHub Actions security workflows

---

## 🎯 Phase Priority Order for AI Development

1. **Phase 7** (PRIMARY): Intelligent Workform Editor - **ALL NEW WORK ALIGNS HERE**
2. **Phase 6.4** (when unblocked): Sentry integration
3. **Phase 2** (when unblocked): AI-powered forms and workflows
4. **Phase 3** (when unblocked): Search intelligence
5. **Phase 5** (when unblocked): Third-party integrations
6. **Phase 8** (Q2 2026): Caching and parallelization
7. **Phase 9** (Q2 2026): Security scanning and SBOM

---

## 🚫 STRICT MANDATES FOR ALL PHASES

### TenantAwareModel Inheritance (MANDATORY)

**ABSOLUTE REQUIREMENT**: All business models in `backend/tenant_apps/` MUST inherit from `TenantAwareModel`

```python
# backend/apps/core/models.py
class TenantAwareModel(TimestampModel):
    \"\"\"
    Abstract base model for tenant-aware entities.
    
    Provides tenant isolation via ForeignKey and dynamic schema extension.
    \"\"\"
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE)
    custom_data = models.JSONField(default=dict, blank=True)
    objects = TenantManager()
    
    class Meta:
        abstract = True
```

**✅ CORRECT USAGE**:
```python
from apps.core.models import TenantAwareModel

class MyModel(TenantAwareModel):
    name = models.CharField(max_length=255)
    # tenant field inherited automatically
```

**❌ WRONG - DO NOT DO THIS**:
```python
class MyModel(models.Model):
    tenant = models.ForeignKey('tenants.Tenant', ...)  # Manual tenant - inconsistent
    objects = TenantManager()  # Manual manager - error-prone
```

**Why This Matters**:
- Ensures consistent tenant isolation patterns
- Provides `custom_data` JSONB for System Blueprint extensibility
- Includes TenantManager for automatic queryset filtering
- Inherits TimestampModel (created_at, updated_at)

---

### BusinessApi Service Layer (MANDATORY)

**ABSOLUTE REQUIREMENT**: All frontend API calls MUST use centralized services

**Primary Services**:
- `businessApi.ts` - General business logic operations
- `workformsApi.ts` - Workforms editor-specific operations
- `tenantService.ts` - Tenant management and switching
- `authService.ts` - Authentication and authorization

**✅ CORRECT USAGE**:
```typescript
import { businessApi } from '@/services/businessApi';

const fetchCustomers = async (tenantId: string) => {
  return await businessApi.get(`/tenants/${tenantId}/customers/`);
};
```

**❌ WRONG - DO NOT DO THIS**:
```typescript
import axios from 'axios';

const fetchData = async () => {
  return await axios.get('/api/v1/endpoint/');  // Direct axios - NO!
};
```

**Why This Matters**:
- Centralized error handling (retry logic, token refresh)
- Type-safe TypeScript interfaces for all requests/responses
- Easy mocking for tests
- Single point for API metrics and logging

---

### "No-Assumptions" State Management Protocol 🔒

**CRITICAL RULE**: When working with component state, database queries, or API calls:

**❌ NEVER ASSUME**:
- Data exists without checking
- Field values are populated
- Relations are loaded
- User has permissions
- Tenant context is set

**✅ ALWAYS VERIFY**:
```typescript
// Frontend: Check before using
const customer = customers.find(c => c.id === customerId);
if (!customer) {
  showError('Customer not found');
  return;
}

// Backend: Filter by tenant ALWAYS
queryset = queryset.filter(tenant=request.tenant)
if not queryset.exists():
    raise NotFound('Resource not found for this tenant')
```

**✅ ALWAYS USE SAFE DEFAULTS**:
```typescript
// TypeScript: Optional chaining and nullish coalescing
const name = customer?.contact?.name ?? 'Unknown';
const items = order?.items?.length ?? 0;

// Python: get() with defaults
settings = user_preferences.get('theme', {})
auto_save = settings.get('auto_save', True)
```

**✅ ALWAYS VALIDATE INPUT**:
```python
# Backend: Use serializers
serializer = MySerializer(data=request.data)
serializer.is_valid(raise_exception=True)
validated_data = serializer.validated_data

# Frontend: Use zod or react-hook-form validation
const schema = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150)
});
```

**Why This Matters**:
- Prevents cross-tenant data leaks
- Avoids null pointer exceptions
- Provides clear error messages
- Supports graceful degradation

---

### CRITICAL REQUIREMENT: PostgreSQL RLS Policies

**⚠️ ENFORCEMENT:** Every migration that creates a tenant-aware table MUST include PostgreSQL Row-Level Security setup using `RunSQL`.

#### Why RLS Matters
- **Database-Level Isolation**: Enforced by PostgreSQL engine, not application code
- **Defense in Depth**: Prevents accidental cross-tenant data leaks even if application logic fails
- **Performance**: Query planner optimizes with RLS knowledge
- **Middleware Integration**: `TenantMiddleware` sets `app.current_tenant` session variable before queries

#### Required Migration Pattern

```python
from django.db import migrations, models
from django.contrib.postgres.operations import RunSQL

class Migration(migrations.Migration):
    dependencies = [
        ('your_app', '0001_previous_migration'),
    ]

    operations = [
        # 1. Create the table (Django ORM)
        migrations.CreateModel(
            name='YourModel',
            fields=[
                ('id', models.BigAutoField(primary_key=True)),
                ('tenant', models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE)),
                ('name', models.CharField(max_length=255)),
                # ... other fields
            ],
        ),
        
        # 2. Enable RLS and create policy (Raw SQL - MANDATORY)
        RunSQL(
            # Enable RLS
            sql="""
            ALTER TABLE your_app_yourmodel ENABLE ROW LEVEL SECURITY;
            
            -- Create policy using app.current_tenant session variable
            CREATE POLICY yourmodel_tenant_isolation ON your_app_yourmodel
                USING (tenant_id = current_setting('app.current_tenant')::uuid);
            """,
            # Reverse SQL for rollback
            reverse_sql="""
            DROP POLICY IF EXISTS yourmodel_tenant_isolation ON your_app_yourmodel;
            ALTER TABLE your_app_yourmodel DISABLE ROW LEVEL SECURITY;
            """
        ),
    ]
```

#### RLS Policy Naming Convention
- Format: `{tablename}_tenant_isolation`
- Example: `workflows_tenant_isolation`, `customers_tenant_isolation`

#### Verification
```bash
# Check if RLS is enabled on tenant-aware tables
psql -d projectmeats -c "SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE rowsecurity = true;"

# Verify policies exist
psql -d projectmeats -c "SELECT schemaname, tablename, policyname FROM pg_policies WHERE policyname LIKE '%tenant_isolation';"
```

**Authority**: `docs/workforms/MIGRATION_STANDARDS.md`  
**Setting**: `ROW_LEVEL_SECURITY = True` in `backend/projectmeats/settings/base.py`

---

## 🎯 PRIMARY DEVELOPMENT FOCUS: Phase 7 - Intelligent Workform Editor

### PRIORITY TARGET: Next-Generation Workforms Experience

**🚀 STRATEGIC FOCUS:** All new development should align with Phase 7 objectives unless explicitly directed otherwise.

#### Phase 7 Core Objectives

1. **AI-Powered Field Suggestions**
   - Context-aware field recommendations based on workflow patterns
   - Machine learning from existing workflows across tenants
   - Smart defaults based on industry best practices

2. **Enhanced Drag-and-Drop Experience**
   - Improved node positioning with smart snapping
   - Container management with nested workflows
   - Visual connection indicators and validation
   - Batch operations (group select, copy, paste)

3. **Real-Time Collaboration** (Future)
   - Multi-user editing with operational transforms
   - Presence indicators and cursor tracking
   - Conflict resolution strategies
   - Activity history and audit trail

4. **Advanced Node Types**
   - Conditional branching (if/else logic)
   - Loop constructs (for-each, while)
   - Parallel execution paths
   - Sub-workflow embedding

5. **Performance Optimization**
   - Sub-100ms render times for complex workflows
   - Virtualized node lists for 1000+ node graphs
   - Optimistic UI updates
   - Incremental auto-save with debouncing

6. **Accessibility & Internationalization**
   - WCAG 2.1 AAA compliance
   - Full keyboard navigation
   - Screen reader support with ARIA labels
   - Multi-language support

#### Key Files for Phase 7 Development

**Frontend (Primary)**:
- `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx` - Main editor component
- `frontend/src/components/FlowEditor/nodes/` - Node type implementations
- `frontend/src/components/FlowEditor/panels/` - Configuration panels
- `frontend/src/hooks/useWorkflowEditor.ts` - Editor state management

**Backend (Supporting)**:
- `backend/tenant_apps/workflows/models.py` - Workflow data models
- `backend/tenant_apps/workflows/views.py` - API ViewSets
- `backend/tenant_apps/workflows/serializers.py` - REST serializers
- `backend/tenant_apps/workflows/services.py` - Business logic

**Shared Types** (If exists):
- `shared/types/workforms.ts` - TypeScript interfaces shared between frontend/mobile

#### Development Principles for Phase 7

1. **Additive-Only Changes** (CRITICAL)
   - NEVER break existing workflows (5+ months of production data)
   - Use deprecation + aliasing for node type evolution
   - Maintain backward compatibility for ALL schema changes
   - See `docs/workforms/MIGRATION_STANDARDS.md` for patterns

2. **Multi-Tenant Safety**
   - All changes must work across ALL tenants simultaneously
   - No tenant-specific logic without feature flags
   - Test with multiple tenant datasets

3. **Performance First**
   - Profile before optimizing
   - Use React.memo for expensive components
   - Implement virtualization for large lists
   - Measure bundle size impact

4. **User Experience**
   - Progressive enhancement over breaking changes
   - Clear error messages with recovery paths
   - Undo/redo for all actions
   - Keyboard shortcuts for power users

**Authority**: `docs/workforms/MIGRATION_STANDARDS.md` - Additive-Only Rule

---

## 🌐 FRONTEND API SERVICE LAYER - MANDATORY PATTERNS

### REQUIREMENT: Centralized API Services

**⚠️ PROHIBITION:** Direct axios calls are NOT allowed. ALL frontend-to-backend communication MUST use the standardized service layer.

#### Primary Services

**businessApi.ts** - General business logic operations
```typescript
// ✅ CORRECT
import { businessApi } from '@/services/businessApi';

const fetchCustomers = async (tenantId: string) => {
  return await businessApi.get(`/tenants/${tenantId}/customers/`);
};
```

**workformsApi.ts** - Workforms editor-specific operations
```typescript
// ✅ CORRECT
import { workformsApi } from '@/services/workformsApi';

const saveWorkflow = async (workflowId: string, data: WorkflowData) => {
  return await workformsApi.put(`/workflows/${workflowId}/`, data);
};
```

```typescript
// ❌ WRONG - Direct axios usage
import axios from 'axios';

const fetchData = async () => {
  return await axios.get('/api/v1/endpoint/'); // DON'T DO THIS
};
```

#### Service Layer Benefits
- **Type Safety**: Full TypeScript interfaces for requests/responses
- **Error Handling**: Centralized retry logic, token refresh, error mapping
- **Testing**: Easy mocking with jest.mock()
- **Monitoring**: Single point for API metrics and logging
- **Token Management**: Automatic JWT refresh and storage

**Authority**: `frontend/src/services/` directory structure

---

## 🎨 UI STYLING - MANDATORY THEME TOKENS

### REQUIREMENT: AntD Theme Tokens via theme.ts

**⚠️ PROHIBITION:** Hardcoded colors are NOT allowed. ALL UI components MUST use theme tokens.

```typescript
// ✅ CORRECT: Use theme tokens or CSS custom properties
import { theme } from '@/styles/theme';

const Button = styled.button`
  background: ${theme.colors.primary};
  color: rgb(var(--color-text-primary));
  border: 1px solid ${theme.colors.border};
`;
```

```typescript
// ❌ WRONG: Hardcoded colors
const Button = styled.button`
  background: #667eea;
  color: #2c3e50;
  border: 1px solid #d1d5db;
`;
```

#### Standardized Status Colors (RGB format)
```typescript
// Success: rgb(34, 197, 94)
// Warning: rgb(234, 179, 8)
// Error: rgb(239, 68, 68)
// Info: rgb(59, 130, 246)
```

**Authority**: `docs/DESIGN_SYSTEM.md` - Single source of truth for all UI/UX standards

---

## 📋 PULL REQUEST CHECKLIST - MANDATORY VERIFICATION

### Before Creating PR, Verify ALL Items

#### 1. Model Inheritance & Tenant Awareness
- [ ] All business models inherit from `backend/apps/core/models.py:TenantAwareModel`
- [ ] ViewSets filter by `tenant=request.tenant` in `get_queryset()`
- [ ] `perform_create()` assigns `tenant=request.tenant`
- [ ] No direct ORM queries bypassing tenant filtering

#### 2. Row-Level Security (RLS)
- [ ] Migration includes `RunSQL` operation for RLS policy (if creating tenant-aware table)
- [ ] Policy uses `current_setting('app.current_tenant')::uuid` pattern
- [ ] Reverse SQL provided for migration rollback
- [ ] Policy named following `{tablename}_tenant_isolation` convention

#### 3. UI Styling & Theme Compliance
- [ ] All colors use theme tokens from `theme.ts` or CSS custom properties
- [ ] No hardcoded hex/RGB values in component styles
- [ ] AntD components use proper theme configuration
- [ ] Standardized status colors used (success/warning/error/info)

#### 4. API Service Layer
- [ ] Frontend uses `businessApi` or `workformsApi` (not direct axios)
- [ ] TypeScript interfaces defined for all API request/response types
- [ ] Error handling follows service layer patterns
- [ ] Token refresh logic not bypassed

#### 5. Migration Safety (Additive-Only)
- [ ] No removed/renamed node types (use deprecation + alias pattern)
- [ ] No deleted schema fields (mark as deprecated with fallback)
- [ ] No removed API endpoints (deprecate + redirect for 6 months)
- [ ] No deleted database fields (mark unused, hide from API)
- [ ] Migration logic provided for schema evolution

#### 6. Testing Coverage
- [ ] Unit tests pass (`npm test` for frontend, `python manage.py test` for backend)
- [ ] E2E tests pass (`npm run test:e2e`) if modifying workflows
- [ ] Manual testing completed in development environment
- [ ] Multi-tenant scenarios tested (at least 2 different tenants)

#### 7. Documentation & Code Quality
- [ ] Code comments for complex business logic
- [ ] Docstrings for all public Python functions
- [ ] TSDoc comments for all exported TypeScript functions
- [ ] README updates if changing setup/deployment process

#### 8. Performance & Accessibility
- [ ] No performance regressions (bundle size, render times)
- [ ] Keyboard navigation works for all interactive elements
- [ ] ARIA labels provided for screen readers
- [ ] Color contrast meets WCAG 2.1 AA standards

**Authority**: `.github/PULL_REQUEST_TEMPLATE.md` (to be updated with this checklist)

---

## 🏆 GOLDEN PIPELINE RULES (ENFORCEMENT)

**Authority**: [`docs/GOLDEN_PIPELINE.md`](../docs/GOLDEN_PIPELINE.md) is the definitive reference for all deployment practices.

### Absolute Prohibitions for CI/CD

#### Database Migrations
❌ **NEVER** suggest SSH-based migrations from deployed containers  
❌ **NEVER** run migrations as part of web server startup  
❌ **NEVER** use direct database access from GitHub runners  
❌ **NEVER** skip the bastion tunnel pattern  
❌ **NEVER** omit --network host for migration containers  

#### Health Checks
❌ **NEVER** check frontend via reverse proxy (port 80)  
❌ **NEVER** use more than 5 retry attempts  
❌ **NEVER** omit the Host header when checking proxies  

#### Image Tags
❌ **NEVER** use :latest tag in production deployments  
❌ **NEVER** skip SHA tagging for images  
❌ **NEVER** deploy without immutable image tags  

### Required Practices for CI/CD

#### Database Migrations (Runner-Based)
✅ **ALWAYS** use bastion tunnel pattern (SSH -L 5433)  
✅ **ALWAYS** run migrations via Docker with --network host  
✅ **ALWAYS** construct DATABASE_URL pointing to 127.0.0.1:5433  
✅ **ALWAYS** cleanup tunnel after migration  
✅ **ALWAYS** use migrate --fake-initial --noinput  

#### Health Checks
✅ **ALWAYS** check backend on localhost:8000/api/v1/health/  
✅ **ALWAYS** check frontend on 127.0.0.1:8080/ (container direct)  
✅ **ALWAYS** use exactly 5 retry attempts  
✅ **ALWAYS** verify proxy status separately (non-blocking)  

#### Image Management
✅ **ALWAYS** tag images with {env}-{sha} format  
✅ **ALWAYS** push to both DOCR and GHCR  
✅ **ALWAYS** pull specific SHA tag for deployments  
✅ **ALWAYS** use immutable references  

### Verification Commands

Before suggesting any deployment changes:

```bash
# 1. Verify manifest is authoritative
cat config/env.manifest.json | jq '.version'

# 2. Run secret audit
python config/manage_env.py audit

# 3. Check workflow has golden patterns
grep "ssh -L 5433" .github/workflows/reusable-deploy.yml
grep "127.0.0.1:8080" .github/workflows/reusable-deploy.yml

# 4. Verify golden state
bash scripts/verify_golden_state.sh
```

### Documentation Hierarchy

When answering deployment questions:

1. **PRIMARY**: docs/GOLDEN_PIPELINE.md
2. **Secrets**: docs/CONFIGURATION_AND_SECRETS.md
3. **Workflow**: .github/workflows/reusable-deploy.yml
4. **Config**: config/env.manifest.json
5. **UI/UX**: docs/DESIGN_SYSTEM.md (single source of truth)

---

**Golden Pipeline Version**: 1.0  
**Last Updated**: January 30, 2026  
**Enforcement**: MANDATORY for all AI assistants and developers
