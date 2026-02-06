from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from . import views
from .jwt_serializers import TenantAwareTokenObtainPairView
from . import entity_views  # Phase 1: WorkForms Enhancement
from apps.system import workform_views  # Phase 1: WorkForms Enhancement

# Create a router for ViewSets
router = DefaultRouter()
router.register(r'preferences', views.UserPreferencesViewSet, basename='user-preferences')

# WorkForms router (Phase 1.4-1.6)
workforms_router = DefaultRouter()
workforms_router.register(r'v1/tenant-forms', workform_views.TenantFormViewSet, basename='tenant-form')
workforms_router.register(r'v1/tenant-workforms', workform_views.TenantWorkFormViewSet, basename='tenant-workform')

urlpatterns = [
    # Legacy auth endpoints (for backward compatibility)
    path("auth/login/", views.login, name="login"),
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
    path("search/recent/", views.RecentItemsView.as_view(), name="recent-items"),
    path("search/operators/", views.SearchOperatorsView.as_view(), name="search-operators"),
    # Entity Graph API (Wave 2: Cockpit Command Center)
    path("entities/types/", views.EntityTypesView.as_view(), name="entity-types"),
    path("entities/<str:entity_type>/<int:entity_id>/", views.EntityDetailView.as_view(), name="entity-detail"),
    path("entities/<str:entity_type>/<int:entity_id>/relationships/", views.EntityRelationshipsView.as_view(), name="entity-relationships"),
    path("entities/<str:entity_type>/<int:entity_id>/relationships/<str:relationship_name>/", views.EntityRelationshipsView.as_view(), name="entity-relationship-detail"),
    path("entities/<str:entity_type>/<int:entity_id>/graph/", views.EntityGraphView.as_view(), name="entity-graph"),
    # Workspace API (Wave 2: Cockpit Command Center - Widget System)
    path("workspace/layout/", views.WorkspaceLayoutView.as_view(), name="workspace-layout"),
    path("workspace/stats/quick/", views.WorkspaceStatsView.as_view(), name="workspace-stats"),
    path("workspace/activity/recent/", views.WorkspaceActivityView.as_view(), name="workspace-activity"),
    path("workspace/calls/upcoming/", views.WorkspaceCallsView.as_view(), name="workspace-calls"),
    
    # WorkForms Enhancement API (Phase 1: WF-ENH-2026-Q1)
    # Entity Registry & Schema Endpoints (Phase 1.1-1.3)
    path("v1/entities/", entity_views.entity_registry, name="entity-registry"),
    path("v1/entities/<str:entity_type>/schema/", entity_views.entity_schema, name="entity-schema"),
    path("v1/entities/<str:entity_type>/lookup/", entity_views.entity_lookup, name="entity-lookup"),
    
    # Form Management Endpoints (Phase 1.5)
    path("v1/tenant-forms/merge/", workform_views.merge_forms, name="tenant-forms-merge"),
    path("v1/tenant-forms/split/", workform_views.split_form, name="tenant-forms-split"),
    
    # Include router URLs
    path("", include(router.urls)),
    path("", include(workforms_router.urls)),
]
