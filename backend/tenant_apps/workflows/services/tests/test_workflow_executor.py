"""
Unit tests for Workflow Execution Engine
"""

from unittest.mock import Mock, patch
from django.test import TestCase
from django.utils import timezone

from workflows.models import TenantWorkflow, TenantWorkflowAction, WorkflowExecutionLog
from workflows.services.workflow_executor import (
    WorkflowExecutor,
    WorkflowExecutionError,
    execute_workflow
)


class WorkflowExecutorTestCase(TestCase):
    """Test suite for WorkflowExecutor"""
    
    def setUp(self):
        self.tenant = Mock()
        self.tenant.id = 'tenant-123'
        
        self.workflow = Mock(spec=TenantWorkflow)
        self.workflow.id = 'workflow-123'
        self.workflow.name = 'Test Workflow'
        self.workflow.tenant = self.tenant
        self.workflow.tenant_id = self.tenant.id
        self.workflow.execution_count = 0
        
        self.trigger_data = {
            'customer': {'email': 'test@example.com', 'name': 'Test Customer'},
            'order_id': '12345'
        }
    
    def test_context_building(self):
        executor = WorkflowExecutor(self.workflow, self.trigger_data)
        
        self.assertIn('trigger', executor.context)
        self.assertIn('workflow', executor.context)
        self.assertIn('timestamp', executor.context)
        self.assertIn('variables', executor.context)
        
        self.assertEqual(executor.context['trigger'], self.trigger_data)
        self.assertEqual(executor.context['workflow']['name'], 'Test Workflow')
    
    def test_resolve_field_value(self):
        executor = WorkflowExecutor(self.workflow, self.trigger_data)
        
        # Test dot notation
        email = executor._resolve_field_value('trigger.customer.email')
        self.assertEqual(email, 'test@example.com')
        
        # Test top-level field
        order_id = executor._resolve_field_value('trigger.order_id')
        self.assertEqual(order_id, '12345')
        
        # Test non-existent field
        missing = executor._resolve_field_value('trigger.missing.field')
        self.assertIsNone(missing)
    
    def test_evaluate_condition_equals(self):
        executor = WorkflowExecutor(self.workflow, self.trigger_data)
        
        condition = Mock()
        condition.field = 'trigger.order_id'
        condition.operator = 'equals'
        condition.value = '12345'
        
        result = executor._evaluate_single_condition(condition)
        self.assertTrue(result)
    
    def test_evaluate_condition_contains(self):
        executor = WorkflowExecutor(self.workflow, self.trigger_data)
        
        condition = Mock()
        condition.field = 'trigger.customer.email'
        condition.operator = 'contains'
        condition.value = '@example.com'
        
        result = executor._evaluate_single_condition(condition)
        self.assertTrue(result)
    
    def test_evaluate_condition_is_not_empty(self):
        executor = WorkflowExecutor(self.workflow, self.trigger_data)
        
        condition = Mock()
        condition.field = 'trigger.customer.name'
        condition.operator = 'is_not_empty'
        condition.value = ''
        
        result = executor._evaluate_single_condition(condition)
        self.assertTrue(result)
    
    def test_set_variable_action(self):
        executor = WorkflowExecutor(self.workflow, self.trigger_data)
        
        action = Mock()
        action.action_type = 'set_variable'
        action.config = {'name': 'total_amount', 'value': 1500}
        
        executor._execute_set_variable(action)
        
        self.assertEqual(executor.context['variables']['total_amount'], 1500)
    
    @patch('workflows.services.workflow_executor.WorkflowExecutionLog')
    def test_execute_workflow_success(self, mock_log_class):
        mock_log = Mock()
        mock_log_class.objects.create.return_value = mock_log
        
        self.workflow.actions.all().order_by.return_value.exists.return_value = False
        
        executor = WorkflowExecutor(self.workflow, self.trigger_data)
        result = executor.execute()
        
        # Should create execution log
        mock_log_class.objects.create.assert_called_once()
        
        # Should mark as completed
        self.assertEqual(mock_log.status, 'completed')
    
    def test_evaluate_conditions_and_logic(self):
        executor = WorkflowExecutor(self.workflow, self.trigger_data)
        
        action = Mock()
        action.condition_logic = 'and'
        
        # Create two conditions
        cond1 = Mock()
        cond1.field = 'trigger.order_id'
        cond1.operator = 'equals'
        cond1.value = '12345'
        
        cond2 = Mock()
        cond2.field = 'trigger.customer.email'
        cond2.operator = 'contains'
        cond2.value = '@example.com'
        
        action.conditions.all.return_value.exists.return_value = True
        action.conditions.all.return_value.__iter__ = lambda self: iter([cond1, cond2])
        
        result = executor._evaluate_conditions(action)
        self.assertTrue(result)
    
    def test_evaluate_conditions_or_logic(self):
        executor = WorkflowExecutor(self.workflow, self.trigger_data)
        
        action = Mock()
        action.condition_logic = 'or'
        
        # Create two conditions (one fails, one passes)
        cond1 = Mock()
        cond1.field = 'trigger.order_id'
        cond1.operator = 'equals'
        cond1.value = '99999'  # Will fail
        
        cond2 = Mock()
        cond2.field = 'trigger.customer.email'
        cond2.operator = 'contains'
        cond2.value = '@example.com'  # Will pass
        
        action.conditions.all.return_value.exists.return_value = True
        action.conditions.all.return_value.__iter__ = lambda self: iter([cond1, cond2])
        
        result = executor._evaluate_conditions(action)
        self.assertTrue(result)  # OR logic: at least one passes
