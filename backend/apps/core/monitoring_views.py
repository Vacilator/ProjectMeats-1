"""Internal monitoring and metrics API endpoint.

Provides an admin-only /api/v1/internal/metrics/ endpoint that surfaces:
- Application metrics (counters, gauges, histograms)
- Circuit breaker statuses
- Celery queue depths
- AI pipeline health (unsupervised execution stats)
- Cache hit/miss ratios

This endpoint is for internal monitoring dashboards only.
"""

from __future__ import annotations

import logging

from django.conf import settings
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from apps.core.utils.circuit_breaker import CircuitBreaker
from apps.core.utils.metrics import metrics
from apps.core.utils.unsupervised import UnsupervisedPolicy

logger = logging.getLogger(__name__)

# Known circuit breakers to report on
MONITORED_CIRCUITS = [
    "openai_api",
    "graph_api",
    "sendgrid_api",
    "email_ingestion",
]


class SystemMetricsAPIView(APIView):
    """Admin-only endpoint for system metrics and health indicators."""

    permission_classes = [IsAdminUser]

    @extend_schema(
        tags=["Internal"],
        summary="System metrics snapshot",
        description="Returns application metrics, circuit breaker states, and AI pipeline health.",
        responses={200: dict},
    )
    def get(self, request, *args, **kwargs):
        tenant = getattr(request, "tenant", None)

        data = {
            "metrics": self._get_metrics(),
            "circuit_breakers": self._get_circuit_breakers(),
            "ai_pipeline": self._get_ai_pipeline_health(tenant),
            "system": self._get_system_info(),
        }

        return Response(data)

    def _get_metrics(self) -> dict:
        """Get all registered application metrics."""
        try:
            return metrics.snapshot()
        except Exception as e:
            return {"error": str(e)}

    def _get_circuit_breakers(self) -> list[dict]:
        """Get status of all monitored circuit breakers."""
        statuses = []
        for name in MONITORED_CIRCUITS:
            try:
                breaker = CircuitBreaker(name)
                statuses.append(breaker.get_status())
            except Exception:
                statuses.append({"service": name, "state": "unknown"})
        return statuses

    def _get_ai_pipeline_health(self, tenant) -> dict:
        """Get AI pipeline health metrics."""
        if not tenant:
            return {"status": "no_tenant_context"}

        try:
            policy = UnsupervisedPolicy(str(tenant.id))
            stats = policy.get_tenant_stats()
            return {
                **stats,
                "status": "healthy",
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def _get_system_info(self) -> dict:
        """Get basic system information."""
        return {
            "debug": settings.DEBUG,
            "cache_backend": settings.CACHES.get("default", {}).get("BACKEND", "unknown"),
            "celery_broker": bool(getattr(settings, "CELERY_BROKER_URL", None)),
        }


class PipelineHealthAPIView(APIView):
    """Tenant-scoped pipeline health endpoint (for Trader Command Center)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Internal"],
        summary="Pipeline health for current tenant",
        responses={200: dict},
    )
    def get(self, request, *args, **kwargs):
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"status": "no_tenant"}, status=400)

        try:
            policy = UnsupervisedPolicy(str(tenant.id))
            return Response(
                {
                    "tenant_id": str(tenant.id),
                    "unsupervised_stats": policy.get_tenant_stats(),
                    "circuit_breakers": self._tenant_circuits(),
                }
            )
        except Exception:
            logger.exception("Monitoring autonomy stats failed")
            return Response({"status": "error", "error": "Internal server error"}, status=500)

    def _tenant_circuits(self) -> list[dict]:
        """Get relevant circuit breaker states."""
        return [CircuitBreaker(name).get_status() for name in MONITORED_CIRCUITS]
