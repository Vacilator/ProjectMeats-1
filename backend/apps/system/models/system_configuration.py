"""System-level configuration.

This table stores global (non-tenant) configuration values that must be
mutable at runtime without requiring a redeploy.

We intentionally enforce a singleton row (id=1) so callers can use:

    SystemConfiguration.objects.update_or_create(defaults={...})

without providing a lookup.
"""

from django.db import models


class SystemConfiguration(models.Model):
    """Global ProjectMeats configuration (singleton)."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)

    active_openai_model_id = models.CharField(
        max_length=128,
        default="gpt-4o-mini",
        help_text="Active OpenAI model ID to use for chat/swarm execution",
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "system_configuration"
        verbose_name = "System Configuration"
        verbose_name_plural = "System Configuration"

    def save(self, *args, **kwargs):
        self.id = 1
        super().save(*args, **kwargs)
