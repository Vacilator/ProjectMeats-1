#!/usr/bin/env python
"""
Verification script for Phase 6 Email Integration implementation.
Tests all components are correctly installed and configured.
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'projectmeats.settings.development')
django.setup()

from apps.integrations.models import ExternalAuthProvider
from apps.integrations.providers import MicrosoftGraphProvider, EmailProvider
from tenant_apps.workflows.nodes import OutlookEmailNode


def test_provider_interface():
    """Test EmailProvider abstract interface"""
    print("✓ Testing EmailProvider interface...")

    # Check MicrosoftGraphProvider inherits from EmailProvider
    assert issubclass(MicrosoftGraphProvider, EmailProvider)
    print("  ✓ MicrosoftGraphProvider inherits from EmailProvider")

    # Check provider has required methods
    required_methods = ['get_auth_url', 'exchange_code', 'refresh_token', 'send_email', 'validate_token']
    for method in required_methods:
        assert hasattr(MicrosoftGraphProvider, method)
    print(f"  ✓ All required methods present: {', '.join(required_methods)}")

    print("✅ Provider interface tests passed\n")


def test_model():
    """Test ExternalAuthProvider model"""
    print("✓ Testing ExternalAuthProvider model...")

    # Check model exists
    assert ExternalAuthProvider is not None
    print("  ✓ Model exists")

    # Check required fields
    required_fields = ['tenant', 'provider_type', 'access_token', 'refresh_token', 'token_expiry', 'is_active']
    model_fields = [f.name for f in ExternalAuthProvider._meta.get_fields()]
    for field in required_fields:
        assert field in model_fields, f"Missing field: {field}"
    print(f"  ✓ All required fields present")

    # Check methods
    required_methods = ['set_encrypted_token', 'get_decrypted_token', 'is_token_expired', 'refresh_if_needed']
    for method in required_methods:
        assert hasattr(ExternalAuthProvider, method)
    print(f"  ✓ All required methods present: {', '.join(required_methods)}")

    print("✅ Model tests passed\n")


def test_workflow_node():
    """Test OutlookEmailNode"""
    print("✓ Testing OutlookEmailNode...")

    # Check node exists
    assert OutlookEmailNode is not None
    print("  ✓ Node class exists")

    # Check NODE_TYPE
    assert OutlookEmailNode.NODE_TYPE == 'outlook_email'
    print(f"  ✓ NODE_TYPE = '{OutlookEmailNode.NODE_TYPE}'")

    # Check required methods
    required_methods = ['validate_config', 'validate_email_addresses', 'render_template', 'execute']
    for method in required_methods:
        assert hasattr(OutlookEmailNode, method)
    print(f"  ✓ All required methods present: {', '.join(required_methods)}")

    # Test template rendering
    template = "Hello {{name}}, your order {{order.number}} is ready!"
    context = {'name': 'John', 'order': {'number': '12345'}}
    result = OutlookEmailNode.render_template(template, context)
    expected = "Hello John, your order 12345 is ready!"
    assert result == expected, f"Template render failed: {result} != {expected}"
    print(f"  ✓ Template rendering works correctly")

    print("✅ Workflow node tests passed\n")


def test_environment_variables():
    """Check required environment variables"""
    print("✓ Checking environment variables...")

    # Note: These are optional in development, required in production
    client_id = os.environ.get('MICROSOFT_CLIENT_ID')
    client_secret = os.environ.get('MICROSOFT_CLIENT_SECRET')
    encryption_key = os.environ.get('OAUTH_ENCRYPTION_KEY')

    if client_id and client_secret:
        print(f"  ✓ MICROSOFT_CLIENT_ID configured")
        print(f"  ✓ MICROSOFT_CLIENT_SECRET configured")
    else:
        print(f"  ⚠️  MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET not set (optional in dev)")

    if encryption_key:
        print(f"  ✓ OAUTH_ENCRYPTION_KEY configured")
    else:
        print(f"  ⚠️  OAUTH_ENCRYPTION_KEY not set (optional in dev)")

    print("✅ Environment check complete\n")


def test_urls():
    """Check URL routing"""
    print("✓ Testing URL routing...")

    from django.urls import resolve, reverse

    # Test OAuth URLs
    urls_to_test = [
        '/api/v1/integrations/oauth/authorize/',
        '/api/v1/integrations/oauth/status/',
        '/api/v1/integrations/oauth/disconnect/',
    ]

    for url in urls_to_test:
        try:
            resolve(url)
            print(f"  ✓ {url}")
        except Exception as e:
            print(f"  ✗ {url} - {str(e)}")
            raise

    print("✅ URL routing tests passed\n")


def test_migrations():
    """Check migrations are created"""
    print("✓ Checking migrations...")

    from django.db.migrations.recorder import MigrationRecorder

    # Check if integrations app has migrations
    migrations = MigrationRecorder.Migration.objects.filter(app='integrations')

    if migrations.exists():
        print(f"  ✓ Found {migrations.count()} migration(s)")
        for migration in migrations:
            print(f"    - {migration.name}")
    else:
        print(f"  ⚠️  No migrations applied yet (run 'python manage.py migrate')")

    print("✅ Migration check complete\n")


def main():
    """Run all verification tests"""
    print("=" * 70)
    print("Phase 6 Email Integration - Verification Script")
    print("=" * 70)
    print()

    try:
        test_provider_interface()
        test_model()
        test_workflow_node()
        test_environment_variables()
        test_urls()
        test_migrations()

        print("=" * 70)
        print("🎉 ALL TESTS PASSED!")
        print("=" * 70)
        print()
        print("Next steps:")
        print("1. Run migrations: python manage.py migrate")
        print("2. Set environment variables:")
        print("   - MICROSOFT_CLIENT_ID")
        print("   - MICROSOFT_CLIENT_SECRET")
        print("   - OAUTH_ENCRYPTION_KEY")
        print("3. Register app in Azure AD")
        print("4. Test OAuth flow in Settings > Integrations")
        print()

        return 0

    except Exception as e:
        print(f"\n❌ TEST FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
