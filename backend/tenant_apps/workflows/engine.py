"""
Workflow Execution Engine.

Bundle Two: System → Tenant Workflows
Handles workflow triggering, condition evaluation, and action execution.

This module provides:
- Signal handlers for record_created/record_updated triggers
- Condition evaluation using json-logic compatible format
- Action executors for email, notifications, etc.
- Background task integration (Celery-ready)
"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from apps.tenants.email_utils import is_sendgrid_quota_exceeded

from .models import (
    TenantWorkflow, TenantWorkflowCondition, TenantWorkflowAction,
    WorkflowExecutionLog, WorkflowStatus, TriggerType, ActionType, OperatorType
)

logger = logging.getLogger(__name__)


# =============================================================================
# CONDITION EVALUATOR (json-logic compatible)
# =============================================================================

class ConditionEvaluator:
    """
    Evaluates workflow conditions against record data.
    
    Uses a json-logic compatible format for conditions.
    """
    
    OPERATORS = {
        OperatorType.EQUALS: lambda a, b: a == b,
        OperatorType.NOT_EQUALS: lambda a, b: a != b,
        OperatorType.GREATER_THAN: lambda a, b: float(a) > float(b) if a and b else False,
        OperatorType.LESS_THAN: lambda a, b: float(a) < float(b) if a and b else False,
        OperatorType.GREATER_OR_EQUAL: lambda a, b: float(a) >= float(b) if a and b else False,
        OperatorType.LESS_OR_EQUAL: lambda a, b: float(a) <= float(b) if a and b else False,
        OperatorType.CONTAINS: lambda a, b: str(b).lower() in str(a).lower() if a else False,
        OperatorType.NOT_CONTAINS: lambda a, b: str(b).lower() not in str(a).lower() if a else True,
        OperatorType.IS_EMPTY: lambda a, b: not a or a == '' or a == [],
        OperatorType.IS_NOT_EMPTY: lambda a, b: bool(a) and a != '' and a != [],
    }
    
    @classmethod
    def get_field_value(cls, data: Dict, field_path: str) -> Any:
        """
        Get value from nested data using dot notation.
        
        Supports system fields like __created_at, __created_by, etc.
        """
        if field_path.startswith('__'):
            # System field
            system_field = field_path[2:]
            return data.get(f'_system_{system_field}')
        
        parts = field_path.split('.')
        value = data
        
        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            elif isinstance(value, list) and part.isdigit():
                index = int(part)
                value = value[index] if index < len(value) else None
            else:
                return None
        
        return value
    
    @classmethod
    def evaluate_condition(cls, condition: TenantWorkflowCondition, data: Dict) -> bool:
        """Evaluate a single condition against data."""
        field_value = cls.get_field_value(data, condition.field_path)
        compare_value = condition.compare_value
        
        operator_func = cls.OPERATORS.get(condition.operator)
        if not operator_func:
            logger.warning(f"Unknown operator: {condition.operator}")
            return False
        
        try:
            return operator_func(field_value, compare_value)
        except Exception as e:
            logger.error(f"Error evaluating condition: {e}")
            return False
    
    @classmethod
    def evaluate_all(cls, workflow: TenantWorkflow, data: Dict) -> bool:
        """
        Evaluate all conditions for a workflow.
        
        Returns True if all conditions pass (AND logic).
        """
        conditions = workflow.conditions.all()
        
        if not conditions.exists():
            # No conditions = always true
            return True
        
        for condition in conditions:
            if not cls.evaluate_condition(condition, data):
                return False
        
        return True


# =============================================================================
# ACTION EXECUTORS
# =============================================================================

class ActionExecutor:
    """Base class for action executors."""
    
    def execute(self, action: TenantWorkflowAction, context: Dict) -> Dict:
        """
        Execute the action.
        
        Returns a dict with 'success', 'message', and optional 'data'.
        """
        raise NotImplementedError


class SendEmailExecutor(ActionExecutor):
    """Executor for send_email action."""
    
    def execute(self, action: TenantWorkflowAction, context: Dict) -> Dict:
        config = action.config
        
        to_email = self._interpolate(config.get('to', ''), context)
        subject = self._interpolate(config.get('subject', ''), context)
        body = self._interpolate(config.get('body', ''), context)
        
        if not to_email:
            return {'success': False, 'message': 'No recipient email specified'}
        
        try:
            # Use Django's send_mail
            from_email = config.get('from') or settings.DEFAULT_FROM_EMAIL
            
            send_mail(
                subject=subject,
                message=body,
                from_email=from_email,
                recipient_list=[to_email],
                fail_silently=False,
            )
            
            return {
                'success': True,
                'message': f'Email sent to {to_email}',
                'data': {'to': to_email, 'subject': subject}
            }
        except Exception as e:
            if is_sendgrid_quota_exceeded(e):
                logger.critical(
                    "🚨 SendGrid quota exceeded — workflow email to %s NOT sent. "
                    "Please upgrade the SendGrid plan or wait for the quota to reset. "
                    "Error: %s",
                    to_email,
                    e,
                )
            else:
                logger.error(f"Failed to send email: {e}")
            return {'success': False, 'message': str(e)}
    
    def _interpolate(self, template: str, context: Dict) -> str:
        """Replace {{field}} placeholders with actual values."""
        import re
        
        def replace(match):
            field_path = match.group(1)
            value = ConditionEvaluator.get_field_value(context.get('record', {}), field_path)
            return str(value) if value is not None else ''
        
        return re.sub(r'\{\{([^}]+)\}\}', replace, template)


class SendNotificationExecutor(ActionExecutor):
    """Executor for send_notification action (in-app)."""
    
    def execute(self, action: TenantWorkflowAction, context: Dict) -> Dict:
        config = action.config
        
        title = config.get('title', 'Notification')
        message = config.get('message', '')
        
        # Note: Full notification system integration planned for Wave I (Infrastructure)
        # Task I2.3: Real-time notifications
        logger.info(f"Notification: {title} - {message}")
        
        return {
            'success': True,
            'message': 'Notification queued',
            'data': {'title': title, 'message': message}
        }


class SetFieldValueExecutor(ActionExecutor):
    """Executor for set_value action."""
    
    def execute(self, action: TenantWorkflowAction, context: Dict) -> Dict:
        config = action.config
        
        field = config.get('field')
        value = config.get('value')
        
        if not field:
            return {'success': False, 'message': 'No field specified'}
        
        # Store the field update in context for the caller to apply
        context.setdefault('field_updates', {})[field] = value
        
        return {
            'success': True,
            'message': f'Set {field} = {value}',
            'data': {'field': field, 'value': value}
        }


class RunWorkflowExecutor(ActionExecutor):
    """Executor for run_workflow action (chain workflows)."""
    
    def execute(self, action: TenantWorkflowAction, context: Dict) -> Dict:
        config = action.config
        workflow_id = config.get('workflow_id')
        
        if not workflow_id:
            return {'success': False, 'message': 'No workflow ID specified'}
        
        try:
            workflow = TenantWorkflow.objects.get(
                id=workflow_id,
                tenant=context.get('tenant'),
                status=WorkflowStatus.ACTIVE
            )
            
            # Execute the chained workflow
            engine = WorkflowEngine()
            result = engine.execute(workflow, context.get('record', {}), context.get('user'))
            
            return {
                'success': result.get('success', False),
                'message': f'Executed workflow: {workflow.name}',
                'data': {'workflow_id': str(workflow_id), 'result': result}
            }
        except TenantWorkflow.DoesNotExist:
            return {'success': False, 'message': f'Workflow not found: {workflow_id}'}


# Action executor registry
ACTION_EXECUTORS = {
    ActionType.SEND_EMAIL: SendEmailExecutor(),
    ActionType.SEND_NOTIFICATION: SendNotificationExecutor(),
    ActionType.SEND_TEAMS_SLACK: SendNotificationExecutor(),  # Same for now
    ActionType.SET_FIELD_VALUE: SetFieldValueExecutor(),
    ActionType.RUN_WORKFLOW: RunWorkflowExecutor(),
}


# =============================================================================
# WORKFLOW ENGINE
# =============================================================================

class WorkflowEngine:
    """
    Main workflow execution engine.
    
    Handles the full lifecycle of workflow execution:
    1. Find matching workflows for a trigger
    2. Evaluate conditions
    3. Execute actions in order
    4. Log execution results
    """
    
    def find_workflows_for_trigger(
        self,
        tenant,
        trigger_type: str,
        entity_type: str = None
    ) -> List[TenantWorkflow]:
        """Find active workflows that match the trigger criteria."""
        qs = TenantWorkflow.objects.filter(
            tenant=tenant,
            status=WorkflowStatus.ACTIVE,
            trigger_type=trigger_type
        )
        
        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        
        return list(qs.prefetch_related('conditions', 'actions'))
    
    def execute(
        self,
        workflow: TenantWorkflow,
        record_data: Dict,
        triggered_by=None,
        trigger_type: str = 'manual'
    ) -> Dict:
        """
        Execute a workflow against record data.
        
        Returns execution result with success status and details.
        """
        # Create execution log
        log = WorkflowExecutionLog.objects.create(
            workflow=workflow,
            trigger_type=trigger_type,
            trigger_data={'record': record_data},
            triggered_by=triggered_by,
            status='started'
        )
        
        context = {
            'record': record_data,
            'tenant': workflow.tenant,
            'user': triggered_by,
            'workflow': workflow,
            'field_updates': {},
        }
        
        # Add system fields to record data
        record_data['_system_created_at'] = record_data.get('created_at')
        record_data['_system_created_by'] = record_data.get('created_by')
        record_data['_system_updated_at'] = record_data.get('updated_at')
        record_data['_system_updated_by'] = record_data.get('updated_by')
        
        try:
            # Evaluate conditions
            if not ConditionEvaluator.evaluate_all(workflow, record_data):
                log.status = 'success'
                log.completed_at = timezone.now()
                log.execution_log = [{'step': 'conditions', 'result': 'skipped'}]
                log.save()
                
                return {
                    'success': True,
                    'skipped': True,
                    'message': 'Conditions not met'
                }
            
            # Execute actions
            execution_log = []
            actions_executed = 0
            actions_failed = 0
            
            for action in workflow.actions.order_by('order'):
                executor = ACTION_EXECUTORS.get(action.action_type)
                
                if not executor:
                    execution_log.append({
                        'action': action.action_type,
                        'order': action.order,
                        'status': 'skipped',
                        'message': 'No executor available'
                    })
                    continue
                
                start_time = datetime.now()
                
                try:
                    result = executor.execute(action, context)
                    
                    duration_ms = (datetime.now() - start_time).total_seconds() * 1000
                    
                    execution_log.append({
                        'action': action.action_type,
                        'order': action.order,
                        'status': 'success' if result['success'] else 'failed',
                        'message': result.get('message'),
                        'data': result.get('data'),
                        'duration_ms': duration_ms
                    })
                    
                    if result['success']:
                        actions_executed += 1
                    else:
                        actions_failed += 1
                        if not action.continue_on_error:
                            break
                
                except Exception as e:
                    logger.exception(f"Error executing action {action.action_type}")
                    actions_failed += 1
                    
                    execution_log.append({
                        'action': action.action_type,
                        'order': action.order,
                        'status': 'error',
                        'message': str(e)
                    })
                    
                    if not action.continue_on_error:
                        break
            
            # Determine final status
            if actions_failed == 0:
                final_status = 'success'
            elif actions_executed > 0:
                final_status = 'partial'
            else:
                final_status = 'failed'
            
            # Update log
            log.status = final_status
            log.completed_at = timezone.now()
            log.actions_executed = actions_executed
            log.actions_failed = actions_failed
            log.execution_log = execution_log
            log.save()
            
            # Update workflow stats
            workflow.run_count += 1
            workflow.last_run_at = timezone.now()
            workflow.save(update_fields=['run_count', 'last_run_at'])
            
            return {
                'success': final_status in ['success', 'partial'],
                'status': final_status,
                'actions_executed': actions_executed,
                'actions_failed': actions_failed,
                'field_updates': context.get('field_updates', {}),
                'execution_id': str(log.id)
            }
        
        except Exception as e:
            logger.exception(f"Workflow execution error: {e}")
            
            log.status = 'failed'
            log.completed_at = timezone.now()
            log.error_message = str(e)
            log.save()
            
            return {
                'success': False,
                'status': 'failed',
                'error': str(e),
                'execution_id': str(log.id)
            }
    
    def trigger_for_record(
        self,
        tenant,
        entity_type: str,
        trigger_type: str,
        record_data: Dict,
        user=None
    ) -> List[Dict]:
        """
        Trigger all matching workflows for a record event.
        
        Used by signals for record_created/record_updated triggers.
        """
        workflows = self.find_workflows_for_trigger(tenant, trigger_type, entity_type)
        
        results = []
        for workflow in workflows:
            result = self.execute(workflow, record_data, user, trigger_type)
            results.append({
                'workflow_id': str(workflow.id),
                'workflow_name': workflow.name,
                **result
            })
        
        return results


# =============================================================================
# CELERY TASKS (for background execution)
# =============================================================================

# Check if Celery is available
try:
    from celery import shared_task
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False
    
    # Fallback decorator that runs synchronously
    def shared_task(func):
        return func


@shared_task
def execute_workflow_async(workflow_id: str, record_data: Dict, user_id: int = None):
    """
    Execute a workflow asynchronously via Celery.
    
    This is the recommended way to run workflows that may take time
    (e.g., sending emails, calling external APIs).
    """
    from django.contrib.auth.models import User
    
    try:
        workflow = TenantWorkflow.objects.get(id=workflow_id)
        user = User.objects.get(id=user_id) if user_id else None
        
        engine = WorkflowEngine()
        return engine.execute(workflow, record_data, user, 'async')
    
    except TenantWorkflow.DoesNotExist:
        logger.error(f"Workflow not found: {workflow_id}")
        return {'success': False, 'error': 'Workflow not found'}
    except Exception as e:
        logger.exception(f"Async workflow execution error: {e}")
        return {'success': False, 'error': str(e)}


@shared_task
def trigger_scheduled_workflows():
    """
    Periodic task to check and run scheduled workflows.
    
    Should be called by Celery Beat on a regular interval (e.g., every minute).
    """
    # Note: Cron expression parsing planned for Wave I (Infrastructure)
    # Task I3.5: Scheduled tasks (cron jobs)
    logger.info("Checking scheduled workflows...")
    
    # Get all active scheduled workflows
    workflows = TenantWorkflow.objects.filter(
        status=WorkflowStatus.ACTIVE,
        trigger_type=TriggerType.SCHEDULED
    )
    
    engine = WorkflowEngine()
    
    for workflow in workflows:
        # Check if it's time to run based on trigger_config
        # This would require cron parsing logic
        pass
    
    return {'checked': workflows.count()}


# =============================================================================
# SIGNAL HANDLERS
# =============================================================================

def on_record_created(sender, instance, tenant, entity_type, **kwargs):
    """
    Signal handler for record creation events.
    
    Connect this to your model's post_save signal:
    
    @receiver(post_save, sender=MyModel)
    def my_model_created(sender, instance, created, **kwargs):
        if created:
            on_record_created(sender, instance, instance.tenant, 'my_model')
    """
    engine = WorkflowEngine()
    record_data = model_to_dict(instance)
    
    results = engine.trigger_for_record(
        tenant=tenant,
        entity_type=entity_type,
        trigger_type=TriggerType.RECORD_CREATED,
        record_data=record_data
    )
    
    return results


def on_record_updated(sender, instance, tenant, entity_type, changed_fields=None, **kwargs):
    """
    Signal handler for record update events.
    
    Connect this to your model's post_save signal:
    
    @receiver(post_save, sender=MyModel)
    def my_model_updated(sender, instance, created, **kwargs):
        if not created:
            on_record_updated(sender, instance, instance.tenant, 'my_model')
    """
    engine = WorkflowEngine()
    record_data = model_to_dict(instance)
    
    # Add changed fields info
    if changed_fields:
        record_data['_changed_fields'] = changed_fields
    
    results = engine.trigger_for_record(
        tenant=tenant,
        entity_type=entity_type,
        trigger_type=TriggerType.RECORD_UPDATED,
        record_data=record_data
    )
    
    return results


def model_to_dict(instance) -> Dict:
    """Convert a model instance to a dictionary for workflow processing."""
    from django.forms.models import model_to_dict as django_model_to_dict
    
    try:
        data = django_model_to_dict(instance)
        
        # Add common fields that model_to_dict might skip
        for field in ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']:
            if hasattr(instance, field):
                value = getattr(instance, field)
                if hasattr(value, 'isoformat'):
                    data[field] = value.isoformat()
                elif hasattr(value, 'id'):
                    data[field] = value.id
                else:
                    data[field] = value
        
        return data
    except Exception:
        return {'id': str(instance.pk) if hasattr(instance, 'pk') else None}
