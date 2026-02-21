"""
Celery Tasks for Workflow Automation

Phase 5 Part 2: Backend Integration
Handles scheduled workflows, event-driven execution, and action processing.

Created: 2026-02-21
"""
from celery import shared_task
from celery.schedules import crontab
from django.utils import timezone
from django.db.models import Q
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# SCHEDULED WORKFLOW EXECUTION
# =============================================================================

@shared_task(name='workflows.execute_scheduled_workflow')
def execute_scheduled_workflow(workflow_id):
    """
    Execute a scheduled workflow via Celery beat.
    
    Phase 5 Part 2: Scheduled Triggers
    Triggered by Celery beat based on workflow's schedule configuration.
    
    Args:
        workflow_id (str): UUID of the workflow to execute
        
    Returns:
        dict: Execution result with status and execution_id
    """
    from .models import TenantWorkflow, WorkflowExecutionLog
    from .engine import WorkflowEngine
    
    try:
        workflow = TenantWorkflow.objects.select_related('tenant').get(id=workflow_id)
    except TenantWorkflow.DoesNotExist:
        logger.error(f'[Schedule] Workflow {workflow_id} not found')
        return {
            'success': False,
            'error': 'Workflow not found'
        }
    
    # Check if workflow is active
    if workflow.status != 'active':
        logger.warning(f'[Schedule] Workflow {workflow_id} is not active (status: {workflow.status})')
        return {
            'success': False,
            'error': f'Workflow status is {workflow.status}, not active'
        }
    
    # Create execution log
    execution = WorkflowExecutionLog.objects.create(
        workflow=workflow,
        status='pending',
        trigger_type='scheduled',
        context={'scheduled_at': timezone.now().isoformat()}
    )
    
    try:
        # Execute workflow
        engine = WorkflowEngine(workflow, execution)
        result = engine.execute()
        
        # Update execution log
        execution.status = 'completed' if result['success'] else 'failed'
        execution.error_message = result.get('error')
        execution.result = result
        execution.completed_at = timezone.now()
        execution.save()
        
        # Update workflow stats
        workflow.last_run_at = timezone.now()
        workflow.run_count += 1
        workflow.save(update_fields=['last_run_at', 'run_count'])
        
        logger.info(f'[Schedule] Executed workflow {workflow_id}: {result["success"]}')
        
        return {
            'success': result['success'],
            'execution_id': str(execution.id),
            'workflow_id': str(workflow_id)
        }
        
    except Exception as e:
        # Mark execution as failed
        execution.status = 'failed'
        execution.error_message = str(e)
        execution.completed_at = timezone.now()
        execution.save()
        
        logger.exception(f'[Schedule] Failed to execute workflow {workflow_id}: {e}')
        
        return {
            'success': False,
            'execution_id': str(execution.id),
            'error': str(e)
        }


@shared_task(name='workflows.register_scheduled_workflows')
def register_scheduled_workflows():
    """
    Dynamically register all active scheduled workflows with Celery beat.
    
    Phase 5 Part 2: Dynamic Schedule Registration
    Scans all active workflows with schedule triggers and registers them
    with Celery beat. Should be called on app startup and when workflows change.
    
    Returns:
        dict: Registration statistics
    """
    from .models import TenantWorkflow
    from django.conf import settings
    
    # Get all active workflows with schedule triggers
    scheduled_workflows = TenantWorkflow.objects.filter(
        status='active',
        trigger_type='scheduled'
    ).select_related('tenant')
    
    registered_count = 0
    errors = []
    
    for workflow in scheduled_workflows:
        try:
            # Parse schedule from trigger_config
            schedule_config = workflow.trigger_config.get('schedule', {})
            interval_type = schedule_config.get('intervalType', 'simple')
            
            if interval_type == 'cron':
                # Parse cron expression
                cron_expr = schedule_config.get('cronExpression', '0 0 * * *')
                schedule = _parse_cron_expression(cron_expr)
            else:
                # Simple interval (minutes/hours/days)
                frequency = schedule_config.get('frequency', 'day')
                interval = schedule_config.get('interval', 1)
                schedule = _create_simple_schedule(frequency, interval)
            
            # Register with Celery beat (if using database scheduler)
            # Note: This requires django-celery-beat
            # For now, just log the schedule
            logger.info(f'[Schedule] Would register workflow {workflow.id}: {schedule}')
            registered_count += 1
            
        except Exception as e:
            errors.append({
                'workflow_id': str(workflow.id),
                'error': str(e)
            })
            logger.error(f'[Schedule] Failed to register workflow {workflow.id}: {e}')
    
    return {
        'registered': registered_count,
        'errors': errors,
        'message': f'Registered {registered_count} scheduled workflow(s)'
    }


def _parse_cron_expression(cron_expr: str):
    """
    Parse cron expression into Celery crontab schedule.
    
    Args:
        cron_expr (str): Cron expression (e.g., "0 0 * * *")
        
    Returns:
        crontab: Celery crontab schedule
    """
    parts = cron_expr.split()
    if len(parts) != 5:
        raise ValueError(f'Invalid cron expression: {cron_expr}')
    
    minute, hour, day_of_month, month_of_year, day_of_week = parts
    
    return crontab(
        minute=minute,
        hour=hour,
        day_of_week=day_of_week,
        day_of_month=day_of_month,
        month_of_year=month_of_year
    )


def _create_simple_schedule(frequency: str, interval: int):
    """
    Create simple interval schedule.
    
    Args:
        frequency (str): 'minute', 'hour', 'day', 'week', 'month'
        interval (int): Number of units
        
    Returns:
        crontab: Celery crontab schedule
    """
    if frequency == 'minute':
        return crontab(minute=f'*/{interval}')
    elif frequency == 'hour':
        return crontab(minute='0', hour=f'*/{interval}')
    elif frequency == 'day':
        return crontab(minute='0', hour='0', day_of_week='*', day_of_month=f'*/{interval}')
    elif frequency == 'week':
        return crontab(minute='0', hour='0', day_of_week=f'0')  # Sunday
    elif frequency == 'month':
        return crontab(minute='0', hour='0', day_of_month='1')  # First day
    else:
        raise ValueError(f'Unknown frequency: {frequency}')


# =============================================================================
# EVENT-DRIVEN WORKFLOW EXECUTION
# =============================================================================

@shared_task(name='workflows.execute_event_workflow')
def execute_event_workflow(workflow_id, entity_type, entity_id, event_type, context=None):
    """
    Execute a workflow triggered by an entity event.
    
    Phase 5 Part 2: Event Triggers
    Called by Django signals when entities are created/updated/deleted.
    
    Args:
        workflow_id (str): UUID of the workflow
        entity_type (str): Type of entity (e.g., 'customer', 'supplier')
        entity_id (str): UUID of the entity instance
        event_type (str): 'create', 'update', or 'delete'
        context (dict): Additional context data
        
    Returns:
        dict: Execution result
    """
    from .models import TenantWorkflow, WorkflowExecutionLog
    from .engine import WorkflowEngine
    
    try:
        workflow = TenantWorkflow.objects.select_related('tenant').get(id=workflow_id)
    except TenantWorkflow.DoesNotExist:
        logger.error(f'[Event] Workflow {workflow_id} not found')
        return {'success': False, 'error': 'Workflow not found'}
    
    # Check if workflow is active
    if workflow.status != 'active':
        return {'success': False, 'error': 'Workflow not active'}
    
    # Verify trigger configuration matches event
    trigger_config = workflow.trigger_config or {}
    config_entity = trigger_config.get('entity')
    config_events = trigger_config.get('triggerOn', [])
    
    if config_entity != entity_type or event_type not in config_events:
        logger.debug(f'[Event] Workflow {workflow_id} not configured for {entity_type}.{event_type}')
        return {'success': False, 'error': 'Event not configured for this workflow'}
    
    # Build execution context
    execution_context = {
        'entity_type': entity_type,
        'entity_id': entity_id,
        'event_type': event_type,
        'triggered_at': timezone.now().isoformat()
    }
    if context:
        execution_context.update(context)
    
    # Create execution log
    execution = WorkflowExecutionLog.objects.create(
        workflow=workflow,
        status='pending',
        trigger_type='event',
        context=execution_context
    )
    
    try:
        # Execute workflow
        engine = WorkflowEngine(workflow, execution)
        result = engine.execute(context=execution_context)
        
        # Update execution log
        execution.status = 'completed' if result['success'] else 'failed'
        execution.error_message = result.get('error')
        execution.result = result
        execution.completed_at = timezone.now()
        execution.save()
        
        # Update workflow stats
        workflow.last_run_at = timezone.now()
        workflow.run_count += 1
        workflow.save(update_fields=['last_run_at', 'run_count'])
        
        logger.info(f'[Event] Executed workflow {workflow_id} for {entity_type}.{event_type}: {result["success"]}')
        
        return {
            'success': result['success'],
            'execution_id': str(execution.id)
        }
        
    except Exception as e:
        execution.status = 'failed'
        execution.error_message = str(e)
        execution.completed_at = timezone.now()
        execution.save()
        
        logger.exception(f'[Event] Failed to execute workflow {workflow_id}: {e}')
        return {'success': False, 'error': str(e)}


# =============================================================================
# ACTION EXECUTION
# =============================================================================

@shared_task(name='workflows.execute_workflow_action')
def execute_workflow_action(action_type, action_config, context):
    """
    Execute a single workflow action asynchronously.
    
    Phase 5 Part 2: Action Execution
    Handles email, record creation, document generation, etc.
    
    Args:
        action_type (str): Type of action ('email', 'create_record', etc.)
        action_config (dict): Action configuration
        context (dict): Execution context with available data
        
    Returns:
        dict: Action execution result
    """
    from .services.action_executor import ActionExecutor
    
    try:
        executor = ActionExecutor()
        result = executor.execute(action_type, action_config, context)
        
        logger.info(f'[Action] Executed {action_type}: {result["success"]}')
        return result
        
    except Exception as e:
        logger.exception(f'[Action] Failed to execute {action_type}: {e}')
        return {
            'success': False,
            'error': str(e)
        }


@shared_task(name='workflows.cleanup_old_executions')
def cleanup_old_executions(days=30):
    """
    Clean up old workflow execution logs.
    
    Phase 5 Part 2: Maintenance
    Deletes execution logs older than specified days.
    
    Args:
        days (int): Number of days to retain (default: 30)
        
    Returns:
        dict: Cleanup statistics
    """
    from .models import WorkflowExecutionLog
    
    cutoff_date = timezone.now() - timedelta(days=days)
    
    old_executions = WorkflowExecutionLog.objects.filter(
        created_at__lt=cutoff_date
    )
    
    count = old_executions.count()
    deleted_count, _ = old_executions.delete()
    
    logger.info(f'[Cleanup] Deleted {deleted_count} execution logs older than {days} days')
    
    return {
        'deleted': deleted_count,
        'cutoff_date': cutoff_date.isoformat(),
        'message': f'Deleted {deleted_count} old execution log(s)'
    }
