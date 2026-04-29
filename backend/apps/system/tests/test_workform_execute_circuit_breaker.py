from __future__ import annotations

import uuid
from datetime import timedelta
from unittest.mock import ANY, patch

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.system.models import TenantWorkForm
from apps.system.services import workform_circuit_breaker as breaker
from apps.tenants.models import Tenant, TenantUser


class WorkformCircuitBreakerServiceTests(TestCase):
    @patch('apps.system.services.workform_circuit_breaker.cache')
    def test_record_failure_sets_ttl_backed_cache_keys(self, mock_cache):
        tenant_id = str(uuid.uuid4())
        workform_id = str(uuid.uuid4())
        errors_key = breaker._errors_key(tenant_id=tenant_id, workform_id=workform_id)
        open_key = breaker._open_until_key(tenant_id=tenant_id, workform_id=workform_id)
        trial_key = breaker._half_open_trial_key(tenant_id=tenant_id, workform_id=workform_id)

        mock_cache.get.return_value = breaker.FAILURE_THRESHOLD - 1

        state = breaker.record_workform_execution_failure(tenant_id=tenant_id, workform_id=workform_id)

        self.assertEqual(state.state, 'OPEN')
        mock_cache.set.assert_any_call(errors_key, breaker.FAILURE_THRESHOLD, breaker.FAILURE_COUNT_TTL_SECONDS)
        mock_cache.set.assert_any_call(open_key, ANY, breaker.COOLDOWN_SECONDS)
        mock_cache.delete.assert_any_call(trial_key)

    def test_get_state_transitions_to_half_open_after_cooldown(self):
        tenant_id = str(uuid.uuid4())
        workform_id = str(uuid.uuid4())
        breaker.clear_workform_circuit_breaker(tenant_id=tenant_id, workform_id=workform_id)
        self.addCleanup(
            breaker.clear_workform_circuit_breaker,
            tenant_id=tenant_id,
            workform_id=workform_id,
        )

        breaker.record_workform_execution_failure(tenant_id=tenant_id, workform_id=workform_id)
        breaker.record_workform_execution_failure(tenant_id=tenant_id, workform_id=workform_id)
        breaker.record_workform_execution_failure(tenant_id=tenant_id, workform_id=workform_id)

        breaker.cache.set(
            breaker._open_until_key(tenant_id=tenant_id, workform_id=workform_id),
            (timezone.now() - timedelta(seconds=1)).isoformat(),
            breaker.COOLDOWN_SECONDS,
        )

        state = breaker.get_workform_circuit_state(tenant_id=tenant_id, workform_id=workform_id)

        self.assertEqual(state.state, 'HALF_OPEN')

    def test_concurrent_requests_after_cooldown_do_not_restart_full_wait(self):
        tenant_id = str(uuid.uuid4())
        workform_id = str(uuid.uuid4())
        breaker.clear_workform_circuit_breaker(tenant_id=tenant_id, workform_id=workform_id)
        self.addCleanup(
            breaker.clear_workform_circuit_breaker,
            tenant_id=tenant_id,
            workform_id=workform_id,
        )

        breaker.record_workform_execution_failure(tenant_id=tenant_id, workform_id=workform_id)
        breaker.record_workform_execution_failure(tenant_id=tenant_id, workform_id=workform_id)
        breaker.record_workform_execution_failure(tenant_id=tenant_id, workform_id=workform_id)
        breaker.cache.set(
            breaker._open_until_key(tenant_id=tenant_id, workform_id=workform_id),
            (timezone.now() - timedelta(seconds=1)).isoformat(),
            breaker.COOLDOWN_SECONDS,
        )

        first = breaker.get_workform_circuit_state(tenant_id=tenant_id, workform_id=workform_id)
        second = breaker.get_workform_circuit_state(tenant_id=tenant_id, workform_id=workform_id)

        self.assertEqual(first.state, 'HALF_OPEN')
        self.assertEqual(second.state, 'OPEN')
        self.assertEqual(second.retry_after, 0)

    def test_record_success_clears_open_circuit(self):
        tenant_id = str(uuid.uuid4())
        workform_id = str(uuid.uuid4())
        breaker.clear_workform_circuit_breaker(tenant_id=tenant_id, workform_id=workform_id)
        self.addCleanup(
            breaker.clear_workform_circuit_breaker,
            tenant_id=tenant_id,
            workform_id=workform_id,
        )

        breaker.record_workform_execution_failure(tenant_id=tenant_id, workform_id=workform_id)
        breaker.record_workform_execution_failure(tenant_id=tenant_id, workform_id=workform_id)
        breaker.record_workform_execution_failure(tenant_id=tenant_id, workform_id=workform_id)
        breaker.record_workform_execution_success(tenant_id=tenant_id, workform_id=workform_id)

        state = breaker.get_workform_circuit_state(tenant_id=tenant_id, workform_id=workform_id)

        self.assertEqual(state.state, 'CLOSED')
        self.assertEqual(state.failure_count, 0)
        self.assertGreater(breaker.HALF_OPEN_TRIAL_TTL_SECONDS, breaker.COOLDOWN_SECONDS)


class TenantWorkFormExecuteCircuitBreakerTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.user = TenantUser._meta.get_field('user').remote_field.model.objects.create_user(
            username=f'breaker-{unique}',
            password='pw',
        )
        self.client.force_authenticate(self.user)

        self.tenant = Tenant.objects.create(
            name=f'Breaker Tenant {unique}',
            slug=f'breaker-tenant-{unique}',
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
        self.workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name='Breaker WF',
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
        breaker.clear_workform_circuit_breaker(
            tenant_id=str(self.tenant.id),
            workform_id=str(self.workform.id),
        )
        self.addCleanup(
            breaker.clear_workform_circuit_breaker,
            tenant_id=str(self.tenant.id),
            workform_id=str(self.workform.id),
        )

    @patch('apps.system.tasks.execute_workform_execution.delay')
    def test_execute_returns_503_when_circuit_is_open(self, mock_delay):
        breaker.record_workform_execution_failure(
            tenant_id=str(self.tenant.id),
            workform_id=str(self.workform.id),
        )
        breaker.record_workform_execution_failure(
            tenant_id=str(self.tenant.id),
            workform_id=str(self.workform.id),
        )
        breaker.record_workform_execution_failure(
            tenant_id=str(self.tenant.id),
            workform_id=str(self.workform.id),
        )

        response = self.client.post(
            f'/api/v1/tenant-workforms/{self.workform.id}/execute/',
            data={'initial_data': {}},
            format='json',
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE, response.content)
        self.assertEqual(response.data['code'], 'CIRCUIT_BREAKER')
        self.assertEqual(response.data['circuit_state'], 'OPEN')
        self.assertGreaterEqual(int(response.data['retry_after']), 1)
        mock_delay.assert_not_called()
