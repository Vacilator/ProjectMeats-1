from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.tenants.models import Tenant, TenantUser
from apps.email_integration.models import EmailAccount
from apps.email_integration.views.oauth_views import _sign_oauth_state


class EmailOAuthSecurityTests(APITestCase):
    EMAIL_PREFIX = '/api/v1/workflows/email/email'

    def setUp(self):
        self.user = User.objects.create_user(username='email-oauth', password='pass123')
        self.tenant_a = Tenant.objects.create(
            name='Tenant A',
            slug='tenant-a',
            contact_email='a@example.com',
            created_by=self.user,
        )
        self.tenant_b = Tenant.objects.create(
            name='Tenant B',
            slug='tenant-b',
            contact_email='b@example.com',
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant_a, user=self.user, role='owner', is_active=True)

    def test_outlook_auth_init_requires_auth(self):
        resp = self.client.get(f'{self.EMAIL_PREFIX}/outlook/auth/init/')
        self.assertIn(resp.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_gmail_auth_init_requires_auth(self):
        resp = self.client.get(f'{self.EMAIL_PREFIX}/gmail/auth/init/')
        self.assertIn(resp.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    @override_settings(FRONTEND_URL='http://frontend.test')
    def test_outlook_callback_rejects_without_expected_state(self):
        state = _sign_oauth_state(
            {
                'user_id': self.user.id,
                'tenant_id': str(self.tenant_a.id),
                'provider': 'outlook',
                'nonce': 'n',
            }
        )

        resp = self.client.get(f'{self.EMAIL_PREFIX}/outlook/auth/callback/?code=abc&state={state}')
        self.assertEqual(resp.status_code, 302)
        self.assertIn('oauth_error=invalid_state', resp['Location'])
        self.assertEqual(EmailAccount.objects.count(), 0)

    @override_settings(FRONTEND_URL='http://frontend.test')
    def test_gmail_callback_rejects_tenant_mismatch(self):
        state = _sign_oauth_state(
            {
                'user_id': self.user.id,
                'tenant_id': str(self.tenant_b.id),
                'provider': 'gmail',
                'nonce': 'n',
            }
        )

        session = self.client.session
        session['oauth_state_gmail'] = state
        session['oauth_tenant_gmail'] = str(self.tenant_b.id)
        session['oauth_nonce_gmail'] = 'n'
        session.save()

        resp = self.client.get(f'{self.EMAIL_PREFIX}/gmail/auth/callback/?code=abc&state={state}')
        self.assertEqual(resp.status_code, 302)
        self.assertIn('oauth_error=tenant_denied', resp['Location'])
        self.assertEqual(EmailAccount.objects.count(), 0)
