"""
API ViewSets for Tenant Workflows.

Bundle Two: System → Tenant Workflows & New Data Entities
Provides REST API endpoints for Forms, Workflows, and Lists.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.views import APIView
from django.db.models import Count, Prefetch, Max
from django.utils import timezone
from django.db import transaction

from .models import (
    TenantList, TenantForm, TenantFormEntity, TenantFormField, TenantFormRule,
    TenantWorkflow, TenantWorkflowCondition, TenantWorkflowAction,
    WorkflowExecutionLog, FormStatus, WorkflowStatus
)
from .serializers import (
    TenantListSerializer,
    TenantFormSerializer, TenantFormCreateSerializer,
    TenantFormEntitySerializer, TenantFormFieldSerializer, TenantFormRuleSerializer,
    TenantWorkflowSerializer, TenantWorkflowCreateSerializer,
    TenantWorkflowConditionSerializer, TenantWorkflowActionSerializer,
    WorkflowExecutionLogSerializer
)
from .services import FieldRegistry, get_entity_fields, get_available_entities


# =============================================================================
# ADMIN FORM BUILDER API VIEWS
# =============================================================================

class EntityFieldsAPIView(APIView):
    """
    API endpoint for getting available fields for an entity type.
    Used by the form builder admin interface.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request, entity_type):
        """Get all available fields for an entity type."""
        fields = get_entity_fields(entity_type)
        if not fields:
            return Response(
                {'error': f'Unknown entity type: {entity_type}'},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response({
            'entity_type': entity_type,
            'fields': fields,
            'count': len(fields),
        })


class AvailableEntitiesAPIView(APIView):
    """
    API endpoint for getting available entity types.
    Used by the form builder admin interface.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request):
        """Get all available entity types."""
        entities = get_available_entities()
        return Response({
            'entities': entities,
            'count': len(entities),
        })


class FormStepFieldsAPIView(APIView):
    """
    API endpoint for managing fields in a form step (TenantFormEntity).
    Used by the form builder admin interface.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request, step_id):
        """Get selected and available fields for a form step."""
        try:
            step = TenantFormEntity.objects.select_related('form').get(pk=step_id)
        except TenantFormEntity.DoesNotExist:
            return Response(
                {'error': 'Form step not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get available fields for this entity type
        available_fields = get_entity_fields(step.entity_type)
        
        # Get currently selected fields
        selected = step.fields.all().order_by('order')
        selected_keys = {f.field_key for f in selected}
        
        selected_fields = []
        for field in selected:
            # Find matching field metadata
            field_meta = next(
                (f for f in available_fields if f['key'] == field.field_key),
                None
            )
            selected_fields.append({
                'id': str(field.id),
                'key': field.field_key,
                'label': field.custom_label or (field_meta['label'] if field_meta else field.field_key),
                'type': field_meta['type'] if field_meta else 'text',
                'required': field.is_required,
                'visible': field.is_visible,
                'order': field.order,
                'help_text': field.custom_help_text,
                # Phase 3: Include auto-populate indicator
                'hasAutoPopulate': bool(field.auto_populate_source_step and field.auto_populate_source_field),
                'autoPopulateSource': (
                    f"{field.auto_populate_source_step.step_name or field.auto_populate_source_step.entity_type}.{field.auto_populate_source_field}"
                    if field.auto_populate_source_step else None
                ),
            })
        
        # Mark which available fields are already selected
        for field in available_fields:
            field['selected'] = field['key'] in selected_keys
        
        return Response({
            'step_id': str(step_id),
            'step_name': step.step_name or step.entity_type.replace('_', ' ').title(),
            'entity_type': step.entity_type,
            'selected_fields': selected_fields,
            'available_fields': available_fields,
        })
    
    def post(self, request, step_id):
        """Save field selection for a form step."""
        try:
            step = TenantFormEntity.objects.get(pk=step_id)
        except TenantFormEntity.DoesNotExist:
            return Response(
                {'error': 'Form step not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        fields_data = request.data.get('fields', [])
        
        with transaction.atomic():
            # Delete existing fields
            step.fields.all().delete()
            
            # Create new fields in order
            for order, field_data in enumerate(fields_data):
                TenantFormField.objects.create(
                    form_entity=step,
                    field_key=field_data['key'],
                    is_visible=field_data.get('visible', True),
                    is_required=field_data.get('required', False),
                    order=order,
                    custom_label=field_data.get('custom_label', ''),
                    custom_help_text=field_data.get('help_text', ''),
                )
        
        return Response({
            'status': 'success',
            'message': f'Saved {len(fields_data)} fields',
            'step_id': str(step_id),
        })


class FormStepReorderAPIView(APIView):
    """
    API endpoint for reordering form steps.
    Used by the form builder admin interface for drag-drop.
    """
    permission_classes = [IsAdminUser]
    
    def post(self, request, form_id):
        """Reorder steps in a form."""
        try:
            form = TenantForm.objects.get(pk=form_id)
        except TenantForm.DoesNotExist:
            return Response(
                {'error': 'Form not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        step_order = request.data.get('step_order', [])
        
        with transaction.atomic():
            for order, step_id in enumerate(step_order):
                TenantFormEntity.objects.filter(
                    id=step_id,
                    form=form
                ).update(order=order)
        
        return Response({
            'status': 'success',
            'message': f'Reordered {len(step_order)} steps',
        })


class FormStepsAPIView(APIView):
    """
    API endpoint for managing form steps (create/delete).
    Used by the form builder admin interface.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request, form_id):
        """Get all steps for a form."""
        try:
            form = TenantForm.objects.get(pk=form_id)
        except TenantForm.DoesNotExist:
            return Response(
                {'error': 'Form not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        steps = form.entities.all().order_by('order')
        steps_data = [{
            'id': str(step.id),
            'entity_type': step.entity_type,
            'step_name': step.step_name or '',
            'order': step.order,
            'field_count': step.fields.count()
        } for step in steps]
        
        return Response({
            'form_id': str(form_id),
            'form_name': form.name,
            'steps': steps_data,
            'count': len(steps_data)
        })
    
    def post(self, request, form_id):
        """Create a new step for a form."""
        try:
            form = TenantForm.objects.get(pk=form_id)
        except TenantForm.DoesNotExist:
            return Response(
                {'error': 'Form not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        entity_type = request.data.get('entity_type')
        step_name = request.data.get('step_name', '')
        
        if not entity_type:
            return Response(
                {'error': 'entity_type is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get the next order number
        max_order = form.entities.aggregate(Max('order'))['order__max']
        next_order = 0 if max_order is None else max_order + 1
        
        # Create the step
        step = TenantFormEntity.objects.create(
            form=form,
            entity_type=entity_type,
            step_name=step_name,
            order=next_order
        )
        
        return Response({
            'status': 'success',
            'message': 'Step created',
            'step': {
                'id': str(step.id),
                'entity_type': step.entity_type,
                'step_name': step.step_name or '',
                'order': step.order,
                'field_count': 0
            }
        }, status=status.HTTP_201_CREATED)


class FormStepDetailAPIView(APIView):
    """
    API endpoint for managing individual form steps (get/update/delete).
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request, step_id):
        """Get a single step."""
        try:
            step = TenantFormEntity.objects.get(pk=step_id)
        except TenantFormEntity.DoesNotExist:
            return Response(
                {'error': 'Step not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        return Response({
            'id': str(step.id),
            'form_id': str(step.form_id),
            'entity_type': step.entity_type,
            'step_name': step.step_name or '',
            'order': step.order,
            'field_count': step.fields.count()
        })
    
    def put(self, request, step_id):
        """Update a step."""
        try:
            step = TenantFormEntity.objects.get(pk=step_id)
        except TenantFormEntity.DoesNotExist:
            return Response(
                {'error': 'Step not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update allowed fields
        if 'entity_type' in request.data:
            step.entity_type = request.data['entity_type']
        if 'step_name' in request.data:
            step.step_name = request.data['step_name']
        if 'order' in request.data:
            step.order = request.data['order']
        
        step.save()
        
        return Response({
            'status': 'success',
            'message': 'Step updated',
            'step': {
                'id': str(step.id),
                'entity_type': step.entity_type,
                'step_name': step.step_name or '',
                'order': step.order
            }
        })
    
    def delete(self, request, step_id):
        """Delete a step."""
        try:
            step = TenantFormEntity.objects.get(pk=step_id)
        except TenantFormEntity.DoesNotExist:
            return Response(
                {'error': 'Step not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        step.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)

class SmartFieldMatchAPIView(APIView):
    """
    API endpoint for smart field matching suggestions.
    Used by the auto-populate configuration in form builder.
    """
    permission_classes = [IsAdminUser]
    
    def post(self, request):
        """
        Find matching fields for auto-population.
        
        Request body:
        {
            "source_field": {"key": "email", "type": "email"},
            "target_entity_type": "contact"
        }
        """
        source_field = request.data.get('source_field')
        target_entity_type = request.data.get('target_entity_type')
        
        if not source_field or not target_entity_type:
            return Response(
                {'error': 'source_field and target_entity_type are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        matches = FieldRegistry.find_matching_fields(source_field, target_entity_type)
        
        return Response({
            'source_field': source_field,
            'target_entity_type': target_entity_type,
            'matches': matches,
        })


class FieldConfigAPIView(APIView):
    """
    API endpoint for configuring individual field settings.
    Used by the field configuration modal in form builder.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request, field_id):
        """Get field configuration including auto-populate settings."""
        try:
            field = TenantFormField.objects.select_related(
                'form_entity', 
                'form_entity__form',
                'auto_populate_source_step'
            ).get(pk=field_id)
        except TenantFormField.DoesNotExist:
            return Response(
                {'error': 'Field not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get available source steps (all steps before this field's step)
        current_step = field.form_entity
        form = current_step.form
        available_source_steps = []
        
        for step in form.entities.filter(order__lt=current_step.order).order_by('order'):
            step_fields = get_entity_fields(step.entity_type)
            available_source_steps.append({
                'id': str(step.id),
                'name': step.step_name or step.entity_type.replace('_', ' ').title(),
                'entity_type': step.entity_type,
                'order': step.order,
                'fields': step_fields,
            })
        
        # Get smart match suggestions if there are source steps
        suggestions = []
        if available_source_steps:
            # Get this field's metadata
            field_meta = next(
                (f for f in get_entity_fields(current_step.entity_type) 
                 if f['key'] == field.field_key),
                {'key': field.field_key, 'type': 'text'}
            )
            
            # Find matches in all prior steps
            for source_step in available_source_steps:
                matches = FieldRegistry.find_matching_fields(
                    field_meta, 
                    source_step['entity_type']
                )
                for match in matches[:3]:  # Top 3 matches per step
                    suggestions.append({
                        'source_step_id': source_step['id'],
                        'source_step_name': source_step['name'],
                        'source_field_key': match['field']['key'],
                        'source_field_label': match['field']['label'],
                        'score': match['score'],
                        'reasons': match['reasons'],
                    })
            
            # Sort by score descending
            suggestions.sort(key=lambda x: x['score'], reverse=True)
        
        return Response({
            'field_id': str(field_id),
            'field_key': field.field_key,
            'custom_label': field.custom_label,
            'custom_help_text': field.custom_help_text,
            'is_required': field.is_required,
            'is_visible': field.is_visible,
            'default_value': field.default_value,
            'auto_populate': {
                'source_step': str(field.auto_populate_source_step.id) if field.auto_populate_source_step else None,
                'source_step_name': (field.auto_populate_source_step.step_name or field.auto_populate_source_step.entity_type) if field.auto_populate_source_step else None,
                'source_field': field.auto_populate_source_field,
                'mode': field.auto_populate_mode,
            },
            'available_source_steps': available_source_steps,
            'suggestions': suggestions[:5],  # Top 5 suggestions overall
        })
    
    def post(self, request, field_id):
        """Update field configuration including auto-populate settings."""
        try:
            field = TenantFormField.objects.get(pk=field_id)
        except TenantFormField.DoesNotExist:
            return Response(
                {'error': 'Field not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update basic settings
        if 'custom_label' in request.data:
            field.custom_label = request.data['custom_label']
        if 'custom_help_text' in request.data:
            field.custom_help_text = request.data['custom_help_text']
        if 'is_required' in request.data:
            field.is_required = request.data['is_required']
        if 'is_visible' in request.data:
            field.is_visible = request.data['is_visible']
        if 'default_value' in request.data:
            field.default_value = request.data['default_value']
        
        # Update auto-populate settings
        auto_populate = request.data.get('auto_populate', {})
        if auto_populate:
            source_step_id = auto_populate.get('source_step')
            if source_step_id:
                try:
                    source_step = TenantFormEntity.objects.get(pk=source_step_id)
                    field.auto_populate_source_step = source_step
                except TenantFormEntity.DoesNotExist:
                    pass
            else:
                field.auto_populate_source_step = None
            
            field.auto_populate_source_field = auto_populate.get('source_field', '')
            field.auto_populate_mode = auto_populate.get('mode', '')
        
        field.save()
        
        return Response({
            'status': 'success',
            'message': 'Field configuration saved',
            'field_id': str(field_id),
        })
    
    # Allow PUT as an alias for POST (RESTful convention)
    def put(self, request, field_id):
        return self.post(request, field_id)


class FormMappingsAPIView(APIView):
    """
    API endpoint for managing field mappings in a form.
    Used by the Field Mappings section in the form builder admin interface.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request, form_id):
        """Get all field mappings for a form."""
        from .services import FieldMappingService
        
        try:
            form = TenantForm.objects.prefetch_related('entities').get(pk=form_id)
        except TenantForm.DoesNotExist:
            return Response(
                {'error': 'Form not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        mappings = FieldMappingService.get_current_mappings(form)
        
        # Get step info for context
        steps_data = []
        for step in form.entities.all().order_by('order'):
            steps_data.append({
                'id': str(step.id),
                'name': step.step_name or step.entity_type.replace('_', ' ').title(),
                'entity_type': step.entity_type,
                'order': step.order,
            })
        
        return Response({
            'form_id': str(form_id),
            'form_name': form.name,
            'steps': steps_data,
            'mappings': mappings,
            'count': len(mappings)
        })


class FormAutoMapAPIView(APIView):
    """
    API endpoint for computing and applying auto-mappings.
    Uses fuzzy matching to suggest field mappings between steps.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request, form_id):
        """Compute auto-mapping suggestions without applying them."""
        from .services import FieldMappingService
        
        try:
            form = TenantForm.objects.prefetch_related('entities').get(pk=form_id)
        except TenantForm.DoesNotExist:
            return Response(
                {'error': 'Form not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        min_score = float(request.query_params.get('min_score', 50.0))
        suggestions = FieldMappingService.compute_auto_mappings(form, min_score)
        
        return Response({
            'form_id': str(form_id),
            'suggestions': suggestions,
            'count': len(suggestions)
        })
    
    def post(self, request, form_id):
        """Apply auto-mappings (either suggested or provided)."""
        from .services import FieldMappingService
        
        try:
            form = TenantForm.objects.prefetch_related('entities').get(pk=form_id)
        except TenantForm.DoesNotExist:
            return Response(
                {'error': 'Form not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # If mappings are provided, use those; otherwise compute them
        mappings = request.data.get('mappings')
        if not mappings:
            min_score = float(request.data.get('min_score', 50.0))
            mappings = FieldMappingService.compute_auto_mappings(form, min_score)
        
        result = FieldMappingService.apply_auto_mappings(form, mappings)
        
        return Response({
            'status': 'success',
            'applied': result['applied'],
            'errors': result['errors'],
            'message': f"Applied {result['applied']} field mappings"
        })


class FieldMappingAPIView(APIView):
    """
    API endpoint for managing a single field's mapping.
    """
    permission_classes = [IsAdminUser]
    
    def put(self, request, field_id):
        """Update a field's mapping."""
        from .services import FieldMappingService
        
        try:
            field = TenantFormField.objects.get(pk=field_id)
        except TenantFormField.DoesNotExist:
            return Response(
                {'error': 'Field not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        source_step_id = request.data.get('source_step_id')
        source_field_key = request.data.get('source_field_key')
        mode = request.data.get('mode', 'copy')
        
        if source_step_id and source_field_key:
            success = FieldMappingService.apply_mapping(
                field, source_step_id, source_field_key, mode
            )
            if success:
                return Response({
                    'status': 'success',
                    'message': 'Mapping applied'
                })
            else:
                return Response(
                    {'error': 'Failed to apply mapping'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            return Response(
                {'error': 'source_step_id and source_field_key are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def delete(self, request, field_id):
        """Remove a field's mapping."""
        from .services import FieldMappingService
        
        try:
            field = TenantFormField.objects.get(pk=field_id)
        except TenantFormField.DoesNotExist:
            return Response(
                {'error': 'Field not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        FieldMappingService.remove_mapping(field)
        
        return Response({
            'status': 'success',
            'message': 'Mapping removed'
        })


class FormRulesAPIView(APIView):
    """
    API endpoint for managing form conditional rules.
    Used by the rule builder in the form builder admin interface.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request, form_id):
        """Get all rules for a form with step/field context."""
        try:
            form = TenantForm.objects.prefetch_related('entities', 'rules').get(pk=form_id)
        except TenantForm.DoesNotExist:
            return Response(
                {'error': 'Form not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get all steps with their fields for condition/action selection
        steps_data = []
        for step in form.entities.all().order_by('order'):
            fields = get_entity_fields(step.entity_type)
            steps_data.append({
                'id': str(step.id),
                'name': step.step_name or step.entity_type.replace('_', ' ').title(),
                'entity_type': step.entity_type,
                'order': step.order,
                'fields': fields,
            })
        
        # Get existing rules
        rules_data = []
        for rule in form.rules.all().order_by('order'):
            rules_data.append({
                'id': str(rule.id),
                'name': rule.name,
                'is_active': rule.is_active,
                'order': rule.order,
                'conditions': rule.conditions,
                'condition_logic': rule.condition_logic,
                'actions': rule.actions,
            })
        
        return Response({
            'form_id': str(form_id),
            'form_name': form.name,
            'steps': steps_data,
            'rules': rules_data,
        })
    
    def post(self, request, form_id):
        """Create a new rule for a form."""
        try:
            form = TenantForm.objects.get(pk=form_id)
        except TenantForm.DoesNotExist:
            return Response(
                {'error': 'Form not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get next order (handle None when no rules exist, but 0 is valid)
        max_order = form.rules.aggregate(max_order=Max('order'))['max_order']
        next_order = 0 if max_order is None else max_order + 1
        
        rule = TenantFormRule.objects.create(
            form=form,
            name=request.data.get('name', ''),
            is_active=request.data.get('is_active', True),
            order=next_order,
            conditions=request.data.get('conditions', []),
            condition_logic=request.data.get('condition_logic', 'and'),
            actions=request.data.get('actions', []),
        )
        
        return Response({
            'status': 'success',
            'message': 'Rule created',
            'rule_id': str(rule.id),
            'order': rule.order,
        }, status=status.HTTP_201_CREATED)


class FormRuleDetailAPIView(APIView):
    """
    API endpoint for managing individual form rules.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request, rule_id):
        """Get a single rule."""
        try:
            rule = TenantFormRule.objects.select_related('form').get(pk=rule_id)
        except TenantFormRule.DoesNotExist:
            return Response(
                {'error': 'Rule not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        return Response({
            'id': str(rule.id),
            'form_id': str(rule.form.id),
            'name': rule.name,
            'is_active': rule.is_active,
            'order': rule.order,
            'conditions': rule.conditions,
            'condition_logic': rule.condition_logic,
            'actions': rule.actions,
        })
    
    def put(self, request, rule_id):
        """Update a rule."""
        try:
            rule = TenantFormRule.objects.get(pk=rule_id)
        except TenantFormRule.DoesNotExist:
            return Response(
                {'error': 'Rule not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if 'name' in request.data:
            rule.name = request.data['name']
        if 'is_active' in request.data:
            rule.is_active = request.data['is_active']
        if 'conditions' in request.data:
            rule.conditions = request.data['conditions']
        if 'condition_logic' in request.data:
            rule.condition_logic = request.data['condition_logic']
        if 'actions' in request.data:
            rule.actions = request.data['actions']
        
        rule.save()
        
        return Response({
            'status': 'success',
            'message': 'Rule updated',
            'rule_id': str(rule_id),
        })
    
    def delete(self, request, rule_id):
        """Delete a rule."""
        try:
            rule = TenantFormRule.objects.get(pk=rule_id)
        except TenantFormRule.DoesNotExist:
            return Response(
                {'error': 'Rule not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        rule.delete()
        
        return Response({
            'status': 'success',
            'message': 'Rule deleted',
        })


class TenantFilteredModelViewSet(viewsets.ModelViewSet):
    """Base ViewSet that filters by tenant."""
    
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter queryset by current tenant."""
        qs = super().get_queryset()
        if hasattr(self.request, 'tenant') and self.request.tenant:
            return qs.filter(tenant=self.request.tenant)
        return qs.none()
    
    def perform_create(self, serializer):
        """Set tenant and created_by on create."""
        save_kwargs = {}
        if hasattr(self.request, 'tenant') and self.request.tenant:
            save_kwargs['tenant'] = self.request.tenant
        if hasattr(serializer.Meta.model, 'created_by'):
            save_kwargs['created_by'] = self.request.user
        serializer.save(**save_kwargs)


# =============================================================================
# TENANT LIST VIEWS
# =============================================================================

class TenantListViewSet(TenantFilteredModelViewSet):
    """
    API endpoint for Tenant Lists.
    
    Tenant-specific option lists for dropdown/multi-select fields.
    """
    
    queryset = TenantList.objects.all()
    serializer_class = TenantListSerializer
    
    def get_queryset(self):
        qs = super().get_queryset()
        
        # Filter by active status
        if self.request.query_params.get('active_only'):
            qs = qs.filter(is_active=True)
        
        return qs.order_by('name')
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """Search lists by name."""
        query = request.query_params.get('q', '')
        qs = self.get_queryset().filter(name__icontains=query)[:20]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


# =============================================================================
# TENANT FORM VIEWS
# =============================================================================

class TenantFormViewSet(TenantFilteredModelViewSet):
    """
    API endpoint for Tenant Forms.
    
    Custom forms that tenants can create for entity record creation/editing.
    """
    
    queryset = TenantForm.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TenantFormCreateSerializer
        return TenantFormSerializer
    
    def get_queryset(self):
        qs = super().get_queryset()
        
        # Prefetch related data for efficiency
        qs = qs.prefetch_related(
            Prefetch('entities', queryset=TenantFormEntity.objects.order_by('order')),
            Prefetch('rules', queryset=TenantFormRule.objects.order_by('order')),
        ).annotate(_entity_count=Count('entities'))
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        
        # Filter by entity type (for finding forms that include a specific entity)
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            qs = qs.filter(entities__entity_type=entity_type).distinct()
        
        # Filter for default forms only
        if self.request.query_params.get('default_only'):
            qs = qs.filter(is_default=True)
        
        return qs.order_by('-is_default', 'name')
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a form."""
        form = self.get_object()
        form.status = FormStatus.ACTIVE
        form.save(update_fields=['status', 'updated_at'])
        return Response({'status': 'activated'})
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a form."""
        form = self.get_object()
        form.status = FormStatus.INACTIVE
        form.save(update_fields=['status', 'updated_at'])
        return Response({'status': 'deactivated'})
    
    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """Set a form as the default for its entity type."""
        form = self.get_object()
        
        # Only single-entity forms can be default
        if form.entities.count() != 1:
            return Response(
                {'error': 'Only single-entity forms can be set as default'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        entity_type = form.entities.first().entity_type
        
        # Clear other defaults for this entity type
        TenantForm.objects.filter(
            tenant=request.tenant,
            is_default=True,
            entities__entity_type=entity_type
        ).update(is_default=False)
        
        form.is_default = True
        form.save(update_fields=['is_default', 'updated_at'])
        
        return Response({'status': 'set_as_default', 'entity_type': entity_type})
    
    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """Get form structure for preview/rendering."""
        form = self.get_object()
        
        # Build form structure with ordered entities and fields
        entities_data = []
        for entity in form.entities.order_by('order'):
            fields_data = []
            for field in entity.fields.filter(is_visible=True).order_by('order'):
                fields_data.append({
                    'key': field.field_key,
                    'label': field.custom_label,
                    'help_text': field.custom_help_text,
                    'required': field.is_required,
                    'default_value': field.default_value,
                })
            
            entities_data.append({
                'entity_type': entity.entity_type,
                'step_name': entity.step_name or entity.entity_type.title(),
                'fields': fields_data,
            })
        
        # Get active rules
        rules_data = []
        for rule in form.rules.filter(is_active=True).order_by('order'):
            rules_data.append({
                'name': rule.name,
                'conditions': rule.conditions,
                'condition_logic': rule.condition_logic,
                'actions': rule.actions,
            })
        
        return Response({
            'id': form.id,
            'name': form.name,
            'description': form.description,
            'is_multi_step': len(entities_data) > 1,
            'entities': entities_data,
            'rules': rules_data,
        })


class TenantFormEntityViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Form Entities (steps in multi-step forms).
    """
    
    queryset = TenantFormEntity.objects.all()
    serializer_class = TenantFormEntitySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(self.request, 'tenant') and self.request.tenant:
            qs = qs.filter(form__tenant=self.request.tenant)
        
        # Filter by form
        form_id = self.request.query_params.get('form')
        if form_id:
            qs = qs.filter(form_id=form_id)
        
        return qs.prefetch_related(
            Prefetch('fields', queryset=TenantFormField.objects.order_by('order'))
        ).order_by('order')
    
    @action(detail=True, methods=['post'])
    def reorder_fields(self, request, pk=None):
        """Reorder fields within an entity."""
        entity = self.get_object()
        field_order = request.data.get('field_order', [])  # List of field IDs in order
        
        for index, field_id in enumerate(field_order):
            TenantFormField.objects.filter(
                id=field_id, 
                form_entity=entity
            ).update(order=index)
        
        return Response({'status': 'reordered'})


class TenantFormFieldViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Form Fields.
    """
    
    queryset = TenantFormField.objects.all()
    serializer_class = TenantFormFieldSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(self.request, 'tenant') and self.request.tenant:
            qs = qs.filter(form_entity__form__tenant=self.request.tenant)
        
        # Filter by entity
        entity_id = self.request.query_params.get('entity')
        if entity_id:
            qs = qs.filter(form_entity_id=entity_id)
        
        return qs.order_by('order')


class TenantFormRuleViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Form Rules (conditional logic).
    """
    
    queryset = TenantFormRule.objects.all()
    serializer_class = TenantFormRuleSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(self.request, 'tenant') and self.request.tenant:
            qs = qs.filter(form__tenant=self.request.tenant)
        
        # Filter by form
        form_id = self.request.query_params.get('form')
        if form_id:
            qs = qs.filter(form_id=form_id)
        
        return qs.order_by('order')


# =============================================================================
# TENANT WORKFLOW VIEWS
# =============================================================================

class TenantWorkflowViewSet(TenantFilteredModelViewSet):
    """
    API endpoint for Tenant Workflows.
    
    Automation rules with triggers and actions.
    """
    
    queryset = TenantWorkflow.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TenantWorkflowCreateSerializer
        return TenantWorkflowSerializer
    
    def get_queryset(self):
        qs = super().get_queryset()
        
        # Prefetch related data
        qs = qs.prefetch_related(
            Prefetch('conditions', queryset=TenantWorkflowCondition.objects.order_by('order')),
            Prefetch('actions', queryset=TenantWorkflowAction.objects.order_by('order')),
        )
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        
        # Filter by trigger type
        trigger_type = self.request.query_params.get('trigger_type')
        if trigger_type:
            qs = qs.filter(trigger_type=trigger_type)
        
        # Filter by entity type
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        
        return qs.order_by('name')
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a workflow."""
        workflow = self.get_object()
        workflow.status = WorkflowStatus.ACTIVE
        workflow.save(update_fields=['status', 'updated_at'])
        return Response({'status': 'activated'})
    
    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        """Pause a workflow."""
        workflow = self.get_object()
        workflow.status = WorkflowStatus.PAUSED
        workflow.save(update_fields=['status', 'updated_at'])
        return Response({'status': 'paused'})
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a workflow."""
        workflow = self.get_object()
        workflow.status = WorkflowStatus.INACTIVE
        workflow.save(update_fields=['status', 'updated_at'])
        return Response({'status': 'deactivated'})
    
    @action(detail=True, methods=['post'])
    def run(self, request, pk=None):
        """Manually run a workflow."""
        workflow = self.get_object()
        
        if workflow.status != WorkflowStatus.ACTIVE:
            return Response(
                {'error': 'Workflow must be active to run'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create execution log
        log = WorkflowExecutionLog.objects.create(
            workflow=workflow,
            trigger_type='manual',
            trigger_data={'triggered_by': request.user.id},
            triggered_by=request.user,
            status='started'
        )
        
        # TODO: Integrate with workflow execution engine
        # For now, just mark as success
        log.status = 'success'
        log.completed_at = timezone.now()
        log.save()
        
        # Update workflow stats
        workflow.run_count += 1
        workflow.last_run_at = timezone.now()
        workflow.save(update_fields=['run_count', 'last_run_at'])
        
        return Response({
            'status': 'executed',
            'execution_id': str(log.id)
        })
    
    @action(detail=True, methods=['get'])
    def logs(self, request, pk=None):
        """Get execution logs for a workflow."""
        workflow = self.get_object()
        logs = WorkflowExecutionLog.objects.filter(workflow=workflow).order_by('-started_at')[:50]
        serializer = WorkflowExecutionLogSerializer(logs, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def active_for_entity(self, request):
        """
        Get active workflows that should be triggered for a specific entity event.
        
        Query params:
        - entity_type: The type of entity (e.g., 'customer', 'supplier')
        - trigger: The trigger type (e.g., 'record_created', 'record_updated')
        """
        entity_type = request.query_params.get('entity_type')
        trigger = request.query_params.get('trigger')
        
        if not entity_type or not trigger:
            return Response(
                {'error': 'entity_type and trigger are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        workflows = self.get_queryset().filter(
            status=WorkflowStatus.ACTIVE,
            entity_type=entity_type,
            trigger_type=trigger
        )
        
        serializer = self.get_serializer(workflows, many=True)
        return Response(serializer.data)


class TenantWorkflowConditionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Workflow Conditions.
    """
    
    queryset = TenantWorkflowCondition.objects.all()
    serializer_class = TenantWorkflowConditionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(self.request, 'tenant') and self.request.tenant:
            qs = qs.filter(workflow__tenant=self.request.tenant)
        
        workflow_id = self.request.query_params.get('workflow')
        if workflow_id:
            qs = qs.filter(workflow_id=workflow_id)
        
        return qs.order_by('order')


class TenantWorkflowActionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for Workflow Actions.
    """
    
    queryset = TenantWorkflowAction.objects.all()
    serializer_class = TenantWorkflowActionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(self.request, 'tenant') and self.request.tenant:
            qs = qs.filter(workflow__tenant=self.request.tenant)
        
        workflow_id = self.request.query_params.get('workflow')
        if workflow_id:
            qs = qs.filter(workflow_id=workflow_id)
        
        return qs.order_by('order')


class WorkflowExecutionLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing Workflow Execution Logs.
    
    Read-only - logs are created by the workflow engine.
    """
    
    queryset = WorkflowExecutionLog.objects.all()
    serializer_class = WorkflowExecutionLogSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(self.request, 'tenant') and self.request.tenant:
            qs = qs.filter(workflow__tenant=self.request.tenant)
        
        # Filter by workflow
        workflow_id = self.request.query_params.get('workflow')
        if workflow_id:
            qs = qs.filter(workflow_id=workflow_id)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        
        return qs.select_related('workflow', 'triggered_by').order_by('-started_at')


# =============================================================================
# FORM SUBMISSION API VIEWS
# =============================================================================

from .models import FormSubmission, FormStepSubmission, FormSubmissionStatus, StepSubmissionStatus
from .serializers import (
    FormSubmissionListSerializer, FormSubmissionDetailSerializer,
    FormSubmissionCreateSerializer, FormSubmissionAutoSaveSerializer,
    FormStepSubmissionSerializer, AvailableFormSerializer,
    QuickActionsSerializer
)


class FormSubmissionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing form submissions.
    
    Endpoints:
    - GET /form-submissions/ - List user's submissions
    - POST /form-submissions/ - Create new submission
    - GET /form-submissions/{id}/ - Get submission details
    - PATCH /form-submissions/{id}/ - Update submission
    - DELETE /form-submissions/{id}/ - Cancel/delete submission
    - POST /form-submissions/{id}/auto-save/ - Auto-save field value
    - POST /form-submissions/{id}/complete-step/ - Mark step as complete
    - POST /form-submissions/{id}/submit/ - Final submission
    """
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return FormSubmissionListSerializer
        elif self.action == 'create':
            return FormSubmissionCreateSerializer
        return FormSubmissionDetailSerializer
    
    def create(self, request, *args, **kwargs):
        """
        Override create to return full submission details.
        Uses CreateSerializer for input validation, DetailSerializer for response.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        
        # Refresh with prefetched relations for detail response
        instance = FormSubmission.objects.select_related(
            'form', 'created_by', 'current_step'
        ).prefetch_related(
            'step_submissions__step',
            'step_submissions__completed_by'
        ).get(pk=instance.pk)
        
        # Return full details
        detail_serializer = FormSubmissionDetailSerializer(
            instance, context=self.get_serializer_context()
        )
        headers = self.get_success_headers(detail_serializer.data)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def get_queryset(self):
        qs = FormSubmission.objects.filter(tenant=self.request.tenant)
        
        # Non-admin users only see their own submissions
        if not self.request.user.is_staff:
            qs = qs.filter(created_by=self.request.user)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        
        # Filter by form
        form_id = self.request.query_params.get('form')
        if form_id:
            qs = qs.filter(form_id=form_id)
        
        return qs.select_related('form', 'created_by', 'current_step').prefetch_related(
            'step_submissions__step',
            'step_submissions__completed_by'
        )
    
    @action(detail=True, methods=['post'])
    def auto_save(self, request, pk=None):
        """Auto-save a single field value."""
        submission = self.get_object()
        
        # Explicit tenant check for security
        request_tenant = getattr(request, 'tenant', None)
        if not request_tenant or submission.tenant_id != request_tenant.id:
            return Response(
                {'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check submission is editable
        if submission.status in [FormSubmissionStatus.COMPLETED, FormSubmissionStatus.CANCELLED]:
            return Response(
                {'error': 'Cannot modify a completed or cancelled submission'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = FormSubmissionAutoSaveSerializer(
            data=request.data,
            context={'request': request, 'submission': submission}
        )
        serializer.is_valid(raise_exception=True)
        
        step_id = str(serializer.validated_data['step_id'])
        field_key = serializer.validated_data['field_key']
        value = serializer.validated_data['value']
        
        # Use transaction for atomicity
        with transaction.atomic():
            # Update data structure
            if step_id not in submission.data:
                submission.data[step_id] = {}
            
            submission.data[step_id][field_key] = value
            submission.data[step_id]['_meta'] = {
                'last_updated': timezone.now().isoformat(),
                'updated_by': str(request.user.id)
            }
            
            # Update status to in_progress if draft
            if submission.status == FormSubmissionStatus.DRAFT:
                submission.status = FormSubmissionStatus.IN_PROGRESS
            
            submission.save(update_fields=['data', 'status', 'updated_at'])
            
            # Update step submission status
            step_submission = submission.step_submissions.filter(step_id=step_id).first()
            if step_submission and step_submission.status == StepSubmissionStatus.NOT_STARTED:
                step_submission.status = StepSubmissionStatus.IN_PROGRESS
                step_submission.save(update_fields=['status', 'updated_at'])
        
        return Response({
            'success': True,
            'step_id': step_id,
            'field_key': field_key,
            'saved_at': timezone.now().isoformat()
        })
    
    @action(detail=True, methods=['post'])
    def complete_step(self, request, pk=None):
        """Mark a step as complete."""
        submission = self.get_object()
        
        # Explicit tenant check for security
        request_tenant = getattr(request, 'tenant', None)
        if not request_tenant or submission.tenant_id != request_tenant.id:
            return Response(
                {'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        step_id = request.data.get('step_id')
        
        if not step_id:
            return Response(
                {'error': 'step_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        step_submission = submission.step_submissions.filter(step_id=step_id).first()
        if not step_submission:
            return Response(
                {'error': 'Step not found in this submission'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Use transaction for atomicity
        with transaction.atomic():
            # Mark complete
            step_submission.mark_completed(user=request.user)
            
            # Move to next step if available
            current_order = step_submission.step.order
            next_step = submission.form.entities.filter(order__gt=current_order).order_by('order').first()
            
            if next_step:
                submission.current_step = next_step
                # Mark next step as in_progress
                next_step_submission = submission.step_submissions.filter(step=next_step).first()
                if next_step_submission:
                    next_step_submission.status = StepSubmissionStatus.IN_PROGRESS
                    next_step_submission.save(update_fields=['status', 'updated_at'])
            
            submission.save(update_fields=['current_step', 'updated_at'])
        
        return Response({
            'success': True,
            'step_id': step_id,
            'step_status': step_submission.status,
            'next_step_id': str(next_step.id) if next_step else None
        })
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Final submission of the form."""
        submission = self.get_object()
        
        # Explicit tenant check for security
        request_tenant = getattr(request, 'tenant', None)
        if not request_tenant or submission.tenant_id != request_tenant.id:
            return Response(
                {'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if submission.status == FormSubmissionStatus.COMPLETED:
            return Response(
                {'error': 'Submission already completed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check all required steps are complete (optional - can be configured)
        incomplete_steps = submission.step_submissions.exclude(
            status__in=[StepSubmissionStatus.COMPLETED, StepSubmissionStatus.SKIPPED]
        )
        
        if incomplete_steps.exists() and not request.data.get('force', False):
            return Response({
                'error': 'Some steps are not complete',
                'incomplete_steps': [
                    {'id': str(s.step_id), 'name': s.step.step_name, 'status': s.status}
                    for s in incomplete_steps
                ]
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Mark as completed
        submission.status = FormSubmissionStatus.COMPLETED
        submission.completed_at = timezone.now()
        submission.save(update_fields=['status', 'completed_at', 'updated_at'])
        
        return Response({
            'success': True,
            'status': submission.status,
            'completed_at': submission.completed_at.isoformat()
        })
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a submission."""
        submission = self.get_object()
        
        # Explicit tenant check for security
        request_tenant = getattr(request, 'tenant', None)
        if not request_tenant or submission.tenant_id != request_tenant.id:
            return Response(
                {'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if submission.status == FormSubmissionStatus.COMPLETED:
            return Response(
                {'error': 'Cannot cancel a completed submission'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        submission.status = FormSubmissionStatus.CANCELLED
        submission.save(update_fields=['status', 'updated_at'])
        
        return Response({
            'success': True,
            'status': submission.status
        })


class AvailableFormsViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for listing forms available for Quick Actions.
    
    Only returns forms that are:
    - Active (status=active)
    - Quick action enabled
    - Belonging to the user's tenant
    """
    permission_classes = [IsAuthenticated]
    serializer_class = AvailableFormSerializer
    
    def get_queryset(self):
        return TenantForm.objects.filter(
            tenant=self.request.tenant,
            status=FormStatus.ACTIVE,
            is_quick_action_enabled=True
        ).prefetch_related('entities').order_by('name')


class QuickActionsAPIView(APIView):
    """
    API endpoint for managing user's quick actions.
    
    GET - Get user's current quick actions
    PUT - Update user's quick actions
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get user's quick actions from preferences."""
        try:
            prefs = request.user.preferences
            quick_actions = prefs.quick_menu_items or []
        except Exception:
            quick_actions = []
        
        return Response({
            'items': quick_actions
        })
    
    def put(self, request):
        """Update user's quick actions."""
        try:
            serializer = QuickActionsSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            items = serializer.validated_data['items']
            
            # Validate that referenced forms exist and are available
            for item in items:
                if item['type'] == 'form' and item.get('form_id'):
                    form_exists = TenantForm.objects.filter(
                        id=item['form_id'],
                        tenant=request.tenant,
                        is_quick_action_enabled=True
                    ).exists()
                    if not form_exists:
                        return Response(
                            {'error': f'Form {item["form_id"]} is not available for quick actions'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
            
            # Update preferences
            from apps.core.models import UserPreferences
            prefs, created = UserPreferences.objects.get_or_create(user=request.user)
            
            # Convert UUID objects to strings for JSON storage
            serializable_items = []
            for item in items:
                serializable_item = dict(item)
                if 'form_id' in serializable_item and serializable_item['form_id']:
                    serializable_item['form_id'] = str(serializable_item['form_id'])
                if 'workflow_id' in serializable_item and serializable_item['workflow_id']:
                    serializable_item['workflow_id'] = str(serializable_item['workflow_id'])
                serializable_items.append(serializable_item)
            
            prefs.quick_menu_items = serializable_items
            prefs.save(update_fields=['quick_menu_items', 'updated_at'])
            
            return Response({
                'success': True,
                'items': serializable_items
            })
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.exception(f"Error updating quick actions: {e}")
            return Response(
                {'error': f'Failed to update quick actions: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
