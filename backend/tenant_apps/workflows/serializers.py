"""
Serializers for Tenant Workflows API.

Bundle Two: System → Tenant Workflows & New Data Entities
Provides REST API serialization for Forms, Workflows, and Lists.
"""
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


# =============================================================================
# TENANT FORM SERIALIZERS
# =============================================================================

class TenantFormFieldSerializer(serializers.ModelSerializer):
    """Serializer for TenantFormField model."""
    
    # Include source step name for display
    auto_populate_source_step_name = serializers.SerializerMethodField()
    
    class Meta:
        model = TenantFormField
        fields = [
            'id', 'field_key', 'is_visible', 'is_required', 'order',
            'custom_label', 'custom_help_text', 'default_value',
            'auto_populate_source_step', 'auto_populate_source_field',
            'auto_populate_mode', 'auto_populate_source_step_name'
        ]
        read_only_fields = ['id', 'auto_populate_source_step_name']
    
    def get_auto_populate_source_step_name(self, obj):
        if obj.auto_populate_source_step:
            return obj.auto_populate_source_step.step_name or obj.auto_populate_source_step.entity_type
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
    """Serializer for TenantForm model."""
    
    entities = TenantFormEntitySerializer(many=True, read_only=True)
    rules = TenantFormRuleSerializer(many=True, read_only=True)
    entity_count = serializers.SerializerMethodField()
    is_multi_entity = serializers.SerializerMethodField()
    
    class Meta:
        model = TenantForm
        fields = [
            'id', 'name', 'description', 'status', 'is_default', 'icon',
            'entities', 'rules', 'entity_count', 'is_multi_entity',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_entity_count(self, obj):
        return obj.entities.count()
    
    def get_is_multi_entity(self, obj):
        return obj.entities.count() > 1


class TenantFormCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating TenantForm with nested entities."""
    
    entities = TenantFormEntitySerializer(many=True, required=False)
    
    class Meta:
        model = TenantForm
        fields = [
            'name', 'description', 'status', 'is_default', 'icon', 'entities'
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
        read_only_fields = '__all__'
    
    def get_duration_ms(self, obj):
        if obj.completed_at and obj.started_at:
            delta = obj.completed_at - obj.started_at
            return int(delta.total_seconds() * 1000)
        return None


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
        read_only_fields = '__all__'
    
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
        read_only_fields = '__all__'
    
    def get_step_count(self, obj):
        return obj.entities.count()


class QuickActionItemSerializer(serializers.Serializer):
    """Serializer for a single quick action item."""
    
    id = serializers.CharField()
    type = serializers.ChoiceField(choices=['form', 'workflow'])
    form_id = serializers.UUIDField(required=False, allow_null=True)
    workflow_id = serializers.UUIDField(required=False, allow_null=True)
    label = serializers.CharField(max_length=100)
    icon = serializers.CharField(max_length=50, required=False, default='📄')
    order = serializers.IntegerField(min_value=0)
    
    def validate(self, data):
        if data['type'] == 'form' and not data.get('form_id'):
            raise serializers.ValidationError("form_id is required for form type")
        if data['type'] == 'workflow' and not data.get('workflow_id'):
            raise serializers.ValidationError("workflow_id is required for workflow type")
        return data


class QuickActionsSerializer(serializers.Serializer):
    """Serializer for user's quick actions list."""
    
    items = QuickActionItemSerializer(many=True)
