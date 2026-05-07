# ProjectMeats Documentation

**Status**: 🔄 LIVING DOCUMENT  
**Category**: Navigation Index  
**Last Updated**: 2026-02-01

---

> **Maintained By**: Development Team

Welcome to the ProjectMeats documentation. This index helps you find what you need quickly.

---

## 🎉 What's New

### February 2026: WorkForms Enhancement Project Launched! 🚀

**NEW ACTIVE PROJECT**: Entity-Driven Form Builder & Workflow Containers

Major enhancement to WorkForms editor with 6-week, 9-phase implementation:
- 🏗️ **Entity Integration**: Forms auto-populate from entity schemas (Supplier, Customer, etc.)
- 📦 **Workflow Containers**: Group ANY node types for advanced automation
- 💾 **TenantWorkForms**: Save complete workflows with form references
- 📐 **Node Alignment**: Auto-align tools with keyboard shortcuts (Ctrl+Shift+H/V/D)
- 🖥️ **Fullscreen Mode**: Accessible editor with full capabilities

[View Full Project Plan →](features/WORKFORMS_ENHANCEMENT_PROJECT.md)

### February 2026: Wave 2 Complete! 

✅ **Cockpit Command Center** is now 100% complete (48/48 tasks)

**New Features Available Now:**
- 🎨 **Customizable Workspace**: Drag, resize, and arrange widgets
- ⌨️ **Command Palette**: Universal search with ⌘K / Ctrl+K
- 📊 **Entity Explorer**: Visual relationship graphs
- 💾 **Layout Persistence**: Syncs across devices

**Why don't I notice much change?** Most of Wave 2 was infrastructure (90%) with subtle UI improvements (10%). [Read the full explanation →](WHATS_NEW.md)

**What's coming next?** Waves 3-4 in March-April 2026 will bring more visible features like My Tasks dashboard and visual configuration editors.

---

## 🎯 Quick Navigation

| I want to... | Go to |
|--------------|-------|
| **See what's new** | [What's New](WHATS_NEW.md) 🆕 |
| **View active projects** | [WorkForms Enhancement](features/WORKFORMS_ENHANCEMENT_PROJECT.md) 🚀 **NEW** |
| **Understand Wave 2 completion** | [Wave 2 Explained](implementation-history/WAVE_2_COMPLETION_EXPLAINED.md) 🆕 |
| **Set up my local environment** | [Quick Start](getting-started/QUICK_START.md) → [Local Development](getting-started/LOCAL_DEVELOPMENT.md) |
| **Understand the architecture** | [Architecture Overview](architecture/ARCHITECTURE.md) |
| **Deploy to an environment** | [Development Workflow](guides/DEVELOPMENT_WORKFLOW.md) |
| **See the project roadmap** | [Master Plan v3.1](plans/PROJECTMEATS_V2_MASTER_PLAN.md) |
| **Track current progress** | [Progress Tracker](plans/PROGRESS_TRACKER.md) |
| **Configure secrets/env vars** | [Configuration & Secrets](reference/CONFIGURATION_AND_SECRETS.md) |
| **Contribute code** | [Contributing Guide](getting-started/CONTRIBUTING.md) |

---

## 📋 Canonical status & evidence

The canonical source of truth for **current** priorities, status, and shipped evidence is:

- **`MASTER_PLAN.md`** (repo root) — canonical plan + current truth snapshot
- **`.github/MASTER_PLAN.md`** — append-only shipped PR log

Everything under `docs/` is supporting reference/historical context. If anything here conflicts with `MASTER_PLAN.md`, treat it as outdated.

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
├── plans/                       # Planning documents (may be historical)
│   ├── PROJECTMEATS_V2_MASTER_PLAN.md  # Historical v2 plan (see repo-root MASTER_PLAN.md for current truth)
│   └── PROGRESS_TRACKER.md      # Historical progress tracker
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
│   ├── CONFIGURATION_AND_SECRETS.md  # Env var reference (see config/env.manifest.json for canonical mappings)
│   └── *.md                     # APIs, changelog, etc.
│
├── features/                    # Feature documentation
│   ├── README.md                # Index
│   └── *.md                     # Guest mode, payments, etc.
│
├── implementation-history/      # Historical implementation records
│   ├── README.md                # Index
│   ├── WAVE_2_COMPLETION_EXPLAINED.md  # 🆕 Wave 2 deep dive
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
| [MASTER_PLAN.md](../MASTER_PLAN.md) | Canonical priorities, sequencing, and current truth | 🎯 **Active** |
| [Progress Tracker](plans/PROGRESS_TRACKER.md) | Real-time progress tracking | 🎯 **Active** |
| [Documentation Standards](plans/DOCUMENTATION_STANDARDS.md) | Canonical planning and naming rules | 🎯 **Active** |
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
| Total documents | ~45 | ~40 |
| Organized in directories | ✅ 100% | 100% |
| Documents with metadata | ✅ 90%+ | 100% |
| Duplicate document pairs | ✅ 0 | 0 |

**Reorganization Status**: ✅ Complete (Wave 5, Phase D4 Complete)

---

## 🆘 Need Help?

1. **Can't find a document?** Check [implementation-history/](implementation-history/) for completed features
2. **Conflicting information?** See repo-root **`MASTER_PLAN.md`** (canonical) and `.github/MASTER_PLAN.md` (shipped PR log)
3. **Outdated docs?** Flag them for archive in a PR

---

*This index is part of the [Documentation Organization Plan](plans/DOCUMENTATION_ORGANIZATION_PLAN.md)*
