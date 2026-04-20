from __future__ import annotations

import uuid

from django.contrib.auth.models import User
from django.test import TestCase

from apps.system.models import TenantWorkForm
from apps.tenants.models import Tenant, TenantUser
from tenant_apps.workflows.models import NotificationType, TenantWorkFormExecution, UserNotification
from tenant_apps.workflows.services.action_executor import ActionExecutor


class ActionExecutorSendNotificationTests(TestCase):
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
            name='Notify WF',
            status='active',
            workflow_definition={
                'nodes': [
                    {'id': 't1', 'type': 'triggerManual', 'data': {'label': 'Manual Trigger'}},
                    {'id': 'n1', 'type': 'actionNotify', 'data': {'label': 'Notify', 'config': {'title': 'Hi', 'message': 'Msg'}}},
                ],
                'edges': [],
            },
            created_by=self.user,
            updated_by=self.user,
        )

        self.execution = TenantWorkFormExecution.objects.create(
            tenant=self.tenant,
            workform=self.workform,
            status='in_progress',
            initial_data={'entity_type': 'customer', 'entity_id': '1'},
            started_by=self.user,
        )

    def test_send_notification_falls_back_to_execution_actor_and_persists(self):
        executor = ActionExecutor(
            self.tenant,
            context={
                'execution_id': str(self.execution.id),
                'trigger': self.execution.initial_data,
                'variables': {},
            },
        )

        result = executor.execute(
            'send_notification',
            {
                'title': 'Hello',
                'message': 'World',
            },
        )

        self.assertTrue(result.get('success'), result)
        self.assertEqual(UserNotification.objects.filter(tenant=self.tenant, user=self.user).count(), 1)

        n = UserNotification.objects.filter(tenant=self.tenant, user=self.user).first()
        assert n is not None
        self.assertEqual(n.notification_type, NotificationType.WORKFLOW_TRIGGER)
        self.assertEqual(n.title, 'Hello')
        self.assertEqual(n.message, 'World')

    def test_send_notification_rejects_cross_tenant_recipient(self):
        other = User.objects.create_user(username=f'other-{uuid.uuid4().hex[:6]}', password='pw')

        executor = ActionExecutor(
            self.tenant,
            context={
                'execution_id': str(self.execution.id),
                'trigger': {},
                'variables': {},
            },
        )

        result = executor.execute(
            'send_notification',
            {
                'title': 'Hello',
                'message': 'World',
                'user_id': str(other.id),
            },
        )

        self.assertFalse(result.get('success'))
        self.assertIn('tenant', str(result.get('error', '')).lower())
        self.assertEqual(UserNotification.objects.filter(tenant=self.tenant, user=other).count(), 0)
