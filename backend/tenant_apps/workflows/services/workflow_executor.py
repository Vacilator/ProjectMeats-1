"""
Workflow Execution Engine

Executes workflow actions based on trigger events.
Handles action types: email, webhook, update_record, create_record, conditional_branch.
"""

import logging
from typing import Any, Dict, List, Optional
from django.utils import timezone
from django.db import transaction

from ..models import (
    TenantWorkflow,
    TenantWorkflowAction,
    TenantWorkflowCondition,
    WorkflowExecutionLog,
)

logger = logging.getLogger(__name__)


class WorkflowExecutionError(Exception):
    """Raised when workflow execution fails"""
    pass


class WorkflowExecutor:
    """
    Executes workflow actions in response to trigger events.
    
    Supports:
    - Sequential action execution
    - Conditional branching
    - Variable substitution
    - Error handling and logging
    """
    
    def __init__(self, workflow: TenantWorkflow, trigger_data: Dict[str, Any]):
        self.workflow = workflow
        self.trigger_data = trigger_data
        self.context = self._build_context()
        self.execution_log = None
    
    def _build_context(self) -> Dict[str, Any]:
        """Build execution context with trigger data and workflow metadata"""
        return {
            'trigger': self.trigger_data,
            'workflow': {
                'id': str(self.workflow.id),
                'name': self.workflow.name,
                'tenant_id': str(self.workflow.tenant_id),
            },
            'timestamp': timezone.now().isoformat(),
            'variables': {}  # User-defined variables during execution
        }
    
    def execute(self) -> WorkflowExecutionLog:
        """
        Execute workflow actions in order.
        
        Returns:
            WorkflowExecutionLog with execution results
        """
        # Create execution log
        self.execution_log = WorkflowExecutionLog.objects.create(
            workflow=self.workflow,
            tenant=self.workflow.tenant,
            trigger_data=self.trigger_data,
            status='running',
            started_at=timezone.now()
        )
        
        try:
            with transaction.atomic():
                # Get workflow actions in order
                actions = self.workflow.actions.all().order_by('order')
                
                if not actions.exists():
                    logger.warning(f"Workflow {self.workflow.id} has no actions")
                    self._complete_execution('completed', 'No actions to execute')
                    return self.execution_log
                
                # Execute each action
                for action in actions:
                    self._execute_action(action)
                
                # Mark as completed
                self._complete_execution('completed', 'All actions executed successfully')
        
        except WorkflowExecutionError as e:
            logger.error(f"Workflow execution failed: {e}")
            self._complete_execution('failed', str(e))
        
        except Exception as e:
            logger.exception(f"Unexpected error during workflow execution: {e}")
            self._complete_execution('failed', f"Unexpected error: {str(e)}")
        
        return self.execution_log
    
    def _execute_action(self, action: TenantWorkflowAction) -> None:
        """Execute a single workflow action"""
        logger.info(f"Executing action: {action.action_type} (order: {action.order})")
        
        # Check conditions before executing
        if not self._evaluate_conditions(action):
            logger.info(f"Action {action.id} skipped due to failed conditions")
            return
        
        # Execute based on action type
        handler_map = {
            'send_email': self._execute_email_action,
            'webhook': self._execute_webhook_action,
            'update_record': self._execute_update_record,
            'create_record': self._execute_create_record,
            'conditional_branch': self._execute_conditional_branch,
            'set_variable': self._execute_set_variable,
        }
        
        handler = handler_map.get(action.action_type)
        if handler:
            handler(action)
        else:
            logger.warning(f"Unknown action type: {action.action_type}")
    
    def _evaluate_conditions(self, action: TenantWorkflowAction) -> bool:
        """
        Evaluate action conditions.
        
        Returns:
            True if all conditions pass (or no conditions), False otherwise
        """
        conditions = action.conditions.all()
        if not conditions.exists():
            return True  # No conditions = always execute
        
        logic = action.condition_logic or 'and'
        
        results = []
        for condition in conditions:
            result = self._evaluate_single_condition(condition)
            results.append(result)
        
        # Apply logic operator
        if logic == 'and':
            return all(results)
        elif logic == 'or':
            return any(results)
        else:
            logger.warning(f"Unknown condition logic: {logic}")
            return all(results)  # Default to AND
    
    def _evaluate_single_condition(self, condition: TenantWorkflowCondition) -> bool:
        """Evaluate a single condition"""
        field_value = self._resolve_field_value(condition.field)
        compare_value = condition.value
        operator = condition.operator
        
        # Type coercion
        if isinstance(field_value, str) and compare_value.isdigit():
            compare_value = int(compare_value)
        
        # Evaluate operator
        operators = {
            'equals': lambda a, b: a == b,
            'not_equals': lambda a, b: a != b,
            'greater_than': lambda a, b: a > b,
            'less_than': lambda a, b: a < b,
            'contains': lambda a, b: b in str(a),
            'not_contains': lambda a, b: b not in str(a),
            'is_empty': lambda a, b: not a or a == '',
            'is_not_empty': lambda a, b: a and a != '',
        }
        
        evaluator = operators.get(operator)
        if evaluator:
            return evaluator(field_value, compare_value)
        else:
            logger.warning(f"Unknown operator: {operator}")
            return False
    
    def _resolve_field_value(self, field_path: str) -> Any:
        """
        Resolve field value from context using dot notation.
        
        Examples:
            trigger.customer.email
            variables.total_amount
        """
        parts = field_path.split('.')
        value = self.context
        
        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            else:
                return None
        
        return value
    
    def _execute_email_action(self, action: TenantWorkflowAction) -> None:
        """Execute email action"""
        config = action.config or {}
        to_email = config.get('to')
        subject = config.get('subject', 'Workflow Notification')
        body = config.get('body', '')
        
        # TODO: Integrate with email service (SendGrid, AWS SES, etc.)
        logger.info(f"Email action: to={to_email}, subject={subject}")
        # Placeholder - actual implementation requires email backend
    
    def _execute_webhook_action(self, action: TenantWorkflowAction) -> None:
        """Execute webhook action"""
        config = action.config or {}
        url = config.get('url')
        method = config.get('method', 'POST')
        payload = config.get('payload', {})
        
        # TODO: Make HTTP request to webhook URL
        logger.info(f"Webhook action: {method} {url}")
        # Placeholder - actual implementation requires requests library
    
    def _execute_update_record(self, action: TenantWorkflowAction) -> None:
        """Execute update record action"""
        config = action.config or {}
        model_name = config.get('model')
        record_id = config.get('record_id')
        updates = config.get('updates', {})
        
        logger.info(f"Update record: model={model_name}, id={record_id}, updates={updates}")
        # TODO: Implement dynamic model update using Django's ContentType framework
    
    def _execute_create_record(self, action: TenantWorkflowAction) -> None:
        """Execute create record action"""
        config = action.config or {}
        model_name = config.get('model')
        fields = config.get('fields', {})
        
        logger.info(f"Create record: model={model_name}, fields={fields}")
        # TODO: Implement dynamic record creation
    
    def _execute_conditional_branch(self, action: TenantWorkflowAction) -> None:
        """Execute conditional branch (already handled by _evaluate_conditions)"""
        logger.info(f"Conditional branch evaluated for action {action.id}")
    
    def _execute_set_variable(self, action: TenantWorkflowAction) -> None:
        """Execute set variable action"""
        config = action.config or {}
        variable_name = config.get('name')
        variable_value = config.get('value')
        
        if variable_name:
            self.context['variables'][variable_name] = variable_value
            logger.info(f"Set variable: {variable_name} = {variable_value}")
    
    def _complete_execution(self, status: str, result: str) -> None:
        """Mark execution as complete with status and result"""
        self.execution_log.status = status
        self.execution_log.completed_at = timezone.now()
        self.execution_log.result = result
        self.execution_log.save(update_fields=['status', 'completed_at', 'result'])
        
        # Update workflow stats
        if status == 'completed':
            self.workflow.last_triggered = timezone.now()
            self.workflow.execution_count = (self.workflow.execution_count or 0) + 1
            self.workflow.save(update_fields=['last_triggered', 'execution_count'])


def execute_workflow(workflow: TenantWorkflow, trigger_data: Dict[str, Any]) -> WorkflowExecutionLog:
    """
    Convenience function to execute a workflow.
    
    Args:
        workflow: TenantWorkflow instance
        trigger_data: Dict containing trigger event data
    
    Returns:
        WorkflowExecutionLog with execution results
    """
    executor = WorkflowExecutor(workflow, trigger_data)
    return executor.execute()
