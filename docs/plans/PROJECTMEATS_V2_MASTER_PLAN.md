# ProjectMeats v2.0 Master Plan

## Unified System-Wide Overhaul

**Document Version**: 2.0  
**Created**: 2026-01-31  
**Last Updated**: 2026-01-31  
**Status**: 📋 MASTER PLAN - Awaiting Approval  
**Classification**: INDUSTRY LEADING IMPLEMENTATION  
**Estimated Duration**: 14-18 weeks

---

## Table of Contents

1. [Vision Statement](#vision-statement)
2. [Core Principles](#core-principles)
3. [Current State Analysis](#current-state-analysis)
4. [Gap Analysis](#gap-analysis)
5. [Architecture Overview](#architecture-overview)
6. [Unified Workstreams](#unified-workstreams)
7. [Implementation Waves](#implementation-waves)
8. [Security Hardening Plan](#security-hardening-plan)
9. [Real-Time & Background Processing](#real-time--background-processing)
10. [Documentation Overhaul](#documentation-overhaul)
11. [Zero-Breaking-Change Strategy](#zero-breaking-change-strategy)
12. [Success Metrics](#success-metrics)
13. [Risk Management](#risk-management)
14. [Quality Assurance](#quality-assurance)

---

## Vision Statement

> **Transform ProjectMeats into an industry-leading meat trading platform with a world-class user experience, enterprise-grade architecture, and extensible foundation for future growth.**

### The v2.0 Promise

| From (Current) | To (v2.0) |
|----------------|-----------|
| 19 fragmented apps | 12 unified apps |
| Scattered configuration | 3-tier unified config system |
| Static dashboard | Cockpit Command Center |
| Basic forms | Intelligent Forms & Flows |
| Dated admin UI | Modern visual editors |
| 55+ disorganized docs | Clean, navigable documentation |
| Mixed code patterns | Consistent, industry-standard codebase |
| No rate limiting | Enterprise security hardening |
| Synchronous only | Background jobs + Real-time updates |
| Perpetual tokens | JWT with refresh token rotation |
| ~40% test coverage | 80% backend, 70% frontend |

---

## Current State Analysis

### Tech Stack Assessment

| Layer | Current | Status | Notes |
|-------|---------|--------|-------|
| **Frontend** | React 19.2 + Vite 6.4 + TypeScript 5.7 | ✅ Modern | Best-in-class |
| **UI Library** | Ant Design 5.27 + Lucide | ✅ Modern | Consistent design system |
| **State** | React Query + Context API | ✅ Good | Consider Zustand for complex state |
| **Styling** | Styled Components + Tailwind | ⚠️ Dual | Standardize on one |
| **Forms** | React Hook Form + Zod | ✅ Modern | Industry standard |
| **Backend** | Django 5.0 + DRF 3.15 | ✅ Modern | Strong foundation |
| **Database** | PostgreSQL | ✅ Excellent | With RLS prepared |
| **Auth** | Token-based (DRF) | ⚠️ Needs upgrade | Move to JWT |
| **Caching** | LocMemCache only | ❌ Weak | Add Redis |
| **Background Jobs** | None | ❌ Missing | Add Celery/RQ |
| **Real-time** | None | ❌ Missing | Add WebSockets |
| **Mobile** | React Native (Expo) | ✅ Active | Well structured |
| **Testing** | Vitest + pytest | ⚠️ Low coverage | Increase coverage |
| **CI/CD** | GitHub Actions | ✅ Excellent | Golden pipeline achieved |

### Codebase Health

```
┌─────────────────────────────────────────────────────────────────────┐
│                       CODEBASE HEALTH REPORT                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Backend Apps                    19 apps  ⚠️ Too many (target: 12)   │
│  Documentation Files             57 files ⚠️ Disorganized            │
│  Test Coverage (Backend)         ~40%     ❌ Below standard          │
│  Test Coverage (Frontend)        ~30%     ❌ Below standard          │
│  TypeScript Strict Mode          ✅       Enabled                    │
│  Linting/Formatting              ✅       Black + Prettier           │
│  Security Headers                ✅       HSTS, XSS, etc.            │
│  Rate Limiting                   ❌       Not implemented            │
│  Background Processing           ❌       Not implemented            │
│  Real-time Features              ❌       Not implemented            │
│  API Documentation               ⚠️       Partial (OpenAPI exists)  │
│  Production Runbooks             ❌       Missing                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Gap Analysis

### 🔴 CRITICAL GAPS (Must Fix)

| Gap | Impact | Risk | Solution |
|-----|--------|------|----------|
| **No Rate Limiting** | Brute force attacks, DDoS | HIGH | DRF throttling + django-ratelimit |
| **Perpetual Auth Tokens** | Token theft = permanent access | HIGH | JWT with refresh rotation |
| **No Background Jobs** | Long operations block requests | HIGH | Celery + Redis |
| **No GDPR Compliance** | Legal liability | HIGH | Data export/deletion endpoints |
| **Missing Production Runbooks** | Incident response failure | HIGH | Create runbooks |
| **No CSP Headers** | XSS vulnerability | MEDIUM | Add Content-Security-Policy |

### 🟡 HIGH-PRIORITY GAPS

| Gap | Impact | Solution |
|-----|--------|----------|
| **No Real-time Updates** | Stale UI, poor UX | Django Channels + WebSockets |
| **No Redis Caching** | Slow config resolution | Redis for caching + sessions |
| **Low Test Coverage** | Regressions, bugs | Increase to 80%/70% |
| **Dual Styling Approach** | Inconsistency | Standardize on Tailwind |
| **No Monitoring/Alerting** | Blind to issues | Sentry + custom dashboards |
| **Missing API Versioning** | Breaking client apps | Formal deprecation policy |

### 🟢 IMPROVEMENT OPPORTUNITIES

| Area | Current | Target |
|------|---------|--------|
| Documentation index | None | Full searchable index |
| New dev onboarding | Partial | Complete checklist |
| Architecture diagrams | Text-only | Visual diagrams |
| E2E tests | None | Critical path coverage |
| Performance benchmarks | None | Baseline metrics |
| Mobile cert pinning | None | Implement for security |
| Admin 2FA | None | Required for admin access |

---

## Core Principles

Every decision in this plan follows these **NON-NEGOTIABLE** principles:

| Principle | Definition | Application |
|-----------|------------|-------------|
| **UI/UX** | Beautiful, responsive, accessible | All new components WCAG 2.1 AA compliant |
| **FUNCTIONALITY** | Complete, production-ready features | No half-built features shipped |
| **INTUITIVE** | Zero learning curve | <5 clicks for any task |
| **SMART** | AI-assisted, context-aware | Predictive suggestions throughout |
| **SIMPLE** | Clean, uncluttered interfaces | Progressive disclosure pattern |
| **EFFICIENT** | Minimal friction, maximum output | Keyboard shortcuts, batch operations |
| **DYNAMIC** | Real-time, responsive to context | WebSocket updates where beneficial |
| **POWERFUL** | Deep functionality available | Power users have advanced options |
| **IDEAL** | Optimized for meat trading | Industry-specific workflows |
| **EXTENSIBLE** | Plugin-ready, future-proof | Clean API contracts, modular design |

### The "No Breaking Changes" Guarantee

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ZERO BREAKING CHANGES CONTRACT                    │
├─────────────────────────────────────────────────────────────────────┤
│  ✓ All existing URLs continue to work (redirects where renamed)     │
│  ✓ All existing API endpoints maintained (deprecated gracefully)    │
│  ✓ All existing data preserved (migration, not deletion)            │
│  ✓ All existing user workflows supported (enhanced, not removed)    │
│  ✓ All existing integrations functional (API versioning)            │
│  ✓ CI/CD pipeline never broken (tested before merge)                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Overview

### Target System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PROJECTMEATS v2.0                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         PRESENTATION LAYER                               │    │
│  ├─────────────────────────────────────────────────────────────────────────┤    │
│  │                                                                          │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │    │
│  │  │   COCKPIT    │  │    FORMS     │  │    ADMIN     │  │   MOBILE     │ │    │
│  │  │   Command    │  │   & Flows    │  │   Studio     │  │    (PWA)     │ │    │
│  │  │   Center     │  │              │  │              │  │              │ │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │    │
│  │                                                                          │    │
│  │  ┌─────────────────────────────────────────────────────────────────────┐│    │
│  │  │                    SHARED COMPONENT LIBRARY                         ││    │
│  │  │  EntityGraph │ WidgetSystem │ CommandPalette │ NotificationCenter  ││    │
│  │  └─────────────────────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                          SERVICE LAYER                                   │    │
│  ├─────────────────────────────────────────────────────────────────────────┤    │
│  │                                                                          │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │    │
│  │  │   CONFIG     │  │   ENTITY     │  │   WORKFLOW   │  │   SEARCH     │ │    │
│  │  │   Resolver   │  │ Persistence  │  │   Engine     │  │   Engine     │ │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                          DATA LAYER                                      │    │
│  ├─────────────────────────────────────────────────────────────────────────┤    │
│  │                                                                          │    │
│  │  ┌─────────────────────────────────────────────────────────────────────┐│    │
│  │  │                   3-TIER CONFIGURATION                              ││    │
│  │  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           ││    │
│  │  │  │ SYSTEM CORE   │  │    SYSTEM     │  │    TENANT     │           ││    │
│  │  │  │ (Superuser)   │→ │(System Admin) │→ │(Tenant Admin) │           ││    │
│  │  │  └───────────────┘  └───────────────┘  └───────────────┘           ││    │
│  │  └─────────────────────────────────────────────────────────────────────┘│    │
│  │                                                                          │    │
│  │  ┌─────────────────────────────────────────────────────────────────────┐│    │
│  │  │                   BUSINESS ENTITIES (12 APPS)                       ││    │
│  │  │  system │ tenants │ contacts │ customers │ suppliers │ locations   ││    │
│  │  │  orders │ accounting │ workflows │ workspace │ feedback │ ai       ││    │
│  │  └─────────────────────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 12-App Target Structure

```
backend/
├── apps/                           # System-level apps
│   ├── system/                     # Was: core + products
│   │   ├── models/
│   │   │   ├── protein.py
│   │   │   ├── product.py
│   │   │   ├── system_choice.py    # NEW: SystemChoiceList
│   │   │   ├── system_schema.py    # NEW: SystemFieldSchema
│   │   │   └── tenant_config.py    # NEW: TenantConfig
│   │   ├── services/
│   │   │   ├── config_resolver.py  # NEW: Effective config resolution
│   │   │   └── search_engine.py    # NEW: Universal search
│   │   └── admin.py
│   └── tenants/                    # Multi-tenancy (unchanged)
│
├── tenant_apps/                    # Business apps
│   ├── contacts/                   # Contact management
│   ├── customers/                  # Customer master data
│   ├── suppliers/                  # Supplier master data
│   ├── locations/                  # Was: locations + plants
│   ├── orders/                     # Was: purchase_orders + sales_orders
│   ├── accounting/                 # Was: invoices + accounts_receivables
│   ├── workflows/                  # Forms, workflows, automation
│   ├── workspace/                  # Was: cockpit
│   ├── feedback/                   # Was: bug_reports
│   └── ai_assistant/               # AI/ML features
│
└── shared_apps/                    # EMPTY (deleted system_config)
```

---

## Unified Workstreams

This plan unifies **three existing plans** into **seven coordinated workstreams**:

| Workstream | Source Plans | Focus | Duration |
|------------|--------------|-------|----------|
| **W1: Foundation** | Data Entity + Admin Revamp | App cleanup, config system, permissions | Weeks 1-4 |
| **W2: Security** | NEW | Auth hardening, rate limiting, GDPR | Weeks 2-4 |
| **W3: Infrastructure** | NEW | Redis, Celery, WebSockets | Weeks 3-7 |
| **W4: Cockpit** | Forms & Flows | Command center, universal search, entity graph | Weeks 5-9 |
| **W5: Forms & Flows** | Forms & Flows | Workflow engine, action items, notifications | Weeks 5-9 |
| **W6: Admin Studio** | Admin Revamp | Visual editors, Django admin enhancement | Weeks 6-10 |
| **W7: Repository** | NEW | Code cleanup, docs organization, testing | Weeks 1-14 |

### Workstream Dependencies

```
                    ┌─────────────┐
                    │ W1: FOUND-  │
                    │   ATION     │
                    │ (Weeks 1-4) │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌───────────┐ ┌───────────┐ ┌───────────┐
       │    W2:    │ │    W3:    │ │    W7:    │
       │ SECURITY  │ │  INFRA    │ │   REPO    │
       │(Weeks 2-4)│ │(Weeks 3-7)│ │(Weeks 1-14)│
       └─────┬─────┘ └─────┬─────┘ └───────────┘
             │             │              ↑
             └──────┬──────┘              │
                    │                     │
    ┌───────────────┼───────────────┐     │
    │               │               │     │
    ▼               ▼               ▼     │
┌─────────┐   ┌─────────┐   ┌─────────┐   │
│   W4:   │   │   W5:   │   │   W6:   │   │
│ COCKPIT │   │  FORMS  │   │  ADMIN  │   │
│(Wk 5-9) │   │(Wk 5-9) │   │(Wk 6-10)│   │
└────┬────┘   └────┬────┘   └────┬────┘   │
     │             │             │        │
     └─────────────┼─────────────┘        │
                   │                      │
                   ▼                      │
            ┌─────────────┐               │
            │   WAVE 6:   │───────────────┘
            │   MODEL     │
            │ MIGRATIONS  │
            │(Weeks 10-14)│
            └─────────────┘
                   │
                   ▼
            ┌─────────────┐
            │   WAVE 7:   │
            │   FINAL     │
            │(Weeks 14-18)│
            └─────────────┘
```

### Critical Path

```
Foundation → Security + Infrastructure → Cockpit/Forms/Admin → Model Migrations → Finalization
   (4 wk)        (5 wk parallel)           (5 wk parallel)         (4 wk)          (4 wk)
                                                                              Total: 14-18 weeks
```

---

## Implementation Waves

### Wave 0: Preparation (Week 0)

**Goal**: Set up for success without touching production code

- [ ] **0.1** Create `v2.0/master` feature branch
- [ ] **0.2** Set up feature flags for gradual rollout
- [ ] **0.3** Create comprehensive test suite baseline
- [ ] **0.4** Document all current API endpoints
- [ ] **0.5** Create database backup and restore procedures
- [ ] **0.6** Set up monitoring dashboards

---

### Wave 1: Foundation (Weeks 1-4)

**Goal**: Establish the architectural foundation without breaking existing functionality

#### Week 1: Safe Deletions & New Models

| Task | Risk | Breaking? | Rollback |
|------|------|-----------|----------|
| Delete `schema_builder` app (0 records) | 🟢 Low | No | Re-add to INSTALLED_APPS |
| Delete `accounts_receivables` app (0 records) | 🟢 Low | No | Re-add to INSTALLED_APPS |
| Create `SystemChoiceList` model | 🟢 Low | No | Drop table |
| Create `SystemChoiceItem` model | 🟢 Low | No | Drop table |
| Create `SystemFieldSchema` model | 🟢 Low | No | Drop table |
| Create `TenantConfig` model | 🟢 Low | No | Drop table |
| Create `ConfigResolver` service | 🟢 Low | No | Delete file |

**Deliverables**:
- [ ] PR: Delete unused apps
- [ ] PR: New config models + migrations
- [ ] PR: ConfigResolver service
- [ ] PR: `seed_system_choices` command

#### Week 2: Config System Integration

| Task | Risk | Breaking? | Rollback |
|------|------|-----------|----------|
| Create config API endpoints | 🟢 Low | No | Delete endpoints |
| Seed system choice lists | 🟢 Low | No | Truncate tables |
| Create `configService.ts` frontend | 🟢 Low | No | Delete file |
| Add permission classes | 🟢 Low | No | Remove decorators |

**Deliverables**:
- [ ] PR: Config API endpoints
- [ ] PR: Frontend config service
- [ ] PR: Seeded choice lists (proteins, statuses, etc.)

#### Week 3: Safe Renames (Backward Compatible)

| Task | Risk | Breaking? | Rollback |
|------|------|-----------|----------|
| Rename `bug_reports` → `feedback` | 🟡 Medium | No* | Git revert |
| Rename `cockpit` → `workspace` | 🟡 Medium | No* | Git revert |
| Update frontend API paths | 🟡 Medium | No* | Git revert |

*With URL redirects and API aliases, old paths continue to work.

**Strategy**:
```python
# Keep old URL working with redirect
urlpatterns = [
    path('api/v1/cockpit/', include('workspace.urls')),  # Old (redirect)
    path('api/v1/workspace/', include('workspace.urls')), # New (canonical)
]
```

**Deliverables**:
- [ ] PR: Rename bug_reports → feedback
- [ ] PR: Rename cockpit → workspace
- [ ] PR: URL redirects and API aliases

#### Week 4: Complex Renames & Frontend Migration for system_config

| Task | Risk | Breaking? | Rollback |
|------|------|-----------|----------|
| Rename `invoices` → `accounting` | 🟡 Medium | No* | Git revert |
| Migrate admin-studio from system_config | 🟡 Medium | No | Feature flag |
| Delete `system_config` app | 🟢 Low | No | Re-add |

**Deliverables**:
- [ ] PR: Rename invoices → accounting
- [ ] PR: Admin-studio migration
- [ ] PR: Delete system_config app

---

### Wave 2: Cockpit Command Center (Weeks 5-8)

**Goal**: Replace static dashboard with intelligent command center

#### Week 5: Backend APIs

- [ ] **Universal Search API**
  - `GET /api/v1/search/universal/`
  - Cross-entity search with ranking
  - Search operators (supplier:, po:, @user)
  
- [ ] **Entity Graph API**
  - `GET /api/v1/entities/{type}/{id}/`
  - `GET /api/v1/entities/{type}/{id}/relationships/`
  - Relationship traversal with depth control

- [ ] **Cockpit Layout API**
  - `GET /api/v1/cockpit/layout/`
  - `PUT /api/v1/cockpit/layout/`
  - Widget configuration storage

#### Week 6: Command Palette & Search

- [ ] `CommandPalette` component (⌘K / Ctrl+K)
- [ ] `SearchResultsList` with entity grouping
- [ ] Search debouncing and caching
- [ ] Recent items section
- [ ] Quick actions integration

#### Week 7: Entity Graph Visualization

- [ ] Graph library setup (react-flow)
- [ ] `EntityNode` component with type variants
- [ ] `EntityEdge` component for relationships
- [ ] Node expansion on double-click
- [ ] `InlineEditPanel` for editing
- [ ] Graph layout algorithms

#### Week 8: Widget System & Assembly

- [ ] `WidgetGrid` with react-grid-layout
- [ ] Core widgets:
  - MyTasksWidget
  - TodaysNumbersWidget
  - UpcomingCallsWidget
  - RecentActivityWidget
  - QuickActionsWidget
  - EntityExplorerWidget
- [ ] `CockpitPage` assembly
- [ ] Layout persistence
- [ ] Feature flag: `ENABLE_COCKPIT=true`

---

### Wave 3: Forms & Flows Enhancement (Weeks 5-8)

**Goal**: Transform forms into intelligent, action-aware workflows

#### Week 5: Backend Models & APIs

- [ ] `FormStatusHistory` model
- [ ] `StepAssignment` model
- [ ] `UserNotification` model
- [ ] `UserNotificationPreferences` model
- [ ] `/api/v1/workflows/action-items/` endpoint
- [ ] `/api/v1/workflows/action-items/counts/` endpoint

#### Week 6: Navigation & My Tasks

- [ ] Update navigation structure
- [ ] Badge support in sidebar
- [ ] `MyTasks` page with filtering
- [ ] `ActionItemCard` component
- [ ] Overdue highlighting

#### Week 7: Notifications System

- [ ] `NotificationBell` component
- [ ] `NotificationPanel` component
- [ ] `NotificationsContext`
- [ ] Email notification service
- [ ] Notification preferences UI

#### Week 8: Calls Page Overhaul

- [ ] Rename CallLog → Calls
- [ ] Redesign with view toggles
- [ ] Enhanced calendar view
- [ ] Quick call modal overhaul
- [ ] Call intelligence features

---

### Wave 4: Admin Studio Enhancement (Weeks 6-10)

**Goal**: Create visual editors for system and tenant configuration

#### Week 6-7: Django Admin Enhancement

- [ ] `SystemChoiceListAdmin` with inline items
- [ ] Custom `change_form.html` with Alpine.js
- [ ] Drag-drop reordering
- [ ] Import/export functionality
- [ ] Tier-based permission checks
- [ ] Admin panel reorganization (emoji groups)

#### Week 8-9: React Admin Studio

- [ ] `ConfigDashboard` page
- [ ] `ChoiceListEditor` component
- [ ] Enhanced `SchemaEditor`
- [ ] `TenantConfigEditor`
- [ ] Keyboard shortcuts

#### Week 10: Integration & Polish

- [ ] Update FormSubmissionModal to use ConfigResolver
- [ ] Update choicesService to use new API
- [ ] Test all dropdown fields
- [ ] Performance optimization

---

### Wave 5: Repository Cleanup (Weeks 1-12, Parallel)

**Goal**: Clean, organized, maintainable codebase

#### Documentation (Weeks 1-4)

- [ ] Create `/docs/README.md` index
- [ ] Create directory structure:
  ```
  docs/
  ├── getting-started/
  ├── architecture/
  ├── guides/
  ├── reference/
  ├── plans/
  ├── features/
  └── archive/
  ```
- [ ] Move docs to appropriate directories
- [ ] Consolidate duplicates:
  - Payment docs (4 → 2)
  - Invitation docs (6 → 2)
  - Email docs (3 → 1)
  - Database sync docs (3 → 1)
- [ ] Archive completed implementations
- [ ] Add metadata to all docs

#### Code Cleanup (Weeks 5-8)

- [ ] Remove dead code identified by static analysis
- [ ] Standardize import ordering
- [ ] Apply consistent formatting (Black, Prettier)
- [ ] Add missing type hints
- [ ] Remove console.log statements
- [ ] Update deprecated dependencies

#### Testing (Weeks 8-12)

- [ ] Increase backend test coverage to 80%
- [ ] Increase frontend test coverage to 70%
- [ ] Add E2E tests for critical flows
- [ ] Add API contract tests
- [ ] Performance regression tests

---

### Wave 6: Model Migrations (Weeks 10-14)

**Goal**: Complete the data restructuring with zero downtime

#### Week 10-11: Locations + Plants Merge

- [ ] Move `Plant` model to `locations` app
- [ ] Add `location_type` discriminator
- [ ] Update all ForeignKey references
- [ ] Delete `plants` app
- [ ] Run migrations

#### Week 12-13: Orders Consolidation

- [ ] Create `orders` app
- [ ] Move `PurchaseOrder` models
- [ ] Move `SalesOrder` model
- [ ] Update all references
- [ ] Delete old apps

#### Week 14: Products to System

- [ ] Create `Product` in `system` app (no tenant FK)
- [ ] Deduplicate products (235 → ~32)
- [ ] Create ID mapping migration
- [ ] Update all ForeignKey references
- [ ] Delete `tenant_apps/products`

---

### Wave 7: Finalization (Weeks 14-16)

**Goal**: Polish, test, and release

#### Week 14-15: Integration Testing

- [ ] Full regression test suite
- [ ] Performance testing
- [ ] Security audit
- [ ] Accessibility audit
- [ ] Load testing

#### Week 15-16: Release

- [ ] Feature flag rollout (10% → 50% → 100%)
- [ ] Monitoring and alerting
- [ ] Documentation finalization
- [ ] Team training
- [ ] Stakeholder demo
- [ ] Production release

---

## Security Hardening Plan

### Wave S1: Authentication & Authorization (Week 2)

**Goal**: Replace perpetual tokens with industry-standard JWT

#### Tasks

- [ ] **S1.1** Install `djangorestframework-simplejwt`
- [ ] **S1.2** Configure access token (15 min) + refresh token (7 days)
- [ ] **S1.3** Implement token refresh endpoint
- [ ] **S1.4** Add token blacklist for logout
- [ ] **S1.5** Update frontend `authService.ts` for token refresh
- [ ] **S1.6** Migrate existing tokens (deprecation period)
- [ ] **S1.7** Add 2FA for admin panel (django-two-factor-auth)

**Configuration**:
```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}
```

### Wave S2: Rate Limiting (Week 2)

**Goal**: Prevent brute force and DDoS attacks

#### Tasks

- [ ] **S2.1** Install `django-ratelimit`
- [ ] **S2.2** Configure DRF throttling classes
- [ ] **S2.3** Add rate limits to auth endpoints (5/min anon, 60/min user)
- [ ] **S2.4** Add rate limits to API endpoints (100/min user)
- [ ] **S2.5** Add rate limits to admin panel
- [ ] **S2.6** Create rate limit exceeded response handler
- [ ] **S2.7** Add monitoring for rate limit hits

**Configuration**:
```python
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '20/minute',
        'user': '100/minute',
        'auth': '5/minute',  # Login attempts
    }
}
```

### Wave S3: Security Headers (Week 3)

**Goal**: Complete security header coverage

#### Tasks

- [ ] **S3.1** Add Content-Security-Policy header
- [ ] **S3.2** Configure CSP for inline scripts (nonces)
- [ ] **S3.3** Add Permissions-Policy header
- [ ] **S3.4** Verify all security headers in production
- [ ] **S3.5** Add security header tests

**Configuration**:
```python
CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC = ("'self'", "'nonce-{nonce}'")
CSP_STYLE_SRC = ("'self'", "'unsafe-inline'")  # Needed for styled-components
CSP_IMG_SRC = ("'self'", "data:", "https:")
CSP_FONT_SRC = ("'self'", "https://fonts.gstatic.com")
CSP_CONNECT_SRC = ("'self'", "https://api.sendgrid.com")
```

### Wave S4: GDPR Compliance (Week 4)

**Goal**: Legal compliance for data protection

#### Tasks

- [ ] **S4.1** Create `GET /api/v1/users/me/data-export/` endpoint
- [ ] **S4.2** Create `DELETE /api/v1/users/me/` endpoint (right to be forgotten)
- [ ] **S4.3** Implement data anonymization for soft-deletes
- [ ] **S4.4** Create audit log for data deletion requests
- [ ] **S4.5** Add data retention policy configuration
- [ ] **S4.6** Create privacy policy acceptance tracking
- [ ] **S4.7** Document GDPR compliance in legal docs

---

## Real-Time & Background Processing

### Wave R1: Redis Infrastructure (Week 3)

**Goal**: Add caching and message broker infrastructure

#### Tasks

- [ ] **R1.1** Add Redis to docker-compose
- [ ] **R1.2** Configure Django cache backend for Redis
- [ ] **R1.3** Configure session backend for Redis
- [ ] **R1.4** Add Redis to CI/CD pipeline
- [ ] **R1.5** Create Redis health check endpoint
- [ ] **R1.6** Document Redis configuration

**Configuration**:
```python
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': os.environ.get('REDIS_URL', 'redis://localhost:6379/0'),
    }
}

SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'
```

### Wave R2: Celery Background Tasks (Week 4-5)

**Goal**: Non-blocking long-running operations

#### Tasks

- [ ] **R2.1** Install Celery + celery[redis]
- [ ] **R2.2** Create `celery.py` app configuration
- [ ] **R2.3** Create base task classes with error handling
- [ ] **R2.4** Migrate email sending to async tasks
- [ ] **R2.5** Add PDF generation as async task
- [ ] **R2.6** Add data export as async task
- [ ] **R2.7** Create Celery beat for scheduled tasks
- [ ] **R2.8** Add Flower for task monitoring
- [ ] **R2.9** Add Celery to CI/CD deployment

**Use Cases**:
```python
# Email sending (currently blocks request)
@shared_task
def send_email_async(to, subject, body):
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [to])

# PDF generation
@shared_task
def generate_invoice_pdf_async(invoice_id):
    invoice = Invoice.objects.get(id=invoice_id)
    # Generate PDF, store in S3/media
    return pdf_url

# Data export (GDPR)
@shared_task
def export_user_data_async(user_id):
    # Compile all user data, create ZIP
    return download_url
```

### Wave R3: WebSocket Real-Time (Week 6-7)

**Goal**: Live updates for collaborative features

#### Tasks

- [ ] **R3.1** Install Django Channels + channels_redis
- [ ] **R3.2** Create ASGI application
- [ ] **R3.3** Create WebSocket consumer base class
- [ ] **R3.4** Implement notification WebSocket consumer
- [ ] **R3.5** Implement entity update WebSocket consumer
- [ ] **R3.6** Create frontend WebSocket service
- [ ] **R3.7** Add real-time notifications to Cockpit
- [ ] **R3.8** Add real-time entity graph updates
- [ ] **R3.9** Add WebSocket authentication
- [ ] **R3.10** Add connection heartbeat and reconnection

**Architecture**:
```
Frontend                    Backend
   │                           │
   │  WebSocket Connect        │
   │ ─────────────────────────►│
   │                           │
   │  Auth Token               │
   │ ─────────────────────────►│
   │                           │
   │  Subscribe: notifications │
   │ ─────────────────────────►│
   │                           │
   │  New Notification Event   │
   │ ◄─────────────────────────│
   │                           │
   │  Entity Updated Event     │
   │ ◄─────────────────────────│
```

**Consumer Example**:
```python
class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']
        self.tenant_id = self.scope['tenant_id']
        self.group_name = f'notifications_{self.user.id}'
        
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()
    
    async def notification_message(self, event):
        await self.send(text_data=json.dumps(event['data']))
```

---

## Documentation Overhaul

### New Documentation Structure

```
docs/
├── README.md                      # Master index with search hints
├── getting-started/
│   ├── QUICK_START.md             # 5-minute setup
│   ├── LOCAL_DEVELOPMENT.md       # Full local setup
│   ├── NEW_DEVELOPER_CHECKLIST.md # First week tasks (NEW)
│   └── IDE_SETUP.md               # Editor configuration (NEW)
│
├── architecture/
│   ├── OVERVIEW.md                # System architecture
│   ├── DATABASE_SCHEMA.md         # ER diagrams (NEW)
│   ├── API_DESIGN.md              # REST API principles (NEW)
│   ├── MULTI_TENANCY.md           # Shared-schema explanation
│   ├── AUTHENTICATION.md          # Auth flow diagrams
│   └── INFRASTRUCTURE.md          # Cloud architecture
│
├── guides/
│   ├── CONTRIBUTING.md            # Git workflow
│   ├── DEPLOYMENT.md              # How to deploy
│   ├── TESTING.md                 # Testing strategy (NEW)
│   ├── SECURITY.md                # Security practices (NEW)
│   └── TROUBLESHOOTING.md         # Common issues (NEW)
│
├── reference/
│   ├── API.md                     # Complete API reference (NEW)
│   ├── ENVIRONMENT_VARS.md        # All env vars
│   ├── CONFIGURATION.md           # Config options
│   └── CHANGELOG.md               # Version history
│
├── features/
│   ├── FORMS_AND_WORKFLOWS.md     # Form builder guide
│   ├── COCKPIT.md                 # Cockpit user guide (NEW)
│   ├── ADMIN_STUDIO.md            # Admin configuration
│   ├── GUEST_MODE.md              # Guest access
│   └── NOTIFICATIONS.md           # Notification system (NEW)
│
├── operations/
│   ├── RUNBOOKS.md                # Incident response (NEW)
│   ├── MONITORING.md              # Monitoring setup (NEW)
│   ├── BACKUP_RECOVERY.md         # DR procedures (NEW)
│   ├── SCALING.md                 # Scaling guide (NEW)
│   └── SECURITY_CHECKLIST.md      # Security audit (NEW)
│
├── plans/
│   ├── PROJECTMEATS_V2_MASTER_PLAN.md  # This document
│   └── PROGRESS_TRACKER.md        # Running progress
│
└── archive/
    ├── legacy_2025/               # Old architecture docs
    └── completed/                 # Implemented features
```

### Documentation Tasks

#### Wave D1: Structure & Index (Week 1-2)

- [ ] **D1.1** Create directory structure
- [ ] **D1.2** Create README.md master index
- [ ] **D1.3** Move existing docs to appropriate directories
- [ ] **D1.4** Create NEW_DEVELOPER_CHECKLIST.md
- [ ] **D1.5** Create IDE_SETUP.md

#### Wave D2: Missing Critical Docs (Week 3-4)

- [ ] **D2.1** Create DATABASE_SCHEMA.md with ER diagrams
- [ ] **D2.2** Create API.md comprehensive reference
- [ ] **D2.3** Create RUNBOOKS.md for incident response
- [ ] **D2.4** Create MONITORING.md
- [ ] **D2.5** Create BACKUP_RECOVERY.md
- [ ] **D2.6** Create SECURITY_CHECKLIST.md
- [ ] **D2.7** Create TESTING.md strategy guide

#### Wave D3: Consolidation (Week 5-6)

- [ ] **D3.1** Merge 4 payment docs → 2 (guide + technical)
- [ ] **D3.2** Merge 6 invitation docs → 2 (guide + troubleshooting)
- [ ] **D3.3** Merge 3 email docs → 1 comprehensive doc
- [ ] **D3.4** Merge 3 DB sync docs → 1 comprehensive doc
- [ ] **D3.5** Archive completed implementation docs
- [ ] **D3.6** Update all cross-references

---

## Zero-Breaking-Change Strategy

### API Versioning

```python
# All new endpoints under v2, v1 maintained
urlpatterns = [
    # v1 - Existing (maintained indefinitely)
    path('api/v1/', include([
        path('cockpit/', include('workspace.urls_v1')),  # Deprecated alias
        path('workspace/', include('workspace.urls_v1')),
    ])),
    
    # v2 - New (recommended)
    path('api/v2/', include([
        path('config/', include('system.urls_config')),
        path('workspace/', include('workspace.urls_v2')),
    ])),
]
```

### Feature Flags

```python
FEATURE_FLAGS = {
    'ENABLE_COCKPIT': False,          # New cockpit page
    'ENABLE_CONFIG_SYSTEM': False,    # New config resolution
    'ENABLE_ENTITY_GRAPH': False,     # Graph visualization
    'ENABLE_NEW_ADMIN': False,        # Enhanced admin UI
}
```

### URL Redirects

```python
# Old URLs redirect to new
from django.views.generic import RedirectView

urlpatterns = [
    path('call-log/', RedirectView.as_view(url='/calls/', permanent=True)),
    path('dashboard/', RedirectView.as_view(url='/cockpit/', permanent=True)),
]
```

### Database Migration Safety

```python
# Step 1: Add new column (nullable)
migrations.AddField('new_field', null=True)

# Step 2: Backfill data
migrations.RunPython(backfill_new_field)

# Step 3: Make non-nullable (if needed)
migrations.AlterField('new_field', null=False)

# NEVER: Drop column in same release as code change
```

---

## Success Metrics

### Technical Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| App count | 19 | 12 | INSTALLED_APPS |
| Test coverage (BE) | ~40% | 80% | pytest-cov |
| Test coverage (FE) | ~30% | 70% | vitest |
| API response time | ~500ms | <200ms | Monitoring |
| Page load time | ~3s | <2s | Lighthouse |
| Bundle size | ~2MB | <1MB | webpack-bundle-analyzer |
| Doc discoverability | Poor | <30s | User testing |

### User Experience Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Clicks to complete task | 8-12 | <5 | Analytics |
| Time to find entity | ~30s | <10s | User testing |
| Form completion time | ~5min | <2min | Analytics |
| User satisfaction | N/A | >4.5/5 | Survey |
| Support tickets | Baseline | -50% | Ticket count |

### Business Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Deployment frequency | 1/day | 3/day | GitHub Actions |
| Change failure rate | ~5% | <2% | Rollback count |
| Mean time to recovery | ~15min | <5min | Incident logs |
| Developer productivity | Baseline | +40% | Commits/week |

---

## Risk Management

### Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing workflows | Medium | HIGH | Feature flags, extensive testing |
| Data loss during migration | Low | CRITICAL | Full backups, dry-run migrations |
| Performance regression | Medium | HIGH | Load testing, monitoring |
| Scope creep | High | Medium | Strict wave boundaries |
| Team bandwidth | Medium | Medium | Parallel workstreams |
| Integration failures | Medium | HIGH | API contract tests |

### Contingency Plans

| Scenario | Response |
|----------|----------|
| Migration fails | Restore from backup, rollback migrations |
| Performance degrades | Disable feature flags, revert |
| Critical bug found | Hotfix branch, emergency deploy |
| Timeline slips | Deprioritize W5 (cleanup), focus on W1-W4 |

---

## Governance

### Decision Making

| Decision Type | Owner | Escalation |
|---------------|-------|------------|
| Technical architecture | Tech Lead | CTO |
| UX/UI design | Design Lead | Product |
| Timeline/scope | Project Lead | Stakeholders |
| Breaking changes | Tech Lead + Product | CTO |

### Review Gates

| Gate | Criteria | Reviewers |
|------|----------|-----------|
| Wave completion | All tasks done, tests pass | Tech Lead |
| Feature flag enable | Staging tested, metrics normal | QA + Product |
| Production release | All gates passed, stakeholder approval | Full team |

---

## Quality Assurance

### Testing Strategy

#### Backend Testing (Target: 80% Coverage)

```python
# Test categories and targets
BACKEND_TEST_TARGETS = {
    'unit_tests': {
        'coverage': '90%',
        'focus': ['services', 'validators', 'utils'],
    },
    'integration_tests': {
        'coverage': '80%',
        'focus': ['API endpoints', 'database operations'],
    },
    'security_tests': {
        'coverage': '100%',
        'focus': ['auth', 'permissions', 'tenant isolation'],
    },
}
```

#### Frontend Testing (Target: 70% Coverage)

```typescript
// Test categories and targets
const FRONTEND_TEST_TARGETS = {
  unit_tests: {
    coverage: '80%',
    focus: ['hooks', 'utils', 'services'],
  },
  component_tests: {
    coverage: '70%',
    focus: ['critical UI components', 'forms'],
  },
  integration_tests: {
    coverage: '60%',
    focus: ['page flows', 'API integration'],
  },
};
```

#### E2E Testing (Critical Paths)

| Flow | Priority | Tool |
|------|----------|------|
| User login/logout | 🔴 Critical | Playwright |
| Form submission | 🔴 Critical | Playwright |
| Entity CRUD | 🔴 Critical | Playwright |
| Tenant switching | 🟡 High | Playwright |
| Admin configuration | 🟡 High | Playwright |
| Search functionality | 🟢 Medium | Playwright |

### Performance Benchmarks

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| API response (p50) | ~200ms | <100ms | Backend monitoring |
| API response (p95) | ~800ms | <300ms | Backend monitoring |
| API response (p99) | ~2s | <500ms | Backend monitoring |
| Page load (FCP) | ~1.5s | <1s | Lighthouse |
| Page load (LCP) | ~3s | <2s | Lighthouse |
| Time to Interactive | ~4s | <3s | Lighthouse |
| JS Bundle size | ~1.5MB | <800KB | Build analysis |
| CSS Bundle size | ~300KB | <150KB | Build analysis |

### Accessibility Requirements

- [ ] WCAG 2.1 Level AA compliance
- [ ] Keyboard navigation for all interactive elements
- [ ] Screen reader compatibility (tested with NVDA/VoiceOver)
- [ ] Color contrast ratio ≥ 4.5:1
- [ ] Focus indicators visible
- [ ] Error messages associated with form fields
- [ ] Skip navigation links
- [ ] Responsive down to 320px width

### Code Quality Gates

```yaml
# Required for PR merge
quality_gates:
  backend:
    - pytest passes
    - coverage >= 80%
    - flake8 passes
    - black --check passes
    - no security vulnerabilities (bandit)
    
  frontend:
    - vitest passes
    - coverage >= 70%
    - eslint passes
    - tsc --noEmit passes
    - no accessibility violations (axe)
    
  both:
    - no merge conflicts
    - PR reviewed and approved
    - CI pipeline green
```

---

## Monitoring & Observability

### Monitoring Stack

| Component | Tool | Purpose |
|-----------|------|---------|
| Error tracking | Sentry | Exception capture and alerting |
| APM | Sentry Performance | Request tracing |
| Logging | Structured JSON logs | Application logs |
| Metrics | Custom dashboard | Business metrics |
| Uptime | GitHub Actions | Health checks |
| Alerting | Sentry + Slack | Incident notification |

### Key Metrics to Track

```python
BUSINESS_METRICS = [
    'form_submissions_per_hour',
    'active_users_per_day',
    'api_requests_per_minute',
    'error_rate_percentage',
    'average_response_time_ms',
    'tenant_count',
    'entity_count_by_type',
]

INFRASTRUCTURE_METRICS = [
    'cpu_utilization',
    'memory_usage',
    'database_connections',
    'redis_memory',
    'celery_queue_depth',
    'websocket_connections',
]
```

### Alerting Rules

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| High error rate | >1% errors in 5 min | Critical | Page on-call |
| Slow API | p95 >1s for 5 min | Warning | Slack notification |
| Database connection exhaustion | >80% connections | Critical | Page on-call |
| Celery queue backup | >1000 tasks pending | Warning | Slack notification |
| Disk space low | <10% free | Critical | Page on-call |
| Memory pressure | >90% used | Warning | Slack notification |

---

## Mobile App Considerations

### Sync with Web Platform

| Feature | Web | Mobile | Status |
|---------|-----|--------|--------|
| Authentication | JWT | JWT | ✅ Shared |
| API Endpoints | All | Subset | ⚠️ Document subset |
| Real-time | WebSocket | WebSocket | 🔄 Planned |
| Offline mode | N/A | Required | 🔄 Planned |
| Push notifications | N/A | Required | 🔄 Planned |
| Cert pinning | N/A | Required | 🔄 Planned |

### Mobile-Specific Tasks

- [ ] **M1** Implement certificate pinning
- [ ] **M2** Add offline data sync
- [ ] **M3** Integrate push notifications (Expo)
- [ ] **M4** Update API service for token refresh
- [ ] **M5** Add biometric authentication option
- [ ] **M6** Optimize bundle size for mobile

---

## Internationalization (Future)

### Preparation Tasks

- [ ] Extract all user-facing strings to i18n files
- [ ] Add locale support to API (Accept-Language header)
- [ ] Add date/time formatting utilities
- [ ] Add number/currency formatting utilities
- [ ] Document translation workflow

### Supported Locales (Future)

| Locale | Status | Priority |
|--------|--------|----------|
| en-US | ✅ Default | N/A |
| es-MX | 🔄 Planned | High (US meat industry) |
| fr-CA | 🔄 Planned | Medium |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `ADMIN_BACKEND_REVAMP_PLAN.md` | Detailed config system design |
| `DATA_ENTITY_RESTRUCTURING_PLAN.md` | App cleanup details |
| `FORMS_FLOWS_ENHANCEMENT_PLAN.md` | Cockpit and forms details |
| `DOCUMENTATION_ORGANIZATION_PLAN.md` | Docs cleanup details |
| `GLOBAL_CONFIG_ARCHITECTURE.md` | Meta-model blueprint system |
| `ROADMAP.md` | Overall project direction |
| `PROGRESS_TRACKER.md` | Running progress document |

---

## Appendix A: Technology Decisions

### Why JWT over Session Tokens?

| Aspect | Session Tokens (Current) | JWT (Target) |
|--------|--------------------------|--------------|
| Scalability | Requires session store | Stateless |
| Mobile support | Cookie issues | Native support |
| Microservices | Shared session store needed | Self-contained |
| Expiration | Manual implementation | Built-in |
| Refresh | Not supported | Native refresh tokens |

### Why Celery over Django-Q/RQ?

| Aspect | Celery | Django-Q | RQ |
|--------|--------|----------|-----|
| Maturity | ✅ Very mature | Good | Good |
| Features | ✅ Comprehensive | Basic | Basic |
| Monitoring | ✅ Flower | Limited | RQ Dashboard |
| Scheduling | ✅ Celery Beat | Yes | rq-scheduler |
| Community | ✅ Large | Medium | Medium |

### Why Django Channels over Pusher/Ably?

| Aspect | Django Channels | Third-party (Pusher) |
|--------|-----------------|----------------------|
| Cost | Self-hosted | Per-message pricing |
| Latency | Lower (same infra) | Variable |
| Control | Full control | Vendor dependency |
| Integration | Native Django | SDK required |
| Scaling | Manual | Automatic |

---

## Appendix B: Dependency Updates

### Backend Dependencies to Add

```txt
# requirements.txt additions
djangorestframework-simplejwt>=5.3.0
django-ratelimit>=4.1.0
celery[redis]>=5.3.0
django-celery-beat>=2.5.0
flower>=2.0.0
channels>=4.0.0
channels-redis>=4.1.0
sentry-sdk[django]>=1.35.0
django-csp>=3.7
```

### Frontend Dependencies to Add

```json
{
  "@tanstack/react-query-devtools": "^5.x",
  "sentry-react": "^7.x",
  "socket.io-client": "^4.x"
}
```

### Dependencies to Remove/Update

| Package | Action | Reason |
|---------|--------|--------|
| `react-table` | Remove | Replaced by @tanstack/react-table |
| Dual flow libs | Consolidate | Only need @xyflow/react |

---

## Appendix C: Database Migrations Plan

### Migration Safety Rules

1. **Never drop columns in same release as code change**
2. **Always add nullable first, then backfill, then make non-null**
3. **Use `--fake-initial` for production deployments**
4. **Test migrations on production data copy first**
5. **Keep migrations reversible where possible**

### High-Risk Migrations

| Migration | Risk | Mitigation |
|-----------|------|------------|
| Products deduplication | Data loss | Full backup, mapping table |
| Plants → Locations | FK changes | Multi-step migration |
| Orders consolidation | Complex FKs | Extensive testing |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-31 | Copilot | Initial unified plan |
| 2.0 | 2026-01-31 | Copilot | Added: Gap analysis, Security hardening, Real-time/Background processing, Documentation overhaul, QA strategy, Monitoring, Mobile considerations, Appendices |

---

*This document supersedes and unifies:*
- *DATA_ENTITY_RESTRUCTURING_PLAN.md*
- *FORMS_FLOWS_ENHANCEMENT_PLAN.md*
- *ADMIN_BACKEND_REVAMP_PLAN.md*

*Last Updated: 2026-01-31*
