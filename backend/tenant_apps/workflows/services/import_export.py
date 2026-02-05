"""
Form Import/Export Service

Provides functionality to export forms as JSON and import them back.
Useful for sharing forms between tenants, backing up form configurations,
and duplicating complex forms.
"""

import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from django.db import transaction

from ..models import TenantForm, TenantFormEntity, TenantFormField


def export_form(form: TenantForm, include_metadata: bool = True) -> Dict[str, Any]:
    """
    Export a form configuration as a JSON-serializable dictionary.
    
    Args:
        form: The TenantForm instance to export
        include_metadata: Whether to include export metadata (version, date)
        
    Returns:
        Dictionary containing complete form configuration
    """
    export_data = {}
    
    if include_metadata:
        export_data['_metadata'] = {
            'export_version': '1.0',
            'exported_at': datetime.now().isoformat(),
            'source_form_id': str(form.id),
            'source_tenant': str(form.tenant_id) if form.tenant_id else None,
        }
    
    # Form basic info
    export_data['form'] = {
        'name': form.name,
        'description': form.description or '',
        'icon': form.icon or 'file-text',
        'entity_type': form.entity_type,
        'is_active': form.is_active,
        'is_default': form.is_default,
        'config': form.config or {},
    }
    
    # Steps (called entities in the model)
    steps = form.entities.all().order_by('order')
    export_data['steps'] = []
    
    for step in steps:
        step_data = {
            'name': step.step_name or step.entity_type,
            'entity_type': step.entity_type,
            'order': step.order,
            'fields': [],
        }
        
        # Fields within this step
        fields = step.fields.all().order_by('order')
        for field in fields:
            field_data = {
                'field_key': field.field_key,
                'field_type': field.field_type,
                'order': field.order,
                'is_visible': field.is_visible,
                'is_required': field.is_required,
                'custom_label': field.custom_label or '',
                'custom_help_text': field.custom_help_text or '',
                'default_value': field.default_value,
                'validation_rules': field.validation_rules or {},
            }
            
            # Auto-populate configuration
            if field.auto_populate_mode:
                field_data['auto_populate'] = {
                    'mode': field.auto_populate_mode,
                    'source_field': field.auto_populate_source_field,
                    'source_step_order': field.auto_populate_source_step.order if field.auto_populate_source_step else None,
                }
            
            step_data['fields'].append(field_data)
        
        export_data['steps'].append(step_data)
    
    # Conditional rules (if stored at form level)
    if hasattr(form, 'rules'):
        rules_data = []
        for rule in form.rules.all():
            rules_data.append({
                'name': rule.name,
                'config': rule.config,
            })
        if rules_data:
            export_data['rules'] = rules_data
    
    return export_data


def export_form_json(form: TenantForm, pretty: bool = True) -> str:
    """
    Export a form configuration as a JSON string.
    
    Args:
        form: The TenantForm instance to export
        pretty: Whether to format JSON with indentation
        
    Returns:
        JSON string of form configuration
    """
    data = export_form(form)
    if pretty:
        return json.dumps(data, indent=2, ensure_ascii=False)
    return json.dumps(data, ensure_ascii=False)


def validate_import_data(data: Dict[str, Any]) -> List[str]:
    """
    Validate import data structure before processing.
    
    Args:
        data: Parsed JSON data to validate
        
    Returns:
        List of validation error messages (empty if valid)
    """
    errors = []
    
    # Check required top-level keys
    if 'form' not in data:
        errors.append("Missing required 'form' section")
        return errors  # Can't continue without form section
    
    form_data = data['form']
    
    # Form required fields
    if not form_data.get('name'):
        errors.append("Form name is required")
    
    if not form_data.get('entity_type'):
        errors.append("Form entity_type is required")
    
    # Validate entity type
    valid_entity_types = [
        'inquiry', 'quote', 'order', 'invoice', 'purchase_order',
        'supplier', 'customer', 'product', 'contact', 'general'
    ]
    if form_data.get('entity_type') not in valid_entity_types:
        errors.append(f"Invalid entity_type: {form_data.get('entity_type')}. Valid types: {', '.join(valid_entity_types)}")
    
    # Validate steps
    if 'steps' in data:
        if not isinstance(data['steps'], list):
            errors.append("'steps' must be a list")
        else:
            for i, step in enumerate(data['steps']):
                if not step.get('name') and not step.get('entity_type'):
                    errors.append(f"Step {i+1}: name or entity_type is required")
                
                if 'fields' in step:
                    if not isinstance(step['fields'], list):
                        errors.append(f"Step {i+1}: 'fields' must be a list")
                    else:
                        for j, field in enumerate(step['fields']):
                            if not field.get('field_key'):
                                errors.append(f"Step {i+1}, Field {j+1}: field_key is required")
    
    return errors


def import_form(
    data: Dict[str, Any],
    tenant,
    name_suffix: str = ' (Imported)',
    created_by=None
) -> TenantForm:
    """
    Import a form from exported JSON data.
    
    Args:
        data: Parsed JSON form data
        tenant: Target tenant for the imported form
        name_suffix: Suffix to add to form name to avoid conflicts
        created_by: User who initiated the import (optional)
        
    Returns:
        Created TenantForm instance
        
    Raises:
        ValueError: If validation fails
    """
    # Validate first
    errors = validate_import_data(data)
    if errors:
        raise ValueError(f"Import validation failed: {'; '.join(errors)}")
    
    form_data = data['form']
    
    with transaction.atomic():
        # Create the form
        new_name = form_data['name']
        if name_suffix:
            new_name = f"{form_data['name']}{name_suffix}"
        
        form = TenantForm.objects.create(
            tenant=tenant,
            name=new_name,
            description=form_data.get('description', ''),
            icon=form_data.get('icon', 'file-text'),
            entity_type=form_data['entity_type'],
            is_active=form_data.get('is_active', True),
            is_default=False,  # Never import as default
            config=form_data.get('config', {}),
        )
        
        # Track step IDs for auto-populate reference resolution
        step_by_order = {}
        
        # Create steps and fields
        for step_data in data.get('steps', []):
            step = TenantFormEntity.objects.create(
                form=form,
                entity_type=step_data.get('entity_type', form_data['entity_type']),
                step_name=step_data.get('name', ''),
                order=step_data.get('order', 0),
            )
            step_by_order[step.order] = step
        
        # Second pass: create fields with auto-populate references
        for step_data in data.get('steps', []):
            step = step_by_order[step_data.get('order', 0)]
            
            for field_data in step_data.get('fields', []):
                # Resolve auto-populate reference
                auto_populate_step = None
                auto_populate_field = ''
                auto_populate_mode = ''
                
                if 'auto_populate' in field_data:
                    ap = field_data['auto_populate']
                    auto_populate_mode = ap.get('mode', '')
                    auto_populate_field = ap.get('source_field', '')
                    source_order = ap.get('source_step_order')
                    if source_order is not None and source_order in step_by_order:
                        auto_populate_step = step_by_order[source_order]
                
                TenantFormField.objects.create(
                    form_entity=step,
                    field_key=field_data['field_key'],
                    field_type=field_data.get('field_type', 'text'),
                    order=field_data.get('order', 0),
                    is_visible=field_data.get('is_visible', True),
                    is_required=field_data.get('is_required', False),
                    custom_label=field_data.get('custom_label', ''),
                    custom_help_text=field_data.get('custom_help_text', ''),
                    default_value=field_data.get('default_value'),
                    validation_rules=field_data.get('validation_rules', {}),
                    auto_populate_source_step=auto_populate_step,
                    auto_populate_source_field=auto_populate_field,
                    auto_populate_mode=auto_populate_mode,
                )
        
        # Trigger snapshot rebuild
        form.save()
        
        return form


def import_form_json(
    json_string: str,
    tenant,
    name_suffix: str = ' (Imported)',
    created_by=None
) -> TenantForm:
    """
    Import a form from a JSON string.
    
    Args:
        json_string: JSON string of form data
        tenant: Target tenant for the imported form
        name_suffix: Suffix to add to form name
        created_by: User who initiated the import
        
    Returns:
        Created TenantForm instance
        
    Raises:
        json.JSONDecodeError: If JSON parsing fails
        ValueError: If validation fails
    """
    data = json.loads(json_string)
    return import_form(data, tenant, name_suffix, created_by)


def duplicate_form(
    form: TenantForm,
    target_tenant=None,
    new_name: Optional[str] = None
) -> TenantForm:
    """
    Duplicate a form, optionally to a different tenant.
    
    Args:
        form: Source form to duplicate
        target_tenant: Target tenant (defaults to same tenant)
        new_name: New name for the duplicated form
        
    Returns:
        New TenantForm instance
    """
    export_data = export_form(form, include_metadata=False)
    
    if new_name:
        export_data['form']['name'] = new_name
        name_suffix = ''
    else:
        name_suffix = ' (Copy)'
    
    target = target_tenant or form.tenant
    
    return import_form(export_data, target, name_suffix=name_suffix)
