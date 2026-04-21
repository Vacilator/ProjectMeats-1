from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.system.models import TenantWorkForm
from apps.system.services.workform_engine import WorkFormEngine
from apps.system.tasks import execute_workform_execution, execute_workform_loop_item
from apps.tenants.models import Tenant, TenantUser
from tenant_apps.workflows.models import TenantWorkFormExecution, TenantWorkFormExecutionStatus


User = get_user_model()


class WorkFormEngineSemanticsTests(TestCase):
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

    def test_task_marks_execution_failed_when_rls_set_fails(self):
        workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name='WF rls-fail',
            status='active',
            workflow_definition={
                'nodes': [
                    {'id': 't1', 'type': 'triggerManual', 'data': {}},
                    {'id': 'end', 'type': 'end', 'data': {}},
                ],
                'edges': [
                    {'id': 'e1', 'source': 't1', 'target': 'end', 'type': 'default'},
                ],
            },
            created_by=self.user,
            updated_by=self.user,
        )

        execution = TenantWorkFormExecution.objects.create(
            tenant=self.tenant,
            workform=workform,
            status=TenantWorkFormExecutionStatus.IN_PROGRESS,
            initial_data={},
            started_by=self.user,
            started_at=timezone.now(),
        )

        with patch('apps.tenants.rls.set_current_tenant', return_value=SimpleNamespace(ok=False, error='nope')):
            execute_workform_execution(execution_id=str(execution.id), tenant_id=str(self.tenant.id))

        execution.refresh_from_db()
        self.assertEqual(execution.status, TenantWorkFormExecutionStatus.FAILED)
        self.assertIsNotNone(execution.completed_at)
        self.assertIn('RLS set failed', execution.error_message)

    def test_action_error_routes_to_error_edge_and_execution_completes(self):
        """If an action node fails and has an error edge, the engine should route once and complete.

        This prevents accidental "retry loops" where a failed action is re-run indefinitely.
        """

        workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name='WF error-route',
            status='active',
            workflow_definition={
                'nodes': [
                    {'id': 't1', 'type': 'triggerManual', 'data': {}},
                    {'id': 'a1', 'type': 'actionEmail', 'data': {'config': {'to': 'x@example.com'}}},
                    {'id': 'end', 'type': 'end', 'data': {}},
                ],
                'edges': [
                    {'id': 'e1', 'source': 't1', 'target': 'a1', 'type': 'default'},
                    {'id': 'e2', 'source': 'a1', 'target': 'end', 'type': 'default'},
                    {'id': 'e3', 'source': 'a1', 'target': 'end', 'type': 'error'},
                ],
            },
            created_by=self.user,
            updated_by=self.user,
        )

        execution = TenantWorkFormExecution.objects.create(
            tenant=self.tenant,
            workform=workform,
            status=TenantWorkFormExecutionStatus.IN_PROGRESS,
            initial_data={'entity_type': 'customer', 'entity_id': '123'},
            started_by=self.user,
            started_at=timezone.now(),
        )

        with patch('apps.tenants.rls.set_current_tenant', return_value=SimpleNamespace(ok=True, error=None)):
            with patch(
                'tenant_apps.workflows.services.action_executor.ActionExecutor.execute',
                return_value={'success': False, 'error': 'Boom'},
            ) as mock_execute:
                execute_workform_execution(execution_id=str(execution.id), tenant_id=str(self.tenant.id))

        execution.refresh_from_db()
        self.assertEqual(execution.status, TenantWorkFormExecutionStatus.COMPLETED)
        self.assertEqual(mock_execute.call_count, 1)

        # Ensure error routing is recorded and errors payload is preserved.
        self.assertIsInstance(execution.context_data, dict)
        errors = (execution.context_data or {}).get('errors')
        self.assertIsInstance(errors, list)
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].get('node_id'), 'a1')
        self.assertEqual(errors[0].get('error'), 'Boom')

        self.assertIsInstance(execution.audit_trail, list)
        routed = [r for r in execution.audit_trail if isinstance(r, dict) and r.get('event') == 'action_error']
        self.assertTrue(routed)
        self.assertEqual(routed[0].get('node_id'), 'a1')
        self.assertEqual(routed[0].get('routed_to'), 'end')

    def test_loop_node_enqueues_items_and_continues_on_complete(self):
        workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name='WF loop-enqueue',
            status='active',
            workflow_definition={
                'nodes': [
                    {'id': 't1', 'type': 'triggerManual', 'data': {}},
                    {
                        'id': 'l1',
                        'type': 'loopForEach',
                        'data': {'config': {'arrayVariable': 'items', 'maxIterations': 10}},
                    },
                    {'id': 'body', 'type': 'actionNotify', 'data': {'config': {}}},
                    {'id': 'end', 'type': 'end', 'data': {}},
                ],
                'edges': [
                    {'id': 'e1', 'source': 't1', 'target': 'l1', 'type': 'default'},
                    {
                        'id': 'e2',
                        'source': 'l1',
                        'target': 'body',
                        'type': 'default',
                        'sourceHandle': 'loop-body',
                    },
                    {
                        'id': 'e3',
                        'source': 'l1',
                        'target': 'end',
                        'type': 'default',
                        'sourceHandle': 'on-complete',
                    },
                ],
            },
            created_by=self.user,
            updated_by=self.user,
        )

        engine = WorkFormEngine(workform, initial_context={'trigger': {'items': [1, 2, 3]}, 'variables': {}, 'errors': []})

        with patch('apps.system.services.workform_engine.execute_workform_loop_item.delay') as mock_delay:
            result = engine.execute(trigger_payload={'items': [1, 2, 3]})

        self.assertTrue(result.success)
        self.assertEqual(mock_delay.call_count, 3)

        trail = (result.context or {}).get('audit_trail') or []
        loop_events = [r for r in trail if isinstance(r, dict) and r.get('event') == 'loop_enqueued']
        self.assertTrue(loop_events)
        self.assertEqual(loop_events[0].get('node_id'), 'l1')
        self.assertEqual(loop_events[0].get('items'), 3)

    def test_loop_item_execution_stops_at_loop_boundary_even_if_graph_routes_back(self):
        """The per-item loop execution uses stop_node_ids=[loop_node_id] and must not cycle."""

        workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name='WF loop-item-boundary',
            status='active',
            workflow_definition={
                'nodes': [
                    {'id': 'l1', 'type': 'loopForEach', 'data': {'config': {}}},
                    {'id': 'a1', 'type': 'actionNotify', 'data': {'config': {}}},
                ],
                'edges': [
                    {'id': 'e1', 'source': 'l1', 'target': 'a1', 'type': 'default', 'sourceHandle': 'loop-body'},
                    # Body routes back to the loop node (would cycle without stop_node_ids)
                    {'id': 'e2', 'source': 'a1', 'target': 'l1', 'type': 'default'},
                ],
            },
            created_by=self.user,
            updated_by=self.user,
        )

        with patch(
            'tenant_apps.workflows.services.action_executor.ActionExecutor.execute',
            return_value={'success': True},
        ) as mock_execute:
            out = execute_workform_loop_item(
                workform_id=str(workform.id),
                loop_node_id='l1',
                loop_body_start_node_id='a1',
                index=0,
                item={'k': 'v'},
                base_context={'trigger': {}, 'variables': {}},
            )

        self.assertTrue(out.get('success'))
        self.assertEqual(mock_execute.call_count, 1)
