"""
Management Command: audit_secrets

Audits environment variables against config/env.manifest.json to identify
missing or zombie secrets without exposing sensitive values.

Usage:
    python manage.py audit_secrets
    python manage.py audit_secrets --verbose

Features:
- Checks current .env against manifest requirements
- Reports SET/MISSING status for each variable
- Does NOT print secret values (security first)
- Identifies zombie secrets (in .env but not in manifest)
- Supports GitHub Actions execution via ops-management-command.yml

Authority: Golden Pipeline rules for secret management
"""

import os
import json
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = 'Audit environment secrets against manifest without exposing values'

    def add_arguments(self, parser):
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show additional details about each secret',
        )

    def handle(self, *args, **options):
        verbose = options['verbose']
        
        self.stdout.write(self.style.SUCCESS('\n=== Secret Audit Report ===\n'))
        
        # Load manifest (moved to /manifests during repository consolidation)
        project_root = Path(settings.BASE_DIR).parent
        manifest_path = project_root / 'manifests' / 'env.manifest.json'
        
        if not manifest_path.exists():
            self.stdout.write(self.style.ERROR(f'❌ Manifest not found: {manifest_path}'))
            return
        
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
        
        # Get current environment from settings
        current_env = self.detect_environment()
        
        self.stdout.write(f'Environment: {self.style.WARNING(current_env)}')
        self.stdout.write(f'Manifest Version: {manifest.get("version", "unknown")}\n')
        
        # Collect all required variables from manifest
        required_vars = set()
        
        # Repository-level secrets
        for var_name in manifest.get('repository_secrets', {}).keys():
            required_vars.add(var_name)
        
        # Environment-level secrets (all categories)
        for category_data in manifest.get('environment_secrets', {}).values():
            for var_name in category_data.keys():
                required_vars.add(var_name)
        
        # Check status of each required variable
        results = {
            'set': [],
            'missing': [],
        }
        
        for var in sorted(required_vars):
            value = os.environ.get(var)
            if value:
                results['set'].append(var)
            else:
                results['missing'].append(var)
        
        # Report SET variables
        self.stdout.write(self.style.SUCCESS(f'\n✅ SET ({len(results["set"])} variables):'))
        if results['set']:
            for var in results['set']:
                status = '✓' if verbose else ''
                self.stdout.write(f'  {status} {var}')
        else:
            self.stdout.write('  (none)')
        
        # Report MISSING variables
        self.stdout.write(self.style.ERROR(f'\n❌ MISSING ({len(results["missing"])} variables):'))
        if results['missing']:
            for var in results['missing']:
                self.stdout.write(self.style.WARNING(f'  ✗ {var}'))
        else:
            self.stdout.write('  (none)')
        
        # Identify zombie secrets (in environment but not in manifest)
        current_vars = set(os.environ.keys())
        # Filter to likely application secrets (exclude system vars)
        app_vars = {
            var for var in current_vars
            if not var.startswith(('_', 'LANG', 'PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'PWD'))
        }
        zombie_vars = app_vars - required_vars
        
        self.stdout.write(self.style.WARNING(f'\n🧟 ZOMBIE SECRETS ({len(zombie_vars)} variables):'))
        self.stdout.write('  (In environment but not in manifest)')
        if zombie_vars:
            for var in sorted(zombie_vars):
                self.stdout.write(f'  ⚠️  {var}')
        else:
            self.stdout.write('  (none)')
        
        # Summary
        self.stdout.write('\n' + '='*50)
        total_required = len(required_vars)
        total_set = len(results['set'])
        total_missing = len(results['missing'])
        
        if total_missing == 0:
            self.stdout.write(self.style.SUCCESS(f'\n✅ AUDIT PASSED: All {total_required} required secrets are set'))
        else:
            self.stdout.write(self.style.ERROR(f'\n❌ AUDIT FAILED: {total_missing}/{total_required} secrets missing'))
            self.stdout.write(self.style.WARNING('\nAction Required:'))
            self.stdout.write('  1. Add missing secrets to .env file or GitHub Secrets')
            self.stdout.write('  2. Run audit again to verify')
        
        self.stdout.write('')
    
    def detect_environment(self):
        """Detect current environment from settings."""
        # Check DJANGO_SETTINGS_MODULE
        settings_module = os.environ.get('DJANGO_SETTINGS_MODULE', '')
        
        if 'development' in settings_module or 'dev' in settings_module:
            return 'dev-backend'
        elif 'uat' in settings_module or 'staging' in settings_module:
            return 'uat-backend'
        elif 'production' in settings_module or 'prod' in settings_module:
            return 'production-backend'
        else:
            return 'dev-backend'  # Default
