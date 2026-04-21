from __future__ import annotations

import hashlib
import hmac
import uuid
from types import SimpleNamespace
from unittest.mock import patch

from django.test import override_settings
from rest_framework.test import APITestCase

from apps.tenants.models import Tenant
from tenant_apps.workflows.models import TenantWorkflow


class WorkflowWebhookHmacAuthTests(APITestCase):
    API_PREFIX = '/api/v1'

    def _create_user(self, email: str):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        return User.objects.create_user(username=email, email=email, password='pw')

    @override_settings(FRONTEND_URL='http://frontend.test')
    @patch('tenant_apps.workflows.views_triggers.execute_workflow')
    def test_tenant_scoped_webhook_hmac_signature_valid_executes(self, execute_workflow):
        unique = uuid.uuid4().hex[:8]
        user = self._create_user(f'hmac-user-{unique}@example.com')

        tenant = Tenant.objects.create(
            name=f'Tenant {unique}',
            slug=f'tenant-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
            created_by=user,
        )

        webhook_token = 'tok_123'
        secret = 'sec_456'

        workflow = TenantWorkflow.objects.create(
            tenant=tenant,
            name='HMAC WF',
            status='active',
            trigger_type='webhook',
            trigger_config={
                'webhook_token': webhook_token,
                'webhook_auth': 'hmac',
                'webhook_secret': secret,
            },
        )

        body = b'{"hello":"world"}'
        signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

        execute_workflow.return_value = SimpleNamespace(id=uuid.uuid4(), status='success')

        url = f'{self.API_PREFIX}/tenants/{tenant.id}/workflows/webhooks/{workflow.id}/{webhook_token}/'
        resp = self.client.generic(
            'POST',
            url,
            data=body,
            content_type='application/json',
            HTTP_X_WEBHOOK_SIGNATURE=signature,
        )

        self.assertEqual(resp.status_code, 200, resp.content)
        execute_workflow.assert_called_once()

    @patch('tenant_apps.workflows.views_triggers.execute_workflow')
    def test_tenant_scoped_webhook_hmac_signature_invalid_returns_404(self, execute_workflow):
        unique = uuid.uuid4().hex[:8]
        user = self._create_user(f'hmac-user2-{unique}@example.com')

        tenant = Tenant.objects.create(
            name=f'Tenant {unique}',
            slug=f'tenant-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
            created_by=user,
        )

        webhook_token = 'tok_abc'
        secret = 'sec_def'

        workflow = TenantWorkflow.objects.create(
            tenant=tenant,
            name='HMAC WF',
            status='active',
            trigger_type='webhook',
            trigger_config={
                'webhook_token': webhook_token,
                'webhook_auth': 'hmac',
                'webhook_secret': secret,
            },
        )

        body = b'{"hello":"world"}'
        bad_signature = 'not-a-real-signature'

        url = f'{self.API_PREFIX}/tenants/{tenant.id}/workflows/webhooks/{workflow.id}/{webhook_token}/'
        resp = self.client.generic(
            'POST',
            url,
            data=body,
            content_type='application/json',
            HTTP_X_WEBHOOK_SIGNATURE=bad_signature,
        )

        self.assertEqual(resp.status_code, 404)
        execute_workflow.assert_not_called()
