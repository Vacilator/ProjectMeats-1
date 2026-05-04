"""Context helpers for ETL dry-run execution."""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any, Iterator

from apps.core.utils.audit_context import (
    AuditRequestContext,
    clear_audit_context,
    get_audit_context,
    set_audit_context,
)

from .contracts import GOLDEN_ETL_CONTRACT_VERSION, REQUIRED_SUPPRESSED_SIDE_EFFECTS


@dataclass(frozen=True)
class EtlRuntimePolicy:
    """Execution policy for GA-01.* ETL commands."""

    contract_version: str = GOLDEN_ETL_CONTRACT_VERSION
    mode: str = "dry_run"
    suppressed_side_effects: tuple[str, ...] = REQUIRED_SUPPRESSED_SIDE_EFFECTS
    writes_allowed: bool = False


_etl_runtime_policy: ContextVar[EtlRuntimePolicy | None] = ContextVar(
    "etl_runtime_policy",
    default=None,
)
_etl_execution_state: ContextVar[dict[str, Any] | None] = ContextVar(
    "etl_execution_state",
    default=None,
)


def get_current_etl_policy() -> EtlRuntimePolicy | None:
    """Return the active ETL runtime policy, if one is set."""

    return _etl_runtime_policy.get()


def get_etl_execution_context() -> dict[str, Any] | None:
    """Return the current ETL execution context, if one is active."""

    return _etl_execution_state.get()


def etl_side_effects_suppressed() -> bool:
    """Return whether external side effects are currently suppressed."""

    execution_state = get_etl_execution_context() or {}
    if "suppress_external_side_effects" in execution_state:
        return bool(execution_state.get("suppress_external_side_effects"))

    policy = get_current_etl_policy()
    return bool(policy and policy.suppressed_side_effects)


@contextmanager
def etl_side_effect_guard(*, mode: str = "dry_run") -> Iterator[EtlRuntimePolicy]:
    """Activate the ETL policy so future import code can check suppression rules."""

    policy = EtlRuntimePolicy(mode=mode)
    token = _etl_runtime_policy.set(policy)
    execution_token = _etl_execution_state.set(
        {
            "contract_version": policy.contract_version,
            "mode": policy.mode,
            "suppress_external_side_effects": True,
            "writes_allowed": policy.writes_allowed,
        }
    )
    try:
        yield policy
    finally:
        _etl_execution_state.reset(execution_token)
        _etl_runtime_policy.reset(token)


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
            "tenant_id": str(getattr(tenant, "id", "") or ""),
            "tenant_slug": getattr(tenant, "slug", "") or "",
            "actor_id": str(getattr(actor, "id", "") or ""),
            "actor_email": actor_email or getattr(actor, "email", "") or "",
            "suppress_external_side_effects": suppress_external_side_effects,
        }
    )
    set_audit_context(
        AuditRequestContext(
            tenant=tenant,
            user=actor,
            ip_address=None,
            user_agent="golden-schema-etl",
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
