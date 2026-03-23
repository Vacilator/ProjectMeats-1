#!/usr/bin/env python3
"""
Infrastructure Connectivity Diagnostics

Tests the "Trinity of Services" (Sentry, Redis, OpenAI) in the dev environment.
Designed to run via Ops - DB Surgery workflow or locally in Django shell.
"""

import os
import sys
from typing import Dict, Any

def test_redis_connectivity() -> Dict[str, Any]:
    """Test Redis connection via Django cache"""
    try:
        from django.core.cache import cache
        
        # Test key-value storage with TTL
        test_key = 'infra_audit_test'
        test_value = 'REDIS_OK'
        
        cache.set(test_key, test_value, 30)  # 30 second TTL
        retrieved = cache.get(test_key)
        
        if retrieved == test_value:
            return {
                'service': 'Redis',
                'status': 'CONNECTED',
                'message': 'Successfully stored and retrieved test value',
                'details': {
                    'backend': cache.__class__.__name__,
                    'test_passed': True
                }
            }
        else:
            return {
                'service': 'Redis',
                'status': 'PARTIAL',
                'message': f'Value mismatch: expected {test_value}, got {retrieved}',
                'details': {'test_passed': False}
            }
    except Exception as e:
        return {
            'service': 'Redis',
            'status': 'FAILED',
            'message': str(e),
            'details': {'error_type': type(e).__name__}
        }

def test_openai_connectivity() -> Dict[str, Any]:
    """Test OpenAI API handshake"""
    try:
        api_key = os.getenv('OPENAI_API_KEY')
        
        if not api_key:
            return {
                'service': 'OpenAI',
                'status': 'NOT_CONFIGURED',
                'message': 'OPENAI_API_KEY environment variable not set',
                'details': {}
            }
        
        from openai import OpenAI
        
        client = OpenAI(api_key=api_key)
        
        # Test API by listing models (lightweight operation)
        models_response = client.models.list()
        models = [m.id for m in models_response.data[:5]]  # Get first 5 models
        
        return {
            'service': 'OpenAI',
            'status': 'CONNECTED',
            'message': 'Successfully authenticated and retrieved model list',
            'details': {
                'api_key_prefix': api_key[:7] + '...' + api_key[-4:],
                'available_models': models,
                'test_passed': True
            }
        }
    except ImportError:
        return {
            'service': 'OpenAI',
            'status': 'NOT_INSTALLED',
            'message': 'openai package not installed',
            'details': {'action': 'Run: pip install openai'}
        }
    except Exception as e:
        return {
            'service': 'OpenAI',
            'status': 'FAILED',
            'message': str(e),
            'details': {
                'error_type': type(e).__name__,
                'api_key_configured': bool(api_key)
            }
        }

def test_sentry_connectivity() -> Dict[str, Any]:
    """Test Sentry DSN configuration"""
    try:
        import sentry_sdk
        from sentry_sdk import Hub
        
        client = Hub.current.client
        
        if client and client.dsn:
            # Test Sentry by capturing a test message
            event_id = sentry_sdk.capture_message(
                "Infrastructure audit test message",
                level="info",
                tags={'audit': 'infrastructure_check'}
            )
            
            return {
                'service': 'Sentry',
                'status': 'CONNECTED',
                'message': 'DSN loaded and test event sent',
                'details': {
                    'dsn_scheme': client.dsn.scheme,
                    'dsn_host': client.dsn.host,
                    'event_id': str(event_id) if event_id else 'N/A',
                    'test_passed': True
                }
            }
        else:
            return {
                'service': 'Sentry',
                'status': 'NOT_CONFIGURED',
                'message': 'Sentry DSN not loaded',
                'details': {'client_exists': bool(client)}
            }
    except ImportError:
        return {
            'service': 'Sentry',
            'status': 'NOT_INSTALLED',
            'message': 'sentry_sdk package not installed',
            'details': {'action': 'Run: pip install sentry-sdk'}
        }
    except Exception as e:
        return {
            'service': 'Sentry',
            'status': 'FAILED',
            'message': str(e),
            'details': {'error_type': type(e).__name__}
        }

def run_full_diagnostic() -> Dict[str, Any]:
    """Run all infrastructure tests"""
    print("=" * 60)
    print("🔍 INFRASTRUCTURE CONNECTIVITY AUDIT")
    print("=" * 60)
    print()
    
    results = {
        'redis': test_redis_connectivity(),
        'openai': test_openai_connectivity(),
        'sentry': test_sentry_connectivity()
    }
    
    # Print results
    for service_name, result in results.items():
        status_emoji = {
            'CONNECTED': '✅',
            'PARTIAL': '⚠️',
            'FAILED': '❌',
            'NOT_CONFIGURED': '🔒',
            'NOT_INSTALLED': '📦'
        }.get(result['status'], '❓')
        
        print(f"{status_emoji} {result['service']}: {result['status']}")
        print(f"   {result['message']}")
        if result['details']:
            for key, value in result['details'].items():
                print(f"   • {key}: {value}")
        print()
    
    # Overall status
    all_connected = all(r['status'] == 'CONNECTED' for r in results.values())
    
    print("=" * 60)
    if all_connected:
        print("✅ ALL SERVICES CONNECTED - Infrastructure Ready")
    else:
        print("⚠️  INCOMPLETE - Some services need configuration")
    print("=" * 60)
    
    return {
        'overall_status': 'READY' if all_connected else 'NEEDS_CONFIGURATION',
        'services': results
    }

if __name__ == '__main__':
    # Run diagnostic
    import django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'projectmeats.settings.dev')
    django.setup()
    
    result = run_full_diagnostic()
    
    # Exit code based on overall status
    sys.exit(0 if result['overall_status'] == 'READY' else 1)
