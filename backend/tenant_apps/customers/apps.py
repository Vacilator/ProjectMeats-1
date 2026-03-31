from django.apps import AppConfig


class CustomersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = 'tenant_apps.customers'
    verbose_name = '👥 Customers'

    def ready(self):
        try:
            from . import signals  # noqa: F401
        except ImportError as e:
            import logging

            logging.warning(f'Failed to import customers signals: {e}')
