"""Circuit breaker pattern for external service calls.

Implements a simple three-state circuit breaker (CLOSED → OPEN → HALF-OPEN)
backed by Django cache (Redis) for cross-process consistency.

Usage:
    from apps.core.utils.circuit_breaker import circuit_breaker, CircuitOpenError

    @circuit_breaker('openai_api', failure_threshold=5, recovery_timeout=60)
    def call_openai(prompt: str) -> str:
        return openai.ChatCompletion.create(...)

    # Or manual usage:
    breaker = CircuitBreaker('graph_api', failure_threshold=3, recovery_timeout=30)
    if breaker.is_available():
        try:
            result = call_graph_api()
            breaker.record_success()
        except Exception as e:
            breaker.record_failure()
            raise
    else:
        # Graceful degradation
        return cached_fallback()
"""

from __future__ import annotations

import logging
import time
from enum import Enum
from functools import wraps
from typing import Any, Callable

from django.core.cache import cache

logger = logging.getLogger(__name__)

_CB_PREFIX = 'pm:cb:'


class CircuitState(str, Enum):
    CLOSED = 'closed'
    OPEN = 'open'
    HALF_OPEN = 'half_open'


class CircuitOpenError(Exception):
    """Raised when a circuit breaker is open and calls are rejected."""

    def __init__(self, service_name: str, recovery_at: float | None = None):
        self.service_name = service_name
        self.recovery_at = recovery_at
        remaining = ''
        if recovery_at:
            secs = max(0, recovery_at - time.time())
            remaining = f' (recovery in {secs:.0f}s)'
        super().__init__(f'Circuit breaker OPEN for {service_name}{remaining}')


class CircuitBreaker:
    """Thread-safe circuit breaker backed by Redis cache.

    States:
    - CLOSED: Normal operation. Failures increment counter.
    - OPEN: Calls rejected immediately. After recovery_timeout, transitions to HALF_OPEN.
    - HALF_OPEN: Next call is a probe. Success → CLOSED. Failure → OPEN again.

    Args:
        service_name: Unique identifier for the protected service.
        failure_threshold: Number of consecutive failures before opening circuit.
        recovery_timeout: Seconds to wait before trying again (OPEN → HALF_OPEN).
        success_threshold: Successes in HALF_OPEN before fully closing (default: 1).
    """

    def __init__(
        self,
        service_name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        success_threshold: int = 1,
    ):
        self.service_name = service_name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold
        self._state_key = f'{_CB_PREFIX}{service_name}:state'
        self._failures_key = f'{_CB_PREFIX}{service_name}:failures'
        self._opened_at_key = f'{_CB_PREFIX}{service_name}:opened_at'
        self._half_open_successes_key = f'{_CB_PREFIX}{service_name}:ho_successes'

    @property
    def state(self) -> CircuitState:
        """Get current circuit state."""
        try:
            raw = cache.get(self._state_key)
            if raw is None:
                return CircuitState.CLOSED
            return CircuitState(raw)
        except Exception:
            return CircuitState.CLOSED

    def is_available(self) -> bool:
        """Check if the circuit allows calls.

        Returns True for CLOSED and HALF_OPEN states.
        For OPEN state, checks if recovery_timeout has elapsed.
        """
        current = self.state
        if current == CircuitState.CLOSED:
            return True
        if current == CircuitState.HALF_OPEN:
            return True
        # OPEN — check if recovery timeout has elapsed
        opened_at = cache.get(self._opened_at_key) or 0
        if time.time() - opened_at >= self.recovery_timeout:
            self._transition(CircuitState.HALF_OPEN)
            return True
        return False

    def record_success(self) -> None:
        """Record a successful call."""
        current = self.state
        if current == CircuitState.HALF_OPEN:
            successes = (cache.get(self._half_open_successes_key) or 0) + 1
            cache.set(self._half_open_successes_key, successes, self.recovery_timeout * 2)
            if successes >= self.success_threshold:
                self._transition(CircuitState.CLOSED)
                logger.info('[CircuitBreaker:%s] CLOSED (recovered)', self.service_name)
        elif current == CircuitState.CLOSED:
            # Reset failure count on success
            cache.set(self._failures_key, 0, self.recovery_timeout * 10)

    def record_failure(self) -> None:
        """Record a failed call."""
        current = self.state
        if current == CircuitState.HALF_OPEN:
            # Probe failed — reopen
            self._transition(CircuitState.OPEN)
            logger.warning('[CircuitBreaker:%s] OPEN (half-open probe failed)', self.service_name)
        elif current == CircuitState.CLOSED:
            failures = (cache.get(self._failures_key) or 0) + 1
            cache.set(self._failures_key, failures, self.recovery_timeout * 10)
            if failures >= self.failure_threshold:
                self._transition(CircuitState.OPEN)
                logger.warning(
                    '[CircuitBreaker:%s] OPEN (threshold %d reached)',
                    self.service_name,
                    self.failure_threshold,
                )

    def reset(self) -> None:
        """Force reset to CLOSED state (admin override)."""
        self._transition(CircuitState.CLOSED)

    def get_status(self) -> dict[str, Any]:
        """Get circuit breaker status for monitoring."""
        return {
            'service': self.service_name,
            'state': self.state.value,
            'failures': cache.get(self._failures_key) or 0,
            'failure_threshold': self.failure_threshold,
            'recovery_timeout': self.recovery_timeout,
            'opened_at': cache.get(self._opened_at_key),
        }

    def _transition(self, new_state: CircuitState) -> None:
        """Transition to a new state."""
        ttl = self.recovery_timeout * 10
        cache.set(self._state_key, new_state.value, ttl)
        if new_state == CircuitState.OPEN:
            cache.set(self._opened_at_key, time.time(), ttl)
            cache.set(self._half_open_successes_key, 0, ttl)
        elif new_state == CircuitState.CLOSED:
            cache.set(self._failures_key, 0, ttl)
            cache.set(self._half_open_successes_key, 0, ttl)


def circuit_breaker(
    service_name: str,
    failure_threshold: int = 5,
    recovery_timeout: int = 60,
    fallback: Callable | None = None,
) -> Callable:
    """Decorator that wraps a function with circuit breaker protection.

    Args:
        service_name: Unique name for the external service being protected.
        failure_threshold: Consecutive failures before opening.
        recovery_timeout: Seconds before recovery attempt.
        fallback: Optional callable to invoke when circuit is open.
                  Receives same args as the decorated function.

    Raises:
        CircuitOpenError: If circuit is open and no fallback provided.
    """
    breaker = CircuitBreaker(service_name, failure_threshold, recovery_timeout)

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not breaker.is_available():
                if fallback:
                    logger.info(
                        '[CircuitBreaker:%s] using fallback for %s',
                        service_name,
                        func.__qualname__,
                    )
                    return fallback(*args, **kwargs)
                raise CircuitOpenError(
                    service_name,
                    recovery_at=(cache.get(breaker._opened_at_key) or 0) + recovery_timeout,
                )

            try:
                result = func(*args, **kwargs)
                breaker.record_success()
                return result
            except Exception as exc:
                breaker.record_failure()
                raise

        # Expose breaker instance for testing/monitoring
        wrapper.circuit_breaker = breaker
        return wrapper

    return decorator
