"""Unit tests for Workflow Execution Engine.

These tests are intentionally runnable without Django's test runner to avoid
heavy DB/migration setup in constrained dev environments.
"""

import os
import unittest
from unittest.mock import Mock, patch

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'projectmeats.settings.test')

import django  # noqa: E402

django.setup()

from tenant_apps.workflows.models import TenantWorkflow  # noqa: E402
from tenant_apps.workflows.services.workflow_executor import WorkflowExecutor  # noqa: E402


class WorkflowExecutorTestCase(unittest.TestCase):
    def setUp(self):
        self.tenant = Mock()
        self.tenant.id = 'tenant-123'

        self.workflow = Mock(spec=TenantWorkflow)
        self.workflow.id = 'workflow-123'
        self.workflow.name = 'Test Workflow'
        self.workflow.tenant = self.tenant
        self.workflow.tenant_id = self.tenant.id
        self.workflow.trigger_type = 'manual'
        self.workflow.trigger_config = {}
        self.workflow.run_count = 0
        self.workflow.save = Mock()

        self.trigger_data = {
            'customer': {'email': 'test@example.com', 'name': 'Test Customer'},
            'order_id': '12345',
            'items': [{'sku': 'A'}, {'sku': 'B'}],
        }

        # Default: no conditions
        self.workflow.conditions.all().order_by.return_value = []

    def test_context_building(self):
        executor = WorkflowExecutor(self.workflow, self.trigger_data)
        self.assertEqual(executor.context['trigger'], self.trigger_data)
        self.assertEqual(executor.context['workflow']['name'], 'Test Workflow')

    def test_resolve_field_value(self):
        executor = WorkflowExecutor(self.workflow, self.trigger_data)
        self.assertEqual(executor._resolve_field_value('trigger.customer.email'), 'test@example.com')
        self.assertEqual(executor._resolve_field_value('customer.email'), 'test@example.com')
        self.assertIsNone(executor._resolve_field_value('trigger.missing.field'))

    def test_evaluate_condition_equals(self):
        executor = WorkflowExecutor(self.workflow, self.trigger_data)

        condition = Mock()
        condition.field = 'trigger.order_id'
        condition.operator = 'equals'
        condition.value = '12345'

        self.assertTrue(executor._evaluate_single_condition(condition))

    def test_set_variable_action(self):
        executor = WorkflowExecutor(self.workflow, self.trigger_data)

        action = Mock()
        action.action_type = 'set_variable'
        action.config = {'name': 'total_amount', 'value': 1500}

        executor._execute_set_variable(action)
        self.assertEqual(executor.context['variables']['total_amount'], 1500)

    @patch('tenant_apps.workflows.services.workflow_executor.WorkflowExecutionLog')
    def test_execute_workflow_success_with_no_actions(self, mock_log_class):
        mock_log = Mock()
        mock_log.execution_log = []
        mock_log.actions_executed = 0
        mock_log.actions_failed = 0
        mock_log.save = Mock()
        mock_log_class.objects.create.return_value = mock_log

        self.workflow.actions.all().order_by.return_value = []

        executor = WorkflowExecutor(self.workflow, self.trigger_data)
        result = executor.execute()

        mock_log_class.objects.create.assert_called_once()
        self.assertIs(result, mock_log)
        self.assertEqual(mock_log.status, 'success')

    @patch('tenant_apps.workflows.services.workflow_executor.WorkflowExecutionLog')
    def test_foreach_wrapper_executes_action_multiple_times(self, mock_log_class):
        mock_log = Mock()
        mock_log.execution_log = []
        mock_log.actions_executed = 0
        mock_log.actions_failed = 0
        mock_log.save = Mock()
        mock_log_class.objects.create.return_value = mock_log

        action = Mock()
        action.id = 'action-1'
        action.order = 0
        action.action_type = 'send_email'
        action.continue_on_error = False
        action.config = {
            'foreach': {
                'array': 'trigger.items',
                'item_var': 'item',
                'index_var': 'index',
                'max_iterations': 10,
                'break_on_error': True,
            },
            'to': 'test@example.com',
        }

        self.workflow.actions.all().order_by.return_value = [action]

        executor = WorkflowExecutor(self.workflow, self.trigger_data)
        executor._execute_email_action = Mock()

        executor.execute()

        # Should run once per item
        self.assertEqual(executor._execute_email_action.call_count, 2)
        self.assertEqual(mock_log.actions_executed, 2)
