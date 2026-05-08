"""
URL routing for Cockpit app.
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ActivityLogViewSet,
    CockpitSlotViewSet,
    EntityAIOverviewView,
    ScheduledCallViewSet,
    TradeExceptionQueueViewSet,
    WorkspaceLayoutView,
    WorkspaceStatsView,
)

router = DefaultRouter()
router.register(r"slots", CockpitSlotViewSet, basename="cockpit-slots")
router.register(r"activity-logs", ActivityLogViewSet, basename="activity-log")
router.register(r"scheduled-calls", ScheduledCallViewSet, basename="scheduled-call")
router.register(r"trade-exceptions", TradeExceptionQueueViewSet, basename="trade-exception")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "entities/<str:entity_type>/<str:entity_id>/ai-overview/",
        EntityAIOverviewView.as_view(),
        name="entity-ai-overview",
    ),
    path("workspace-layout/", WorkspaceLayoutView.as_view(), name="workspace-layout"),
    path("stats/", WorkspaceStatsView.as_view(), name="workspace-stats"),
]
