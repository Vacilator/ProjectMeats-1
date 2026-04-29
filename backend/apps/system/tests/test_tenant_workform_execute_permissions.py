from __future__ import annotations

import uuid
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import IdempotencyKey
from apps.core.services.idempotency import build_request_fingerprint, reserve_idempotency_key
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
            with self.captureOnCommitCallbacks(execute=True):
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

class TenantWorkFormExecuteIdempotencyTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.user = User.objects.create_user(username=f'idem-{unique}', password='pw')
        self.client.force_authenticate(self.user)

        self.tenant = Tenant.objects.create(
            name=f'Idempotency Tenant {unique}',
            slug=f'idempotency-tenant-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )
        TenantUser.objects.create(
            tenant=self.tenant,
            user=self.user,
            role='user',
            is_active=True,
        )
        self.other_user = User.objects.create_user(username=f'idem-other-{unique}', password='pw')
        TenantUser.objects.create(
            tenant=self.tenant,
            user=self.other_user,
            role='user',
            is_active=True,
        )

        other_unique = uuid.uuid4().hex[:8]
        self.other_tenant = Tenant.objects.create(
            name=f'Idempotency Other {other_unique}',
            slug=f'idempotency-other-{other_unique}',
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

    @patch('apps.system.tasks.execute_workform_execution.delay')
    def test_same_key_replays_original_execution_without_duplicate_enqueue(self, mock_delay):
        headers = {
            'HTTP_X_TENANT_ID': str(self.tenant.id),
            'HTTP_IDEMPOTENCY_KEY': 'workform-exec-1',
        }
        payload = {'initial_data': {'entity_type': 'customer', 'entity_id': '123'}}

        with self.captureOnCommitCallbacks(execute=True):
            first = self.client.post(
                f'/api/v1/tenant-workforms/{self.workform.id}/execute/',
                data=payload,
                format='json',
                **headers,
            )
        second = self.client.post(
            f'/api/v1/tenant-workforms/{self.workform.id}/execute/',
            data=payload,
            format='json',
            **headers,
        )

        self.assertEqual(first.status_code, status.HTTP_202_ACCEPTED, first.content)
        self.assertEqual(second.status_code, status.HTTP_202_ACCEPTED, second.content)
        self.assertEqual(first.json(), second.json())
        self.assertEqual(TenantWorkFormExecution.objects.count(), 1)
        self.assertEqual(IdempotencyKey.objects.filter(tenant=self.tenant, idempotency_key='workform-exec-1').count(), 1)
        mock_delay.assert_called_once()

    @patch('apps.system.tasks.execute_workform_execution.delay')
    def test_same_key_with_different_payload_returns_conflict(self, mock_delay):
        headers = {
            'HTTP_X_TENANT_ID': str(self.tenant.id),
            'HTTP_IDEMPOTENCY_KEY': 'workform-exec-2',
        }

        with self.captureOnCommitCallbacks(execute=True):
            first = self.client.post(
                f'/api/v1/tenant-workforms/{self.workform.id}/execute/',
                data={'initial_data': {'entity_id': '123'}},
                format='json',
                **headers,
            )
            second = self.client.post(
                f'/api/v1/tenant-workforms/{self.workform.id}/execute/',
                data={'initial_data': {'entity_id': '456'}},
                format='json',
                **headers,
            )

        self.assertEqual(first.status_code, status.HTTP_202_ACCEPTED, first.content)
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT, second.content)
        self.assertEqual(second.data['code'], 'IDEMPOTENCY_CONFLICT')
        self.assertEqual(TenantWorkFormExecution.objects.count(), 1)
        mock_delay.assert_called_once()

    @patch('apps.system.tasks.execute_workform_execution.delay')
    def test_same_key_isolated_per_tenant(self, mock_delay):
        headers_a = {
            'HTTP_X_TENANT_ID': str(self.tenant.id),
            'HTTP_IDEMPOTENCY_KEY': 'shared-key',
        }
        headers_b = {
            'HTTP_X_TENANT_ID': str(self.other_tenant.id),
            'HTTP_IDEMPOTENCY_KEY': 'shared-key',
        }
        payload = {'initial_data': {'entity_id': '123'}}

        with self.captureOnCommitCallbacks(execute=True):
            first = self.client.post(
                f'/api/v1/tenant-workforms/{self.workform.id}/execute/',
                data=payload,
                format='json',
                **headers_a,
            )
            second = self.client.post(
                f'/api/v1/tenant-workforms/{self.other_workform.id}/execute/',
                data=payload,
                format='json',
                **headers_b,
            )

        self.assertEqual(first.status_code, status.HTTP_202_ACCEPTED, first.content)
        self.assertEqual(second.status_code, status.HTTP_202_ACCEPTED, second.content)
        self.assertEqual(TenantWorkFormExecution.objects.count(), 2)
        self.assertEqual(IdempotencyKey.objects.filter(idempotency_key='shared-key').count(), 2)
        self.assertEqual(mock_delay.call_count, 2)

    @patch('apps.system.tasks.execute_workform_execution.delay')
    def test_same_key_from_different_user_in_same_tenant_returns_conflict(self, mock_delay):
        payload = {'initial_data': {'entity_id': '123'}}
        headers = {
            'HTTP_X_TENANT_ID': str(self.tenant.id),
            'HTTP_IDEMPOTENCY_KEY': 'shared-tenant-key',
        }

        with self.captureOnCommitCallbacks(execute=True):
            first = self.client.post(
                f'/api/v1/tenant-workforms/{self.workform.id}/execute/',
                data=payload,
                format='json',
                **headers,
            )

        self.client.force_authenticate(self.other_user)
        second = self.client.post(
            f'/api/v1/tenant-workforms/{self.workform.id}/execute/',
            data=payload,
            format='json',
            **headers,
        )

        self.assertEqual(first.status_code, status.HTTP_202_ACCEPTED, first.content)
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT, second.content)
        self.assertEqual(second.data['code'], 'IDEMPOTENCY_ACTOR_CONFLICT')
        self.assertEqual(TenantWorkFormExecution.objects.count(), 1)
        mock_delay.assert_called_once()

    @patch('apps.system.tasks.execute_workform_execution.delay', side_effect=RuntimeError('broker down'))
    def test_enqueue_failure_clears_cached_idempotency_response(self, mock_delay):
        headers = {
            'HTTP_X_TENANT_ID': str(self.tenant.id),
            'HTTP_IDEMPOTENCY_KEY': 'enqueue-failure-key',
        }

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                f'/api/v1/tenant-workforms/{self.workform.id}/execute/',
                data={'initial_data': {'entity_id': '123'}},
                format='json',
                **headers,
            )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED, response.content)
        execution = TenantWorkFormExecution.objects.get(id=response.json()['id'])
        execution.refresh_from_db()
        self.assertEqual(execution.status, 'failed')
        self.assertEqual(
            IdempotencyKey.objects.filter(tenant=self.tenant, idempotency_key='enqueue-failure-key').count(),
            0,
        )
        mock_delay.assert_called_once()

    def test_stale_processing_reservation_is_reclaimed_for_same_actor(self):
        payload = {'initial_data': {'entity_id': '123'}}
        fingerprint = build_request_fingerprint(
            method='POST',
            path=f'/api/v1/tenant-workforms/{self.workform.id}/execute/',
            payload=payload,
        )
        IdempotencyKey.objects.create(
            tenant=self.tenant,
            idempotency_key='stale-key',
            request_method='POST',
            request_path=f'/api/v1/tenant-workforms/{self.workform.id}/execute/',
            request_fingerprint=fingerprint,
            locked_until=timezone.now() - timedelta(minutes=11),
            custom_data={'actor_id': self.user.id},
        )
        result = reserve_idempotency_key(
            tenant=self.tenant,
            idempotency_key='stale-key',
            method='POST',
            path=f'/api/v1/tenant-workforms/{self.workform.id}/execute/',
            payload=payload,
            actor=self.user,
        )
        self.assertEqual(result.state, 'started')

    def test_stale_processing_reservation_conflicts_for_different_actor(self):
        payload = {'initial_data': {'entity_id': '123'}}
        path = f'/api/v1/tenant-workforms/{self.workform.id}/execute/'
        fingerprint = build_request_fingerprint(
            method='POST',
            path=path,
            payload=payload,
        )
        IdempotencyKey.objects.create(
            tenant=self.tenant,
            idempotency_key='stale-other-actor',
            request_method='POST',
            request_path=path,
            request_fingerprint=fingerprint,
            locked_until=timezone.now() - timedelta(minutes=11),
            custom_data={'actor_id': self.user.id},
        )

        result = reserve_idempotency_key(
            tenant=self.tenant,
            idempotency_key='stale-other-actor',
            method='POST',
            path=path,
            payload=payload,
            actor=self.other_user,
        )

        self.assertEqual(result.state, 'actor_conflict')
        self.assertEqual(result.response.status_code, status.HTTP_409_CONFLICT)
