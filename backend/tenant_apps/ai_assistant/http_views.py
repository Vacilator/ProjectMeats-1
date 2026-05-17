from django.http import JsonResponse
from django.views.decorators.http import require_http_methods


@require_http_methods(["GET", "HEAD"])
def ai_inbox_websocket_probe(request):
    """HTTP probe for the AI inbox websocket path.

    Returns 200 so the frontend pre-flight check can confirm the ASGI stack
    is routing /ws/ correctly, without generating a red console error in
    the browser (which non-2xx responses always produce).
    """
    return JsonResponse({"status": "ws_ready"}, status=200)
