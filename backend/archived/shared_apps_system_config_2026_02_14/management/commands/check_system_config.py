"""
Management command to diagnose system_config app loading issues.
Usage: python manage.py check_system_config
"""
from django.core.management.base import BaseCommand
from django.conf import settings
from django.urls import get_resolver


class Command(BaseCommand):
    help = 'Diagnose system_config app and URL registration'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('=== System Config Diagnostic ===\n'))
        
        # Check if app is in INSTALLED_APPS
        app_name = 'shared_apps.system_config'
        if app_name in settings.INSTALLED_APPS:
            self.stdout.write(self.style.SUCCESS(f'✅ {app_name} is in INSTALLED_APPS'))
        else:
            self.stdout.write(self.style.ERROR(f'❌ {app_name} is NOT in INSTALLED_APPS'))
            return
        
        # Check if models are loaded
        try:
            from shared_apps.system_config.models import EntityBlueprint, WorkflowRun
            self.stdout.write(self.style.SUCCESS('✅ Models import successfully'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Models import failed: {e}'))
            return
        
        # Check if serializers load
        try:
            from shared_apps.system_config.serializers import WorkflowRunSerializer
            serializer_fields = WorkflowRunSerializer.Meta.fields
            self.stdout.write(self.style.SUCCESS(f'✅ Serializers load successfully'))
            self.stdout.write(f'   WorkflowRunSerializer fields: {serializer_fields}')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Serializers import failed: {e}'))
            return
        
        # Check if URLs are in the resolver
        resolver = get_resolver()
        found_patterns = []
        for pattern in resolver.url_patterns:
            pattern_str = str(pattern.pattern)
            if 'system-config' in pattern_str:
                found_patterns.append(pattern_str)
        
        if found_patterns:
            self.stdout.write(self.style.SUCCESS(f'✅ Found system-config URL patterns:'))
            for p in found_patterns:
                self.stdout.write(f'   - {p}')
        else:
            self.stdout.write(self.style.ERROR('❌ system-config URL patterns NOT registered'))
        
        # Summary
        self.stdout.write(self.style.NOTICE('\n=== Summary ==='))
        self.stdout.write(f'Django Settings Module: {settings.SETTINGS_MODULE}')
        self.stdout.write(f'Total URL patterns: {len(resolver.url_patterns)}')
        
        if found_patterns:
            self.stdout.write(self.style.SUCCESS('\n✅ System config app is properly loaded'))
        else:
            self.stdout.write(self.style.ERROR('\n❌ System config URLs are NOT registered'))
