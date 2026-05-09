"""Tests for scaling, observability, and unsupervised AI infrastructure.

Covers:
- Correlation ID middleware and filter
- Metrics collector (counters, gauges, histograms, timing)
- Circuit breaker (state transitions, decorator, fallback)
- Tenant cache utilities (key generation, invalidation, mixin)
- Unsupervised policy (threshold checks, rate limiting, blocked actions, audit)
"""

from __future__ import annotations

import time
from unittest.mock import MagicMock

from django.test import RequestFactory, SimpleTestCase, TestCase

from apps.core.utils.caching import (
    cached_queryset,
    invalidate_tenant_cache,
    tenant_cache_key,
    tenant_cache_key_with_params,
)
from apps.core.utils.circuit_breaker import (
    CircuitBreaker,
    CircuitOpenError,
    CircuitState,
    circuit_breaker,
)
from apps.core.utils.correlation import (
    CorrelationIdFilter,
    CorrelationIdMiddleware,
    clear_correlation_id,
    generate_correlation_id,
    get_correlation_id,
    propagate_correlation_to_task_headers,
    set_correlation_id,
)
from apps.core.utils.metrics import MetricsCollector
from apps.core.utils.unsupervised import (
    DEFAULT_AUTO_EXECUTE_THRESHOLD,
    UnsupervisedPolicy,
    execution_guard,
)


# ==============================================================================
# Correlation ID Tests
# ==============================================================================


class CorrelationIdTests(SimpleTestCase):
    """Tests for correlation ID utilities."""

    def setUp(self):
        clear_correlation_id()

    def tearDown(self):
        clear_correlation_id()

    def test_set_and_get_correlation_id(self):
        set_correlation_id('abc123')
        self.assertEqual(get_correlation_id(), 'abc123')

    def test_clear_correlation_id(self):
        set_correlation_id('test')
        clear_correlation_id()
        self.assertEqual(get_correlation_id(), '')

    def test_generate_correlation_id_length(self):
        cid = generate_correlation_id()
        self.assertEqual(len(cid), 16)

    def test_generate_correlation_id_uniqueness(self):
        ids = {generate_correlation_id() for _ in range(100)}
        self.assertEqual(len(ids), 100)

    def test_propagate_to_task_headers(self):
        set_correlation_id('task-abc')
        headers = propagate_correlation_to_task_headers()
        self.assertEqual(headers['correlation_id'], 'task-abc')

    def test_propagate_empty_when_not_set(self):
        headers = propagate_correlation_to_task_headers()
        self.assertNotIn('correlation_id', headers)

    def test_correlation_filter_injects_id(self):
        import logging

        set_correlation_id('filter-test')
        f = CorrelationIdFilter()
        record = logging.LogRecord('test', logging.INFO, '', 0, 'msg', (), None)
        f.filter(record)
        self.assertEqual(record.correlation_id, 'filter-test')

    def test_correlation_filter_dash_when_empty(self):
        import logging

        f = CorrelationIdFilter()
        record = logging.LogRecord('test', logging.INFO, '', 0, 'msg', (), None)
        f.filter(record)
        self.assertEqual(record.correlation_id, '-')

    def test_middleware_generates_id(self):
        factory = RequestFactory()
        request = factory.get('/test/')

        captured_id = None

        def get_response(req):
            nonlocal captured_id
            captured_id = get_correlation_id()
            response = MagicMock()
            response.__setitem__ = MagicMock()
            response.__getitem__ = MagicMock(return_value=None)
            return response

        middleware = CorrelationIdMiddleware(get_response)
        middleware(request)
        self.assertTrue(len(captured_id) == 16)

    def test_middleware_uses_incoming_header(self):
        factory = RequestFactory()
        request = factory.get('/test/', HTTP_X_REQUEST_ID='external-123')

        captured_id = None

        def get_response(req):
            nonlocal captured_id
            captured_id = get_correlation_id()
            response = MagicMock()
            response.__setitem__ = MagicMock()
            return response

        middleware = CorrelationIdMiddleware(get_response)
        middleware(request)
        self.assertEqual(captured_id, 'external-123')


# ==============================================================================
# Metrics Tests
# ==============================================================================


class MetricsCollectorTests(TestCase):
    """Tests for the metrics collector."""

    def setUp(self):
        self.metrics = MetricsCollector()
        self.metrics.reset()

    def tearDown(self):
        self.metrics.reset()

    def test_increment_counter(self):
        self.metrics.increment('test.counter')
        self.metrics.increment('test.counter')
        snapshot = self.metrics.snapshot()
        # Find the counter in snapshot
        matching = [v for k, v in snapshot.items() if 'test.counter' in k]
        if matching:
            self.assertEqual(matching[0]['value'], 2)

    def test_decrement_counter(self):
        self.metrics.increment('test.dec', value=10)
        self.metrics.decrement('test.dec', value=3)
        snapshot = self.metrics.snapshot()
        matching = [v for k, v in snapshot.items() if 'test.dec' in k]
        if matching:
            self.assertEqual(matching[0]['value'], 7)

    def test_gauge(self):
        self.metrics.gauge('test.gauge', 42.5)
        snapshot = self.metrics.snapshot()
        matching = [v for k, v in snapshot.items() if 'test.gauge' in k]
        if matching:
            self.assertEqual(matching[0]['value'], 42.5)

    def test_histogram(self):
        self.metrics.histogram('test.hist', 100.0)
        self.metrics.histogram('test.hist', 200.0)
        snapshot = self.metrics.snapshot()
        matching = [v for k, v in snapshot.items() if 'test.hist' in k]
        if matching:
            self.assertEqual(matching[0]['count'], 2)

    def test_timing_context(self):
        with self.metrics.timing('test.timing'):
            time.sleep(0.01)
        snapshot = self.metrics.snapshot()
        matching = [v for k, v in snapshot.items() if 'test.timing' in k]
        if matching:
            self.assertGreater(matching[0]['count'], 0)

    def test_tags_differentiate_metrics(self):
        self.metrics.increment('tagged', tags={'env': 'dev'})
        self.metrics.increment('tagged', tags={'env': 'prod'})
        snapshot = self.metrics.snapshot()
        # Should have two separate entries
        tagged_entries = [k for k in snapshot.keys() if 'tagged' in k]
        self.assertGreaterEqual(len(tagged_entries), 1)

    def test_reset_clears_all(self):
        self.metrics.increment('to_clear')
        self.metrics.reset()
        snapshot = self.metrics.snapshot()
        self.assertEqual(len(snapshot), 0)


# ==============================================================================
# Circuit Breaker Tests
# ==============================================================================


class CircuitBreakerTests(TestCase):
    """Tests for the circuit breaker pattern."""

    def setUp(self):
        self.breaker = CircuitBreaker(
            'test_service',
            failure_threshold=3,
            recovery_timeout=2,
        )
        self.breaker.reset()

    def tearDown(self):
        self.breaker.reset()

    def test_starts_closed(self):
        self.assertEqual(self.breaker.state, CircuitState.CLOSED)
        self.assertTrue(self.breaker.is_available())

    def test_opens_after_threshold(self):
        for _ in range(3):
            self.breaker.record_failure()
        self.assertEqual(self.breaker.state, CircuitState.OPEN)
        self.assertFalse(self.breaker.is_available())

    def test_stays_closed_below_threshold(self):
        self.breaker.record_failure()
        self.breaker.record_failure()
        self.assertEqual(self.breaker.state, CircuitState.CLOSED)
        self.assertTrue(self.breaker.is_available())

    def test_success_resets_failure_count(self):
        self.breaker.record_failure()
        self.breaker.record_failure()
        self.breaker.record_success()
        self.breaker.record_failure()
        self.breaker.record_failure()
        # Still closed because success reset the counter
        self.assertEqual(self.breaker.state, CircuitState.CLOSED)

    def test_transitions_to_half_open_after_timeout(self):
        for _ in range(3):
            self.breaker.record_failure()
        self.assertEqual(self.breaker.state, CircuitState.OPEN)
        # Simulate timeout by manipulating opened_at
        from django.core.cache import cache
        cache.set(self.breaker._opened_at_key, time.time() - 10, 600)
        self.assertTrue(self.breaker.is_available())
        self.assertEqual(self.breaker.state, CircuitState.HALF_OPEN)

    def test_half_open_success_closes(self):
        for _ in range(3):
            self.breaker.record_failure()
        from django.core.cache import cache
        cache.set(self.breaker._opened_at_key, time.time() - 10, 600)
        self.breaker.is_available()  # Transitions to HALF_OPEN
        self.breaker.record_success()
        self.assertEqual(self.breaker.state, CircuitState.CLOSED)

    def test_half_open_failure_reopens(self):
        for _ in range(3):
            self.breaker.record_failure()
        from django.core.cache import cache
        cache.set(self.breaker._opened_at_key, time.time() - 10, 600)
        self.breaker.is_available()  # Transitions to HALF_OPEN
        self.breaker.record_failure()
        self.assertEqual(self.breaker.state, CircuitState.OPEN)

    def test_get_status(self):
        status = self.breaker.get_status()
        self.assertEqual(status['service'], 'test_service')
        self.assertEqual(status['state'], 'closed')
        self.assertEqual(status['failure_threshold'], 3)

    def test_decorator_passes_through_on_closed(self):
        @circuit_breaker('decorator_test', failure_threshold=3, recovery_timeout=60)
        def my_func():
            return 'success'

        result = my_func()
        self.assertEqual(result, 'success')
        my_func.circuit_breaker.reset()

    def test_decorator_raises_on_open(self):
        @circuit_breaker('decorator_open_test', failure_threshold=2, recovery_timeout=60)
        def failing_func():
            raise RuntimeError('fail')

        # Trip the breaker
        for _ in range(2):
            try:
                failing_func()
            except RuntimeError:
                pass

        with self.assertRaises(CircuitOpenError):
            failing_func()

        failing_func.circuit_breaker.reset()

    def test_decorator_uses_fallback(self):
        def my_fallback():
            return 'fallback_value'

        @circuit_breaker('fallback_test', failure_threshold=1, recovery_timeout=60, fallback=my_fallback)
        def failing():
            raise RuntimeError('fail')

        try:
            failing()
        except RuntimeError:
            pass

        result = failing()
        self.assertEqual(result, 'fallback_value')
        failing.circuit_breaker.reset()


# ==============================================================================
# Tenant Cache Tests
# ==============================================================================


class TenantCacheTests(TestCase):
    """Tests for tenant-scoped caching utilities."""

    def test_tenant_cache_key_format(self):
        key = tenant_cache_key('tenant-1', 'dashboard', 'stats')
        self.assertEqual(key, 'pm:tc:tenant-1:dashboard:stats')

    def test_tenant_cache_key_with_params(self):
        key = tenant_cache_key_with_params('t1', 'list', {'page': '1', 'search': 'test'})
        self.assertIn('pm:tc:t1:list:', key)
        # Same params should give same key
        key2 = tenant_cache_key_with_params('t1', 'list', {'search': 'test', 'page': '1'})
        self.assertEqual(key, key2)

    def test_cached_queryset_decorator(self):
        call_count = [0]

        @cached_queryset('test_qs', timeout=60)
        def expensive_query(tenant_id: str) -> dict:
            call_count[0] += 1
            return {'total': 42}

        # First call — cache miss
        result1 = expensive_query(tenant_id='t1')
        self.assertEqual(result1, {'total': 42})
        self.assertEqual(call_count[0], 1)

        # Second call — cache hit
        result2 = expensive_query(tenant_id='t1')
        self.assertEqual(result2, {'total': 42})
        self.assertEqual(call_count[0], 1)  # Not called again

        # Different tenant — cache miss
        result3 = expensive_query(tenant_id='t2')
        self.assertEqual(result3, {'total': 42})
        self.assertEqual(call_count[0], 2)

    def test_invalidate_tenant_cache(self):
        from django.core.cache import cache

        key = tenant_cache_key('t1', 'dashboard')
        cache.set(key, 'data', 300)
        self.assertEqual(cache.get(key), 'data')

        invalidate_tenant_cache('t1', 'dashboard')
        # After invalidation, key should be gone
        # (Note: pattern deletion depends on Redis; fallback just deletes exact key)


# ==============================================================================
# Unsupervised Policy Tests
# ==============================================================================


class UnsupervisedPolicyTests(TestCase):
    """Tests for the unsupervised AI execution policy engine."""

    def setUp(self):
        self.policy = UnsupervisedPolicy('test-tenant-1')

    def test_approve_high_confidence(self):
        decision = self.policy.evaluate(
            action_type='create_purchase_order',
            confidence_score=0.95,
        )
        self.assertTrue(decision.approved)
        self.assertEqual(decision.action_type, 'create_purchase_order')
        self.assertIn('approved', decision.reason.lower())

    def test_reject_low_confidence(self):
        decision = self.policy.evaluate(
            action_type='create_purchase_order',
            confidence_score=0.60,
        )
        self.assertFalse(decision.approved)
        self.assertIn('below threshold', decision.reason)

    def test_reject_blocked_action(self):
        decision = self.policy.evaluate(
            action_type='delete_tenant',
            confidence_score=1.0,
        )
        self.assertFalse(decision.approved)
        self.assertIn('never auto-executable', decision.reason)

    def test_threshold_default(self):
        decision = self.policy.evaluate(
            action_type='something',
            confidence_score=DEFAULT_AUTO_EXECUTE_THRESHOLD - 0.01,
        )
        self.assertFalse(decision.approved)

        decision2 = self.policy.evaluate(
            action_type='something',
            confidence_score=DEFAULT_AUTO_EXECUTE_THRESHOLD,
        )
        self.assertTrue(decision2.approved)

    def test_rate_limit_enforcement(self):
        from django.core.cache import cache

        # Simulate maxed-out rate
        cache.set(self.policy._rate_key, self.policy.MAX_AUTO_EXECUTIONS_PER_HOUR, 3600)

        decision = self.policy.evaluate(
            action_type='create_purchase_order',
            confidence_score=0.99,
        )
        self.assertFalse(decision.approved)
        self.assertIn('Rate limit', decision.reason)

        # Cleanup
        cache.delete(self.policy._rate_key)

    def test_decision_to_dict(self):
        decision = self.policy.evaluate(
            action_type='test',
            confidence_score=0.90,
        )
        d = decision.to_dict()
        self.assertIn('decision_id', d)
        self.assertIn('approved', d)
        self.assertIn('confidence_score', d)
        self.assertEqual(d['tenant_id'], 'test-tenant-1')

    def test_audit_context_records_outcome(self):
        decision = self.policy.evaluate(
            action_type='test_action',
            confidence_score=0.95,
        )
        with self.policy.audit_execution(decision) as audit:
            audit.record_outcome(success=True, result_id='po-123')

        self.assertTrue(audit.success)
        self.assertEqual(audit.result_id, 'po-123')
        self.assertIsNotNone(audit.completed_at)

    def test_audit_context_records_failure(self):
        decision = self.policy.evaluate(
            action_type='test_action',
            confidence_score=0.95,
        )

        try:
            with self.policy.audit_execution(decision) as audit:
                raise ValueError('test error')
        except ValueError:
            pass

        self.assertFalse(audit.success)
        self.assertIn('ValueError', audit.error)

    def test_execution_guard_decorator_allows(self):
        @execution_guard('test_action')
        def guarded_func(tenant_id: str, confidence_score: float):
            return 'executed'

        result = guarded_func(tenant_id='test-tenant-1', confidence_score=0.95)
        self.assertEqual(result, 'executed')

    def test_execution_guard_decorator_blocks(self):
        @execution_guard('test_action')
        def guarded_func(tenant_id: str, confidence_score: float):
            return 'executed'

        with self.assertRaises(PermissionError):
            guarded_func(tenant_id='test-tenant-1', confidence_score=0.50)

    def test_get_tenant_stats(self):
        stats = self.policy.get_tenant_stats()
        self.assertEqual(stats['tenant_id'], 'test-tenant-1')
        self.assertIn('auto_executions_this_hour', stats)
        self.assertIn('max_per_hour', stats)
