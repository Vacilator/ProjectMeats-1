"""Deals app configuration."""
from django.apps import AppConfig


class DealsConfig(AppConfig):
    """Configuration for the deals app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "tenant_apps.deals"
    verbose_name = "🤝 Deals"

    def ready(self):
        """Import signals when app is ready."""
        try:
            import tenant_apps.deals.signals  # noqa: F401
        except ImportError:
            pass
