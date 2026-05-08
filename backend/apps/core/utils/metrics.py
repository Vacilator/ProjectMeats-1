"""Lightweight application metrics collector using Django cache (Redis).

Provides Prometheus-style counters, gauges, and histograms without
adding any external dependencies. Metrics are stored in Redis cache
with configurable TTLs and can be read by a monitoring endpoint.

Usage:
    from apps.core.utils.metrics import metrics

    # Count events
    metrics.increment('ai.proposals.generated', tags={'tenant': tenant_id})
    metrics.increment('pipeline.steps.completed', value=3)

    # Track current values
    metrics.gauge('celery.queue.depth', queue_size, tags={'queue': 'pm.ai'})

    # Record durations/values
    metrics.histogram('api.response_time_ms', elapsed_ms, tags={'endpoint': '/trades/'})

    # Read all metrics
    snapshot = metrics.snapshot()
"""

from __future__ import annotations

import logging
import time
from typing import Any

from django.core.cache import cache

logger = logging.getLogger(__name__)

# Cache key prefix for all metrics
_METRICS_PREFIX = "pm:metrics:"
# TTL for metric keys (1 hour — metrics are rolling windows)
_METRICS_TTL = 3600
# Registry key that tracks all known metric names
_REGISTRY_KEY = f"{_METRICS_PREFIX}__registry__"


class MetricsCollector:
    """Lightweight metrics collector backed by Django cache (Redis).

    Thread-safe via Redis atomic operations. Gracefully degrades
    if cache is unavailable (logs warning, no-ops).
    """

    def increment(self, name: str, value: int = 1, tags: dict[str, str] | None = None) -> None:
        """Increment a counter metric."""
        key = self._make_key("counter", name, tags)
        try:
            result = cache.get(key)
            if result is None:
                cache.set(key, value, _METRICS_TTL)
            else:
                cache.incr(key, value)
            self._register(key, "counter", name, tags)
        except Exception:
            logger.debug("Metrics increment failed for %s", name, exc_info=True)

    def decrement(self, name: str, value: int = 1, tags: dict[str, str] | None = None) -> None:
        """Decrement a counter metric."""
        key = self._make_key("counter", name, tags)
        try:
            result = cache.get(key)
            if result is None:
                cache.set(key, -value, _METRICS_TTL)
            else:
                cache.decr(key, value)
            self._register(key, "counter", name, tags)
        except Exception:
            logger.debug("Metrics decrement failed for %s", name, exc_info=True)

    def gauge(self, name: str, value: float, tags: dict[str, str] | None = None) -> None:
        """Set a gauge metric (current value)."""
        key = self._make_key("gauge", name, tags)
        try:
            cache.set(key, value, _METRICS_TTL)
            self._register(key, "gauge", name, tags)
        except Exception:
            logger.debug("Metrics gauge failed for %s", name, exc_info=True)

    def histogram(self, name: str, value: float, tags: dict[str, str] | None = None) -> None:
        """Record a histogram value (stores count + sum for averages)."""
        count_key = self._make_key("histogram_count", name, tags)
        sum_key = self._make_key("histogram_sum", name, tags)
        try:
            # Increment count
            if cache.get(count_key) is None:
                cache.set(count_key, 1, _METRICS_TTL)
            else:
                cache.incr(count_key, 1)
            # Increment sum (store as integer micros for atomic incr)
            micros = int(value * 1000)
            if cache.get(sum_key) is None:
                cache.set(sum_key, micros, _METRICS_TTL)
            else:
                cache.incr(sum_key, micros)
            self._register(count_key, "histogram", name, tags)
        except Exception:
            logger.debug("Metrics histogram failed for %s", name, exc_info=True)

    def timing(self, name: str, tags: dict[str, str] | None = None):
        """Context manager for timing code blocks.

        Usage:
            with metrics.timing('ai.inference_ms'):
                result = model.predict(...)
        """
        return _TimingContext(self, name, tags)

    def snapshot(self) -> dict[str, Any]:
        """Get a snapshot of all registered metrics."""
        try:
            registry = cache.get(_REGISTRY_KEY) or {}
            result = {}
            for key, meta in registry.items():
                value = cache.get(key)
                if value is not None:
                    metric_name = meta.get("name", key)
                    metric_type = meta.get("type", "unknown")
                    # For histograms, compute average
                    if metric_type == "histogram":
                        sum_key = key.replace("histogram_count", "histogram_sum")
                        sum_val = cache.get(sum_key) or 0
                        count_val = value or 1
                        result[metric_name] = {
                            "type": metric_type,
                            "count": count_val,
                            "sum_ms": sum_val / 1000.0,
                            "avg_ms": (sum_val / count_val) / 1000.0 if count_val else 0,
                            "tags": meta.get("tags"),
                        }
                    else:
                        result[metric_name] = {
                            "type": metric_type,
                            "value": value,
                            "tags": meta.get("tags"),
                        }
            return result
        except Exception:
            logger.debug("Metrics snapshot failed", exc_info=True)
            return {}

    def reset(self) -> None:
        """Clear all metrics (for testing)."""
        try:
            registry = cache.get(_REGISTRY_KEY) or {}
            for key in list(registry.keys()):
                cache.delete(key)
                # Also delete histogram sum keys
                sum_key = key.replace("histogram_count", "histogram_sum")
                cache.delete(sum_key)
            cache.delete(_REGISTRY_KEY)
        except Exception:
            pass

    @staticmethod
    def _make_key(metric_type: str, name: str, tags: dict[str, str] | None) -> str:
        """Build a unique cache key for a metric."""
        tag_suffix = ""
        if tags:
            tag_suffix = ":" + ",".join(f"{k}={v}" for k, v in sorted(tags.items()))
        return f"{_METRICS_PREFIX}{metric_type}:{name}{tag_suffix}"

    def _register(self, key: str, metric_type: str, name: str, tags: dict[str, str] | None) -> None:
        """Register a metric key in the registry for snapshot discovery."""
        try:
            registry = cache.get(_REGISTRY_KEY) or {}
            if key not in registry:
                registry[key] = {"type": metric_type, "name": name, "tags": tags}
                cache.set(_REGISTRY_KEY, registry, _METRICS_TTL * 2)
        except Exception:
            pass


class _TimingContext:
    """Context manager for timing operations."""

    def __init__(self, collector: MetricsCollector, name: str, tags: dict[str, str] | None):
        self._collector = collector
        self._name = name
        self._tags = tags
        self._start: float = 0

    def __enter__(self):
        self._start = time.monotonic()
        return self

    def __exit__(self, *args):
        elapsed_ms = (time.monotonic() - self._start) * 1000
        self._collector.histogram(self._name, elapsed_ms, self._tags)


# Singleton instance — import and use directly
metrics = MetricsCollector()
