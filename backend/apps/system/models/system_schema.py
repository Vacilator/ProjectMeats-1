"""
System Field Schema model for field-level configuration.

Provides metadata about form fields that can be customized:
- Validation rules (min/max, patterns, required)
- Display hints (placeholder, help text, icon)
- Behavior (read-only, hidden, computed)
"""
import uuid

from django.core.validators import RegexValidator
from django.db import models

field_path_validator = RegexValidator(
    regex=r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$",
    message='Field path must be dot-separated lowercase identifiers (e.g., "products.product.protein_type")',
)


class SystemFieldSchema(models.Model):
    """
    Schema configuration for a specific model field.

    Allows system admins to customize field behavior without code changes:
    - Change field labels and help text
    - Set default values
    - Configure validation rules
    - Hide/show fields conditionally

    Examples:
    - field_path: "products.product.protein_type"
    - field_path: "purchase_orders.purchaseorder.delivery_date"
    """

    class FieldType(models.TextChoices):
        TEXT = "TEXT", "Text"
        NUMBER = "NUMBER", "Number"
        DECIMAL = "DECIMAL", "Decimal"
        DATE = "DATE", "Date"
        DATETIME = "DATETIME", "DateTime"
        BOOLEAN = "BOOLEAN", "Boolean"
        CHOICE = "CHOICE", "Choice/Dropdown"
        MULTI_CHOICE = "MULTI_CHOICE", "Multiple Choice"
        FOREIGN_KEY = "FOREIGN_KEY", "Foreign Key"
        JSON = "JSON", "JSON"
        FILE = "FILE", "File Upload"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Field identification
    field_path = models.CharField(
        max_length=255,
        unique=True,
        validators=[field_path_validator],
        help_text="Dot-path to field (e.g., 'products.product.protein_type')",
    )
    field_type = models.CharField(
        max_length=20, choices=FieldType.choices, default=FieldType.TEXT, help_text="Data type of this field"
    )

    # Display configuration
    label = models.CharField(
        max_length=255, blank=True, help_text="Override display label (uses model field name if blank)"
    )
    help_text = models.TextField(blank=True, help_text="Help text shown below the field")
    placeholder = models.CharField(max_length=255, blank=True, help_text="Placeholder text for empty fields")

    # Validation rules (stored as JSON for flexibility)
    validation_rules = models.JSONField(
        default=dict,
        blank=True,
        help_text="""Validation rules, e.g.:
        {
            "required": true,
            "min_length": 3,
            "max_length": 100,
            "pattern": "^[A-Z]+$",
            "min_value": 0,
            "max_value": 1000000
        }""",
    )

    # Default value (stored as JSON to handle all types)
    default_value = models.JSONField(null=True, blank=True, help_text="Default value for new records")

    # Behavior flags
    is_required = models.BooleanField(default=False, help_text="Whether this field is required")
    is_readonly = models.BooleanField(default=False, help_text="Whether this field is read-only")
    is_hidden = models.BooleanField(default=False, help_text="Whether this field is hidden from UI")

    # For choice fields - link to SystemChoiceList
    choice_list = models.ForeignKey(
        "system.SystemChoiceList",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="schema_fields",
        help_text="For CHOICE/MULTI_CHOICE fields: the source choice list",
    )

    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "system_field_schema"
        ordering = ["field_path"]
        verbose_name = "System Field Schema"
        verbose_name_plural = "System Field Schemas"

    def __str__(self):
        return f"{self.field_path} ({self.field_type})"

    @property
    def app_label(self):
        """Extract app label from field_path."""
        parts = self.field_path.split(".")
        return parts[0] if parts else ""

    @property
    def model_name(self):
        """Extract model name from field_path."""
        parts = self.field_path.split(".")
        return parts[1] if len(parts) > 1 else ""

    @property
    def field_name(self):
        """Extract field name from field_path."""
        parts = self.field_path.split(".")
        return parts[2] if len(parts) > 2 else ""
