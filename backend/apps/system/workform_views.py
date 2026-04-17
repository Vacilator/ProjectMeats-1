"""
ViewSets and Views for TenantForm and TenantWorkForm.

Provides REST API endpoints for form and workflow management including
CRUD operations, merge/split, clone, and validation.

Phase 1.4-1.7 of WF-ENH-2026-Q1
Created: 2026-02-06
"""
from django.db import transaction, models
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.system.models import TenantForm, TenantWorkForm, FormTypeChoices
from apps.system.workform_serializers import (
    TenantFormSerializer,
    TenantFormListSerializer,
    TenantWorkFormSerializer,
    TenantWorkFormListSerializer,
    FormMergeSerializer,
    FormSplitSerializer,
    WorkFormCloneSerializer,
)


class TenantFormViewSet(viewsets.ModelViewSet):
    """
    ViewSet for TenantForm CRUD operations.
    
    Endpoints:
    - GET    /api/v1/tenant-forms/           - List forms
    - POST   /api/v1/tenant-forms/           - Create form
    - GET    /api/v1/tenant-forms/{id}/      - Retrieve form
    - PUT    /api/v1/tenant-forms/{id}/      - Update form
    - DELETE /api/v1/tenant-forms/{id}/      - Delete form
    
    Filters:
    - type: single_step | multi_step
    - entity_type: supplier | customer | etc.
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter forms by tenant."""
        queryset = TenantForm.objects.filter(tenant=self.request.tenant)
        
        # Filter by type
        form_type = self.request.query_params.get('type')
        if form_type:
            queryset = queryset.filter(type=form_type)
        
        # Filter by search term (name or description)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(name__icontains=search) |
                models.Q(description__icontains=search)
            )

        # Filter: workform-generated forms
        is_workform = self.request.query_params.get('is_workform')
        if is_workform is not None:
            normalized = str(is_workform).strip().lower()
            if normalized in {'1', 'true', 'yes'}:
                queryset = queryset.filter(is_workform=True)
            elif normalized in {'0', 'false', 'no'}:
                queryset = queryset.filter(is_workform=False)

        parent_workform_id = self.request.query_params.get('parent_workform_id')
        if parent_workform_id:
            queryset = queryset.filter(parent_workform_id=parent_workform_id)
        
        return queryset.select_related('created_by', 'updated_by', 'parent_workform')
    
    def get_serializer_class(self):
        """Use lightweight serializer for list views."""
        if self.action == 'list':
            return TenantFormListSerializer
        return TenantFormSerializer
    
    def perform_create(self, serializer):
        """Assign tenant and creator on creation."""
        serializer.save(
            tenant=self.request.tenant,
            created_by=self.request.user,
            updated_by=self.request.user
        )
    
    def perform_update(self, serializer):
        """Update version and updater on modification."""
        instance = self.get_object()
        serializer.save(
            version=instance.version + 1,
            updated_by=self.request.user
        )
    
    def perform_destroy(self, instance):
        """Only allow deletion if usage_count is 0."""
        if instance.usage_count > 0:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                "error": f"Cannot delete form: referenced by {instance.usage_count} workflow(s)"
            })
        instance.delete()
    
    @action(detail=True, methods=['get'], url_path='usage')
    def get_usage(self, request, pk=None):
        """
        Get usage information for a form.
        
        Phase 6: Ghost Node Cleanup
        Returns usage count and list of workflows using this form.
        
        Response:
        {
            "form_id": "uuid",
            "usage_count": 5,
            "workflows": [
                {"id": "uuid", "name": "Workflow 1", "status": "active"},
                ...
            ]
        }
        """
        form = self.get_object()
        
        # Find workflows using this form
        workflows = TenantWorkForm.objects.filter(
            tenant=request.tenant,
            workflow_definition__contains={"tenantFormId": str(form.id)}
        ).values('id', 'name', 'status')
        
        return Response({
            "form_id": str(form.id),
            "usage_count": form.usage_count,
            "workflows": list(workflows)
        })
    
    @action(detail=True, methods=['post'], url_path='decrement-usage')
    def decrement_usage(self, request, pk=None):
        """
        Decrement usage count for a form.
        
        Phase 6: Ghost Node Cleanup
        Called when a container node is removed from a workflow.
        
        Request: {}
        Response: {
            "form_id": "uuid",
            "usage_count": 4,
            "can_delete": false
        }
        """
        form = self.get_object()
        
        if form.usage_count > 0:
            form.usage_count -= 1
            form.save(update_fields=['usage_count'])
        
        return Response({
            "form_id": str(form.id),
            "usage_count": form.usage_count,
            "can_delete": form.usage_count == 0
        })


class TenantWorkFormViewSet(viewsets.ModelViewSet):
    """
    ViewSet for TenantWorkForm CRUD operations.
    
    Endpoints:
    - GET    /api/v1/tenant-workforms/           - List workflows
    - POST   /api/v1/tenant-workforms/           - Create workflow
    - GET    /api/v1/tenant-workforms/{id}/      - Retrieve workflow
    - PUT    /api/v1/tenant-workforms/{id}/      - Update workflow
    - DELETE /api/v1/tenant-workforms/{id}/      - Delete workflow
    - POST   /api/v1/tenant-workforms/{id}/clone/ - Clone workflow
    - GET    /api/v1/tenant-workforms/{id}/usage/ - Get usage info
    - POST   /api/v1/tenant-workforms/{id}/validate/ - Validate workflow
    
    Filters:
    - status: draft | active | archived
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter workflows by tenant."""
        queryset = TenantWorkForm.objects.filter(tenant=self.request.tenant)
        
        # Filter by status
        workflow_status = self.request.query_params.get('status')
        if workflow_status:
            queryset = queryset.filter(status=workflow_status)
        
        # Filter by search term (name or description)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(name__icontains=search) |
                models.Q(description__icontains=search)
            )
        
        return queryset.select_related('created_by', 'updated_by', 'cloned_from')
    
    def get_serializer_class(self):
        """Use lightweight serializer for list views."""
        if self.action == 'list':
            return TenantWorkFormListSerializer
        return TenantWorkFormSerializer
    
    def perform_create(self, serializer):
        """Assign tenant and creator on creation."""
        serializer.save(
            tenant=self.request.tenant,
            created_by=self.request.user,
            updated_by=self.request.user
        )
    
    def perform_update(self, serializer):
        """Update version and updater on modification."""
        instance = self.get_object()
        serializer.save(
            version=instance.version + 1,
            updated_by=self.request.user
        )

    def _can_manage_workform(self, workform: TenantWorkForm) -> bool:
        """Only allow destructive/manage operations for superusers, tenant admins, or the creator."""
        request = self.request
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return False

        if getattr(user, 'is_superuser', False):
            return True

        if workform.created_by_id == user.id:
            return True

        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return False

        try:
            from apps.tenants.models import TenantUser

            tenant_user = TenantUser.objects.get(user=user, tenant=tenant, is_active=True)
            return tenant_user.role in ['owner', 'admin']
        except Exception:
            return False

    def _can_execute_workform(self, workform: TenantWorkForm) -> bool:
        """Allow execution for any active tenant member (plus creator/superuser)."""
        request = self.request
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return False

        if getattr(user, 'is_superuser', False):
            return True

        if workform.created_by_id == user.id:
            return True

        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return False

        try:
            from apps.tenants.models import TenantUser

            return TenantUser.objects.filter(user=user, tenant=tenant, is_active=True).exists()
        except Exception:
            return False

    def destroy(self, request, *args, **kwargs):
        workform = self.get_object()
        if not self._can_manage_workform(workform):
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """Execute a TenantWorkForm and create a persisted execution record."""
        workform = self.get_object()
        if not self._can_execute_workform(workform):
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        initial_data = request.data.get('initial_data') if isinstance(request.data, dict) else None
        initial_data = initial_data if isinstance(initial_data, dict) else {}

        from tenant_apps.workflows.models import TenantWorkFormExecution, TenantWorkFormExecutionStatus

        execution = TenantWorkFormExecution.objects.create(
            tenant=request.tenant,
            workform=workform,
            status=TenantWorkFormExecutionStatus.IN_PROGRESS,
            initial_data=initial_data,
            started_by=request.user,
            started_at=timezone.now(),
        )

        from apps.system.tasks import execute_workform_execution

        execute_workform_execution.delay(execution_id=str(execution.id), tenant_id=str(request.tenant.id))

        return Response(
            {
                'id': str(execution.id),
                'workform_id': str(workform.id),
                'workform_name': workform.name,
                'status': execution.status,
                'started_at': execution.started_at,
                'completed_at': None,
                'error_message': '',
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=['post'])
    def clone(self, request, pk=None):
        """
        Clone a workflow.
        
        POST /api/v1/tenant-workforms/{id}/clone/
        Body: {
            "new_name": "Cloned Workflow",
            "new_description": "Description",
            "include_form_references": true
        }
        """
        source_workform = self.get_object()
        serializer = WorkFormCloneSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        validated_data = serializer.validated_data
        
        # Create cloned workflow
        cloned_workform = TenantWorkForm.objects.create(
            tenant=request.tenant,
            name=validated_data['new_name'],
            description=validated_data.get('new_description', source_workform.description),
            status='draft',  # Always start as draft
            workflow_definition=source_workform.workflow_definition.copy(),
            form_references=source_workform.form_references.copy() if validated_data['include_form_references'] else [],
            created_by=request.user,
            updated_by=request.user,
            cloned_from=source_workform
        )
        
        # Clear form references if requested
        if not validated_data['include_form_references']:
            cloned_workform.form_references = []
            cloned_workform.save(update_fields=['form_references'])
        
        # Increment source clone count
        source_workform.increment_clone_count()
        
        return Response(
            TenantWorkFormSerializer(cloned_workform, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=True, methods=['get'])
    def usage(self, request, pk=None):
        """
        Get workflow usage information.
        
        GET /api/v1/tenant-workforms/{id}/usage/
        """
        workform = self.get_object()
        
        return Response({
            "id": str(workform.id),
            "name": workform.name,
            "execution_count": workform.execution_count,
            "last_executed_at": workform.last_executed_at,
            "clone_count": workform.clone_count,
            "node_count": workform.get_node_count(),
            "edge_count": workform.get_edge_count(),
            "form_references_count": len(workform.form_references),
            "created_at": workform.created_at,
            "updated_at": workform.updated_at
        })
    
    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        """
        Validate workflow for broken references.
        
        POST /api/v1/tenant-workforms/{id}/validate/
        """
        workform = self.get_object()
        validation_result = workform.validate_form_references()
        
        return Response(validation_result)
    
    @action(detail=True, methods=['get'], url_path='containers')
    def list_containers(self, request, pk=None):
        """
        Get all container nodes in the workflow.
        
        GET /api/v1/tenant-workforms/{id}/containers/
        
        Response: {
            "containers": [
                {
                    "id": "node-container-1",
                    "name": "Onboarding Flow",
                    "node_count": 5,
                    "node_types": {"formStep": 3, "actionEmail": 1, "conditionIf": 1}
                }
            ]
        }
        """
        workform = self.get_object()
        container_nodes = workform.get_container_nodes()
        
        containers_data = []
        for container in container_nodes:
            container_id = container.get('id')
            summary = workform.get_container_summary(container_id)
            containers_data.append({
                "id": container_id,
                "name": summary['container_name'],
                "node_count": summary['total_nodes'],
                "node_types": summary['node_types'],
                "form_references": summary['form_references']
            })
        
        return Response({"containers": containers_data})
    
    @action(detail=True, methods=['get'], url_path='containers/(?P<container_id>[^/.]+)')
    def container_detail(self, request, pk=None, container_id=None):
        """
        Get details of a specific container.
        
        GET /api/v1/tenant-workforms/{id}/containers/{container_id}/
        
        Response: {
            "container_id": "node-container-1",
            "container_name": "Onboarding Flow",
            "total_nodes": 5,
            "node_types": {"formStep": 3, "actionEmail": 1},
            "form_references": ["uuid1", "uuid2"],
            "nodes": [...]
        }
        """
        workform = self.get_object()
        summary = workform.get_container_summary(container_id)
        nodes = workform.get_nodes_in_container(container_id)
        
        return Response({
            "container_id": container_id,
            "container_name": summary['container_name'],
            "total_nodes": summary['total_nodes'],
            "node_types": summary['node_types'],
            "form_references": summary['form_references'],
            "nodes": nodes
        })
    
    @action(detail=True, methods=['post'], url_path='containers/add-node')
    def add_node_to_container(self, request, pk=None):
        """
        Add a node to a container.
        
        POST /api/v1/tenant-workforms/{id}/containers/add-node/
        Body: {
            "node_id": "node-5",
            "container_id": "node-container-1"
        }
        """
        workform = self.get_object()
        node_id = request.data.get('node_id')
        container_id = request.data.get('container_id')
        
        if not node_id or not container_id:
            return Response(
                {"error": "node_id and container_id are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        success = workform.update_node_container(node_id, container_id)
        
        if success:
            workform.save(update_fields=['workflow_definition'])
            return Response({
                "message": f"Node {node_id} added to container {container_id}",
                "node_id": node_id,
                "container_id": container_id
            })
        else:
            return Response(
                {"error": f"Node {node_id} not found"},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'], url_path='containers/remove-node')
    def remove_node_from_container(self, request, pk=None):
        """
        Remove a node from its container.
        
        POST /api/v1/tenant-workforms/{id}/containers/remove-node/
        Body: {
            "node_id": "node-5"
        }
        """
        workform = self.get_object()
        node_id = request.data.get('node_id')
        
        if not node_id:
            return Response(
                {"error": "node_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        success = workform.update_node_container(node_id, None)
        
        if success:
            workform.save(update_fields=['workflow_definition'])
            return Response({
                "message": f"Node {node_id} removed from container",
                "node_id": node_id
            })
        else:
            return Response(
                {"error": f"Node {node_id} not found"},
                status=status.HTTP_404_NOT_FOUND
            )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def merge_forms(request):
    """
    Merge multiple single-step forms into one multi-step form.
    
    POST /api/v1/tenant-forms/merge/
    Body: {
        "container_name": "Multi-Step Form",
        "description": "Optional description",
        "source_form_ids": ["uuid-1", "uuid-2", "uuid-3"]
    }
    
    Response: {
        "id": "new-multi-step-form-uuid",
        "name": "Multi-Step Form",
        "type": "multi_step",
        "steps": [...],
        "deleted_form_ids": ["uuid-1", "uuid-2", "uuid-3"]
    }
    """
    serializer = FormMergeSerializer(data=request.data, context={'request': request})
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    validated_data = serializer.validated_data
    
    with transaction.atomic():
        # Fetch source forms
        source_forms = TenantForm.objects.filter(
            tenant=request.tenant,
            id__in=validated_data['source_form_ids']
        ).order_by('created_at')
        
        # Build multi-step form definition
        steps = []
        for form in source_forms:
            step_data = {
                "name": form.name,
                "entity_type": form.get_entity_type(),
                "fields": form.form_definition.get('fields', [])
            }
            steps.append(step_data)
        
        multi_step_definition = {
            "steps": steps,
            "navigation": {
                "show_progress": True,
                "allow_back": True
            }
        }
        
        # Create new multi-step form
        merged_form = TenantForm.objects.create(
            tenant=request.tenant,
            name=validated_data['container_name'],
            description=validated_data.get('description', ''),
            type=FormTypeChoices.MULTI_STEP,
            form_definition=multi_step_definition,
            created_by=request.user,
            updated_by=request.user
        )
        
        # Delete source forms
        deleted_ids = list(source_forms.values_list('id', flat=True))
        source_forms.delete()
        
        return Response({
            "id": str(merged_form.id),
            "name": merged_form.name,
            "type": merged_form.type,
            "step_count": len(steps),
            "deleted_form_ids": [str(fid) for fid in deleted_ids],
            "message": f"Successfully merged {len(deleted_ids)} forms into 1 multi-step form"
        }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def split_form(request):
    """
    Split one step out of a multi-step form into a new single-step form.
    
    POST /api/v1/tenant-forms/split/
    Body: {
        "source_form_id": "uuid-123",
        "step_index": 1,
        "new_form_name": "Step 2",
        "new_form_description": "Optional"
    }
    
    Response: {
        "source_form_id": "uuid-123",
        "source_remaining_steps": 2,
        "created_form_id": "new-uuid",
        "created_form_name": "Step 2"
    }
    """
    serializer = FormSplitSerializer(data=request.data, context={'request': request})
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    validated_data = serializer.validated_data
    
    with transaction.atomic():
        # Fetch source form
        source_form = TenantForm.objects.get(
            tenant=request.tenant,
            id=validated_data['source_form_id']
        )
        
        steps = source_form.form_definition.get('steps', [])
        step_index = validated_data['step_index']
        
        if step_index >= len(steps):
            return Response(
                {"error": f"Step index {step_index} out of range (0-{len(steps)-1})"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Extract the step to split out
        extracted_step = steps.pop(step_index)
        
        # Create new single-step form from extracted step
        single_step_definition = {
            "entity_type": extracted_step.get('entity_type'),
            "fields": extracted_step.get('fields', [])
        }
        
        new_form = TenantForm.objects.create(
            tenant=request.tenant,
            name=validated_data['new_form_name'],
            description=validated_data.get('new_form_description', ''),
            type=FormTypeChoices.SINGLE_STEP,
            form_definition=single_step_definition,
            created_by=request.user,
            updated_by=request.user
        )
        
        # Update source form (remove the split step)
        if len(steps) == 1:
            # Convert to single-step if only one step remains
            source_form.type = FormTypeChoices.SINGLE_STEP
            source_form.form_definition = {
                "entity_type": steps[0].get('entity_type'),
                "fields": steps[0].get('fields', [])
            }
        else:
            # Keep as multi-step with remaining steps
            source_form.form_definition['steps'] = steps
        
        source_form.version += 1
        source_form.updated_by = request.user
        source_form.save()
        
        return Response({
            "source_form_id": str(source_form.id),
            "source_remaining_steps": len(steps),
            "source_type": source_form.type,
            "created_form_id": str(new_form.id),
            "created_form_name": new_form.name,
            "message": f"Successfully split step {step_index} into new form"
        }, status=status.HTTP_201_CREATED)
