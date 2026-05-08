"""DRF-wrapped health endpoints for OpenAPI visibility.

The canonical routes live under /api/v1/health/* and /api/v1/ready/.
Historically these were implemented as plain Django views, which drf-spectacular
won't include in the generated OpenAPI schema.

These APIViews delegate to the existing implementations in projectmeats.health
to preserve behavior and response shape.
"""

from __future__ import annotations

from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from drf_spectacular.utils import OpenApiTypes, extend_schema

from projectmeats.health import health_check, health_detailed, health_workforms, ready_check


class HealthCheckAPIView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(tags=["Health"], responses={200: OpenApiTypes.OBJECT, 503: OpenApiTypes.OBJECT})
    def get(self, request, *args, **kwargs):
        return health_check(request._request)


class HealthDetailedAPIView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(tags=["Health"], responses={200: OpenApiTypes.OBJECT, 503: OpenApiTypes.OBJECT})
    def get(self, request, *args, **kwargs):
        return health_detailed(request._request)


class HealthWorkformsAPIView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(tags=["Health"], responses={200: OpenApiTypes.OBJECT, 503: OpenApiTypes.OBJECT})
    def get(self, request, *args, **kwargs):
        return health_workforms(request._request)


class ReadyCheckAPIView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(tags=["Health"], responses={200: OpenApiTypes.OBJECT, 503: OpenApiTypes.OBJECT})
    def get(self, request, *args, **kwargs):
        return ready_check(request._request)
