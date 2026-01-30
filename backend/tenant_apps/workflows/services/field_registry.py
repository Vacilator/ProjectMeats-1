"""
Field Registry Service

Maps entity types to their available fields for the form builder.
Provides metadata about fields including type, label, and validation.
"""

from django.apps import apps
from django.db import models
from typing import Dict, List, Any, Optional


# Entity type to Django model mapping
# NOTE: Keep this list updated when adding new tenant-aware models
ENTITY_MODEL_MAP = {
    # Core business entities
    'supplier': ('suppliers', 'Supplier'),
    'customer': ('customers', 'Customer'),
    'contact': ('contacts', 'Contact'),
    'carrier': ('carriers', 'Carrier'),
    'product': ('products', 'Product'),
    
    # Order management
    'purchase_order': ('purchase_orders', 'PurchaseOrder'),
    'sales_order': ('sales_orders', 'SalesOrder'),
    'invoice': ('invoices', 'Invoice'),
    
    # Inquiry & fulfillment workflow
    'inquiry': ('inquiries', 'Inquiry'),
    'fulfillment': ('fulfillments', 'Fulfillment'),
    
    # Scheduling & calls
    'scheduled_call': ('cockpit', 'ScheduledCall'),
    
    # Finance
    'accounts_receivable': ('accounts_receivables', 'AccountsReceivable'),
    
    # Infrastructure
    'plant': ('plants', 'Plant'),
    'location': ('locations', 'Location'),
}

# Fields to exclude from form builder (internal/system fields)
EXCLUDED_FIELDS = {
    'id', 'pk', 'created_on', 'modified_on', 'created_at', 'updated_at',
    'created_by', 'modified_by', 'tenant', 'custom_data', 'uuid',
}

# Django field type to form field type mapping
FIELD_TYPE_MAP = {
    'CharField': 'text',
    'TextField': 'textarea',
    'EmailField': 'email',
    'URLField': 'url',
    'IntegerField': 'number',
    'DecimalField': 'decimal',
    'FloatField': 'number',
    'BooleanField': 'checkbox',
    'NullBooleanField': 'checkbox',
    'DateField': 'date',
    'DateTimeField': 'datetime',
    'TimeField': 'time',
    'FileField': 'file',
    'ImageField': 'image',
    'ForeignKey': 'select',
    'OneToOneField': 'select',
    'ManyToManyField': 'multiselect',
    'JSONField': 'json',
    'UUIDField': 'text',
    'SlugField': 'text',
    'PositiveIntegerField': 'number',
    'PositiveSmallIntegerField': 'number',
    'BigIntegerField': 'number',
    'SmallIntegerField': 'number',
}


class FieldRegistry:
    """
    Registry service for entity field metadata.
    
    Used by the form builder to provide field selection and configuration.
    """
    
    @classmethod
    def get_entity_types(cls) -> List[Dict[str, str]]:
        """Get list of available entity types."""
        available = []
        for entity_type, (app_label, model_name) in ENTITY_MODEL_MAP.items():
            try:
                apps.get_model(app_label, model_name)
                available.append({
                    'key': entity_type,
                    'label': entity_type.replace('_', ' ').title(),
                    'app': app_label,
                    'model': model_name,
                })
            except LookupError:
                # Model not installed, skip
                continue
        return available
    
    @classmethod
    def get_model_for_entity(cls, entity_type: str) -> Optional[type]:
        """Get Django model class for an entity type."""
        if entity_type not in ENTITY_MODEL_MAP:
            return None
        
        app_label, model_name = ENTITY_MODEL_MAP[entity_type]
        try:
            return apps.get_model(app_label, model_name)
        except LookupError:
            return None
    
    @classmethod
    def get_fields_for_entity(cls, entity_type: str) -> List[Dict[str, Any]]:
        """
        Get all available fields for an entity type.
        
        Returns a list of field metadata suitable for the form builder.
        """
        model = cls.get_model_for_entity(entity_type)
        if not model:
            return []
        
        fields = []
        for field in model._meta.get_fields():
            # Skip fields without a name attribute
            if not hasattr(field, 'name'):
                continue
            
            # Skip reverse relations
            field_type = type(field).__name__
            if field_type.endswith('Rel'):
                continue
            
            # Skip non-editable fields
            if not getattr(field, 'editable', True):
                continue
            
            # Skip excluded fields
            if field.name in EXCLUDED_FIELDS:
                continue
            
            # Build field metadata
            field_meta = cls._build_field_metadata(field)
            if field_meta:
                fields.append(field_meta)
        
        # Sort by label
        fields.sort(key=lambda f: f['label'].lower())
        return fields
    
    @classmethod
    def _build_field_metadata(cls, field) -> Optional[Dict[str, Any]]:
        """Build metadata dictionary for a single field."""
        field_type = type(field).__name__
        
        # Map to form field type
        form_type = FIELD_TYPE_MAP.get(field_type, 'text')
        
        # Get field label
        verbose_name = getattr(field, 'verbose_name', field.name)
        if verbose_name:
            label = str(verbose_name).replace('_', ' ').title()
        else:
            label = field.name.replace('_', ' ').title()
        
        # Determine if required
        is_required = not getattr(field, 'blank', True) and not getattr(field, 'null', True)
        
        # Get max length for text fields
        max_length = getattr(field, 'max_length', None)
        
        # Get choices if available
        choices = getattr(field, 'choices', None)
        choice_list = None
        if choices:
            choice_list = [{'value': c[0], 'label': c[1]} for c in choices]
            form_type = 'select'  # Override to select if has choices
        
        # Get help text
        help_text = str(getattr(field, 'help_text', '') or '')
        
        # Get default value
        default = getattr(field, 'default', models.NOT_PROVIDED)
        default_value = None
        if default is not models.NOT_PROVIDED and not callable(default):
            default_value = default
        
        # Build metadata
        metadata = {
            'key': field.name,
            'label': label,
            'type': form_type,
            'django_type': field_type,
            'required': is_required,
            'help_text': help_text,
        }
        
        # Optional fields
        if max_length:
            metadata['max_length'] = max_length
        if choice_list:
            metadata['choices'] = choice_list
        if default_value is not None:
            metadata['default'] = default_value
        
        # Related model info for foreign keys
        if field_type in ('ForeignKey', 'OneToOneField', 'ManyToManyField'):
            related_model = field.related_model
            if related_model:
                metadata['related_model'] = {
                    'app': related_model._meta.app_label,
                    'model': related_model._meta.model_name,
                    'label': related_model._meta.verbose_name.title(),
                }
        
        return metadata
    
    @classmethod
    def get_field_metadata(cls, entity_type: str, field_key: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a specific field."""
        fields = cls.get_fields_for_entity(entity_type)
        for field in fields:
            if field['key'] == field_key:
                return field
        return None
    
    @classmethod
    def find_matching_fields(
        cls, 
        source_field: Dict[str, Any], 
        target_entity_type: str
    ) -> List[Dict[str, Any]]:
        """
        Find fields in target entity that match source field.
        
        Used for smart auto-population suggestions.
        Matching criteria:
        1. Exact name match (highest confidence)
        2. Similar name (contains common substring)
        3. Same type (lower confidence)
        """
        target_fields = cls.get_fields_for_entity(target_entity_type)
        matches = []
        
        source_key = source_field['key'].lower()
        source_type = source_field['type']
        
        for target in target_fields:
            target_key = target['key'].lower()
            score = 0
            match_reason = []
            
            # Exact name match
            if source_key == target_key:
                score = 100
                match_reason.append('exact_name')
            # Name contains match
            elif source_key in target_key or target_key in source_key:
                score = 70
                match_reason.append('partial_name')
            # Common suffix/prefix (e.g., supplier_email vs contact_email)
            elif cls._has_common_suffix(source_key, target_key):
                score = 60
                match_reason.append('common_suffix')
            
            # Type match bonus
            if source_type == target['type']:
                score += 20
                match_reason.append('same_type')
            
            if score > 0:
                matches.append({
                    'field': target,
                    'score': min(score, 100),
                    'reasons': match_reason,
                })
        
        # Sort by score descending
        matches.sort(key=lambda m: m['score'], reverse=True)
        return matches[:5]  # Return top 5 matches
    
    @staticmethod
    def _has_common_suffix(key1: str, key2: str) -> bool:
        """Check if two keys share a common suffix."""
        # Common field suffixes
        suffixes = ['_id', '_name', '_email', '_phone', '_address', '_date', '_type']
        for suffix in suffixes:
            if key1.endswith(suffix) and key2.endswith(suffix):
                return True
        return False


# Convenience functions
def get_entity_fields(entity_type: str) -> List[Dict[str, Any]]:
    """Get all fields for an entity type."""
    return FieldRegistry.get_fields_for_entity(entity_type)


def get_available_entities() -> List[Dict[str, str]]:
    """Get list of available entity types."""
    return FieldRegistry.get_entity_types()
