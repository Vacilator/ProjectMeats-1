"""
Celery Tasks for System Management

Phase 6: Ghost Node Cleanup
Automated tasks for cleaning orphaned TenantForm records.

Created: 2026-02-12
"""
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from apps.system.models import TenantForm
import logging

logger = logging.getLogger(__name__)


@shared_task(name='system.cleanup_orphaned_forms')
def cleanup_orphaned_forms():
    """
    Clean up orphaned TenantForm records.
    
    Phase 6: Ghost Node Cleanup
    Deletes TenantForms that:
    - Have usage_count = 0
    - Are not templates (is_template = False)
    - Are older than 30 days
    
    Runs daily via Celery beat schedule.
    
    Returns:
        dict: Statistics about cleanup operation
    """
    # Calculate cutoff date (30 days ago)
    cutoff_date = timezone.now() - timedelta(days=30)
    
    # Find orphaned forms
    orphaned_forms = TenantForm.objects.filter(
        usage_count=0,
        is_template=False,
        created_at__lt=cutoff_date
    )
    
    # Count before deletion
    count = orphaned_forms.count()
    
    if count == 0:
        logger.info('[Cleanup] No orphaned forms to delete')
        return {
            'deleted': 0,
            'message': 'No orphaned forms found'
        }
    
    # Get form IDs for logging
    form_ids = list(orphaned_forms.values_list('id', flat=True))
    
    # Delete orphaned forms
    deleted_count, _ = orphaned_forms.delete()
    
    logger.info(f'[Cleanup] Deleted {deleted_count} orphaned forms: {form_ids}')
    
    return {
        'deleted': deleted_count,
        'form_ids': form_ids,
        'message': f'Successfully deleted {deleted_count} orphaned form(s)'
    }


@shared_task(name='system.audit_form_usage')
def audit_form_usage():
    """
    Audit form usage counts and fix discrepancies.
    
    Phase 6: Ghost Node Cleanup
    Verifies that usage_count matches actual workflow references.
    
    Returns:
        dict: Statistics about audit operation
    """
    from apps.system.models import TenantWorkForm
    
    fixed_count = 0
    discrepancies = []
    
    # Check all forms
    for form in TenantForm.objects.all():
        # Count actual workflow references
        actual_count = TenantWorkForm.objects.filter(
            tenant=form.tenant,
            workflow_definition__contains={"tenantFormId": str(form.id)}
        ).count()
        
        # Compare with stored count
        if actual_count != form.usage_count:
            discrepancies.append({
                'form_id': str(form.id),
                'form_name': form.name,
                'stored_count': form.usage_count,
                'actual_count': actual_count
            })
            
            # Fix the discrepancy
            form.usage_count = actual_count
            form.save(update_fields=['usage_count'])
            fixed_count += 1
    
    if fixed_count > 0:
        logger.warning(f'[Audit] Fixed {fixed_count} usage count discrepancies: {discrepancies}')
    else:
        logger.info('[Audit] All form usage counts are accurate')
    
    return {
        'fixed': fixed_count,
        'discrepancies': discrepancies,
        'message': f'Fixed {fixed_count} discrepancy/discrepancies' if fixed_count > 0 else 'All counts accurate'
    }


@shared_task(name='system.pin_workflow_versions')
def pin_workflow_versions(workflow_id):
    """
    Pin all container versions when workflow becomes ACTIVE.
    
    Phase 6: Ghost Node Cleanup
    Locks all tenantFormId references to prevent template changes
    from affecting active workflows.
    
    Args:
        workflow_id (str): UUID of the workflow to pin
    
    Returns:
        dict: Pinning operation results
    """
    from apps.system.models import TenantWorkForm
    
    try:
        workflow = TenantWorkForm.objects.get(id=workflow_id)
    except TenantWorkForm.DoesNotExist:
        logger.error(f'[Pin] Workflow {workflow_id} not found')
        return {
            'success': False,
            'error': 'Workflow not found'
        }
    
    # Only pin if status is ACTIVE
    if workflow.status != 'active':
        return {
            'success': False,
            'error': f'Workflow status is {workflow.status}, not active'
        }
    
    # Extract all container nodes
    nodes = workflow.workflow_definition.get('nodes', [])
    pinned_forms = []
    
    container_types = {
        'formBook',
        'formProcessGroup',
        'formProcess',
        'formMultiStepContainer',
        'smartWorkForm',
    }

    for node in nodes:
        if node.get('type') in container_types:
            tenant_form_id = (node.get('data') or {}).get('tenantFormId')
            
            if tenant_form_id:
                try:
                    form = TenantForm.objects.get(id=tenant_form_id, tenant=workflow.tenant)
                    pinned_forms.append({
                        'node_id': node.get('id'),
                        'form_id': str(form.id),
                        'form_name': form.name,
                        'version': form.version
                    })
                except TenantForm.DoesNotExist:
                    logger.warning(f'[Pin] Form {tenant_form_id} not found for node {node.get("id")}')
    
    # Store version snapshot in workflow metadata
    if not workflow.metadata:
        workflow.metadata = {}
    
    workflow.metadata['pinned_versions'] = {
        'pinned_at': timezone.now().isoformat(),
        'forms': pinned_forms
    }
    workflow.save(update_fields=['metadata'])
    
    logger.info(f'[Pin] Pinned {len(pinned_forms)} form versions for workflow {workflow_id}')
    
    return {
        'success': True,
        'workflow_id': str(workflow_id),
        'pinned_count': len(pinned_forms),
        'pinned_forms': pinned_forms
    }


@shared_task(name='system.execute_workform_execution')
def execute_workform_execution(execution_id: str, tenant_id: str) -> dict:
    """Execute a TenantWorkFormExecution asynchronously.

    This is used by the UI runtime route (/tenant-workforms/{id}/execute/) so
    Quick Actions can *run* workflows without blocking the request thread.
    """

    from apps.tenants.rls import set_current_tenant

    rls = set_current_tenant(str(tenant_id))
    if not rls.ok:
        logger.warning('[WorkFormExecution] Skipping execution=%s (RLS set failed: %s)', execution_id, rls.error)
        return {'success': False, 'error': rls.error}

    from tenant_apps.workflows.models import TenantWorkFormExecution, TenantWorkFormExecutionStatus
    from apps.system.services.workform_engine import WorkFormEngine

    execution = (
        TenantWorkFormExecution.objects.select_related('workform', 'tenant')
        .filter(id=execution_id, tenant_id=tenant_id)
        .first()
    )
    if not execution:
        return {'success': False, 'error': 'Execution not found'}

    workform = execution.workform
    initial_data = execution.initial_data or {}

    try:
        engine = WorkFormEngine(
            workform,
            initial_context={
                'trigger': initial_data,
                'variables': {},
                'errors': [],
                'execution_id': str(execution.id),
            },
        )
        result = engine.execute(trigger_payload=initial_data)

        execution.context_data = result.context
        execution.audit_trail = (result.context or {}).get('audit_trail', [])
        if result.success:
            execution.status = TenantWorkFormExecutionStatus.COMPLETED
        else:
            execution.status = TenantWorkFormExecutionStatus.FAILED
            execution.error_message = str(result.error or '')
        execution.completed_at = timezone.now()
        execution.save(update_fields=['status', 'context_data', 'audit_trail', 'error_message', 'completed_at'])

        return {'success': result.success, 'execution_id': str(execution.id), 'error': result.error}
    except Exception as exc:  # noqa: BLE001
        execution.status = TenantWorkFormExecutionStatus.FAILED
        execution.error_message = str(exc)
        execution.completed_at = timezone.now()
        execution.save(update_fields=['status', 'error_message', 'completed_at'])
        return {'success': False, 'execution_id': str(execution.id), 'error': str(exc)}


@shared_task(name='system.execute_workform_loop_item')
def execute_workform_loop_item(
    workform_id: str,
    loop_node_id: str,
    loop_body_start_node_id: str,
    index: int,
    item: object,
    base_context: dict | None = None,
):
    """Execute a single loop iteration by running the loop-body subgraph.

    Inputs:
    - loop_body_start_node_id: the node at the head of the Loop Body edge.
    - base_context: serialized context from the parent execution (trigger + variables).

    Behavior:
    - Runs a bounded sub-traversal starting at loop_body_start_node_id.
    - Stops if it reaches loop_node_id again (cycle boundary) or terminates naturally.
    """
    from apps.system.models import TenantWorkForm
    from apps.system.services.workform_engine import WorkFormEngine

    logger.info('[LoopItem] workform=%s loop_node=%s index=%s', workform_id, loop_node_id, index)

    workform = TenantWorkForm.objects.get(id=workform_id)

    initial_context = dict(base_context or {})
    initial_context.setdefault('trigger', {})
    initial_context.setdefault('variables', {})
    initial_context.setdefault('errors', [])

    # Per-iteration variables
    initial_context['variables'] = {
        **dict(initial_context.get('variables') or {}),
        'item': item,
        'index': index,
    }

    engine = WorkFormEngine(workform, initial_context=initial_context)
    result = engine.execute(
        trigger_payload=initial_context.get('trigger'),
        start_node_id=loop_body_start_node_id,
        stop_node_ids=[loop_node_id],
    )

    return {
        'success': result.success,
        'workform_id': workform_id,
        'loop_node_id': loop_node_id,
        'loop_body_start_node_id': loop_body_start_node_id,
        'index': index,
        'error': result.error,
    }
