from django.apps import AppConfig


class AiAssistantConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = 'tenant_apps.ai_assistant'
    verbose_name = '🤖 AI Assistant'

    def ready(self):
        import tenant_apps.ai_assistant.signals  # noqa: F401
