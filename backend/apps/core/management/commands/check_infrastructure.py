"""
Management command to run infrastructure diagnostics.

Checks connectivity for OpenAI, Redis, and Sentry services.
"""
from django.core.management.base import BaseCommand
import sys
import os

# Add scripts directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../../../scripts'))

from infrastructure_diagnostics import run_full_diagnostic


class Command(BaseCommand):
    help = 'Run infrastructure connectivity diagnostics (OpenAI, Redis, Sentry)'

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
            
            return 0
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n❌ Audit failed: {str(e)}\n'))
            return 1
