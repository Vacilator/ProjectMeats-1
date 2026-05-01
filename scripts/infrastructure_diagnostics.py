"""Infrastructure diagnostics helpers.

These helpers are used by:
- backend/apps/core/management/commands/check_infrastructure.py
- backend/tenant_apps/workflows/tests/test_infrastructure_diagnostics.py

The functions are intentionally lightweight and safe to run in CI:
- Redis: uses Django cache backend.
- OpenAI: checks env + a small API call (models list) when configured.
- Sentry: checks Hub.client; optionally emits a test message.
"""

from __future__ import annotations

import os
from typing import Any, Dict

from apps.core.utils.health import (
    check_celery_queue_health,
    check_channel_layer,
    check_redis,
    check_redis_guardrails,
)


def test_redis_connectivity() -> Dict[str, Any]:
    """Verify Redis-backed cache is configured and reachable."""

    status = check_redis()
    if status.get('available'):
        return {
            'service': 'Redis',
            'status': 'CONNECTED',
            'message': 'Redis-backed cache is reachable',
            'details': {'test_passed': True, 'backend': status.get('backend')},
        }

    if not status.get('configured'):
        return {
            'service': 'Redis',
            'status': 'NOT_CONFIGURED',
            'message': status.get('note', 'Redis is not configured'),
            'details': {'test_passed': False, 'backend': status.get('backend')},
        }

    return {
        'service': 'Redis',
        'status': 'FAILED',
        'message': status.get('error') or 'Redis-backed cache is not reachable',
        'details': {'test_passed': False, 'backend': status.get('backend')},
    }


def test_channel_layer_connectivity() -> Dict[str, Any]:
    """Verify Redis-backed channel layer is configured and reachable."""

    status = check_channel_layer()
    if status.get('available'):
        return {
            'service': 'Channel Layer',
            'status': 'CONNECTED',
            'message': 'Redis-backed channel layer is reachable',
            'details': {'test_passed': True, 'backend': status.get('backend')},
        }

    if not status.get('configured'):
        return {
            'service': 'Channel Layer',
            'status': 'NOT_CONFIGURED',
            'message': status.get('note', 'Channel layer is not configured for Redis-backed messaging'),
            'details': {'test_passed': False, 'backend': status.get('backend')},
        }

    return {
        'service': 'Channel Layer',
        'status': 'FAILED',
        'message': status.get('error') or 'Redis-backed channel layer is not reachable',
        'details': {'test_passed': False, 'backend': status.get('backend')},
    }


def test_redis_guardrails() -> Dict[str, Any]:
    """Verify Redis eviction-policy and memory-pressure guardrails."""

    status = check_redis_guardrails()
    if not status.get('configured'):
        return {
            'service': 'Redis Guardrails',
            'status': 'NOT_CONFIGURED',
            'message': status.get('note', 'Redis guardrails are not configured'),
            'details': {'test_passed': False},
        }

    if not status.get('available'):
        return {
            'service': 'Redis Guardrails',
            'status': 'FAILED',
            'message': status.get('error') or status.get('note') or 'Redis guardrail inspection failed',
            'details': {'test_passed': False},
        }

    guardrail_status = status.get('overall_status')
    if guardrail_status in {'warning', 'critical'}:
        return {
            'service': 'Redis Guardrails',
            'status': 'WARNING',
            'message': 'Redis guardrails report pressure or policy drift',
            'details': {
                'test_passed': True,
                'expected_policy': status.get('expected_policy'),
                'actual_policy': status.get('actual_policy'),
                'memory_status': status.get('memory_status'),
                'warnings': status.get('warnings'),
            },
        }

    return {
        'service': 'Redis Guardrails',
        'status': 'CONNECTED',
        'message': 'Redis eviction policy and memory guardrails are healthy',
        'details': {
            'test_passed': True,
            'expected_policy': status.get('expected_policy'),
            'actual_policy': status.get('actual_policy'),
            'memory_status': status.get('memory_status'),
        },
    }


def test_queue_health() -> Dict[str, Any]:
    """Verify Redis-backed Celery queue backlog guardrails."""

    status = check_celery_queue_health()
    if not status.get('configured'):
        return {
            'service': 'Queue Health',
            'status': 'NOT_CONFIGURED',
            'message': status.get('note', 'Queue guardrails are not configured'),
            'details': {'test_passed': False},
        }

    if not status.get('available'):
        return {
            'service': 'Queue Health',
            'status': 'FAILED',
            'message': status.get('error') or status.get('note') or 'Queue-health inspection failed',
            'details': {'test_passed': False},
        }

    overall_status = status.get('overall_status')
    if overall_status in {'warning', 'critical'}:
        return {
            'service': 'Queue Health',
            'status': 'WARNING',
            'message': 'One or more queues are above the documented backlog threshold',
            'details': {
                'test_passed': True,
                'warning_queues': status.get('warning_queues', []),
                'critical_queues': status.get('critical_queues', []),
            },
        }

    return {
        'service': 'Queue Health',
        'status': 'CONNECTED',
        'message': 'All documented queue backlogs are within guardrails',
        'details': {
            'test_passed': True,
            'warning_queues': [],
            'critical_queues': [],
        },
    }


def test_openai_connectivity() -> Dict[str, Any]:
    """Verify OpenAI is configured and reachable."""

    api_key = os.environ.get('OPENAI_API_KEY', '').strip()
    if not api_key:
        return {
            'service': 'OpenAI',
            'status': 'NOT_CONFIGURED',
            'message': 'OPENAI_API_KEY is not set',
            'details': {'test_passed': False},
        }

    try:
        # Imported inside the function so environments without the dependency
        # can still import this module.
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=api_key)
        models = client.models.list()
        model_ids = [m.id for m in getattr(models, 'data', []) if getattr(m, 'id', None)]

        return {
            'service': 'OpenAI',
            'status': 'CONNECTED',
            'message': 'OpenAI API reachable',
            'details': {
                'test_passed': True,
                'available_models': model_ids,
            },
        }
    except Exception as exc:  # pragma: no cover
        return {
            'service': 'OpenAI',
            'status': 'FAILED',
            'message': str(exc),
            'details': {'test_passed': False},
        }


def test_sentry_connectivity() -> Dict[str, Any]:
    """Verify Sentry SDK is configured (DSN set) and can emit a test message."""

    try:
        from sentry_sdk import Hub, capture_message  # type: ignore

        client = getattr(Hub, 'current', None)
        client = getattr(client, 'client', None)

        dsn = getattr(client, 'dsn', None)
        if not dsn:
            return {
                'service': 'Sentry',
                'status': 'NOT_CONFIGURED',
                'message': 'Sentry is not configured (no DSN)',
                'details': {'test_passed': False},
            }

        capture_message('Infrastructure diagnostic: Sentry connectivity check')
        return {
            'service': 'Sentry',
            'status': 'CONNECTED',
            'message': 'Sentry SDK configured',
            'details': {'test_passed': True},
        }
    except Exception as exc:  # pragma: no cover
        return {
            'service': 'Sentry',
            'status': 'FAILED',
            'message': str(exc),
            'details': {'test_passed': False},
        }


def run_full_diagnostic() -> Dict[str, Any]:
    """Run all checks and return a normalized summary payload."""

    results = [
        test_redis_connectivity(),
        test_channel_layer_connectivity(),
        test_redis_guardrails(),
        test_queue_health(),
        test_openai_connectivity(),
        test_sentry_connectivity(),
    ]

    services = {r.get('service', f'service-{idx}'): r for idx, r in enumerate(results)}
    overall_status = 'READY' if all(r.get('status') == 'CONNECTED' for r in results) else 'INCOMPLETE'

    return {
        'overall_status': overall_status,
        'services': services,
    }
