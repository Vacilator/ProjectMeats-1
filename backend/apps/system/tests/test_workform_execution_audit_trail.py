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
from tenant_apps.workflows.models import TenantWorkFormExecution, TenantWorkFormExecutionStatus


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

    def test_execute_task_persists_audit_trail(self):
        execution = TenantWorkFormExecution.objects.create(
            tenant=self.tenant,
            workform=self.workform,
            status=TenantWorkFormExecutionStatus.IN_PROGRESS,
            initial_data={'entity_type': 'customer', 'entity_id': '123'},
            started_by=self.user,
            started_at=timezone.now(),
        )

        with patch('apps.tenants.rls.set_current_tenant', return_value=SimpleNamespace(ok=True, error=None)):
            execute_workform_execution(execution_id=str(execution.id), tenant_id=str(self.tenant.id))

        execution.refresh_from_db()
        self.assertEqual(execution.status, TenantWorkFormExecutionStatus.COMPLETED)
        self.assertIsInstance(execution.audit_trail, list)
        self.assertGreaterEqual(len(execution.audit_trail), 2)

        events = [row.get('event') for row in execution.audit_trail if isinstance(row, dict)]
        self.assertIn('execution_start', events)
        self.assertIn('execution_complete', events)
