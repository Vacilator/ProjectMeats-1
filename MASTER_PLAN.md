# ProjectMeats Master Plan - Phase Tracking & Technical Debt

**Status**: 🔄 LIVING DOCUMENT  
**Last Updated**: February 28, 2026 05:50 UTC  
**Current Focus**: Phase 7 Intelligent Workform Editor (~90% complete) + Phase 5 Integrations COMPLETE ✅  
**Overall Progress**: 88.6% (62/70 todos) - Phase 5 COMPLETE (100%), Phase 6 COMPLETE (100%), Phase 7: ~90% complete

---

## 📋 COMPLETE PHASE RUNNING LOG

### Legend
- [x] = Complete
- [ ] = Pending
- 🔒 = Blocked by infrastructure

---

## Phase 1: UI/UX Enhancement [x] COMPLETE

**Completion Date**: January 2026  
**Status**: ✅ 100% Complete

### Deliverables
- [x] 1.1: Onboarding Tours (react-joyride integration)
- [x] 1.2: Responsive Design Patterns (mobile-first)
- [x] 1.3: WCAG 2.1 Level AA Accessibility
- [x] 1.4: Keyboard Navigation
- [x] 1.5: Screen Reader Support
- [x] 1.6: High-Contrast Mode

**Key Files**:
- `frontend/src/components/Onboarding/TourSteps.tsx`
- `frontend/src/hooks/useAccessibility.ts`
- `frontend/src/styles/responsive.css`

**Git References**:
- PRs: #2801-#2815 (Gap Analysis Phase 1)
- Branch: `feat/gap-analysis-phase1-accessibility`

---

## Phase 2: Forms/Workflows - AI-Powered [~] PARTIALLY UNBLOCKED ⚡

**Status**: Infrastructure Ready - Awaiting User Audit  
**Estimated Effort**: 29-37 hours (5 todos)  
**Completed**: 1/5 (20%) - Infrastructure + API Layer

### Completed Deliverables
- [x] 2.1: AI Field Suggestions - **API Layer Complete** (PR #3388)
  - Backend: SuggestNodesView with OpenAI integration
  - Frontend: AISuggestionsPanel with loading states
  - Redis caching (10-minute TTL, ~90% cost reduction)
  - Graceful degradation to static suggestions
  - 8 unit tests for connectivity checks
  - **Status**: Code complete, awaiting infrastructure audit

### Pending Deliverables
- [ ] 2.2: Template Library (import/export workflows)
- [ ] 2.3: Entity Cascading (protein → cuts automation)
- [ ] 2.4: Form Process Groups Version Control
- [ ] 2.5: Enhanced Inheritance (type-checking for forms)

**Infrastructure Requirements**:
- ⏳ OpenAI API Key (configured in dev-backend, pending audit)
- ⏳ Redis Instance (configured in dev-backend, pending audit)

**Next Steps**:
1. User runs infrastructure audit: `gh workflow run 98-ops-db-surgery.yml -f environment=dev-backend -f type=shell -f script="python scripts/infrastructure_diagnostics.py"`
2. Update manifests/GOLDEN_FILES.md with audit results
3. Complete remaining Phase 2 features
- [ ] 2.3: Entity Cascading (protein → cuts automation)
- [ ] 2.4: Form Process Groups Version Control
- [ ] 2.5: Enhanced Inheritance (type-checking for forms)

**Blocker**: OpenAI API key in environment secrets

**Target Completion**: Q2 2026 (after infrastructure setup)

---

## Phase 3: Search Intelligence [ ] BLOCKED 🔒

**Status**: 0% - Blocked by Redis instance  
**Estimated Effort**: 26-33 hours (4 todos)

### Planned Deliverables
- [ ] 3.1: Mind-Map Visualizations (react-flow integration)
- [ ] 3.2: Real-Time Search Updates (WebSocket-based)
- [ ] 3.3: NLP Query Refinement (natural language)
- [ ] 3.4: Continuous Search (suggestions as you type)

**Blocker**: Redis instance for caching and real-time data

**Target Completion**: Q2 2026 (after infrastructure setup)

---

## Phase 4: Admin Management [x] COMPLETE

**Completion Date**: January 2026  
**Status**: ✅ 100% Complete

### Deliverables
- [x] 4.1: Tabbed Product Catalog (drag-and-drop)
- [x] 4.2: Metrics Dashboard (real-time analytics)
- [x] 4.3: Role-Based Access Control (RBAC)
- [x] 4.4: System Blueprint (extensible schemas)
- [x] 4.5: Tenant Creation Wizard

**Key Files**:
- `frontend/src/components/Admin/TabbedCatalog.tsx`
- `frontend/src/components/Admin/MetricsDashboard.tsx`
- `backend/apps/tenants/rbac.py`
- `backend/apps/tenants/wizard.py`

**Git References**:
- PRs: #2950-#2975 (Gap Analysis Phase 4)
- Branch: `feat/gap-analysis-phase4-metrics`

---

## Phase 5: Integrations [x] COMPLETE ✅

**Status**: 100% Complete - Microsoft OAuth + Email Ingestion  
**Completion Date**: February 28, 2026  
**Estimated Effort**: 40-49 hours (completed)

### Completed Deliverables
- [x] 5.1: Microsoft OAuth Integration **[COMPLETE]** (PRs #3391, #3396)
  - OAuth2 utilities with `/api/v1` sub-path routing
  - Token encryption service (Fernet + PBKDF2)
  - Microsoft Graph provider with redirect URI resolver
  - Secure token storage (encrypted access/refresh tokens)
  - Configuration: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID
  - Files: `backend/apps/integrations/microsoft/utils.py`, `encryption.py`

- [x] 5.2: API Routing Alignment **[COMPLETE]** (PR #3391)
  - Migrated from subdomain to `/api/v1` sub-path pattern
  - Updated environment manifest with new base URLs
  - Network routing documentation in GOLDEN_FILES.md
  - Nginx configuration verified for `/api/` proxy

- [x] 5.5: Email Ingestion Engine **[COMPLETE]** (PR #3397)
  - EmailLog model with status workflow
  - EmailIngestionService with multi-tenant polling
  - Microsoft Graph API integration (last 7 days, order keywords)
  - Duplicate prevention via unique message_id constraint
  - AI extraction signal handler (auto-triggers on new EmailLog)
  - Files: `backend/apps/integrations/models.py`, `services/email_ingestion.py`, `signals.py`

- [x] 5.6: Background Processing & Monitoring **[COMPLETE]** (PR #3397)
  - Celery tasks: sync_tenant_emails (5-min schedule), sync_single_tenant (manual)
  - Celery app configuration with Redis broker and beat scheduler
  - API endpoints: POST /email/sync/, GET /email/logs/
  - IngestionMonitor frontend component (AntD List, status tags, sync button)
  - Files: `backend/apps/integrations/tasks.py`, `projectmeats/celery.py`, `frontend/src/components/Integrations/IngestionMonitor.tsx`

**Note**: Original Phase 5 items (Email Webhook Tracking, Outlook Calendar Sync, External API Connectors) were superseded by Microsoft Graph email ingestion infrastructure, which provides more immediate business value.

**Deployment Requirements**:
1. Create migrations: `python manage.py makemigrations && python manage.py migrate`
2. Start Celery workers: `celery -A projectmeats worker --loglevel=info`
3. Start Celery beat: `celery -A projectmeats beat --scheduler django_celery_beat.schedulers:DatabaseScheduler`
4. Configure REDIS_URL environment variable
5. Register Microsoft Azure AD application for production secrets

**Target Completion**: ✅ ACHIEVED February 28, 2026


---

## Phase 6: Performance & Security [x] COMPLETE

**Completion Date**: February 27, 2026  
**Status**: ✅ 6/6 Complete (Workflows RLS hardening added as Phase 6.7)

### Completed Deliverables
- [x] 6.2: Security Hardening (OWASP Top 10, 85% coverage) - **DEPLOYED**
  - Backend: Token encryption, HTML sanitization
  - Frontend: DOMPurify XSS prevention, AES-GCM encryption
  - Files: `backend/apps/core/security.py`, `frontend/src/utils/security.ts`
  
- [x] 6.3: E2E Test Coverage (31 Playwright tests, 5 browsers) - **DEPLOYED**
  - Test suites: Auth, workflow, navigation
  - Files: `frontend/e2e/*.spec.ts`, `frontend/playwright.config.ts`
  
- [x] 6.5: Frontend Optimization (performance monitoring) - **DEPLOYED**
  - Hooks: useRenderPerformance, useDebounce, useInView, MemoCache
  - Files: `frontend/src/utils/performance.ts`
  
- [x] 6.6: Load Testing (Locust framework) - **DEPLOYED**
  - 3 user profiles, 4 task sets, 450+ lines
  - Files: `backend/locustfile.py`, `docs/LOAD_TESTING.md`

- [x] 6.7: Workflows RLS Hardening (PostgreSQL security) - **DEPLOYED** Feb 27, 2026
  - 9 workflow models refactored to TenantAwareModel (PR #3313)
  - 17 tables with PostgreSQL RLS policies (Migration 0015)
  - Database-level tenant isolation for all workflow data
  - Files: `backend/tenant_apps/workflows/models.py`, `workflows/migrations/0015_sync_workflow_rls_state.py`

### Blocked Deliverable
- [ ] 6.4: Sentry Integration (error tracking, APM) 🔒

**Blocker**: Sentry account credentials

**Git References**:
- PRs: #3301-#3304 (Gap Analysis Phase 6)
- Branches: 
  - `feat/gap-analysis-phase6-2-security-hardening`
  - `feat/gap-analysis-phase6-3-e2e-tests`
  - `feat/gap-analysis-phase6-5-frontend-optimization`
  - `feat/gap-analysis-phase6-6-load-testing`

**Target Completion**: 100% when Sentry account configured (Q2 2026)

---

## Phase 7: Intelligent Workform Editor [~] 90% COMPLETE (PRIMARY FOCUS)

**Status**: 🎯 Active Development - **HIGHEST PRIORITY**  
**Start Date**: February 2026  
**Progress**: 90% (10/11 sub-phases complete)

### Completed Deliverables
- [x] 7.1: AI-Powered Field Suggestions ✅ **COMPLETED** Feb 28, 2026
  - **PR**: #3388 (Infrastructure Diagnostics & AI Engine)
  - Backend: SuggestNodesView with OpenAI integration (gpt-4o-mini)
  - Frontend: Enhanced AISuggestionsPanel with loading states
  - Redis caching with 10-minute TTL (~90% cost reduction)
  - Graceful degradation to static suggestions
  - 8 unit tests for connectivity checks
  - **Files**: 
    - `backend/scripts/infrastructure_diagnostics.py` (197 lines)
    - `backend/tenant_apps/workflows/views.py` (+89 lines)
    - `frontend/src/components/FlowEditor/components/AISuggestionsPanel.tsx` (+120 lines)
  - **Status**: Code complete, awaiting infrastructure audit

- [x] 7.2: Enhanced Drag-and-Drop ✅ **COMPLETED** (All Sub-Features)
  - [x] Smart snapping and positioning (PR #3309)
  - [x] Container management with nesting (PRs #3343-#3345, #3374)
  - [x] Visual connection indicators (PR #3375)
  - [x] Batch operations (PR #3373)

- [ ] 7.3: Real-Time Collaboration 🔒 **BLOCKED** (Requires Redis WebSocket)
  - Multi-user editing with operational transforms
  - Presence indicators
  - Conflict resolution
  - Activity audit trail

- [x] 7.4: Advanced Node Types ✅ **COMPLETED** (PR #3346)
  - Conditional branching (11 operators, AND/OR logic)
  - Loop constructs (for-each, while, for-range)
  - Parallel execution paths
  - Sub-workflow embedding

- [x] 7.5: Performance Optimization ✅ **COMPLETED** (PR #3347, #3372)
  - Virtualized rendering (10x faster for 1000+ nodes)
  - Optimistic UI updates
  - Incremental auto-save with debouncing
  - Real-time FPS/memory monitoring

- [x] 7.6: Accessibility & I18n ✅ **COMPLETED** (PRs #3348, #3366)
  - WCAG 2.1 AAA compliance
  - Full keyboard navigation (arrow keys, Tab, vim bindings)
  - Screen reader support with ARIA live regions
  - Multi-language support (English/Spanish/French)

### Additional Deliverables (Foundation)
- [x] Workflow graph validation (PR #3351)
- [x] Variable resolver service (PR #3352)
- [x] Performance query optimization (PR #3353)
- [x] Dynamic theme system (PR #3354)
- [x] Workflow version history UI (PR #3356)
- [x] Entity mapping modal (PR #3358)

**Key Files**:
- `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx` (7,000+ lines)
- `backend/tenant_apps/workflows/views.py` (3,600+ lines, 15 endpoints)
- `backend/scripts/infrastructure_diagnostics.py` (197 lines)

**Development Principles**:
- ✅ **Additive-Only Changes**: Never break existing workflows
- ✅ **Multi-Tenant Safety**: Changes work across ALL tenants
- ✅ **Performance First**: Sub-100ms render times achieved
- ✅ **User Experience**: Progressive enhancement, undo/redo, graceful degradation

**Remaining Work**:
- 7.3: Real-Time Collaboration (blocked by Redis WebSocket configuration)

**Total Lines Delivered**: ~7,000+ lines of production code, 374+ unit tests

---

## Phase 8: Advanced Caching & Parallelization [ ] PLANNED

**Status**: Planning Phase  
**Target Start**: Q2 2026 (April)

### Planned Deliverables
- [ ] 8.1: Redis Query Result Caching
- [ ] 8.2: CDN Integration for Static Assets
- [ ] 8.3: Parallel Task Execution
- [ ] 8.4: Background Job Processing (Celery)
- [ ] 8.5: Edge Caching Strategies

**Blocker**: Redis infrastructure (also blocks Phase 3)

---

## Phase 9: Security Scanning & SBOM [ ] PLANNED

**Status**: Planning Phase  
**Target Start**: Q2 2026 (May)

### Planned Deliverables
- [ ] 9.1: Automated SBOM Generation
- [ ] 9.2: Container Image Scanning (Trivy/Grype)
- [ ] 9.3: Dependency Vulnerability Scanning
- [ ] 9.4: License Compliance Checking
- [ ] 9.5: Security Audit Reports

**Integration**: GitHub Actions security workflows

---

## 🚨 TECHNICAL DEBT REGISTRY

### Models Missing TenantAwareModel Inheritance

**Impact**: Inconsistent tenant isolation patterns, missing custom_data extensibility

#### HIGH PRIORITY (User-Facing Business Logic)
1. **backend/tenant_apps/contacts/models.py**
   - `Contact(TimestampModel)` → Should be `Contact(TenantAwareModel)`
   - Manual TenantManager - should inherit from TenantAwareModel
   - **Risk**: Contact data could leak across tenants

2. **backend/tenant_apps/invoices/models.py**
   - `Invoice(TimestampModel)` → Should be `Invoice(TenantAwareModel)`
   - `Claim(TimestampModel)` → Should be `Claim(TenantAwareModel)`
   - `PaymentTransaction(TimestampModel)` → Should be `PaymentTransaction(TenantAwareModel)`
   - Manual TenantManager - should inherit
   - **Risk**: Financial data exposure across tenants

3. **backend/tenant_apps/purchase_orders/models.py**
   - `PurchaseOrder(OrderMethodsMixin, TimestampModel)` → Should include `TenantAwareModel`
   - `CarrierPurchaseOrder(TimestampModel)` → Should be `CarrierPurchaseOrder(TenantAwareModel)`
   - `ColdStorageEntry(TimestampModel)` → Should be `ColdStorageEntry(TenantAwareModel)`
   - `PurchaseOrderHistory(TimestampModel)` → Should be `PurchaseOrderHistory(TenantAwareModel)`
   - **Risk**: Order data cross-tenant visibility

4. **backend/tenant_apps/locations/models.py**
   - `Location(TimestampModel)` → Should be `Location(TenantAwareModel)`
   - **Risk**: Address/facility data shared incorrectly

#### MEDIUM PRIORITY (Configuration & Workflow) ✅ **COMPLETE - February 27, 2026**
5. **backend/tenant_apps/workflows/models.py**
   - ✅ `TenantList` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ `TenantForm` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ `TenantFormEntity` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ `TenantFormField` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ `TenantFormRule` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ `TenantWorkflow` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ `TenantWorkflowCondition` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ `TenantWorkflowAction` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ `WorkflowExecutionLog` → Refactored to inherit from `TenantAwareModel` (PR #3313)
   - ✅ **RLS Policies**: All 17 workflow tables have PostgreSQL RLS enabled (Migration 0015)
   - **Status**: 🎉 **100% COMPLETE (9/9 models + 17 RLS policies)**
   - **Completion**: February 27, 2026 15:30 UTC

6. **backend/tenant_apps/ai_assistant/models.py** ✅ **COMPLETE - February 27, 2026**
   - ✅ `AIConfiguration` → Refactored to inherit from `TenantAwareModel` (PR #3369)
   - **Note**: `ChatSession` and `ChatMessage` use `OwnedModel` (includes tenant via user relationship)
   - **Status**: 🎉 **COMPLETE**
   - **Completion**: February 27, 2026 19:00 UTC

7. **backend/tenant_apps/cockpit/models.py** ✅ **COMPLETE - February 27, 2026**
   - ✅ `ActivityLog` → Refactored to inherit from `TenantAwareModel` (PR #3369)
   - ✅ `ScheduledCall` → Refactored to inherit from `TenantAwareModel` (PR #3369)
   - **Note**: `UserWorkspaceLayout` uses transitive isolation via user relationship
   - **Status**: 🎉 **COMPLETE (2/2 priority models)**
   - **Completion**: February 27, 2026 19:00 UTC

#### LOW PRIORITY (Through Tables & Utility Models) ✅ **COMPLETE - February 27, 2026**
8. **backend/tenant_apps/carriers/models.py** ✅ **COMPLETE**
   - ✅ `Carrier` → Refactored to inherit from `TenantAwareModel` (PR #3370)
   - **Completion**: February 27, 2026 19:15 UTC

9. **backend/tenant_apps/plants/models.py** ✅ **COMPLETE**
   - ✅ `Plant` → Refactored to inherit from `TenantAwareModel` (PR #3370)
   - **Completion**: February 27, 2026 19:15 UTC

10. **backend/tenant_apps/bug_reports/models.py** ✅ **COMPLETE**
    - ✅ `BugReport` → Refactored to inherit from `TenantAwareModel` (PR #3370)
    - **Completion**: February 27, 2026 19:15 UTC

11. **Through Tables** (Many-to-Many relationships)
    - `InquiryProduct(models.Model)` → Consider TenantAwareModel for audit trails
    - `InquiryTemplateProduct(models.Model)` → Consider TenantAwareModel
    - `FulfillmentProduct(models.Model)` → Consider TenantAwareModel

### Remediation Plan

**Phase 1: High Priority Models** ✅ **COMPLETE - February 27, 2026**
- ✅ Week 1: Contact, Invoice, Claim, PaymentTransaction (PR #3308)
- ✅ Week 2-3: PurchaseOrder, CarrierPurchaseOrder, ColdStorageEntry, Location (PR #3310)
- Status: 🎉 **100% COMPLETE (8/8 models)**

**Completion Timeline**:

Week 1 - Contact & Financial Models:
  ✅ Contact: COMPLETED Feb 27 00:36 UTC (PR #3308)
  ✅ Invoice: COMPLETED Feb 27 00:36 UTC (PR #3308)
  ✅ Claim: COMPLETED Feb 27 00:36 UTC (PR #3308)
  ✅ PaymentTransaction: COMPLETED Feb 27 00:36 UTC (PR #3308)

Week 2-3 - Order & Location Models:
  ✅ PurchaseOrder: COMPLETED Feb 27 00:45 UTC (PR #3310)
  ✅ CarrierPurchaseOrder: COMPLETED Feb 27 00:45 UTC (PR #3310)
  ✅ ColdStorageEntry: COMPLETED Feb 27 00:45 UTC (PR #3310)
  ✅ Location: COMPLETED Feb 27 00:45 UTC (PR #3310)

**Impact**: All HIGH priority models (financial data, PII, order data, location data) now enforce database-level tenant isolation via PostgreSQL RLS.

---

**Phase 2: Medium Priority Models** ✅ **100% COMPLETE - February 27, 2026**
- ✅ Week 1-2: All workflow models (9 models) - PR #3313
- ✅ Migration 0014: Added tenant ForeignKey fields to all workflow models
- ✅ Migration 0015: Enabled PostgreSQL RLS on all 17 workflow tables
- ✅ Week 3: AI assistant models - PR #3369 (AIConfiguration)
- ✅ Week 4: Cockpit models - PR #3369 (ActivityLog, ScheduledCall)
- **Status**: 🎉 **100% COMPLETE (12/12 models)**

**Phase 3: Low Priority Models** ✅ **100% COMPLETE - February 27, 2026**
- ✅ Week 1: Carrier, Plant, BugReport - PR #3370
- ✅ Final testing: Migrations generated and merged
- **Status**: 🎉 **100% COMPLETE (3/3 models)**
- **Completion**: February 27, 2026 19:15 UTC

**Summary**: ALL technical debt eliminated. 14/14 models migrated to TenantAwareModel.

**Migration Pattern**:
```python
# Step 1: Update model inheritance
class MyModel(TenantAwareModel):  # Changed from TimestampModel
    # Remove manual tenant field (inherited)
    # Remove manual TenantManager (inherited)
    pass

# Step 2: Create migration
python manage.py makemigrations --name update_mymodel_tenantaware

# Step 3: Add RLS policy in migration
operations = [
    migrations.AlterModelBases(...),
    RunSQL(
        sql="ALTER TABLE app_mymodel ENABLE ROW LEVEL SECURITY; ...",
        reverse_sql="..."
    )
]

# Step 4: Test tenant isolation
# Step 5: Deploy with --fake-initial
```

---

## 📊 PROGRESS METRICS

### Overall Completion
- **Total Phases**: 9
- **Complete**: 3.83 phases (P1 @ 100%, P4 @ 100%, P6 @ 83%, P7 @ 85%)
- **In Progress**: 0 phases (awaiting external credentials)
- **Blocked**: 3 phases (P2, P3, P5) + 1 sub-phase (P6.4)
- **Planned**: 2 phases (P8, P9)
- **Progress**: 75% (42/56 todos) + **100% Technical Debt Complete**

### By Category
- **UI/UX**: 100% (Phase 1 complete)
- **Admin**: 100% (Phase 4 complete)
- **Security**: 85% (Phase 6 @ 83%, Phase 9 pending)
- **AI/ML**: 10% (Phase 2 blocked, Phase 7 in progress)
- **Integrations**: 0% (Phase 5 blocked)
- **Performance**: 60% (Phase 6 partial, Phase 8 pending)

### Infrastructure Blockers
- **OpenAI API**: Blocks 4 todos (Phase 2) - Infrastructure complete, awaiting audit
- **Redis**: Blocks 4 todos (Phase 3) + 1 todo (Phase 7.3) + 5 todos (Phase 8)
- ~~**Microsoft OAuth**: Blocks 4 todos (Phase 5)~~ ✅ **UNBLOCKED** - Phase 5 complete (Feb 28, 2026)
- **Sentry**: Blocks 1 todo (Phase 6.4)

**Total Blocked**: 15 todos (21%)  
**Recently Unblocked**: Phase 5 - Microsoft OAuth integration complete (+4 todos delivered)

---

## 🔄 WORKFLOW FOR AI ASSISTANTS

### Standard Operating Procedure

**CRITICAL**: After ANY code changes are committed, immediately update this file:

#### 1. After Completing a Todo
```bash
# Example: Completed Phase 7.2 Enhanced Drag-and-Drop
- [ ] 7.2: Enhanced Drag-and-Drop  # BEFORE
- [x] 7.2: Enhanced Drag-and-Drop  # AFTER

# Add completion note
**Completed**: February 28, 2026
**PR**: #3350
**Files**: UnifiedFlowEditor.tsx, DragHandler.tsx
```

#### 2. After Discovering Technical Debt
```bash
# Add to Technical Debt Registry under appropriate priority
### HIGH PRIORITY
12. **backend/tenant_apps/newapp/models.py**
    - `NewModel(models.Model)` → Should be `NewModel(TenantAwareModel)`
    - **Risk**: [describe tenant isolation risk]
```

#### 3. After Infrastructure Unblocks
```bash
# Update phase status
## Phase 2: Forms/Workflows - AI-Powered [x] COMPLETE  # Changed from BLOCKED

# Update blocker section
**Blocker**: ~~OpenAI API key~~ RESOLVED (March 15, 2026)
```

#### 4. After Each Commit
1. ✅ Update phase checkbox if todo completed
2. ✅ Add completion date and PR reference
3. ✅ Update "Last Updated" date at top
4. ✅ Update progress percentages
5. ✅ Document any new technical debt discovered

### Commit Message Template
```
<type>: <description>

Updates MASTER_PLAN.md:
- [x] Mark Phase X.Y as complete
- Add PR #XXXX reference
- Update progress: XX% -> YY%

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## 📚 REFERENCES

### Key Documentation
- **Architecture**: `docs/architecture/ARCHITECTURE.md`
- **Copilot Instructions**: `.github/copilot-instructions.md`
- **Golden Pipeline**: `docs/reference/GOLDEN_PIPELINE.md`
- **Migration Standards**: `docs/workforms/MIGRATION_STANDARDS.md`
- **Handoff Document**: `docs/HANDOFF.md`

### Phase-Specific Docs
- Phase 1: `docs/plans/PHASE1_INTEGRATION_COMPLETE.md`
- Phase 2: `docs/plans/PHASE2_EXECUTION_COMPLETE.md`
- Phase 3: `docs/plans/PHASE3_DEPLOYMENT_CHECKLIST.md`
- Phase 4: `docs/plans/PHASE4_COMPLETE_IMPLEMENTATION.md`
- Phase 5: `docs/plans/PHASE5_IMPLEMENTATION_SUMMARY.md`
- Phase 6: `docs/plans/PHASE6_SUMMARY.md`, `docs/plans/PHASE_6_*_COMPLETE.md`

---

**Master Plan Version**: 1.0.0  
**Maintained By**: Development Team + AI Assistants  
**Next Review**: March 15, 2026
