"""
Entity introspection service for Schema Bridge.

Phase 3: Intelligent Schema Bridge
Provides entity types and field metadata from Django models.

Created: 2026-02-12
"""
from django.apps import apps
from django.db import models


ENTITY_ID_ALIASES = {
    # Cockpit/editor-friendly aliases
    'customer': 'customers.customer',
    'supplier': 'suppliers.supplier',
    'contact': 'contacts.contact',
    'purchase_order': 'purchase_orders.purchaseorder',
    'sales_order': 'sales_orders.salesorder',
    'product': 'system.product',
    'products.product': 'system.product',
    'tenant_apps.products.product': 'system.product',

    # Common UI aliases (singular/plural)
    'invoice': 'invoices.invoice',
    'invoices': 'invoices.invoice',
    'claim': 'invoices.claim',
    'claims': 'invoices.claim',

    # Hierarchy v1: Parents
    'plant': 'plants.plant',
    'plants': 'plants.plant',
    'location': 'locations.location',
    'locations': 'locations.location',
}


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
    
    # Labels must match AppConfig.label (not AppConfig.name/module path)
    app_labels = [
        'suppliers',
        'customers',
        'sales_orders',
        'purchase_orders',
        'invoices',
        'contacts',
        'inquiries',
        'fulfillments',
        'locations',
        'plants',
        # system-wide entities
        'system',
    ]
    
    for app_label in app_labels:
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
                
                # Keep IDs stable across Django app refactors.
                # - For tenant apps: emit both canonical short id (label.model) and legacy id (tenant_apps.<label>.<model>)
                # - For system: emit label.model (e.g., system.product)
                canonical_id = f"{model._meta.app_label}.{model._meta.model_name}"
                legacy_id = None
                if model._meta.app_label != 'system':
                    legacy_id = f"tenant_apps.{model._meta.app_label}.{model._meta.model_name}"

                entities.append({
                    'id': legacy_id or canonical_id,
                    'canonical_id': canonical_id,
                    'legacy_id': legacy_id,
                    'app': model._meta.app_label,
                    'model': model._meta.model_name,
                    'label': model._meta.verbose_name.title(),
                    'label_plural': model._meta.verbose_name_plural.title(),
                    'description': (model.__doc__ or '').strip().split('\n')[0],
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
        entity_id: Entity identifier (e.g., 'tenant_apps.suppliers.supplier' or 'suppliers.supplier')
        
    Returns:
        List of field definitions with metadata
    """
    try:
        resolved = ENTITY_ID_ALIASES.get(entity_id, entity_id)

        # Supported formats:
        # - tenant_apps.<app_label>.<model_name> (legacy)
        # - <app_label>.<model_name> (canonical)
        parts = resolved.split('.')
        if len(parts) == 3 and parts[0] == 'tenant_apps':
            app_label = parts[1]
            model_name = parts[2]
        elif len(parts) == 2:
            app_label = parts[0]
            model_name = parts[1]
        else:
            return []

        model = apps.get_model(app_label, model_name)
    except (ValueError, LookupError) as e:
        print(f"[Entity Introspection] Failed to get model for '{entity_id}': {e}")
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
        entity_id: Entity identifier (e.g., 'tenant_apps.suppliers.supplier' or 'suppliers.supplier')
        
    Returns:
        List of field names suitable for display
    """
    try:
        resolved = ENTITY_ID_ALIASES.get(entity_id, entity_id)

        parts = resolved.split('.')
        if len(parts) == 3 and parts[0] == 'tenant_apps':
            app_label = parts[1]
            model_name = parts[2]
        elif len(parts) == 2:
            app_label = parts[0]
            model_name = parts[1]
        else:
            return []

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
