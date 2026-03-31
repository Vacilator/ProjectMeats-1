"""
Form Field Inheritance & Type Checking Service (Phase 2.5)

Provides validation rule inheritance from entity models and strict type checking.
"""
from typing import Dict, Any
from django.db import models
from tenant_apps.workflows.models import TenantFormField


class FieldInheritanceService:
    """
    Service for managing field inheritance and type validation.
    
    Features:
    1. Inherit validation rules from Django model field definitions
    2. Strict type checking based on field_type
    3. Computed validation rules from entity schema
    """
    
    # Type-based validation schemas
    TYPE_VALIDATION_RULES = {
        'text': {
            'type': 'string',
            'required_keys': [],
            'optional_keys': ['min_length', 'max_length', 'pattern']
        },
        'email': {
            'type': 'string',
            'required_keys': [],
            'optional_keys': ['pattern'],
            'default_pattern': r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        },
        'number': {
            'type': 'number',
            'required_keys': [],
            'optional_keys': ['min', 'max', 'step']
        },
        'integer': {
            'type': 'integer',
            'required_keys': [],
            'optional_keys': ['min', 'max', 'step']
        },
        'date': {
            'type': 'string',
            'required_keys': [],
            'optional_keys': ['min_date', 'max_date'],
            'format': 'date'
        },
        'datetime': {
            'type': 'string',
            'required_keys': [],
            'optional_keys': ['min_datetime', 'max_datetime'],
            'format': 'date-time'
        },
        'boolean': {
            'type': 'boolean',
            'required_keys': [],
            'optional_keys': []
        },
        'select': {
            'type': 'string',
            'required_keys': ['options'],
            'optional_keys': []
        },
        'multiselect': {
            'type': 'array',
            'required_keys': ['options'],
            'optional_keys': ['min_items', 'max_items']
        },
        'textarea': {
            'type': 'string',
            'required_keys': [],
            'optional_keys': ['min_length', 'max_length']
        },
        'file': {
            'type': 'string',
            'required_keys': [],
            'optional_keys': ['allowed_extensions', 'max_size_mb'],
            'format': 'uri'
        }
    }
    
    @staticmethod
    def compute_inherited_validation(field: TenantFormField) -> Dict[str, Any]:
        """
        Compute validation rules inherited from entity model field.
        
        Args:
            field: TenantFormField to compute validation for
            
        Returns:
            Dict with inherited validation rules:
            {
                'type': 'string',
                'min_length': 1,
                'max_length': 255,
                'required': True,
                'pattern': '...'
            }
        """
        if not field.inherit_from_parent:
            return {}
        
        # Get entity model
        entity_type = field.form_entity.entity_type
        try:
            model_class = FieldInheritanceService._get_model_class(entity_type)
        except ImportError:
            return {}
        
        # Get Django field
        try:
            django_field = model_class._meta.get_field(field.field_key)
        except Exception:
            return {}
        
        # Extract validation rules from Django field
        validation = {}
        
        # Required
        validation['required'] = not django_field.null and not django_field.blank
        
        # Type-specific rules
        if isinstance(django_field, models.CharField):
            validation['type'] = 'string'
            if django_field.max_length:
                validation['max_length'] = django_field.max_length
        
        elif isinstance(django_field, models.TextField):
            validation['type'] = 'string'
        
        elif isinstance(django_field, models.EmailField):
            validation['type'] = 'string'
            validation['format'] = 'email'
            validation['pattern'] = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        
        elif isinstance(django_field, models.IntegerField):
            validation['type'] = 'integer'
        
        elif isinstance(django_field, models.DecimalField):
            validation['type'] = 'number'
            validation['decimal_places'] = django_field.decimal_places
            validation['max_digits'] = django_field.max_digits
        
        elif isinstance(django_field, models.BooleanField):
            validation['type'] = 'boolean'
        
        elif isinstance(django_field, models.DateField):
            validation['type'] = 'string'
            validation['format'] = 'date'
        
        elif isinstance(django_field, models.DateTimeField):
            validation['type'] = 'string'
            validation['format'] = 'date-time'
        
        elif isinstance(django_field, models.ForeignKey):
            validation['type'] = 'string'
            validation['format'] = 'uuid'
            validation['reference_model'] = django_field.related_model.__name__
        
        # Choices (for select fields)
        if hasattr(django_field, 'choices') and django_field.choices:
            validation['options'] = [
                {'value': value, 'label': label}
                for value, label in django_field.choices
            ]
        
        return validation
    
    @staticmethod
    def validate_field_value(
        field: TenantFormField,
        value: Any
    ) -> Dict[str, Any]:
        """
        Validate a value against field's type and validation rules.
        
        Args:
            field: TenantFormField with validation rules
            value: Value to validate
            
        Returns:
            Dict with validation result:
            {
                'valid': True/False,
                'errors': ['Error message', ...]
            }
        """
        errors = []
        
        if not field.strict_type_checking:
            return {'valid': True, 'errors': []}
        
        # Get type schema
        type_schema = FieldInheritanceService.TYPE_VALIDATION_RULES.get(
            field.field_type,
            {}
        )
        
        # Merge validation rules: computed + manual + type schema
        all_rules = {
            **field.computed_validation,
            **field.validation_rules
        }
        
        # Type validation
        expected_type = type_schema.get('type')
        if expected_type == 'string' and not isinstance(value, str):
            errors.append(f"Expected string, got {type(value).__name__}")
        elif expected_type == 'number' and not isinstance(value, (int, float)):
            errors.append(f"Expected number, got {type(value).__name__}")
        elif expected_type == 'integer' and not isinstance(value, int):
            errors.append(f"Expected integer, got {type(value).__name__}")
        elif expected_type == 'boolean' and not isinstance(value, bool):
            errors.append(f"Expected boolean, got {type(value).__name__}")
        elif expected_type == 'array' and not isinstance(value, list):
            errors.append(f"Expected array, got {type(value).__name__}")
        
        # Required validation
        if all_rules.get('required') and not value:
            errors.append("This field is required")
        
        # String validations
        if isinstance(value, str):
            if 'min_length' in all_rules and len(value) < all_rules['min_length']:
                errors.append(f"Minimum length is {all_rules['min_length']}")
            if 'max_length' in all_rules and len(value) > all_rules['max_length']:
                errors.append(f"Maximum length is {all_rules['max_length']}")
            if 'pattern' in all_rules:
                import re
                if not re.match(all_rules['pattern'], value):
                    errors.append("Value does not match required pattern")
        
        # Number validations
        if isinstance(value, (int, float)):
            if 'min' in all_rules and value < all_rules['min']:
                errors.append(f"Minimum value is {all_rules['min']}")
            if 'max' in all_rules and value > all_rules['max']:
                errors.append(f"Maximum value is {all_rules['max']}")
        
        # Array validations
        if isinstance(value, list):
            if 'min_items' in all_rules and len(value) < all_rules['min_items']:
                errors.append(f"Minimum {all_rules['min_items']} items required")
            if 'max_items' in all_rules and len(value) > all_rules['max_items']:
                errors.append(f"Maximum {all_rules['max_items']} items allowed")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors
        }
    
    @staticmethod
    def sync_computed_validation(field: TenantFormField) -> None:
        """
        Update field's computed_validation from entity model.
        
        Args:
            field: TenantFormField to sync
            
        Side Effects:
            Updates field.computed_validation and saves
        """
        if field.inherit_from_parent:
            computed = FieldInheritanceService.compute_inherited_validation(field)
            field.computed_validation = computed
            field.save(update_fields=['computed_validation'])
    
    @staticmethod
    def get_effective_validation(field: TenantFormField) -> Dict[str, Any]:
        """
        Get effective validation rules (computed + manual merged).
        
        Args:
            field: TenantFormField
            
        Returns:
            Merged validation rules dict
        """
        return {
            **field.computed_validation,
            **field.validation_rules
        }
    
    @staticmethod
    def _get_model_class(entity_type: str):
        """
        Dynamically import model class from entity_type.
        
        Args:
            entity_type: Snake-case model name
            
        Returns:
            Django model class
        """
        entity_to_app = {
            'product': 'tenant_apps.products.models',
            'supplier': 'tenant_apps.suppliers.models',
            'customer': 'tenant_apps.customers.models',
            'purchase_order': 'tenant_apps.purchase_orders.models',
            'sales_order': 'tenant_apps.sales_orders.models',
            'invoice': 'tenant_apps.invoices.models',
        }
        
        if entity_type not in entity_to_app:
            raise ImportError(f"Unknown entity_type: {entity_type}")
        
        module_path = entity_to_app[entity_type]
        module = __import__(module_path, fromlist=[''])
        
        from apps.core.utils.naming import snake_to_pascal

        model_name = snake_to_pascal(entity_type)
        
        if not hasattr(module, model_name):
            raise ImportError(f"Model {model_name} not found in {module_path}")
        
        return getattr(module, model_name)
