"""Views package for AI Assistant.

Re-exports all public ViewSets and APIViews for backward-compatible imports.
``urls.py`` uses ``from .views import ...`` which resolves to this package.
"""
# Chat
from .chat import (
    AIAgentChatView,
    ChatBotAPIViewSet,
    ChatMessageViewSet,
    ChatSessionViewSet,
)

# Control plane
from .control_plane import (
    AIRunViewSet,
    AITaskViewSet,
    _TenantScopedAIControlPlaneViewSet,
)

# Approvals
from .approvals import (
    AIApprovalViewSet,
    BatchResolveAPIView,
    ExternalApprovalQueueViewSet,
    PendingReviewAPIView,
    PendingReviewResolveAPIView,
    PendingReviewView,
)

# Documents
from .documents import (
    AIDocumentViewSet,
    ExtractToSchemaAPIView,
)

# Feedback
from .feedback import (
    AIFeedbackViewSet,
    FeedbackEventsAPIView,
)

# Metrics
from .metrics import (
    AIConfidenceMetricsAPIView,
    AILearningMetricsAPIView,
    AILearningSnapshotAPIView,
)

# Swarm / Tools
from .swarm import (
    SwarmInvokeAPIView,
    SwarmToolsOpenAPIView,
    ToolsOpenAPIView,
)

# Misc
from .misc import (
    CockpitDraftFormViewSet,
    ContextualSuggestionsAPIView,
    RecentErrorsAPIView,
    UserAIPreferencesAPIView,
)

# Shared helpers (re-exported for backward compatibility with consumers.py, etc.)
from ._base import (
    build_pending_review_items,
    can_access_ai_review_queue,
)

__all__ = [
    # Chat
    "ChatSessionViewSet",
    "ChatMessageViewSet",
    "ChatBotAPIViewSet",
    "AIAgentChatView",
    # Control plane
    "_TenantScopedAIControlPlaneViewSet",
    "AIRunViewSet",
    "AITaskViewSet",
    # Approvals
    "AIApprovalViewSet",
    "PendingReviewAPIView",
    "PendingReviewView",
    "PendingReviewResolveAPIView",
    "BatchResolveAPIView",
    "ExternalApprovalQueueViewSet",
    # Documents
    "AIDocumentViewSet",
    "ExtractToSchemaAPIView",
    # Feedback
    "AIFeedbackViewSet",
    "FeedbackEventsAPIView",
    # Metrics
    "AILearningMetricsAPIView",
    "AIConfidenceMetricsAPIView",
    "AILearningSnapshotAPIView",
    # Swarm / Tools
    "SwarmToolsOpenAPIView",
    "SwarmInvokeAPIView",
    "ToolsOpenAPIView",
    # Misc
    "CockpitDraftFormViewSet",
    "ContextualSuggestionsAPIView",
    "UserAIPreferencesAPIView",
    "RecentErrorsAPIView",
    # Shared helpers
    "build_pending_review_items",
    "can_access_ai_review_queue",
]
