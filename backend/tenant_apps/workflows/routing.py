"""WebSocket routing for WorkForms real-time collaboration (Phase 7.3).

Path convention (frontend):
  /ws/workflows/<workflow_id>/collab/?tenant_id=<tenant_uuid>

We require tenant_id to avoid cross-tenant broadcast leakage.
"""

from django.urls import re_path

from .consumers import WorkflowCollaborationConsumer

websocket_urlpatterns = [
    re_path(
        r"^ws/workflows/(?P<workflow_id>[^/]+)/collab/$",
        WorkflowCollaborationConsumer.as_asgi(),
    ),
]
