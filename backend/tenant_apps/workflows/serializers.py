"""
Serializers for Tenant Workflows API.

Bundle Two: System → Tenant Workflows & New Data Entities
Provides REST API serialization for Forms, Workflows, and Lists.
"""
from typing import Any, Dict, List

from rest_framework import serializers

from .models import (
    TenantList, TenantForm, TenantFormEntity, TenantFormField, TenantFormRule,
    TenantWorkflow, TenantWorkflowCondition, TenantWorkflowAction,
    WorkflowExecutionLog
)


# =============================================================================
# TENANT LIST SERIALIZERS
# =============================================================================

class TenantListSerializer(serializers.ModelSerializer):
    """Serializer for TenantList model."""

    option_count = serializers.SerializerMethodField()

    class Meta:
        model = TenantList
        fields = [
            'id', 'name', 'description', 'options', 'option_count',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_option_count(self, obj):
        return len(obj.options) if obj.options else 0

    def validate_name(self, value):
        """Enforce per-tenant list name uniqueness and avoid IntegrityError 500s."""
        request = self.context.get('request')
        tenant = getattr(request, 'tenant', None) if request else None

        if not tenant:
            raise serializers.ValidationError('Tenant context is required to create option lists.')

        normalized = str(value or '').strip()
        if not normalized:
            raise serializers.ValidationError('Name is required.')

        qs = TenantList.objects.filter(tenant=tenant, name=normalized)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError('A custom list with this name already exists for this tenant.')

        return normalized

    def validate_options(self, value):
        """Validate and normalize option rows."""
        if value is None:
            return []

        if not isinstance(value, list):
            raise serializers.ValidationError('Options must be a list of {value,label} objects.')

        normalized = []
        seen = set()

        for opt in value:
            if not isinstance(opt, dict):
                raise serializers.ValidationError('Each option must be an object with value and label.')

            v = str(opt.get('value', '')).strip()
            l = str(opt.get('label', '')).strip()

            if not v or not l:
                raise serializers.ValidationError('Each option must include a non-empty value and label.')

            key = v.lower()
            if key in seen:
                raise serializers.ValidationError(f'Duplicate option value: "{v}"')
            seen.add(key)

            normalized.append({'value': v, 'label': l})

        return normalized


# =============================================================================
# TENANT FORM SERIALIZERS
# =============================================================================

class TenantFormFieldSerializer(serializers.ModelSerializer):
    """Serializer for TenantFormField model."""
    
    # Include source step name for display
    auto_populate_source_step_name = serializers.SerializerMethodField()
    
    # Phase 2.3: Cascading field metadata
    cascade_parent_field_key = serializers.SerializerMethodField()
    
    class Meta:
        model = TenantFormField
        fields = [
            'id', 'field_key', 'field_type', 'is_visible', 'is_required', 'order',
            'custom_label', 'custom_help_text', 'default_value', 'validation_rules',
            'auto_populate_source_step', 'auto_populate_source_field',
            'auto_populate_mode', 'auto_populate_source_step_name',
            'cascade_parent_field', 'cascade_filter_key', 'cascade_enabled',
            'cascade_parent_field_key'
        ]
        read_only_fields = ['id', 'auto_populate_source_step_name', 'cascade_parent_field_key']
    
    def get_auto_populate_source_step_name(self, obj):
        if obj.auto_populate_source_step:
            return obj.auto_populate_source_step.step_name or obj.auto_populate_source_step.entity_type
        return None
    
    def get_cascade_parent_field_key(self, obj):
        """Return parent field's field_key for frontend reference."""
        if obj.cascade_parent_field:
            return obj.cascade_parent_field.field_key
        return None


class TenantFormEntitySerializer(serializers.ModelSerializer):
    """Serializer for TenantFormEntity model."""
    
    fields = TenantFormFieldSerializer(many=True, read_only=True)
    field_count = serializers.SerializerMethodField()
    
    class Meta:
        model = TenantFormEntity
        fields = [
            'id', 'entity_type', 'step_name', 'order', 'fields', 'field_count'
        ]
        read_only_fields = ['id']
    
    def get_field_count(self, obj):
        return obj.fields.count()


class TenantFormRuleSerializer(serializers.ModelSerializer):
    """Serializer for TenantFormRule model."""
    
    class Meta:
        model = TenantFormRule
        fields = [
            'id', 'name', 'is_active', 'order', 
            'conditions', 'condition_logic', 'actions'
        ]
        read_only_fields = ['id']


class TenantFormSerializer(serializers.ModelSerializer):
    """
    Serializer for TenantForm model.
    
    Phase 4.2: Includes permission metadata for frontend.
    """
    
    entities = TenantFormEntitySerializer(many=True, read_only=True)
    rules = TenantFormRuleSerializer(many=True, read_only=True)
    entity_count = serializers.SerializerMethodField()
    is_multi_entity = serializers.SerializerMethodField()
    
    # Phase 4.2: Permission metadata
    can_edit = serializers.SerializerMethodField()
    can_publish = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    
    class Meta:
        model = TenantForm
        fields = [
            'id', 'name', 'description', 'status', 'is_default', 'icon',
            'entities', 'rules', 'entity_count', 'is_multi_entity',
            'can_edit', 'can_publish', 'can_delete',  # Phase 4.2: Permission metadata
            'created_at', 'updated_at', 'flow_data',  # Phase 2.1: Visual editor
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'can_edit', 'can_publish', 'can_delete']
    
    def get_entity_count(self, obj):
        return obj.entities.count()
    
    def get_is_multi_entity(self, obj):
        return obj.entities.count() > 1
    
    def get_can_edit(self, obj):
        """Check if current user can edit this form."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        
        # Superusers can edit anything
        if request.user.is_superuser:
            return True
        
        # Check tenant role
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return False
        
        from apps.tenants.models import TenantUser
        try:
            tenant_user = TenantUser.objects.get(
                user=request.user,
                tenant=tenant,
                is_active=True
            )
            
            # owner/admin can edit any form
            if tenant_user.role in ['owner', 'admin']:
                return True
            
            # manager can edit own forms
            if tenant_user.role == 'manager':
                return obj.created_by == request.user
            
            return False
        except TenantUser.DoesNotExist:
            return False
    
    def get_can_publish(self, obj):
        """Check if current user can publish this form."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        
        # Superusers can publish anything
        if request.user.is_superuser:
            return True
        
        # Check tenant role
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return False
        
        from apps.tenants.models import TenantUser
        try:
            tenant_user = TenantUser.objects.get(
                user=request.user,
                tenant=tenant,
                is_active=True
            )
            # Only owner/admin can publish
            return tenant_user.role in ['owner', 'admin']
        except TenantUser.DoesNotExist:
            return False
    
    def get_can_delete(self, obj):
        """Check if current user can delete this form."""
        # Same logic as can_edit for now
        return self.get_can_edit(obj)


class TenantFormCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating TenantForm with nested entities."""
    
    entities = TenantFormEntitySerializer(many=True, required=False)
    
    class Meta:
        model = TenantForm
        fields = [
            'name', 'description', 'status', 'is_default', 'icon', 'entities', 'flow_data'
        ]
    
    def create(self, validated_data):
        entities_data = validated_data.pop('entities', [])
        form = TenantForm.objects.create(**validated_data)
        
        for entity_data in entities_data:
            TenantFormEntity.objects.create(form=form, **entity_data)
        
        return form


# =============================================================================
# TENANT WORKFLOW SERIALIZERS
# =============================================================================

class TenantWorkflowConditionSerializer(serializers.ModelSerializer):
    """Serializer for TenantWorkflowCondition model."""
    
    operator_display = serializers.CharField(source='get_operator_display', read_only=True)
    
    class Meta:
        model = TenantWorkflowCondition
        fields = [
            'id', 'field_path', 'operator', 'operator_display', 
            'compare_value', 'order'
        ]
        read_only_fields = ['id']


class TenantWorkflowActionSerializer(serializers.ModelSerializer):
    """Serializer for TenantWorkflowAction model."""
    
    action_type_display = serializers.CharField(source='get_action_type_display', read_only=True)
    
    class Meta:
        model = TenantWorkflowAction
        fields = [
            'id', 'action_type', 'action_type_display', 'config', 
            'order', 'continue_on_error'
        ]
        read_only_fields = ['id']


class TenantWorkflowSerializer(serializers.ModelSerializer):
    """Serializer for TenantWorkflow model."""
    
    conditions = TenantWorkflowConditionSerializer(many=True, read_only=True)
    actions = TenantWorkflowActionSerializer(many=True, read_only=True)
    trigger_type_display = serializers.CharField(source='get_trigger_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    condition_count = serializers.SerializerMethodField()
    action_count = serializers.SerializerMethodField()
    
    class Meta:
        model = TenantWorkflow
        fields = [
            'id', 'name', 'description', 'status', 'status_display',
            'trigger_type', 'trigger_type_display', 'trigger_config',
            'entity_type', 'icon',
            'conditions', 'actions', 'condition_count', 'action_count',
            'last_run_at', 'run_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'last_run_at', 'run_count', 'created_at', 'updated_at']
    
    def get_condition_count(self, obj):
        return obj.conditions.count()
    
    def get_action_count(self, obj):
        return obj.actions.count()


class TenantWorkflowCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating TenantWorkflow with nested conditions and actions."""
    
    conditions = TenantWorkflowConditionSerializer(many=True, required=False)
    actions = TenantWorkflowActionSerializer(many=True, required=False)
    
    class Meta:
        model = TenantWorkflow
        fields = [
            'name', 'description', 'status', 
            'trigger_type', 'trigger_config', 'entity_type', 'icon',
            'conditions', 'actions'
        ]
    
    def create(self, validated_data):
        conditions_data = validated_data.pop('conditions', [])
        actions_data = validated_data.pop('actions', [])
        
        workflow = TenantWorkflow.objects.create(**validated_data)
        
        for condition_data in conditions_data:
            TenantWorkflowCondition.objects.create(workflow=workflow, **condition_data)
        
        for action_data in actions_data:
            TenantWorkflowAction.objects.create(workflow=workflow, **action_data)
        
        return workflow


# =============================================================================
# EXECUTION LOG SERIALIZERS
# =============================================================================

class WorkflowExecutionLogSerializer(serializers.ModelSerializer):
    """Serializer for WorkflowExecutionLog model."""
    
    workflow_name = serializers.CharField(source='workflow.name', read_only=True)
    duration_ms = serializers.SerializerMethodField()
    
    class Meta:
        model = WorkflowExecutionLog
        fields = [
            'id', 'workflow', 'workflow_name', 'trigger_type', 'trigger_data',
            'status', 'started_at', 'completed_at', 'duration_ms',
            'actions_executed', 'actions_failed', 'error_message',
            'execution_log', 'triggered_by'
        ]
        read_only_fields = [
            'id', 'workflow', 'workflow_name', 'trigger_type', 'trigger_data',
            'status', 'started_at', 'completed_at', 'duration_ms',
            'actions_executed', 'actions_failed', 'error_message',
            'execution_log', 'triggered_by'
        ]
    
    def get_duration_ms(self, obj):
        if obj.completed_at and obj.started_at:
            delta = obj.completed_at - obj.started_at
            return int(delta.total_seconds() * 1000)
        return None


# =============================================================================
# WORKFORM EXECUTION SERIALIZERS (TenantWorkForm)
# =============================================================================

from .models import TenantWorkFormExecution


class TenantWorkFormExecutionSerializer(serializers.ModelSerializer):
    """Serializer for TenantWorkFormExecution model."""

    workform_name = serializers.CharField(source='workform.name', read_only=True)
    started_by_name = serializers.SerializerMethodField()

    # WorkForms runtime: expose a compact per-node status map derived from audit_trail
    node_statuses = serializers.SerializerMethodField()

    # WorkForms runtime: surface "where am I" + error summary for UI panels.
    current_node_id = serializers.SerializerMethodField()
    current_node_type = serializers.SerializerMethodField()
    last_event = serializers.SerializerMethodField()
    errors = serializers.SerializerMethodField()

    class Meta:
        model = TenantWorkFormExecution
        fields = [
            'id',
            'tenant',
            'workform',
            'workform_name',
            'status',
            'initial_data',
            'context_data',
            'audit_trail',
            'node_statuses',
            'current_node_id',
            'current_node_type',
            'last_event',
            'errors',
            'started_by',
            'started_by_name',
            'started_at',
            'completed_at',
            'error_message',
            'created_on',
            'modified_on',
        ]
        read_only_fields = fields

    def get_started_by_name(self, obj):
        if obj.started_by:
            return obj.started_by.get_full_name() or obj.started_by.username
        return None

    def _last_node_event(self, obj):
        trail = obj.audit_trail
        if not isinstance(trail, list):
            return None

        for row in reversed(trail):
            if isinstance(row, dict) and row.get('node_id'):
                return row

        return None

    def get_current_node_id(self, obj):
        row = self._last_node_event(obj)
        return row.get('node_id') if isinstance(row, dict) else None

    def get_current_node_type(self, obj):
        row = self._last_node_event(obj)
        return row.get('node_type') if isinstance(row, dict) else None

    def get_last_event(self, obj):
        row = self._last_node_event(obj)
        return row.get('event') if isinstance(row, dict) else None

    def get_errors(self, obj):
        """Return a compact list of errors recorded during execution.

        Sources:
        - context_data.errors (WorkFormEngine routing payloads)
        - audit_trail action_error events (fallback)
        """
        errors: List[Dict[str, Any]] = []

        ctx = obj.context_data
        if isinstance(ctx, dict):
            ctx_errors = ctx.get('errors')
            if isinstance(ctx_errors, list):
                for row in ctx_errors:
                    if isinstance(row, dict) and row.get('error'):
                        errors.append(row)

        trail = obj.audit_trail
        if isinstance(trail, list):
            for row in trail:
                if not isinstance(row, dict):
                    continue
                if row.get('event') != 'action_error':
                    continue
                if not row.get('error'):
                    continue
                errors.append({
                    'node_id': row.get('node_id'),
                    'node_type': row.get('node_type'),
                    'error': row.get('error'),
                    'routed_to': row.get('routed_to'),
                    'ts': row.get('ts'),
                })

        # Dedupe while preserving order
        seen = set()
        unique = []
        for row in errors:
            key = (row.get('node_id'), row.get('error'), row.get('ts'))
            if key in seen:
                continue
            seen.add(key)
            unique.append(row)

        return unique

    def get_node_statuses(self, obj):
        """Return a per-node status map derived from the execution audit trail.

        The WorkFormEngine writes `audit_trail` as a list of events like:
        - node_enter
        - action_start / action_success / action_error

        Frontend uses this to render per-step/per-node execution status.
        """
        trail = obj.audit_trail
        if not isinstance(trail, list):
            return {}

        # Last matching event wins per node_id.
        status_by_node = {}
        for row in trail:
            if not isinstance(row, dict):
                continue

            node_id = row.get('node_id')
            event = row.get('event')
            if not node_id or not event:
                continue

            if event in {'action_success', 'node_terminal'}:
                status_by_node[node_id] = 'completed'
            elif event in {'action_error'}:
                status_by_node[node_id] = 'failed'
            elif event in {'action_start', 'node_enter', 'execution_start', 'loop_enqueued'}:
                status_by_node[node_id] = 'in_progress'

        return status_by_node


class TenantWorkFormExecutionRuntimeStateSerializer(serializers.ModelSerializer):
    """Slim runtime projection for TenantWorkFormExecution.

    Goal: allow frontend to render runtime state (current node, node statuses,
    errors) without returning full `context_data` or `audit_trail` blobs.

    This is additive; existing list/retrieve endpoints still use
    TenantWorkFormExecutionSerializer.
    """

    workform_name = serializers.CharField(source='workform.name', read_only=True)
    started_by_name = serializers.SerializerMethodField()

    node_statuses = serializers.SerializerMethodField()
    current_node = serializers.SerializerMethodField()
    errors = serializers.SerializerMethodField()

    entity_ref = serializers.SerializerMethodField()

    class Meta:
        model = TenantWorkFormExecution
        fields = [
            'id',
            'workform',
            'workform_name',
            'status',
            'entity_ref',
            'node_statuses',
            'current_node',
            'errors',
            'started_by',
            'started_by_name',
            'started_at',
            'completed_at',
            'error_message',
            'created_on',
            'modified_on',
        ]
        read_only_fields = fields

    def get_started_by_name(self, obj):
        if obj.started_by:
            return obj.started_by.get_full_name() or obj.started_by.username
        return None

    def get_entity_ref(self, obj):
        initial = obj.initial_data or {}
        if not isinstance(initial, dict):
            return {}

        # Allowlist only.
        out = {}
        for key in ('entity_type', 'entity_id', 'submission_id', 'form_submission_id'):
            if key in initial:
                out[key] = initial.get(key)

        # Normalize common variants.
        if 'form_submission_id' in out and 'submission_id' not in out:
            out['submission_id'] = out['form_submission_id']

        return out

    def get_node_statuses(self, obj):
        # Delegate to the full serializer logic.
        return TenantWorkFormExecutionSerializer(obj, context=self.context).get_node_statuses(obj)

    def get_errors(self, obj):
        return TenantWorkFormExecutionSerializer(obj, context=self.context).get_errors(obj)

    def get_current_node(self, obj):
        node_id = TenantWorkFormExecutionSerializer(obj, context=self.context).get_current_node_id(obj)
        if not node_id:
            return None

        node_type = None
        label = None

        definition = getattr(getattr(obj, 'workform', None), 'workflow_definition', None) or {}
        nodes = definition.get('nodes', []) if isinstance(definition, dict) else []

        if isinstance(nodes, list):
            for n in nodes:
                if isinstance(n, dict) and n.get('id') == node_id:
                    node_type = n.get('type')
                    data = n.get('data') if isinstance(n.get('data'), dict) else {}
                    label = data.get('label') or data.get('containerName') or data.get('name')
                    break

        statuses = self.get_node_statuses(obj)

        return {
            'node_id': node_id,
            'node_type': node_type,
            'label': label,
            'status': statuses.get(node_id),
        }


# =============================================================================
# FORM SUBMISSION SERIALIZERS
# =============================================================================

from .models import FormSubmission, FormStepSubmission


class FormStepSubmissionSerializer(serializers.ModelSerializer):
    """Serializer for individual step submissions."""
    
    step_name = serializers.CharField(source='step.step_name', read_only=True)
    step_order = serializers.IntegerField(source='step.order', read_only=True)
    entity_type = serializers.CharField(source='step.entity_type', read_only=True)
    completed_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = FormStepSubmission
        fields = [
            'id', 'step', 'step_name', 'step_order', 'entity_type',
            'status', 'data', 'completed_at', 'completed_by', 'completed_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'step', 'step_name', 'step_order', 'entity_type',
                           'completed_at', 'completed_by', 'completed_by_name',
                           'created_at', 'updated_at']
    
    def get_completed_by_name(self, obj):
        if obj.completed_by:
            return obj.completed_by.get_full_name() or obj.completed_by.username
        return None


class FormSubmissionListSerializer(serializers.ModelSerializer):
    """Light serializer for listing form submissions."""
    
    form_name = serializers.CharField(source='form.name', read_only=True)
    form_icon = serializers.CharField(source='form.icon', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    
    class Meta:
        model = FormSubmission
        fields = [
            'id', 'form', 'form_name', 'form_icon', 'status',
            'created_by', 'created_by_name', 'progress',
            'created_at', 'updated_at', 'completed_at'
        ]
        read_only_fields = [
            'id', 'form', 'form_name', 'form_icon', 'status',
            'created_by', 'created_by_name', 'progress',
            'created_at', 'updated_at', 'completed_at'
        ]
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
    
    def get_progress(self, obj):
        completed, total = obj.progress
        return {
            'completed': completed,
            'total': total,
            'percent': obj.progress_percent
        }


class FormSubmissionDetailSerializer(serializers.ModelSerializer):
    """Full serializer for form submission details."""
    
    form_name = serializers.CharField(source='form.name', read_only=True)
    form_description = serializers.CharField(source='form.description', read_only=True)
    form_icon = serializers.CharField(source='form.icon', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    step_submissions = FormStepSubmissionSerializer(many=True, read_only=True)
    current_step_name = serializers.CharField(source='current_step.step_name', read_only=True)
    progress = serializers.SerializerMethodField()
    
    class Meta:
        model = FormSubmission
        fields = [
            'id', 'tenant', 'form', 'form_name', 'form_description', 'form_icon',
            'status', 'current_step', 'current_step_name',
            'data', 'form_snapshot', 'step_submissions', 'progress',
            'created_by', 'created_by_name',
            'created_at', 'updated_at', 'completed_at'
        ]
        read_only_fields = [
            'id', 'tenant', 'form_name', 'form_description', 'form_icon',
            'form_snapshot', 'step_submissions', 'progress',
            'created_by_name', 'created_at', 'updated_at', 'completed_at'
        ]
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
    
    def get_progress(self, obj):
        completed, total = obj.progress
        return {
            'completed': completed,
            'total': total,
            'percent': obj.progress_percent
        }


class FormSubmissionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new form submissions."""
    
    class Meta:
        model = FormSubmission
        fields = ['form']
    
    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['tenant'] = request.tenant
        validated_data['created_by'] = request.user
        return super().create(validated_data)


class FormSubmissionAutoSaveSerializer(serializers.Serializer):
    """Serializer for auto-saving field values."""
    
    step_id = serializers.UUIDField()
    field_key = serializers.CharField(max_length=100)
    value = serializers.JSONField(allow_null=True)
    
    def validate_step_id(self, value):
        submission = self.context.get('submission')
        if not submission:
            raise serializers.ValidationError("No submission context provided")
        
        # Check step exists in form
        if not submission.form.entities.filter(id=value).exists():
            raise serializers.ValidationError("Step not found in this form")
        
        return value
    
    def validate_field_key(self, value):
        # Field validation happens in the view where we have step context
        return value


class AvailableFormSerializer(serializers.ModelSerializer):
    """Serializer for forms available for Quick Actions."""
    
    step_count = serializers.SerializerMethodField()
    
    class Meta:
        model = TenantForm
        fields = [
            'id', 'name', 'description', 'icon', 'status',
            'is_default', 'is_quick_action_enabled', 'step_count'
        ]
        # Note: Used with ReadOnlyModelViewSet, so all fields are read-only by design
        read_only_fields = [
            'id', 'name', 'description', 'icon', 'status',
            'is_default', 'is_quick_action_enabled'
        ]
    
    def get_step_count(self, obj):
        return obj.entities.count()


class QuickActionItemSerializer(serializers.Serializer):
    """Serializer for a single quick action item."""
    
    id = serializers.CharField()
    type = serializers.ChoiceField(choices=['form', 'workflow'])
    form_id = serializers.UUIDField(required=False, allow_null=True)
    workflow_id = serializers.UUIDField(required=False, allow_null=True)
    label = serializers.CharField(max_length=100)
    icon = serializers.CharField(max_length=50, required=False, allow_blank=True, default='file-text')
    order = serializers.IntegerField(min_value=0)
    
    def validate(self, data):
        if data['type'] == 'form' and not data.get('form_id'):
            raise serializers.ValidationError("form_id is required for form type")
        if data['type'] == 'workflow' and not data.get('workflow_id'):
            raise serializers.ValidationError("workflow_id is required for workflow type")
        # Ensure icon has a valid value (default to file-text if empty)
        if not data.get('icon') or data.get('icon', '').strip() == '':
            data['icon'] = 'file-text'
        return data


class QuickActionsSerializer(serializers.Serializer):
    """Serializer for user's quick actions list."""

    items = QuickActionItemSerializer(many=True)


class QuickActionsGetResponseSerializer(serializers.Serializer):
    items = QuickActionItemSerializer(many=True)


class QuickActionsPutResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    items = QuickActionItemSerializer(many=True)


class AvailableQuickActionTargetSerializer(serializers.Serializer):
    """Schema serializer for AvailableFormsViewSet unified response."""

    id = serializers.CharField()
    type = serializers.ChoiceField(choices=["form", "workflow"])
    name = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True)
    icon = serializers.CharField(required=False, allow_blank=True)
    status = serializers.CharField()
    is_default = serializers.BooleanField(required=False)
    is_quick_action_enabled = serializers.BooleanField(required=False)
    step_count = serializers.IntegerField(required=False)
    node_count = serializers.IntegerField(required=False, allow_null=True)


# =============================================================================
# WAVE 3: FORMS & FLOWS ENHANCEMENT SERIALIZERS
# =============================================================================

from .models import (
    FormStatusHistory, StepAssignment, UserNotification, 
    UserNotificationPreferences
)


class FormStatusHistorySerializer(serializers.ModelSerializer):
    """Serializer for form status history."""
    
    changed_by_name = serializers.SerializerMethodField()
    from_status_display = serializers.CharField(source='get_from_status_display', read_only=True)
    to_status_display = serializers.CharField(source='get_to_status_display', read_only=True)
    
    class Meta:
        model = FormStatusHistory
        fields = [
            'id', 'submission', 'from_status', 'from_status_display',
            'to_status', 'to_status_display', 'changed_by', 'changed_by_name',
            'comment', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.get_full_name() or obj.changed_by.username
        return None


class StepAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for step assignments."""
    
    assigned_user_name = serializers.SerializerMethodField()
    step_name = serializers.CharField(source='step.step_name', read_only=True)
    form_name = serializers.CharField(source='form.name', read_only=True)
    assignment_type_display = serializers.CharField(source='get_assignment_type_display', read_only=True)
    
    class Meta:
        model = StepAssignment
        fields = [
            'id', 'tenant', 'form', 'form_name', 'step', 'step_name',
            'assignment_type', 'assignment_type_display',
            'assigned_user', 'assigned_user_name', 'assigned_role',
            'is_required', 'due_days', 'escalation_user',
            'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'tenant', 'created_by', 'created_at', 'updated_at']
    
    def get_assigned_user_name(self, obj):
        if obj.assigned_user:
            return obj.assigned_user.get_full_name() or obj.assigned_user.username
        return None
    
    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['tenant'] = request.tenant
        validated_data['created_by'] = request.user
        return super().create(validated_data)


class UserNotificationSerializer(serializers.ModelSerializer):
    """Serializer for user notifications."""
    
    notification_type_display = serializers.CharField(source='get_notification_type_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    time_ago = serializers.SerializerMethodField()
    
    class Meta:
        model = UserNotification
        fields = [
            'id', 'tenant', 'user',
            'notification_type', 'notification_type_display',
            'title', 'message', 'priority', 'priority_display',
            'entity_type', 'entity_id', 'action_url',
            'is_read', 'read_at', 'is_dismissed',
            'metadata', 'created_at', 'expires_at', 'time_ago'
        ]
        read_only_fields = ['id', 'tenant', 'user', 'created_at']
    
    def get_time_ago(self, obj):
        """Return human-readable time ago string."""
        from django.utils import timezone
        from datetime import timedelta
        
        now = timezone.now()
        diff = now - obj.created_at
        
        if diff < timedelta(minutes=1):
            return "Just now"
        elif diff < timedelta(hours=1):
            minutes = int(diff.total_seconds() / 60)
            return f"{minutes}m ago"
        elif diff < timedelta(days=1):
            hours = int(diff.total_seconds() / 3600)
            return f"{hours}h ago"
        elif diff < timedelta(days=7):
            days = diff.days
            return f"{days}d ago"
        else:
            return obj.created_at.strftime("%b %d")


class UserNotificationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating notifications (internal use)."""
    
    class Meta:
        model = UserNotification
        fields = [
            'tenant', 'user', 'notification_type', 'title', 'message',
            'priority', 'entity_type', 'entity_id', 'action_url',
            'metadata', 'expires_at'
        ]


class UserNotificationPreferencesSerializer(serializers.ModelSerializer):
    """Serializer for notification preferences."""
    
    class Meta:
        model = UserNotificationPreferences
        fields = [
            'id', 'tenant', 'user', 'notifications_enabled',
            'email_enabled', 'sms_enabled', 'push_enabled',
            'type_preferences',
            'quiet_hours_enabled', 'quiet_hours_start', 'quiet_hours_end',
            'daily_digest_enabled', 'weekly_digest_enabled',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'tenant', 'user', 'created_at', 'updated_at']


class ActionItemSerializer(serializers.Serializer):
    """Serializer for action items (tasks assigned to user)."""
    
    id = serializers.UUIDField()
    type = serializers.ChoiceField(choices=['form_step', 'workflow_task'])
    title = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    form_name = serializers.CharField(required=False)
    step_name = serializers.CharField(required=False)
    submission_id = serializers.UUIDField(required=False)
    priority = serializers.ChoiceField(choices=['low', 'normal', 'high', 'urgent'])
    status = serializers.CharField()
    due_date = serializers.DateTimeField(required=False, allow_null=True)
    is_overdue = serializers.BooleanField()
    assigned_at = serializers.DateTimeField()
    entity_type = serializers.CharField(required=False)
    entity_id = serializers.UUIDField(required=False)
    # Optional PO value fields used by the frontend urgency × value sort matrix
    related_po_value = serializers.FloatField(required=False, allow_null=True)
    related_po_currency = serializers.CharField(required=False, allow_null=True)


class ActionItemCountsSerializer(serializers.Serializer):
    """
    Serializer for action item counts.

    All fields are nullable to handle graceful degradation when
    database queries fail or tables are empty.
    """

    total = serializers.IntegerField(required=False, allow_null=True, default=0)
    overdue = serializers.IntegerField(required=False, allow_null=True, default=0)
    due_today = serializers.IntegerField(required=False, allow_null=True, default=0)
    due_this_week = serializers.IntegerField(required=False, allow_null=True, default=0)
    by_priority = serializers.DictField(child=serializers.IntegerField(), required=False, allow_null=True, default=dict)
    by_form = serializers.ListField(child=serializers.DictField(), required=False, allow_null=True, default=list)


class EntityOptionSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()


class EntityOptionsResponseSerializer(serializers.Serializer):
    entity_type = serializers.CharField()
    options = EntityOptionSerializer(many=True)
    count = serializers.IntegerField()
    total_count = serializers.IntegerField()
    can_create = serializers.BooleanField()
    entity_label = serializers.CharField()
    has_more = serializers.BooleanField()


class QuickCreateFieldSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    type = serializers.CharField()
    required = serializers.BooleanField()


class QuickCreateFieldsResponseSerializer(serializers.Serializer):
    entity_type = serializers.CharField()
    entity_label = serializers.CharField()
    fields = QuickCreateFieldSerializer(many=True)


class QuickCreateCreateResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    id = serializers.CharField()
    value = serializers.CharField()
    label = serializers.CharField()
    entity_type = serializers.CharField()


class SmartFieldMatchRequestSerializer(serializers.Serializer):
    source_field = serializers.DictField()
    target_entity_type = serializers.CharField()


class SmartFieldMatchResponseSerializer(serializers.Serializer):
    source_field = serializers.DictField()
    target_entity_type = serializers.CharField()
    matches = serializers.ListField(child=serializers.DictField())
