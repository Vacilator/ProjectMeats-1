from __future__ import annotations

import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.system.models import TenantWorkForm
from apps.tenants.models import Tenant, TenantUser
from tenant_apps.workflows.models import TenantWorkFormExecution
from tenant_apps.workflows.views import TenantWorkFormExecutionViewSet


class TenantWorkFormExecutionViewSetFilterTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.factory = APIRequestFactory()

        self.user = User.objects.create_user(username=f'u-{unique}', password='pw')

        self.tenant_a = Tenant.objects.create(
            name=f'Tenant A {unique}',
            slug=f'tenant-a-{unique}',
            contact_email=f'a-{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )
        self.tenant_b = Tenant.objects.create(
            name=f'Tenant B {unique}',
            slug=f'tenant-b-{unique}',
            contact_email=f'b-{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )

        TenantUser.objects.create(tenant=self.tenant_a, user=self.user, role='admin', is_active=True)
        TenantUser.objects.create(tenant=self.tenant_b, user=self.user, role='admin', is_active=True)

        definition = {
            'nodes': [
                {'id': 't1', 'type': 'triggerManual', 'data': {'label': 'Manual Trigger'}},
                {'id': 'n1', 'type': 'actionEmail', 'data': {'label': 'Send Email'}},
            ],
            'edges': [],
        }

        self.workform_a = TenantWorkForm.objects.create(
            tenant=self.tenant_a,
            name='WF A',
            workflow_definition=definition,
            status='active',
            created_by=self.user,
            updated_by=self.user,
        )
        self.workform_b = TenantWorkForm.objects.create(
            tenant=self.tenant_b,
            name='WF B',
            workflow_definition=definition,
            status='active',
            created_by=self.user,
            updated_by=self.user,
        )

        self.exec_a_1 = TenantWorkFormExecution.objects.create(
            tenant=self.tenant_a,
            workform=self.workform_a,
            status='completed',
            initial_data={'entity_type': 'customer', 'entity_id': '1'},
            audit_trail=[
                {'event': 'action_start', 'node_id': 'n1', 'node_type': 'actionEmail'},
                {'event': 'action_success', 'node_id': 'n1', 'node_type': 'actionEmail'},
            ],
            started_by=self.user,
        )
        # Ensure entity_id filtering works even when the JSON payload persisted a number.
        self.exec_a_1_int = TenantWorkFormExecution.objects.create(
            tenant=self.tenant_a,
            workform=self.workform_a,
            status='completed',
            initial_data={'entity_type': 'customer', 'entity_id': 1},
            runtime_state={
                'version': 1,
                'execution_status': 'completed',
                'node_statuses': {'n1': 'completed'},
                'current_node_id': 'n1',
                'current_node_type': 'actionEmail',
                'current_node_label': 'Send Email',
                'last_event': 'action_success',
                'errors': [],
            },
            started_by=self.user,
        )
        self.exec_a_2 = TenantWorkFormExecution.objects.create(
            tenant=self.tenant_a,
            workform=self.workform_a,
            status='completed',
            initial_data={'entity_type': 'customer', 'entity_id': '2'},
            started_by=self.user,
        )
        self.exec_b_1 = TenantWorkFormExecution.objects.create(
            tenant=self.tenant_b,
            workform=self.workform_b,
            status='completed',
            initial_data={'entity_type': 'customer', 'entity_id': '1'},
            started_by=self.user,
        )
        self.exec_b_1_int = TenantWorkFormExecution.objects.create(
            tenant=self.tenant_b,
            workform=self.workform_b,
            status='completed',
            initial_data={'entity_type': 'customer', 'entity_id': 1},
            started_by=self.user,
        )

        self.exec_a_err = TenantWorkFormExecution.objects.create(
            tenant=self.tenant_a,
            workform=self.workform_a,
            status='failed',
            initial_data={'entity_type': 'customer', 'entity_id': '99'},
            context_data={
                'errors': [
                    {'node_id': 'n1', 'node_type': 'actionEmail', 'error': 'Boom'},
                ]
            },
            started_by=self.user,
        )

        self.exec_a_runtime_clean = TenantWorkFormExecution.objects.create(
            tenant=self.tenant_a,
            workform=self.workform_a,
            status='completed',
            initial_data={'entity_type': 'customer', 'entity_id': 'runtime-clean'},
            runtime_state={
                'version': 1,
                'execution_status': 'completed',
                'node_statuses': {'n1': 'completed'},
                'current_node_id': 'n1',
                'current_node_type': 'actionEmail',
                'current_node_label': 'Send Email',
                'last_event': 'action_success',
                'errors': [],
            },
            audit_trail=[
                {'event': 'action_error', 'node_id': 'n1', 'node_type': 'actionEmail', 'error': 'Stale error'},
            ],
            started_by=self.user,
        )

    def _get(self, path: str, tenant):
        request = self.factory.get(path)
        force_authenticate(request, user=self.user)
        request.tenant = tenant
        return request

    def _items(self, response):
        data = response.data
        if isinstance(data, dict) and 'results' in data:
            return data['results']
        return data

    def test_filters_by_entity_and_tenant(self):
        req = self._get(
            '/api/v1/workflows/workform-executions/?entity_type=customer&entity_id=1',
            self.tenant_a,
        )
        resp = TenantWorkFormExecutionViewSet.as_view({'get': 'list'})(req)
        self.assertEqual(resp.status_code, 200)

        rows = self._items(resp)
        ids = {row.get('id') for row in rows}
        self.assertIn(str(self.exec_a_1.id), ids)
        self.assertIn(str(self.exec_a_1_int.id), ids)
        self.assertNotIn(str(self.exec_a_2.id), ids)
        self.assertNotIn(str(self.exec_b_1.id), ids)
        self.assertNotIn(str(self.exec_b_1_int.id), ids)

        # Serializer exposes per-node statuses derived from audit_trail
        row = next(r for r in rows if r.get('id') == str(self.exec_a_1.id))
        self.assertEqual(row.get('node_statuses', {}).get('n1'), 'completed')

        # Runtime metadata helpers
        self.assertEqual(row.get('current_node_id'), 'n1')
        self.assertEqual(row.get('current_node_type'), 'actionEmail')
        self.assertEqual(row.get('current_node_label'), 'Send Email')
        self.assertEqual(row.get('node_labels', {}).get('n1'), 'Send Email')
        self.assertEqual(row.get('last_event'), 'action_success')
        self.assertEqual(row.get('errors'), [])

        row_runtime = next(r for r in rows if r.get('id') == str(self.exec_a_1_int.id))
        self.assertEqual(row_runtime.get('node_statuses', {}).get('n1'), 'completed')
        self.assertEqual(row_runtime.get('current_node_id'), 'n1')
        self.assertEqual(row_runtime.get('current_node_type'), 'actionEmail')
        self.assertEqual(row_runtime.get('current_node_label'), 'Send Email')
        self.assertEqual(row_runtime.get('last_event'), 'action_success')

    def test_errors_include_node_label(self):
        req = self._get(
            '/api/v1/workflows/workform-executions/?entity_type=customer&entity_id=99',
            self.tenant_a,
        )
        resp = TenantWorkFormExecutionViewSet.as_view({'get': 'list'})(req)
        self.assertEqual(resp.status_code, 200)

        rows = self._items(resp)
        ids = {row.get('id') for row in rows}
        self.assertIn(str(self.exec_a_err.id), ids)
        self.assertNotIn(str(self.exec_b_1.id), ids)
        self.assertNotIn(str(self.exec_b_1_int.id), ids)

        row = next(r for r in rows if r.get('id') == str(self.exec_a_err.id))
        self.assertEqual(row.get('errors')[0].get('node_id'), 'n1')
        self.assertEqual(row.get('errors')[0].get('node_label'), 'Send Email')

    def test_runtime_state_errors_take_precedence_over_stale_audit_trail(self):
        req = self._get(
            '/api/v1/workflows/workform-executions/?entity_type=customer&entity_id=runtime-clean',
            self.tenant_a,
        )
        resp = TenantWorkFormExecutionViewSet.as_view({'get': 'list'})(req)
        self.assertEqual(resp.status_code, 200)

        rows = self._items(resp)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].get('id'), str(self.exec_a_runtime_clean.id))
        self.assertEqual(rows[0].get('errors'), [])

    def test_filters_by_workform_id(self):
        req = self._get(
            f'/api/v1/workflows/workform-executions/?workform={self.workform_a.id}',
            self.tenant_a,
        )
        resp = TenantWorkFormExecutionViewSet.as_view({'get': 'list'})(req)
        self.assertEqual(resp.status_code, 200)

        ids = {row.get('id') for row in self._items(resp)}
        self.assertIn(str(self.exec_a_1.id), ids)
        self.assertIn(str(self.exec_a_1_int.id), ids)
        self.assertIn(str(self.exec_a_2.id), ids)
        self.assertNotIn(str(self.exec_b_1.id), ids)
        self.assertNotIn(str(self.exec_b_1_int.id), ids)

    def test_missing_tenant_fails_closed(self):
        req = self._get('/api/v1/workflows/workform-executions/', None)
        resp = TenantWorkFormExecutionViewSet.as_view({'get': 'list'})(req)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(self._items(resp)), 0)

    def test_retrieve_is_tenant_scoped(self):
        view = TenantWorkFormExecutionViewSet.as_view({'get': 'retrieve'})

        req_other = self._get(
            f'/api/v1/workflows/workform-executions/{self.exec_b_1.id}/',
            self.tenant_a,
        )
        resp_other = view(req_other, pk=str(self.exec_b_1.id))
        self.assertEqual(resp_other.status_code, 404)

        req_own = self._get(
            f'/api/v1/workflows/workform-executions/{self.exec_a_1.id}/',
            self.tenant_a,
        )
        resp_own = view(req_own, pk=str(self.exec_a_1.id))
        self.assertEqual(resp_own.status_code, 200)
        self.assertEqual(str(resp_own.data.get('id')), str(self.exec_a_1.id))
