import base64
import hashlib
import json
from unittest.mock import patch

from django.test import override_settings
from rest_framework.test import APITestCase

from apps.email_integration.models import EmailAccount


class EmailWebhookVerificationTests(APITestCase):
    EMAIL_PREFIX = '/api/v1/workflows/email/email'

    def _sha256_hex(self, value: str) -> str:
        return hashlib.sha256(value.encode('utf-8')).hexdigest()

    @patch('apps.email_integration.views.webhook_views.process_outlook_notification')
    def test_outlook_notifications_valid_client_state_processes(self, process_outlook_notification):
        user = self._create_user('outlook-user@example.com')

        client_state = 'state-abc'
        account = EmailAccount.objects.create(
            user=user,
            provider='outlook',
            email_address='outlook-user@example.com',
            status='active',
            access_token='access',
            refresh_token='refresh',
            webhook_id='sub-123',
            webhook_client_state_hash=self._sha256_hex(client_state),
        )

        payload = {
            'value': [
                {
                    'subscriptionId': 'sub-123',
                    'clientState': client_state,
                    'resource': '/me/mailFolders/inbox/messages/xyz',
                    'changeType': 'created',
                }
            ]
        }

        resp = self.client.post(
            f'{self.EMAIL_PREFIX}/outlook/webhook/notifications/',
            data=payload,
            format='json',
            HTTP_AUTHORIZATION='Bearer segA.segB.segC',
        )

        self.assertEqual(resp.status_code, 202)
        process_outlook_notification.assert_called_once()
        kwargs = process_outlook_notification.call_args.kwargs
        self.assertEqual(kwargs['account_id'], account.id)
        self.assertEqual(kwargs['user_id'], user.id)

    @patch('apps.email_integration.views.webhook_views.process_outlook_notification')
    def test_outlook_notifications_invalid_client_state_is_ignored(self, process_outlook_notification):
        user = self._create_user('outlook-user2@example.com')

        EmailAccount.objects.create(
            user=user,
            provider='outlook',
            email_address='outlook-user2@example.com',
            status='active',
            access_token='access',
            refresh_token='refresh',
            webhook_id='sub-456',
            webhook_client_state_hash=self._sha256_hex('expected-state'),
        )

        payload = {
            'value': [
                {
                    'subscriptionId': 'sub-456',
                    'clientState': 'wrong-state',
                    'resource': '/me/mailFolders/inbox/messages/xyz',
                    'changeType': 'created',
                }
            ]
        }

        resp = self.client.post(
            f'{self.EMAIL_PREFIX}/outlook/webhook/notifications/',
            data=payload,
            format='json',
            HTTP_AUTHORIZATION='Bearer segA.segB.segC',
        )

        self.assertEqual(resp.status_code, 202)
        process_outlook_notification.assert_not_called()

    @override_settings(GMAIL_PUBSUB_VERIFICATION_TOKEN='test-token')
    @patch('apps.email_integration.views.webhook_views.process_gmail_notification')
    def test_gmail_notifications_valid_token_processes(self, process_gmail_notification):
        # Account existence isn't strictly required for handler reachability
        EmailAccount.objects.create(
            user=self._create_user('gmail-user@example.com'),
            provider='gmail',
            email_address='gmail-user@example.com',
            status='active',
            access_token='access',
            refresh_token='refresh',
        )

        inner = {'emailAddress': 'gmail-user@example.com', 'historyId': '123'}
        pubsub = {
            'message': {
                'data': base64.b64encode(json.dumps(inner).encode('utf-8')).decode('utf-8'),
            }
        }

        resp = self.client.post(
            f'{self.EMAIL_PREFIX}/gmail/webhook/notifications/?token=test-token',
            data=pubsub,
            format='json',
            HTTP_AUTHORIZATION='Bearer segA.segB.segC',
        )

        self.assertEqual(resp.status_code, 200)
        process_gmail_notification.assert_called_once_with(email_address='gmail-user@example.com', history_id='123')

    @override_settings(GMAIL_PUBSUB_VERIFICATION_TOKEN='expected')
    @patch('apps.email_integration.views.webhook_views.process_gmail_notification')
    def test_gmail_notifications_missing_token_is_ignored(self, process_gmail_notification):
        inner = {'emailAddress': 'gmail-user@example.com', 'historyId': '123'}
        pubsub = {
            'message': {
                'data': base64.b64encode(json.dumps(inner).encode('utf-8')).decode('utf-8'),
            }
        }

        resp = self.client.post(
            f'{self.EMAIL_PREFIX}/gmail/webhook/notifications/',
            data=pubsub,
            format='json',
        )

        self.assertEqual(resp.status_code, 200)
        process_gmail_notification.assert_not_called()

    @override_settings(GMAIL_PUBSUB_VERIFICATION_TOKEN='expected')
    def test_gmail_notifications_invalid_payload_still_400_when_verified(self):
        resp = self.client.post(
            f'{self.EMAIL_PREFIX}/gmail/webhook/notifications/?token=expected',
            data={},
            format='json',
        )

        self.assertEqual(resp.status_code, 400)

    def _create_user(self, email: str):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        return User.objects.create_user(username=email, email=email, password='pw')
