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
        """
        Called when app is ready.
        
        Registers:
        - Form submission signals
        - Event-driven workflow triggers (Phase 5 Part 2)
        """
        # Import signals for workflow triggers
        try:
            from . import signals  # noqa: F401
            
            # Register entity signals for event-driven workflows
            from .signals import register_entity_signals
            register_entity_signals()
            
        except ImportError as e:
            import logging
            logging.warning(f"Failed to import workflow signals: {e}")
