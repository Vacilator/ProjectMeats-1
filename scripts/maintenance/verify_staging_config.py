#!/usr/bin/env python3
"""verify_staging_config.py

Verify staging.meatscentral.com configuration.

This script is intended for one-off troubleshooting. It checks:
- ALLOWED_HOSTS contains the configured domain
- At least one active tenant exists
- TenantDomain mapping exists and points to an active tenant
- Logging config is able to emit INFO for apps.tenants.middleware

Usage:
  python scripts/maintenance/verify_staging_config.py --help
  python scripts/maintenance/verify_staging_config.py --domain staging.meatscentral.com

Notes:
- Requires Django settings and (for DB checks) a reachable database.
- Safe to run: read-only.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def _setup_django(settings_module: str) -> int:
    repo_root = Path(__file__).resolve().parents[2]
    backend_dir = repo_root / 'backend'
    sys.path.insert(0, str(backend_dir))

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', settings_module)

    try:
        import django

        django.setup()
    except Exception as e:
        print(f"❌ Failed to setup Django ({settings_module}): {e}")
        return 1

    return 0


def check_allowed_hosts(domain: str) -> bool:
    from django.conf import settings

    print('=' * 70)
    print('1. Checking ALLOWED_HOSTS configuration...')
    print('=' * 70)

    allowed_hosts = settings.ALLOWED_HOSTS
    print(f'ALLOWED_HOSTS: {allowed_hosts}')

    if domain in allowed_hosts or '*' in allowed_hosts:
        print(f'✓ {domain} is allowed')
        return True

    print(f'✗ {domain} is NOT in ALLOWED_HOSTS')
    print('  Add it to STAGING_HOSTS in backend/projectmeats/settings/staging.py')
    return False


def check_tenant_exists() -> bool:
    from apps.tenants.models import Tenant

    print('\n' + '=' * 70)
    print('2. Checking active tenants...')
    print('=' * 70)

    try:
        active_tenants = Tenant.objects.filter(is_active=True)
        count = active_tenants.count()
    except Exception as e:
        print(f'✗ Could not query tenants (DB not reachable?): {e}')
        return False

    print(f'Active tenants found: {count}')

    if count == 0:
        print('✗ No active tenants found')
        print('  Create a tenant first using:')
        print('  python manage.py create_tenant --name=... --slug=...')
        return False

    print('✓ Active tenants:')
    for tenant in active_tenants:
        print(f'  - {tenant.slug}: {tenant.name} (ID: {tenant.id})')

    return True


def check_tenant_domain(domain: str) -> bool:
    from apps.tenants.models import Tenant, TenantDomain

    print('\n' + '=' * 70)
    print('3. Checking TenantDomain entry...')
    print('=' * 70)

    try:
        tenant_domain = TenantDomain.objects.select_related('tenant').get(domain=domain)
    except TenantDomain.DoesNotExist:
        print(f'✗ No TenantDomain entry for {domain}')
        print('\nTo fix this, run:')
        print(f'  python manage.py add_tenant_domain --domain={domain} --tenant-slug=<TENANT_SLUG>')
        print('\nAvailable active tenants:')
        for slug, name in Tenant.objects.filter(is_active=True).values_list('slug', 'name'):
            print(f'  - {slug}: {name}')
        return False
    except Exception as e:
        print(f'✗ Could not query TenantDomain (DB not reachable?): {e}')
        return False

    print('✓ TenantDomain entry exists')
    print(f'  Domain: {tenant_domain.domain}')
    print(f'  Tenant: {tenant_domain.tenant.slug} (ID: {tenant_domain.tenant.id})')
    print(f'  Tenant Name: {tenant_domain.tenant.name}')
    print(f'  Tenant Active: {tenant_domain.tenant.is_active}')
    print(f'  Is Primary: {tenant_domain.is_primary}')

    if not tenant_domain.tenant.is_active:
        print(f"✗ WARNING: Tenant '{tenant_domain.tenant.slug}' is INACTIVE")
        return False

    return True


def check_logging_config() -> bool:
    print('\n' + '=' * 70)
    print('4. Checking logging configuration...')
    print('=' * 70)

    import logging

    logger = logging.getLogger('apps.tenants.middleware')

    print(f'Logger level: {logging.getLevelName(logger.level)}')
    print(f'Effective level: {logging.getLevelName(logger.getEffectiveLevel())}')

    if logger.isEnabledFor(logging.INFO):
        print('✓ INFO logging is enabled (debug logs will be visible)')
        return True

    print('✗ INFO logging is disabled (debug logs will NOT be visible)')
    print('  Update LOGGING configuration in settings to enable INFO level')
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description='Verify staging domain configuration (Django).')
    parser.add_argument(
        '--settings',
        default='projectmeats.settings.staging',
        help='DJANGO_SETTINGS_MODULE to use (default: projectmeats.settings.staging)',
    )
    parser.add_argument(
        '--domain',
        default='staging.meatscentral.com',
        help='Domain to verify (default: staging.meatscentral.com)',
    )

    args = parser.parse_args()

    setup_rc = _setup_django(args.settings)
    if setup_rc != 0:
        return setup_rc

    print('\n' + '=' * 70)
    print('STAGING CONFIGURATION VERIFICATION')
    print('=' * 70)

    results = {
        'ALLOWED_HOSTS': check_allowed_hosts(args.domain),
        'Active Tenants': check_tenant_exists(),
        'TenantDomain': check_tenant_domain(args.domain),
        'Logging': check_logging_config(),
    }

    print('\n' + '=' * 70)
    print('SUMMARY')
    print('=' * 70)

    all_passed = True
    for check, passed in results.items():
        status = '✓ PASS' if passed else '✗ FAIL'
        print(f'{status}: {check}')
        if not passed:
            all_passed = False

    print('=' * 70)

    if all_passed:
        print('\n✓ All checks passed!')
        return 0

    print('\n✗ Some checks failed. Please fix the issues above.')
    return 1


if __name__ == '__main__':
    sys.exit(main())
