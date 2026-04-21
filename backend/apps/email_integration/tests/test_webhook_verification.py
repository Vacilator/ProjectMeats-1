import base64
import hashlib
import json
import uuid
from unittest.mock import patch

from django.test import override_settings
from rest_framework.test import APITestCase

from apps.email_integration.models import EmailAccount
from apps.tenants.models import Tenant


class EmailWebhookVerificationTests(APITestCase):
    API_PREFIX = '/api/v1'

    def _sha256_hex(self, value: str) -> str:
        return hashlib.sha256(value.encode('utf-8')).hexdigest()

    @patch('apps.email_integration.views.webhook_views.process_outlook_notification')
    def test_outlook_notifications_valid_client_state_processes(self, process_outlook_notification):
        unique = uuid.uuid4().hex[:8]
        user = self._create_user(f'outlook-user-{unique}@example.com')
        tenant = Tenant.objects.create(
            name=f'Tenant {unique}',
            slug=f'tenant-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
            created_by=user,
        )

        client_state = 'state-abc'
        account = EmailAccount.objects.create(
            tenant=tenant,
            user=user,
            provider='outlook',
            email_address=user.email,
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
            f'{self.API_PREFIX}/tenants/{tenant.id}/workflows/email/outlook/webhook/notifications/',
            data=payload,
            format='json',
            HTTP_AUTHORIZATION='Bearer segA.segB.segC',
        )

        self.assertEqual(resp.status_code, 202)
        process_outlook_notification.assert_called_once()
        kwargs = process_outlook_notification.call_args.kwargs
        self.assertEqual(kwargs['email_account'].id, account.id)

    @patch('apps.email_integration.views.webhook_views.process_outlook_notification')
    def test_outlook_notifications_invalid_client_state_is_ignored(self, process_outlook_notification):
        unique = uuid.uuid4().hex[:8]
        user = self._create_user(f'outlook-user2-{unique}@example.com')
        tenant = Tenant.objects.create(
            name=f'Tenant {unique}',
            slug=f'tenant-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
            created_by=user,
        )

        EmailAccount.objects.create(
            tenant=tenant,
            user=user,
            provider='outlook',
            email_address=user.email,
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
            f'{self.API_PREFIX}/tenants/{tenant.id}/workflows/email/outlook/webhook/notifications/',
            data=payload,
            format='json',
            HTTP_AUTHORIZATION='Bearer segA.segB.segC',
        )

        self.assertEqual(resp.status_code, 202)
        process_outlook_notification.assert_not_called()

    @override_settings(GMAIL_PUBSUB_VERIFICATION_TOKEN='test-token')
    @patch('apps.email_integration.views.webhook_views.process_gmail_notification')
    def test_gmail_notifications_valid_token_processes(self, process_gmail_notification):
        unique = uuid.uuid4().hex[:8]
        user = self._create_user(f'gmail-user-{unique}@example.com')
        tenant = Tenant.objects.create(
            name=f'Tenant {unique}',
            slug=f'tenant-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
            created_by=user,
        )

        EmailAccount.objects.create(
            tenant=tenant,
            user=user,
            provider='gmail',
            email_address=user.email,
            status='active',
            access_token='access',
            refresh_token='refresh',
        )

        inner = {'emailAddress': user.email, 'historyId': '123'}
        pubsub = {
            'message': {
                'data': base64.b64encode(json.dumps(inner).encode('utf-8')).decode('utf-8'),
            }
        }

        resp = self.client.post(
            f'{self.API_PREFIX}/tenants/{tenant.id}/workflows/email/gmail/webhook/notifications/?token=test-token',
            data=pubsub,
            format='json',
            HTTP_AUTHORIZATION='Bearer segA.segB.segC',
        )

        self.assertEqual(resp.status_code, 200)
        process_gmail_notification.assert_called_once_with(
            email_address=user.email,
            history_id='123',
            tenant=tenant,
        )

    @override_settings(GMAIL_PUBSUB_VERIFICATION_TOKEN='expected')
    @patch('apps.email_integration.views.webhook_views.process_gmail_notification')
    def test_gmail_notifications_missing_token_is_ignored(self, process_gmail_notification):
        unique = uuid.uuid4().hex[:8]
        user = self._create_user(f'gmail-user2-{unique}@example.com')
        tenant = Tenant.objects.create(
            name=f'Tenant {unique}',
            slug=f'tenant-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
            created_by=user,
        )

        inner = {'emailAddress': user.email, 'historyId': '123'}
        pubsub = {
            'message': {
                'data': base64.b64encode(json.dumps(inner).encode('utf-8')).decode('utf-8'),
            }
        }

        resp = self.client.post(
            f'{self.API_PREFIX}/tenants/{tenant.id}/workflows/email/gmail/webhook/notifications/',
            data=pubsub,
            format='json',
        )

        self.assertEqual(resp.status_code, 200)
        process_gmail_notification.assert_not_called()

    @override_settings(GMAIL_PUBSUB_VERIFICATION_TOKEN='expected')
    def test_gmail_notifications_invalid_payload_still_400_when_verified(self):
        unique = uuid.uuid4().hex[:8]
        user = self._create_user(f'gmail-user3-{unique}@example.com')
        tenant = Tenant.objects.create(
            name=f'Tenant {unique}',
            slug=f'tenant-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
            created_by=user,
        )

        resp = self.client.post(
            f'{self.API_PREFIX}/tenants/{tenant.id}/workflows/email/gmail/webhook/notifications/?token=expected',
            data={},
            format='json',
        )

        self.assertEqual(resp.status_code, 400)

    def _create_user(self, email: str):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        return User.objects.create_user(username=email, email=email, password='pw')
