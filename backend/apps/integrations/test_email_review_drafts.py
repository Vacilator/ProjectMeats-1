from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from unittest.mock import patch

from apps.integrations.models import EmailLog, EmailReviewDraft, ExternalAuthProvider
from apps.tenants.models import Tenant, TenantUser
from tenant_apps.workflows.models import UserNotification


class EmailReviewDraftSignalTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='draft-owner', password='pass123')
        self.tenant = Tenant.objects.create(
            name='Draft Tenant',
            slug='draft-tenant',
            contact_email='draft@example.com',
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='owner', is_active=True)
        self.provider = ExternalAuthProvider.objects.create(
            tenant=self.tenant,
            provider_type='microsoft',
            is_active=True,
            connected_email='ops@example.com',
            token_expiry=timezone.now(),
        )
        self.provider.set_encrypted_token('access', 'access-token')
        self.provider.set_encrypted_token('refresh', 'refresh-token')
        self.provider.save()

    @patch('apps.integrations.signals.classify_ingested_email')
    def test_actionable_email_creates_review_draft_and_notification(self, classify_ingested_email):
        classify_ingested_email.return_value = {
            'category': 'Purchase Order',
            'draft_type': 'purchase_order',
            'confidence': 0.91,
            'summary': 'Potential PO from accounting@nameats.com',
            'rationale': 'Contains PO terms and line-item request language.',
            'actionable': True,
        }

        email_log = EmailLog.objects.create(
            tenant=self.tenant,
            provider=self.provider,
            message_id='graph-message-1',
            thread_id='thread-1',
            subject='PO for ribeye delivery',
            sender_email='accounting@nameats.com',
            sender_name='Accounting',
            received_at=timezone.now(),
            body_text='Please confirm PO 12345 for ribeye delivery.',
            body_html='',
            has_attachments=True,
            attachment_count=1,
            status='logged',
        )

        email_log.refresh_from_db()
        draft = EmailReviewDraft.objects.get(email_log=email_log)
        notification = UserNotification.objects.get(tenant=self.tenant, user=self.user)

        self.assertEqual(email_log.status, 'draft_created')
        self.assertEqual(draft.draft_type, 'purchase_order')
        self.assertEqual(notification.entity_id, draft.id)
        self.assertIn(f'draft={draft.id}', notification.action_url)
