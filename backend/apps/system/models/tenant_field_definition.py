"""
Tenant Field Definition model.

Allows tenant admins to add virtual custom fields to business entities
without modifying the database schema. Data is stored in the `custom_data`
JSONField on TenantAwareModel.

Field Types:
- text: Single-line text input
- textarea: Multi-line text input
- number: Numeric input (integer or decimal)
- date: Date picker
- datetime: Date and time picker
- select: Dropdown (single choice)
- multiselect: Multiple choice dropdown
- checkbox: Boolean yes/no
- url: URL input with validation
- email: Email input with validation
"""
import uuid
from django.db import models
from django.core.validators import RegexValidator


# Field key validator (alphanumeric + underscores, starts with letter)
field_key_validator = RegexValidator(
    regex=r'^[a-z][a-z0-9_]*$',
    message='Field key must start with a letter and contain only lowercase letters, numbers, and underscores.'
)


class FieldTypeChoices(models.TextChoices):
    """Supported field types for virtual custom fields."""
    TEXT = 'text', 'Text'
    TEXTAREA = 'textarea', 'Text Area'
    NUMBER = 'number', 'Number'
    DATE = 'date', 'Date'
    DATETIME = 'datetime', 'Date & Time'
    SELECT = 'select', 'Single Select'
    MULTISELECT = 'multiselect', 'Multi Select'
    CHECKBOX = 'checkbox', 'Checkbox'
    URL = 'url', 'URL'
    EMAIL = 'email', 'Email'


class TenantFieldDefinition(models.Model):
    """
    Virtual field definition for tenant-specific customization.
    
    Allows tenants to extend business entities (Supplier, Customer, Product, etc.)
    with custom fields without modifying the database schema.
    
    Data is stored in the `custom_data` JSONField on TenantAwareModel subclasses.
    
    Example:
        Field for Supplier with key 'halal_certified':
        - model_name: 'suppliers.Supplier'
        - field_key: 'halal_certified'
        - field_type: 'checkbox'
        - label: 'Halal Certified'
        - Data stored in: Supplier.custom_data['halal_certified'] = true
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='field_definitions',
        help_text="Tenant that owns this field definition"
    )
    
    # Entity this field applies to
    model_name = models.CharField(
        max_length=100,
        help_text="Model identifier (e.g., 'suppliers.Supplier', 'products.Product')"
    )
    
    # Field configuration
    field_key = models.CharField(
        max_length=100,
        validators=[field_key_validator],
        help_text="Key for storing data in custom_data JSON (e.g., 'halal_certified')"
    )
    
    field_type = models.CharField(
        max_length=20,
        choices=FieldTypeChoices.choices,
        help_text="Type of field (text, select, date, etc.)"
    )
    
    label = models.CharField(
        max_length=255,
        help_text="Display label for the field (e.g., 'Halal Certified')"
    )
    
    help_text = models.TextField(
        blank=True,
        help_text="Help text shown to users"
    )
    
    # Field behavior
    is_required = models.BooleanField(
        default=False,
        help_text="Whether this field is required"
    )
    
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this field is currently active/visible"
    )
    
    # Display order
    display_order = models.PositiveIntegerField(
        default=0,
        help_text="Order in which custom fields are displayed"
    )
    
    # Field-specific configuration
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text="""
        Field-specific configuration:
        - For 'select'/'multiselect': {"options": [{"value": "A", "label": "Option A"}]}
        - For 'number': {"min": 0, "max": 100, "step": 1}
        - For 'text': {"min_length": 3, "max_length": 50, "pattern": "regex"}
        - For 'url': {"allowed_domains": ["example.com"]}
        """
    )
    
    # Validation rules
    validation_rules = models.JSONField(
        default=dict,
        blank=True,
        help_text="""
        Custom validation rules:
        - {"required": true}
        - {"min_length": 3, "max_length": 100}
        - {"pattern": "^[A-Z0-9-]+$", "message": "Custom error"}
        - {"custom_validator": "function_name"}
        """
    )
    
    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_field_definitions',
        help_text="User who created this field"
    )
    updated_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_field_definitions',
        help_text="User who last updated this field"
    )
    
    class Meta:
        db_table = 'tenant_field_definition'
        ordering = ['model_name', 'display_order', 'label']
        verbose_name = 'Tenant Field Definition'
        verbose_name_plural = 'Tenant Field Definitions'
        constraints = [
            # Unique field key per model per tenant
            models.UniqueConstraint(
                fields=['tenant', 'model_name', 'field_key'],
                name='unique_tenant_field_definition'
            ),
        ]
        indexes = [
            models.Index(fields=['tenant', 'model_name']),
            models.Index(fields=['tenant', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.model_name}.{self.field_key} ({self.tenant})"
    
    def get_default_value(self):
        """
        Get the default value for this field based on its type.
        
        Returns:
            Default value appropriate for the field type
        """
        defaults = {
            FieldTypeChoices.TEXT: '',
            FieldTypeChoices.TEXTAREA: '',
            FieldTypeChoices.NUMBER: None,
            FieldTypeChoices.DATE: None,
            FieldTypeChoices.DATETIME: None,
            FieldTypeChoices.SELECT: None,
            FieldTypeChoices.MULTISELECT: [],
            FieldTypeChoices.CHECKBOX: False,
            FieldTypeChoices.URL: '',
            FieldTypeChoices.EMAIL: '',
        }
        return defaults.get(self.field_type)
    
    def validate_value(self, value):
        """
        Validate a value against this field's configuration.
        
        Args:
            value: The value to validate
            
        Returns:
            tuple: (is_valid, error_message)
        """
        # Required field check
        if self.is_required and not value:
            return False, f"{self.label} is required"
        
        # Type-specific validation
        if self.field_type == FieldTypeChoices.NUMBER:
            if value is not None and not isinstance(value, (int, float)):
                return False, f"{self.label} must be a number"
            
            config = self.config or {}
            if 'min' in config and value < config['min']:
                return False, f"{self.label} must be at least {config['min']}"
            if 'max' in config and value > config['max']:
                return False, f"{self.label} must be at most {config['max']}"
        
        elif self.field_type == FieldTypeChoices.SELECT:
            config = self.config or {}
            options = config.get('options', [])
            valid_values = [opt['value'] for opt in options]
            if value and value not in valid_values:
                return False, f"{self.label} must be one of: {', '.join(valid_values)}"
        
        elif self.field_type == FieldTypeChoices.MULTISELECT:
            if not isinstance(value, list):
                return False, f"{self.label} must be a list"
            config = self.config or {}
            options = config.get('options', [])
            valid_values = [opt['value'] for opt in options]
            for v in value:
                if v not in valid_values:
                    return False, f"Invalid value '{v}' in {self.label}"
        
        # Custom validation rules
        rules = self.validation_rules or {}
        if 'min_length' in rules and len(str(value)) < rules['min_length']:
            return False, f"{self.label} must be at least {rules['min_length']} characters"
        if 'max_length' in rules and len(str(value)) > rules['max_length']:
            return False, f"{self.label} must be at most {rules['max_length']} characters"
        
        return True, None
    
    def get_form_field_config(self):
        """
        Generate frontend form field configuration.
        
        Returns:
            dict: Configuration for rendering this field in a form
        """
        return {
            'key': self.field_key,
            'type': self.field_type,
            'label': self.label,
            'help_text': self.help_text,
            'required': self.is_required,
            'default_value': self.get_default_value(),
            'config': self.config,
            'validation': self.validation_rules,
            'display_order': self.display_order,
        }
