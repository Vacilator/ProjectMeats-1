from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone

FAILURE_THRESHOLD = 3
COOLDOWN_SECONDS = 60
FAILURE_COUNT_TTL_SECONDS = COOLDOWN_SECONDS + 30
# Keep the half-open lock alive long enough for real workflow runs to complete.
HALF_OPEN_TRIAL_TTL_SECONDS = 600


@dataclass(frozen=True)
class WorkformCircuitState:
    state: str
    failure_count: int
    retry_after: int | None = None


def _errors_key(*, tenant_id: str, workform_id: str) -> str:
    return f"circuit_breaker:errors:{tenant_id}:{workform_id}"


def _open_until_key(*, tenant_id: str, workform_id: str) -> str:
    return f"circuit_breaker:open_until:{tenant_id}:{workform_id}"


def _half_open_trial_key(*, tenant_id: str, workform_id: str) -> str:
    return f"circuit_breaker:half_open_trial:{tenant_id}:{workform_id}"


def clear_workform_circuit_breaker(*, tenant_id: str, workform_id: str) -> None:
    cache.delete_many(
        [
            _errors_key(tenant_id=tenant_id, workform_id=workform_id),
            _open_until_key(tenant_id=tenant_id, workform_id=workform_id),
            _half_open_trial_key(tenant_id=tenant_id, workform_id=workform_id),
        ]
    )


def get_workform_circuit_state(*, tenant_id: str, workform_id: str) -> WorkformCircuitState:
    failure_count = int(cache.get(_errors_key(tenant_id=tenant_id, workform_id=workform_id)) or 0)
    open_until_raw = cache.get(_open_until_key(tenant_id=tenant_id, workform_id=workform_id))
    now = timezone.now()

    if open_until_raw:
        try:
            open_until = timezone.datetime.fromisoformat(str(open_until_raw))
            if timezone.is_naive(open_until):
                open_until = timezone.make_aware(open_until, timezone.get_current_timezone())
        except ValueError:
            cache.delete(_open_until_key(tenant_id=tenant_id, workform_id=workform_id))
        else:
            remaining = int(max((open_until - now).total_seconds(), 0))
            if remaining > 0:
                return WorkformCircuitState(
                    state="OPEN",
                    failure_count=failure_count,
                    retry_after=remaining,
                )
            cache.delete(_open_until_key(tenant_id=tenant_id, workform_id=workform_id))

    if failure_count >= FAILURE_THRESHOLD:
        acquired_half_open_trial = cache.add(
            _half_open_trial_key(tenant_id=tenant_id, workform_id=workform_id),
            now.isoformat(),
            HALF_OPEN_TRIAL_TTL_SECONDS,
        )
        if acquired_half_open_trial:
            return WorkformCircuitState(state="HALF_OPEN", failure_count=failure_count, retry_after=0)

        return WorkformCircuitState(
            state="OPEN",
            failure_count=failure_count,
            retry_after=0,
        )

    return WorkformCircuitState(state="CLOSED", failure_count=failure_count, retry_after=None)


def record_workform_execution_failure(*, tenant_id: str, workform_id: str) -> WorkformCircuitState:
    errors_key = _errors_key(tenant_id=tenant_id, workform_id=workform_id)
    failure_count = int(cache.get(errors_key) or 0) + 1
    cache.set(errors_key, failure_count, FAILURE_COUNT_TTL_SECONDS)
    cache.delete(_half_open_trial_key(tenant_id=tenant_id, workform_id=workform_id))

    if failure_count >= FAILURE_THRESHOLD:
        open_until = timezone.now() + timedelta(seconds=COOLDOWN_SECONDS)
        cache.set(
            _open_until_key(tenant_id=tenant_id, workform_id=workform_id),
            open_until.isoformat(),
            COOLDOWN_SECONDS,
        )
        return WorkformCircuitState(
            state="OPEN",
            failure_count=failure_count,
            retry_after=COOLDOWN_SECONDS,
        )

    return WorkformCircuitState(state="CLOSED", failure_count=failure_count, retry_after=None)


def record_workform_execution_success(*, tenant_id: str, workform_id: str) -> None:
    clear_workform_circuit_breaker(tenant_id=tenant_id, workform_id=workform_id)
