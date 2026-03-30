"""URL configuration for AI Assistant app.

Routing goals:
- Stable, non-overlapping paths
- Clean top-level API endpoints for widget usage
- Keep legacy endpoints (ai-sessions/ai-chat/...) for backward compatibility
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AIDocumentViewSet,
    AIFeedbackViewSet,
    AIAgentChatView,
    AILearningMetricsAPIView,
    ChatBotAPIViewSet,
    ChatMessageViewSet,
    ChatSessionViewSet,
    PendingReviewResolveAPIView,
    PendingReviewView,
    SwarmInvokeAPIView,
    ToolsOpenAPIView,
    RecentErrorsAPIView,
)

app_name = 'ai_assistant'

router = DefaultRouter()

# Clean router resources
router.register(r'feedback', AIFeedbackViewSet, basename='ai-feedback')

# Legacy router resources (keep existing clients working)
router.register(r'ai-sessions', ChatSessionViewSet, basename='ai-session')
router.register(r'ai-messages', ChatMessageViewSet, basename='ai-message')
router.register(r'ai-documents', AIDocumentViewSet, basename='ai-document')
router.register(r'ai-chat', ChatBotAPIViewSet, basename='ai-chatbot')

urlpatterns = [
    path('', include(router.urls)),

    # Clean endpoints
    path('chat/', AIAgentChatView.as_view(), name='ai-chat'),
    path('metrics/', AILearningMetricsAPIView.as_view(), name='ai-metrics'),
    path('review/pending/', PendingReviewView.as_view(), name='pending-review'),
    path('tools/openapi/', ToolsOpenAPIView.as_view(), name='tools-openapi'),
    path('errors/recent/', RecentErrorsAPIView.as_view(), name='ai-recent-errors'),
    # Backward/ops-friendly alias (admin-only): matches runbooks that refer to /diagnostics/recent-errors/
    path('diagnostics/recent-errors/', RecentErrorsAPIView.as_view(), name='ai-diagnostics-recent-errors'),

    # Supporting endpoints
    path('review/<uuid:feedback_id>/resolve/', PendingReviewResolveAPIView.as_view(), name='ai-review-resolve'),
    path('swarm/invoke/', SwarmInvokeAPIView.as_view(), name='ai-swarm-invoke'),

]
