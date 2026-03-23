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
    ChatBotAPIViewSet,
    ChatMessageViewSet,
    ChatSessionViewSet,
    PendingReviewResolveAPIView,
    PendingReviewView,
    SwarmInvokeAPIView,
    ToolsOpenAPIView,
    VectorMemorySearchAPIView,
    VectorMemoryUpsertAPIView,
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
    path('review/pending/', PendingReviewView.as_view(), name='pending-review'),
    path('tools/openapi/', ToolsOpenAPIView.as_view(), name='tools-openapi'),

    # Supporting endpoints
    path('review/<uuid:feedback_id>/resolve/', PendingReviewResolveAPIView.as_view(), name='ai-review-resolve'),
    path('swarm/invoke/', SwarmInvokeAPIView.as_view(), name='ai-swarm-invoke'),
    path('memory/search/', VectorMemorySearchAPIView.as_view(), name='ai-memory-search'),
    path('memory/upsert/', VectorMemoryUpsertAPIView.as_view(), name='ai-memory-upsert'),
]
