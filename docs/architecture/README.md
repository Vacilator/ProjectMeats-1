# Architecture Documentation

> System design, infrastructure, and architectural decisions.

## Documents

| Document | Description |
|----------|-------------|
| [Architecture Overview](ARCHITECTURE.md) | High-level system architecture |
| [Infrastructure](INFRASTRUCTURE_ARCHITECTURE.md) | Cloud infrastructure and deployment |
| [Global Config](GLOBAL_CONFIG_ARCHITECTURE.md) | Configuration system design |
| [Unified Proxy](UNIFIED_PROXY_ARCHITECTURE.md) | Reverse proxy and routing |
| [Authentication](AUTHENTICATION_EXPLANATION.md) | Auth flows and token handling |

## Key Principles

### Multi-Tenancy
- **Shared-schema** architecture (NOT django-tenants)
- Tenant isolation via `tenant_id` foreign keys
- Standard Django migrations only

### API Design
- RESTful endpoints via Django REST Framework
- OpenAPI/Swagger documentation
- Tenant-scoped querysets

See [Master Plan](../plans/PROJECTMEATS_V2_MASTER_PLAN.md) for architectural decisions.
