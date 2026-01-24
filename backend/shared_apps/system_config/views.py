import logging
from django.shortcuts import render
from django.core.exceptions import MultipleObjectsReturned
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.conf import settings
from django.apps import apps
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
    BlueprintVersionDetailSerializer,
    UpdateSchemaConfigSerializer,
    UpdateWorkflowConfigSerializer,
)

logger = logging.getLogger(__name__)
import logging

logger = logging.getLogger(__name__)


class IsGlobalSystemAdminMixin(UserPassesTestMixin):
    """
    Mixin to verify user is a Global System Admin.
    Global System Admins are members of the 'Global System Admins' group.
    """
    def test_func(self):
        return self.request.user.groups.filter(name='Global System Admins').exists()


class StudioLandingView(LoginRequiredMixin, IsGlobalSystemAdminMixin, TemplateView):
    """
    Blueprint Studio landing page - lists all blueprints.
    
    This view provides a dashboard where admins can:
    - See all existing blueprints
    - Create new blueprints
    - Navigate to Studio editor for specific blueprints
    
    Permissions:
    - User must be authenticated
    - User must be a member of 'Global System Admins' group
    """
    template_name = 'admin/studio_landing.html'
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # Get all blueprints with their latest version
        blueprints = []
        for bp in EntityBlueprint.objects.all().prefetch_related('versions'):
            latest_version = bp.versions.order_by('-version').first()
            
            bp_data = {
                'id': bp.id,
                'name': bp.name,
                'slug': bp.slug,
                'published_version': bp.published_version,
                'latest_version': None,
            }
            
            if latest_version:
                bp_data['latest_version'] = {
                    'id': latest_version.id,
                    'version': latest_version.version,
                    'status': latest_version.status,
                    'schema_field_count': len(latest_version.schema_config),
                    'workflow_step_count': len(latest_version.workflow_config),
                }
            
            blueprints.append(bp_data)
        
        context['blueprints'] = blueprints
        return context


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
        Get workflow run details with enhanced monitoring data.
        
        Response:
        {
            "id": "uuid",
            "workflow_slug": "customer-onboarding",
            "status": "IN_PROGRESS",
            "current_step_index": 0,
            "data_context": {...},
            "created_on": "2026-01-23T...",
            "modified_on": "2026-01-23T...",
            "workflow_name": "Customer Onboarding",
            "total_steps": 5,
            "progress_percentage": 40,
            "execution_history": [...],
            "error_log": [...]
        }
        """
        try:
            run = self.get_object()
            
            # Defaults
            total_steps = 0
            progress_percentage = 0
            step_details = []
            blueprint_name = run.workflow_slug

            # Get the blueprint to fetch workflow steps
            try:
                blueprint = EntityBlueprint.objects.select_related('published_version').get(slug=run.workflow_slug)
                blueprint_name = blueprint.name
                published_version = blueprint.published_version
                
                if published_version and isinstance(published_version.workflow_config, dict):
                    workflow_steps = published_version.workflow_config.get('steps', [])
                    if isinstance(workflow_steps, list):
                        total_steps = len(workflow_steps)
                        progress_percentage = int((run.current_step_index / total_steps * 100)) if total_steps > 0 else 0
                        
                        # Build step details
                        for idx, step in enumerate(workflow_steps):
                            if not isinstance(step, dict): continue
                            step_status = 'completed' if idx < run.current_step_index else ('current' if idx == run.current_step_index else 'pending')
                            step_details.append({
                                'index': idx,
                                'id': step.get('id'),
                                'label': step.get('label', f'Step {idx + 1}'),
                                'type': step.get('type'),
                                'status': step_status
                            })
            except (EntityBlueprint.DoesNotExist, MultipleObjectsReturned):
                # Fallback to defaults
                pass
            except Exception as e:
                logger.warning(f"Error fetching blueprint for run {run.id}: {e}")
            
            # Extract execution history from data_context safely
            execution_history = []
            error_log = []
            
            if isinstance(run.data_context, dict):
                execution_history = run.data_context.get('_execution_history', [])
                error_log = run.data_context.get('_error_log', [])
            
            return Response({
                'id': str(run.id),
                'workflow_slug': run.workflow_slug,
                'workflow_name': blueprint_name,
                'status': run.status,
                'current_step_index': run.current_step_index,
                'total_steps': total_steps,
                'progress_percentage': progress_percentage,
                'step_details': step_details,
                'data_context': run.data_context if isinstance(run.data_context, dict) else {},
                'execution_history': execution_history,
                'error_log': error_log,
                'created_on': run.created_on.isoformat(),
                'modified_on': run.modified_on.isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error retrieving workflow run {kwargs.get('pk')}: {e}", exc_info=True)
            return Response(
                {'error': 'Internal server error retrieving workflow run.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'], url_path='execution-log')
    def execution_log(self, request, pk=None):
        """
        Get detailed execution log for debugging.
        
        GET /api/system-config/runs/{id}/execution-log/
        
        Response:
        {
            "run_id": "uuid",
            "workflow_slug": "customer-onboarding",
            "status": "IN_PROGRESS",
            "timeline": [
                {
                    "timestamp": "2026-01-23T19:30:00Z",
                    "event": "workflow_started",
                    "step_index": 0,
                    "message": "Workflow execution started"
                },
                {
                    "timestamp": "2026-01-23T19:30:15Z",
                    "event": "step_completed",
                    "step_index": 0,
                    "step_name": "Personal Info",
                    "data": {...}
                }
            ],
            "errors": [...],
            "current_state": {...}
        }
        """
        run = self.get_object()
        
        # Build timeline from execution history
        timeline = run.data_context.get('_execution_history', [])
        errors = run.data_context.get('_error_log', [])
        
        return Response({
            'run_id': str(run.id),
            'workflow_slug': run.workflow_slug,
            'status': run.status,
            'timeline': timeline,
            'errors': errors,
            'current_state': {
                'current_step_index': run.current_step_index,
                'status': run.status,
                'last_updated': run.modified_on.isoformat()
            }
        })
    
    @action(detail=False, methods=['get'], url_path='my-workflows')
    def my_workflows(self, request):
        """
        Get all workflow runs for the current user's tenant.
        
        GET /api/system-config/runs/my-workflows/
        
        Query params:
        - status: Filter by status (IN_PROGRESS, COMPLETED, FAILED)
        - limit: Number of results (default 20)
        
        Response:
        {
            "count": 25,
            "results": [
                {
                    "id": "uuid",
                    "workflow_slug": "customer-onboarding",
                    "workflow_name": "Customer Onboarding",
                    "status": "IN_PROGRESS",
                    "progress_percentage": 60,
                    "created_on": "2026-01-23T19:30:00Z"
                }
            ]
        }
        """
        # Check if tenant exists
        if not hasattr(request, 'tenant') or request.tenant is None:
            return Response({
                'count': 0,
                'results': [],
                'message': 'No tenant context found'
            })
        
        queryset = self.get_queryset()
        
        # Apply filters
        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Limit results
        try:
            limit = int(request.query_params.get('limit', 20))
        except (ValueError, TypeError):
            limit = 20
        
        queryset = queryset[:limit]
        
        # Prefetch blueprints to avoid N+1 queries
        try:
            workflow_slugs = list(queryset.values_list('workflow_slug', flat=True).distinct())
            blueprints_map = {
                bp.slug: bp 
                for bp in EntityBlueprint.objects.filter(slug__in=workflow_slugs).select_related('published_version')
            }
        except Exception as e:
            logger.error(f"Error fetching blueprints: {e}")
            blueprints_map = {}
        
        results = []
        for run in queryset:
            try:
                blueprint = blueprints_map.get(run.workflow_slug)
                if blueprint:
                    workflow_name = blueprint.name
                    
                    # Calculate progress
                    published_version = blueprint.published_version
                    if published_version and published_version.workflow_config:
                        total_steps = len(published_version.workflow_config.get('steps', []))
                        progress = int((run.current_step_index / total_steps * 100)) if total_steps > 0 else 0
                    else:
                        progress = 0
                else:
                    workflow_name = run.workflow_slug
                    progress = 0
                
                results.append({
                    'id': str(run.id),
                    'workflow_slug': run.workflow_slug,
                    'workflow_name': workflow_name,
                    'status': run.status,
                    'progress_percentage': progress,
                    'current_step_index': run.current_step_index,
                    'created_on': run.created_on.isoformat(),
                    'modified_on': run.modified_on.isoformat()
                })
            except Exception as e:
                logger.error(f"Error processing workflow run {run.id}: {e}")
                continue
        
        return Response({
            'count': len(results),
            'results': results
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
                               mixins.RetrieveModelMixin,
                               mixins.UpdateModelMixin):
    """
    ViewSet for Blueprint Version management in Studio.
    
    Provides endpoints for:
    - GET: Retrieve full blueprint version details
    - PATCH: Partial update (schema_config, workflow_config, logic_config)
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
    
    def partial_update(self, request, *args, **kwargs):
        """
        Partial update for blueprint version configuration.
        
        PATCH /api/system-config/api/studio/versions/{id}/
        
        Accepts any combination of:
        - schema_config: List of field definitions
        - workflow_config: Workflow step definitions
        - logic_config: Field mappings and orchestration logic
        
        Returns the updated version data.
        """
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        return Response({
            'message': 'Configuration updated successfully',
            'data': serializer.data
        })
    
    @action(detail=True, methods=['patch'], url_path='schema')
    def update_schema(self, request, pk=None):
        """
        Update schema_config only.
        
        PATCH /api/studio/versions/{id}/schema/
        Body: {"schema_config": [...]}
        """
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
    
    @action(detail=False, methods=['get'], url_path='history')
    def version_history(self, request):
        """
        Get version history for a blueprint.
        
        GET /api/studio/versions/history/?blueprint_id={uuid}
        
        Returns list of all versions with metadata.
        """
        blueprint_id = request.query_params.get('blueprint_id')
        if not blueprint_id:
            return Response(
                {'error': 'blueprint_id parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            blueprint = EntityBlueprint.objects.get(id=blueprint_id)
        except EntityBlueprint.DoesNotExist:
            return Response(
                {'error': 'Blueprint not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        versions = blueprint.versions.all().order_by('-created_at')
        
        history = []
        for version in versions:
            history.append({
                'id': str(version.id),
                'version': version.version,
                'status': version.status,
                'created_at': version.created_at.isoformat(),
                'is_published': blueprint.published_version_id == version.id,
                'field_count': len(version.schema_config) if version.schema_config else 0,
                'step_count': len(version.workflow_config.get('steps', [])) if version.workflow_config else 0
            })
        
        return Response({
            'blueprint_id': str(blueprint.id),
            'blueprint_name': blueprint.name,
            'blueprint_slug': blueprint.slug,
            'versions': history
        })
    
    @action(detail=True, methods=['get'], url_path='compare')
    def compare_versions(self, request, pk=None):
        """
        Compare two versions to see what changed.
        
        GET /api/studio/versions/{id}/compare/?with={other_id}
        """
        version_a = self.get_object()
        other_id = request.query_params.get('with')
        
        if not other_id:
            return Response(
                {'error': 'with parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            version_b = BlueprintVersion.objects.get(id=other_id)
        except BlueprintVersion.DoesNotExist:
            return Response(
                {'error': 'Comparison version not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Compare schemas
        schema_a = {field.get('key'): field for field in (version_a.schema_config or [])}
        schema_b = {field.get('key'): field for field in (version_b.schema_config or [])}
        
        added_fields = [schema_b[k] for k in schema_b.keys() - schema_a.keys()]
        removed_fields = [schema_a[k] for k in schema_a.keys() - schema_b.keys()]
        modified_fields = []
        
        for key in schema_a.keys() & schema_b.keys():
            if schema_a[key] != schema_b[key]:
                modified_fields.append({
                    'key': key,
                    'before': schema_a[key],
                    'after': schema_b[key]
                })
        
        # Compare workflows
        steps_a = {s.get('id'): s for s in version_a.workflow_config.get('steps', [])} if version_a.workflow_config else {}
        steps_b = {s.get('id'): s for s in version_b.workflow_config.get('steps', [])} if version_b.workflow_config else {}
        
        added_steps = [steps_b[k] for k in steps_b.keys() - steps_a.keys()]
        removed_steps = [steps_a[k] for k in steps_a.keys() - steps_b.keys()]
        modified_steps = []
        
        for step_id in steps_a.keys() & steps_b.keys():
            if steps_a[step_id] != steps_b[step_id]:
                modified_steps.append({
                    'id': step_id,
                    'before': steps_a[step_id],
                    'after': steps_b[step_id]
                })
        
        return Response({
            'version_a': {
                'id': str(version_a.id),
                'version': version_a.version,
                'created_at': version_a.created_at.isoformat(),
                'status': version_a.status
            },
            'version_b': {
                'id': str(version_b.id),
                'version': version_b.version,
                'created_at': version_b.created_at.isoformat(),
                'status': version_b.status
            },
            'differences': {
                'schema': {
                    'added_fields': added_fields,
                    'removed_fields': removed_fields,
                    'modified_fields': modified_fields
                },
                'workflow': {
                    'added_steps': added_steps,
                    'removed_steps': removed_steps,
                    'modified_steps': modified_steps
                }
            }
        })
    
    @action(detail=True, methods=['post'], url_path='rollback')
    def rollback(self, request, pk=None):
        """
        Rollback to this version by creating a new version.
        
        POST /api/studio/versions/{id}/rollback/
        """
        source_version = self.get_object()
        blueprint = source_version.blueprint
        
        # Get the latest version number
        latest_version = blueprint.versions.order_by('-version').first()
        new_version_number = latest_version.version + 1 if latest_version else 1
        
        # Create new version with source version's config
        new_version = BlueprintVersion.objects.create(
            blueprint=blueprint,
            version=new_version_number,
            status=BlueprintVersion.StatusChoices.DRAFT,
            schema_config=source_version.schema_config,
            workflow_config=source_version.workflow_config,
            logic_config=source_version.logic_config
        )
        
        return Response({
            'message': f'Rolled back to version {source_version.version}',
            'new_version_id': str(new_version.id),
            'new_version_number': new_version.version,
            'source_version': source_version.version
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'], url_path='available-entities')
    def available_entities(self, request):
        """
        Get list of available entities (models) for workflow configuration.
        
        GET /api/studio/versions/available-entities/
        
        Returns a list of entities with their fields for use in the Studio UI.
        Format: [
            {
                "value": "customer",
                "label": "👤 Customer", 
                "fields": ["id", "name", "email", "phone"],
                "app_label": "core"
            },
            ...
        ]
        
        This replaces hardcoded entity lists in the frontend with dynamic data
        from the actual Django models in the system.
        """
        # Define core business entities to expose
        # Format: (app_label, model_name, emoji, display_name)
        EXPOSED_MODELS = [
            ('core', 'Protein', '🥩', 'Protein'),
            ('tenants', 'Tenant', '🏢', 'Tenant'),
            ('tenants', 'TenantUser', '👤', 'User'),
            ('auth', 'User', '👤', 'System User'),
            # Add more models as they're created in the system
        ]
        
        entities = []
        
        for app_label, model_name, emoji, display_name in EXPOSED_MODELS:
            try:
                model = apps.get_model(app_label, model_name)
                
                # Extract field names from the model
                fields = []
                for field in model._meta.get_fields():
                    # Include only concrete fields (not reverse relations)
                    if field.concrete and not field.many_to_many:
                        fields.append(field.name)
                
                # Build entity definition
                entity = {
                    'value': model_name.lower(),
                    'label': f'{emoji} {display_name}',
                    'fields': fields[:10],  # Limit to first 10 fields for UI
                    'app_label': app_label,
                    'model_name': model_name
                }
                
                entities.append(entity)
                
            except LookupError:
                # Model doesn't exist, skip it
                logger.warning(f"Model {app_label}.{model_name} not found")
                continue
        
        return Response({
            'count': len(entities),
            'entities': entities
        })


