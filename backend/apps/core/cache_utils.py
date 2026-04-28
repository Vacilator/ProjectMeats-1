from __future__ import annotations

import hashlib
import time
from functools import wraps
from typing import Callable, Iterable

from django.core.cache import cache
from rest_framework.response import Response


def _cache_version_key(prefix: str, scope: str, scope_id: str | None = None) -> str:
    if scope == 'shared':
        return f'pm:cachever:{prefix}:shared'
    return f'pm:cachever:{prefix}:{scope}:{scope_id or "none"}'


def _get_cache_version(prefix: str, scope: str, scope_id: str | None = None) -> int:
    version_key = _cache_version_key(prefix, scope, scope_id)
    version = cache.get(version_key)
    if isinstance(version, int) and version > 0:
        return version

    cache.set(version_key, 1, None)
    return 1


def _bump_cache_version(prefix: str, scope: str, scope_id: str | None = None) -> int:
    version_key = _cache_version_key(prefix, scope, scope_id)
    try:
        cache.add(version_key, 1, None)
        return cache.incr(version_key)
    except Exception:
        new_version = int(time.time_ns() % 1_000_000_000)
        cache.set(version_key, new_version, None)
        return new_version


def get_tenant_cache_version(prefix: str, tenant_id: str) -> int:
    return _get_cache_version(prefix, 'tenant', tenant_id)


def bump_tenant_cache_version(prefix: str, tenant_id: str) -> int:
    """Bump per-tenant cache version.

    This avoids delete-pattern calls (not portable across cache backends) while still
    letting us invalidate tenant-scoped cached responses.
    """
    return _bump_cache_version(prefix, 'tenant', tenant_id)


def get_shared_cache_version(prefix: str) -> int:
    return _get_cache_version(prefix, 'shared')


def bump_shared_cache_version(prefix: str) -> int:
    return _bump_cache_version(prefix, 'shared')


def stable_query_hash(items: Iterable[tuple[str, str]]) -> str:
    raw = '&'.join(f'{k}={v}' for k, v in items)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]


def build_versioned_cache_key(
    prefix: str,
    *,
    tenant_id: str | None,
    query_items: Iterable[tuple[str, str]] = (),
    extra_items: Iterable[tuple[str, str]] = (),
    include_shared_version: bool = False,
    access_scope: str = 'member',
) -> str:
    normalized_items = [(str(k), str(v)) for k, v in query_items]
    normalized_extra = [(str(k), str(v)) for k, v in extra_items]
    query_hash = stable_query_hash(sorted(normalized_items + normalized_extra))
    tenant_token = str(tenant_id or 'none')
    tenant_version = get_tenant_cache_version(prefix, tenant_token)
    shared_version = get_shared_cache_version(prefix) if include_shared_version else 1
    return (
        f'pm:v1:{prefix}:sv:{shared_version}:tv:{tenant_version}:'
        f'tenant:{tenant_token}:scope:{access_scope}:q:{query_hash}'
    )


def tenant_cache(
    prefix: str,
    *,
    timeout: int = 3600,
    include_shared_version: bool = False,
) -> Callable:
    """Cache GET responses behind tenant/global version keys.

    The cache key varies by tenant, auth scope, request path, query params, and URL kwargs.
    Mutations should invalidate cached reads by bumping the matching tenant/shared version.
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(self, request, *args, **kwargs):
            if str(getattr(request, 'method', 'GET')).upper() != 'GET':
                return func(self, request, *args, **kwargs)

            user = getattr(request, 'user', None)
            if not getattr(user, 'is_authenticated', False):
                return func(self, request, *args, **kwargs)

            tenant = getattr(request, 'tenant', None)
            tenant_id = str(getattr(tenant, 'id', '') or 'none')
            access_scope = (
                'superuser'
                if getattr(user, 'is_superuser', False)
                else 'staff'
                if getattr(user, 'is_staff', False)
                else 'member'
            )

            query_items: list[tuple[str, str]] = []
            for key in sorted(request.query_params.keys()):
                for value in sorted(request.query_params.getlist(key)):
                    query_items.append((key, str(value)))

            extra_items = [
                ('path', str(getattr(request, 'path', ''))),
                ('view', func.__qualname__),
                *[(f'kw:{key}', str(value)) for key, value in sorted(kwargs.items())],
            ]

            cache_key = build_versioned_cache_key(
                prefix,
                tenant_id=tenant_id,
                query_items=query_items,
                extra_items=extra_items,
                include_shared_version=include_shared_version,
                access_scope=access_scope,
            )

            cached = cache.get(cache_key)
            if cached is not None:
                return Response(cached, status=200)

            response = func(self, request, *args, **kwargs)
            if isinstance(response, Response) and response.status_code == 200:
                cache.set(cache_key, response.data, timeout)
            return response

        return wrapper

    return decorator
