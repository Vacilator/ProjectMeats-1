from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch

from apps.tenants.models import Tenant, TenantUser
from apps.integrations.models import ExternalAuthProvider


class EmailSyncTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        self.tenant = Tenant.objects.create(
            name='Test Tenant',
            slug='test-tenant',
            contact_email='test@example.com',
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner')

        ExternalAuthProvider.objects.create(
            tenant=self.tenant,
            provider_type='microsoft',
            is_active=True,
            connected_email='test@tenant.com',
            token_expiry=timezone.now() + timedelta(days=1),
        )

        self.client.force_authenticate(user=self.user)

    @patch('tenant_apps.integrations.services.email_ingestion.EmailIngestionService.poll_tenant_by_id')
    def test_sync_emails_soft_fails_on_exception(self, poll_tenant_by_id):
        poll_tenant_by_id.side_effect = RuntimeError('boom')

        resp = self.client.post(
            '/api/v1/integrations/email/sync/',
            {},
            format='json',
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get('ok'), False)
        self.assertEqual(resp.data.get('code'), 'sync_exception')

        # Must not leak raw exception strings to callers (security + UX stability)
        self.assertNotIn('boom', resp.data.get('error', ''))
        self.assertEqual(resp.data.get('details', {}).get('type'), 'RuntimeError')

    def test_sync_emails_returns_not_connected_payload(self):
        ExternalAuthProvider.objects.filter(tenant=self.tenant, provider_type='microsoft').update(is_active=False)

        resp = self.client.post(
            '/api/v1/integrations/email/sync/',
            {},
            format='json',
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data.get('code'), 'not_connected')
        self.assertEqual(resp.data.get('error_code'), 'not_connected')
        self.assertIn('hint', resp.data)
        self.assertEqual(resp.data.get('cta', {}).get('url'), '/settings/email-integrations')

    @patch('tenant_apps.integrations.services.email_ingestion.EmailIngestionService.poll_tenant_by_id')
    def test_sync_emails_soft_fails_when_graph_returns_zero_scanned_with_errors(self, poll_tenant_by_id):
        poll_tenant_by_id.return_value = {
            'errors': 1,
            'emails_scanned': 0,
            'errors_detail': ['Token invalid/expired'],
            'emails_matched': 0,
            'emails_fetched': 0,
            'emails_saved': 0,
            'emails_skipped': 0,
        }

        resp = self.client.post(
            '/api/v1/integrations/email/sync/',
            {},
            format='json',
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get('ok'), False)
        self.assertEqual(resp.data.get('code'), 'sync_failed')
        self.assertEqual(resp.data.get('error'), 'Token invalid/expired')
        self.assertEqual(resp.data.get('error_code'), 'token_invalid')
        self.assertEqual(resp.data.get('cta', {}).get('url'), '/settings/email-integrations')


class IntegrationsOAuthCallbackPublicTests(APITestCase):
    def test_oauth_callback_allows_anonymous(self):
        resp = self.client.get('/api/v1/integrations/oauth/callback/microsoft/?error=access_denied')
        self.assertEqual(resp.status_code, 302)
