"""
Health check utilities for external service dependencies.

Provides lightweight connection testing for Redis, OpenAI, and Sentry
without triggering actual API calls or consuming quota.
"""

from django.conf import settings
from django.core.cache import cache
from django.db import connection
import logging

logger = logging.getLogger(__name__)


def check_redis() -> dict:
    """Report Redis availability (not just cache availability).

    In development/test we often use LocMemCache (which will pass set/get but is
    *not* Redis). For UAT/Prod readiness we want `available=True` to mean:
    - REDIS_URL is configured
    - cache backend is Redis
    - and Redis is reachable

    Returns additive keys:
    - configured: bool (REDIS_URL + Redis backend)
    - is_redis: bool
    - note: str (when falling back)
    """

    import os

    backend = settings.CACHES['default']['BACKEND']
    is_redis_backend = 'redis' in (backend or '').lower()
    redis_url = getattr(settings, 'REDIS_URL', None) or os.environ.get('REDIS_URL')

    if not redis_url or not is_redis_backend:
        return {
            'available': False,
            'configured': False,
            'backend': backend,
            'is_redis': False,
            'note': 'Redis not configured; using non-Redis cache backend fallback',
        }

    try:
        cache.set('health_check', '1', timeout=5)
        value = cache.get('health_check')
        cache.delete('health_check')

        ok = value == '1'
        if ok:
            return {
                'available': True,
                'configured': True,
                'backend': backend,
                'is_redis': True,
            }

        return {
            'available': False,
            'configured': True,
            'backend': backend,
            'is_redis': True,
            'error': 'Cache write/read mismatch',
        }
    except Exception as e:
        logger.warning(f"Redis health check failed: {e}")
        return {
            'available': False,
            'configured': True,
            'backend': backend,
            'is_redis': True,
            'error': str(e),
        }


def check_openai() -> dict:
    """
    Check OpenAI API key configuration (without making API calls).
    
    Returns:
        dict: {
            'configured': bool,
            'api_key_set': bool,
            'model': str,
            'note': str
        }
    """
    import os

    api_key = getattr(settings, 'OPENAI_API_KEY', None) or os.environ.get('OPENAI_API_KEY')
    model = getattr(settings, 'OPENAI_MODEL', None) or os.environ.get('OPENAI_MODEL') or 'not-configured'

    return {
        'configured': api_key is not None,
        'api_key_set': bool(api_key),
        'model': model,
        'note': 'API key present but not validated' if api_key else 'API key not configured'
    }


def check_sentry() -> dict:
    """
    Check Sentry SDK configuration.
    
    Returns:
        dict: {
            'configured': bool,
            'enabled': bool,
            'dsn_set': bool,
            'environment': str
        }
    """
    try:
        import sentry_sdk
        
        # Check if Sentry is initialized
        client = sentry_sdk.Hub.current.client
        is_initialized = client is not None
        
        dsn_set = bool(getattr(settings, 'SENTRY_DSN', None))
        enabled = getattr(settings, 'SENTRY_ENABLED', False)
        environment = getattr(settings, 'SENTRY_ENVIRONMENT', 'unknown')
        
        return {
            'configured': is_initialized,
            'enabled': enabled,
            'dsn_set': dsn_set,
            'environment': environment,
            'sdk_installed': True
        }
    except ImportError:
        return {
            'configured': False,
            'enabled': False,
            'dsn_set': False,
            'environment': 'unknown',
            'sdk_installed': False,
            'note': 'sentry-sdk not installed'
        }


def check_sendgrid() -> dict:
    """Check SendGrid configuration (without sending email)."""

    api_key = getattr(settings, 'SENDGRID_API_KEY', '')
    return {
        'configured': bool(api_key),
        'api_key_set': bool(api_key),
    }


def check_pgvector() -> dict:
    """Check whether pgvector extension is available in the connected database."""

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_extension WHERE extname = 'vector' LIMIT 1")
            has_vector = cursor.fetchone() is not None

        return {
            'available': bool(has_vector),
        }
    except Exception as e:
        logger.warning(f"pgvector health check failed: {e}")
        return {
            'available': False,
            'error': str(e),
        }


def check_microsoft_oauth() -> dict:
    """
    Check Microsoft OAuth configuration.
    
    Returns:
        dict: {
            'configured': bool,
            'client_id_set': bool,
            'client_secret_set': bool,
            'tenant_id_set': bool
        }
    """
    client_id = getattr(settings, 'MICROSOFT_CLIENT_ID', None)
    client_secret = getattr(settings, 'MICROSOFT_CLIENT_SECRET', None)
    tenant_id = getattr(settings, 'MICROSOFT_TENANT_ID', None)
    
    return {
        'configured': bool(client_id and client_secret),
        'client_id_set': bool(client_id),
        'client_secret_set': bool(client_secret),
        'tenant_id_set': bool(tenant_id),
        'tenant_id': tenant_id if tenant_id else 'common'
    }


def check_all_services() -> dict:
    """
    Run all health checks and return comprehensive status.
    
    Returns:
        dict: {
            'redis': dict,
            'openai': dict,
            'sentry': dict,
            'microsoft_oauth': dict,
            'summary': {
                'total_services': int,
                'available': int,
                'configured': int
            }
        }
    """
    redis_status = check_redis()
    openai_status = check_openai()
    sentry_status = check_sentry()
    ms_oauth_status = check_microsoft_oauth()
    sendgrid_status = check_sendgrid()
    pgvector_status = check_pgvector()

    # Calculate summary
    services = [redis_status, openai_status, sentry_status, ms_oauth_status, sendgrid_status, pgvector_status]
    available_count = sum(1 for s in services if s.get('available', False))
    configured_count = sum(1 for s in services if s.get('configured', False))

    return {
        'redis': redis_status,
        'openai': openai_status,
        'sentry': sentry_status,
        'microsoft_oauth': ms_oauth_status,
        'sendgrid': sendgrid_status,
        'pgvector': pgvector_status,
        'summary': {
            'total_services': len(services),
            'available': available_count,
            'configured': configured_count,
            'ready_for_phase_2': openai_status.get('configured', False),  # AI features
            'ready_for_phase_3': redis_status.get('available', False),  # Real-time search
            'ready_for_phase_5': ms_oauth_status.get('configured', False),  # Microsoft integration
            'ready_for_phase_6_4': sentry_status.get('configured', False),  # APM monitoring
        },
    }
