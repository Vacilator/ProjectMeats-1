from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import signing
from django.test import TestCase
from rest_framework.test import APIClient

from apps.tenants.models import TenantUser
from integrations.views import oauth as oauth_views


class OAuthCallbackRlsContextTests(TestCase):
    def setUp(self):
        unique = signing.dumps({'n': 1})[-8:]
        self.client = APIClient()

        User = get_user_model()
        self.user = User.objects.create_user(username=f'u-{unique}', password='pw')

        self.tenant = oauth_views.Tenant.objects.create(
            name=f'Tenant {unique}',
            slug=f'tenant-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )

        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='admin', is_active=True)

    @patch('integrations.views.oauth.set_current_tenant')
    @patch('integrations.views.oauth.ExternalAuthProvider.objects.update_or_create')
    @patch('integrations.views.oauth.get_microsoft_redirect_uri')
    @patch('integrations.views.oauth.MicrosoftGraphProvider')
    def test_callback_sets_rls_before_update_or_create(
        self,
        MicrosoftGraphProvider,
        get_microsoft_redirect_uri,
        update_or_create,
        set_current_tenant,
    ):
        provider = 'microsoft'
        nonce = 'nonce123'

        state = signing.dumps(
            {
                'tenant_id': str(self.tenant.id),
                'user_id': str(self.user.id),
                'provider': provider,
                'nonce': nonce,
            },
            salt=oauth_views._STATE_SALT,
        )

        # Session setup to satisfy callback validation.
        session = self.client.session
        session[f'oauth_state_{provider}'] = state
        session[f'oauth_tenant_{provider}'] = str(self.tenant.id)
        session[f'oauth_nonce_{provider}'] = nonce
        session.save()

        get_microsoft_redirect_uri.return_value = 'https://example.com/callback'

        # Fake provider client
        provider_client = MicrosoftGraphProvider.return_value
        provider_client.exchange_code.return_value = SimpleNamespace(
            access_token='access',
            refresh_token='refresh',
            expires_in=3600,
        )
        provider_client.get_user_info.return_value = {'email': 'x@example.com', 'name': 'X'}

        # Ensure set_current_tenant is invoked and order is enforced.
        set_current_tenant.return_value = SimpleNamespace(ok=True)

        call_order: list[str] = []

        def update_or_create_side_effect(*args, **kwargs):
            call_order.append('update_or_create')
            assert set_current_tenant.called, 'set_current_tenant must be called before DB writes'

            class DummyAuthProvider:
                def set_encrypted_token(self, *_a, **_k):
                    return None

                def save(self, *_a, **_k):
                    return None

            return DummyAuthProvider(), True

        update_or_create.side_effect = update_or_create_side_effect

        url = f'/api/v1/integrations/oauth/callback/{provider}/'
        resp = self.client.get(url, {'code': 'abc', 'state': state})

        self.assertIn(resp.status_code, (301, 302))
        set_current_tenant.assert_called_with(str(self.tenant.id))
        self.assertIn('update_or_create', call_order)

    @patch('integrations.views.oauth.set_current_tenant')
    @patch('integrations.views.oauth.ExternalAuthProvider.objects.update_or_create')
    def test_callback_redirects_to_error_when_rls_cannot_be_set(
        self,
        update_or_create,
        set_current_tenant,
    ):
        provider = 'microsoft'
        nonce = 'nonce123'

        state = signing.dumps(
            {
                'tenant_id': str(self.tenant.id),
                'user_id': str(self.user.id),
                'provider': provider,
                'nonce': nonce,
            },
            salt=oauth_views._STATE_SALT,
        )

        session = self.client.session
        session[f'oauth_state_{provider}'] = state
        session[f'oauth_tenant_{provider}'] = str(self.tenant.id)
        session[f'oauth_nonce_{provider}'] = nonce
        session.save()

        set_current_tenant.return_value = SimpleNamespace(ok=False, error='db down')

        url = f'/api/v1/integrations/oauth/callback/{provider}/'
        resp = self.client.get(url, {'code': 'abc', 'state': state})

        self.assertIn(resp.status_code, (301, 302))
        self.assertIn('error=rls_enforcement_failed', resp.url)
        set_current_tenant.assert_called_with(str(self.tenant.id))
        update_or_create.assert_not_called()
