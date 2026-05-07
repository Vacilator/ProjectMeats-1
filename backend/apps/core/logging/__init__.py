"""Structured logging and trace ID propagation for the trading pipeline (CTE-04.6).

Provides:
- TradeTraceContext: Thread-local trace ID propagation across service boundaries
- trade_logger: Pre-configured logger that automatically includes trace context
- @traced decorator: Auto-instruments service functions with entry/exit logging
- JSONTradeFormatter: Structured JSON log output for trade operations

Usage:
    from apps.core.logging import TradeTraceContext, traced, trace_context

    @traced
    def process_inquiry(inquiry_id: str, tenant_id: str) -> dict:
        # trace_id automatically propagated and logged
        ...

    # Or manually:
    with trace_context(tenant_id="...", trade_id="TRD-2026-00001") as ctx:
        do_work()
"""

from __future__ import annotations

import contextlib
import functools
import json
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Generator

# Thread-local storage for trace context
_trace_context = threading.local()


# ---------------------------------------------------------------------------
# Trace Context
# ---------------------------------------------------------------------------


@dataclass
class TradeTraceContext:
    """Thread-local context carrying trace IDs through the trading pipeline.

    Designed to propagate across synchronous service calls. For async (Celery),
    serialize via to_dict() and restore in the consumer.
    """

    trace_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = ""
    trade_id: str = ""  # Human-readable TRD-YYYY-NNNNN
    trade_session_id: str = ""
    actor_user_id: str = ""
    source_step: str = ""  # Current orchestrator step name
    parent_span_id: str = ""

    def to_dict(self) -> dict[str, str]:
        """Serialize for Celery task headers or HTTP headers."""
        return {
            "trace_id": self.trace_id,
            "tenant_id": self.tenant_id,
            "trade_id": self.trade_id,
            "trade_session_id": self.trade_session_id,
            "actor_user_id": self.actor_user_id,
            "source_step": self.source_step,
            "parent_span_id": self.parent_span_id,
        }

    @classmethod
    def from_dict(cls, data: dict[str, str]) -> "TradeTraceContext":
        """Restore from serialized dict (e.g., Celery task headers)."""
        return cls(
            trace_id=data.get("trace_id", str(uuid.uuid4())),
            tenant_id=data.get("tenant_id", ""),
            trade_id=data.get("trade_id", ""),
            trade_session_id=data.get("trade_session_id", ""),
            actor_user_id=data.get("actor_user_id", ""),
            source_step=data.get("source_step", ""),
            parent_span_id=data.get("parent_span_id", ""),
        )


def get_current_trace() -> TradeTraceContext | None:
    """Get the current thread-local trace context, or None if not set."""
    stack = getattr(_trace_context, "stack", [])
    return stack[-1] if stack else None


def get_or_create_trace(**kwargs) -> TradeTraceContext:
    """Get existing trace or create a new one with provided kwargs."""
    existing = get_current_trace()
    if existing:
        return existing
    return TradeTraceContext(**kwargs)


@contextlib.contextmanager
def trace_context(
    *,
    trace_id: str = "",
    tenant_id: str = "",
    trade_id: str = "",
    trade_session_id: str = "",
    actor_user_id: str = "",
    source_step: str = "",
) -> Generator[TradeTraceContext, None, None]:
    """Context manager that pushes a trace context onto the thread-local stack.

    Usage:
        with trace_context(tenant_id="abc", trade_id="TRD-2026-00001") as ctx:
            # ctx.trace_id is available
            do_work()
    """
    ctx = TradeTraceContext(
        trace_id=trace_id or str(uuid.uuid4()),
        tenant_id=tenant_id,
        trade_id=trade_id,
        trade_session_id=trade_session_id,
        actor_user_id=actor_user_id,
        source_step=source_step,
    )

    if not hasattr(_trace_context, "stack"):
        _trace_context.stack = []

    _trace_context.stack.append(ctx)
    try:
        yield ctx
    finally:
        _trace_context.stack.pop()


# ---------------------------------------------------------------------------
# Structured Logger
# ---------------------------------------------------------------------------


class JSONTradeFormatter(logging.Formatter):
    """JSON formatter that includes trade trace context in every log record.

    Output format:
    {
        "timestamp": "2026-01-15T10:30:00.123Z",
        "level": "INFO",
        "logger": "trade.orchestrator",
        "message": "Step completed",
        "trace_id": "abc-123",
        "tenant_id": "...",
        "trade_id": "TRD-2026-00001",
        "step": "SEND_SUPPLIER_RFQ",
        "duration_ms": 42,
        ...extra fields
    }
    """

    def format(self, record: logging.LogRecord) -> str:
        log_data: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(
                record.created, tz=timezone.utc
            ).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Inject trace context if available
        ctx = get_current_trace()
        if ctx:
            log_data["trace_id"] = ctx.trace_id
            log_data["tenant_id"] = ctx.tenant_id
            log_data["trade_id"] = ctx.trade_id
            log_data["trade_session_id"] = ctx.trade_session_id
            log_data["actor_user_id"] = ctx.actor_user_id
            log_data["source_step"] = ctx.source_step

        # Include extra fields from LogRecord
        extra_keys = {
            "duration_ms",
            "entity_type",
            "entity_id",
            "step_name",
            "event_type",
            "error_type",
            "error_message",
            "span_id",
        }
        for key in extra_keys:
            if hasattr(record, key):
                log_data[key] = getattr(record, key)

        # Also include any custom 'extra' dict passed directly
        if hasattr(record, "trade_extra") and isinstance(record.trade_extra, dict):
            log_data.update(record.trade_extra)

        # Exception info
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data, default=str)


# ---------------------------------------------------------------------------
# Trade Logger Factory
# ---------------------------------------------------------------------------


def get_trade_logger(name: str = "trade") -> logging.Logger:
    """Get a logger configured for trade operations.

    The logger name is prefixed with 'trade.' for easy filtering.
    """
    return logging.getLogger(f"trade.{name}")


# ---------------------------------------------------------------------------
# @traced Decorator
# ---------------------------------------------------------------------------


def traced(
    func: Callable | None = None,
    *,
    step_name: str = "",
) -> Callable:
    """Decorator that instruments a service function with trace logging.

    Automatically logs entry/exit, duration, and any exceptions.
    Propagates or creates trace context.

    Usage:
        @traced
        def send_rfq(inquiry_id, tenant_id):
            ...

        @traced(step_name="SEND_SUPPLIER_RFQ")
        def send_rfq(inquiry_id, tenant_id):
            ...
    """

    def decorator(fn: Callable) -> Callable:
        logger = get_trade_logger(fn.__module__.split(".")[-1])
        resolved_step = step_name or fn.__name__

        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            tenant_id = kwargs.get("tenant_id", "")
            trade_id = kwargs.get("trade_id", "")

            existing_ctx = get_current_trace()
            span_id = str(uuid.uuid4())[:8]
            start = time.perf_counter()

            # Log entry
            logger.info(
                f"[ENTER] {resolved_step}",
                extra={
                    "step_name": resolved_step,
                    "span_id": span_id,
                    "entity_type": kwargs.get("entity_type", ""),
                    "entity_id": str(kwargs.get("entity_id", kwargs.get("inquiry_id", ""))),
                },
            )

            try:
                if existing_ctx:
                    result = fn(*args, **kwargs)
                else:
                    with trace_context(
                        tenant_id=tenant_id,
                        trade_id=trade_id,
                        source_step=resolved_step,
                    ):
                        result = fn(*args, **kwargs)

                duration_ms = (time.perf_counter() - start) * 1000

                logger.info(
                    f"[EXIT] {resolved_step} completed",
                    extra={
                        "step_name": resolved_step,
                        "span_id": span_id,
                        "duration_ms": round(duration_ms, 2),
                    },
                )

                return result

            except Exception as exc:
                duration_ms = (time.perf_counter() - start) * 1000

                logger.error(
                    f"[FAIL] {resolved_step} failed: {type(exc).__name__}",
                    extra={
                        "step_name": resolved_step,
                        "span_id": span_id,
                        "duration_ms": round(duration_ms, 2),
                        "error_type": type(exc).__name__,
                        "error_message": str(exc)[:500],
                    },
                    exc_info=True,
                )
                raise

        return wrapper

    if func is not None:
        return decorator(func)
    return decorator


# ---------------------------------------------------------------------------
# Utility: Log a trade step (for non-decorated usage)
# ---------------------------------------------------------------------------


def log_trade_step(
    *,
    step_name: str,
    message: str,
    level: str = "info",
    entity_type: str = "",
    entity_id: str = "",
    duration_ms: float | None = None,
    extra: dict | None = None,
) -> None:
    """Emit a structured log entry for a trade pipeline step.

    Use this when @traced is not appropriate (e.g., within a loop
    or for partial-step logging).
    """
    logger = get_trade_logger("pipeline")
    log_fn = getattr(logger, level, logger.info)

    log_extra: dict[str, Any] = {
        "step_name": step_name,
        "entity_type": entity_type,
        "entity_id": entity_id,
    }
    if duration_ms is not None:
        log_extra["duration_ms"] = round(duration_ms, 2)
    if extra:
        log_extra["trade_extra"] = extra

    log_fn(message, extra=log_extra)
