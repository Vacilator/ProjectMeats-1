from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StudioLandingView, StudioView, WorkflowRunViewSet, AvailableWorkflowsViewSet, BlueprintVersionViewSet

app_name = 'system_config'

# API Router for ViewSets
router = DefaultRouter()
router.register(r'runs', WorkflowRunViewSet, basename='workflow-run')
router.register(r'available-workflows', AvailableWorkflowsViewSet, basename='available-workflows')
router.register(r'studio/versions', BlueprintVersionViewSet, basename='studio-version')

urlpatterns = [
    # Blueprint Studio views (admin interface)
    path('studio/', StudioLandingView.as_view(), name='studio-landing'),
    path('studio/<uuid:blueprint_id>/', StudioView.as_view(), name='studio'),
    
    # API endpoints for workflow execution and studio
    path('api/', include(router.urls)),
]
