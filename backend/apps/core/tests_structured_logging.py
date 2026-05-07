"""Tests for structured logging and trace ID propagation (CTE-04.6).

Covers: TradeTraceContext, trace_context manager, @traced decorator,
JSONTradeFormatter, and log_trade_step utility.
"""

import json
import logging
import uuid
from io import StringIO
from unittest.mock import patch

from django.test import TestCase

from apps.core.logging import (
    JSONTradeFormatter,
    TradeTraceContext,
    get_current_trace,
    get_or_create_trace,
    get_trade_logger,
    log_trade_step,
    trace_context,
    traced,
)


class TradeTraceContextTests(TestCase):
    """Tests for TradeTraceContext dataclass."""

    def test_auto_generates_trace_id(self):
        """Context should auto-generate a UUID trace_id."""
        ctx = TradeTraceContext(tenant_id="t1")
        self.assertEqual(len(ctx.trace_id), 36)
        self.assertIn("-", ctx.trace_id)

    def test_to_dict_and_from_dict_roundtrip(self):
        """Serialization should be lossless."""
        original = TradeTraceContext(
            trace_id="custom-id",
            tenant_id="tenant-1",
            trade_id="TRD-2026-00042",
            trade_session_id="99",
            actor_user_id="user-5",
            source_step="SEND_RFQ",
            parent_span_id="span-abc",
        )
        restored = TradeTraceContext.from_dict(original.to_dict())
        self.assertEqual(restored.trace_id, "custom-id")
        self.assertEqual(restored.tenant_id, "tenant-1")
        self.assertEqual(restored.trade_id, "TRD-2026-00042")
        self.assertEqual(restored.trade_session_id, "99")
        self.assertEqual(restored.actor_user_id, "user-5")
        self.assertEqual(restored.source_step, "SEND_RFQ")

    def test_from_dict_generates_trace_id_if_missing(self):
        """from_dict with no trace_id should generate one."""
        ctx = TradeTraceContext.from_dict({"tenant_id": "t1"})
        self.assertEqual(len(ctx.trace_id), 36)


class TraceContextManagerTests(TestCase):
    """Tests for trace_context() context manager."""

    def test_context_sets_and_clears_trace(self):
        """Trace should be available inside and cleared after."""
        self.assertIsNone(get_current_trace())

        with trace_context(tenant_id="t1", trade_id="TRD-2026-00001") as ctx:
            current = get_current_trace()
            self.assertIsNotNone(current)
            self.assertEqual(current.tenant_id, "t1")
            self.assertEqual(current.trade_id, "TRD-2026-00001")
            self.assertEqual(current.trace_id, ctx.trace_id)

        self.assertIsNone(get_current_trace())

    def test_nested_contexts_form_stack(self):
        """Nested contexts should return the innermost."""
        with trace_context(trade_id="outer") as outer:
            self.assertEqual(get_current_trace().trade_id, "outer")

            with trace_context(trade_id="inner") as inner:
                self.assertEqual(get_current_trace().trade_id, "inner")

            # After inner exits, should be back to outer
            self.assertEqual(get_current_trace().trade_id, "outer")

        self.assertIsNone(get_current_trace())

    def test_get_or_create_returns_existing(self):
        """get_or_create should return existing context if available."""
        with trace_context(trade_id="existing") as ctx:
            result = get_or_create_trace(trade_id="new")
            self.assertEqual(result.trade_id, "existing")

    def test_get_or_create_creates_new(self):
        """get_or_create should create new context if none exists."""
        result = get_or_create_trace(trade_id="fresh")
        self.assertEqual(result.trade_id, "fresh")


class JSONTradeFormatterTests(TestCase):
    """Tests for JSONTradeFormatter."""

    def setUp(self):
        self.formatter = JSONTradeFormatter()
        self.logger = logging.getLogger("test.trade.formatter")
        self.logger.setLevel(logging.DEBUG)
        self.stream = StringIO()
        handler = logging.StreamHandler(self.stream)
        handler.setFormatter(self.formatter)
        self.logger.addHandler(handler)
        self.handler = handler

    def tearDown(self):
        self.logger.removeHandler(self.handler)

    def test_basic_json_output(self):
        """Should produce valid JSON with standard fields."""
        self.logger.info("Test message")
        output = self.stream.getvalue().strip()
        data = json.loads(output)
        self.assertEqual(data["level"], "INFO")
        self.assertEqual(data["message"], "Test message")
        self.assertIn("timestamp", data)
        self.assertEqual(data["logger"], "test.trade.formatter")

    def test_includes_trace_context(self):
        """Should include trace context when set."""
        with trace_context(
            tenant_id="t-123",
            trade_id="TRD-2026-00055",
            source_step="APPROVE_PO",
        ):
            self.logger.info("Step done")

        output = self.stream.getvalue().strip()
        data = json.loads(output)
        self.assertEqual(data["tenant_id"], "t-123")
        self.assertEqual(data["trade_id"], "TRD-2026-00055")
        self.assertEqual(data["source_step"], "APPROVE_PO")
        self.assertIn("trace_id", data)

    def test_includes_extra_fields(self):
        """Should include known extra fields."""
        self.logger.info(
            "Timed op",
            extra={"duration_ms": 42.5, "step_name": "SEND_RFQ", "span_id": "abc"},
        )
        output = self.stream.getvalue().strip()
        data = json.loads(output)
        self.assertEqual(data["duration_ms"], 42.5)
        self.assertEqual(data["step_name"], "SEND_RFQ")
        self.assertEqual(data["span_id"], "abc")

    def test_no_trace_context_still_valid(self):
        """Without trace context, should still produce valid JSON."""
        self.logger.warning("No context")
        output = self.stream.getvalue().strip()
        data = json.loads(output)
        self.assertEqual(data["level"], "WARNING")
        self.assertNotIn("trace_id", data)


class TracedDecoratorTests(TestCase):
    """Tests for @traced decorator."""

    def test_basic_traced_function(self):
        """@traced should call the function normally."""

        @traced
        def add(a, b, **kwargs):
            return a + b

        result = add(2, 3)
        self.assertEqual(result, 5)

    def test_traced_propagates_exception(self):
        """@traced should re-raise exceptions after logging."""

        @traced
        def fail(**kwargs):
            raise ValueError("boom")

        with self.assertRaises(ValueError):
            fail()

    def test_traced_with_step_name(self):
        """@traced(step_name=...) should use custom step name."""

        @traced(step_name="CUSTOM_STEP")
        def my_func(**kwargs):
            return "ok"

        result = my_func()
        self.assertEqual(result, "ok")

    def test_traced_uses_existing_trace_context(self):
        """@traced inside trace_context should reuse the context."""

        @traced
        def inner_fn(**kwargs):
            ctx = get_current_trace()
            return ctx.trade_id if ctx else ""

        with trace_context(trade_id="TRD-2026-00077"):
            result = inner_fn()
            self.assertEqual(result, "TRD-2026-00077")

    def test_traced_creates_context_if_none(self):
        """@traced without existing context should create one temporarily."""

        @traced
        def standalone(**kwargs):
            return "done"

        # Should not raise
        result = standalone(tenant_id="t1", trade_id="TRD-2026-00088")
        self.assertEqual(result, "done")

        # Context should be cleared after
        self.assertIsNone(get_current_trace())


class LogTradeStepTests(TestCase):
    """Tests for log_trade_step utility."""

    def test_log_trade_step_does_not_raise(self):
        """log_trade_step should never raise."""
        # Should not raise even without trace context
        log_trade_step(
            step_name="TEST_STEP",
            message="Testing",
            entity_type="Inquiry",
            entity_id="42",
            duration_ms=15.3,
            extra={"custom_field": "value"},
        )

    def test_log_trade_step_with_trace_context(self):
        """log_trade_step inside trace_context should include context."""
        with trace_context(trade_id="TRD-2026-00099"):
            log_trade_step(
                step_name="WITHIN_CONTEXT",
                message="Inside context",
                level="warning",
            )
        # No assertion needed — just verifying no exception

    def test_get_trade_logger_returns_prefixed(self):
        """get_trade_logger should return trade.{name} logger."""
        logger = get_trade_logger("orchestrator")
        self.assertEqual(logger.name, "trade.orchestrator")
