from __future__ import annotations

import uuid

from django.contrib.auth.models import User
from django.test import TestCase

from apps.tenants.models import Tenant, TenantUser
from tenant_apps.workflows.models import NotificationType, UserNotification
from tenant_apps.workflows.serializers import UserNotificationSerializer


class UserNotificationSerializerTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f'notify-{unique}',
            email=f'notify-{unique}@example.com',
            password='pw',
        )
        self.tenant = Tenant.objects.create(
            name=f'Notification Tenant {unique}',
            slug=f'notification-tenant-{unique}',
            contact_email=f'notify-{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='admin', is_active=True)

    def test_ai_review_notifications_route_to_operational_queue(self):
        feedback_id = uuid.uuid4()
        notification = UserNotification.objects.create(
            tenant=self.tenant,
            user=self.user,
            notification_type=NotificationType.WORKFLOW_TRIGGER,
            title='Potential Purchase Order received',
            message='Review Draft now',
            action_url='/settings/email-integrations',
            metadata={
                'document_type': 'purchase_order',
                'feedback_id': str(feedback_id),
            },
        )

        payload = UserNotificationSerializer(notification).data

        self.assertEqual(payload['action_url'], f'/my-tasks?tab=ai-review&draft={feedback_id}')
