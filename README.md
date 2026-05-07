# Project Meats

![Status](https://img.shields.io/badge/Status-Active%20Development-blue)

**Multi-tenant meat supply-chain platform** - Shared-schema multi-tenancy with Django + React

**Status**: 🔄 Active development (canonical priorities + shipped evidence live in `MASTER_PLAN.md`)

---

## 🎯 Quick Links (Start Here)

**For All Contributors:**
- **[MASTER_PLAN.md](MASTER_PLAN.md)** - ✅ Canonical priorities + current truth snapshot
- **[manifests/GOLDEN_FILES.md](manifests/GOLDEN_FILES.md)** - 🗂️ Source of truth registry
- **[docs/GOLDEN_PIPELINE.md](docs/GOLDEN_PIPELINE.md)** - 🏆 Deployment standards (authoritative)
- **[docs/plans/DOCUMENTATION_STANDARDS.md](docs/plans/DOCUMENTATION_STANDARDS.md)** - 📚 Documentation source-of-truth rules

**For AI Agents:**
- **ALWAYS** reference `/manifests/GOLDEN_FILES.md` before proposing schema changes
- Use `MASTER_PLAN.md` as the single source of truth for current priorities/status
- Put any new scoped plan docs under `docs/plans/` using the `YYYY-MM-*` naming rule

---

## 📚 Documentation

### Quick Links
- **Architecture**: [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) - System architecture overview
- **Development**: [docs/getting-started/LOCAL_DEVELOPMENT.md](docs/getting-started/LOCAL_DEVELOPMENT.md) - Local setup guide
- **API Reference**: [docs/reference/ENVIRONMENT_VARS.md](docs/reference/ENVIRONMENT_VARS.md) - Environment variables
- **Contributing**: [docs/getting-started/CONTRIBUTING.md](docs/getting-started/CONTRIBUTING.md) - Contribution guidelines

### Core Documentation
| Document | Purpose |
|----------|---------|
| [GOLDEN_PIPELINE.md](docs/GOLDEN_PIPELINE.md) | 🏆 Deployment architecture (authoritative) |
| [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) | System architecture overview |
| [CONFIGURATION_AND_SECRETS.md](docs/CONFIGURATION_AND_SECRETS.md) | Secret management guide |
| [DEVELOPMENT_WORKFLOW.md](docs/guides/DEVELOPMENT_WORKFLOW.md) | Developer workflow |
| [QUICK_START.md](docs/getting-started/QUICK_START.md) | Quick start guide |

### Operations
| Document | Purpose |
|----------|---------|
| [ENVIRONMENT_VARS.md](docs/reference/ENVIRONMENT_VARS.md) | Environment variable reference |
| [TENANT_ACCESS_CONTROL.md](docs/features/TENANT_ACCESS_CONTROL.md) | Tenant access patterns |
| [GUEST_MODE_IMPLEMENTATION.md](docs/GUEST_MODE_IMPLEMENTATION.md) | Guest user system |
| [INVITE_ONLY_SYSTEM.md](docs/INVITE_ONLY_SYSTEM.md) | Invitation system |

### Setup & Configuration
| Document | Purpose |
|----------|---------|
| [LOCAL_DEVELOPMENT.md](docs/getting-started/LOCAL_DEVELOPMENT.md) | Local development setup |
| [MIGRATION_STANDARDS.md](docs/workforms/MIGRATION_STANDARDS.md) | Migration standards (additive-only, multi-tenant safe) |

---

## 🚀 Quick Start

### Prerequisites
- Docker Desktop
- Node.js 18+
- Python 3.12+
- PostgreSQL 15+ (via Docker)

### Local Development

```bash
# 1. Start Docker services (PostgreSQL, Redis)
make dev

# 2. Run migrations (standard Django, NOT migrate_schemas)
make migrate-all

# 3. Create superuser
cd backend && python manage.py createsuperuser

# 4. Start development servers
# Terminal 1: Backend
cd backend && python manage.py runserver

# Terminal 2: Frontend
cd frontend && npm start
```

**Access Points:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/v1/
- Django Admin: http://localhost:8000/admin/

---

## 🏗️ Architecture

### Multi-Tenancy: Shared Schema

ProjectMeats uses **shared-schema multi-tenancy** with row-level isolation:

```python
# ✅ CORRECT: Shared schema with tenant ForeignKey
class Customer(models.Model):
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    
    objects = TenantManager()  # Required for tenant isolation
```

❌ **NEVER** use `django-tenants` or schema-based isolation  
✅ **ALWAYS** use `tenant` ForeignKey with `TenantManager`

### Tech Stack

**Backend:**
- Django 5.x + Django REST Framework
- PostgreSQL 15 (shared schema)
- Redis (caching)
- Celery (async tasks)

**Frontend:**
- React 19 + TypeScript 5.9
- React Router v7
- TanStack Query (data fetching)
- Tailwind CSS

**Infrastructure:**
- Docker + Docker Compose
- GitHub Actions (CI/CD)
- DigitalOcean (hosting)
- Nginx (reverse proxy)

---

## 📂 Repository Structure

```
ProjectMeats/
├── backend/              # Django backend
│   ├── apps/            # Shared apps (tenants, core, etc.)
│   ├── tenant_apps/     # Tenant-specific apps
│   ├── projectmeats/    # Django project settings
│   └── manage.py
├── frontend/            # React frontend
│   ├── src/
│   ├── public/
│   └── package.json
├── mobile/              # React Native app
├── config/              # Configuration & secrets
│   ├── env.manifest.json  # Secret definitions (source of truth)
│   └── manage_env.py      # Secret audit tool
├── docs/                # Documentation
│   ├── GOLDEN_PIPELINE.md  # Authoritative architecture
│   ├── archived/           # Temporary/fix documentation
│   └── ...
├── scripts/             # Utility scripts
├── .github/workflows/   # CI/CD pipelines
└── docker-compose.yml   # Local development
```

---

## 🔐 Environment Variables

All environment variables are defined in `manifests/env.manifest.json` (single source of truth).

### Audit Secrets

```bash
# Check if all required secrets are configured
python config/manage_env.py audit
```

### Common Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host:5432/db` |
| `SECRET_KEY` | Django secret key | (50+ random characters) |
| `DJANGO_SETTINGS_MODULE` | Settings module | `projectmeats.settings.development` |

**Full Reference:** [docs/reference/ENVIRONMENT_VARS.md](docs/reference/ENVIRONMENT_VARS.md)

---

## 🧪 Testing

```bash
# Backend tests
cd backend
python manage.py test apps/ --verbosity=2

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e
```

---

## 🚢 Deployment

Deployments follow the **Golden Pipeline** architecture:

```
development → UAT → main (production)
     ↓         ↓        ↓
   dev-env  uat-env  prod-env
```

**Deployment Guide:** [docs/GOLDEN_PIPELINE.md](docs/GOLDEN_PIPELINE.md)

### Key Principles

1. **Immutable Images**: SHA-tagged Docker images
2. **Bastion Tunnel**: Migrations via SSH tunnel (port 5433)
3. **Environment Secrets**: Scoped to GitHub Environments
4. **Health Checks**: Automated verification post-deploy

---

## 👥 Contributing

We welcome contributions! Please read our [Contributing Guide](docs/getting-started/CONTRIBUTING.md).

### Branch Workflow

```bash
# 1. Create feature branch from development
git checkout development
git pull origin development
git checkout -b feature/your-feature-name

# 2. Make changes and commit
git add .
git commit -m "feat: your feature description"

# 3. Push and create PR
git push -u origin feature/your-feature-name
gh pr create --base development
```

### Development Rules

- **Multi-Tenancy**: All tenant models MUST use `objects = TenantManager()`
- **Migrations**: Use standard Django migrations (NOT `migrate_schemas`)
- **Testing**: Write tests for all new features
- **Documentation**: Update docs for architectural changes

---

## 📖 Additional Resources

### Configuration
- [manifests/env.manifest.json](manifests/env.manifest.json) - Secret definitions (source of truth)
- [config/README.md](config/README.md) - Configuration guide

### Workflows
- [.github/workflows/](.github/workflows/) - CI/CD pipelines

### Scripts
- [scripts/](scripts/) - Utility scripts
- [scripts/verify_golden_state.sh](scripts/verify_golden_state.sh) - Architecture verification

---

## 📝 License

Proprietary - All rights reserved

---

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/Meats-Central/ProjectMeats/issues)
- **Docs**: [docs/](docs/)
- **Architecture**: [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)

---

**Last Updated**: March 22, 2026  
**Status**: ✅ Active Development  
**Architecture Version**: Golden Pipeline v1.0
