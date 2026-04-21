"""Tenant RLS helpers.

ProjectMeats uses PostgreSQL Row-Level Security (RLS) with session variables:
- app.current_tenant_id
- app.current_tenant

TenantMiddleware sets these at request start, but write paths should be resilient
in case middleware couldn't set them (connection issues, early DB access, etc.).

These helpers allow views/services to (re)assert the current tenant on the active
connection right before a write.
"""

from __future__ import annotations

from dataclasses import dataclass

from django.db import connection


@dataclass(frozen=True)
class RlsSetResult:
    ok: bool
    error: str | None = None


def set_current_tenant(tenant_id: str) -> RlsSetResult:
    """Set PostgreSQL session variables used by RLS policies.

    Uses `SET` (not `SET LOCAL`) because Django often runs in autocommit.

    NOTE: Call :func:`reset_current_tenant` when leaving a background task or any
    long-lived worker context to avoid leaking tenant state across pooled DB
    connections.
    """

    try:
        with connection.cursor() as cursor:
            cursor.execute("SET app.current_tenant_id = %s", [str(tenant_id)])
            cursor.execute("SET app.current_tenant = %s", [str(tenant_id)])
        return RlsSetResult(ok=True)
    except Exception as e:  # pragma: no cover
        return RlsSetResult(ok=False, error=f"{type(e).__name__}: {e}")


def reset_current_tenant() -> None:
    """Best-effort RESET of RLS session vars.

    This is defense-in-depth for connection pooling (Celery workers, async
    consumers, management commands). When a DB connection is reused, leftover
    session variables can cause cross-tenant query behavior.

    Uses RESET instead of setting an empty string to avoid invalid UUID casts in
    RLS policies.
    """

    try:
        with connection.cursor() as cursor:
            cursor.execute("RESET app.current_tenant_id")
            cursor.execute("RESET app.current_tenant")
    except Exception:  # pragma: no cover
        # Never break application logic due to cleanup failure.
        return
