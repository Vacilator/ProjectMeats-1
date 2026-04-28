from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from apps.system.models import TenantWorkForm
from apps.system.tasks import execute_workform_execution
from apps.tenants.models import Tenant, TenantUser
from tenant_apps.workflows.models import ExecutionEventLog, TenantWorkFormExecution, TenantWorkFormExecutionStatus


class WorkFormExecutionAuditTrailTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(username=f'u-{unique}', password='pw')

        self.tenant = Tenant.objects.create(
            name=f'Tenant {unique}',
            slug=f'tenant-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='admin', is_active=True)

        self.workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name='WF',
            workflow_definition={
                'nodes': [
                    {'id': 't1', 'type': 'triggerManual', 'data': {}},
                    {'id': 'end', 'type': 'end', 'data': {}},
                ],
                'edges': [
                    {'id': 'e1', 'source': 't1', 'target': 'end', 'type': 'default'},
                ],
            },
            status='active',
            created_by=self.user,
            updated_by=self.user,
        )

    def _create_execution(self, *, workform: TenantWorkForm | None = None) -> TenantWorkFormExecution:
        return TenantWorkFormExecution.objects.create(
            tenant=self.tenant,
            workform=workform or self.workform,
            status=TenantWorkFormExecutionStatus.IN_PROGRESS,
            initial_data={'entity_type': 'customer', 'entity_id': '123'},
            started_by=self.user,
            started_at=timezone.now(),
        )

    def test_execute_task_persists_audit_trail(self):
        execution = self._create_execution()

        with patch('apps.tenants.rls.set_current_tenant', return_value=SimpleNamespace(ok=True, error=None)):
            execute_workform_execution(execution_id=str(execution.id), tenant_id=str(self.tenant.id))

        execution.refresh_from_db()
        self.assertEqual(execution.status, TenantWorkFormExecutionStatus.COMPLETED)
        self.assertIsInstance(execution.audit_trail, list)
        self.assertGreaterEqual(len(execution.audit_trail), 2)

        events = [row.get('event') for row in execution.audit_trail if isinstance(row, dict)]
        self.assertIn('execution_start', events)
        self.assertIn('execution_complete', events)

        persisted = list(
            ExecutionEventLog.objects.filter(workform_execution=execution).order_by('sequence').values_list('event_type', flat=True)
        )
        self.assertIn('execution_start', persisted)
        self.assertIn('execution_complete', persisted)

    def test_execute_task_persists_successful_action_event_logs(self):
        action_workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name='WF Action Success',
            workflow_definition={
                'nodes': [
                    {'id': 't1', 'type': 'triggerManual', 'data': {}},
                    {'id': 'a1', 'type': 'actionEmail', 'data': {'config': {'subject': 'Hello'}}},
                    {'id': 'end', 'type': 'end', 'data': {}},
                ],
                'edges': [
                    {'id': 'e1', 'source': 't1', 'target': 'a1', 'type': 'default'},
                    {'id': 'e2', 'source': 'a1', 'target': 'end', 'type': 'default'},
                ],
            },
            status='active',
            created_by=self.user,
            updated_by=self.user,
        )
        execution = self._create_execution(workform=action_workform)

        with (
            patch('apps.tenants.rls.set_current_tenant', return_value=SimpleNamespace(ok=True, error=None)),
            patch(
                'tenant_apps.workflows.services.action_executor.ActionExecutor.execute',
                return_value={'success': True, 'message_id': 'msg-1'},
            ),
        ):
            execute_workform_execution(execution_id=str(execution.id), tenant_id=str(self.tenant.id))

        success_event = ExecutionEventLog.objects.get(workform_execution=execution, event_type='action_success', node_id='a1')
        self.assertEqual(success_event.status, 'success')
        self.assertEqual(success_event.node_type, 'actionEmail')
        self.assertIsNotNone(success_event.completed_at)
        self.assertIsNotNone(success_event.duration_ms)
        self.assertGreaterEqual(success_event.duration_ms, 0)
        self.assertEqual(success_event.payload, {})

    def test_execute_task_persists_failed_action_event_logs(self):
        action_workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name='WF Action Failure',
            workflow_definition={
                'nodes': [
                    {'id': 't1', 'type': 'triggerManual', 'data': {}},
                    {'id': 'a1', 'type': 'actionEmail', 'data': {'config': {'subject': 'Hello'}}},
                ],
                'edges': [
                    {'id': 'e1', 'source': 't1', 'target': 'a1', 'type': 'default'},
                ],
            },
            status='active',
            created_by=self.user,
            updated_by=self.user,
        )
        execution = self._create_execution(workform=action_workform)

        with (
            patch('apps.tenants.rls.set_current_tenant', return_value=SimpleNamespace(ok=True, error=None)),
            patch(
                'tenant_apps.workflows.services.action_executor.ActionExecutor.execute',
                return_value={'success': False, 'error': 'SMTP offline'},
            ),
        ):
            execute_workform_execution(execution_id=str(execution.id), tenant_id=str(self.tenant.id))

        execution.refresh_from_db()
        self.assertEqual(execution.status, TenantWorkFormExecutionStatus.FAILED)

        failure_event = ExecutionEventLog.objects.get(workform_execution=execution, event_type='action_error', node_id='a1')
        self.assertEqual(failure_event.status, 'failed')
        self.assertEqual(failure_event.node_type, 'actionEmail')
        self.assertEqual(failure_event.payload.get('error'), 'SMTP offline')
        self.assertIsNotNone(failure_event.completed_at)
