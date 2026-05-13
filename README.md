# Meats Central

![Status](https://img.shields.io/badge/Status-Production%20Ready-green)
![Tests](https://img.shields.io/badge/Tests-1900%2B%20Passing-brightgreen)
![Phases](https://img.shields.io/badge/Phases-38%20Active%20%7C%2040%20Complete-blueviolet)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20%7C%200%20Errors-blue)

**The simplest, most powerful end-to-end meat supply-chain platform on earth.**

Email → Order → Fulfillment with AI-powered automation. Hands-free meat trading at scale.

---

## ✨ Platform Highlights

| Feature | Description |
|---------|-------------|
| 🏠 **Modern Home Workspace** | Clean, card-based landing page with quick-access entity creation and recent activity |
| 📝 **Premium Entity Forms** | Supplier PO, Sales Order, Invoice, Carrier, Carrier PO — all with validation, prefill, and error boundaries |
| 🤖 **AI Feedback & Approval** | AI-powered suggestions with RLHF feedback loops, confidence scoring, and human-in-the-loop approvals |
| 🔍 **Universal Search (Ctrl+K)** | Instant, grouped search results across all entities — suppliers, customers, products, orders |
| 💬 **AI Chat Assistant** | Context-aware assistant with session history, knowledge base integration, and lineage tracking |
| ⚡ **Workflow Automation** | Visual drag-and-drop workflow editor with conditional logic, loops, and multi-trigger execution |
| 📧 **AI Inbox** | Automated email parsing, PO extraction, and draft creation (15-min sync) |
| 🏢 **Multi-Tenant** | Shared-schema + PostgreSQL RLS for database-level tenant isolation |
| 📱 **Mobile Ready** | React Native companion app with shared business logic |

---

## 🚀 Demo Access

| Environment | URL | Credentials |
|-------------|-----|-------------|
| **Development** | https://dev.meatscentral.com | See internal runbook |
| **UAT** | https://uat.meatscentral.com | See internal runbook |

### Investor Demo Flow (5 minutes)

1. **Login** → lands on clean Home workspace with quick-access cards
2. **Universal Search** → press Ctrl+K, type any entity — see grouped, instant results
3. **Entity Creation** → open Supplier PO form — see premium validation, prefill, and error boundaries
4. **AI Assistant** → open chat panel — ask a question, see session history and context awareness
5. **Workflow Editor** → drag-and-drop nodes, configure triggers, preview automation flows
6. **AI Feedback** → review AI suggestions, provide RLHF feedback, approve/reject with confidence scores
7. **Master Data** → Suppliers → Plants → Contacts with enriched relationship management

> 📋 Full walkthrough: [docs/INVESTOR_DEMO_GUIDE.md](docs/INVESTOR_DEMO_GUIDE.md)

---

## 🎯 Quick Links

| Resource | Purpose |
|----------|---------|
| [MASTER_PLAN.md](MASTER_PLAN.md) | Canonical priorities + current truth |
| [docs/GOLDEN_PIPELINE.md](docs/GOLDEN_PIPELINE.md) | Deployment standards |
| [manifests/GOLDEN_FILES.md](manifests/GOLDEN_FILES.md) | Source of truth registry |
| [docs/INVESTOR_DEMO_GUIDE.md](docs/INVESTOR_DEMO_GUIDE.md) | Step-by-step demo walkthrough |
| [docs/PRODUCTION_LAUNCH_CHECKLIST.md](docs/PRODUCTION_LAUNCH_CHECKLIST.md) | Go-live verification |

---

## 🏗️ Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Django 5.x, DRF, PostgreSQL 15, Redis, Celery, Channels (WebSocket) |
| **Frontend** | React 19, TypeScript 5.9, TanStack Query, Styled Components, React Flow |
| **Mobile** | React Native (Expo), shared business logic |
| **AI/ML** | OpenAI GPT-4, confidence scoring, RLHF feedback loops |
| **Infra** | Docker, GitHub Actions, DigitalOcean, Nginx, bastion tunnels |

### Multi-Tenancy: Shared Schema + RLS

```python
class TenantAwareModel(TimestampModel):
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE)
    custom_data = models.JSONField(default=dict, blank=True)
    objects = TenantManager()

    class Meta:
        abstract = True
```

PostgreSQL Row-Level Security (RLS) enforces tenant isolation at the database level via `app.current_tenant` session variable.

### Repository Structure

```
ProjectMeats/
├── backend/                 # Django backend (19 tenant apps)
│   ├── apps/               # Shared apps (core, tenants, integrations)
│   ├── tenant_apps/        # Business apps (workflows, ai_assistant, suppliers, etc.)
│   └── projectmeats/       # Settings, URLs, ASGI/WSGI
├── frontend/               # React 19 + TypeScript
│   ├── src/pages/          # 50+ page components
│   ├── src/components/     # Reusable UI (Cockpit, FlowEditor, Trader, AI)
│   └── src/services/       # 30+ API service modules (businessApi pattern)
├── mobile/                 # React Native app
├── docs/                   # Architecture, guides, standards
├── manifests/              # Golden files, env manifest
├── deploy/                 # Nginx, Terraform
└── .github/workflows/      # 18 CI/CD workflows (golden pipeline)
```

### Deployment Pipeline

```
development ──→ UAT ──→ production
     │            │           │
  dev-env     uat-env     prod-env
  (auto)      (promote)   (promote)
```

- **Immutable images**: SHA-tagged, pushed to DOCR + GHCR
- **Bastion migrations**: SSH tunnel → Docker `--network host` → `migrate --fake-initial`
- **Health checks**: Backend `:8000/api/v1/health/` + Frontend `:8080/` (container direct)

---

## 🚀 Quick Start

### Prerequisites
- Docker Desktop
- Node.js 18+
- Python 3.12+

### Local Development

```bash
# 1. Start infrastructure (PostgreSQL, Redis)
make dev

# 2. Run migrations
cd backend && python manage.py migrate

# 3. Create superuser
python manage.py createsuperuser

# 4. Start servers
# Terminal 1: Backend
python manage.py runserver

# Terminal 2: Frontend
cd frontend && npm run dev
```

**Access Points:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/v1/
- API Docs: http://localhost:8000/api/docs/

---

## 🧪 Testing

```bash
# Backend (213+ test files, 1900+ tests, all passing)
cd backend && python manage.py test tenant_apps/ apps/ --verbosity=1

# Frontend (TypeScript strict, 0 errors)
cd frontend && npx tsc --noEmit

# Frontend unit tests
cd frontend && npm test

# E2E tests
cd frontend && npx playwright test
```

### Test Coverage Highlights
- **213+ test files** across backend, frontend, and E2E suites
- **Entity Forms**: Comprehensive validation, prefill, and error boundary tests
- **AI Assistant**: Chat sessions, feedback loops, knowledge base, lineage events
- **Workflow Engine**: Multi-trigger routing, loop logic, dead letter queues, conditional execution
- **Model Consolidation**: 52 tests (7 DRY mixins) + RLS compliance auditing
- **E2E Executors**: Sales order generation, bid selection, contact resolution
- **Render Stability**: Custom lint rules preventing React #185 and hydration churn

---

## 🔐 Security & Compliance

- **Tenant Isolation**: PostgreSQL RLS + Django middleware (`app.current_tenant`)
- **Authentication**: JWT with automatic refresh, session management
- **Secrets**: Managed via `manifests/env.manifest.json` + GitHub Environments
- **Audit**: `python config/manage_env.py audit` validates secret parity
- **CORS**: Strict origin whitelisting in production
- **CSRF**: Secure cookies with SameSite=Strict

---

## 📖 Additional Resources

- **[Contributing Guide](CONTRIBUTING.md)** — Branch workflow, PR checklist, coding standards
- **[Testing Instructions](archived/docs/TESTING_INSTRUCTIONS.md)** — How to run and write tests *(archived)*
- **[Golden Pipeline](docs/GOLDEN_PIPELINE.md)** — Deployment architecture (authoritative)
- **[Migration Standards](docs/workforms/MIGRATION_STANDARDS.md)** — Additive-only, tenant-safe

---

**Last Updated**: June 2026
**Status**: ✅ Production Ready
**Architecture Version**: Golden Pipeline v1.0
**Platform Version**: Phase 38 Active · 40 Phases Complete
