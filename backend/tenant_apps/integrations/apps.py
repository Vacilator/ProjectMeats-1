from django.apps import AppConfig


class TenantIntegrationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'

    # IMPORTANT: label must be unique across the project (apps.integrations already exists)
    name = 'tenant_apps.integrations'
    label = 'tenant_integrations'
    verbose_name = 'Tenant Integrations'

    def ready(self) -> None:
        # Register signal handlers
        from . import signals  # noqa: F401
