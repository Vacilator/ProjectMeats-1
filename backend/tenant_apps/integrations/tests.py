from __future__ import annotations

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase

from apps.tenants.models import Tenant

from .models import TenantAPIKey, TenantWebhook, TenantWebhookEventType, generate_api_key
from .tasks import dispatch_webhook_payload


class TenantIntegrationsModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u1', password='pw')
        self.tenant = Tenant.objects.create(
            name='T1',
            slug='t1',
            contact_email='t1@example.com',
            created_by=self.user,
        )

    def test_api_key_verify_round_trip(self):
        full_key, prefix, secret_hash = generate_api_key()
        obj = TenantAPIKey.objects.create(
            tenant=self.tenant,
            name='Key 1',
            key_prefix=prefix,
            key_hash=secret_hash,
            created_by=self.user,
        )
        self.assertTrue(obj.verify(full_key))
        self.assertFalse(obj.verify(prefix))

    def test_webhook_rotate_secret(self):
        wh = TenantWebhook.objects.create(
            tenant=self.tenant,
            created_by=self.user,
            target_url='https://example.com/webhook',
            event_type=TenantWebhookEventType.PURCHASE_ORDER_CREATED,
            is_active=True,
            signing_secret='old',
        )
        new_secret = wh.rotate_secret()
        self.assertNotEqual(new_secret, 'old')
        wh.refresh_from_db()
        self.assertEqual(wh.signing_secret, new_secret)


class TenantIntegrationsTaskTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u1', password='pw')
        self.tenant = Tenant.objects.create(
            name='T1',
            slug='t1',
            contact_email='t1@example.com',
            created_by=self.user,
        )

    @patch('tenant_apps.integrations.tasks.requests.post')
    def test_dispatch_webhook_payload_signs_when_secret_present(self, mock_post):
        mock_post.return_value.status_code = 200
        mock_post.return_value.text = 'ok'

        wh = TenantWebhook.objects.create(
            tenant=self.tenant,
            created_by=self.user,
            target_url='https://example.com/webhook',
            event_type=TenantWebhookEventType.PURCHASE_ORDER_CREATED,
            is_active=True,
            signing_secret='secret',
        )

        payload = {'hello': 'world'}
        result = dispatch_webhook_payload.run(
            webhook_id=wh.id,
            tenant_id=str(self.tenant.id),
            event_type=wh.event_type,
            payload=payload,
        )
        self.assertTrue(result['success'])

        _, kwargs = mock_post.call_args
        headers = kwargs['headers']
        self.assertIn('X-PM-Signature', headers)
        self.assertEqual(headers['X-PM-Event'], wh.event_type)
