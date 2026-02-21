"""
Celery Tasks for Workflow Execution.

Phase 5 Part 2 - Backend execution layer for scheduled and event-driven workflows.

Tasks:
- execute_scheduled_workflow: Run workflows on cron schedule
- execute_event_workflow: Run workflows triggered by entity changes
- execute_workflow_action: Execute individual workflow actions
- cleanup_old_executions: Maintenance task for execution history
"""
import logging
from celery import shared_task
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)


@shared_task(name='workflows.execute_scheduled_workflow')
def execute_scheduled_workflow(workflow_id: int, tenant_id: int):
    """
    Execute a scheduled workflow via Celery beat.
    
    Args:
        workflow_id: ID of the workflow to execute
        tenant_id: ID of the tenant (for multi-tenancy)
    
    Returns:
        dict: Execution result with status and execution_id
    """
    from .models import TenantWorkflow, WorkflowExecution
    from .engine import WorkflowEngine
    from apps.tenants.models import Tenant
    
    try:
        tenant = Tenant.objects.get(id=tenant_id)
        workflow = TenantWorkflow.objects.get(id=workflow_id, tenant=tenant)
        
        logger.info(f"[Celery] Executing scheduled workflow: {workflow.name} (ID: {workflow_id})")
        
        # Create execution record
        execution = WorkflowExecution.objects.create(
            workflow=workflow,
            tenant=tenant,
            trigger_type='scheduled',
            status='running',
            started_at=timezone.now(),
        )
        
        # Execute workflow using the engine
        engine = WorkflowEngine(workflow)
        result = engine.execute(context={
            'execution_id': execution.id,
            'trigger': 'scheduled',
            'scheduled_at': timezone.now().isoformat(),
        })
        
        # Update execution record
        execution.status = 'completed' if result.get('success') else 'failed'
        execution.completed_at = timezone.now()
        execution.result_data = result
        execution.save()
        
        logger.info(f"[Celery] Workflow {workflow_id} completed with status: {execution.status}")
        
        return {
            'success': True,
            'execution_id': execution.id,
            'status': execution.status,
            'result': result,
        }
        
    except Tenant.DoesNotExist:
        logger.error(f"[Celery] Tenant {tenant_id} not found for workflow {workflow_id}")
        return {'success': False, 'error': 'Tenant not found'}
        
    except TenantWorkflow.DoesNotExist:
        logger.error(f"[Celery] Workflow {workflow_id} not found for tenant {tenant_id}")
        return {'success': False, 'error': 'Workflow not found'}
        
    except Exception as e:
        logger.exception(f"[Celery] Error executing workflow {workflow_id}: {str(e)}")
        
        if 'execution' in locals():
            execution.status = 'failed'
            execution.completed_at = timezone.now()
            execution.error_message = str(e)
            execution.save()
            
        return {'success': False, 'error': str(e)}


@shared_task(name='workflows.execute_event_workflow')
def execute_event_workflow(workflow_id: int, tenant_id: int, entity_type: str, entity_id: int, event_type: str):
    """
    Execute a workflow triggered by an entity event (create/update/delete).
    
    Args:
        workflow_id: ID of the workflow to execute
        tenant_id: ID of the tenant
        entity_type: Type of entity (e.g., 'customer', 'supplier')
        entity_id: ID of the entity that triggered the event
        event_type: Type of event ('created', 'updated', 'deleted')
    
    Returns:
        dict: Execution result
    """
    from .models import TenantWorkflow, WorkflowExecution
    from .engine import WorkflowEngine
    from apps.tenants.models import Tenant
    
    try:
        tenant = Tenant.objects.get(id=tenant_id)
        workflow = TenantWorkflow.objects.get(id=workflow_id, tenant=tenant)
        
        logger.info(f"[Celery] Executing event workflow: {workflow.name} for {entity_type}:{entity_id} ({event_type})")
        
        # Create execution record
        execution = WorkflowExecution.objects.create(
            workflow=workflow,
            tenant=tenant,
            trigger_type='event',
            status='running',
            started_at=timezone.now(),
            trigger_data={
                'entity_type': entity_type,
                'entity_id': entity_id,
                'event_type': event_type,
            }
        )
        
        # Fetch entity data for context
        entity_data = _get_entity_data(entity_type, entity_id, tenant)
        
        # Execute workflow
        engine = WorkflowEngine(workflow)
        result = engine.execute(context={
            'execution_id': execution.id,
            'trigger': 'event',
            'event_type': event_type,
            'entity': entity_data,
        })
        
        # Update execution record
        execution.status = 'completed' if result.get('success') else 'failed'
        execution.completed_at = timezone.now()
        execution.result_data = result
        execution.save()
        
        logger.info(f"[Celery] Event workflow {workflow_id} completed: {execution.status}")
        
        return {
            'success': True,
            'execution_id': execution.id,
            'status': execution.status,
        }
        
    except Exception as e:
        logger.exception(f"[Celery] Error executing event workflow {workflow_id}: {str(e)}")
        
        if 'execution' in locals():
            execution.status = 'failed'
            execution.completed_at = timezone.now()
            execution.error_message = str(e)
            execution.save()
            
        return {'success': False, 'error': str(e)}


@shared_task(name='workflows.execute_workflow_action')
def execute_workflow_action(action_type: str, action_config: dict, context: dict, tenant_id: int):
    """
    Execute a single workflow action asynchronously.
    
    Args:
        action_type: Type of action (email, create_record, etc.)
        action_config: Action configuration from workflow node
        context: Execution context with variables
        tenant_id: Tenant ID for isolation
    
    Returns:
        dict: Action result
    """
    from .services.action_executor import ActionExecutor
    from apps.tenants.models import Tenant
    
    try:
        tenant = Tenant.objects.get(id=tenant_id)
        
        logger.info(f"[Celery] Executing action: {action_type} for tenant {tenant_id}")
        
        executor = ActionExecutor(tenant=tenant, context=context)
        result = executor.execute(action_type, action_config)
        
        logger.info(f"[Celery] Action {action_type} completed: {result.get('success')}")
        
        return result
        
    except Exception as e:
        logger.exception(f"[Celery] Error executing action {action_type}: {str(e)}")
        return {'success': False, 'error': str(e)}


@shared_task(name='workflows.cleanup_old_executions')
def cleanup_old_executions(days_to_keep: int = 90):
    """
    Clean up old workflow executions (maintenance task).
    
    Args:
        days_to_keep: Number of days to retain execution history
    
    Returns:
        dict: Cleanup statistics
    """
    from .models import WorkflowExecution
    
    try:
        cutoff_date = timezone.now() - timedelta(days=days_to_keep)
        
        deleted_count, _ = WorkflowExecution.objects.filter(
            completed_at__lt=cutoff_date
        ).delete()
        
        logger.info(f"[Celery] Cleaned up {deleted_count} old workflow executions")
        
        return {
            'success': True,
            'deleted_count': deleted_count,
            'cutoff_date': cutoff_date.isoformat(),
        }
        
    except Exception as e:
        logger.exception(f"[Celery] Error cleaning up executions: {str(e)}")
        return {'success': False, 'error': str(e)}


def _get_entity_data(entity_type: str, entity_id: int, tenant):
    """
    Fetch entity data for workflow context.
    
    Args:
        entity_type: Type of entity
        entity_id: Entity ID
        tenant: Tenant instance
    
    Returns:
        dict: Entity data
    """
    from tenant_apps.suppliers.models import Supplier
    from tenant_apps.customers.models import Customer
    from tenant_apps.purchase_orders.models import PurchaseOrder
    from tenant_apps.sales_orders.models import SalesOrder
    from tenant_apps.invoices.models import Invoice
    from tenant_apps.products.models import Product
    
    model_map = {
        'supplier': Supplier,
        'customer': Customer,
        'purchase_order': PurchaseOrder,
        'sales_order': SalesOrder,
        'invoice': Invoice,
        'product': Product,
    }
    
    model = model_map.get(entity_type)
    if not model:
        return {'id': entity_id, 'type': entity_type}
    
    try:
        instance = model.objects.get(id=entity_id, tenant=tenant)
        
        # Return basic serialized data
        data = {
            'id': instance.id,
            'type': entity_type,
        }
        
        # Add common fields if they exist
        for field in ['name', 'email', 'status', 'total', 'reference_number']:
            if hasattr(instance, field):
                data[field] = getattr(instance, field)
        
        return data
        
    except model.DoesNotExist:
        return {'id': entity_id, 'type': entity_type, 'error': 'Not found'}
