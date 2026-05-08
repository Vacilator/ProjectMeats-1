"""
Health check utilities for external service dependencies.

Provides lightweight connection testing for Redis, OpenAI, and Sentry
without triggering actual API calls or consuming quota.
"""

import logging
import os
from urllib.parse import urlparse

from django.conf import settings
from django.core.cache import cache
from django.db import connection

logger = logging.getLogger(__name__)


def redis_readiness_required() -> bool:
    return bool(getattr(settings, "REQUIRE_REDIS_READINESS", False))


def semantic_index_readiness_required() -> bool:
    return bool(getattr(settings, "REQUIRE_SEMANTIC_INDEX_READINESS", False))


def get_redis_backend_url() -> str | None:
    return (
        getattr(settings, "REDIS_BACKEND_URL", None)
        or getattr(settings, "REDIS_URL", None)
        or getattr(settings, "VALKEY_URL", None)
        or os.environ.get("REDIS_URL")
        or os.environ.get("VALKEY_URL")
    )


def get_celery_broker_url() -> str | None:
    return (
        getattr(settings, "CELERY_BROKER_URL", None) or os.environ.get("CELERY_BROKER_URL") or get_redis_backend_url()
    )


def _is_redis_url(url: str | None) -> bool:
    if not url:
        return False
    return urlparse(url).scheme in {"redis", "rediss"}


def _get_redis_client(url: str | None):
    if not _is_redis_url(url):
        return None, "Redis/Valkey URL is not configured for a redis:// or rediss:// backend"

    try:
        from redis import Redis  # type: ignore

        return (
            Redis.from_url(
                url,
                socket_connect_timeout=5,
                socket_timeout=5,
                decode_responses=False,
            ),
            None,
        )
    except Exception as exc:  # pragma: no cover - dependency/import failures are environment-specific
        return None, str(exc)


def check_celery_queue_health() -> dict:
    broker_url = get_celery_broker_url()
    thresholds = getattr(settings, "CELERY_QUEUE_SATURATION_THRESHOLDS", {}) or {}

    if not thresholds:
        return {
            "configured": False,
            "available": False,
            "supported": False,
            "overall_status": "not_configured",
            "note": "No queue saturation thresholds are configured.",
        }

    client, error = _get_redis_client(broker_url)
    if error:
        return {
            "configured": _is_redis_url(broker_url),
            "available": False,
            "supported": _is_redis_url(broker_url),
            "overall_status": "not_configured" if not _is_redis_url(broker_url) else "failed",
            "note": error,
        }

    try:
        queues: dict[str, dict] = {}
        warning_queues: list[str] = []
        critical_queues: list[str] = []

        for queue_name, queue_thresholds in thresholds.items():
            backlog = int(client.llen(queue_name))
            warn_backlog = int(queue_thresholds.get("warn_backlog", 0) or 0)
            critical_backlog = int(queue_thresholds.get("critical_backlog", warn_backlog) or warn_backlog)

            if backlog >= critical_backlog and critical_backlog > 0:
                status = "critical"
                critical_queues.append(queue_name)
            elif backlog >= warn_backlog and warn_backlog > 0:
                status = "warning"
                warning_queues.append(queue_name)
            else:
                status = "healthy"

            queues[queue_name] = {
                "backlog": backlog,
                "status": status,
                "warn_backlog": warn_backlog,
                "critical_backlog": critical_backlog,
                "critical_oldest_seconds": queue_thresholds.get("critical_oldest_seconds"),
            }

        overall_status = "critical" if critical_queues else "warning" if warning_queues else "healthy"
        return {
            "configured": True,
            "available": True,
            "supported": True,
            "overall_status": overall_status,
            "queues": queues,
            "warning_queues": warning_queues,
            "critical_queues": critical_queues,
        }
    except Exception as exc:
        logger.warning(f"Queue-health check failed: {exc}")
        return {
            "configured": True,
            "available": False,
            "supported": True,
            "overall_status": "failed",
            "error": str(exc),
        }


def check_redis_guardrails() -> dict:
    redis_url = get_redis_backend_url() or get_celery_broker_url()
    expected_policy = getattr(settings, "REDIS_EXPECTED_MAXMEMORY_POLICY", "noeviction")
    warn_ratio = float(getattr(settings, "REDIS_MEMORY_WARN_RATIO", 0.70))
    critical_ratio = float(getattr(settings, "REDIS_MEMORY_CRITICAL_RATIO", 0.85))

    client, error = _get_redis_client(redis_url)
    if error:
        return {
            "configured": _is_redis_url(redis_url),
            "available": False,
            "policy_ok": False,
            "expected_policy": expected_policy,
            "overall_status": "not_configured" if not _is_redis_url(redis_url) else "failed",
            "note": error,
        }

    try:
        info = client.info("memory")
        config = client.config_get("maxmemory-policy")
        actual_policy = str(config.get("maxmemory-policy") or "unknown")
        maxmemory = int(info.get("maxmemory") or 0)
        used_memory = int(info.get("used_memory") or 0)
        memory_ratio = (used_memory / maxmemory) if maxmemory > 0 else None

        if memory_ratio is None:
            memory_status = "unbounded"
        elif memory_ratio >= critical_ratio:
            memory_status = "critical"
        elif memory_ratio >= warn_ratio:
            memory_status = "warning"
        else:
            memory_status = "healthy"

        warnings = []
        if actual_policy != expected_policy:
            warnings.append("eviction_policy_mismatch")
        if memory_status in {"warning", "critical"}:
            warnings.append(f"memory_{memory_status}")

        overall_status = "critical" if "memory_critical" in warnings else "warning" if warnings else "healthy"
        return {
            "configured": True,
            "available": True,
            "policy_ok": actual_policy == expected_policy,
            "expected_policy": expected_policy,
            "actual_policy": actual_policy,
            "memory_status": memory_status,
            "memory_used_bytes": used_memory,
            "memory_max_bytes": maxmemory,
            "memory_ratio": memory_ratio,
            "warn_ratio": warn_ratio,
            "critical_ratio": critical_ratio,
            "warnings": warnings,
            "overall_status": overall_status,
        }
    except Exception as exc:
        logger.warning(f"Redis guardrail check failed: {exc}")
        return {
            "configured": True,
            "available": False,
            "policy_ok": False,
            "expected_policy": expected_policy,
            "overall_status": "failed",
            "error": str(exc),
        }


def check_redis() -> dict:
    """Report Redis availability (not just cache availability).

    In development/test we often use LocMemCache (which will pass set/get but is
    *not* Redis). For UAT/Prod readiness we want `available=True` to mean:
    - REDIS_URL is configured
    - cache backend is Redis
    - and Redis is reachable

    Returns additive keys:
    - configured: bool (REDIS_URL + Redis backend)
    - is_redis: bool
    - note: str (when falling back)
    """

    backend = settings.CACHES["default"]["BACKEND"]
    is_redis_backend = "redis" in (backend or "").lower()
    redis_url = get_redis_backend_url()

    if not redis_url or not is_redis_backend:
        return {
            "available": False,
            "configured": False,
            "backend": backend,
            "is_redis": False,
            "required": redis_readiness_required(),
            "note": "Redis not configured; using non-Redis cache backend fallback",
        }

    try:
        cache.set("health_check", "1", timeout=5)
        value = cache.get("health_check")
        cache.delete("health_check")

        ok = value == "1"
        if ok:
            return {
                "available": True,
                "configured": True,
                "backend": backend,
                "is_redis": True,
                "required": redis_readiness_required(),
            }

        return {
            "available": False,
            "configured": True,
            "backend": backend,
            "is_redis": True,
            "required": redis_readiness_required(),
            "error": "Cache write/read mismatch",
        }
    except Exception as e:
        logger.warning(f"Redis health check failed: {e}")
        return {
            "available": False,
            "configured": True,
            "backend": backend,
            "is_redis": True,
            "required": redis_readiness_required(),
            "error": str(e),
        }


def check_channel_layer() -> dict:
    channel_layers = getattr(settings, "CHANNEL_LAYERS", {}) or {}
    default_layer = channel_layers.get("default", {}) or {}
    backend = default_layer.get("BACKEND", "")
    hosts = (default_layer.get("CONFIG") or {}).get("hosts") or []
    is_redis_backend = "redis" in (backend or "").lower()
    redis_status = check_redis()

    if not is_redis_backend or not hosts:
        return {
            "available": False,
            "configured": False,
            "backend": backend,
            "is_redis": False,
            "required": redis_readiness_required(),
            "note": "Channel layer not configured for Redis-backed runtime messaging",
        }

    if redis_status.get("available"):
        return {
            "available": True,
            "configured": True,
            "backend": backend,
            "is_redis": True,
            "required": redis_readiness_required(),
            "hosts_configured": len(hosts),
        }

    return {
        "available": False,
        "configured": True,
        "backend": backend,
        "is_redis": True,
        "required": redis_readiness_required(),
        "hosts_configured": len(hosts),
        "error": redis_status.get("error") or "Underlying Redis connectivity is not ready",
    }


def check_openai() -> dict:
    """
    Check OpenAI API key configuration (without making API calls).

    Returns:
        dict: {
            'configured': bool,
            'api_key_set': bool,
            'model': str,
            'note': str
        }
    """
    import os

    api_key = getattr(settings, "OPENAI_API_KEY", None) or os.environ.get("OPENAI_API_KEY")
    model = getattr(settings, "OPENAI_MODEL", None) or os.environ.get("OPENAI_MODEL") or "not-configured"

    return {
        "configured": api_key is not None,
        "api_key_set": bool(api_key),
        "model": model,
        "note": "API key present but not validated" if api_key else "API key not configured",
    }


def check_sentry() -> dict:
    """
    Check Sentry SDK configuration.

    Returns:
        dict: {
            'configured': bool,
            'enabled': bool,
            'dsn_set': bool,
            'environment': str
        }
    """
    try:
        import sentry_sdk

        # Check if Sentry is initialized
        client = sentry_sdk.Hub.current.client
        is_initialized = client is not None

        dsn_set = bool(getattr(settings, "SENTRY_DSN", None))
        enabled = getattr(settings, "SENTRY_ENABLED", False)
        environment = getattr(settings, "SENTRY_ENVIRONMENT", "unknown")

        return {
            "configured": is_initialized,
            "enabled": enabled,
            "dsn_set": dsn_set,
            "environment": environment,
            "sdk_installed": True,
        }
    except ImportError:
        return {
            "configured": False,
            "enabled": False,
            "dsn_set": False,
            "environment": "unknown",
            "sdk_installed": False,
            "note": "sentry-sdk not installed",
        }


def check_sendgrid() -> dict:
    """Check SendGrid configuration (without sending email)."""

    api_key = getattr(settings, "SENDGRID_API_KEY", "")
    return {
        "configured": bool(api_key),
        "api_key_set": bool(api_key),
    }


def check_pgvector() -> dict:
    """Check whether pgvector extension is available in the connected database."""

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_extension WHERE extname = 'vector' LIMIT 1")
            has_vector = cursor.fetchone() is not None

        return {
            "available": bool(has_vector),
        }
    except Exception as e:
        logger.warning(f"pgvector health check failed: {e}")
        return {
            "available": False,
            "error": str(e),
        }


def check_microsoft_oauth() -> dict:
    """
    Check Microsoft OAuth configuration.

    Returns:
        dict: {
            'configured': bool,
            'client_id_set': bool,
            'client_secret_set': bool,
            'tenant_id_set': bool
        }
    """
    client_id = getattr(settings, "MICROSOFT_CLIENT_ID", None)
    client_secret = getattr(settings, "MICROSOFT_CLIENT_SECRET", None)
    tenant_id = getattr(settings, "MICROSOFT_TENANT_ID", None)

    return {
        "configured": bool(client_id and client_secret),
        "client_id_set": bool(client_id),
        "client_secret_set": bool(client_secret),
        "tenant_id_set": bool(tenant_id),
        "tenant_id": tenant_id if tenant_id else "common",
    }


def check_semantic_indexing() -> dict:
    openai_status = check_openai()
    return {
        "available": bool(openai_status.get("api_key_set")),
        "configured": bool(openai_status.get("api_key_set")),
        "required": semantic_index_readiness_required(),
        "mode": "semantic" if openai_status.get("api_key_set") else "lexical_fallback",
        "note": (
            "Semantic indexing is configured and embeddings can be generated."
            if openai_status.get("api_key_set")
            else "Semantic embeddings are unavailable; lexical chunk fallback remains active."
        ),
    }


def check_all_services() -> dict:
    """
    Run all health checks and return comprehensive status.

    Returns:
        dict: {
            'redis': dict,
            'openai': dict,
            'sentry': dict,
            'microsoft_oauth': dict,
            'summary': {
                'total_services': int,
                'available': int,
                'configured': int
            }
        }
    """
    redis_status = check_redis()
    channel_layer_status = check_channel_layer()
    redis_guardrails_status = check_redis_guardrails()
    queue_health_status = check_celery_queue_health()
    openai_status = check_openai()
    sentry_status = check_sentry()
    ms_oauth_status = check_microsoft_oauth()
    sendgrid_status = check_sendgrid()
    pgvector_status = check_pgvector()
    semantic_indexing_status = check_semantic_indexing()

    # Calculate summary
    services = [
        redis_status,
        channel_layer_status,
        redis_guardrails_status,
        queue_health_status,
        openai_status,
        sentry_status,
        ms_oauth_status,
        sendgrid_status,
        pgvector_status,
        semantic_indexing_status,
    ]
    available_count = sum(1 for s in services if s.get("available", False))
    configured_count = sum(1 for s in services if s.get("configured", False))

    return {
        "redis": redis_status,
        "channel_layer": channel_layer_status,
        "redis_guardrails": redis_guardrails_status,
        "queue_health": queue_health_status,
        "openai": openai_status,
        "sentry": sentry_status,
        "microsoft_oauth": ms_oauth_status,
        "sendgrid": sendgrid_status,
        "pgvector": pgvector_status,
        "semantic_indexing": semantic_indexing_status,
        "summary": {
            "total_services": len(services),
            "available": available_count,
            "configured": configured_count,
            "ready_for_phase_2": openai_status.get("configured", False),  # AI features
            "ready_for_phase_3": redis_status.get("available", False),  # Real-time search
            "ready_for_phase_7_3": channel_layer_status.get("available", False),  # WebSockets/collaboration
            "ready_for_phase_5": ms_oauth_status.get("configured", False),  # Microsoft integration
            "ready_for_phase_6_4": sentry_status.get("configured", False),  # APM monitoring
        },
    }
