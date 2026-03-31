#!/usr/bin/env python3
"""fix_dev_domain.py

Fix Dev Domain Mapping

Maps a domain (default: dev-backend.meatscentral.com) to a tenant slug (default: root)
by creating/updating a TenantDomain record.

Usage:
  python scripts/maintenance/fix_dev_domain.py --help
  python scripts/maintenance/fix_dev_domain.py --domain dev-backend.meatscentral.com --tenant-slug root

Notes:
- Intended to be run either inside the backend container or from the repo root.
- Requires a reachable database.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def _detect_backend_path() -> Path:
    # Container layout
    container_backend = Path('/app/backend')
    if container_backend.exists():
        return container_backend

    # Repo layout: scripts/maintenance/*.py -> repo root is parents[2]
    repo_root = Path(__file__).resolve().parents[2]
    backend_dir = repo_root / 'backend'
    return backend_dir


def _setup_django(settings_module: str) -> int:
    backend_dir = _detect_backend_path()
    sys.path.insert(0, str(backend_dir))

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', settings_module)

    try:
        import django

        django.setup()
    except Exception as e:
        print(f"❌ Failed to setup Django ({settings_module}): {e}")
        return 1

    return 0


def show_current_mappings() -> None:
    from apps.tenants.models import TenantDomain

    print('\n' + '=' * 60)
    print('Current Domain Mappings')
    print('=' * 60)

    try:
        mappings = TenantDomain.objects.select_related('tenant').all()
        if not mappings:
            print('No domain mappings found.')
        else:
            for mapping in mappings:
                print(
                    f"  {mapping.domain} → {mapping.tenant.name} "
                    f"(slug: {mapping.tenant.slug}, primary: {mapping.is_primary})"
                )
    except Exception as e:
        print(f'Could not fetch mappings: {e}')


def fix_domain(domain: str, tenant_slug: str) -> int:
    from apps.tenants.models import Tenant, TenantDomain

    print('=' * 60)
    print('Fixing Dev Domain Mapping')
    print('=' * 60)

    try:
        print('Step 1: Looking for tenant...')
        tenant = Tenant.objects.get(slug=tenant_slug)
        print(f'✅ Found tenant: {tenant.name} (slug: {tenant.slug}, id: {tenant.id})')

        print('Step 2: Creating/updating domain mapping...')
        obj, created = TenantDomain.objects.update_or_create(
            domain=domain,
            defaults={'tenant': tenant, 'is_primary': True},
        )

        print('✅ Created new mapping' if created else '✅ Updated existing mapping')
        print(f'  Domain: {obj.domain}')
        print(f'  Tenant: {obj.tenant.name} (slug: {obj.tenant.slug})')
        print(f'  Primary: {obj.is_primary}')

        print('Step 3: Verifying mapping...')
        verification = TenantDomain.objects.select_related('tenant').get(domain=domain)
        if verification.tenant_id != tenant.id:
            print('❌ Verification failed: mapping does not match tenant')
            return 1

        print('✅ Mapping verified successfully')
        print('\nNext steps:')
        print('1. Restart the backend container (if applicable)')
        print(f'2. Try accessing {domain}')
        return 0

    except Tenant.DoesNotExist:
        print(f"❌ Error: tenant slug '{tenant_slug}' not found")
        return 1
    except Exception as e:
        print(f'❌ Unexpected error: {e}')
        import traceback

        traceback.print_exc()
        return 1


def main() -> int:
    parser = argparse.ArgumentParser(description='Create/update TenantDomain mapping for a domain.')
    parser.add_argument('--domain', default='dev-backend.meatscentral.com', help='Domain to map')
    parser.add_argument('--tenant-slug', default='root', help='Tenant slug to map the domain to')
    parser.add_argument(
        '--settings',
        default='projectmeats.settings.development',
        help='DJANGO_SETTINGS_MODULE to use (default: projectmeats.settings.development)',
    )
    parser.add_argument(
        '--show',
        action='store_true',
        help='Print current domain mappings before/after the change',
    )

    args = parser.parse_args()

    setup_rc = _setup_django(args.settings)
    if setup_rc != 0:
        return setup_rc

    if args.show:
        show_current_mappings()

    rc = fix_domain(args.domain, args.tenant_slug)

    if rc == 0 and args.show:
        show_current_mappings()

    return rc


if __name__ == '__main__':
    sys.exit(main())
