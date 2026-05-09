"""Hardened Celery task base with RLS, retry policies, and structured logging.

Provides:
- TenantTask: Base task class with automatic RLS setup/cleanup,
  structured logging, exponential backoff, and idempotency hooks.
- tenant_task decorator: Convenience wrapper applying standard policies.

Usage:
    from apps.core.utils.tasks import tenant_task

    @tenant_task(name='my_app.do_work', max_retries=5)
    def do_work(self, tenant_id: str, **kwargs):
        # RLS is already set; self.tenant_id available
        ...
        # RLS is cleaned up automatically on return or exception

All tasks using this base get:
- Automatic `set_current_tenant()` / `reset_current_tenant()` around run()
- Exponential backoff with jitter on retries (base=30s, max=15min)
- Structured JSON-style log messages with task_name, tenant_id, attempt
- Soft time limit (60s default) and hard time limit (90s default)
- Standard return dict format: {'success': bool, 'task': ..., ...}
"""

from __future__ import annotations

import logging
import random
import time
from typing import Any, Callable

from celery import Task, shared_task

logger = logging.getLogger(__name__)


class TenantTask(Task):
    """Base Celery task with tenant RLS lifecycle and resilience defaults.

    Subclass or use via `@tenant_task(...)` decorator.
    """

    # Sensible defaults — overridable per task
    abstract = True
    acks_late = True
    reject_on_worker_lost = True
    max_retries = 5
    soft_time_limit = 60
    time_limit = 90

    # Exponential backoff parameters
    retry_backoff_base = 30  # seconds
    retry_backoff_max = 900  # 15 minutes

    def before_start(self, task_id: str, args: tuple, kwargs: dict) -> None:
        """Set RLS context before task body executes."""
        self._tenant_id = self._extract_tenant_id(args, kwargs)
        self._start_time = time.monotonic()

        if self._tenant_id:
            from apps.tenants.rls import set_current_tenant

            rls = set_current_tenant(str(self._tenant_id))
            if not rls.ok:
                logger.warning(
                    "[Task:%s] RLS set failed tenant=%s error=%s",
                    self.name,
                    self._tenant_id,
                    rls.error,
                )

        attempt = getattr(self.request, "retries", 0) + 1
        logger.info(
            "[Task:%s] started tenant=%s attempt=%d task_id=%s",
            self.name,
            self._tenant_id or "N/A",
            attempt,
            task_id,
        )

    def after_return(self, status: str, retval: Any, task_id: str, args: tuple, kwargs: dict, einfo: Any) -> None:
        """Reset RLS context after task completes (success or failure)."""
        from apps.tenants.rls import reset_current_tenant

        reset_current_tenant()

        elapsed = time.monotonic() - getattr(self, "_start_time", time.monotonic())
        logger.info(
            "[Task:%s] finished status=%s tenant=%s elapsed=%.2fs task_id=%s",
            self.name,
            status,
            getattr(self, "_tenant_id", "N/A"),
            elapsed,
            task_id,
        )

    def on_retry(self, exc: Exception, task_id: str, args: tuple, kwargs: dict, einfo: Any) -> None:
        """Log retry with structured context."""
        attempt = getattr(self.request, "retries", 0)
        logger.warning(
            "[Task:%s] retrying attempt=%d tenant=%s error=%s",
            self.name,
            attempt,
            getattr(self, "_tenant_id", "N/A"),
            str(exc)[:200],
        )

    def on_failure(self, exc: Exception, task_id: str, args: tuple, kwargs: dict, einfo: Any) -> None:
        """Log final failure."""
        logger.error(
            "[Task:%s] FAILED tenant=%s error=%s task_id=%s",
            self.name,
            getattr(self, "_tenant_id", "N/A"),
            str(exc)[:500],
            task_id,
            exc_info=True,
        )

    def retry_with_backoff(self, exc: Exception | None = None, **kwargs) -> None:
        """Retry with exponential backoff + jitter."""
        attempt = getattr(self.request, "retries", 0)
        base_delay = min(
            self.retry_backoff_base * (2**attempt),
            self.retry_backoff_max,
        )
        jitter = random.uniform(0, base_delay * 0.2)
        countdown = base_delay + jitter

        raise self.retry(exc=exc, countdown=countdown, **kwargs)

    @staticmethod
    def _extract_tenant_id(args: tuple, kwargs: dict) -> str | None:
        """Extract tenant_id from task arguments (convention: first positional or kwarg)."""
        if kwargs.get("tenant_id"):
            return str(kwargs["tenant_id"])
        if args:
            return str(args[0])
        return None


def tenant_task(
    _func: Callable | None = None,
    *,
    name: str | None = None,
    max_retries: int = 5,
    soft_time_limit: int = 60,
    time_limit: int = 90,
    **task_kwargs: Any,
) -> Callable:
    """Decorator to create a Celery task with TenantTask base.

    Usage:
        @tenant_task(name='my_app.process_thing', max_retries=3)
        def process_thing(self, tenant_id: str, thing_id: str):
            ...

    The decorated function receives `self` (the Task instance) as first arg
    because `bind=True` is implicit.
    """

    def decorator(func: Callable) -> Callable:
        task_name = name or f"{func.__module__}.{func.__qualname__}"
        return shared_task(
            bind=True,
            base=TenantTask,
            name=task_name,
            max_retries=max_retries,
            soft_time_limit=soft_time_limit,
            time_limit=time_limit,
            **task_kwargs,
        )(func)

    if _func is not None:
        return decorator(_func)
    return decorator
