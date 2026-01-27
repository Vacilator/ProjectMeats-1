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
from django.db.models import Count, Prefetch
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
