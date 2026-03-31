from django.apps import AppConfig


class SuppliersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = 'tenant_apps.suppliers'
    verbose_name = '🏭 Suppliers'

    def ready(self):
        try:
            from . import signals  # noqa: F401
        except ImportError as e:
            import logging

            logging.warning(f'Failed to import suppliers signals: {e}')
