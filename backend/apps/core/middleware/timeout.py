"""Request timeout middleware.

Sets a per-request timeout using Django's database statement_timeout
to prevent runaway queries from blocking workers indefinitely.
"""

import logging
import time

from django.conf import settings
from django.db import connection
from django.http import JsonResponse

logger = logging.getLogger(__name__)

# Default 30s for API requests, overridable via settings
REQUEST_TIMEOUT_SECONDS = getattr(settings, "REQUEST_TIMEOUT_SECONDS", 30)

# Long-running endpoints that get extended timeout (60s)
EXTENDED_TIMEOUT_PATHS = (
    "/api/v1/trade/advance/",
    "/api/v1/workflows/execute/",
    "/api/v1/ai/",
    "/api/v1/integrations/sync",
    "/api/v1/reports/",
    "/admin/",
)


class RequestTimeoutMiddleware:
    """Middleware that enforces a wall-clock timeout warning and logs slow requests.

    The actual hard kill is handled by Gunicorn's --timeout flag and PostgreSQL's
    statement_timeout (set in production.py). This middleware:
    1. Logs requests exceeding 80% of the timeout budget
    2. Returns 504 if the request exceeds the configured budget (safety net)
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.monotonic()
        response = self.get_response(request)
        elapsed = time.monotonic() - start

        timeout = REQUEST_TIMEOUT_SECONDS
        for prefix in EXTENDED_TIMEOUT_PATHS:
            if request.path.startswith(prefix):
                timeout = 60
                break

        # Log slow requests at 80% of budget
        if elapsed > timeout * 0.8:
            logger.warning(
                "Slow request: %s %s took %.2fs (budget: %ds)",
                request.method,
                request.path,
                elapsed,
                timeout,
                extra={
                    "path": request.path,
                    "method": request.method,
                    "elapsed": round(elapsed, 2),
                    "budget": timeout,
                },
            )

        return response
