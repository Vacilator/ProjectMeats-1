"""projectmeats ASGI entrypoint.

Phase 7.3 introduces Django Channels to enable WebSocket-based real-time
collaboration for the WorkForms editor.

Notes:
- HTTP traffic continues to use the standard Django ASGI application.
- WebSocket routes are registered in tenant_apps.workflows.routing.
- Tenant isolation for broadcast is enforced via tenant-scoped group names.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "projectmeats.settings")

django_asgi_app = get_asgi_application()

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

import tenant_apps.workflows.routing

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            AuthMiddlewareStack(URLRouter(tenant_apps.workflows.routing.websocket_urlpatterns))
        ),
    }
)
