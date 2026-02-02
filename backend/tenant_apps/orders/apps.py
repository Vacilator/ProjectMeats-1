"""
Django app configuration for the orders app.
"""
from django.apps import AppConfig


class OrdersConfig(AppConfig):
    """Configuration for the orders app."""
    
    default_auto_field = "django.db.models.BigAutoField"
    name = "tenant_apps.orders"
    verbose_name = "📦 Orders"
    
    def ready(self):
        """Import signals when app is ready."""
        pass  # Signals will be added when consolidation is complete
