"""Fulfillments app configuration."""
from django.apps import AppConfig


class FulfillmentsConfig(AppConfig):
    """Configuration for the fulfillments app."""
    
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tenant_apps.fulfillments'
    verbose_name = '🚚 Fulfillments'

    def ready(self):
        """Import signals when app is ready."""
        try:
            import tenant_apps.fulfillments.signals  # noqa: F401
        except ImportError:
            pass
