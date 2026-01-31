# Documentation Organization Plan

**Document Version**: 1.0  
**Created**: 2026-01-31  
**Status**: 📋 PLANNING  
**Priority**: MEDIUM

---

## Executive Summary

This plan establishes standards for keeping the ProjectMeats documentation **organized, clean, and concise**. With 55+ markdown files in `/docs`, navigation has become difficult and document purposes unclear.

### Goals

1. **Discoverability** - Find any doc in < 30 seconds
2. **Clarity** - Immediately know if a doc is current vs archived
3. **Consistency** - Uniform naming, structure, and categorization
4. **Maintainability** - Easy to update, archive, and clean up

---

## Current State Analysis

### Issues Identified

| Issue | Count | Impact |
|-------|-------|--------|
| Duplicative docs | ~12 pairs | Confusion about source of truth |
| Missing index | 1 | No navigation aid |
| Should be archived | ~8 docs | Clutter, outdated info |
| Naming inconsistencies | 3 | Breaks conventions |
| Empty directories | 2 | Unused structure |
| No categorization | All | Can't tell plan vs reference vs history |

### Duplicative Document Groups

| Topic | Documents | Recommendation |
|-------|-----------|----------------|
| **Payment** | `PAYMENT_WORKFLOW_GUIDE.md`, `PAYMENT_WORKFLOW_TECHNICAL.md`, `PAYMENT_INTEGRATION_COMPLETE.md`, `PAYMENT_FEATURE_FINAL_SUMMARY.md` | Merge to 2: Guide + Technical |
| **Invitation/Guest** | `INVITE_ONLY_SYSTEM.md`, `GUEST_MODE_IMPLEMENTATION.md`, `GUEST_MODE_QUICK_REF.md`, `INVITATION_SYSTEM_VERIFICATION.md`, `INVITATION_TROUBLESHOOTING.md`, `INVITATION_TOKEN_FIX.md` | Keep 2, archive 4 |
| **Database Sync** | `DATABASE_SYNC_SETUP.md`, `DATABASE_SYNC_STRATEGY.md`, `DB_SYNC_WORKFLOW.md` | Merge to 1 |
| **Email/SendGrid** | `SENDGRID_CONFIGURATION_GUIDE.md`, `SENDGRID_EMAIL_CONFIGURATION.md`, `EMAIL_TROUBLESHOOTING_SERVER_SIDE.md` | Merge to 1 |
| **SSL** | `SSL_SETUP.md`, `SSL_WEBROOT_DEPLOYMENT_GUIDE.md` | Merge to 1 |
| **Forms** | `FORM_SYSTEM_OVERHAUL_PLAN.md`, `FORM_EDITOR_AND_EXECUTION.md`, `FORMS_FLOWS_ENHANCEMENT_PLAN.md` | Keep active plan, archive others |

### Documents to Archive

Move to `/docs/archive/` (completed implementations, one-time fixes):

| Document | Reason |
|----------|--------|
| `PHASE4_COMPLETE_IMPLEMENTATION.md` | Completed phase |
| `DEPLOYMENT_EMERGENCY_FIX.md` | One-time emergency fix |
| `INVITATION_TOKEN_FIX.md` | Specific bug fix |
| `CALLLOG_IMPLEMENTATION_STATUS.md` | Feature complete |
| `CALLLOG_UPGRADE_GUIDE.md` | One-time migration |
| `GOLDEN_STANDARD_ACHIEVEMENT.md` | Historical milestone |
| `STUDIO_INDUSTRY_STANDARD_IMPLEMENTATION.md` | Completed implementation |
| `FORM_SYSTEM_OVERHAUL_PLAN.md` | Superseded by new plan |

---

## Proposed Structure

### Directory Layout

```
docs/
├── README.md                    # 🆕 INDEX - Navigation hub
│
├── getting-started/             # 🆕 Onboarding docs
│   ├── QUICK_START.md
│   ├── LOCAL_DEVELOPMENT.md
│   └── CONTRIBUTING.md
│
├── architecture/                # System design docs
│   ├── ARCHITECTURE.md
│   ├── INFRASTRUCTURE_ARCHITECTURE.md
│   ├── GLOBAL_CONFIG_ARCHITECTURE.md
│   └── UNIFIED_PROXY_ARCHITECTURE.md
│
├── guides/                      # How-to guides (tasks)
│   ├── DEVELOPMENT_WORKFLOW.md
│   ├── DEPLOYMENT_GUIDE.md      # 🆕 Consolidated
│   ├── DATABASE_SYNC_GUIDE.md   # 🆕 Consolidated
│   ├── EMAIL_CONFIGURATION.md   # 🆕 Consolidated
│   ├── SSL_SETUP.md
│   └── branch-workflow-checklist.md
│
├── reference/                   # 🆕 Reference docs (lookup)
│   ├── CONFIGURATION_AND_SECRETS.md
│   ├── ENVIRONMENT_VARS.md
│   ├── FRONTEND_ENVIRONMENT_VARIABLES.md
│   ├── AUTHENTICATION_EXPLANATION.md
│   ├── TENANT_ACCESS_CONTROL.md
│   └── DJANGO_STAFF_PERMISSIONS_EXPLAINED.md
│
├── plans/                       # 🆕 Active plans (in-progress)
│   ├── ROADMAP.md
│   ├── ADMIN_BACKEND_REVAMP_PLAN.md
│   ├── DATA_ENTITY_RESTRUCTURING_PLAN.md
│   └── FORMS_FLOWS_ENHANCEMENT_PLAN.md
│
├── features/                    # 🆕 Feature documentation
│   ├── PAYMENT_SYSTEM.md        # 🆕 Consolidated
│   ├── INVITATION_SYSTEM.md     # 🆕 Consolidated
│   ├── GUEST_MODE.md            # 🆕 Consolidated
│   ├── WORKFLOW_ENGINE_API.md
│   └── DESIGN_SYSTEM.md
│
├── implementation-history/      # ✅ Already exists - historical record
│   └── [existing files...]
│
├── archive/                     # 🆕 Superseded/completed docs
│   ├── PHASE4_COMPLETE_IMPLEMENTATION.md
│   ├── DEPLOYMENT_EMERGENCY_FIX.md
│   ├── GOLDEN_STANDARD_ACHIEVEMENT.md
│   └── [other archived docs...]
│
└── CHANGELOG.md                 # Release notes (stays at root)
```

### Category Definitions

| Category | Purpose | Update Frequency | Audience |
|----------|---------|------------------|----------|
| **getting-started/** | Onboarding new developers | Rare | New team members |
| **architecture/** | System design decisions | When architecture changes | Senior devs, architects |
| **guides/** | Step-by-step how-to | When procedures change | All developers |
| **reference/** | Lookup information | When config changes | All developers |
| **plans/** | Active planning docs | Frequently | Project leads |
| **features/** | Feature documentation | When features change | All developers |
| **implementation-history/** | Historical record | Never (append only) | Archaeology |
| **archive/** | Superseded docs | Never | Reference only |

---

## Naming Conventions

### File Naming Rules

1. **UPPERCASE_WITH_UNDERSCORES** for all doc names
2. **Suffix indicates type**:
   - `_PLAN.md` - Planning document (in plans/)
   - `_GUIDE.md` - How-to guide (in guides/)
   - `_ARCHITECTURE.md` - System design (in architecture/)
   - No suffix - General reference or feature doc
3. **No dates in filenames** - Use document metadata instead
4. **Descriptive but concise** - 2-4 words max

### Examples

```
✅ GOOD:
- ADMIN_BACKEND_REVAMP_PLAN.md
- DATABASE_SYNC_GUIDE.md
- PAYMENT_SYSTEM.md
- INFRASTRUCTURE_ARCHITECTURE.md

❌ BAD:
- admin-backend-revamp.md (lowercase, hyphens)
- ADMIN_BACKEND_REVAMP_PLAN_2026_01_31.md (date in name)
- PLAN_FOR_REVAMPING_THE_ADMIN_BACKEND.md (too long)
- AdminBackendRevamp.md (camelCase)
```

---

## Document Template

All documents should follow this structure:

```markdown
# Document Title

**Document Version**: X.Y  
**Created**: YYYY-MM-DD  
**Last Updated**: YYYY-MM-DD  
**Status**: 📋 PLANNING | 🚧 IN PROGRESS | ✅ IMPLEMENTED | 📦 ARCHIVED  
**Owner**: [Team/Person]

---

## Table of Contents (for docs > 500 lines)

1. [Section 1](#section-1)
2. [Section 2](#section-2)

---

## Executive Summary (1-3 paragraphs)

Brief overview of what this document covers and why it matters.

---

## [Main Content Sections]

...

---

## Related Documents

| Document | Relationship |
|----------|--------------|
| `OTHER_DOC.md` | Parent/Child/Related |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | YYYY-MM-DD | Name | Initial version |

---

*Last Updated: YYYY-MM-DD*
```

---

## Index Document (README.md)

Create `/docs/README.md` as the navigation hub:

```markdown
# ProjectMeats Documentation

Welcome to the ProjectMeats documentation. Use this index to find what you need.

## 🚀 Getting Started

New to the project? Start here:
- [Quick Start Guide](getting-started/QUICK_START.md)
- [Local Development Setup](getting-started/LOCAL_DEVELOPMENT.md)
- [Contributing Guidelines](getting-started/CONTRIBUTING.md)

## 📋 Active Plans

What we're working on:
- [Roadmap](plans/ROADMAP.md) - Overall project direction
- [Admin Backend Revamp](plans/ADMIN_BACKEND_REVAMP_PLAN.md) - Data architecture overhaul
- [Forms & Flows Enhancement](plans/FORMS_FLOWS_ENHANCEMENT_PLAN.md) - Cockpit & workflows
- [Data Entity Restructuring](plans/DATA_ENTITY_RESTRUCTURING_PLAN.md) - App consolidation

## 🏗️ Architecture

System design documentation:
- [System Architecture](architecture/ARCHITECTURE.md)
- [Infrastructure](architecture/INFRASTRUCTURE_ARCHITECTURE.md)
- [Global Config](architecture/GLOBAL_CONFIG_ARCHITECTURE.md)
- [Proxy Architecture](architecture/UNIFIED_PROXY_ARCHITECTURE.md)

## 📖 Guides

How to do things:
- [Development Workflow](guides/DEVELOPMENT_WORKFLOW.md)
- [Database Sync](guides/DATABASE_SYNC_GUIDE.md)
- [Email Configuration](guides/EMAIL_CONFIGURATION.md)
- [SSL Setup](guides/SSL_SETUP.md)
- [Branch Workflow](guides/branch-workflow-checklist.md)

## 📚 Reference

Look up configuration and details:
- [Configuration & Secrets](reference/CONFIGURATION_AND_SECRETS.md)
- [Environment Variables](reference/ENVIRONMENT_VARS.md)
- [Authentication](reference/AUTHENTICATION_EXPLANATION.md)
- [Tenant Access Control](reference/TENANT_ACCESS_CONTROL.md)
- [Django Permissions](reference/DJANGO_STAFF_PERMISSIONS_EXPLAINED.md)

## ✨ Features

Feature-specific documentation:
- [Payment System](features/PAYMENT_SYSTEM.md)
- [Invitation System](features/INVITATION_SYSTEM.md)
- [Guest Mode](features/GUEST_MODE.md)
- [Workflow Engine API](features/WORKFLOW_ENGINE_API.md)
- [Design System](features/DESIGN_SYSTEM.md)

## 📦 Archive

Historical and superseded documents:
- [Archive Index](archive/README.md)
- [Implementation History](implementation-history/)

---

## Quick Links

| Need | Go To |
|------|-------|
| Set up local dev | [LOCAL_DEVELOPMENT.md](getting-started/LOCAL_DEVELOPMENT.md) |
| Deploy changes | [DEVELOPMENT_WORKFLOW.md](guides/DEVELOPMENT_WORKFLOW.md) |
| Add environment variable | [CONFIGURATION_AND_SECRETS.md](reference/CONFIGURATION_AND_SECRETS.md) |
| Understand architecture | [ARCHITECTURE.md](architecture/ARCHITECTURE.md) |
| See what's planned | [ROADMAP.md](plans/ROADMAP.md) |

---

*Last Updated: 2026-01-31*
```

---

## Implementation Phases

### Phase 1: Create Structure (1 hour)

- [ ] Create `/docs/README.md` index
- [ ] Create empty directories:
  - `/docs/getting-started/`
  - `/docs/architecture/`
  - `/docs/guides/`
  - `/docs/reference/`
  - `/docs/plans/`
  - `/docs/features/`
  - `/docs/archive/`

### Phase 2: Move Existing Docs (2 hours)

- [ ] Move onboarding docs to `getting-started/`
- [ ] Move architecture docs to `architecture/`
- [ ] Move how-to docs to `guides/`
- [ ] Move reference docs to `reference/`
- [ ] Move active plans to `plans/`
- [ ] Move feature docs to `features/`
- [ ] Move completed/superseded to `archive/`

### Phase 3: Consolidate Duplicates (3 hours)

- [ ] Merge Payment docs → `features/PAYMENT_SYSTEM.md`
- [ ] Merge Invitation docs → `features/INVITATION_SYSTEM.md`
- [ ] Merge Database Sync docs → `guides/DATABASE_SYNC_GUIDE.md`
- [ ] Merge Email docs → `guides/EMAIL_CONFIGURATION.md`
- [ ] Merge SSL docs → `guides/SSL_SETUP.md`

### Phase 4: Update Cross-References (1 hour)

- [ ] Update all internal links to new paths
- [ ] Update README.md links in root
- [ ] Update CONTRIBUTING.md links

### Phase 5: Add Metadata (2 hours)

- [ ] Add standard header to all docs missing it
- [ ] Add status badges (Planning/In Progress/Implemented/Archived)
- [ ] Add "Related Documents" section where missing

---

## Maintenance Guidelines

### When to Create a New Doc

1. **New feature** → Create in `features/`
2. **New how-to** → Create in `guides/`
3. **New plan** → Create in `plans/`
4. **Bug fix** → Add to `CHANGELOG.md`, NOT a new doc
5. **One-time procedure** → Don't create a doc, use PR description

### When to Archive a Doc

- Plan is fully implemented → Move to `archive/`
- Feature is deprecated → Move to `archive/`
- Document superseded by newer one → Move to `archive/`
- One-time fix is no longer relevant → Move to `archive/`

### When to Update vs Create New

| Scenario | Action |
|----------|--------|
| Minor correction | Update in place |
| Add new section | Update in place |
| Complete rewrite | Create new, archive old |
| Version 2 of feature | Update existing, note version |
| Different approach | Create new in plans/, reference old |

### Review Cadence

| Review Type | Frequency | Owner |
|-------------|-----------|-------|
| Archive stale docs | Monthly | Any developer |
| Update README index | When adding docs | Doc author |
| Consolidate duplicates | Quarterly | Tech lead |
| Full docs audit | Annually | Team |

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Time to find any doc | < 30 seconds |
| Docs with proper metadata | 100% |
| Duplicate doc pairs | 0 |
| Orphaned docs (no links) | 0 |
| Docs in correct category | 100% |

---

## Related Documents

| Document | Relationship |
|----------|--------------|
| `CONTRIBUTING.md` | References this for doc standards |
| `ADMIN_BACKEND_REVAMP_PLAN.md` | Example of well-structured plan |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-31 | Copilot | Initial plan |

---

*Last Updated: 2026-01-31*
