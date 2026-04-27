from __future__ import annotations

import uuid
from contextlib import contextmanager
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.tenants.invitation_email import schedule_invitation_email
from apps.tenants.models import Tenant, TenantInvitation


User = get_user_model()


class InvitationEmailTaskRlsTests(TestCase):
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

        self.invitation = TenantInvitation.objects.create(
            token='',
            tenant=self.tenant,
            email=f'invite-{unique}@example.com',
            role='user',
            invited_by=self.user,
        )

    def test_schedule_invitation_email_enqueues_with_tenant_id(self):
        # Force the on_commit callback to run inline for this unit test.
        with patch('apps.tenants.tasks.send_invitation_email_task.delay') as delay, patch(
            'django.db.transaction.on_commit', side_effect=lambda fn: fn()
        ):
            schedule_invitation_email(self.invitation)

        delay.assert_called_once_with(str(self.invitation.id), str(self.tenant.id))

    def test_task_scopes_lookup_with_tenant_rls(self):
        # Import inside test to ensure we patch the task module-level symbol.
        from apps.tenants.tasks import send_invitation_email_task

        @contextmanager
        def _fake_tenant_rls(tenant_id: str, *, strict: bool = True):
            yield None

        with patch('apps.tenants.tasks.tenant_rls', side_effect=_fake_tenant_rls) as rls, patch(
            'apps.tenants.tasks.send_mail'
        ) as send_mail:
            result = send_invitation_email_task.apply(args=[str(self.invitation.id), str(self.tenant.id)])

        self.assertEqual(result.get().get('success'), True)
        rls.assert_called_once()
        send_mail.assert_called_once()
