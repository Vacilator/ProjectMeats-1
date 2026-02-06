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
from .health import health_check, health_detailed, ready_check, health_workforms
from apps.core.admin_site import admin_site

# Keep default admin for backwards compatibility, but use custom site as primary
admin.site.site_header = '🥩 Meats Central Admin'
admin.site.site_title = 'Meats Central'
admin.site.index_title = 'Admin Dashboard'

urlpatterns = [
    # Health check endpoints
    path("api/v1/health/", health_check, name="health-check"),
    path("api/v1/health/detailed/", health_detailed, name="health-detailed"),
    path("api/v1/health/workforms/", health_workforms, name="health-workforms"),
    path("api/v1/ready/", ready_check, name="ready-check"),
    # System Configuration Studio (Blueprint Editor) - MUST come before admin/
    path("admin/system-config/", include("shared_apps.system_config.urls")),
    # Admin interface (using custom three-tier admin site)
    path("admin/", admin_site.urls),
    # Legacy admin (redirect to custom admin)
    path("admin-legacy/", admin.site.urls),
    # API v1 endpoints
    path("api/v1/system/", include("apps.system.urls")),  # NEW: Centralized config system (v2.0 Wave 1)
    path("api/v1/", include("apps.tenants.urls")),  # Multi-tenancy endpoints (shared)
    # NOTE: accounts_receivables DELETED in v2.0 Wave 1 (merged into invoices/accounting)
    path("api/v1/", include("tenant_apps.suppliers.urls")),
    path("api/v1/", include("tenant_apps.customers.urls")),
    path("api/v1/", include("tenant_apps.contacts.urls")),
    path("api/v1/", include("tenant_apps.purchase_orders.urls")),
    path("api/v1/", include("tenant_apps.sales_orders.urls")),
    path("api/v1/", include("tenant_apps.plants.urls")),
    path("api/v1/", include("tenant_apps.carriers.urls")),
    path("api/v1/", include("tenant_apps.products.urls")),
    # Invoices → Accounting rename (v2.0 Wave 1 Week 4)
    path("api/v1/", include("tenant_apps.invoices.urls")),                      # Legacy (deprecated)
    path("api/v1/accounting/", include("tenant_apps.invoices.urls")),           # NEW canonical path
    path("api/v1/", include("tenant_apps.locations.urls")),
    path("api/v1/ai-assistant/", include("tenant_apps.ai_assistant.urls")),
    path("api/v1/", include("apps.core.urls")),  # Core shared utilities
    # Bug Reports → Feedback rename (v2.0 Wave 1 Week 3)
    path("api/v1/bug-reports/", include("tenant_apps.bug_reports.urls")),  # Legacy (deprecated)
    path("api/v1/feedback/", include("tenant_apps.bug_reports.urls")),      # NEW canonical path
    # Cockpit → Workspace rename (v2.0 Wave 1 Week 3)
    path("api/v1/cockpit/", include("tenant_apps.cockpit.urls")),           # Legacy (deprecated)
    path("api/v1/workspace/", include("tenant_apps.cockpit.urls")),         # NEW canonical path
    path("api/v1/", include("tenant_apps.inquiries.urls")),  # Inquiry management
    path("api/v1/", include("tenant_apps.fulfillments.urls")),  # Fulfillment tracking
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

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
