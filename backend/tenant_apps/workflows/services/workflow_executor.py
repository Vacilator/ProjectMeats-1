"""tenant_apps.workflows.services.workflow_executor

Workflow Execution Engine (TenantWorkflow)

This module executes TenantWorkflow actions on the backend.

Key capabilities:
- Sequential action execution with per-action error policy (continue / route / fail)
- Foreach-style array iteration (wrapper around ANY action)

Conventions (stored in TenantWorkflowAction.config):
- foreach:
    {
      "array": "trigger.items",         # dot-path into context (supports {{var}} wrapping)
      "item_var": "item",              # variables.item = current element
      "index_var": "index",            # variables.index = current index
      "max_iterations": 1000,
      "break_on_error": true
    }
- on_error_action_id: "<uuid>"            # jump to this action if this action fails (and continue_on_error is false)

NOTE: This executor is for TenantWorkflow (automation rules) and is intentionally
separate from TenantForm.flow_data (the React Flow canvas graph).
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from django.db import transaction
from django.utils import timezone

from ..models import TenantWorkflow, TenantWorkflowAction, TenantWorkflowCondition, WorkflowExecutionLog

logger = logging.getLogger(__name__)


class WorkflowExecutionError(Exception):
    """Raised when workflow execution fails."""


class WorkflowExecutor:
    def __init__(self, workflow: TenantWorkflow, trigger_data: Dict[str, Any]):
        self.workflow = workflow
        self.trigger_data = trigger_data
        self.context = self._build_context()
        self.execution_log: Optional[WorkflowExecutionLog] = None

    def _build_context(self) -> Dict[str, Any]:
        return {
            'trigger': self.trigger_data,
            'workflow': {
                'id': str(self.workflow.id),
                'name': self.workflow.name,
                'tenant_id': str(self.workflow.tenant_id),
            },
            'timestamp': timezone.now().isoformat(),
            'variables': {},
        }

    # -------------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------------

    def execute(self) -> WorkflowExecutionLog:
        # Create execution log (model status choices: started/success/failed/partial)
        self.execution_log = WorkflowExecutionLog.objects.create(
            workflow=self.workflow,
            tenant=self.workflow.tenant,
            trigger_data=self.trigger_data,
            trigger_type=self.workflow.trigger_type,
            status='started',
        )
        self._ensure_log_defaults()

        try:
            with transaction.atomic():
                # Evaluate workflow-level conditions (AND by default)
                if not self._evaluate_workflow_conditions():
                    self._complete_execution(status='success', result='Conditions not met; no actions executed')
                    return self.execution_log

                actions_qs = self.workflow.actions.all().order_by('order')
                actions: List[TenantWorkflowAction] = list(actions_qs)

                if not actions:
                    self._complete_execution(status='success', result='No actions to execute')
                    return self.execution_log

                index_by_id = {str(a.id): i for i, a in enumerate(actions)}

                i = 0
                while i < len(actions):
                    action = actions[i]

                    try:
                        self._execute_action(action)
                        i += 1

                    except Exception as e:  # noqa: BLE001 - intentional: we log and apply routing policy
                        self._record_action_failure(action, e)

                        # Policy 1: continue
                        if getattr(action, 'continue_on_error', False):
                            i += 1
                            continue

                        # Policy 2: route to on_error action
                        on_error_action_id = (action.config or {}).get('on_error_action_id')
                        if on_error_action_id and str(on_error_action_id) in index_by_id:
                            i = index_by_id[str(on_error_action_id)]
                            continue

                        # Policy 3: fail workflow
                        raise WorkflowExecutionError(str(e))

                final_status = 'success' if (self.execution_log.actions_failed or 0) == 0 else 'partial'
                self._complete_execution(status=final_status, result='Actions executed')

        except WorkflowExecutionError as e:
            logger.error('Workflow execution failed: %s', e)
            self._complete_execution(status='failed', result=str(e), error_message=str(e))

        except Exception as e:  # noqa: BLE001
            logger.exception('Unexpected error during workflow execution: %s', e)
            self._complete_execution(status='failed', result='Unexpected error', error_message=str(e))

        return self.execution_log

    # -------------------------------------------------------------------------
    # Condition evaluation (workflow-level)
    # -------------------------------------------------------------------------

    def _evaluate_workflow_conditions(self) -> bool:
        conditions = list(self.workflow.conditions.all().order_by('order'))
        if not conditions:
            return True

        # There is no workflow.condition_logic field today; default to AND.
        logic = (self.workflow.trigger_config or {}).get('condition_logic', 'and')
        results = [self._evaluate_single_condition(c) for c in conditions]

        if logic == 'or':
            return any(results)
        return all(results)

    def _evaluate_single_condition(self, condition: TenantWorkflowCondition) -> bool:
        # Back-compat with older attribute names used in early prototypes/tests
        field_path = getattr(condition, 'field_path', None)
        if not isinstance(field_path, str) or not field_path:
            field_path = getattr(condition, 'field', '')

        compare_value = getattr(condition, 'compare_value', None)
        if (compare_value is None or not isinstance(compare_value, (str, int, float, bool, list, dict))) and hasattr(condition, 'value'):
            compare_value = getattr(condition, 'value')

        operator = getattr(condition, 'operator', '')
        if not isinstance(operator, str):
            operator = str(operator)

        value = self._resolve_field_value(field_path)

        # Numeric coercion (keeps string equality stable)
        value, compare_value = self._maybe_coerce_numeric_pair(value, compare_value)

        op = operator
        # OperatorType values from models: eq/neq/gt/lt/gte/lte/contains/not_contains/is_empty/is_not_empty
        if op in {'eq', 'equals'}:
            return value == compare_value
        if op in {'neq', 'not_equals'}:
            return value != compare_value
        if op in {'gt', 'greater_than'}:
            return value > compare_value
        if op in {'lt', 'less_than'}:
            return value < compare_value
        if op in {'gte', 'greater_or_equal'}:
            return value >= compare_value
        if op in {'lte', 'less_or_equal'}:
            return value <= compare_value
        if op == 'contains':
            return str(compare_value) in str(value)
        if op == 'not_contains':
            return str(compare_value) not in str(value)
        if op == 'is_empty':
            return value in (None, '', [], {})
        if op == 'is_not_empty':
            return value not in (None, '', [], {})

        logger.warning('Unknown operator: %s', operator)
        return False

    @staticmethod
    def _maybe_coerce_numeric_pair(a: Any, b: Any) -> Tuple[Any, Any]:
        if isinstance(a, str) and isinstance(b, str) and a.isdigit() and b.isdigit():
            return int(a), int(b)

        if isinstance(a, (int, float)) and isinstance(b, str):
            s = b.strip()
            if s.replace('.', '', 1).isdigit():
                return a, float(s) if '.' in s else int(s)

        if isinstance(b, (int, float)) and isinstance(a, str):
            s = a.strip()
            if s.replace('.', '', 1).isdigit():
                return (float(s) if '.' in s else int(s)), b

        return a, b

    # -------------------------------------------------------------------------
    # Action execution
    # -------------------------------------------------------------------------

    def _execute_action(self, action: TenantWorkflowAction) -> None:
        logger.info('Executing action: %s (order: %s)', action.action_type, getattr(action, 'order', None))

        config = action.config or {}
        foreach = config.get('foreach')

        if foreach:
            self._execute_foreach(action, foreach)
            return

        self._dispatch_action(action)
        self._record_action_success(action)

    def _execute_foreach(self, action: TenantWorkflowAction, foreach: Dict[str, Any]) -> None:
        array_path = foreach.get('array')
        if not array_path:
            raise WorkflowExecutionError('foreach.array is required')

        item_var = foreach.get('item_var', 'item')
        index_var = foreach.get('index_var', 'index')
        max_iterations = int(foreach.get('max_iterations', 1000))
        break_on_error = bool(foreach.get('break_on_error', True))

        resolved = self._resolve_field_value(str(array_path))
        if resolved is None:
            raise WorkflowExecutionError(f'foreach.array resolved to None: {array_path}')
        if not isinstance(resolved, list):
            raise WorkflowExecutionError(f'foreach.array must resolve to a list; got {type(resolved).__name__}')

        if len(resolved) > max_iterations:
            raise WorkflowExecutionError(f'foreach exceeded max_iterations ({max_iterations})')

        # Execute the underlying action once per element.
        # Important: remove foreach wrapper for inner runs to avoid recursion.
        original_config = dict(action.config or {})
        try:
            inner_config = dict(original_config)
            inner_config.pop('foreach', None)
            action.config = inner_config

            for idx, item in enumerate(resolved):
                self.context['variables'][item_var] = item
                self.context['variables'][index_var] = idx

                try:
                    self._dispatch_action(action)
                    self._record_action_success(action, extra={'foreach_index': idx})

                except Exception as e:  # noqa: BLE001
                    self._record_action_failure(action, e, extra={'foreach_index': idx})
                    if break_on_error and not getattr(action, 'continue_on_error', False):
                        raise

        finally:
            action.config = original_config
            # Don't leak iteration vars if user reuses names
            self.context['variables'].pop(item_var, None)
            self.context['variables'].pop(index_var, None)

    def _dispatch_action(self, action: TenantWorkflowAction) -> None:
        handler_map = {
            'send_email': self._execute_email_action,
            'webhook': self._execute_webhook_action,
            'update_record': self._execute_update_record,
            'create_record': self._execute_create_record,
            'run_workflow': self._execute_run_workflow,
            'set_variable': self._execute_set_variable,
        }

        handler = handler_map.get(action.action_type)
        if not handler:
            logger.warning('Unknown action type: %s', action.action_type)
            return

        handler(action)

    # -------------------------------------------------------------------------
    # Field resolution
    # -------------------------------------------------------------------------

    def _resolve_field_value(self, field_path: str) -> Any:
        path = (field_path or '').strip()
        if path.startswith('{{') and path.endswith('}}'):
            path = path[2:-2].strip()

        # Conditions in models are often stored as relative paths (e.g., "customer.email").
        if not any(path.startswith(p) for p in ('trigger.', 'variables.', 'workflow.', 'timestamp')):
            path = f'trigger.{path}' if path else ''

        value: Any = self.context
        for part in path.split('.') if path else []:
            if isinstance(value, dict):
                value = value.get(part)
            else:
                return None
        return value

    # -------------------------------------------------------------------------
    # Action handlers (placeholders)
    # -------------------------------------------------------------------------

    def _execute_email_action(self, action: TenantWorkflowAction) -> None:
        config = action.config or {}
        logger.info('Email action: to=%s subject=%s', config.get('to'), config.get('subject', 'Workflow Notification'))

    def _execute_webhook_action(self, action: TenantWorkflowAction) -> None:
        config = action.config or {}
        logger.info('Webhook action: %s %s', config.get('method', 'POST'), config.get('url'))

    def _execute_update_record(self, action: TenantWorkflowAction) -> None:
        config = action.config or {}
        logger.info('Update record: model=%s id=%s updates=%s', config.get('model'), config.get('record_id'), config.get('updates', {}))

    def _execute_create_record(self, action: TenantWorkflowAction) -> None:
        config = action.config or {}
        logger.info('Create record: model=%s fields=%s', config.get('model'), config.get('fields', {}))

    def _execute_run_workflow(self, action: TenantWorkflowAction) -> None:
        config = action.config or {}
        logger.info('Run workflow action: workflow_id=%s', config.get('workflow_id'))

    def _execute_set_variable(self, action: TenantWorkflowAction) -> None:
        config = action.config or {}
        name = config.get('name')
        if name:
            self.context['variables'][name] = config.get('value')

    # -------------------------------------------------------------------------
    # Logging + completion
    # -------------------------------------------------------------------------

    def _ensure_log_defaults(self) -> None:
        if not self.execution_log:
            return

        if getattr(self.execution_log, 'execution_log', None) is None:
            self.execution_log.execution_log = []
        if getattr(self.execution_log, 'actions_executed', None) is None:
            self.execution_log.actions_executed = 0
        if getattr(self.execution_log, 'actions_failed', None) is None:
            self.execution_log.actions_failed = 0

    def _record_action_success(self, action: TenantWorkflowAction, extra: Optional[Dict[str, Any]] = None) -> None:
        if not self.execution_log:
            return
        self._ensure_log_defaults()
        self.execution_log.actions_executed += 1
        self.execution_log.execution_log.append({
            'action_id': str(action.id),
            'action_type': action.action_type,
            'status': 'success',
            'timestamp': timezone.now().isoformat(),
            'extra': extra or {},
        })

    def _record_action_failure(self, action: TenantWorkflowAction, error: Exception, extra: Optional[Dict[str, Any]] = None) -> None:
        if not self.execution_log:
            return
        self._ensure_log_defaults()
        self.execution_log.actions_failed += 1
        self.execution_log.execution_log.append({
            'action_id': str(action.id),
            'action_type': action.action_type,
            'status': 'failed',
            'timestamp': timezone.now().isoformat(),
            'error': str(error),
            'extra': extra or {},
        })

    def _complete_execution(self, *, status: str, result: str, error_message: str = '') -> None:
        if not self.execution_log:
            return

        self.execution_log.status = status
        self.execution_log.completed_at = timezone.now()
        self.execution_log.error_message = error_message or ''

        # Some earlier prototypes referenced a `result` field; prefer error_message + execution_log.
        if hasattr(self.execution_log, 'result'):
            setattr(self.execution_log, 'result', result)

        self.execution_log.save(update_fields=['status', 'completed_at', 'error_message', 'execution_log', 'actions_executed', 'actions_failed'])

        # Update workflow stats
        self.workflow.last_run_at = timezone.now()
        self.workflow.run_count = (self.workflow.run_count or 0) + 1
        self.workflow.save(update_fields=['last_run_at', 'run_count'])


def execute_workflow(workflow: TenantWorkflow, trigger_data: Dict[str, Any]) -> WorkflowExecutionLog:
    executor = WorkflowExecutor(workflow, trigger_data)
    return executor.execute()
