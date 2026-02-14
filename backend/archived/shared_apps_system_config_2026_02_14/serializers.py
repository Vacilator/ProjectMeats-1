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
            'created_on', 'modified_on'
        ]
        read_only_fields = ['id', 'tenant', 'created_on', 'modified_on']


class StartWorkflowSerializer(serializers.Serializer):
    """Serializer for starting a new workflow."""
    blueprint_slug = serializers.CharField(required=True, help_text='Slug of the blueprint to execute')
    initial_data = serializers.JSONField(required=False, default=dict, help_text='Optional initial data for the workflow')


class SubmitStepSerializer(serializers.Serializer):
    """Serializer for submitting step data."""
    step_data = serializers.JSONField(required=True, help_text='Data for the current step')


class BlueprintListSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for listing available workflows.
    
    Used by the public catalog endpoint to show published blueprints
    to tenant users without exposing internal configuration details.
    """
    
    class Meta:
        model = EntityBlueprint
        fields = ['id', 'name', 'slug', 'created_at']
        read_only_fields = ['id', 'name', 'slug', 'created_at']


class BlueprintVersionDetailSerializer(serializers.ModelSerializer):
    """
    Full serializer for blueprint version details.
    
    Used by the Studio API to load complete version data for editing.
    Includes all configuration fields (schema, workflow, logic).
    """
    blueprint_name = serializers.CharField(source='blueprint.name', read_only=True)
    blueprint_slug = serializers.CharField(source='blueprint.slug', read_only=True)
    is_published = serializers.SerializerMethodField()
    
    class Meta:
        model = BlueprintVersion
        fields = [
            'id', 'blueprint', 'blueprint_name', 'blueprint_slug',
            'version', 'status', 'is_published',
            'schema_config', 'workflow_config', 'logic_config',
            'created_at'
        ]
        read_only_fields = ['id', 'blueprint', 'created_at']
    
    def get_is_published(self, obj):
        """Check if this version is the published version."""
        return obj.blueprint.published_version == obj


class UpdateSchemaConfigSerializer(serializers.Serializer):
    """Serializer for updating schema_config only."""
    schema_config = serializers.JSONField(
        required=True,
        help_text='List of field definitions for the form schema'
    )


class UpdateWorkflowConfigSerializer(serializers.Serializer):
    """Serializer for updating workflow_config only."""
    workflow_config = serializers.JSONField(
        required=True,
        help_text='Workflow step definitions'
    )
