from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StudioView, WorkflowRunViewSet, AvailableWorkflowsViewSet, BlueprintVersionViewSet

app_name = 'system_config'

# API Router for ViewSets
router = DefaultRouter()
router.register(r'runs', WorkflowRunViewSet, basename='workflow-run')
router.register(r'available-workflows', AvailableWorkflowsViewSet, basename='available-workflows')
router.register(r'studio/versions', BlueprintVersionViewSet, basename='studio-version')

urlpatterns = [
    # Blueprint Studio view (admin interface)
    path('studio/<uuid:blueprint_id>/', StudioView.as_view(), name='studio'),
    
    # API endpoints for workflow execution and studio
    path('api/', include(router.urls)),
]
