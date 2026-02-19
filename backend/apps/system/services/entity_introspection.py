"""
Entity introspection service for Schema Bridge.

Phase 3: Intelligent Schema Bridge
Provides entity types and field metadata from Django models.

Created: 2026-02-12
"""
from django.apps import apps
from django.db import models
from django.contrib.contenttypes.models import ContentType


def get_field_type_mapping(field):
    """
    Map Django field types to form field types.
    
    Args:
        field: Django model field
        
    Returns:
        String field type (text, number, date, etc.)
    """
    field_type_map = {
        models.CharField: 'text',
        models.TextField: 'textarea',
        models.EmailField: 'email',
        models.URLField: 'url',
        models.IntegerField: 'number',
        models.BigIntegerField: 'number',
        models.SmallIntegerField: 'number',
        models.PositiveIntegerField: 'number',
        models.DecimalField: 'decimal',
        models.FloatField: 'decimal',
        models.BooleanField: 'boolean',
        models.DateField: 'date',
        models.DateTimeField: 'datetime',
        models.TimeField: 'time',
        models.ForeignKey: 'foreign_key',
        models.ManyToManyField: 'many_to_many',
        models.JSONField: 'json',
        models.FileField: 'file',
        models.ImageField: 'image',
    }
    
    for field_class, field_type in field_type_map.items():
        if isinstance(field, field_class):
            return field_type
    
    return 'text'  # Default fallback


def get_entity_models():
    """
    Get all tenant_apps models that represent business entities.
    
    Returns:
        List of dicts with entity metadata
    """
    entities = []
    
    # List of tenant_apps to scan
    # NOTE: These are namespaced under tenant_apps.* in INSTALLED_APPS
    tenant_apps = [
        'tenant_apps.suppliers',
        'tenant_apps.customers', 
        'tenant_apps.products',
        'tenant_apps.sales_orders',
        'tenant_apps.purchase_orders',
        'tenant_apps.invoices',
        'tenant_apps.carriers',
        'tenant_apps.contacts',
        'tenant_apps.inquiries',
        'tenant_apps.fulfillments',
        'tenant_apps.locations',
        'tenant_apps.plants',
    ]
    
    for app_label in tenant_apps:
        try:
            app_config = apps.get_app_config(app_label)
            
            for model in app_config.get_models():
                # Skip abstract models and through tables
                if model._meta.abstract or model._meta.auto_created:
                    continue
                
                # Get field count (exclude auto-created fields)
                field_count = len([
                    f for f in model._meta.get_fields()
                    if not f.auto_created or f.concrete
                ])
                
                # Strip tenant_apps prefix for entity ID (use just app.model format)
                # e.g., tenant_apps.suppliers -> suppliers
                short_app_label = app_label.replace('tenant_apps.', '')
                
                entities.append({
                    'id': f"{short_app_label}.{model._meta.model_name}",
                    'app': app_label,
                    'model': model._meta.model_name,
                    'label': model._meta.verbose_name.title(),
                    'label_plural': model._meta.verbose_name_plural.title(),
                    'description': model.__doc__.strip().split('\n')[0] if model.__doc__ else '',
                    'field_count': field_count,
                })
        except LookupError:
            # App not installed
            continue
    
    return sorted(entities, key=lambda x: x['label'])


def get_entity_fields(entity_id: str):
    """
    Get field metadata for a specific entity.
    
    Args:
        entity_id: Entity identifier (e.g., 'suppliers.supplier')
        
    Returns:
        List of field definitions with metadata
    """
    try:
        app_label, model_name = entity_id.split('.')
        
        # Add tenant_apps prefix if not already present
        if not app_label.startswith('tenant_apps.'):
            app_label = f'tenant_apps.{app_label}'
        
        model = apps.get_model(app_label, model_name)
    except (ValueError, LookupError):
        return []
    
    fields = []
    
    for field in model._meta.get_fields():
        # Skip auto-created reverse relations
        if field.auto_created and not field.concrete:
            continue
        
        # Skip primary key (handled automatically)
        if field.primary_key:
            continue
        
        field_data = {
            'name': field.name,
            'label': field.verbose_name.title() if hasattr(field, 'verbose_name') else field.name.replace('_', ' ').title(),
            'field_type': get_field_type_mapping(field),
            'is_required': not field.blank if hasattr(field, 'blank') else False,
            'help_text': field.help_text if hasattr(field, 'help_text') else '',
        }
        
        # Add type-specific metadata
        if isinstance(field, models.CharField):
            field_data['max_length'] = field.max_length
        
        elif isinstance(field, models.DecimalField):
            field_data['max_digits'] = field.max_digits
            field_data['decimal_places'] = field.decimal_places
        
        elif isinstance(field, (models.ForeignKey, models.ManyToManyField)):
            related_model = field.related_model
            field_data['related_entity'] = f"{related_model._meta.app_label}.{related_model._meta.model_name}"
            field_data['related_label'] = related_model._meta.verbose_name.title()
        
        elif hasattr(field, 'choices') and field.choices:
            # Extract choices
            field_data['choices'] = [
                {'value': choice[0], 'label': choice[1]}
                for choice in field.choices
            ]
        
        fields.append(field_data)
    
    return fields


def get_entity_display_fields(entity_id: str):
    """
    Get recommended display fields for an entity (for lookups).
    
    Args:
        entity_id: Entity identifier
        
    Returns:
        List of field names suitable for display
    """
    try:
        app_label, model_name = entity_id.split('.')
        
        # Add tenant_apps prefix if not already present
        if not app_label.startswith('tenant_apps.'):
            app_label = f'tenant_apps.{app_label}'
        
        model = apps.get_model(app_label, model_name)
    except (ValueError, LookupError):
        return []
    
    # Common display field patterns
    display_patterns = [
        'name',
        'title',
        'full_name',
        'company_name',
        'code',
        'number',
        'description',
    ]
    
    display_fields = []
    
    for pattern in display_patterns:
        if hasattr(model, pattern):
            display_fields.append(pattern)
    
    # Fallback: use __str__ if it's overridden
    if not display_fields and hasattr(model, '__str__'):
        # Try to determine __str__ field from common patterns
        for field in model._meta.get_fields():
            if field.name in ['name', 'title', 'code']:
                display_fields.append(field.name)
                break
    
    return display_fields or ['id']
