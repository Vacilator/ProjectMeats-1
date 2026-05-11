"""
URL configuration for ProjectMeats.

Main URL routing for the Django REST API backend.
Provides versioned API endpoints and documentation.
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from apps.core.health_api import (
    HealthCheckAPIView,
    HealthDetailedAPIView,
    HealthWorkformsAPIView,
    ReadyCheckAPIView,
)
from apps.core.monitoring_views import PipelineHealthAPIView, SystemMetricsAPIView
from apps.core.admin_site import admin_site
from tenant_apps.integrations.views import SettlementEventIngestAPIView
from tenant_apps.workflows.views import SuggestNodesView
from tenant_apps.workflows.views_triggers import TenantScopedWebhookReceiverAPIView
from apps.email_integration.views.webhook_views import (
    tenant_gmail_webhook_notifications,
    tenant_outlook_webhook_notifications,
)

# Keep default admin for backwards compatibility, but use custom site as primary
admin.site.site_header = '🥩 Meats Central Admin'
admin.site.site_title = 'Meats Central'
admin.site.index_title = 'Admin Dashboard'

urlpatterns = [
    # Health check endpoints
    path("api/v1/health/", HealthCheckAPIView.as_view(), name="health-check"),
    path("api/v1/health/detailed/", HealthDetailedAPIView.as_view(), name="health-detailed"),
    path("api/v1/health/workforms/", HealthWorkformsAPIView.as_view(), name="health-workforms"),
    path("api/v1/ready/", ReadyCheckAPIView.as_view(), name="ready-check"),
    # Internal monitoring (admin-only)
    path("api/v1/internal/metrics/", SystemMetricsAPIView.as_view(), name="system-metrics"),
    path("api/v1/internal/pipeline-health/", PipelineHealthAPIView.as_view(), name="pipeline-health"),
    # NOTE: System Configuration Studio ARCHIVED 2026-02-14 (superseded by apps.system)
    # Admin interface (using custom three-tier admin site)
    path("admin/", admin_site.urls, name='admin'),  # Custom three-tier admin (primary)
    # Legacy admin (redirect to custom admin)
    path("admin-legacy/", admin.site.urls, name='admin-legacy'),  # Django default admin (legacy)
    # API v1 endpoints
    path("api/v1/system/", include("apps.system.urls")),  # NEW: Centralized config system (v2.0 Wave 1)
    path("api/v1/", include("apps.tenants.urls")),  # Multi-tenancy endpoints (shared)

    # Canonical public workflow webhook receiver (tenant selected via path).
    path(
        "api/v1/tenants/<uuid:tenant_id>/workflows/webhooks/<uuid:workflow_id>/<str:webhook_token>/",
        TenantScopedWebhookReceiverAPIView.as_view(),
        name="tenant-workflow-webhook-receiver",
    ),

    # Canonical public email webhook receivers (tenant selected via path).
    path(
        "api/v1/tenants/<uuid:tenant_id>/workflows/email/outlook/webhook/notifications/",
        tenant_outlook_webhook_notifications,
        name="tenant-outlook-email-webhook-notifications",
    ),
    path(
        "api/v1/tenants/<uuid:tenant_id>/workflows/email/gmail/webhook/notifications/",
        tenant_gmail_webhook_notifications,
        name="tenant-gmail-email-webhook-notifications",
    ),
    path(
        "api/v1/tenants/<uuid:tenant_id>/integrations/settlement-sources/<uuid:source_id>/events/",
        SettlementEventIngestAPIView.as_view(),
        name="tenant-settlement-event-ingest",
    ),

    path('api/v1/integrations/', include('integrations.urls')),
    path("api/v1/workflows/email/", include("apps.email_integration.urls")),  # Email integration & webhooks
    # NOTE: accounts_receivables DELETED in v2.0 Wave 1 (merged into invoices/accounting)
    path("api/v1/", include("tenant_apps.suppliers.urls")),
    path("api/v1/", include("tenant_apps.customers.urls")),
    path("api/v1/", include("tenant_apps.contacts.urls")),
    path("api/v1/", include("tenant_apps.purchase_orders.urls")),
    path("api/v1/", include("tenant_apps.sales_orders.urls")),
    path("api/v1/", include("tenant_apps.deals.urls")),
    path("api/v1/", include("tenant_apps.integrations.urls")),  # tenant webhooks + API keys
    path("api/v1/", include("tenant_apps.plants.urls")),
    path("api/v1/", include("tenant_apps.carriers.urls")),
    path("api/v1/", include("tenant_apps.products.urls")),
    # Invoices → Accounting rename (v2.0 Wave 1 Week 4)
    path("api/v1/", include("tenant_apps.invoices.urls")),                      # Legacy (deprecated)
    path("api/v1/accounting/", include("tenant_apps.invoices.urls")),           # NEW canonical path
    path("api/v1/", include("tenant_apps.locations.urls")),
    path("api/v1/", include("apps.core.urls")),  # Core shared utilities
    # Bug Reports → Feedback rename (v2.0 Wave 1 Week 3)
    path("api/v1/bug-reports/", include("tenant_apps.bug_reports.urls")),  # Legacy (deprecated)
    path("api/v1/feedback/", include("tenant_apps.bug_reports.urls")),      # NEW canonical path
    # Cockpit → Workspace rename (v2.0 Wave 1 Week 3)
    path("api/v1/cockpit/", include("tenant_apps.cockpit.urls")),           # Legacy (deprecated)
    path("api/v1/workspace/", include("tenant_apps.cockpit.urls")),         # NEW canonical path
    path("api/v1/", include("tenant_apps.inquiries.urls")),  # Inquiry management
    path("api/v1/", include("tenant_apps.fulfillments.urls")),  # Fulfillment tracking
    # Legacy alias (older clients) — canonical path is /api/v1/workflows/suggest-nodes/
    path("api/v1/suggest-nodes/", SuggestNodesView.as_view(), name="suggest-nodes-legacy"),
    path("api/v1/workflows/", include("tenant_apps.workflows.urls")),  # Bundle Two: Tenant Workflows
    # NOTE: schema-builder API DELETED in v2.0 Wave 1 (superseded by workflows)
    # API Documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
]

# Optional apps
if 'tenant_apps.ai_assistant' in settings.INSTALLED_APPS:
    from tenant_apps.ai_assistant.http_views import ai_inbox_websocket_probe

    urlpatterns.append(path("ws/ai/inbox/", ai_inbox_websocket_probe, name="ai-inbox-websocket-probe"))
    urlpatterns.append(path("api/v1/ai-assistant/", include("tenant_apps.ai_assistant.urls")))

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
