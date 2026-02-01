# ProjectMeats Documentation

> **Last Updated**: 2026-02-01  
> **Maintained By**: Development Team

Welcome to the ProjectMeats documentation. This index helps you find what you need quickly.

---

## 🎯 Quick Navigation

| I want to... | Go to |
|--------------|-------|
| **Set up my local environment** | [Quick Start](getting-started/QUICK_START.md) → [Local Development](getting-started/LOCAL_DEVELOPMENT.md) |
| **Understand the architecture** | [Architecture Overview](architecture/ARCHITECTURE.md) |
| **Deploy to an environment** | [Development Workflow](guides/DEVELOPMENT_WORKFLOW.md) |
| **See the project roadmap** | [Master Plan v3.1](plans/PROJECTMEATS_V2_MASTER_PLAN.md) |
| **Track current progress** | [Progress Tracker](plans/PROGRESS_TRACKER.md) |
| **Configure secrets/env vars** | [Configuration & Secrets](reference/CONFIGURATION_AND_SECRETS.md) |
| **Contribute code** | [Contributing Guide](getting-started/CONTRIBUTING.md) |

---

## 📋 Source of Truth Documents

These are the **authoritative** documents for ProjectMeats. When in doubt, these are correct:

| Topic | Source of Truth | Last Updated |
|-------|-----------------|--------------|
| **Overall v2.0 Plan** | [Master Plan v3.1](plans/PROJECTMEATS_V2_MASTER_PLAN.md) | 2026-02-01 |
| **Current Progress** | [Progress Tracker](plans/PROGRESS_TRACKER.md) | 2026-02-01 |
| **CI/CD Pipeline** | [Roadmap](ROADMAP.md) + [Golden Pipeline](reference/GOLDEN_PIPELINE.md) | 2026-01-04 |
| **Secrets & Config** | [Configuration & Secrets](reference/CONFIGURATION_AND_SECRETS.md) | 2026-01-04 |
| **Multi-Tenancy** | [Architecture](architecture/ARCHITECTURE.md) | Shared-schema, NOT django-tenants |
| **Frontend Styling** | [Design System](guides/DESIGN_SYSTEM.md) | 2026-01-31 |
| **Deployment Process** | [Development Workflow](guides/DEVELOPMENT_WORKFLOW.md) | 2026-01-04 |

### ⚠️ Superseded Plans (Archived)

These documents have been **archived** to `archive/superseded-plans/`:

| Document | Superseded By | Status |
|----------|---------------|--------|
| `FORM_SYSTEM_OVERHAUL_PLAN.md` | [Master Plan Wave 3](plans/PROJECTMEATS_V2_MASTER_PLAN.md#wave-3-forms--flows) | 📦 Archived |
| `FORM_EDITOR_AND_EXECUTION.md` | [Forms Enhancement Plan](plans/FORMS_FLOWS_ENHANCEMENT_PLAN.md) | 📦 Archived |
| `DATA_ENTITY_RESTRUCTURING_PLAN.md` | [Master Plan Wave 6](plans/PROJECTMEATS_V2_MASTER_PLAN.md#wave-6-model-migrations) | 📦 Archived |
| `ADMIN_BACKEND_REVAMP_PLAN.md` | [Master Plan Wave 4](plans/PROJECTMEATS_V2_MASTER_PLAN.md#wave-4-admin-studio-enhancement) | 📦 Archived |

---

## 📁 Directory Structure

```
docs/
├── README.md                    ← You are here (navigation hub)
│
├── plans/                       # 🎯 Active planning documents
│   ├── PROJECTMEATS_V2_MASTER_PLAN.md  # THE source of truth for v2.0
│   └── PROGRESS_TRACKER.md      # Living progress document
│
├── getting-started/             # Onboarding & setup
│   ├── README.md                # Index
│   ├── QUICK_START.md           # 5-minute setup
│   ├── LOCAL_DEVELOPMENT.md     # Full environment setup
│   └── CONTRIBUTING.md          # Git workflow
│
├── architecture/                # System design & patterns
│   ├── README.md                # Index
│   ├── ARCHITECTURE.md          # Overview
│   └── *.md                     # Infrastructure, auth, etc.
│
├── guides/                      # How-to guides & tutorials
│   ├── README.md                # Index
│   └── *.md                     # Development, email, SSL, etc.
│
├── reference/                   # Technical reference
│   ├── README.md                # Index
│   ├── CONFIGURATION_AND_SECRETS.md  # Env var source of truth
│   └── *.md                     # APIs, changelog, etc.
│
├── features/                    # Feature documentation
│   ├── README.md                # Index
│   └── *.md                     # Guest mode, payments, etc.
│
├── implementation-history/      # Historical implementation records
│   ├── README.md                # Index
│   └── *.md                     # Completed feature docs
│
└── archive/                     # Superseded/completed docs
    └── superseded-plans/        # Replaced by Master Plan
```

---

## 📚 Document Categories

### 🚀 Getting Started
| Document | Description |
|----------|-------------|
| [Quick Start](getting-started/QUICK_START.md) | 5-minute setup guide |
| [Local Development](getting-started/LOCAL_DEVELOPMENT.md) | Full local environment setup |
| [Contributing](getting-started/CONTRIBUTING.md) | Git workflow and PR process |

### 🏗️ Architecture
| Document | Description |
|----------|-------------|
| [Architecture Overview](architecture/ARCHITECTURE.md) | System design and patterns |
| [Infrastructure](architecture/INFRASTRUCTURE_ARCHITECTURE.md) | Cloud architecture |
| [Global Config](architecture/GLOBAL_CONFIG_ARCHITECTURE.md) | Configuration system design |
| [Unified Proxy](architecture/UNIFIED_PROXY_ARCHITECTURE.md) | Reverse proxy architecture |

### 📋 Planning & Roadmap
| Document | Description | Status |
|----------|-------------|--------|
| [Master Plan v3.1](plans/PROJECTMEATS_V2_MASTER_PLAN.md) | Complete v2.0 overhaul plan | 🎯 **Active** |
| [Progress Tracker](plans/PROGRESS_TRACKER.md) | Real-time progress tracking | 🎯 **Active** |
| [Roadmap](ROADMAP.md) | CI/CD evolution roadmap | 🎯 **Active** |
| [Forms Enhancement](plans/FORMS_FLOWS_ENHANCEMENT_PLAN.md) | Forms & workflows plan | 🎯 **Active** |
| [Doc Organization](plans/DOCUMENTATION_ORGANIZATION_PLAN.md) | This reorganization effort | 🎯 **Active** |

### ⚙️ Configuration & Operations
| Document | Description |
|----------|-------------|
| [Configuration & Secrets](reference/CONFIGURATION_AND_SECRETS.md) | Environment variables and secrets |
| [Environment Vars](reference/ENVIRONMENT_VARS.md) | Backend environment reference |
| [Frontend Env Vars](reference/FRONTEND_ENVIRONMENT_VARIABLES.md) | Frontend environment reference |
| [Golden Pipeline](reference/GOLDEN_PIPELINE.md) | CI/CD pipeline reference |

### 🎨 Frontend & Design
| Document | Description |
|----------|-------------|
| [Design System](guides/DESIGN_SYSTEM.md) | UI/UX standards and components |
| [Studio User Guide](features/STUDIO_USER_GUIDE.md) | Admin Studio usage |

### 🔐 Security & Access
| Document | Description |
|----------|-------------|
| [Authentication](architecture/AUTHENTICATION_EXPLANATION.md) | Auth flow explanation |
| [Tenant Access Control](features/TENANT_ACCESS_CONTROL.md) | Multi-tenant permissions |
| [Guest Mode](features/GUEST_MODE_IMPLEMENTATION.md) | Guest user system |
| [Invite System](features/INVITE_ONLY_SYSTEM.md) | Invitation flow |

### 📧 Integrations
| Document | Description |
|----------|-------------|
| [SendGrid Config](guides/SENDGRID_CONFIGURATION_GUIDE.md) | Email setup |
| [Payment Workflow](features/PAYMENT_WORKFLOW_GUIDE.md) | Payment integration |

---

## 🔍 Search Tips

**Looking for something specific?** Try these searches in your IDE:

| To find... | Search for... |
|------------|---------------|
| API endpoints | `@router`, `urlpatterns`, `/api/v1/` |
| Environment variables | `os.environ`, `REACT_APP_`, `VITE_` |
| Feature flags | `flag_enabled`, `FLAGS` |
| Tenant filtering | `tenant=request.tenant` |
| Model definitions | `class.*Model` |

---

## 📊 Documentation Health

| Metric | Current | Target |
|--------|---------|--------|
| Total documents | 58 | ~40 (after consolidation) |
| Organized in directories | ✅ 100% | 100% |
| Documents with metadata | ~15% | 100% |
| Duplicate document pairs | ~12 | 0 (Phase D3) |

**Reorganization Status**: 🔄 In Progress (Wave 5, Phase D2 Complete)

---

## 🆘 Need Help?

1. **Can't find a document?** Check [implementation-history/](implementation-history/) for completed features
2. **Conflicting information?** The [Master Plan](plans/PROJECTMEATS_V2_MASTER_PLAN.md) is the source of truth
3. **Outdated docs?** Flag them for archive in a PR

---

*This index is part of the [Documentation Organization Plan](DOCUMENTATION_ORGANIZATION_PLAN.md)*
