from django.http import HttpResponse
from django.views.decorators.http import require_http_methods


@require_http_methods(["GET", "HEAD"])
def ai_inbox_websocket_probe(request):
    """HTTP probe for the AI inbox websocket path.

    HTTP requests on the websocket URL let the frontend verify that `/ws/`
    is reaching the backend instead of the SPA fallback, without creating a
    doomed native WebSocket that would spam the browser console.
    """

    response = HttpResponse("WebSocket upgrade required.", status=426, content_type="text/plain")
    response["Upgrade"] = "websocket"
    response["Connection"] = "Upgrade"
    return response
