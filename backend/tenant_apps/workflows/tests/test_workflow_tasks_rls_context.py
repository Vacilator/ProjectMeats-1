from __future__ import annotations

from unittest.mock import MagicMock, patch

from django.test import TestCase


class WorkflowCeleryTasksRlsContextTestCase(TestCase):
    @patch('apps.tenants.rls.reset_current_tenant')
    @patch('apps.tenants.rls.set_current_tenant')
    @patch('tenant_apps.workflows.services.workflow_executor.execute_workflow')
    @patch('tenant_apps.workflows.models.TenantWorkflow.objects.get')
    @patch('apps.tenants.models.Tenant.objects.get')
    def test_execute_scheduled_workflow_sets_and_resets_rls(
        self,
        mock_tenant_get,
        mock_workflow_get,
        mock_execute_workflow,
        mock_set_current_tenant,
        mock_reset_current_tenant,
    ):
        from tenant_apps.workflows.tasks import execute_scheduled_workflow

        mock_set_current_tenant.return_value = MagicMock(ok=True, error=None)

        tenant = MagicMock()
        tenant.id = '11111111-1111-1111-1111-111111111111'
        mock_tenant_get.return_value = tenant

        workflow = MagicMock()
        workflow.name = 'Test WF'
        workflow.tenant = tenant
        workflow.tenant_id = tenant.id
        mock_workflow_get.return_value = workflow

        log = MagicMock()
        log.id = '22222222-2222-2222-2222-222222222222'
        log.status = 'success'
        mock_execute_workflow.return_value = log

        result = execute_scheduled_workflow(
            workflow_id='33333333-3333-3333-3333-333333333333',
            tenant_id=str(tenant.id),
        )

        self.assertTrue(result['success'])
        self.assertEqual(result['execution_id'], str(log.id))
        self.assertEqual(result['status'], 'success')

        mock_set_current_tenant.assert_called_once_with(str(tenant.id))
        mock_reset_current_tenant.assert_called_once()

    @patch('apps.tenants.rls.reset_current_tenant')
    @patch('apps.tenants.rls.set_current_tenant')
    @patch('tenant_apps.workflows.services.workflow_executor.execute_workflow')
    @patch('tenant_apps.workflows.models.TenantWorkflow.objects.get')
    @patch('apps.tenants.models.Tenant.objects.get')
    def test_execute_scheduled_workflow_resets_rls_on_error(
        self,
        mock_tenant_get,
        mock_workflow_get,
        mock_execute_workflow,
        mock_set_current_tenant,
        mock_reset_current_tenant,
    ):
        from tenant_apps.workflows.tasks import execute_scheduled_workflow

        mock_set_current_tenant.return_value = MagicMock(ok=True, error=None)

        tenant = MagicMock()
        tenant.id = '11111111-1111-1111-1111-111111111111'
        mock_tenant_get.return_value = tenant

        workflow = MagicMock()
        workflow.name = 'Test WF'
        workflow.tenant = tenant
        workflow.tenant_id = tenant.id
        mock_workflow_get.return_value = workflow

        mock_execute_workflow.side_effect = RuntimeError('boom')

        result = execute_scheduled_workflow(
            workflow_id='33333333-3333-3333-3333-333333333333',
            tenant_id=str(tenant.id),
        )

        self.assertFalse(result['success'])
        self.assertIn('boom', result['error'])

        mock_set_current_tenant.assert_called_once_with(str(tenant.id))
        mock_reset_current_tenant.assert_called_once()
