from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create a router for ViewSets
router = DefaultRouter()
router.register(r'preferences', views.UserPreferencesViewSet, basename='user-preferences')

urlpatterns = [
    path("auth/login/", views.login, name="login"),
    path("auth/guest-login/", views.guest_login, name="guest-login"),
    path("auth/signup/", views.signup, name="signup"),
    path("auth/logout/", views.logout, name="logout"),
    # Choices endpoint for static dropdowns
    path("choices/", views.ChoicesAPIView.as_view(), name="choices"),
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
    # Include router URLs
    path("", include(router.urls)),
]
