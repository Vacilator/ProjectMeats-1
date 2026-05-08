"""Tenant-scoped caching utilities for hot-path optimization.

Provides:
- tenant_cache_key(): Generate consistent, tenant-scoped cache keys
- cached_queryset(): Decorator for caching expensive queryset results
- TenantCacheMixin: ViewSet mixin for automatic response caching
- invalidate_tenant_cache(): Signal-friendly cache invalidation

Usage:
    from apps.core.utils.caching import tenant_cache_key, cached_queryset, TenantCacheMixin

    # Manual caching
    key = tenant_cache_key(tenant_id, 'dashboard', 'stats')
    data = cache.get(key)
    if data is None:
        data = expensive_computation()
        cache.set(key, data, timeout=300)

    # ViewSet mixin
    class MyViewSet(TenantCacheMixin, ModelViewSet):
        cache_timeout = 120  # seconds
        cache_actions = ['list']  # Only cache list action

    # Invalidation on signals
    @receiver(post_save, sender=Trade)
    def invalidate_trade_cache(sender, instance, **kwargs):
        invalidate_tenant_cache(instance.tenant_id, 'trades')
"""

from __future__ import annotations

import hashlib
import logging
from functools import wraps
from typing import Any, Callable

from django.core.cache import cache

logger = logging.getLogger(__name__)

_CACHE_PREFIX = 'pm:tc'
_DEFAULT_TIMEOUT = 300  # 5 minutes


def tenant_cache_key(tenant_id: str, *segments: str) -> str:
    """Generate a consistent tenant-scoped cache key.

    Args:
        tenant_id: The tenant UUID.
        *segments: Key path segments (e.g., 'dashboard', 'stats').

    Returns:
        Cache key like 'pm:tc:{tenant_id}:dashboard:stats'
    """
    parts = [_CACHE_PREFIX, str(tenant_id)] + list(segments)
    return ':'.join(parts)


def tenant_cache_key_with_params(tenant_id: str, prefix: str, params: dict[str, Any]) -> str:
    """Generate a cache key that includes query parameters (for list views).

    Uses a hash of sorted params to keep key length manageable.
    """
    param_str = '&'.join(f'{k}={v}' for k, v in sorted(params.items()) if v is not None)
    param_hash = hashlib.md5(param_str.encode()).hexdigest()[:8] if param_str else 'all'
    return tenant_cache_key(tenant_id, prefix, param_hash)


def cached_queryset(
    prefix: str,
    timeout: int = _DEFAULT_TIMEOUT,
    tenant_id_arg: str = 'tenant_id',
) -> Callable:
    """Decorator for caching expensive queryset or service results.

    The decorated function must accept a `tenant_id` parameter (or whatever
    `tenant_id_arg` specifies).

    Usage:
        @cached_queryset('dashboard_stats', timeout=120)
        def get_dashboard_stats(tenant_id: str) -> dict:
            return expensive_aggregation()
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            tid = kwargs.get(tenant_id_arg) or (args[0] if args else None)
            if not tid:
                return func(*args, **kwargs)

            key = tenant_cache_key(str(tid), prefix, func.__qualname__)
            cached = cache.get(key)
            if cached is not None:
                logger.debug('[Cache HIT] %s', key)
                return cached

            logger.debug('[Cache MISS] %s', key)
            result = func(*args, **kwargs)
            try:
                cache.set(key, result, timeout)
            except Exception:
                logger.debug('Cache set failed for %s', key, exc_info=True)
            return result

        wrapper.cache_prefix = prefix
        wrapper.invalidate = lambda tid: invalidate_tenant_cache(tid, prefix)
        return wrapper

    return decorator


def invalidate_tenant_cache(tenant_id: str, *prefixes: str) -> int:
    """Invalidate cached entries for a tenant.

    Note: This uses key-prefix deletion. For Redis backends, this
    leverages pattern deletion. For other backends, it deletes the
    known prefix key.

    Args:
        tenant_id: The tenant to invalidate.
        *prefixes: Specific cache segments to clear. If empty, clears all.

    Returns:
        Number of keys invalidated (approximate).
    """
    count = 0
    try:
        if prefixes:
            for prefix in prefixes:
                key_pattern = tenant_cache_key(str(tenant_id), prefix)
                # Try pattern-based delete (Redis)
                try:
                    from django_redis import get_redis_connection
                    conn = get_redis_connection('default')
                    keys = conn.keys(f'{key_pattern}*')
                    if keys:
                        conn.delete(*keys)
                        count += len(keys)
                except (ImportError, Exception):
                    # Fallback: delete the exact key
                    cache.delete(key_pattern)
                    count += 1
        else:
            # Clear all tenant cache
            key_pattern = tenant_cache_key(str(tenant_id))
            try:
                from django_redis import get_redis_connection
                conn = get_redis_connection('default')
                keys = conn.keys(f'{key_pattern}*')
                if keys:
                    conn.delete(*keys)
                    count = len(keys)
            except (ImportError, Exception):
                pass
    except Exception:
        logger.debug('Cache invalidation failed for tenant %s', tenant_id, exc_info=True)
    return count


class TenantCacheMixin:
    """ViewSet mixin for automatic tenant-scoped response caching.

    Caches serialized list/retrieve responses in Redis with tenant isolation.
    Automatically invalidates on create/update/destroy.

    Class attributes:
        cache_timeout: int = 300 (seconds)
        cache_actions: list[str] = ['list'] (which actions to cache)
        cache_prefix: str = '' (defaults to viewset class name)
    """

    cache_timeout: int = _DEFAULT_TIMEOUT
    cache_actions: list[str] = ['list']
    cache_prefix: str = ''

    def _get_cache_prefix(self) -> str:
        return self.cache_prefix or self.__class__.__name__.lower()

    def _get_tenant_id(self) -> str | None:
        tenant = getattr(self.request, 'tenant', None)
        if tenant:
            return str(tenant.id)
        return None

    def list(self, request, *args, **kwargs):
        if 'list' not in self.cache_actions:
            return super().list(request, *args, **kwargs)

        tenant_id = self._get_tenant_id()
        if not tenant_id:
            return super().list(request, *args, **kwargs)

        # Build cache key from query params
        key = tenant_cache_key_with_params(
            tenant_id,
            self._get_cache_prefix() + ':list',
            dict(request.query_params),
        )

        cached = cache.get(key)
        if cached is not None:
            from rest_framework.response import Response
            return Response(cached)

        response = super().list(request, *args, **kwargs)
        if response.status_code == 200:
            try:
                cache.set(key, response.data, self.cache_timeout)
            except Exception:
                pass
        return response

    def perform_create(self, serializer):
        super().perform_create(serializer)
        self._invalidate_list_cache()

    def perform_update(self, serializer):
        super().perform_update(serializer)
        self._invalidate_list_cache()

    def perform_destroy(self, instance):
        super().perform_destroy(instance)
        self._invalidate_list_cache()

    def _invalidate_list_cache(self) -> None:
        tenant_id = self._get_tenant_id()
        if tenant_id:
            invalidate_tenant_cache(tenant_id, self._get_cache_prefix())
