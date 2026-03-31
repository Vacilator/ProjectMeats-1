"""Thread-local request context for audit/event logging.

Signals and lower-level services often run without direct access to the request.
We keep a minimal, explicit context so audit trails can record:
- tenant
- user
- ip / user-agent

This is best-effort: background tasks may not have context and should record
`actor=None`.
"""

from __future__ import annotations

from dataclasses import dataclass
from threading import local
from typing import Any


_storage = local()


@dataclass(frozen=True)
class AuditRequestContext:
    tenant: Any | None = None
    user: Any | None = None
    ip_address: str | None = None
    user_agent: str | None = None


def set_audit_context(ctx: AuditRequestContext) -> None:
    _storage.ctx = ctx


def get_audit_context() -> AuditRequestContext:
    return getattr(_storage, 'ctx', AuditRequestContext())


def clear_audit_context() -> None:
    if hasattr(_storage, 'ctx'):
        delattr(_storage, 'ctx')
