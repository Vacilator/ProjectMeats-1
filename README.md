# Meats Central

![Status](https://img.shields.io/badge/Status-Production%20Ready-green)
![Tests](https://img.shields.io/badge/Tests-149%20Passing-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20%7C%200%20Errors-blue)

**The simplest, most powerful end-to-end meat supply-chain platform on earth.**

Email → Order → Fulfillment with 95%+ zero human touch. AI-powered, hands-free meat trading.

---

## ✨ Platform Highlights

| Feature | Description |
|---------|-------------|
| 🤖 **AI Trade Proposals** | Proactive trade suggestions with confidence scoring and one-click execution |
| 📧 **AI Inbox** | Automated email parsing, PO extraction, and draft creation (15-min sync) |
| 🎯 **Trader Command Center** | Unified 4-tab cockpit: Command Center, Live Pipeline, Operations, History |
| ⚡ **Smart Trade Creator** | 4-mode wizard: natural language, minimal fields, paste text, AI chat |
| 📊 **Process Cockpit** | Real-time monitoring with React Flow process diagrams and contact enrichment |
| 🔄 **E2E Automation** | Multi-trigger pipeline (email, manual, AI) with dependency approvals |
| 🏢 **Multi-Tenant** | Shared-schema + PostgreSQL RLS for database-level tenant isolation |
| 📱 **Mobile Ready** | React Native companion app with shared business logic |

---

## 🚀 Demo Access

| Environment | URL | Credentials |
|-------------|-----|-------------|
| **Development** | https://dev.meatscentral.com | `admin_test_development_1` / `password123!` |
| **UAT** | https://uat.meatscentral.com | (same pattern) |

### Investor Demo Flow (5 minutes)

1. **Login** → lands on Trader Command Center
2. **KPI Cards** → instant overview of active trades, pending approvals, AI confidence
3. **Smart Trade Creator** → type "50,000 lbs ground beef 81/19 for next Tuesday" → AI fills form
4. **AI Proposals tab** → see proactive trade suggestions with confidence badges
5. **Live Pipeline** → watch trades progress through stages with React Flow diagrams
6. **Process Cockpit** → monitor all processes, action required items, AI inbox drafts
7. **Master Data** → Suppliers → Plants → Contacts with enriched Plant Contact Types

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
# Backend (149 tests, all passing)
cd backend && python manage.py test tenant_apps/ apps/ --verbosity=1

# Frontend (TypeScript strict, 0 errors)
cd frontend && npx tsc --noEmit

# Frontend unit tests
cd frontend && npm test

# E2E tests
cd frontend && npx playwright test
```

### Test Coverage Highlights
- **E2E Executors**: 29 tests (sales order generation, bid selection, contact resolution)
- **Platform Finalization**: 12 tests (RFQ contacts, PO prefill, cockpit routing, PO 226052)
- **Model Consolidation**: 52 tests (7 DRY mixins)
- **Scaling/Observability**: 10 tests (correlation IDs, metrics)
- **E2E Templates**: 30+ tests (multi-trigger routing, loop logic)

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
- **[Testing Instructions](TESTING_INSTRUCTIONS.md)** — How to run and write tests
- **[Golden Pipeline](docs/GOLDEN_PIPELINE.md)** — Deployment architecture (authoritative)
- **[Migration Standards](docs/workforms/MIGRATION_STANDARDS.md)** — Additive-only, tenant-safe

---

**Last Updated**: May 8, 2026  
**Status**: ✅ Production Ready  
**Architecture Version**: Golden Pipeline v1.0  
**Platform Version**: Phase 20 (Industry Leader State)
