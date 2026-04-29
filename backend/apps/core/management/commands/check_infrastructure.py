"""
Management command to run infrastructure diagnostics.

Checks connectivity for OpenAI, Redis, and Sentry services.
"""
from django.core.management.base import BaseCommand
from django.conf import settings
import sys
import os

# Add scripts directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../../../scripts'))

from infrastructure_diagnostics import run_full_diagnostic


class Command(BaseCommand):
    help = 'Run infrastructure connectivity diagnostics (OpenAI, Redis, Sentry)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--require-redis-readiness',
            action='store_true',
            help='Exit non-zero unless Redis-backed cache and channel layer are both connected.',
        )

    def handle(self, *args, **options):
        """Execute the infrastructure audit."""
        self.stdout.write(self.style.WARNING('\n🔍 Running Infrastructure Audit...\n'))
        
        try:
            result = run_full_diagnostic()
            
            # Display results
            services = result.get('services', {})
            
            for service_name, service_result in services.items():
                status = service_result['status']
                
                if status == 'CONNECTED':
                    self.stdout.write(self.style.SUCCESS(
                        f"✅ {service_result['service']}: {status}"
                    ))
                elif status == 'NOT_CONFIGURED':
                    self.stdout.write(self.style.WARNING(
                        f"🔒 {service_result['service']}: {status}"
                    ))
                else:
                    self.stdout.write(self.style.ERROR(
                        f"❌ {service_result['service']}: {status}"
                    ))
                
                self.stdout.write(f"   {service_result['message']}")
                
                for key, value in service_result.get('details', {}).items():
                    self.stdout.write(f"   • {key}: {value}")
            
            require_redis_readiness = bool(
                options.get('require_redis_readiness') or getattr(settings, 'REQUIRE_REDIS_READINESS', False)
            )

            # Overall status
            overall = result.get('overall_status')
            self.stdout.write('\n' + '=' * 60)
            if overall == 'READY':
                self.stdout.write(self.style.SUCCESS(
                    '✅ ALL SERVICES CONNECTED - Infrastructure Ready'
                ))
            else:
                self.stdout.write(self.style.WARNING(
                    '⚠️  INCOMPLETE - Some services need configuration'
                ))
            self.stdout.write('=' * 60 + '\n')

            if require_redis_readiness:
                strict_failures = []
                for service_name in ('Redis', 'Channel Layer'):
                    service_result = services.get(service_name, {})
                    if service_result.get('status') != 'CONNECTED':
                        strict_failures.append(service_name)

                if strict_failures:
                    self.stdout.write(
                        self.style.ERROR(
                            '❌ Redis readiness required, but these services are not connected: '
                            + ', '.join(strict_failures)
                        )
                    )
                    return 1

            return 0
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n❌ Audit failed: {str(e)}\n'))
            return 1
