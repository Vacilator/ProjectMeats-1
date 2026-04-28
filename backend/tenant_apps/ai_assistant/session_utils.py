"""Helpers for tenant-bound AI chat sessions."""

from typing import Any


def get_tenant_id(tenant: Any) -> str:
    """Return a normalized tenant UUID string or empty string."""
    return str(getattr(tenant, 'id', '') or '').strip()


def get_request_tenant_id(request: Any) -> str:
    """Return the current request tenant ID or empty string."""
    return get_tenant_id(getattr(request, 'tenant', None))


def get_session_tenant_id(session: Any) -> str:
    """Return the tenant ID stamped into session context or empty string."""
    context_data = getattr(session, 'context_data', None)
    if not isinstance(context_data, dict):
        return ''
    return str(context_data.get('tenant_id') or '').strip()


def bind_context_to_tenant(context_data: Any, tenant: Any) -> dict:
    """Return a dict context payload hard-bound to the provided tenant."""
    bound = dict(context_data) if isinstance(context_data, dict) else {}
    tenant_id = get_tenant_id(tenant)
    if tenant_id:
        bound['tenant_id'] = tenant_id
    return bound


def session_matches_tenant(session: Any, tenant: Any) -> bool:
    """Return True when the session is explicitly bound to the given tenant."""
    tenant_id = get_tenant_id(tenant)
    if not tenant_id:
        return False
    return get_session_tenant_id(session) == tenant_id
