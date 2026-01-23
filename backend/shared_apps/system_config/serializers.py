"""
Serializers for the System Configuration app.
"""
from rest_framework import serializers
from .models import EntityBlueprint, BlueprintVersion, WorkflowRun


class EntityBlueprintSerializer(serializers.ModelSerializer):
    """Serializer for EntityBlueprint model."""
    
    class Meta:
        model = EntityBlueprint
        fields = ['id', 'slug', 'name', 'published_version', 'created_at']
        read_only_fields = ['id', 'created_at']


class BlueprintVersionSerializer(serializers.ModelSerializer):
    """Serializer for BlueprintVersion model."""
    
    class Meta:
        model = BlueprintVersion
        fields = [
            'id', 'blueprint', 'version', 'status',
            'schema_config', 'workflow_config', 'logic_config',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class WorkflowRunSerializer(serializers.ModelSerializer):
    """Serializer for WorkflowRun model."""
    
    class Meta:
        model = WorkflowRun
        fields = [
            'id', 'tenant', 'workflow_slug', 'status',
            'current_step_index', 'data_context',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'tenant', 'created_at', 'updated_at']


class StartWorkflowSerializer(serializers.Serializer):
    """Serializer for starting a new workflow."""
    blueprint_slug = serializers.CharField(required=True, help_text='Slug of the blueprint to execute')
    initial_data = serializers.JSONField(required=False, default=dict, help_text='Optional initial data for the workflow')


class SubmitStepSerializer(serializers.Serializer):
    """Serializer for submitting step data."""
    step_data = serializers.JSONField(required=True, help_text='Data for the current step')
