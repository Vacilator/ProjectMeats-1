from django.urls import include, path
from rest_framework.routers import DefaultRouter

from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from apps.system import workform_views  # Phase 1: WorkForms Enhancement

from . import entity_views  # Phase 1: WorkForms Enhancement
from . import calendar_views, portal_views, report_views, views
from .audit_views import TenantAuditEventViewSet
from .comment_views import CommentViewSet
from .jwt_serializers import TenantAwareTokenObtainPairView

# Create a router for ViewSets
router = DefaultRouter()
router.register(r"preferences", views.UserPreferencesViewSet, basename="user-preferences")
router.register(r"favorites", views.FavoritesViewSet, basename="favorites")
router.register(r"audit-events", TenantAuditEventViewSet, basename="audit-events")
router.register(r"comments", CommentViewSet, basename="comments")

# WorkForms router (Phase 1.4-1.6)
workforms_router = DefaultRouter()
workforms_router.register(r"tenant-forms", workform_views.TenantFormViewSet, basename="tenant-form")
workforms_router.register(r"tenant-workforms", workform_views.TenantWorkFormViewSet, basename="tenant-workform")

urlpatterns = [
    # Legacy auth endpoints (for backward compatibility)
    path("auth/login/", views.login, name="login"),
    # Demo guest mode only. Future B2B portal access must use signed tenant-scoped grants instead.
    path("auth/guest-login/", views.guest_login, name="guest-login"),
    path("auth/signup/", views.signup, name="signup"),
    path("auth/logout/", views.logout, name="logout"),
    # JWT Authentication endpoints (Wave S1: Security Hardening)
    # Preferred auth method: short-lived access tokens with refresh rotation
    path("auth/token/", TenantAwareTokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/token/verify/", TokenVerifyView.as_view(), name="token-verify"),
    # Choices endpoint for static dropdowns
    path("choices/", views.ChoicesAPIView.as_view(), name="choices"),
    # Feature Flags API (Wave 0: Preparation)
    path("feature-flags/", views.FeatureFlagsView.as_view(), name="feature-flags"),
    # Universal Search API (Wave 2: Cockpit Command Center)
    path("search/universal/", views.UniversalSearchView.as_view(), name="universal-search"),
    path("search/ranked/", views.RankedSearchView.as_view(), name="ranked-search"),  # Phase 2A Smart Rankings
    path("search/recent/", views.RecentItemsView.as_view(), name="recent-items"),
    path("search/operators/", views.SearchOperatorsView.as_view(), name="search-operators"),
    # Entity Graph API (Wave 2: Cockpit Command Center)
    path("entities/types/", views.EntityTypesView.as_view(), name="entity-types"),
    path("entities/<str:entity_type>/<int:entity_id>/", views.EntityDetailView.as_view(), name="entity-detail"),
    path(
        "entities/<str:entity_type>/<int:entity_id>/relationships/",
        views.EntityRelationshipsView.as_view(),
        name="entity-relationships",
    ),
    path(
        "entities/<str:entity_type>/<int:entity_id>/relationships/<str:relationship_name>/",
        views.EntityRelationshipsView.as_view(),
        name="entity-relationship-detail",
    ),
    path("entities/<str:entity_type>/<int:entity_id>/graph/", views.EntityGraphView.as_view(), name="entity-graph"),
    # Workspace API (Wave 2: Cockpit Command Center - Widget System)
    path("workspace/layout/", views.WorkspaceLayoutView.as_view(), name="workspace-layout"),
    path("workspace/stats/quick/", views.WorkspaceStatsView.as_view(), name="workspace-stats"),
    path("workspace/activity/recent/", views.WorkspaceActivityView.as_view(), name="workspace-activity"),
    path("workspace/calls/upcoming/", views.WorkspaceCallsView.as_view(), name="workspace-calls"),
    # Reports API (Cockpit)
    path("reports/summary/", report_views.ReportsSummaryAPIView.as_view(), name="reports-summary"),
    path(
        "reports/trends/purchase-orders/", report_views.PurchaseOrderTrendsAPIView.as_view(), name="reports-po-trends"
    ),
    path("reports/top/suppliers/", report_views.TopSuppliersAPIView.as_view(), name="reports-top-suppliers"),
    # Calendar API (placeholder until Phase 5 integrations are configured)
    path("calendar/events/", calendar_views.CalendarEventsView.as_view(), name="calendar-events"),
    # WorkForms Enhancement API (Phase 1: WF-ENH-2026-Q1)
    # Entity Registry & Schema Endpoints (Phase 1.1-1.3)
    path("entities/", entity_views.entity_registry, name="entity-registry"),
    path("entities/<str:entity_type>/schema/", entity_views.entity_schema, name="entity-schema"),
    path("entities/<str:entity_type>/lookup/", entity_views.entity_lookup, name="entity-lookup"),
    # Form Management Endpoints (Phase 1.5)
    path("tenant-forms/merge/", workform_views.merge_forms, name="tenant-forms-merge"),
    path("tenant-forms/split/", workform_views.split_form, name="tenant-forms-split"),
    # Webhooks (Sentry-GitHub-Copilot Loop)
    path("webhooks/sentry/issue-created/", views.sentry_issue_created_webhook, name="sentry-issue-created"),
    # Signed-grant public portal endpoints (tenant selected via path).
    path(
        "tenants/<uuid:tenant_id>/portal/grants/<uuid:grant_id>/invoice-summary/",
        portal_views.PortalInvoiceSummaryView.as_view(),
        name="portal-invoice-summary",
    ),
    path(
        "tenants/<uuid:tenant_id>/portal/grants/<uuid:grant_id>/snapshot/",
        portal_views.PortalGrantSnapshotView.as_view(),
        name="portal-grant-snapshot",
    ),
    path(
        "tenants/<uuid:tenant_id>/portal/grants/<uuid:grant_id>/documents/",
        portal_views.PortalDocumentMetadataView.as_view(),
        name="portal-document-metadata",
    ),
    path(
        "tenants/<uuid:tenant_id>/portal/grants/<uuid:grant_id>/fulfillment-tracking/",
        portal_views.PortalFulfillmentTrackingView.as_view(),
        name="portal-fulfillment-tracking",
    ),
    path(
        "portal/targets/<str:entity_type>/<str:entity_id>/grants/",
        portal_views.PortalGrantOperatorTargetView.as_view(),
        name="portal-operator-target-grants",
    ),
    path(
        "portal/grants/<uuid:grant_id>/resend/",
        portal_views.PortalGrantResendView.as_view(),
        name="portal-operator-grant-resend",
    ),
    path(
        "portal/grants/<uuid:grant_id>/revoke/",
        portal_views.PortalGrantRevokeView.as_view(),
        name="portal-operator-grant-revoke",
    ),
    path(
        "portal/grants/<uuid:grant_id>/history/",
        portal_views.PortalGrantHistoryView.as_view(),
        name="portal-operator-grant-history",
    ),
    # Include router URLs
    path("", include(router.urls)),
    path("", include(workforms_router.urls)),
]
