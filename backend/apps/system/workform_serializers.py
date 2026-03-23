"""
Serializers for TenantForm and TenantWorkForm models.

Provides REST API serialization for form and workflow management.

Phase 1.4-1.6 of WF-ENH-2026-Q1
Created: 2026-02-06
"""
from rest_framework import serializers
from apps.system.models import TenantForm, TenantWorkForm, FormTypeChoices, WorkFormStatusChoices


class TenantFormSerializer(serializers.ModelSerializer):
    """
    Serializer for TenantForm model.
    
    Handles form CRUD operations with automatic tenant assignment.
    """
    entity_type = serializers.SerializerMethodField()
    field_count = serializers.SerializerMethodField()
    step_count = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = TenantForm
        fields = [
            'id',
            'tenant',
            'name',
            'description',
            'type',
            'form_definition',
            'version',
            'usage_count',
            'is_workform',
            'parent_workform',
            'entity_type',
            'field_count',
            'step_count',
            'created_at',
            'updated_at',
            'created_by',
            'created_by_name',
            'updated_by',
            'updated_by_name',
        ]
        read_only_fields = [
            'id',
            'tenant',
            'version',
            'usage_count',
            'created_at',
            'updated_at',
            'created_by',
            'updated_by',
        ]
    
    def get_entity_type(self, obj):
        """Extract entity type from form definition."""
        return obj.get_entity_type()
    
    def get_field_count(self, obj):
        """Get total field count."""
        return obj.get_field_count()
    
    def get_step_count(self, obj):
        """Get number of steps."""
        return obj.get_step_count()
    
    def get_created_by_name(self, obj):
        """Get creator's full name."""
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
    
    def get_updated_by_name(self, obj):
        """Get updater's full name."""
        if obj.updated_by:
            return obj.updated_by.get_full_name() or obj.updated_by.username
        return None


class TenantFormListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for list views.
    
    Excludes heavy form_definition field for performance.
    """
    entity_type = serializers.SerializerMethodField()
    field_count = serializers.SerializerMethodField()
    step_count = serializers.SerializerMethodField()
    
    class Meta:
        model = TenantForm
        fields = [
            'id',
            'name',
            'description',
            'type',
            'version',
            'usage_count',
            'is_workform',
            'parent_workform',
            'entity_type',
            'field_count',
            'step_count',
            'created_at',
            'updated_at',
        ]
    
    def get_entity_type(self, obj):
        return obj.get_entity_type()
    
    def get_field_count(self, obj):
        return obj.get_field_count()
    
    def get_step_count(self, obj):
        return obj.get_step_count()


class TenantWorkFormSerializer(serializers.ModelSerializer):
    """
    Serializer for TenantWorkForm model.
    
    Handles workflow CRUD operations with automatic tenant assignment
    and form reference tracking.
    """
    node_count = serializers.SerializerMethodField()
    edge_count = serializers.SerializerMethodField()
    node_types_summary = serializers.SerializerMethodField()
    validation_status = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = TenantWorkForm
        fields = [
            'id',
            'tenant',
            'name',
            'description',
            'status',
            'workflow_definition',
            'form_references',
            'version',
            'parent_version',
            'execution_count',
            'last_executed_at',
            'cloned_from',
            'clone_count',
            'node_count',
            'edge_count',
            'node_types_summary',
            'validation_status',
            'created_at',
            'updated_at',
            'created_by',
            'created_by_name',
            'updated_by',
            'updated_by_name',
        ]
        read_only_fields = [
            'id',
            'tenant',
            'form_references',
            'version',
            'execution_count',
            'last_executed_at',
            'clone_count',
            'created_at',
            'updated_at',
            'created_by',
            'updated_by',
        ]
    
    def get_node_count(self, obj):
        """Get total node count."""
        return obj.get_node_count()
    
    def get_edge_count(self, obj):
        """Get total edge count."""
        return obj.get_edge_count()
    
    def get_node_types_summary(self, obj):
        """Get summary of node types used."""
        return obj.get_node_types_summary()
    
    def get_validation_status(self, obj):
        """Get form reference validation status."""
        return obj.validate_form_references()
    
    def get_created_by_name(self, obj):
        """Get creator's full name."""
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
    
    def get_updated_by_name(self, obj):
        """Get updater's full name."""
        if obj.updated_by:
            return obj.updated_by.get_full_name() or obj.updated_by.username
        return None
    
    def _snapshot_and_link_containers(self, workflow_def, tenant, user, parent_workform):
        """Snapshot form containers into TenantForms and link them back to the parent workform.

        Non-breaking behavior:
        - Prefers nested `container.data.steps` when present (frontend sub-flow payload)
        - Only enforces the 3+ steps rule for canonical `formBook` containers
        """
        from apps.system.services.container_versioning import extract_container_definitions, snapshot_container

        if not isinstance(workflow_def, dict):
            return workflow_def

        nodes = workflow_def.get('nodes', [])
        if not isinstance(nodes, list):
            return workflow_def

        containers = extract_container_definitions(nodes)

        for container_info in containers:
            container_node = container_info['container']
            child_steps = container_info['children']

            if not child_steps:
                continue

            # Validation: canonical Form containers must have >= 3 steps.
            if container_node.get('type') == 'formBook' and len(child_steps) < 3:
                raise serializers.ValidationError(
                    {
                        'workflow_definition': [
                            f'Form "{(container_node.get("data") or {}).get("containerName") or (container_node.get("data") or {}).get("label", container_node.get("id"))}" must have at least 3 steps.'
                        ]
                    }
                )

            tenant_form = snapshot_container(
                container_node=container_node,
                child_steps=child_steps,
                tenant=tenant,
                user=user,
            )

            # Mark extracted forms as workform-derived for unified selector UX.
            if parent_workform and (
                not getattr(tenant_form, 'is_workform', False)
                or getattr(tenant_form, 'parent_workform_id', None) != parent_workform.id
            ):
                tenant_form.is_workform = True
                tenant_form.parent_workform = parent_workform
                tenant_form.save(update_fields=['is_workform', 'parent_workform'])

            # Update container node with tenantFormId reference
            container_data = container_node.setdefault('data', {})
            container_data['tenantFormId'] = str(tenant_form.id)
            container_data['tenantFormVersion'] = tenant_form.version

        return workflow_def

    def create(self, validated_data):
        """Create workflow, snapshot containers, and extract form references.

        Defensive improvements:
        - Avoid 500s when creating a new workform with a duplicate name by auto-suffixing
          (common with the default "Untitled Workflow").
        """
        tenant = validated_data.get('tenant')
        name = validated_data.get('name')

        if tenant and name:
            base_name = name
            candidate = base_name
            suffix = 2

            while TenantWorkForm.objects.filter(tenant=tenant, name=candidate, version=1).exists():
                candidate = f"{base_name} ({suffix})"
                suffix += 1

            validated_data['name'] = candidate

        workform = super().create(validated_data)

        request = self.context.get('request')
        user = request.user if request else None

        workflow_def = workform.workflow_definition
        workflow_def = self._snapshot_and_link_containers(
            workflow_def=workflow_def,
            tenant=workform.tenant,
            user=user,
            parent_workform=workform,
        )

        workform.workflow_definition = workflow_def
        workform.form_references = workform.extract_form_references()
        workform.save(update_fields=['workflow_definition', 'form_references'])

        return workform

    def update(self, instance, validated_data):
        """Update workflow with container versioning + dual-reference linking."""

        request = self.context.get('request')
        user = request.user if request else None

        workflow_def = validated_data.get('workflow_definition', instance.workflow_definition)
        workflow_def = self._snapshot_and_link_containers(
            workflow_def=workflow_def,
            tenant=instance.tenant,
            user=user,
            parent_workform=instance,
        )

        validated_data['workflow_definition'] = workflow_def

        workform = super().update(instance, validated_data)
        workform.update_form_references()
        return workform


class TenantWorkFormListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for list views.
    
    Excludes heavy workflow_definition field for performance.
    """
    node_count = serializers.SerializerMethodField()
    edge_count = serializers.SerializerMethodField()
    
    class Meta:
        model = TenantWorkForm
        fields = [
            'id',
            'name',
            'description',
            'status',
            'version',
            'execution_count',
            'last_executed_at',
            'node_count',
            'edge_count',
            'created_at',
            'updated_at',
        ]
    
    def get_node_count(self, obj):
        return obj.get_node_count()
    
    def get_edge_count(self, obj):
        return obj.get_edge_count()


class FormMergeSerializer(serializers.Serializer):
    """
    Serializer for merging multiple single-step forms into one multi-step form.
    """
    container_name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    source_form_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=2,
        help_text="List of TenantForm IDs to merge (must be single-step forms)"
    )
    
    def validate_source_form_ids(self, value):
        """Validate that all source forms exist and are single-step."""
        tenant = self.context['request'].tenant
        
        forms = TenantForm.objects.filter(
            tenant=tenant,
            id__in=value
        )
        
        if forms.count() != len(value):
            raise serializers.ValidationError("One or more form IDs not found")
        
        non_single_step = forms.exclude(type=FormTypeChoices.SINGLE_STEP)
        if non_single_step.exists():
            raise serializers.ValidationError("All source forms must be single-step forms")
        
        return value


class FormSplitSerializer(serializers.Serializer):
    """
    Serializer for splitting one step out of a multi-step form.
    """
    source_form_id = serializers.UUIDField()
    step_index = serializers.IntegerField(min_value=0)
    new_form_name = serializers.CharField(max_length=255)
    new_form_description = serializers.CharField(required=False, allow_blank=True)
    
    def validate_source_form_id(self, value):
        """Validate that source form exists and is multi-step."""
        tenant = self.context['request'].tenant
        
        try:
            form = TenantForm.objects.get(tenant=tenant, id=value)
        except TenantForm.DoesNotExist:
            raise serializers.ValidationError("Form not found")
        
        if form.type != FormTypeChoices.MULTI_STEP:
            raise serializers.ValidationError("Source form must be a multi-step form")
        
        return value


class WorkFormCloneSerializer(serializers.Serializer):
    """
    Serializer for cloning a workflow.
    """
    new_name = serializers.CharField(max_length=255)
    new_description = serializers.CharField(required=False, allow_blank=True)
    include_form_references = serializers.BooleanField(
        default=True,
        help_text="If true, clone references same forms. If false, clear form references."
    )
