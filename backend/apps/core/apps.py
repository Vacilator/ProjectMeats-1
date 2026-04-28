from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"
    verbose_name = "⚙️ Core System"

    def ready(self):
        # Register audit trail signals.
        from . import signals_audit  # noqa: F401
        from . import signals_realtime  # noqa: F401
