"""
Workflows app configuration.

Bundle Two: System → Tenant Workflows & New Data Entities
Provides Tenant Forms, Workflows, and Lists for tenant customization.

Phase 5 Part 2: Event-Driven Workflows
Registers signals for entity change events.
"""
from django.apps import AppConfig


class WorkflowsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tenant_apps.workflows'
    verbose_name = '🔄 Tenant Workflows'
    
    def ready(self):
        """
        Import signals and register event handlers when the app is ready.
        
        Phase 5 Part 2: Dynamic Signal Registration
        """
        # Import signals for workflow triggers
        try:
            from . import signals  # noqa
            # Register entity event signals
            from .signals import register_entity_signals
            register_entity_signals()
        except ImportError:
            pass
