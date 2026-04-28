from __future__ import annotations

from datetime import timedelta
import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.system.models import TenantWorkForm
from apps.tenants.models import Tenant, TenantUser
from tenant_apps.workflows.models import ExecutionEventLog, TenantWorkFormExecution
from tenant_apps.workflows.views import TenantWorkFormExecutionViewSet


class TenantWorkFormExecutionAnalyticsViewSetTests(TestCase):
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
                {'id': 'a1', 'type': 'actionEmail', 'data': {'label': 'Send Email'}},
                {'id': 'a2', 'type': 'actionNotify', 'data': {'label': 'Notify Buyer'}},
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

        now = timezone.now()

        self.exec_a_completed = TenantWorkFormExecution.objects.create(
            tenant=self.tenant_a,
            workform=self.workform_a,
            status='completed',
            started_by=self.user,
            started_at=now - timedelta(seconds=8),
            completed_at=now - timedelta(seconds=5),
        )
        self.exec_a_failed = TenantWorkFormExecution.objects.create(
            tenant=self.tenant_a,
            workform=self.workform_a,
            status='failed',
            started_by=self.user,
            started_at=now - timedelta(seconds=4),
            completed_at=now - timedelta(seconds=2),
        )
        self.exec_b_completed = TenantWorkFormExecution.objects.create(
            tenant=self.tenant_b,
            workform=self.workform_b,
            status='completed',
            started_by=self.user,
            started_at=now - timedelta(seconds=6),
            completed_at=now - timedelta(seconds=1),
        )

        ExecutionEventLog.objects.create(
            tenant=self.tenant_a,
            workform=self.workform_a,
            workform_execution=self.exec_a_completed,
            sequence=0,
            event_type='action_success',
            status='success',
            node_id='a1',
            node_type='actionEmail',
            started_at=now - timedelta(seconds=8),
            completed_at=now - timedelta(seconds=7),
            duration_ms=1000,
        )
        ExecutionEventLog.objects.create(
            tenant=self.tenant_a,
            workform=self.workform_a,
            workform_execution=self.exec_a_failed,
            sequence=0,
            event_type='action_error',
            status='failed',
            node_id='a2',
            node_type='actionNotify',
            started_at=now - timedelta(seconds=4),
            completed_at=now - timedelta(seconds=3),
            duration_ms=1000,
            payload={'error': 'SMTP offline'},
        )
        ExecutionEventLog.objects.create(
            tenant=self.tenant_b,
            workform=self.workform_b,
            workform_execution=self.exec_b_completed,
            sequence=0,
            event_type='action_success',
            status='success',
            node_id='a1',
            node_type='actionEmail',
            started_at=now - timedelta(seconds=6),
            completed_at=now - timedelta(seconds=4),
            duration_ms=2000,
        )

    def _get(self, path: str, tenant):
        request = self.factory.get(path)
        force_authenticate(request, user=self.user)
        request.tenant = tenant
        return request

    def test_analytics_action_is_tenant_scoped(self):
        request = self._get('/api/v1/workflows/workform-executions/analytics/?days=30&limit=5', self.tenant_a)
        response = TenantWorkFormExecutionViewSet.as_view({'get': 'analytics'})(request)
        self.assertEqual(response.status_code, 200)

        data = response.data
        self.assertEqual(data['summary']['total_runs'], 2)
        self.assertEqual(data['summary']['completed_runs'], 1)
        self.assertEqual(data['summary']['failed_runs'], 1)
        self.assertEqual(data['summary']['active_runs'], 0)
        self.assertEqual(data['summary']['success_rate'], 50.0)

        self.assertEqual(len(data['top_workforms']), 1)
        self.assertEqual(data['top_workforms'][0]['workform_name'], 'WF A')
        self.assertEqual(data['top_failed_nodes'][0]['node_id'], 'a2')
        self.assertEqual(data['top_failed_nodes'][0]['node_label'], 'Notify Buyer')
        self.assertEqual(data['slowest_actions'][0]['workform_name'], 'WF A')
        self.assertNotIn('WF B', {row['workform_name'] for row in data['top_workforms']})

    def test_analytics_action_fails_closed_without_tenant(self):
        request = self._get('/api/v1/workflows/workform-executions/analytics/', None)
        response = TenantWorkFormExecutionViewSet.as_view({'get': 'analytics'})(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['summary']['total_runs'], 0)
        self.assertEqual(response.data['top_failed_nodes'], [])
