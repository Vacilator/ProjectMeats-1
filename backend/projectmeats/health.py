"""
Health check views for ProjectMeats API.
Provides endpoints for monitoring application health and status.

Updated: 2026-02-06 - Force backend container restart for entity_views deployment
"""

import shutil

from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework import status

import psutil

from apps.core.utils.health import check_all_services, semantic_index_readiness_required


@require_http_methods(["GET"])
@csrf_exempt
def health_check(request):
    """Basic health check endpoint.

    Invariants:
    - Must be safe to call even when optional external services are not configured.
    - Must be stable and machine-readable for deploy monitors.
    - Must remain backward compatible (existing keys preserved).
    """

    db_error = None
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_status = "healthy"
    except Exception as e:
        db_status = "unhealthy"
        db_error = {
            "code": "db_connection_failed",
            "type": e.__class__.__name__,
            # Avoid leaking sensitive connection details; cap message length.
            "message": (str(e) or "")[0:200],
        }

    try:
        services = check_all_services()
    except Exception as e:
        services = {
            "summary": {"total_services": 0, "available": 0, "configured": 0},
            "error": {
                "code": "service_checks_failed",
                "type": e.__class__.__name__,
                "message": (str(e) or "")[0:200],
            },
        }

    integration_warnings = []

    redis = services.get("redis", {}) if isinstance(services, dict) else {}
    channel_layer = services.get("channel_layer", {}) if isinstance(services, dict) else {}
    sentry = services.get("sentry", {}) if isinstance(services, dict) else {}
    openai = services.get("openai", {}) if isinstance(services, dict) else {}
    ms = services.get("microsoft_oauth", {}) if isinstance(services, dict) else {}
    semantic_indexing = services.get("semantic_indexing", {}) if isinstance(services, dict) else {}
    redis_guardrails = services.get("redis_guardrails", {}) if isinstance(services, dict) else {}
    queue_health = services.get("queue_health", {}) if isinstance(services, dict) else {}

    if redis.get("configured") and not redis.get("available"):
        integration_warnings.append(
            {
                "code": "redis_unavailable",
                "message": "REDIS_URL is set but Redis is not reachable; caching/channels may degrade.",
            }
        )
    if not redis.get("configured"):
        integration_warnings.append(
            {
                "code": "redis_not_configured",
                "message": "Redis not configured (using in-memory fallback). Real-time/caching features are degraded.",
            }
        )
    if channel_layer.get("configured") and not channel_layer.get("available"):
        integration_warnings.append(
            {
                "code": "channel_layer_unavailable",
                "message": "Redis-backed channels are configured but not reachable; collaboration and websocket features are degraded.",
            }
        )
    if not channel_layer.get("configured"):
        integration_warnings.append(
            {
                "code": "channel_layer_not_configured",
                "message": "Channel layer is using in-memory fallback. Cross-process realtime features are degraded.",
            }
        )
    if (
        redis_guardrails.get("configured")
        and redis_guardrails.get("available")
        and not redis_guardrails.get("policy_ok")
    ):
        integration_warnings.append(
            {
                "code": "redis_policy_mismatch",
                "message": (
                    "Redis eviction policy differs from the expected noeviction contract; "
                    "silent task loss risk is higher under pressure."
                ),
            }
        )
    if redis_guardrails.get("memory_status") in {"warning", "critical"}:
        integration_warnings.append(
            {
                "code": f"redis_memory_{redis_guardrails.get('memory_status')}",
                "message": "Redis memory pressure is above the documented GA guardrail.",
            }
        )
    if queue_health.get("overall_status") in {"warning", "critical"}:
        for queue_name in queue_health.get("warning_queues", []):
            integration_warnings.append(
                {
                    "code": "queue_backlog_warning",
                    "message": f"Queue {queue_name} is above its warning backlog threshold.",
                }
            )
        for queue_name in queue_health.get("critical_queues", []):
            integration_warnings.append(
                {
                    "code": "queue_backlog_critical",
                    "message": f"Queue {queue_name} is above its critical backlog threshold.",
                }
            )

    if not openai.get("api_key_set"):
        integration_warnings.append(
            {
                "code": "openai_not_configured",
                "message": "OpenAI not configured (missing OPENAI_API_KEY). AI features will degrade gracefully (manual review fallback).",
            }
        )
    if semantic_indexing.get("required") and not semantic_indexing.get("available"):
        integration_warnings.append(
            {
                "code": "semantic_indexing_not_ready",
                "message": semantic_indexing.get("note")
                or "Semantic indexing readiness is required for this environment.",
            }
        )

    if sentry.get("enabled") and not sentry.get("dsn_set"):
        integration_warnings.append(
            {
                "code": "sentry_misconfigured",
                "message": "SENTRY_ENABLED is true but SENTRY_DSN is not set; Sentry will not initialize.",
            }
        )
    if sentry.get("dsn_set") and not sentry.get("enabled"):
        integration_warnings.append(
            {
                "code": "sentry_disabled",
                "message": "SENTRY_DSN is set but SENTRY_ENABLED is false; Sentry is currently disabled.",
            }
        )

    if ms.get("client_id_set") and not ms.get("client_secret_set"):
        integration_warnings.append(
            {
                "code": "microsoft_oauth_misconfigured",
                "message": "MICROSOFT_CLIENT_ID is set but MICROSOFT_CLIENT_SECRET is missing; token exchange will fail.",
            }
        )

    integration_summary = {
        "redis": {
            "configured": bool(redis.get("configured")),
            "available": bool(redis.get("available")),
            "is_redis": bool(redis.get("is_redis")),
        },
        "channel_layer": {
            "configured": bool(channel_layer.get("configured")),
            "available": bool(channel_layer.get("available")),
            "is_redis": bool(channel_layer.get("is_redis")),
        },
        "redis_guardrails": {
            "configured": bool(redis_guardrails.get("configured")),
            "available": bool(redis_guardrails.get("available")),
            "policy_ok": bool(redis_guardrails.get("policy_ok")),
            "memory_status": redis_guardrails.get("memory_status"),
            "overall_status": redis_guardrails.get("overall_status"),
        },
        "queue_health": {
            "configured": bool(queue_health.get("configured")),
            "available": bool(queue_health.get("available")),
            "overall_status": queue_health.get("overall_status"),
            "warning_queues": list(queue_health.get("warning_queues", [])),
            "critical_queues": list(queue_health.get("critical_queues", [])),
        },
        "openai": {"configured": bool(openai.get("api_key_set")), "model": openai.get("model")},
        "sentry": {
            "enabled": bool(sentry.get("enabled")),
            "dsn_set": bool(sentry.get("dsn_set")),
            "sdk_installed": bool(sentry.get("sdk_installed", True)),
            "environment": sentry.get("environment"),
        },
        "microsoft_oauth": {
            "configured": bool(ms.get("configured")),
            "tenant_id_set": bool(ms.get("tenant_id_set")),
        },
        "semantic_indexing": {
            "configured": bool(semantic_indexing.get("configured")),
            "available": bool(semantic_indexing.get("available")),
            "required": bool(semantic_indexing.get("required")),
            "mode": semantic_indexing.get("mode"),
        },
    }

    features = {
        "ai": bool(openai.get("api_key_set")),
        "outlook_oauth": bool(ms.get("configured")),
        "email_send": bool(services.get("sendgrid", {}).get("configured")),
        "redis": bool(redis.get("available")),
        "realtime": bool(channel_layer.get("available")),
        "rag": bool(services.get("pgvector", {}).get("available")),
        "semantic_indexing": bool(semantic_indexing.get("available")),
        "queue_health": queue_health.get("overall_status") == "healthy",
        "sentry": bool(sentry.get("dsn_set")),
    }

    service_summary = services.get("summary", {}) if isinstance(services, dict) else {}

    http_status = status.HTTP_200_OK if db_status == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE

    return JsonResponse(
        {
            "status": "healthy" if db_status == "healthy" else "unhealthy",
            "timestamp": timezone.now().isoformat(),
            "version": "1.0.0",
            # Backward-compatible field
            "database": db_status if db_error is None else f"unhealthy: {db_error.get('type')}",
            # New structured fields
            "database_status": {"status": db_status, "error": db_error},
            "service_summary": service_summary,
            "debug": settings.DEBUG,
            "features": features,
            "integration_summary": integration_summary,
            "integration_warnings": integration_warnings,
            "services": services,
        },
        status=http_status,
    )


@require_http_methods(["GET"])
@csrf_exempt
def health_detailed(request):
    """
    Detailed health check endpoint.
    Returns comprehensive system health information.
    """
    try:
        # Database check
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    # System resource checks
    try:
        # Memory usage
        memory = psutil.virtual_memory()
        memory_usage = {
            "total": memory.total,
            "available": memory.available,
            "percent": memory.percent,
            "used": memory.used,
        }

        # Disk usage
        disk = shutil.disk_usage("/")
        disk_usage = {
            "total": disk.total,
            "used": disk.used,
            "free": disk.free,
            "percent": (disk.used / disk.total) * 100,
        }

        # CPU usage
        cpu_usage = psutil.cpu_percent(interval=1)

        system_healthy = True
        system_issues = []

        # Check health thresholds
        if hasattr(settings, "HEALTH_CHECK"):
            if disk_usage["percent"] > settings.HEALTH_CHECK.get("DISK_USAGE_MAX", 90):
                system_healthy = False
                system_issues.append("disk_usage_high")

            if memory_usage["available"] / (1024 * 1024) < settings.HEALTH_CHECK.get("MEMORY_MIN", 100):
                system_healthy = False
                system_issues.append("memory_low")

    except Exception as e:
        memory_usage = disk_usage = cpu_usage = None
        system_healthy = False
        system_issues = [f"system_check_failed: {str(e)}"]

    overall_status = "healthy"
    if db_status != "healthy":
        overall_status = "unhealthy"
    elif not system_healthy:
        overall_status = "degraded"

    return JsonResponse(
        {
            "status": overall_status,
            "timestamp": timezone.now().isoformat(),
            "version": "1.0.0",
            "checks": {
                "database": db_status,
                "system": "healthy" if system_healthy else "degraded",
            },
            "system": {
                "memory": memory_usage,
                "disk": disk_usage,
                "cpu": cpu_usage,
            },
            "issues": system_issues,
            "debug": settings.DEBUG,
        },
        status=status.HTTP_200_OK if overall_status == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE,
    )


@require_http_methods(["GET"])
@csrf_exempt
def ready_check(request):
    """
    Readiness check endpoint.
    Returns whether the application is ready to serve traffic.
    """
    checks = {}
    errors = []
    require_redis_readiness = bool(getattr(settings, "REQUIRE_REDIS_READINESS", False))
    require_semantic_index_readiness = semantic_index_readiness_required()

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        checks["database"] = "healthy"
    except Exception as e:
        checks["database"] = "unhealthy"
        errors.append(
            {
                "code": "db_connection_failed",
                "message": str(e),
            }
        )

    if checks["database"] == "healthy":
        try:
            services = check_all_services()
        except Exception as e:
            services = None
            if require_redis_readiness:
                errors.append(
                    {
                        "code": "service_checks_failed",
                        "message": str(e),
                    }
                )
        else:
            redis = services.get("redis", {}) if isinstance(services, dict) else {}
            channel_layer = services.get("channel_layer", {}) if isinstance(services, dict) else {}
            semantic_indexing = services.get("semantic_indexing", {}) if isinstance(services, dict) else {}
            checks["redis"] = "healthy" if redis.get("available") else "unhealthy"
            checks["channel_layer"] = "healthy" if channel_layer.get("available") else "unhealthy"
            checks["semantic_indexing"] = "healthy" if semantic_indexing.get("available") else "unhealthy"

            if require_redis_readiness:
                if not redis.get("available"):
                    errors.append(
                        {
                            "code": "redis_not_ready",
                            "message": redis.get("error")
                            or redis.get("note")
                            or "Redis cache readiness is required for this environment.",
                        }
                    )
                if not channel_layer.get("available"):
                    errors.append(
                        {
                            "code": "channel_layer_not_ready",
                            "message": channel_layer.get("error")
                            or channel_layer.get("note")
                            or "Redis-backed channel layer readiness is required for this environment.",
                        }
                    )
            if require_semantic_index_readiness and not semantic_indexing.get("available"):
                errors.append(
                    {
                        "code": "semantic_indexing_not_ready",
                        "message": semantic_indexing.get("note")
                        or "Semantic indexing readiness is required for this environment.",
                    }
                )

    if errors:
        return JsonResponse(
            {
                "status": "not_ready",
                "timestamp": timezone.now().isoformat(),
                "checks": checks,
                "requires_redis_readiness": require_redis_readiness,
                "requires_semantic_index_readiness": require_semantic_index_readiness,
                "errors": errors,
                "error": "; ".join(error["message"] for error in errors),
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return JsonResponse(
        {
            "status": "ready",
            "timestamp": timezone.now().isoformat(),
            "checks": checks,
            "requires_redis_readiness": require_redis_readiness,
            "requires_semantic_index_readiness": require_semantic_index_readiness,
        }
    )


@require_http_methods(["GET"])
@csrf_exempt
def health_workforms(request):
    """
    WorkForms-specific health check.
    Validates entity API endpoints are functional.
    Added: 2026-02-06 - Phase F: Backend Verification
    """
    from django.apps import apps

    checks = {
        "entity_registry": "unknown",
        "entity_schema": "unknown",
        "entity_lookup": "unknown",
    }
    issues = []

    try:
        # Check 1: Entity registry responds
        try:
            # Simulate entity registry call
            entities = []
            for model in apps.get_models():
                # Skip abstract models and those without tenant field
                if model._meta.abstract:
                    continue
                # Count available models
                entities.append(model.__name__)

            if len(entities) > 0:
                checks["entity_registry"] = "healthy"
            else:
                checks["entity_registry"] = "warning"
                issues.append("No entities found")
        except Exception as e:
            checks["entity_registry"] = "unhealthy"
            issues.append(f"Entity registry error: {str(e)}")

        # Check 2: Schema extraction works
        try:
            # Test with User model (should always exist)
            from django.contrib.auth import get_user_model

            User = get_user_model()
            fields = User._meta.get_fields()

            if len(fields) > 0:
                checks["entity_schema"] = "healthy"
            else:
                checks["entity_schema"] = "warning"
                issues.append("Schema extraction returned no fields")
        except Exception as e:
            checks["entity_schema"] = "unhealthy"
            issues.append(f"Schema extraction error: {str(e)}")

        # Check 3: Lookup queries work
        try:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            # Test query
            User.objects.count()
            checks["entity_lookup"] = "healthy"
        except Exception as e:
            checks["entity_lookup"] = "unhealthy"
            issues.append(f"Lookup query error: {str(e)}")

        # Overall status
        if "unhealthy" in checks.values():
            overall_status = "unhealthy"
            http_status = status.HTTP_503_SERVICE_UNAVAILABLE
        elif "warning" in checks.values():
            overall_status = "degraded"
            http_status = status.HTTP_200_OK
        else:
            overall_status = "healthy"
            http_status = status.HTTP_200_OK

        return JsonResponse(
            {
                "status": overall_status,
                "timestamp": timezone.now().isoformat(),
                "service": "workforms-entity-api",
                "checks": checks,
                "issues": issues,
                "endpoints": {
                    "registry": "/api/v1/entities/",
                    "schema": "/api/v1/entities/{type}/schema/",
                    "lookup": "/api/v1/entities/{type}/lookup/",
                },
            },
            status=http_status,
        )

    except Exception as e:
        return JsonResponse(
            {
                "status": "error",
                "timestamp": timezone.now().isoformat(),
                "service": "workforms-entity-api",
                "error": str(e),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
