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
    
    class Meta:
        model = TenantFormField
        fields = [
            'id', 'field_key', 'is_visible', 'is_required', 'order',
            'custom_label', 'custom_help_text', 'default_value'
        ]
        read_only_fields = ['id']


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
