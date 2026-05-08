"""Hardened ViewSet mixins for production-grade DRF endpoints.

Provides:
- OptimizedQuerysetMixin: Automatic select_related/prefetch_related
  based on declared class attributes.
- StandardPaginationMixin: Consistent pagination defaults.
- StructuredErrorMixin: Normalized error response format.

Usage:
    class MyViewSet(OptimizedQuerysetMixin, TenantViewSet):
        queryset = MyModel.objects.all()
        select_related_fields = ['tenant', 'created_by']
        prefetch_related_fields = ['items', 'tags']
"""

from __future__ import annotations

import logging
import time
from typing import Any, Sequence

from django.db.models import QuerySet
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


class OptimizedQuerysetMixin:
    """Mixin that applies select_related and prefetch_related automatically.

    Declare on the ViewSet:
        select_related_fields: list[str] = ['tenant', 'created_by']
        prefetch_related_fields: list[str] = ['items']

    These are applied in get_queryset() without needing to override it.
    """

    select_related_fields: Sequence[str] = ()
    prefetch_related_fields: Sequence[str] = ()

    def get_queryset(self) -> QuerySet:
        qs = super().get_queryset()  # type: ignore[misc]

        if self.select_related_fields:
            qs = qs.select_related(*self.select_related_fields)

        if self.prefetch_related_fields:
            qs = qs.prefetch_related(*self.prefetch_related_fields)

        return qs


class StructuredErrorMixin:
    """Mixin providing consistent error response helpers.

    Use in ViewSet actions to return normalized error payloads:
        return self.error_response('Thing not found', status=404)
    """

    def error_response(
        self,
        message: str,
        *,
        code: str = 'error',
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: dict[str, Any] | None = None,
    ) -> Response:
        payload: dict[str, Any] = {
            'status': 'error',
            'code': code,
            'message': message,
        }
        if details:
            payload['details'] = details
        return Response(payload, status=status_code)

    def success_response(
        self,
        data: Any = None,
        *,
        message: str = 'ok',
        status_code: int = status.HTTP_200_OK,
    ) -> Response:
        payload: dict[str, Any] = {'status': 'success', 'message': message}
        if data is not None:
            payload['data'] = data
        return Response(payload, status=status_code)


class QueryPerformanceLoggingMixin:
    """Mixin that logs slow queries (>500ms) on list/retrieve actions.

    Set `slow_query_threshold_ms` to customize (default: 500).
    """

    slow_query_threshold_ms: int = 500

    def list(self, request, *args, **kwargs):
        start = time.monotonic()
        response = super().list(request, *args, **kwargs)  # type: ignore[misc]
        elapsed_ms = (time.monotonic() - start) * 1000

        if elapsed_ms > self.slow_query_threshold_ms:
            logger.warning(
                '[SlowQuery] %s.list took %.0fms (threshold=%dms) path=%s tenant=%s',
                self.__class__.__name__,
                elapsed_ms,
                self.slow_query_threshold_ms,
                request.path,
                getattr(getattr(request, 'tenant', None), 'id', 'N/A'),
            )

        return response

    def retrieve(self, request, *args, **kwargs):
        start = time.monotonic()
        response = super().retrieve(request, *args, **kwargs)  # type: ignore[misc]
        elapsed_ms = (time.monotonic() - start) * 1000

        if elapsed_ms > self.slow_query_threshold_ms:
            logger.warning(
                '[SlowQuery] %s.retrieve took %.0fms (threshold=%dms) path=%s',
                self.__class__.__name__,
                elapsed_ms,
                self.slow_query_threshold_ms,
                request.path,
            )

        return response
