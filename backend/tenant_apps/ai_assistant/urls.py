"""
URL configuration for AI Assistant app.

Provides REST API endpoints for chat functionality, document processing,
and AI-powered business intelligence.
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AIDocumentViewSet,
    ChatBotAPIViewSet,
    ChatMessageViewSet,
    ChatSessionViewSet,
    PendingReviewAPIView,
    PendingReviewResolveAPIView,
    SwarmInvokeAPIView,
    SwarmToolsOpenAPIView,
    VectorMemorySearchAPIView,
    VectorMemoryUpsertAPIView,
)

# Create router for ViewSets
router = DefaultRouter()
router.register(r"ai-sessions", ChatSessionViewSet, basename="ai-session")
router.register(r"ai-messages", ChatMessageViewSet, basename="ai-message")
router.register(r"ai-documents", AIDocumentViewSet, basename="ai-document")
router.register(r"ai-chat", ChatBotAPIViewSet, basename="ai-chatbot")

urlpatterns = [
    path("tools/openapi/", SwarmToolsOpenAPIView.as_view(), name="ai-tools-openapi"),
    path("swarm/invoke/", SwarmInvokeAPIView.as_view(), name="ai-swarm-invoke"),
    path("memory/search/", VectorMemorySearchAPIView.as_view(), name="ai-memory-search"),
    path("memory/upsert/", VectorMemoryUpsertAPIView.as_view(), name="ai-memory-upsert"),
    path("review/pending/", PendingReviewAPIView.as_view(), name="ai-review-pending"),
    path("review/<uuid:feedback_id>/resolve/", PendingReviewResolveAPIView.as_view(), name="ai-review-resolve"),
    path("", include(router.urls)),
]
