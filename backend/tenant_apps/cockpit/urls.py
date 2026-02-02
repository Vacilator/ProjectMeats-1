"""
URL routing for Cockpit app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CockpitSlotViewSet, ActivityLogViewSet, ScheduledCallViewSet, WorkspaceLayoutView

router = DefaultRouter()
router.register(r'slots', CockpitSlotViewSet, basename='cockpit-slots')
router.register(r'activity-logs', ActivityLogViewSet, basename='activity-log')
router.register(r'scheduled-calls', ScheduledCallViewSet, basename='scheduled-call')

urlpatterns = [
    path('', include(router.urls)),
    path('workspace-layout/', WorkspaceLayoutView.as_view(), name='workspace-layout'),
]

