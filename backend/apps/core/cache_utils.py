from __future__ import annotations

import hashlib
import time
from typing import Iterable

from django.core.cache import cache


def get_tenant_cache_version(prefix: str, tenant_id: str) -> int:
    version_key = f'pm:cachever:{prefix}:tenant:{tenant_id}'
    version = cache.get(version_key)
    if isinstance(version, int) and version > 0:
        return version

    cache.set(version_key, 1, None)
    return 1


def bump_tenant_cache_version(prefix: str, tenant_id: str) -> int:
    """Bump per-tenant cache version.

    This avoids delete-pattern calls (not portable across cache backends) while still
    letting us invalidate tenant-scoped cached responses.
    """

    version_key = f'pm:cachever:{prefix}:tenant:{tenant_id}'
    try:
        cache.add(version_key, 1, None)
        return cache.incr(version_key)
    except Exception:
        # Fall back to a monotonic-ish value that changes on every bump.
        new_version = int(time.time_ns() % 1_000_000_000)
        cache.set(version_key, new_version, None)
        return new_version


def stable_query_hash(items: Iterable[tuple[str, str]]) -> str:
    raw = '&'.join(f'{k}={v}' for k, v in items)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]
