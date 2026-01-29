"""
Signals for the Workflows app.

Handles automatic creation of FormStepSubmission records when a FormSubmission
is created, and captures form snapshot for versioning.
"""
import logging

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import FormSubmission, FormStepSubmission, StepSubmissionStatus
from .services import FieldRegistry
from .services.field_registry import ENTITY_MODEL_MAP

logger = logging.getLogger(__name__)


def _get_entity_type_from_model(app_label: str, model_name: str) -> str:
    """
    Get the entity type key from app_label and model_name.
    Reverse lookup from ENTITY_MODEL_MAP.
    """
    if not app_label or not model_name:
        return None
    
    model_name_lower = model_name.lower()
    for entity_type, (app, model) in ENTITY_MODEL_MAP.items():
        if app == app_label and model.lower() == model_name_lower:
            return entity_type
    
    # Fallback: use model name as entity type
    return model_name_lower


@receiver(post_save, sender=FormSubmission)
def create_step_submissions(sender, instance, created, **kwargs):
    """
    Auto-create FormStepSubmission records for each step when FormSubmission is created.
    Also captures form snapshot for versioning.
    
    Wrapped in a transaction to ensure consistency.
    """
    if not created:
        return
    
    with transaction.atomic():
        # Get all steps for this form, ordered by their order field
        steps = instance.form.entities.all().order_by('order')
        
        # Create a step submission for each step
        step_submissions = []
        for step in steps:
            step_submissions.append(
                FormStepSubmission(
                    submission=instance,
                    step=step,
                    status=StepSubmissionStatus.NOT_STARTED,
                )
            )
        
        if step_submissions:
            FormStepSubmission.objects.bulk_create(step_submissions)
            
            # Set current step to the first step
            first_step = steps.first()
            if first_step and not instance.current_step:
                instance.current_step = first_step
                
                # Also mark first step as in_progress
                FormStepSubmission.objects.filter(
                    submission=instance,
                    step=first_step
                ).update(status=StepSubmissionStatus.IN_PROGRESS)
        
        # Capture form snapshot if not already set
        if not instance.form_snapshot:
            instance.form_snapshot = _build_form_snapshot(instance.form)
            instance.save(update_fields=['form_snapshot', 'current_step'])


def _build_form_snapshot(form):
    """
    Build a JSON snapshot of the form structure for versioning.
    
    This captures the form state at submission creation time so that
    changes to the form don't break in-progress submissions.
    """
    snapshot = {
        'id': str(form.id),
        'name': form.name,
        'description': form.description,
        'icon': form.icon,
        'steps': [],
        'rules': []  # Conditional rules for dynamic behavior
    }
    
    for entity in form.entities.all().order_by('order'):
        # Get field metadata for this entity type from registry
        entity_fields_meta = {}
        try:
            entity_fields = FieldRegistry.get_fields(entity.entity_type)
            for ef in entity_fields:
                entity_fields_meta[ef['key']] = ef
        except (KeyError, AttributeError) as e:
            # Expected when entity_type not in registry - use defaults
            logger.debug(f"Field registry lookup skipped for {entity.entity_type}: {e}")
        except Exception as e:
            # Unexpected error - log warning but continue
            logger.warning(f"Unexpected error getting fields for {entity.entity_type}: {e}")
        
        step_data = {
            'id': str(entity.id),
            'entity_type': entity.entity_type,
            'name': entity.step_name or entity.entity_type.replace('_', ' ').title(),
            'step_name': entity.step_name,
            'order': entity.order,
            'fields': []
        }
        
        for field in entity.fields.filter(is_visible=True).order_by('order'):
            # Get type from stored field_type (primary) or registry metadata (fallback)
            field_meta = entity_fields_meta.get(field.field_key, {})
            field_type = field.field_type if field.field_type and field.field_type != 'text' else field_meta.get('type', 'text')
            # If still 'text' but we have registry data, use that
            if field_type == 'text' and field_meta.get('type'):
                field_type = field_meta['type']
            
            # Get options from choices if available
            options = []
            if field_meta.get('choices'):
                options = field_meta['choices']
            elif field.validation_rules and field.validation_rules.get('options'):
                options = field.validation_rules['options']
            
            field_data = {
                'key': field.field_key,
                'label': field.custom_label or field_meta.get('label', field.field_key.replace('_', ' ').title()),
                'type': field_type,
                'required': field.is_required,
                'default_value': field.default_value,
                'placeholder': field.custom_help_text or field_meta.get('help_text', ''),
                'help_text': field.custom_help_text or field_meta.get('help_text', ''),
                'options': options,
                'validation_rules': field.validation_rules,
            }
            
            # Include related_model info for ForeignKey fields (for dynamic option fetching)
            if field_meta.get('related_model'):
                related = field_meta['related_model']
                field_data['related_entity_type'] = _get_entity_type_from_model(
                    related.get('app'), related.get('model')
                )
                field_data['related_model'] = related
            
            # Include auto-populate config
            if field.auto_populate_source_step:
                field_data['auto_populate'] = {
                    'source_step_id': str(field.auto_populate_source_step.id),
                    'source_field': field.auto_populate_source_field,
                    'mode': field.auto_populate_mode,
                }
            
            step_data['fields'].append(field_data)
        
        snapshot['steps'].append(step_data)
    
    # Include active conditional rules
    for rule in form.rules.filter(is_active=True).order_by('order'):
        rule_data = {
            'id': str(rule.id),
            'name': rule.name,
            'order': rule.order,
            'conditions': rule.conditions,
            'condition_logic': rule.condition_logic,
            'actions': rule.actions,
        }
        snapshot['rules'].append(rule_data)
    
    return snapshot
