from django.apps import AppConfig


class IntegrationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.integrations'
    verbose_name = 'Email Integrations'
    
    def ready(self):
        """Import signals when app is ready."""
        import apps.integrations.signals  # noqa
