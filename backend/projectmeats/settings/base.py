"""
Base settings for ProjectMeats.
Common configuration shared across all environments.

================================================================================
MULTI-TENANCY ARCHITECTURE: SHARED SCHEMA ONLY (ZERO SCHEMA ISOLATION)
================================================================================

**CRITICAL ARCHITECTURAL DECISION (December 2025):**

ProjectMeats uses a **shared-schema multi-tenancy** approach exclusively:

1. **Single PostgreSQL Schema**
   - ALL tenants share the SAME PostgreSQL `public` schema
   - NO separate schemas per tenant
   - NO schema routing or switching logic

2. **Tenant Isolation Mechanism**
   - Business models have `tenant` ForeignKey to `apps.tenants.Tenant`
   - Custom `TenantMiddleware` resolves tenant from request context
   - ViewSets filter querysets: `queryset.filter(tenant=request.tenant)`
   - Serializers assign tenant on creation: `serializer.save(tenant=request.tenant)`

3. **Row-Level Security (RLS)**
   - PostgreSQL RLS policies enforce database-level isolation
   - Middleware sets `app.current_tenant` session variable before queries
   - RLS policies use: `current_setting('app.current_tenant')::uuid`
   - All tenant-aware tables MUST have RLS enabled in migrations

4. **Tenant Resolution Order**
   - `X-Tenant-ID` header (explicit API selection)
   - Domain match via `TenantDomain` model lookup
   - Subdomain matching using `tenant.slug` pattern
   - Authenticated user's default tenant association

5. **Middleware Stack**
   The `TenantMiddleware` is positioned EARLY in the middleware chain to ensure
   `request.tenant` is available for all subsequent processing:
   
   ```python
   MIDDLEWARE = [
       "corsheaders.middleware.CorsMiddleware",
       "apps.tenants.middleware.TenantMiddleware",  # ← Sets request.tenant
       "django.middleware.security.SecurityMiddleware",
       # ... other middleware
   ]
   ```

6. **Why Database-Level Isolation (RLS) Matters**
   - **Defense in Depth**: Even if application logic fails, database prevents leaks
   - **Performance**: Query planner optimizes with RLS knowledge
   - **Audit Trail**: Database logs show RLS policy enforcements
   - **Compliance**: Required for SOC 2, GDPR, HIPAA multi-tenant architectures

7. **Migration Pattern for RLS**
   ALL migrations creating tenant-aware tables MUST include:
   ```python
   from django.contrib.postgres.operations import RunSQL
   
   operations = [
       migrations.CreateModel(...),
       RunSQL(
           sql="ALTER TABLE app_model ENABLE ROW LEVEL SECURITY; "
               "CREATE POLICY model_tenant_isolation ON app_model "
               "USING (tenant_id = current_setting('app.current_tenant')::uuid);",
           reverse_sql="DROP POLICY IF EXISTS model_tenant_isolation ON app_model; "
                      "ALTER TABLE app_model DISABLE ROW LEVEL SECURITY;"
       ),
   ]
   ```

**⚠️ ABSOLUTE PROHIBITIONS:**
- ❌ NEVER use or suggest `django-tenants` package
- ❌ NEVER use schema-based isolation patterns
- ❌ NEVER use `migrate_schemas`, `migrate --tenant`, or similar commands
- ❌ NEVER reference `docs/archive/` for current implementation patterns

**✅ REQUIRED PRACTICES:**
- ✅ ALWAYS use `tenant` ForeignKey on business models
- ✅ ALWAYS filter by `.filter(tenant=request.tenant)` in ViewSets
- ✅ ALWAYS use standard `python manage.py migrate` command
- ✅ ALWAYS include RLS policies in tenant-aware table migrations

**Authority**: This docstring + `docs/architecture/ARCHITECTURE.md`
**Verification**: `ROW_LEVEL_SECURITY = True` flag (line 78 below)

================================================================================
"""

from pathlib import Path
import os

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# ------------------------------------------------------------------------------
# Upload limits (align backend with frontend 10MB document uploads)
# ------------------------------------------------------------------------------
# Without this, Django can raise RequestDataTooBig during multipart parsing, which
# can surface as a 500 if not handled by DRF.
DATA_UPLOAD_MAX_MEMORY_SIZE = 20 * 1024 * 1024  # 20MB

# ==============================================================================
# SHARED SCHEMA MULTI-TENANCY CONFIGURATION
# ==============================================================================
# We use a custom TenantMiddleware (apps.tenants.middleware.TenantMiddleware)
# for tenant resolution based on domain/subdomain/headers. ALL apps run
# in a shared PostgreSQL schema with tenant_id foreign keys for isolation.

# Row-level security flag for PostgreSQL RLS policy enforcement
ROW_LEVEL_SECURITY = True

# Common Django apps used across the application
_DJANGO_CORE_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.postgres",
]

# Third-party apps
_THIRD_PARTY_APPS = [
    "channels",  # Phase 7.3: WebSocket foundation (ASGI)
    "rest_framework",
    "rest_framework.authtoken",
    "rest_framework_simplejwt.token_blacklist",  # JWT token blacklist (Wave S1)
    "corsheaders",
    "drf_spectacular",
    "django_filters",
    "django_modal_actions",  # Modal dialogs for Django Admin actions
    "flags",  # Feature flags for gradual rollout (v2.0 Wave 0)
    "django_celery_beat",  # Database-backed periodic task scheduler
]

# ProjectMeats apps (all in shared schema with tenant_id isolation)
_PROJECT_APPS = [
    "apps.core",
    "apps.tenants",  # Tenant management (shared-schema approach)
    "apps.system",   # NEW: Centralized configuration system (v2.0 Wave 1)
    "apps.email_integration",  # Email OAuth & webhooks (system-level)
    "apps.integrations",  # Workflow email providers + tenant OAuth token store (ExternalAuthProvider)
    "tenant_apps.integrations.apps.TenantIntegrationsConfig",  # Tenant webhooks + API keys (unique label: tenant_integrations)
    # NOTE: apps.schema_builder DELETED in v2.0 Wave 1 (0 records, superseded by workflows)
    # NOTE: shared_apps.system_config ARCHIVED 2026-02-14 (Phase 2 cleanup, superseded by apps.system)
    # Business apps (all use tenant_id for data isolation)
    # NOTE: tenant_apps.accounts_receivables DELETED in v2.0 Wave 1 (0 records, merged into invoices)
    "tenant_apps.ai_assistant",
    "tenant_apps.bug_reports",
    "tenant_apps.carriers",
    "tenant_apps.cockpit",
    "tenant_apps.contacts",
    "tenant_apps.customers",
    "tenant_apps.deals",
    "tenant_apps.fulfillments",  # Fulfillment tracking
    "tenant_apps.inquiries",  # Inquiry management
    "tenant_apps.invoices",
    "tenant_apps.locations",
    "tenant_apps.orders",  # Wave 6: Abstract base order classes
    "tenant_apps.plants",
    "tenant_apps.products",
    "tenant_apps.purchase_orders",
    "tenant_apps.sales_orders",
    "tenant_apps.suppliers",
    "tenant_apps.workflows",  # Bundle Two: Tenant Workflows & New Data Entities
]

# All apps in one shared schema
INSTALLED_APPS = (
    _DJANGO_CORE_APPS
    + ["django.contrib.staticfiles"]
    + _THIRD_PARTY_APPS
    + _PROJECT_APPS
)

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # Must be first for CORS headers
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # Static files middleware
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.tenants.middleware.TenantMiddleware",  # Must be after AuthenticationMiddleware to access request.user
    "apps.core.middleware.audit_context.AuditContextMiddleware",  # Capture request metadata for audit trails
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Phase 9: Security Hardening
    "apps.core.middleware.hardening.SecurityHardeningMiddleware",  # CSP, security headers
    "apps.core.middleware.hardening.RateLimitMiddleware",  # Rate limiting for auth endpoints
]

ROOT_URLCONF = "projectmeats.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "projectmeats.wsgi.application"
ASGI_APPLICATION = "projectmeats.asgi.application"

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# URL Configuration
APPEND_SLASH = True  # Ensure trailing slash handling for API endpoints

# Static files (CSS, JavaScript, Images)
STATIC_URL = "/static/"
STATIC_ROOT = Path(os.environ.get("STATIC_ROOT", BASE_DIR / "staticfiles"))
STATICFILES_DIRS = [
    BASE_DIR / "static",
]

# Media files
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", BASE_DIR / "media"))

# Static files storage - WhiteNoise for production
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django REST Framework Configuration
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FileUploadParser",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        # JWT Authentication (Wave S1: Security Hardening)
        # Short-lived access tokens with refresh token rotation
        "apps.tenants.authentication.TenantAwareJWTAuthentication",
        # Legacy token auth (for backward compatibility during migration)
        "apps.tenants.authentication.TenantAwareTokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",  # For Studio and browsable API
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    # Rate Limiting / Throttling (Wave S2: Security Hardening)
    # Prevents brute force attacks and API abuse
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "20/minute",      # Anonymous users: 20 requests/minute
        "user": "100/minute",     # Authenticated users: 100 requests/minute
        "auth": "5/minute",       # Auth endpoints (login/register): 5/minute
        "burst": "60/minute",     # Burst-allowed endpoints: 60/minute
        # AI endpoints (billing guardrails)
        "ai_chat": "20/minute",
        "ai_feedback": "30/minute",
    },
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.core.exceptions.exception_handler",
}

# ==============================================================================
# JWT AUTHENTICATION (Wave S1: Security Hardening)
# ==============================================================================
# Replace perpetual tokens with industry-standard JWT
# Access tokens expire quickly; refresh tokens rotate on use
from datetime import timedelta

SIMPLE_JWT = {
    # Token lifetimes
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),  # Short-lived for security
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),     # Longer-lived, rotates on use
    "SLIDING_TOKEN_LIFETIME": timedelta(minutes=15),
    "SLIDING_TOKEN_REFRESH_LIFETIME": timedelta(days=1),
    
    # Token rotation: issue new refresh token on each refresh
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,  # Blacklist old refresh tokens
    
    # Algorithm (uses SECRET_KEY for signing by default)
    "ALGORITHM": "HS256",
    
    # Auth header
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    
    # Token claims
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "TOKEN_TYPE_CLAIM": "token_type",
    
    # Custom claims (add tenant info for multi-tenancy)
    "TOKEN_OBTAIN_SERIALIZER": "apps.core.jwt_serializers.TenantAwareTokenObtainPairSerializer",
}

# API Documentation
SPECTACULAR_SETTINGS = {
    "TITLE": "ProjectMeats API",
    "DESCRIPTION": """
# ProjectMeats REST API v2.0

Multi-tenant meat sales broker management system.

## Authentication
All endpoints require Token authentication via the `Authorization` header:
```
Authorization: Token your-auth-token
```

## Multi-Tenancy
Include tenant context via the `X-Tenant-ID` header:
```
X-Tenant-ID: your-tenant-uuid
```

## API Modules
- **System Configuration**: Choice lists, field schemas, tenant configs
- **Accounts**: User authentication and profiles
- **Tenants**: Multi-tenancy management
- **Customers**: Customer CRM
- **Suppliers**: Supplier management
- **Products**: Product catalog
- **Purchase Orders**: PO lifecycle management
- **Sales Orders**: SO lifecycle management
- **Invoices/Accounting**: Financial management
- **Plants**: Processing facility management
- **Carriers**: Shipping carrier management
- **Workflows**: Form and approval workflows
- **AI Assistant**: AI-powered recommendations

## Response Format
All responses follow standard REST conventions with JSON payloads.
Paginated lists include `count`, `next`, `previous`, and `results` fields.
    """,
    "VERSION": "2.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SORT_OPERATIONS": False,
    "TAGS": [
        {"name": "Health", "description": "Service health checks"},
        {"name": "Auth", "description": "Authentication and tokens"},
        {"name": "System", "description": "System configuration (choice lists, schemas)"},
        {"name": "Tenants", "description": "Multi-tenancy management"},
        {"name": "Customers", "description": "Customer CRM operations"},
        {"name": "Suppliers", "description": "Supplier management"},
        {"name": "Products", "description": "Product catalog"},
        {"name": "Purchase Orders", "description": "Purchase order lifecycle"},
        {"name": "Sales Orders", "description": "Sales order lifecycle"},
        {"name": "Invoices", "description": "Invoice and accounting"},
        {"name": "Plants", "description": "Processing facilities"},
        {"name": "Carriers", "description": "Shipping carriers"},
        {"name": "Contacts", "description": "Contact management"},
        {"name": "Locations", "description": "Address and location management"},
        {"name": "Workflows", "description": "Form and approval workflows"},
        {"name": "Workspace", "description": "User workspace and dashboard"},
        {"name": "AI Assistant", "description": "AI-powered features"},
        {"name": "Feedback", "description": "Bug reports and feedback"},
    ],
    "SWAGGER_UI_SETTINGS": {
        "deepLinking": True,
        "persistAuthorization": True,
        "displayOperationId": False,
        "filter": True,
    },
    "REDOC_UI_SETTINGS": {
        "hideDownloadButton": False,
    },
    "POSTPROCESSING_HOOKS": [
        "drf_spectacular.hooks.postprocess_schema_enums",
        "projectmeats.schema_hooks.add_openapi_compat_aliases",
    ],

    # Keep enum component names stable to avoid OpenAPI baseline churn.
    "ENUM_NAME_OVERRIDES": {
        # ActivityLog/ScheduledCall entity_type
        # Use the Django TextChoices to match value/label pairs for the hash.
        "EntityTypeC00Enum": "tenant_apps.cockpit.models.EntityTypeChoices",
        # Keep notification priority stable across serializer reuse.
        "UserNotificationPriorityEnum": "tenant_apps.workflows.models.NotificationPriority",
        # Keep tenant webhook event_type stable across serializer reuse.
        "EventTypeEnum": "tenant_apps.integrations.models.TenantWebhookEventType",
        # Preserve the shipped OpenAPI contract name for transactional protein enums.
        "TypeOfProteinEnum": "apps.core.models.ProteinTypeChoices",
    },
}

# Ensure logs directory exists for file handlers
# Reference: https://docs.python.org/3/library/logging.html#logging.FileHandler
# This ensures the logs directory is created before Django configures logging,
# preventing FileNotFoundError in CI/CD environments and local development.
os.makedirs(BASE_DIR / "logs", exist_ok=True)

# Logging Configuration
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
        "file": {
            "class": "logging.FileHandler",
            "filename": BASE_DIR / "logs" / "django.log",
            "formatter": "verbose",
        },
        "debug_file": {
            "class": "logging.FileHandler",
            "filename": BASE_DIR / "logs" / "debug.log",
            "formatter": "verbose",
            "level": "DEBUG",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "projectmeats": {
            "handlers": ["console", "file", "debug_file"],
            "level": "DEBUG",
            "propagate": False,
        },
        "tenant_apps.suppliers.views": {
            "handlers": ["console", "debug_file"],
            "level": "DEBUG",
            "propagate": False,
        },
        "tenant_apps.customers.views": {
            "handlers": ["console", "debug_file"],
            "level": "DEBUG",
            "propagate": False,
        },
        "tenant_apps.contacts.views": {
            "handlers": ["console", "debug_file"],
            "level": "DEBUG",
            "propagate": False,
        },
        "tenant_apps.purchase_orders.views": {
            "handlers": ["console", "debug_file"],
            "level": "DEBUG",
            "propagate": False,
        },
        # NOTE: tenant_apps.accounts_receivables DELETED in v2.0 Wave 1
        "apps.core.exceptions": {
            "handlers": ["console", "debug_file"],
            "level": "DEBUG",
            "propagate": False,
        },
    },
}

# ==============================================================================
# Cache Configuration (Redis with Fallback)
# ==============================================================================
# REDIS_URL format: redis://[:password]@host:port/db
# If REDIS_URL/VALKEY_URL are not set, development/test may fall back to local memory.


def _env_flag(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


REDIS_URL = os.environ.get("REDIS_URL")
VALKEY_URL = os.environ.get("VALKEY_URL")
REDIS_BACKEND_URL = REDIS_URL or VALKEY_URL
REQUIRE_REDIS_READINESS = _env_flag("REQUIRE_REDIS_READINESS", False)

if REDIS_BACKEND_URL:
    # Redis cache for production (Phases 3, 8: Real-time search, parallelization)
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_BACKEND_URL,
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
                "CONNECTION_POOL_KWARGS": {
                    "max_connections": 50,
                    "retry_on_timeout": True,
                },
                "SOCKET_CONNECT_TIMEOUT": 5,
                "SOCKET_TIMEOUT": 5,
            },
            "KEY_PREFIX": "pm",
            "TIMEOUT": 300,  # 5 minutes default
        }
    }
else:
    # Local memory cache (development/testing fallback)
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "projectmeats-cache",
        }
    }

# ==============================================================================
# Channels / WebSockets (Phase 7.3)
# ==============================================================================
# Use Redis-backed channel layer when available; otherwise fall back to in-memory.
# IMPORTANT: Channel layer isolation is enforced at the application layer (tenant-scoped
# groups). Any database access from consumers must still respect RLS.

_CHANNEL_REDIS_URL = REDIS_BACKEND_URL
if _CHANNEL_REDIS_URL:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [_CHANNEL_REDIS_URL],
                "prefix": "pm",
            },
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }

# ==============================================================================
# OpenAI API Configuration
# ==============================================================================
# Required for Phase 2: AI-Powered Forms & Workflows
# - Field suggestions based on context
# - Natural language query processing
# - Dynamic workflow generation
# - Intent recognition

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_ORG_ID = os.environ.get("OPENAI_ORG_ID")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4")
OPENAI_MAX_TOKENS = int(os.environ.get("OPENAI_MAX_TOKENS", "2000"))
OPENAI_TEMPERATURE = float(os.environ.get("OPENAI_TEMPERATURE", "0.7"))

# ==============================================================================
# Sentry Configuration (Error Tracking & APM)
# ==============================================================================
# Phase 6.4: Real-time error tracking, performance monitoring, and alerting
# Required for production observability and incident response

SENTRY_ENABLED = os.environ.get("SENTRY_ENABLED", "").lower() in ("true", "1", "yes")
SENTRY_DSN = os.environ.get("SENTRY_DSN")

# Prefer explicit SENTRY_ENVIRONMENT, otherwise mirror the deployment environment.
# (Supports the requested DJANGO_ENV input without requiring it.)
SENTRY_ENVIRONMENT = (
    os.environ.get("SENTRY_ENVIRONMENT")
    or os.environ.get("DJANGO_ENV")
    or os.environ.get("ENVIRONMENT")
    or "development"
)

# Used by the AI assistant "get_recent_errors" tool (Phase 7: Sentry-GitHub-Copilot loop)
SENTRY_AUTH_TOKEN = os.environ.get("SENTRY_AUTH_TOKEN")
SENTRY_ORG_SLUG = os.environ.get("SENTRY_ORG_SLUG")
SENTRY_BASE_URL = os.environ.get("SENTRY_BASE_URL", "https://sentry.io")

if SENTRY_ENABLED and SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration

    env_norm = (SENTRY_ENVIRONMENT or "development").strip().lower()

    # Determine sample rate based on environment
    traces_sample_rate = 1.0  # Default for dev/uat
    if env_norm in {"prod", "production"}:
        traces_sample_rate = 0.1  # 10% sampling in production to reduce costs

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            DjangoIntegration(
                transaction_style="url",  # Group by URL pattern
                middleware_spans=True,    # Track middleware performance
                signals_spans=True,       # Track Django signals
            ),
            CeleryIntegration(),
        ],
        environment=SENTRY_ENVIRONMENT,

        # Performance Monitoring
        traces_sample_rate=traces_sample_rate,
        profiles_sample_rate=0.0,  # Disabled until needed (can enable later)

        # Error Filtering
        before_send=lambda event, hint: (
            # Filter out 404 errors to keep signal-to-noise ratio high
            None if event.get("exception", {}).get("values", [{}])[0].get("type") == "Http404" else event
        ),

        # Release Tracking
        release=os.environ.get("GIT_COMMIT_SHA", "unknown"),  # Set by CI/CD

        # Additional Options
        # Required for Seer (user-impact analysis) + richer debugging context.
        send_default_pii=True,
        in_app_include=["backend", "tenant_apps"],
        attach_stacktrace=True,   # Always include stacktraces
        max_breadcrumbs=50,       # Keep more breadcrumbs for context
    )

# ==============================================================================
# Microsoft OAuth Configuration (Phase 5)
# ==============================================================================
# Required for Outlook/Microsoft 365 integration
# - Calendar synchronization
# - Email integration  
# - Contact synchronization
# - SSO (Single Sign-On)

MICROSOFT_CLIENT_ID = os.environ.get("MICROSOFT_CLIENT_ID")
MICROSOFT_CLIENT_SECRET = os.environ.get("MICROSOFT_CLIENT_SECRET")
MICROSOFT_TENANT_ID = os.environ.get("MICROSOFT_TENANT_ID", "common")
MICROSOFT_REDIRECT_URI = os.environ.get(
    "MICROSOFT_REDIRECT_URI",
    "https://dev.meatscentral.com/integrations/microsoft/callback/"
)
MICROSOFT_AUTHORITY = f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}"
MICROSOFT_SCOPES = [
    "User.Read",           # Read user profile
    "Calendars.ReadWrite", # Read/write calendars
    "Mail.Read",           # Read email
    "Mail.Send",           # Send email
    "Contacts.ReadWrite",  # Read/write contacts
]


def env(key: str, default=None):
    """Small settings helper for env access (keeps config declarative)."""
    return os.environ.get(key, default)


MICROSOFT_OAUTH = {
    'CLIENT_ID': env('MICROSOFT_CLIENT_ID'),
    'REDIRECT_URI': env('MICROSOFT_REDIRECT_URI'),
}

# ==============================================================================
# Email Configuration (SendGrid Web API ONLY - NO SMTP)
# ==============================================================================
# CRITICAL: This backend uses HTTP/HTTPS exclusively - SMTP is completely disabled
# MANDATORY: Do NOT add EMAIL_HOST, EMAIL_PORT, EMAIL_USE_TLS, or EMAIL_HOST_USER
#            These variables will trigger SMTP behavior and cause Errno 111
# 
# Why Web API Only:
#   - SMTP ports (25, 587, 465) are blocked by firewalls → Errno 111
#   - SMTP handshakes are slow → 504 Gateway Timeout
#   - Web API uses HTTP/HTTPS (ports 80/443) → Always accessible, instant delivery
# ==============================================================================
EMAIL_BACKEND = 'sendgrid_backend.SendgridBackend'
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY') or os.environ.get('EMAIL_HOST_PASSWORD', '')
SENDGRID_SANDBOX_MODE_IN_DEBUG = False
DEFAULT_FROM_EMAIL = 'no-reply@meatscentral.com'
SERVER_EMAIL = 'no-reply@meatscentral.com'
# ==============================================================================
# ⚠️  DO NOT ADD: EMAIL_HOST, EMAIL_PORT, EMAIL_USE_TLS, EMAIL_USE_SSL
# ⚠️  These will cause Errno 111 (Connection Refused) and 504 timeouts
# ==============================================================================

# ==============================================================================
# Feature Flags Configuration (v2.0 Wave 0)
# ==============================================================================
# django-flags for gradual feature rollout
# See: https://django-flags.readthedocs.io/
#
# Usage in code:
#   from flags.state import flag_enabled
#   if flag_enabled('COCKPIT_V2'):
#       # Use new cockpit
#
# Usage in templates:
#   {% load feature_flags %}
#   {% flag_enabled 'COCKPIT_V2' as cockpit_v2 %}
#   {% if cockpit_v2 %}...{% endif %}
# ==============================================================================

FLAGS = {
    # Wave 2: Cockpit Command Center
    'COCKPIT_V2': [
        {'condition': 'boolean', 'value': True},  # Enabled by default (already deployed)
    ],
    'ENTITY_GRAPH': [
        {'condition': 'boolean', 'value': True},  # Enabled by default
    ],
    'COMMAND_PALETTE': [
        {'condition': 'boolean', 'value': True},  # Enabled by default
    ],
    'WIDGET_SYSTEM': [
        {'condition': 'boolean', 'value': True},  # Enabled by default
    ],
    
    # Wave 3: Forms & Flows (ready for testing)
    'FORMS_V2': [
        {'condition': 'boolean', 'value': False},  # Not yet enabled
    ],
    'WORKFLOW_ENGINE': [
        {'condition': 'boolean', 'value': False},  # Not yet enabled
    ],
    
    # Wave 4: Admin Studio
    'ADMIN_STUDIO_V2': [
        {'condition': 'boolean', 'value': False},  # Not yet enabled
    ],
    
    # Wave F: New Features
    'FILE_ATTACHMENTS': [
        {'condition': 'boolean', 'value': False},  # Coming in Wave F1
    ],
    'CARRIERS_MODULE': [
        {'condition': 'boolean', 'value': False},  # Coming in Wave F2
    ],
    'AI_ASSISTANT_V2': [
        {'condition': 'boolean', 'value': False},  # Coming in Wave F4
    ],
}

# ==============================================================================
# Celery Configuration (Task Queue & Scheduled Jobs)
# ==============================================================================
# Celery is used for:
# - Email polling (every 5 minutes)
# - Scheduled workflow execution
# - Background notifications
# - AI processing jobs
# ==============================================================================

# Broker and result backend (Redis)
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL') or REDIS_BACKEND_URL or 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND') or REDIS_BACKEND_URL or 'redis://localhost:6379/0'

# Task serialization
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_ACCEPT_CONTENT = ['json']

# Task execution
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes hard limit
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25 minutes soft limit

# Task result expiration
CELERY_RESULT_EXPIRES = 3600  # 1 hour

# Worker configuration
CELERY_WORKER_PREFETCH_MULTIPLIER = 4
CELERY_WORKER_MAX_TASKS_PER_CHILD = 1000

# Beat scheduler (for periodic tasks)
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# Timezone for scheduled tasks
CELERY_TIMEZONE = 'UTC'
CELERY_ENABLE_UTC = True
