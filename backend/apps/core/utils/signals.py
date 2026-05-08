"""Signal safety utilities for production-grade Django signals.

Provides:
- safe_signal_handler: Decorator that wraps signal handlers with:
  - Exception swallowing + structured logging (signals must never crash)
  - Optional deferral to transaction.on_commit for side effects
  - Structured logging with sender, signal name, and instance info

Usage:
    from apps.core.utils.signals import safe_signal_handler

    @safe_signal_handler(defer_to_commit=True)
    def on_order_created(sender, instance, created, **kwargs):
        if created:
            notify_team(instance)
"""

from __future__ import annotations

import functools
import logging
from typing import Any, Callable

from django.db import transaction

logger = logging.getLogger(__name__)


def safe_signal_handler(
    _func: Callable | None = None,
    *,
    defer_to_commit: bool = False,
    log_level: int = logging.DEBUG,
) -> Callable:
    """Decorator for safe, production-grade signal handlers.

    Args:
        defer_to_commit: If True, the handler body runs inside
            transaction.on_commit() — safe for external calls, Celery tasks, etc.
        log_level: Level for the "signal received" log message.
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(sender: Any, **kwargs: Any) -> None:
            handler_name = func.__qualname__
            instance = kwargs.get("instance")
            instance_repr = repr(instance)[:120] if instance else "N/A"

            logger.log(
                log_level,
                "[Signal:%s] received sender=%s instance=%s",
                handler_name,
                getattr(sender, "__name__", str(sender)),
                instance_repr,
            )

            def _execute():
                try:
                    func(sender, **kwargs)
                except Exception as exc:
                    logger.exception(
                        "[Signal:%s] FAILED sender=%s error=%s",
                        handler_name,
                        getattr(sender, "__name__", str(sender)),
                        str(exc)[:300],
                    )

            if defer_to_commit:
                transaction.on_commit(_execute)
            else:
                _execute()

        return wrapper

    if _func is not None:
        return decorator(_func)
    return decorator
