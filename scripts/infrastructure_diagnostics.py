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


def test_redis_connectivity() -> Dict[str, Any]:
    """Verify Django cache can round-trip a key."""

    try:
        from django.core.cache import cache

        cache.set('infrastructure:redis:test', 'REDIS_OK', timeout=5)
        value = cache.get('infrastructure:redis:test')

        ok = value == 'REDIS_OK'
        return {
            'service': 'Redis',
            'status': 'CONNECTED' if ok else 'FAILED',
            'message': 'Cache round-trip succeeded' if ok else 'Cache round-trip failed',
            'details': {'test_passed': ok},
        }
    except Exception as exc:  # pragma: no cover
        return {
            'service': 'Redis',
            'status': 'FAILED',
            'message': str(exc),
            'details': {'test_passed': False},
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
        test_openai_connectivity(),
        test_sentry_connectivity(),
    ]

    services = {r.get('service', f'service-{idx}'): r for idx, r in enumerate(results)}
    overall_status = 'READY' if all(r.get('status') == 'CONNECTED' for r in results) else 'INCOMPLETE'

    return {
        'overall_status': overall_status,
        'services': services,
    }
