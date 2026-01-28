"""Inquiries app configuration."""
from django.apps import AppConfig


class InquiriesConfig(AppConfig):
    """Configuration for the inquiries app."""
    
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tenant_apps.inquiries'
    verbose_name = 'Inquiries'

    def ready(self):
        """Import signals when app is ready."""
        try:
            import tenant_apps.inquiries.signals  # noqa: F401
        except ImportError:
            pass
