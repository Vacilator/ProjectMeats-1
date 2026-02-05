"""
Workflows app configuration.

Bundle Two: System → Tenant Workflows & New Data Entities
Provides Tenant Forms, Workflows, and Lists for tenant customization.
"""
from django.apps import AppConfig


class WorkflowsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tenant_apps.workflows'
    verbose_name = '🔄 Tenant Workflows'
    
    def ready(self):
        # Import signals for workflow triggers
        try:
            from . import signals  # noqa
        except ImportError:
            pass
