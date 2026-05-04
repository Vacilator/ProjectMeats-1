"""Context helpers for ETL dry-run execution."""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Iterator

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


def get_current_etl_policy() -> EtlRuntimePolicy | None:
    """Return the active ETL runtime policy, if one is set."""

    return _etl_runtime_policy.get()


@contextmanager
def etl_side_effect_guard(*, mode: str = "dry_run") -> Iterator[EtlRuntimePolicy]:
    """Activate the ETL policy so future import code can check suppression rules."""

    policy = EtlRuntimePolicy(mode=mode)
    token = _etl_runtime_policy.set(policy)
    try:
        yield policy
    finally:
        _etl_runtime_policy.reset(token)
