# ProjectMeats v2.0 Master Plan

## Unified System-Wide Overhaul

**Document Version**: 3.0  
**Created**: 2026-01-31  
**Last Updated**: 2026-01-31  
**Status**: 📋 MASTER PLAN - Comprehensive Enhancement  
**Classification**: INDUSTRY LEADING IMPLEMENTATION  
**Estimated Duration**: 18-22 weeks

---

## Executive Summary

This master plan provides a **comprehensive, system-wide overhaul** of ProjectMeats, covering:

| Area | Scope |
|------|-------|
| **Frontend** | 37+ pages across Workspace, Orders, Accounting, Admin |
| **Backend** | 18 apps, 75+ models, 60+ API endpoints |
| **Mobile** | React Native app with offline support |
| **Infrastructure** | CI/CD, monitoring, security, scaling |
| **Testing** | Unit, integration, E2E with 80%+ coverage targets |
| **Documentation** | Complete repo reorganization |

### Key Deliverables

1. **Cockpit Command Center** - Revolutionary control interface
2. **Intelligent Forms & Flows** - Dynamic, context-aware workflows
3. **3-Tier Config System** - System → Tenant → User settings
4. **Modern Admin Studio** - Visual editors for all configuration
5. **Enterprise Security** - JWT, rate limiting, audit logging
6. **Real-Time Updates** - WebSockets for live data
7. **Mobile v2.0** - Offline support, push notifications, biometrics

### Timeline Overview

```
Weeks 1-4:   Foundation (config system, security)
Weeks 5-8:   Feature Development (Cockpit, Forms, Admin)
Weeks 9-14:  Advanced Features (Mobile, Reporting, AI)
Weeks 15-18: Testing & Polish
Weeks 19-22: Rollout & Stabilization
```

---

## Table of Contents

1. [Vision Statement](#vision-statement)
2. [Core Principles](#core-principles)
3. [Current State Analysis](#current-state-analysis)
4. [Gap Analysis](#gap-analysis)
5. [Architecture Overview](#architecture-overview)
6. [Complete Feature Inventory & Revamp Plan](#complete-feature-inventory--revamp-plan)
7. [Unified Workstreams](#unified-workstreams)
8. [Implementation Waves](#implementation-waves)
9. [Security Hardening Plan](#security-hardening-plan)
10. [Real-Time & Background Processing](#real-time--background-processing)
11. [Mobile Application Roadmap](#mobile-application-roadmap)
12. [Comprehensive Testing Strategy](#comprehensive-testing-strategy)
13. [Performance Optimization Plan](#performance-optimization-plan)
14. [DevOps & Infrastructure Enhancements](#devops--infrastructure-enhancements)
15. [Documentation Overhaul](#documentation-overhaul)
16. [Zero-Breaking-Change Strategy](#zero-breaking-change-strategy)
17. [Success Metrics](#success-metrics)
18. [Risk Management](#risk-management)
19. [Quality Assurance](#quality-assurance)

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

## Complete Feature Inventory & Revamp Plan

### Frontend Pages - Current State & Enhancements

#### 🏠 Dashboard & Workspace

| Page | Current State | v2.0 Enhancement |
|------|---------------|------------------|
| **Dashboard** (`/`) | Basic stats display | Replace with Cockpit Command Center |
| **Call Log** (`/call-log`) | Functional | Rename to "Calls", add intelligence features |
| **Reports** (`/reports`) | Basic | Add interactive charts, export, scheduling |

#### 👥 Master Data Management

| Page | Current State | v2.0 Enhancement |
|------|---------------|------------------|
| **Suppliers** (`/suppliers`) | ✅ Complete | Add bulk import/export, map view |
| **Suppliers > Plants** | ✅ Complete | Merge into unified Locations |
| **Suppliers > Contacts** | ✅ Complete | Unified contact management |
| **Customers** (`/customers`) | ✅ Complete | Add customer scoring, segments |
| **Customers > Locations** | ✅ Complete | Merge into unified Locations |
| **Customers > Contacts** | ✅ Complete | Unified contact management |
| **Contacts** (`/contacts`) | ✅ Complete | Add relationship graph |
| **Carriers** (`/carriers`) | ⚠️ "Coming Soon" | **Implement full logistics module** |

#### 📋 Order Management

| Page | Current State | v2.0 Enhancement |
|------|---------------|------------------|
| **Purchase Orders** (`/purchase-orders`) | ✅ Complete | Add PO builder wizard |
| **PO Attachments** | ⚠️ "Coming Soon" | **Implement file management** |
| **Sales Orders** (`/sales-orders`) | ✅ Complete | Add SO builder wizard |
| **SO Attachments** | ⚠️ "Coming Soon" | **Implement file management** |
| **Inquiries** (`/inquiries`) | ✅ Complete | Add quick quote calculator |
| **Inquiry Templates** | ✅ Complete | Enhance with AI suggestions |
| **Inquiry Analytics** | ⚠️ Basic | **Add conversion funnels** |
| **Fulfillments** (`/fulfillments`) | ✅ Complete | Add shipment tracking integration |

#### 💰 Accounting

| Page | Current State | v2.0 Enhancement |
|------|---------------|------------------|
| **Payables** (`/accounting/payables`) | ✅ Complete | Add aging reports |
| **Payables > Claims** | ✅ Complete | Add workflow automation |
| **Receivables** (`/accounts-receivables`) | ✅ Complete | Add collection workflows |
| **Receivables > Invoices** | ✅ Complete | Add batch invoicing |

#### ❄️ Inventory & Logistics

| Page | Current State | v2.0 Enhancement |
|------|---------------|------------------|
| **Cold Storage** (`/cold-storage`) | ✅ Basic | Add inventory tracking, alerts |
| **Carriers/Logistics** | ⚠️ "Coming Soon" | **Full implementation needed** |

#### ⚡ Workflows & AI

| Page | Current State | v2.0 Enhancement |
|------|---------------|------------------|
| **Workflow Catalog** (`/workflows`) | ✅ Complete | Add categories, favorites |
| **Workflow Monitor** | ⚠️ Mock data | **Connect to real execution** |
| **Workflow Runner** | ⚠️ Hardcoded schema | **Dynamic step loading** |
| **AI Assistant** (`/ai-assistant`) | ✅ Basic chat | Add context awareness, actions |
| **My Submissions** (`/my-submissions`) | ✅ Complete | Add status tracking |

#### ⚙️ Settings & Admin

| Page | Current State | v2.0 Enhancement |
|------|---------------|------------------|
| **Profile** (`/profile`) | ⚠️ Mock upload | **Implement avatar API** |
| **Settings** (`/settings`) | ✅ Basic | Add notification preferences |
| **Admin Panel** (`/admin/*`) | ✅ Complete | Enhance with visual editors |

---

### Backend Features - Current State & Enhancements

#### 🔌 API Completeness

| Endpoint Group | Current | v2.0 Enhancement |
|----------------|---------|------------------|
| **Auth** (`/auth/*`) | Token-based | JWT with refresh, 2FA |
| **Tenants** (`/tenants/*`) | ✅ Complete | Add tenant analytics |
| **Users** (`/users/*`) | Basic | Add preferences, activity |
| **Suppliers** | ✅ Complete | Add bulk operations |
| **Customers** | ✅ Complete | Add scoring API |
| **Products** | ✅ Complete | Move to system-wide |
| **Orders** | ✅ Complete | Add workflow triggers |
| **Invoices** | ✅ Complete | Add batch processing |
| **Workflows** | ⚠️ Incomplete | **Full execution engine** |
| **Search** | ❌ Missing | **Universal search API** |
| **File Upload** | ❌ Missing | **Attachment management** |
| **Reports** | ❌ Missing | **Report generation API** |
| **Export** | ❌ Missing | **Data export API (GDPR)** |
| **Webhooks** | ❌ Missing | **Event notifications** |

#### 🔧 Backend Services - Incomplete

| Service | Status | Implementation Needed |
|---------|--------|----------------------|
| **Email Notifications** | ⚠️ Stub only | Complete SendGrid integration |
| **Workflow Execution** | ⚠️ TODO comments | Full engine implementation |
| **Cron Scheduling** | ❌ Not implemented | Celery Beat integration |
| **File Storage** | ❌ Not implemented | S3/DO Spaces integration |
| **Report Generation** | ⚠️ Basic PDF | Full reporting engine |
| **Audit Logging** | ⚠️ Basic | Comprehensive audit trail |

---

### Complete Feature Implementation Plan

#### Wave F1: Fix Incomplete Features (Week 3-4)

**Profile & Settings**
- [ ] **F1.1** Implement profile avatar upload API
- [ ] **F1.2** Add S3/DO Spaces file storage backend
- [ ] **F1.3** Create `FileAttachment` model for universal attachments
- [ ] **F1.4** Implement attachment endpoints for PO/SO
- [ ] **F1.5** Add notification preferences to settings

**Workflow Engine Completion**
- [ ] **F1.6** Fix WorkflowCanvas API save (currently mock)
- [ ] **F1.7** Fix WorkflowRunner dynamic schema loading
- [ ] **F1.8** Implement workflow execution engine
- [ ] **F1.9** Add cron expression parser for scheduled workflows
- [ ] **F1.10** Connect workflow API to execution engine

#### Wave F2: Carriers & Logistics (Week 5-6)

**Full Logistics Module**
- [ ] **F2.1** Design Carriers page UI/UX
- [ ] **F2.2** Implement carrier list with filtering
- [ ] **F2.3** Add carrier detail view (insurance, contacts)
- [ ] **F2.4** Create load/shipment tracking model
- [ ] **F2.5** Add shipment status timeline
- [ ] **F2.6** Integrate with carrier purchase orders
- [ ] **F2.7** Add carrier rate management
- [ ] **F2.8** Create logistics dashboard widget

#### Wave F3: Reporting & Analytics (Week 7-8)

**Reports Module**
- [ ] **F3.1** Create ReportDefinition model
- [ ] **F3.2** Build report builder UI
- [ ] **F3.3** Implement report generation service (PDF/Excel)
- [ ] **F3.4** Add scheduled report delivery
- [ ] **F3.5** Create standard report templates:
  - Sales summary
  - Purchase summary
  - Aging reports (AR/AP)
  - Product movement
  - Customer/supplier performance
- [ ] **F3.6** Add interactive dashboard charts

#### Wave F4: AI Enhancement (Week 9-10)

**AI Assistant Improvements**
- [ ] **F4.1** Add conversation context (current page, selected entity)
- [ ] **F4.2** Implement action suggestions (create PO, send email)
- [ ] **F4.3** Add document analysis (upload invoice, extract data)
- [ ] **F4.4** Create AI-powered search suggestions
- [ ] **F4.5** Add natural language filters ("show POs from last week")
- [ ] **F4.6** Implement AI-assisted form completion

---

### UI/UX Overhaul Plan

#### Design System Standardization

| Area | Current | Target |
|------|---------|--------|
| **Component Library** | Ant Design + custom | Ant Design with theme tokens |
| **Styling** | Styled Components + Tailwind | Tailwind only (remove dual) |
| **Icons** | Lucide | Lucide (consistent) |
| **Colors** | Theme context | CSS custom properties |
| **Typography** | Mixed | Standardized scale |
| **Spacing** | Inconsistent | 4px grid system |
| **Animations** | Minimal | Subtle, purposeful |

#### UX Improvements by Area

**Navigation**
- [ ] **UX1.1** Add command palette (⌘K) for quick navigation
- [ ] **UX1.2** Add breadcrumbs to all pages
- [ ] **UX1.3** Implement recent items in sidebar
- [ ] **UX1.4** Add favorites/pinned pages
- [ ] **UX1.5** Improve mobile navigation (bottom tabs)

**Data Tables**
- [ ] **UX2.1** Upgrade react-table v7 → @tanstack/react-table v8
- [ ] **UX2.2** Add column resizing and reordering
- [ ] **UX2.3** Add saved views/filters
- [ ] **UX2.4** Implement bulk actions toolbar
- [ ] **UX2.5** Add inline editing mode
- [ ] **UX2.6** Add keyboard navigation

**Forms**
- [ ] **UX3.1** Add auto-save drafts
- [ ] **UX3.2** Implement smart defaults
- [ ] **UX3.3** Add field-level validation messages
- [ ] **UX3.4** Create form wizard for complex entities
- [ ] **UX3.5** Add duplicate detection

**Feedback & Loading**
- [ ] **UX4.1** Add skeleton loaders for all pages
- [ ] **UX4.2** Implement optimistic updates
- [ ] **UX4.3** Add toast notifications for all actions
- [ ] **UX4.4** Create empty states with CTAs
- [ ] **UX4.5** Add error boundaries with recovery

---

### Data Model Enhancements

#### New Models Required

```python
# File attachments (universal)
class FileAttachment(TenantAwareModel):
    file = models.FileField(upload_to='attachments/')
    filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size = models.PositiveIntegerField()
    uploaded_by = models.ForeignKey(User)
    # Generic relation to any model
    content_type = models.ForeignKey(ContentType)
    object_id = models.UUIDField()

# Report definitions
class ReportDefinition(TenantAwareModel):
    name = models.CharField(max_length=255)
    report_type = models.CharField(choices=REPORT_TYPES)
    filters = models.JSONField(default=dict)
    columns = models.JSONField(default=list)
    schedule = models.CharField(null=True)  # Cron expression
    recipients = models.ManyToManyField(User)

# Shipment tracking
class Shipment(TenantAwareModel):
    carrier = models.ForeignKey(Carrier)
    purchase_order = models.ForeignKey(PurchaseOrder)
    sales_order = models.ForeignKey(SalesOrder, null=True)
    status = models.CharField(choices=SHIPMENT_STATUS)
    tracking_number = models.CharField(max_length=100)
    pickup_date = models.DateField()
    delivery_date = models.DateField(null=True)
    
# Shipment events
class ShipmentEvent(models.Model):
    shipment = models.ForeignKey(Shipment)
    event_type = models.CharField(choices=EVENT_TYPES)
    location = models.CharField(max_length=255)
    timestamp = models.DateTimeField()
    notes = models.TextField(blank=True)

# User preferences (enhanced)
class UserPreferences(models.Model):
    user = models.OneToOneField(User)
    notification_email = models.BooleanField(default=True)
    notification_push = models.BooleanField(default=True)
    notification_in_app = models.BooleanField(default=True)
    digest_frequency = models.CharField(choices=DIGEST_CHOICES)
    quiet_hours_start = models.TimeField(null=True)
    quiet_hours_end = models.TimeField(null=True)
    default_view = models.JSONField(default=dict)  # Per-page defaults
    recent_items = models.JSONField(default=list)
    favorites = models.JSONField(default=list)
```

#### Existing Model Enhancements

```python
# Add to Carrier model
class Carrier(TenantAwareModel):
    # ... existing fields ...
    # NEW fields:
    tracking_url_template = models.URLField(blank=True)
    api_integration = models.CharField(choices=CARRIER_APIS, blank=True)
    api_credentials = models.JSONField(default=dict)  # Encrypted
    
# Add to Contact model
class Contact(TenantAwareModel):
    # ... existing fields ...
    # NEW fields:
    last_contacted = models.DateTimeField(null=True)
    contact_frequency_days = models.PositiveIntegerField(default=30)
    preferred_contact_method = models.CharField(choices=CONTACT_METHODS)
    timezone = models.CharField(max_length=50, default='America/Chicago')

# Add to PurchaseOrder/SalesOrder
class PurchaseOrder(TenantAwareModel):
    # ... existing fields ...
    # NEW fields:
    attachments = GenericRelation(FileAttachment)
    workflow_run = models.ForeignKey('workflows.WorkflowRun', null=True)
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

## Mobile Application Roadmap

### Current State

The mobile app (`/mobile`) uses React Native with Expo 51, sharing types with the frontend via `/shared`.

| Aspect | Current | Status |
|--------|---------|--------|
| Framework | React Native + Expo 51 | ✅ Modern |
| Navigation | React Navigation 7 | ✅ Current |
| State | React Context | 🔄 Needs upgrade |
| API Client | Axios | ✅ Shared with web |
| Auth | Token storage | ⚠️ Needs SecureStore |
| Offline | None | ❌ Critical gap |
| Push | Not implemented | ❌ Critical gap |

### Mobile v2.0 Features

#### Wave M1: Foundation (Weeks 5-6)

- [ ] **M1.1** Migrate to SecureStore for token storage
- [ ] **M1.2** Implement biometric authentication
- [ ] **M1.3** Add offline data caching (AsyncStorage + SQLite)
- [ ] **M1.4** Create sync manager for offline changes
- [ ] **M1.5** Set up Expo push notifications

#### Wave M2: Core Features (Weeks 7-10)

- [ ] **M2.1** Implement Cockpit mobile view (simplified)
- [ ] **M2.2** Add universal search with voice input
- [ ] **M2.3** Create mobile-optimized data entry forms
- [ ] **M2.4** Implement quick actions (call, email, directions)
- [ ] **M2.5** Add barcode/QR scanning for products
- [ ] **M2.6** Implement photo capture for attachments

#### Wave M3: Advanced (Weeks 11-14)

- [ ] **M3.1** Add location-based features (nearby plants, routes)
- [ ] **M3.2** Implement order status push notifications
- [ ] **M3.3** Create mobile-specific widgets (iOS/Android)
- [ ] **M3.4** Add Apple Watch companion (key alerts)
- [ ] **M3.5** Implement deep linking (open specific records)

### Mobile Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APP (Expo)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Screens   │  │   Hooks     │  │  Services   │         │
│  │  (RN Paper) │  │  (Queries)  │  │  (API/Sync) │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                 │
│  ┌──────┴────────────────┴────────────────┴──────┐         │
│  │              State Manager                     │         │
│  │  (React Query + Context + SecureStore)        │         │
│  └───────────────────────────────────────────────┘         │
│         │                │                │                 │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐        │
│  │   Offline   │  │    Push     │  │   Native    │        │
│  │   SQLite    │  │  Expo PN    │  │   Modules   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND API                             │
│  (Same endpoints as web, mobile-optimized responses)        │
└─────────────────────────────────────────────────────────────┘
```

### Mobile-Specific Considerations

| Consideration | Implementation |
|---------------|----------------|
| **Battery** | Optimize background sync frequency |
| **Bandwidth** | Compress images, paginate aggressively |
| **Connectivity** | Graceful offline degradation |
| **Security** | Certificate pinning, jailbreak detection |
| **Performance** | Lazy load screens, optimize re-renders |

---

## Comprehensive Testing Strategy

### Testing Pyramid

```
                    ┌───────────┐
                    │   E2E     │  5%  (Cypress/Playwright)
                    │   Tests   │  - Critical user flows
                   ┌┴───────────┴┐
                   │ Integration │  15%  (pytest, jest)
                   │    Tests    │  - API contracts
                  ┌┴─────────────┴┐
                  │     Unit      │  80%  (pytest, jest)
                  │     Tests     │  - Business logic
                 ┌┴───────────────┴┐
                 │   Static Analysis │  (mypy, ESLint, TypeScript)
                 └─────────────────────┘
```

### Coverage Targets by Area

| Area | Current | Target | Priority |
|------|---------|--------|----------|
| **Backend Models** | ~60% | 90% | High |
| **Backend Views/API** | ~40% | 85% | Critical |
| **Backend Services** | ~30% | 90% | High |
| **Frontend Components** | ~20% | 70% | Medium |
| **Frontend Hooks** | ~15% | 80% | High |
| **E2E Critical Paths** | ~5% | 100% | Critical |

### E2E Test Scenarios (Critical Paths)

| Scenario | Description | Priority |
|----------|-------------|----------|
| **Auth Flow** | Login, MFA, logout, password reset | P0 |
| **Tenant Switch** | Select tenant, verify data isolation | P0 |
| **PO Creation** | Full PO creation with products, attachments | P0 |
| **SO Creation** | Full SO creation linked to PO | P0 |
| **Form Submission** | Custom form with all field types | P0 |
| **Quick Action Flow** | Complete inquiry→fulfillment flow | P0 |
| **Search & Filter** | Universal search, filtered lists | P1 |
| **Admin Config** | Create choice list, field schema | P1 |
| **Report Generation** | Generate and export report | P1 |

### Testing Implementation Plan

#### Wave T1: Test Infrastructure (Weeks 1-2)

- [ ] **T1.1** Set up pytest-cov with 80% threshold gate
- [ ] **T1.2** Set up Jest coverage with 70% threshold
- [ ] **T1.3** Configure Cypress for E2E tests
- [ ] **T1.4** Create test factories (factory_boy) for all models
- [ ] **T1.5** Set up test database fixtures
- [ ] **T1.6** Configure CI to run tests on all PRs

#### Wave T2: Backend Test Coverage (Weeks 3-6)

- [ ] **T2.1** Add missing model tests (target: 90%)
- [ ] **T2.2** Add API endpoint tests (target: 85%)
- [ ] **T2.3** Add service layer tests (target: 90%)
- [ ] **T2.4** Add tenant isolation tests (verify no cross-tenant data)
- [ ] **T2.5** Add permission tests (verify RBAC)
- [ ] **T2.6** Add migration tests (verify reversibility)

#### Wave T3: Frontend Test Coverage (Weeks 4-8)

- [ ] **T3.1** Add component unit tests (target: 70%)
- [ ] **T3.2** Add hook tests (target: 80%)
- [ ] **T3.3** Add service/API tests (target: 75%)
- [ ] **T3.4** Add form validation tests
- [ ] **T3.5** Add accessibility tests (axe-core)

#### Wave T4: E2E Tests (Weeks 6-10)

- [ ] **T4.1** Implement auth flow tests
- [ ] **T4.2** Implement order creation tests
- [ ] **T4.3** Implement form submission tests
- [ ] **T4.4** Implement admin config tests
- [ ] **T4.5** Add visual regression tests (Percy/Chromatic)

### Test Data Strategy

```python
# Backend: Factory Boy factories
class TenantFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Tenant
    name = factory.Faker('company')
    slug = factory.LazyAttribute(lambda o: slugify(o.name))

class SupplierFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Supplier
    tenant = factory.SubFactory(TenantFactory)
    name = factory.Faker('company')
    
# Create consistent test data
@pytest.fixture
def test_tenant(db):
    return TenantFactory(name='Test Tenant')

@pytest.fixture
def test_supplier(test_tenant):
    return SupplierFactory(tenant=test_tenant)
```

```typescript
// Frontend: MSW for API mocking
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/v1/suppliers/', (req, res, ctx) => {
    return res(ctx.json({ results: mockSuppliers }));
  }),
];

// Test
describe('SupplierList', () => {
  it('renders suppliers', async () => {
    render(<SupplierList />);
    await waitFor(() => {
      expect(screen.getByText('Mock Supplier')).toBeInTheDocument();
    });
  });
});
```

---

## Performance Optimization Plan

### Current Performance Baseline

| Metric | Current | Target | Impact |
|--------|---------|--------|--------|
| **First Contentful Paint** | ~2.5s | <1.5s | UX |
| **Time to Interactive** | ~4s | <3s | UX |
| **API p95 Response** | ~500ms | <200ms | UX |
| **Bundle Size (main)** | ~2MB | <500KB | Load time |
| **Lighthouse Score** | ~65 | >90 | SEO/UX |

### Optimization Strategies

#### Frontend Optimizations

- [ ] **P1.1** Implement code splitting by route
- [ ] **P1.2** Lazy load heavy components (charts, editors)
- [ ] **P1.3** Add service worker for caching
- [ ] **P1.4** Optimize images (WebP, lazy load)
- [ ] **P1.5** Implement virtual scrolling for long lists
- [ ] **P1.6** Add React.memo to expensive components
- [ ] **P1.7** Optimize re-renders with useMemo/useCallback
- [ ] **P1.8** Remove unused dependencies (bundle analysis)

#### Backend Optimizations

- [ ] **P2.1** Add database query optimization (select_related, prefetch_related)
- [ ] **P2.2** Implement query result caching (Redis)
- [ ] **P2.3** Add database indexes for common queries
- [ ] **P2.4** Implement pagination for all list endpoints
- [ ] **P2.5** Add response compression (gzip/brotli)
- [ ] **P2.6** Optimize serializers (only necessary fields)
- [ ] **P2.7** Add query profiling in development

#### Infrastructure Optimizations

- [ ] **P3.1** Configure CDN for static assets
- [ ] **P3.2** Implement database connection pooling
- [ ] **P3.3** Add Redis caching layer
- [ ] **P3.4** Configure nginx for optimal caching
- [ ] **P3.5** Implement database read replicas (if needed)

---

## DevOps & Infrastructure Enhancements

### Current State

| Aspect | Current | Target |
|--------|---------|--------|
| **CI/CD** | GitHub Actions | ✅ Keep (optimize) |
| **Hosting** | DigitalOcean Droplet | ✅ Keep (add load balancer) |
| **Database** | DO Managed PostgreSQL | ✅ Keep (add read replica) |
| **Registry** | DO Container Registry | ✅ Keep |
| **Monitoring** | Basic logs | Sentry + Prometheus + Grafana |
| **Secrets** | GitHub Secrets | ✅ Keep (add rotation) |

### Infrastructure Improvements

#### Wave I1: Observability (Weeks 3-4)

- [ ] **I1.1** Set up Sentry for error tracking (backend + frontend)
- [ ] **I1.2** Configure Prometheus for metrics collection
- [ ] **I1.3** Set up Grafana dashboards
- [ ] **I1.4** Add structured logging (JSON format)
- [ ] **I1.5** Create alerting rules (PagerDuty/Slack)

#### Wave I2: Reliability (Weeks 5-6)

- [ ] **I2.1** Add health check endpoints
- [ ] **I2.2** Implement graceful shutdown
- [ ] **I2.3** Add circuit breakers for external services
- [ ] **I2.4** Create runbooks for common issues
- [ ] **I2.5** Implement automatic rollback on failed deploys

#### Wave I3: Scaling (Weeks 10-12)

- [ ] **I3.1** Add load balancer (DO Load Balancer)
- [ ] **I3.2** Configure horizontal scaling
- [ ] **I3.3** Add Redis caching cluster
- [ ] **I3.4** Implement database read replicas
- [ ] **I3.5** Configure CDN for global distribution

### Monitoring Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM HEALTH                            │
├──────────────┬──────────────┬──────────────┬───────────────┤
│   API p95    │  Error Rate  │   DB Conns   │  Redis Mem    │
│   142ms ✅   │   0.1% ✅    │   45/100 ✅  │  2.1GB/4GB ✅ │
├──────────────┴──────────────┴──────────────┴───────────────┤
│                    REQUEST VOLUME                           │
│  [Graph: Requests/min over last 24h]                        │
├─────────────────────────────────────────────────────────────┤
│                    TOP ERRORS                               │
│  1. 404 /api/old-endpoint (deprecated) - 45 occurrences    │
│  2. 500 /api/reports/generate - 12 occurrences             │
├─────────────────────────────────────────────────────────────┤
│                    SLOW QUERIES                             │
│  1. SELECT * FROM purchase_orders... - avg 450ms           │
│  2. SELECT * FROM products WHERE... - avg 320ms            │
└─────────────────────────────────────────────────────────────┘
```

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
| 3.0 | 2026-01-31 | Copilot | **Comprehensive Enhancement**: Complete frontend page inventory (37+ pages), backend feature completeness, UI/UX overhaul plan, data model enhancements, mobile v2.0 roadmap, comprehensive testing strategy, performance optimization plan, DevOps/infrastructure improvements. Extended timeline to 18-22 weeks. |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| **Frontend Pages** | 37+ routes |
| **Backend Models** | 75+ models |
| **New Features** | 45+ features |
| **Bug Fixes** | 6 critical bugs |
| **Test Scenarios** | 9 E2E critical paths |
| **New API Endpoints** | 20+ endpoints |
| **Infrastructure Tasks** | 15+ improvements |
| **Documentation Files** | 55 → organized structure |
| **Total Tasks** | 350+ implementation items |

---

*This document supersedes and unifies:*
- *DATA_ENTITY_RESTRUCTURING_PLAN.md*
- *FORMS_FLOWS_ENHANCEMENT_PLAN.md*
- *ADMIN_BACKEND_REVAMP_PLAN.md*

*Last Updated: 2026-01-31*
