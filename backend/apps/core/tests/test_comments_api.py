from __future__ import annotations

import uuid

from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from rest_framework import status
from rest_framework.test import APITestCase

from tenant_apps.customers.models import Customer
from tenant_apps.workflows.models import NotificationType, UserNotification

from apps.core.models import Comment
from apps.tenants.models import Tenant, TenantUser


class CommentsApiTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.user = User.objects.create_user(username=f"user-{unique}", password="pw")
        self.teammate = User.objects.create_user(
            username=f"teammate-{unique}",
            password="pw",
            first_name="Team",
            last_name="Mate",
        )
        self.other_user = User.objects.create_user(username=f"other-{unique}", password="pw")

        self.tenant = Tenant.objects.create(
            name=f"Tenant {unique}",
            slug=f"tenant-{unique}",
            contact_email=f"tenant-{unique}@example.com",
            created_by=self.user,
        )
        self.other_tenant = Tenant.objects.create(
            name=f"Other Tenant {unique}",
            slug=f"other-tenant-{unique}",
            contact_email=f"other-{unique}@example.com",
            created_by=self.other_user,
        )

        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="user", is_active=True)
        TenantUser.objects.create(tenant=self.tenant, user=self.teammate, role="user", is_active=True)
        TenantUser.objects.create(tenant=self.other_tenant, user=self.other_user, role="user", is_active=True)

        self.customer = Customer.objects.create(tenant=self.tenant, name=f"Customer {unique}")
        self.other_customer = Customer.objects.create(tenant=self.other_tenant, name=f"Other Customer {unique}")

        self.client.force_login(self.user)
        self.tenant_header = {"HTTP_X_TENANT_ID": str(self.tenant.id)}

    def test_create_comment_sets_generic_fk_and_creates_mention_notification(self):
        resp = self.client.post(
            "/api/v1/comments/",
            {
                "entity_type": "customer",
                "entity_id": str(self.customer.id),
                "body": "Please review this update @teammate",
                "mentioned_user_ids": [self.teammate.id],
            },
            format="json",
            **self.tenant_header,
        )

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        payload = resp.json()
        self.assertEqual(payload["entity_type"], "customer")
        self.assertEqual(payload["entity_id"], str(self.customer.id))
        self.assertEqual(payload["created_by"]["id"], self.user.id)
        self.assertEqual(len(payload["mentioned_users"]), 1)
        self.assertEqual(payload["mentioned_users"][0]["id"], self.teammate.id)

        comment = Comment.objects.get(pk=payload["id"])
        self.assertEqual(comment.tenant, self.tenant)
        self.assertEqual(comment.created_by, self.user)
        self.assertEqual(comment.object_id, str(self.customer.id))
        self.assertEqual(comment.entity_type, "customer")
        self.assertEqual(comment.content_type, ContentType.objects.get_for_model(Customer))
        self.assertEqual(comment.mentions, [self.teammate.id])

        notification = UserNotification.objects.get(user=self.teammate, notification_type=NotificationType.MENTION)
        self.assertEqual(notification.tenant, self.tenant)
        self.assertEqual(notification.metadata["comment_id"], comment.id)
        self.assertEqual(notification.action_url, f"/records/customer/{self.customer.id}")

    def test_comments_list_is_tenant_scoped_and_entity_filtered(self):
        own_comment = Comment.objects.create(
            tenant=self.tenant,
            content_type=ContentType.objects.get_for_model(Customer),
            object_id=str(self.customer.id),
            entity_type="customer",
            body="Visible comment",
            created_by=self.user,
        )
        Comment.objects.create(
            tenant=self.other_tenant,
            content_type=ContentType.objects.get_for_model(Customer),
            object_id=str(self.other_customer.id),
            entity_type="customer",
            body="Hidden comment",
            created_by=self.other_user,
        )

        resp = self.client.get(
            "/api/v1/comments/",
            {"entity_type": "customer", "entity_id": str(self.customer.id)},
            **self.tenant_header,
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        results = data.get("results", data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], own_comment.id)
        self.assertEqual(results[0]["body"], "Visible comment")

    def test_create_comment_rejects_cross_tenant_entity(self):
        resp = self.client.post(
            "/api/v1/comments/",
            {
                "entity_type": "customer",
                "entity_id": str(self.other_customer.id),
                "body": "This should fail",
            },
            format="json",
            **self.tenant_header,
        )

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("entity_id", resp.json())
