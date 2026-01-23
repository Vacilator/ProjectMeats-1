from django.shortcuts import render
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.conf import settings
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import WorkflowRun, EntityBlueprint, BlueprintVersion
from .engine import engine, WorkflowEngineError, ValidationError
from .serializers import (
    WorkflowRunSerializer,
    StartWorkflowSerializer,
    SubmitStepSerializer,
    BlueprintListSerializer,
)


class IsGlobalSystemAdminMixin(UserPassesTestMixin):
    """
    Mixin to verify user is a Global System Admin.
    Global System Admins are members of the 'Global System Admins' group.
    """
    def test_func(self):
        return self.request.user.groups.filter(name='Global System Admins').exists()


class StudioView(LoginRequiredMixin, IsGlobalSystemAdminMixin, TemplateView):
    """
    Blueprint Studio host view.
    
    This view serves as the bridge between Django and the React-based
    Blueprint Studio. It provides a clean HTML shell that loads the
    React application without inheriting Django admin CSS conflicts.
    
    Permissions:
    - User must be authenticated
    - User must be a member of 'Global System Admins' group
    
    Context:
    - blueprint_id: UUID of the blueprint being edited
    - csrf_token: CSRF token for API requests
    - debug: Debug mode flag for dev/prod asset loading
    """
    template_name = 'admin/studio_host.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['blueprint_id'] = kwargs.get('blueprint_id')
        context['debug'] = settings.DEBUG
        return context


class WorkflowRunViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing workflow execution.
    
    Provides endpoints for:
    - Starting workflows (create)
    - Submitting step data (submit_step action)
    - Retrieving workflow status (retrieve, list)
    
    Permissions:
    - IsAuthenticated: All tenant users
    - Tenant isolation: Users only see their tenant's workflows
    """
    queryset = WorkflowRun.objects.all()
    serializer_class = WorkflowRunSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter workflows by tenant."""
        return WorkflowRun.objects.filter(tenant=self.request.tenant)
    
    def get_serializer_class(self):
        """Dynamic serializer based on action."""
        if self.action == 'create':
            return StartWorkflowSerializer
        elif self.action == 'submit_step':
            return SubmitStepSerializer
        return WorkflowRunSerializer
    
    def create(self, request, *args, **kwargs):
        """
        Start a new workflow execution.
        
        Request Body:
        {
            "blueprint_slug": "customer-onboarding",
            "initial_data": {...}  // Optional
        }
        
        Response:
        {
            "run_id": "uuid",
            "step_schema": {...}
        }
        """
        try:
            blueprint_slug = request.data.get('blueprint_slug')
            initial_data = request.data.get('initial_data', {})
            
            if not blueprint_slug:
                return Response(
                    {'error': 'blueprint_slug is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            run_id, step_schema = engine.start_workflow(
                tenant=request.tenant,
                blueprint_slug=blueprint_slug,
                user=request.user,
                initial_data=initial_data
            )
            
            return Response({
                'run_id': run_id,
                'step_schema': step_schema,
                'message': 'Workflow started successfully'
            }, status=status.HTTP_201_CREATED)
            
        except WorkflowEngineError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Internal error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def submit_step(self, request, pk=None):
        """
        Submit data for the current step and advance workflow.
        
        Request Body:
        {
            "step_data": {...}
        }
        
        Response (not complete):
        {
            "complete": false,
            "next_step_schema": {...},
            "initial_data": {...},
            "current_step_index": 1
        }
        
        Response (complete):
        {
            "complete": true,
            "run_id": "uuid",
            "message": "Workflow completed successfully"
        }
        """
        try:
            run = self.get_object()
            step_data = request.data.get('step_data', {})
            
            if not step_data:
                return Response(
                    {'error': 'step_data is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            result = engine.submit_step(run, step_data)
            
            return Response(result, status=status.HTTP_200_OK)
            
        except ValidationError as e:
            return Response(
                {'error': str(e), 'type': 'validation'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except WorkflowEngineError as e:
            return Response(
                {'error': str(e), 'type': 'workflow'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Internal error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def retrieve(self, request, *args, **kwargs):
        """
        Get workflow run details.
        
        Response:
        {
            "id": "uuid",
            "workflow_slug": "customer-onboarding",
            "status": "IN_PROGRESS",
            "current_step_index": 0,
            "data_context": {...},
            "created_on": "2026-01-23T...",
            "modified_on": "2026-01-23T..."
        }
        """
        run = self.get_object()
        
        return Response({
            'id': str(run.id),
            'workflow_slug': run.workflow_slug,
            'status': run.status,
            'current_step_index': run.current_step_index,
            'data_context': run.data_context,
            'created_on': run.created_on.isoformat(),
            'modified_on': run.modified_on.isoformat()
        })


class AvailableWorkflowsViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    Public catalog of available workflows for tenant users.
    
    Provides read-only access to published blueprints that can be
    started by any authenticated user. This is the "App Store" view
    where users discover and launch workflows.
    
    Permissions:
    - IsAuthenticated: Any logged-in tenant user
    - No admin privileges required
    
    Response:
    [
        {
            "id": "uuid",
            "name": "Customer Onboarding",
            "slug": "customer-onboarding",
            "created_at": "2026-01-23T..."
        },
        ...
    ]
    """
    serializer_class = BlueprintListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # Disable pagination for simple catalog view
    
    def get_queryset(self):
        """
        Return only published blueprints.
        
        Filters to blueprints that have a published_version set,
        meaning they are ready for execution by tenant users.
        """
        return EntityBlueprint.objects.filter(
            published_version__isnull=False
        ).select_related('published_version')


class BlueprintVersionViewSet(viewsets.GenericViewSet,
                               mixins.RetrieveModelMixin):
    """
    ViewSet for Blueprint Version management in Studio.
    
    Provides endpoints for:
    - GET: Retrieve full blueprint version details
    - PATCH: Update schema_config
    - PATCH: Update workflow_config
    - POST: Publish version (make available to users)
    - POST: Unpublish version (remove from catalog)
    
    Permissions:
    - Global System Admins only
    
    Used by the Visual Studio frontend for loading and saving
    blueprint configurations.
    """
    queryset = BlueprintVersion.objects.all()
    serializer_class = BlueprintVersionDetailSerializer
    permission_classes = [IsAuthenticated]
    
    def check_permissions(self, request):
        """Verify user is Global System Admin."""
        super().check_permissions(request)
        if not request.user.groups.filter(name='Global System Admins').exists():
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only Global System Admins can access the Studio API')
    
    @action(detail=True, methods=['patch'], url_path='schema')
    def update_schema(self, request, pk=None):
        """
        Update schema_config only.
        
        PATCH /api/studio/versions/{id}/schema/
        Body: {"schema_config": [...]}
        """
        from .serializers import UpdateSchemaConfigSerializer
        
        version = self.get_object()
        serializer = UpdateSchemaConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        version.schema_config = serializer.validated_data['schema_config']
        version.save(update_fields=['schema_config'])
        
        return Response({
            'message': 'Schema configuration updated successfully',
            'schema_config': version.schema_config
        })
    
    @action(detail=True, methods=['patch'], url_path='workflow')
    def update_workflow(self, request, pk=None):
        """
        Update workflow_config only.
        
        PATCH /api/studio/versions/{id}/workflow/
        Body: {"workflow_config": [...]}
        """
        from .serializers import UpdateWorkflowConfigSerializer
        
        version = self.get_object()
        serializer = UpdateWorkflowConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        version.workflow_config = serializer.validated_data['workflow_config']
        version.save(update_fields=['workflow_config'])
        
        return Response({
            'message': 'Workflow configuration updated successfully',
            'workflow_config': version.workflow_config
        })
    
    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        """
        Publish this version, making it available to tenant users.
        
        POST /api/studio/versions/{id}/publish/
        
        This action:
        1. Sets version status to PUBLISHED
        2. Sets this version as the blueprint's published_version
        3. Makes the workflow appear in the /workflows catalog
        
        Response:
        {
            "message": "Version published successfully",
            "status": "PUBLISHED",
            "published_version_id": "uuid",
            "blueprint_name": "Customer Onboarding"
        }
        """
        version = self.get_object()
        blueprint = version.blueprint
        
        # Update version status to PUBLISHED
        version.status = BlueprintVersion.StatusChoices.PUBLISHED
        version.save(update_fields=['status'])
        
        # Set this version as the published_version on the blueprint
        blueprint.published_version = version
        blueprint.save(update_fields=['published_version'])
        
        return Response({
            'message': f'Version {version.version} published successfully',
            'status': version.status,
            'published_version_id': str(version.id),
            'blueprint_name': blueprint.name,
            'blueprint_slug': blueprint.slug
        })
    
    @action(detail=True, methods=['post'], url_path='unpublish')
    def unpublish(self, request, pk=None):
        """
        Unpublish this version, removing it from the catalog.
        
        POST /api/studio/versions/{id}/unpublish/
        
        This action:
        1. Removes this version as the published_version (if it is)
        2. Sets version status back to DRAFT
        3. Removes the workflow from the /workflows catalog
        
        Response:
        {
            "message": "Version unpublished successfully",
            "status": "DRAFT",
            "blueprint_name": "Customer Onboarding"
        }
        """
        version = self.get_object()
        blueprint = version.blueprint
        
        # Only unpublish if this is the currently published version
        if blueprint.published_version == version:
            blueprint.published_version = None
            blueprint.save(update_fields=['published_version'])
        
        # Update version status back to DRAFT
        version.status = BlueprintVersion.StatusChoices.DRAFT
        version.save(update_fields=['status'])
        
        return Response({
            'message': f'Version {version.version} unpublished successfully',
            'status': version.status,
            'blueprint_name': blueprint.name,
            'blueprint_slug': blueprint.slug
        })

