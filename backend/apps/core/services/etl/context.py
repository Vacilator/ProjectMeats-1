"""Execution context helpers for side-effect-safe Golden Schema ETL runs."""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any

from apps.core.utils.audit_context import (
    AuditRequestContext,
    clear_audit_context,
    get_audit_context,
    set_audit_context,
)


_etl_execution_state: ContextVar[dict[str, Any] | None] = ContextVar(
    'etl_execution_state',
    default=None,
)


def get_etl_execution_context() -> dict[str, Any] | None:
    """Return the current ETL execution context, if one is active."""

    return _etl_execution_state.get()


def etl_side_effects_suppressed() -> bool:
    """Return whether external side effects are suppressed for this execution."""

    state = get_etl_execution_context() or {}
    return bool(state.get('suppress_external_side_effects'))


@contextmanager
def etl_execution_context(
    *,
    tenant=None,
    actor=None,
    actor_email: str | None = None,
    suppress_external_side_effects: bool = True,
):
    """Scope ETL write-mode execution and audit attribution to the current thread."""

    previous_audit_context = get_audit_context()
    token = _etl_execution_state.set(
        {
            'tenant_id': str(getattr(tenant, 'id', '') or ''),
            'tenant_slug': getattr(tenant, 'slug', '') or '',
            'actor_id': str(getattr(actor, 'id', '') or ''),
            'actor_email': actor_email or getattr(actor, 'email', '') or '',
            'suppress_external_side_effects': suppress_external_side_effects,
        }
    )
    set_audit_context(
        AuditRequestContext(
            tenant=tenant,
            user=actor,
            ip_address=None,
            user_agent='golden-schema-etl',
        )
    )
    try:
        yield get_etl_execution_context()
    finally:
        _etl_execution_state.reset(token)
        if previous_audit_context == AuditRequestContext():
            clear_audit_context()
        else:
            set_audit_context(previous_audit_context)
