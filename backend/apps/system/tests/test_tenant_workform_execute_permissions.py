from __future__ import annotations

import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.system.models import TenantWorkForm
from apps.tenants.models import Tenant, TenantUser
from tenant_apps.workflows.models import TenantWorkFormExecution


User = get_user_model()


class TenantWorkFormExecutePermissionsTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.user = User.objects.create_user(username=f'u-{unique}', password='pw')
        self.client.force_authenticate(self.user)

        self.tenant = Tenant.objects.create(
            name=f'Tenant {unique}',
            slug=f'tenant-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )

        self.tenant_user = TenantUser.objects.create(
            tenant=self.tenant,
            user=self.user,
            role='user',
            is_active=True,
        )

        other_unique = uuid.uuid4().hex[:8]
        self.other_tenant = Tenant.objects.create(
            name=f'Tenant Other {other_unique}',
            slug=f'tenant-other-{other_unique}',
            contact_email=f'{other_unique}@example.com',
            is_active=True,
            created_by=self.user,
        )

        TenantUser.objects.create(
            tenant=self.other_tenant,
            user=self.user,
            role='user',
            is_active=True,
        )

        self.workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name='WF',
            description='',
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

        self.other_workform = TenantWorkForm.objects.create(
            tenant=self.other_tenant,
            name='Other WF',
            description='',
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

    def test_active_tenant_member_can_execute_workform(self):
        with patch('apps.system.tasks.execute_workform_execution.delay') as mock_delay:
            resp = self.client.post(
                f'/api/v1/tenant-workforms/{self.workform.id}/execute/',
                data={'initial_data': {'entity_type': 'customer', 'entity_id': '123'}},
                format='json',
                HTTP_X_TENANT_ID=str(self.tenant.id),
            )

        self.assertEqual(resp.status_code, status.HTTP_202_ACCEPTED, resp.content)

        execution = TenantWorkFormExecution.objects.get(id=resp.json().get('id'))
        self.assertEqual(execution.tenant_id, self.tenant.id)
        self.assertEqual(execution.workform_id, self.workform.id)
        self.assertEqual(execution.started_by_id, self.user.id)

        mock_delay.assert_called_once()

    def test_inactive_tenant_member_cannot_execute_workform(self):
        self.tenant_user.is_active = False
        self.tenant_user.save(update_fields=['is_active'])

        with patch('apps.system.tasks.execute_workform_execution.delay') as mock_delay:
            resp = self.client.post(
                f'/api/v1/tenant-workforms/{self.workform.id}/execute/',
                data={'initial_data': {}},
                format='json',
                HTTP_X_TENANT_ID=str(self.tenant.id),
            )

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN, resp.content)
        self.assertEqual(TenantWorkFormExecution.objects.count(), 0)
        mock_delay.assert_not_called()

    def test_cannot_execute_workform_from_other_tenant(self):
        with patch('apps.system.tasks.execute_workform_execution.delay') as mock_delay:
            resp = self.client.post(
                f'/api/v1/tenant-workforms/{self.other_workform.id}/execute/',
                data={'initial_data': {}},
                format='json',
                HTTP_X_TENANT_ID=str(self.tenant.id),
            )

        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND, resp.content)
        self.assertEqual(TenantWorkFormExecution.objects.count(), 0)
        mock_delay.assert_not_called()
