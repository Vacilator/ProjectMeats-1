from django.test import override_settings
from rest_framework.test import APITestCase


class EmailIntegrationPublicEndpointsTests(APITestCase):
    """Public endpoints must remain reachable even when DRF defaults require auth."""

    EMAIL_PREFIX = '/api/v1/workflows/email/email'

    @override_settings(FRONTEND_URL='http://frontend.test')
    def test_outlook_oauth_callback_allows_anonymous(self):
        resp = self.client.get(f'{self.EMAIL_PREFIX}/outlook/auth/callback/?error=access_denied')
        self.assertEqual(resp.status_code, 302)

    @override_settings(FRONTEND_URL='http://frontend.test')
    def test_gmail_oauth_callback_allows_anonymous(self):
        resp = self.client.get(f'{self.EMAIL_PREFIX}/gmail/auth/callback/?error=access_denied')
        self.assertEqual(resp.status_code, 302)

    def test_outlook_webhook_validation_allows_anonymous(self):
        resp = self.client.post(f'{self.EMAIL_PREFIX}/outlook/webhook/notifications/?validationToken=abc', data={})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.content, b'abc')

    @override_settings(GMAIL_PUBSUB_VERIFICATION_TOKEN='test-token')
    def test_gmail_webhook_allows_anonymous(self):
        resp = self.client.post(
            f'{self.EMAIL_PREFIX}/gmail/webhook/notifications/?token=test-token',
            data={},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)
