# ProjectMeats Documentation

**Status**: 🔄 LIVING DOCUMENT
**Category**: Navigation Index
**Last Updated**: 2026-05-14

---

> **Maintained By**: Development Team

Welcome to the ProjectMeats documentation. This index helps you find what you need quickly.

---

## 🎉 What's New

### May 2026: Phase 38 Active · 37 Phases Complete 🚀

**Platform Maturity**: Production-grade meat supply-chain platform with 213+ test files and 1900+ tests.

**Recent Highlights:**
- 🏠 **Home Workspace**: Clean, modern landing page replacing legacy cockpit views
- 📝 **Premium Entity Forms**: Supplier PO, Sales Order, Invoice, Carrier, Carrier PO — all with validation and error boundaries
- 🤖 **AI Feedback & Approval System**: RLHF loops, confidence scoring, human-in-the-loop approvals
- 🔍 **Universal Search (Ctrl+K)**: Grouped results across all entities
- 💬 **AI Chat Assistant**: Session history, knowledge base, semantic search, lineage tracking
- ⚡ **Workflow Automation Engine**: Visual editor with conditional logic, loops, dead letter queues
- 🛡️ **RLS Hardening**: 80+ tenant-aware tables with PostgreSQL Row-Level Security

[View Full Project Plan →](features/WORKFORMS_ENHANCEMENT_PROJECT.md) | [What's New](WHATS_NEW.md)

---

## 🎯 Quick Navigation

| I want to... | Go to |
|--------------|-------|
| **See what's new** | [What's New](WHATS_NEW.md) 🆕 |
| **View active projects** | [WorkForms Enhancement](features/WORKFORMS_ENHANCEMENT_PROJECT.md) 🚀 **NEW** |
| **Understand Wave 2 completion** | [What's New](WHATS_NEW.md) |
| **Set up my local environment** | [Quick Start](getting-started/QUICK_START.md) → [Local Development](getting-started/LOCAL_DEVELOPMENT.md) |
| **Understand the architecture** | [Architecture Overview](architecture/ARCHITECTURE.md) |
| **Deploy to an environment** | [Development Workflow](guides/DEVELOPMENT_WORKFLOW.md) |
| **See the project roadmap** | [MASTER_PLAN](../MASTER_PLAN.md) (canonical) |
| **Track current progress** | [MASTER_PLAN](../MASTER_PLAN.md) |
| **Configure secrets/env vars** | [Configuration & Secrets](reference/CONFIGURATION_AND_SECRETS.md) |
| **Contribute code** | [Contributing Guide](getting-started/CONTRIBUTING.md) |

---

## 📋 Canonical status & evidence

The canonical source of truth for **current** priorities, status, and shipped evidence is:

- **`MASTER_PLAN.md`** (repo root) — canonical plan + current truth snapshot
- **`.github/MASTER_PLAN.md`** — append-only shipped PR log

Everything under `docs/` is supporting reference/historical context. If anything here conflicts with `MASTER_PLAN.md`, treat it as outdated.

### ⚠️ Superseded Plans (Archived)

These documents have been **archived** to `plans/archive/`:

| Document | Superseded By | Status |
|----------|---------------|--------|
| `FORM_SYSTEM_OVERHAUL_PLAN.md` | [MASTER_PLAN.md](../MASTER_PLAN.md) | 📦 Archived |
| `FORM_EDITOR_AND_EXECUTION.md` | [MASTER_PLAN.md](../MASTER_PLAN.md) | 📦 Archived |
| `DATA_ENTITY_RESTRUCTURING_PLAN.md` | [MASTER_PLAN.md](../MASTER_PLAN.md) | 📦 Archived |
| `ADMIN_BACKEND_REVAMP_PLAN.md` | [MASTER_PLAN.md](../MASTER_PLAN.md) | 📦 Archived |

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
└── plans/archive/               # Superseded/completed historical plans
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
| [Documentation Standards](plans/DOCUMENTATION_STANDARDS.md) | Canonical planning and naming rules | 🎯 **Active** |

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
| [Guest Mode](features/GUEST_MODE.md) | Guest user system |
| [Invitation System](features/INVITATION_SYSTEM.md) | Invitation flow |

### 📧 Integrations
| Document | Description |
|----------|-------------|
| [Email Configuration](guides/EMAIL_CONFIGURATION.md) | Email setup |
| [Payment Guide](features/PAYMENT_DEVELOPER_GUIDE.md) | Payment integration |

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

1. **Can't find a document?** Check [plans/archive/](plans/archive/) for completed/superseded features
2. **Conflicting information?** See repo-root **`MASTER_PLAN.md`** (canonical) and `.github/MASTER_PLAN.md` (shipped PR log)
3. **Outdated docs?** Flag them for archive in a PR

---

*This index is part of the [Documentation Standards](plans/DOCUMENTATION_STANDARDS.md)*
