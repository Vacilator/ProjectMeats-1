"""
Signals for the Workflows app.

Handles automatic creation of FormStepSubmission records when a FormSubmission
is created, and captures form snapshot for versioning.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import FormSubmission, FormStepSubmission, StepSubmissionStatus


@receiver(post_save, sender=FormSubmission)
def create_step_submissions(sender, instance, created, **kwargs):
    """
    Auto-create FormStepSubmission records for each step when FormSubmission is created.
    Also captures form snapshot for versioning.
    """
    if not created:
        return
    
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
        'steps': []
    }
    
    for entity in form.entities.all().order_by('order'):
        step_data = {
            'id': str(entity.id),
            'entity_type': entity.entity_type,
            'step_name': entity.step_name,
            'order': entity.order,
            'fields': []
        }
        
        for field in entity.fields.filter(is_visible=True).order_by('order'):
            field_data = {
                'key': field.field_key,
                'label': field.custom_label or field.field_key,
                'is_required': field.is_required,
                'default_value': field.default_value,
                'help_text': field.custom_help_text,
                'validation_rules': field.validation_rules,
            }
            
            # Include auto-populate config
            if field.auto_populate_source_step:
                field_data['auto_populate'] = {
                    'source_step_id': str(field.auto_populate_source_step.id),
                    'source_field': field.auto_populate_source_field,
                    'mode': field.auto_populate_mode,
                }
            
            step_data['fields'].append(field_data)
        
        snapshot['steps'].append(step_data)
    
    return snapshot
