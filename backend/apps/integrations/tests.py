from datetime import timedelta
from types import SimpleNamespace

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core import signing
from django.test import override_settings
from django.urls import resolve
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch

from apps.integrations import urls as app_integrations_urls
from integrations.views.oauth import OAuthAuthorizeView, OAuthCallbackView
from apps.integrations.models import EmailLog, ExternalAuthProvider
from apps.tenants.models import Tenant, TenantUser
from tenant_apps.ai_assistant.models import AIFeedbackLog


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

        # Use session auth so AuthenticationMiddleware marks request.user as authenticated
        # before TenantMiddleware runs.
        self.client.force_login(self.user)

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

    @patch('apps.integrations.signals.classify_ingested_email')
    def test_new_email_creates_action_required_feedback_log(self, classify_ingested_email):
        provider = ExternalAuthProvider.objects.get(tenant=self.tenant, provider_type='microsoft')
        classify_ingested_email.return_value = {
            'document_type': 'purchase_order',
            'draft_type': 'purchase_order',
            'order_number': 'PO-123',
            'confidence_score': 0.42,
            'actionable': False,
        }

        email = EmailLog.objects.create(
            tenant=self.tenant,
            provider=provider,
            message_id='message-1',
            subject='Purchase Order 123',
            sender_email='buyer@example.com',
            received_at=timezone.now(),
            body_text='Please book PO-123.',
        )

        email.refresh_from_db()
        self.assertEqual(email.status, 'action_required')
        self.assertEqual(email.extracted_data, classify_ingested_email.return_value)

        feedback = AIFeedbackLog.objects.get(tenant=self.tenant)
        self.assertEqual(feedback.document_type, 'purchase_order')
        self.assertAlmostEqual(feedback.confidence_score, 0.42)
        self.assertIsNone(feedback.resolved_by)
        self.assertEqual(feedback.original_extracted_data.get('order_number'), 'PO-123')

    def test_oauth_status_returns_active_connection(self):
        resp = self.client.get(
            '/api/v1/integrations/oauth/status/',
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get('count'), 1)
        self.assertEqual(resp.data.get('connections', [])[0].get('provider'), 'microsoft')

    def test_oauth_status_refreshes_expired_connection_before_reporting(self):
        provider = ExternalAuthProvider.objects.get(tenant=self.tenant, provider_type='microsoft')
        provider.token_expiry = timezone.now() - timedelta(minutes=1)
        provider.set_encrypted_token('access', 'stale-access')
        provider.set_encrypted_token('refresh', 'refresh-token')
        provider.save()

        def _refresh(provider_row):
            provider_row.token_expiry = timezone.now() + timedelta(hours=1)
            provider_row.set_encrypted_token('access', 'fresh-access')
            provider_row.save()
            return True

        with patch.object(ExternalAuthProvider, 'refresh_if_needed', autospec=True, side_effect=_refresh) as refresh_mock:
            resp = self.client.get(
                '/api/v1/integrations/oauth/status/',
                HTTP_X_TENANT_ID=str(self.tenant.id),
            )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data.get('connections', [])[0].get('is_expired'))
        refresh_mock.assert_called_once()

    def test_oauth_disconnect_marks_provider_inactive(self):
        resp = self.client.post(
            '/api/v1/integrations/oauth/disconnect/',
            {'provider': 'microsoft'},
            format='json',
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get('provider'), 'microsoft')

        provider = ExternalAuthProvider.objects.get(tenant=self.tenant, provider_type='microsoft')
        self.assertFalse(provider.is_active)


class IntegrationsOAuthRouteTests(APITestCase):
    def test_public_oauth_routes_resolve_to_canonical_views(self):
        authorize_match = resolve('/api/v1/integrations/oauth/authorize/')
        callback_match = resolve('/api/v1/integrations/oauth/callback/microsoft/')

        self.assertIs(authorize_match.func.view_class, OAuthAuthorizeView)
        self.assertIs(callback_match.func.view_class, OAuthCallbackView)

    def test_app_integrations_urlconf_legacy_oauth_aliases_point_to_canonical_views(self):
        oauth_patterns = {
            str(pattern.pattern): getattr(getattr(pattern, 'callback', None), 'view_class', None)
            for pattern in app_integrations_urls.urlpatterns
            if str(pattern.pattern).startswith('oauth/')
        }

        self.assertIs(oauth_patterns.get('oauth/authorize/'), OAuthAuthorizeView)
        self.assertIs(oauth_patterns.get('oauth/callback/<str:provider_type>/'), OAuthCallbackView)


class IntegrationsOAuthCallbackPublicTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_oauth_callback_allows_anonymous(self):
        resp = self.client.get('/api/v1/integrations/oauth/callback/microsoft/?error=access_denied')
        self.assertEqual(resp.status_code, 302)

    @override_settings(
        REST_FRAMEWORK={
            "DEFAULT_THROTTLE_CLASSES": [
                "rest_framework.throttling.AnonRateThrottle",
                "rest_framework.throttling.UserRateThrottle",
            ],
            "DEFAULT_THROTTLE_RATES": {
                "anon": "1/minute",
                "user": "1/minute",
            },
        }
    )
    def test_oauth_callback_is_exempt_from_global_throttles(self):
        first = self.client.get('/api/v1/integrations/oauth/callback/microsoft/?error=access_denied')
        second = self.client.get('/api/v1/integrations/oauth/callback/microsoft/?error=access_denied')

        self.assertEqual(first.status_code, 302)
        self.assertEqual(second.status_code, 302)


class IntegrationsOAuthSecurityTests(APITestCase):
    OAUTH_STATE_SALT = 'pm.integrations.oauth.state'

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='oauth-user', password='pass123')
        self.tenant = Tenant.objects.create(
            name='OAuth Tenant',
            slug='oauth-tenant',
            contact_email='oauth@example.com',
            created_by=self.user,
        )

    def test_oauth_authorize_requires_auth(self):
        resp = self.client.get('/api/v1/integrations/oauth/authorize/?provider=microsoft')
        self.assertIn(resp.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_oauth_callback_denies_when_user_not_in_tenant(self):
        state = signing.dumps(
            {
                'tenant_id': str(self.tenant.id),
                'user_id': str(self.user.id),
                'provider': 'microsoft',
                'nonce': 'n',
            },
            salt=self.OAUTH_STATE_SALT,
        )

        session = self.client.session
        session['oauth_state_microsoft'] = state
        session['oauth_tenant_microsoft'] = str(self.tenant.id)
        session['oauth_nonce_microsoft'] = 'n'
        session.save()

        with patch('integrations.views.oauth.MicrosoftGraphProvider') as mocked_provider:
            resp = self.client.get(
                f'/api/v1/integrations/oauth/callback/microsoft/?code=abc&state={state}'
            )

        self.assertEqual(resp.status_code, 302)
        self.assertIn('error=permission_denied', resp['Location'])
        self.assertFalse(
            ExternalAuthProvider.objects.filter(tenant=self.tenant, provider_type='microsoft').exists()
        )
        mocked_provider.assert_not_called()

    def test_oauth_callback_rejects_tenant_header_mismatch(self):
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner', is_active=True)

        state = signing.dumps(
            {
                'tenant_id': str(self.tenant.id),
                'user_id': str(self.user.id),
                'provider': 'microsoft',
                'nonce': 'n',
            },
            salt=self.OAUTH_STATE_SALT,
        )

        session = self.client.session
        session['oauth_state_microsoft'] = state
        session['oauth_tenant_microsoft'] = str(self.tenant.id)
        session['oauth_nonce_microsoft'] = 'n'
        session.save()

        with patch('integrations.views.oauth.MicrosoftGraphProvider') as mocked_provider:
            resp = self.client.get(
                f'/api/v1/integrations/oauth/callback/microsoft/?code=abc&state={state}',
                HTTP_X_TENANT_ID='00000000-0000-0000-0000-000000000000',
            )

        self.assertEqual(resp.status_code, 302)
        self.assertIn('error=tenant_mismatch', resp['Location'])
        mocked_provider.assert_not_called()

    def test_oauth_callback_rejects_replayed_state(self):
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner', is_active=True)


        state = signing.dumps(
            {
                'tenant_id': str(self.tenant.id),
                'user_id': str(self.user.id),
                'provider': 'microsoft',
                'nonce': 'n',
            },
            salt=self.OAUTH_STATE_SALT,
        )

        token_response = SimpleNamespace(access_token='access', refresh_token='refresh', expires_in=3600)
        user_info = {'email': 'connected@example.com', 'name': 'Connected User'}
        mocked_instance = SimpleNamespace(
            exchange_code=lambda code, redirect_uri: token_response,
            get_user_info=lambda access_token: user_info,
        )

        session = self.client.session
        session['oauth_state_microsoft'] = state
        session['oauth_tenant_microsoft'] = str(self.tenant.id)
        session['oauth_nonce_microsoft'] = 'n'
        session.save()

        with patch('integrations.views.oauth.MicrosoftGraphProvider', return_value=mocked_instance):
            resp1 = self.client.get(f'/api/v1/integrations/oauth/callback/microsoft/?code=abc&state={state}')

        self.assertEqual(resp1.status_code, 302)
        self.assertIn('success=connected', resp1['Location'])

        # Simulate a second attempt where an attacker replays the same state but the browser/session
        # still presents it (e.g., cookie re-send). Nonce consumption must fail closed.
        session = self.client.session
        session['oauth_state_microsoft'] = state
        session['oauth_tenant_microsoft'] = str(self.tenant.id)
        # Note: oauth_nonce_microsoft is intentionally NOT set. The nonce was already consumed
        # by the first callback and must fail closed on replay.
        session.save()

        with patch('integrations.views.oauth.MicrosoftGraphProvider') as mocked_provider:
            resp2 = self.client.get(f'/api/v1/integrations/oauth/callback/microsoft/?code=abc&state={state}')

        self.assertEqual(resp2.status_code, 302)
        self.assertIn('error=replayed_state', resp2['Location'])
        mocked_provider.assert_not_called()

    def test_oauth_callback_persists_tokens_for_member(self):
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner', is_active=True)

        state = signing.dumps(
            {
                'tenant_id': str(self.tenant.id),
                'user_id': str(self.user.id),
                'provider': 'microsoft',
                'nonce': 'n',
            },
            salt=self.OAUTH_STATE_SALT,
        )

        session = self.client.session
        session['oauth_state_microsoft'] = state
        session['oauth_tenant_microsoft'] = str(self.tenant.id)
        session['oauth_nonce_microsoft'] = 'n'
        session.save()

        token_response = SimpleNamespace(access_token='access', refresh_token='refresh', expires_in=3600)
        user_info = {'email': 'connected@example.com', 'name': 'Connected User'}

        mocked_instance = SimpleNamespace(
            exchange_code=lambda code, redirect_uri: token_response,
            get_user_info=lambda access_token: user_info,
        )

        with patch('integrations.views.oauth.MicrosoftGraphProvider', return_value=mocked_instance):
            resp = self.client.get(
                f'/api/v1/integrations/oauth/callback/microsoft/?code=abc&state={state}'
            )

        self.assertEqual(resp.status_code, 302)
        self.assertIn('success=connected', resp['Location'])

        provider = ExternalAuthProvider.objects.get(tenant=self.tenant, provider_type='microsoft')
        self.assertTrue(provider.is_active)
        self.assertEqual(provider.connected_email, 'connected@example.com')
