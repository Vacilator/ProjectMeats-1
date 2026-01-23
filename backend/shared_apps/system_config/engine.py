"""
Workflow Engine for System Blueprint Runtime.

This module handles the execution of workflows defined by EntityBlueprints.
It validates data, manages state transitions, and performs data piping
between workflow steps.
"""
import logging
from typing import Dict, Any, Optional, List, Tuple
from django.db import transaction
from .models import EntityBlueprint, BlueprintVersion, WorkflowRun

logger = logging.getLogger(__name__)


class WorkflowEngineError(Exception):
    """Base exception for workflow engine errors."""
    pass


class ValidationError(WorkflowEngineError):
    """Raised when step data validation fails."""
    pass


class WorkflowEngine:
    """
    Core workflow execution engine.
    
    Handles workflow lifecycle:
    1. Start workflow (create WorkflowRun)
    2. Validate and submit step data
    3. Perform data piping between steps
    4. Manage state transitions
    """
    
    def start_workflow(
        self,
        tenant: Any,
        blueprint_slug: str,
        user: Any,
        initial_data: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Start a new workflow execution.
        
        Args:
            tenant: Tenant instance
            blueprint_slug: Slug of the EntityBlueprint to execute
            user: User initiating the workflow
            initial_data: Optional initial data for the first step
        
        Returns:
            Tuple of (run_id, step_0_schema)
        
        Raises:
            WorkflowEngineError: If blueprint not found or not published
        """
        try:
            # Get blueprint and published version
            blueprint = EntityBlueprint.objects.get(slug=blueprint_slug)
            
            if not blueprint.published_version:
                raise WorkflowEngineError(
                    f"Blueprint '{blueprint_slug}' has no published version"
                )
            
            version = blueprint.published_version
            
            if version.status != BlueprintVersion.StatusChoices.PUBLISHED:
                raise WorkflowEngineError(
                    f"Blueprint version is not published (status: {version.status})"
                )
            
            # Create workflow run
            with transaction.atomic():
                run = WorkflowRun.objects.create(
                    tenant=tenant,
                    workflow_slug=blueprint_slug,
                    status=WorkflowRun.StatusChoices.IN_PROGRESS,
                    current_step_index=0,
                    data_context={
                        'steps': [],
                        'metadata': {
                            'user_id': str(user.id),
                            'blueprint_id': str(blueprint.id),
                            'version_id': str(version.id),
                        }
                    }
                )
            
            # Get schema for step 0
            schema = self._get_step_schema(version, 0)
            
            # Apply initial data if provided
            if initial_data:
                schema['initial_data'] = initial_data
            
            logger.info(
                f"Started workflow '{blueprint_slug}' for tenant {tenant.id}, "
                f"run_id={run.id}"
            )
            
            return str(run.id), schema
            
        except EntityBlueprint.DoesNotExist:
            raise WorkflowEngineError(
                f"Blueprint '{blueprint_slug}' not found"
            )
    
    def submit_step(
        self,
        run: WorkflowRun,
        step_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Submit data for the current step and advance workflow.
        
        Args:
            run: WorkflowRun instance
            step_data: Data submitted for current step
        
        Returns:
            Dictionary with:
            - complete: bool (workflow finished?)
            - next_step_schema: dict (schema for next step, if not complete)
            - initial_data: dict (pre-filled data for next step, if applicable)
        
        Raises:
            ValidationError: If step_data validation fails
            WorkflowEngineError: For other execution errors
        """
        try:
            # Get blueprint version
            blueprint = EntityBlueprint.objects.get(slug=run.workflow_slug)
            version = blueprint.published_version
            
            if not version:
                raise WorkflowEngineError("Published version not found")
            
            current_step_index = run.current_step_index
            
            # Validate step data
            schema = self._get_step_schema(version, current_step_index)
            self._validate_step_data(step_data, schema)
            
            # Store step data in context
            with transaction.atomic():
                if 'steps' not in run.data_context:
                    run.data_context['steps'] = []
                
                run.data_context['steps'].append({
                    'step_index': current_step_index,
                    'data': step_data,
                    'schema_name': schema.get('name', f'Step {current_step_index}')
                })
                
                # Increment step index
                run.current_step_index += 1
                
                # Check if workflow is complete
                total_steps = self._get_total_steps(version)
                is_complete = run.current_step_index >= total_steps
                
                if is_complete:
                    run.status = WorkflowRun.StatusChoices.COMPLETED
                    run.save()
                    
                    logger.info(
                        f"Workflow run {run.id} completed for tenant {run.tenant_id}"
                    )
                    
                    return {
                        'complete': True,
                        'run_id': str(run.id),
                        'message': 'Workflow completed successfully'
                    }
                
                # Get next step schema and perform data piping
                next_step_index = run.current_step_index
                next_schema = self._get_step_schema(version, next_step_index)
                initial_data = self._perform_data_piping(
                    run,
                    version,
                    next_step_index
                )
                
                run.save()
                
                logger.info(
                    f"Advanced workflow run {run.id} to step {next_step_index}"
                )
                
                return {
                    'complete': False,
                    'next_step_schema': next_schema,
                    'initial_data': initial_data,
                    'current_step_index': next_step_index
                }
                
        except EntityBlueprint.DoesNotExist:
            raise WorkflowEngineError(
                f"Blueprint '{run.workflow_slug}' not found"
            )
    
    def _get_step_schema(
        self,
        version: BlueprintVersion,
        step_index: int
    ) -> Dict[str, Any]:
        """
        Get schema configuration for a specific step.
        
        Args:
            version: BlueprintVersion instance
            step_index: Index of the step
        
        Returns:
            Schema dictionary with field definitions
        """
        # For simplicity, we're treating schema_config as a single step
        # In a multi-step workflow, logic_config would define multiple steps
        
        if step_index == 0:
            return {
                'step_index': step_index,
                'name': f'{version.blueprint.name} - Step {step_index + 1}',
                'fields': version.schema_config,
                'description': f'Enter data for {version.blueprint.name}'
            }
        
        # Future: Parse logic_config for multi-step workflows
        # For now, single-step workflow
        return {
            'step_index': step_index,
            'name': f'Step {step_index + 1}',
            'fields': [],
            'description': 'No fields defined for this step'
        }
    
    def _get_total_steps(self, version: BlueprintVersion) -> int:
        """
        Calculate total number of steps in workflow.
        
        Args:
            version: BlueprintVersion instance
        
        Returns:
            Number of steps
        """
        # For now, single-step workflows
        # Future: Parse logic_config to determine step count
        return 1
    
    def _validate_step_data(
        self,
        step_data: Dict[str, Any],
        schema: Dict[str, Any]
    ) -> None:
        """
        Validate submitted step data against schema.
        
        Args:
            step_data: Data submitted by user
            schema: Schema definition for the step
        
        Raises:
            ValidationError: If validation fails
        """
        fields = schema.get('fields', [])
        errors = []
        
        for field in fields:
            field_key = field.get('key')
            field_label = field.get('label', field_key)
            field_type = field.get('type', 'text')
            is_required = field.get('required', False)
            
            value = step_data.get(field_key)
            
            # Required field validation
            if is_required and (value is None or value == ''):
                errors.append(f"Field '{field_label}' is required")
                continue
            
            # Type-specific validation (basic)
            if value is not None and value != '':
                if field_type == 'number':
                    try:
                        float(value)
                    except (ValueError, TypeError):
                        errors.append(
                            f"Field '{field_label}' must be a number"
                        )
                
                elif field_type == 'email':
                    if '@' not in str(value):
                        errors.append(
                            f"Field '{field_label}' must be a valid email"
                        )
                
                elif field_type == 'url':
                    if not str(value).startswith(('http://', 'https://')):
                        errors.append(
                            f"Field '{field_label}' must be a valid URL"
                        )
        
        if errors:
            raise ValidationError(
                f"Validation failed: {'; '.join(errors)}"
            )
    
    def _perform_data_piping(
        self,
        run: WorkflowRun,
        version: BlueprintVersion,
        next_step_index: int
    ) -> Dict[str, Any]:
        """
        Perform data piping for the next step.
        
        Data piping maps values from previous steps to pre-fill
        fields in the next step based on logic_config mappings.
        
        Args:
            run: WorkflowRun instance
            version: BlueprintVersion instance
            next_step_index: Index of the next step
        
        Returns:
            Dictionary of pre-filled data for next step
        """
        initial_data = {}
        
        # Get logic config for next step
        logic_config = version.logic_config
        
        if not logic_config or 'steps' not in logic_config:
            return initial_data
        
        steps = logic_config.get('steps', [])
        
        if next_step_index >= len(steps):
            return initial_data
        
        next_step_config = steps[next_step_index]
        mappings = next_step_config.get('mappings', [])
        
        # Process each mapping
        for mapping in mappings:
            target_key = mapping.get('target')
            source_key = mapping.get('source')
            
            if not target_key or not source_key:
                continue
            
            # Retrieve value from data_context
            value = self._resolve_source_value(run.data_context, source_key)
            
            if value is not None:
                initial_data[target_key] = value
            else:
                logger.warning(
                    f"Could not resolve source key '{source_key}' "
                    f"for mapping in step {next_step_index}"
                )
        
        return initial_data
    
    def _resolve_source_value(
        self,
        data_context: Dict[str, Any],
        source_key: str
    ) -> Optional[Any]:
        """
        Resolve a source key from data_context.
        
        Supports dot notation for nested access:
        - 'steps.0.data.customer_name'
        - 'metadata.user_id'
        
        Args:
            data_context: Workflow data context
            source_key: Key to resolve (supports dot notation)
        
        Returns:
            Resolved value or None if not found
        """
        try:
            parts = source_key.split('.')
            value = data_context
            
            for part in parts:
                if isinstance(value, dict):
                    value = value.get(part)
                elif isinstance(value, list):
                    try:
                        index = int(part)
                        value = value[index]
                    except (ValueError, IndexError):
                        return None
                else:
                    return None
                
                if value is None:
                    return None
            
            return value
            
        except Exception as e:
            logger.error(
                f"Error resolving source key '{source_key}': {e}"
            )
            return None


# Singleton instance
engine = WorkflowEngine()
