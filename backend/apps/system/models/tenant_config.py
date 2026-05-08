"""
Tenant Configuration model for tenant-specific settings.

Provides a key-value store for tenant-specific preferences:
- UI customizations (theme, logo, default views)
- Feature flags (enabled modules, limits)
- Business rules (approval thresholds, default values)
"""
import uuid

from django.core.validators import RegexValidator
from django.db import models

config_key_validator = RegexValidator(
    regex=r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$",
    message='Config key must be dot-separated lowercase identifiers (e.g., "ui.theme.primary_color")',
)


class TenantConfig(models.Model):
    """
    Tenant-specific configuration overrides.

    Implements a cascading configuration system:
    1. System default (defined in code or SystemFieldSchema)
    2. Tenant override (stored in this model)

    The ConfigResolver service handles the cascade lookup.

    Examples:
    - tenant + key "ui.theme.primary_color" = "#667eea"
    - tenant + key "business.po.auto_approve_threshold" = 5000.00
    - tenant + key "features.ai_assistant.enabled" = true
    """

    class ConfigCategory(models.TextChoices):
        UI = "UI", "User Interface"
        BUSINESS = "BUSINESS", "Business Rules"
        FEATURES = "FEATURES", "Feature Flags"
        INTEGRATIONS = "INTEGRATIONS", "Integrations"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="configurations",
        help_text="The tenant this configuration belongs to",
    )

    key = models.CharField(
        max_length=255,
        validators=[config_key_validator],
        help_text="Configuration key (e.g., 'ui.theme.primary_color')",
    )

    # Value stored as JSON to support all types
    value = models.JSONField(help_text="Configuration value (JSON: string, number, boolean, object, array)")

    # Categorization for UI grouping
    category = models.CharField(
        max_length=20,
        choices=ConfigCategory.choices,
        default=ConfigCategory.OTHER,
        help_text="Category for grouping in admin UI",
    )

    # Documentation
    description = models.TextField(blank=True, help_text="Description of what this config controls")

    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="updated_tenant_configs"
    )

    class Meta:
        db_table = "tenant_config"
        ordering = ["tenant", "key"]
        verbose_name = "Tenant Configuration"
        verbose_name_plural = "Tenant Configurations"
        constraints = [
            models.UniqueConstraint(fields=["tenant", "key"], name="unique_tenant_config_key"),
        ]
        indexes = [
            models.Index(fields=["tenant", "category"]),
            models.Index(fields=["key"]),
        ]

    def __str__(self):
        return f"{self.tenant}: {self.key}"

    @property
    def key_parts(self):
        """Split key into parts for hierarchical access."""
        return self.key.split(".")
