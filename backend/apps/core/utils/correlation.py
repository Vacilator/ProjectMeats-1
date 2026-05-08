"""Correlation ID propagation for request tracing.

Provides:
- Thread-local storage for correlation ID
- Middleware to extract/generate X-Request-ID
- Logging filter to inject correlation_id into log records
- Celery signal hook to propagate correlation IDs through tasks

Usage:
    # In middleware (auto-applied):
    Request arrives → correlation_id extracted from X-Request-ID or generated
    → stored in thread-local → injected into all log records → added to response header

    # In tasks:
    from apps.core.utils.correlation import get_correlation_id
    current_id = get_correlation_id()  # Available if propagated via task headers
"""

from __future__ import annotations

import logging
import threading
import uuid
from typing import Any

logger = logging.getLogger(__name__)

# Thread-local storage for correlation context
_correlation_context = threading.local()


def get_correlation_id() -> str:
    """Get current correlation ID, or empty string if not set."""
    return getattr(_correlation_context, "correlation_id", "") or ""


def set_correlation_id(correlation_id: str) -> None:
    """Set correlation ID for the current thread."""
    _correlation_context.correlation_id = correlation_id


def clear_correlation_id() -> None:
    """Clear correlation ID from thread-local."""
    _correlation_context.correlation_id = ""


def generate_correlation_id() -> str:
    """Generate a new correlation ID (short UUID prefix for readability)."""
    return uuid.uuid4().hex[:16]


class CorrelationIdFilter(logging.Filter):
    """Logging filter that injects correlation_id into all log records.

    Add to LOGGING['filters'] and attach to handlers to get correlation_id
    in every log line.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = get_correlation_id() or "-"
        return True


class CorrelationIdMiddleware:
    """Django middleware to propagate correlation IDs through request lifecycle.

    - Reads X-Request-ID header from incoming request (or generates one)
    - Stores in thread-local for use by logging, services, tasks
    - Adds X-Request-ID to response headers for client-side tracing
    """

    HEADER_NAME = "HTTP_X_REQUEST_ID"
    RESPONSE_HEADER = "X-Request-ID"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Extract or generate correlation ID
        correlation_id = request.META.get(self.HEADER_NAME, "").strip()
        if not correlation_id or len(correlation_id) > 64:
            correlation_id = generate_correlation_id()

        set_correlation_id(correlation_id)

        # Attach to request for downstream access
        request.correlation_id = correlation_id

        response = self.get_response(request)

        # Add to response for client-side correlation
        response[self.RESPONSE_HEADER] = correlation_id

        # Cleanup
        clear_correlation_id()

        return response


def propagate_correlation_to_task_headers(headers: dict[str, Any] | None = None) -> dict[str, Any]:
    """Helper to propagate correlation ID into Celery task headers.

    Usage:
        task.apply_async(args=[...], headers=propagate_correlation_to_task_headers())
    """
    headers = headers or {}
    cid = get_correlation_id()
    if cid:
        headers["correlation_id"] = cid
    return headers


def extract_correlation_from_task(task_instance) -> str:
    """Extract correlation ID from a running Celery task's request headers."""
    headers = getattr(task_instance.request, "headers", None) or {}
    return headers.get("correlation_id", "") or ""
