from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.tenants.models import Tenant, TenantInvitation


User = get_user_model()


class SuperuserInvitationApiTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.superuser = User.objects.create_superuser(
            username=f"super-{unique}",
            email=f"super-{unique}@example.com",
            password="pw",
        )
        self.tenant_a = Tenant.objects.create(
            name=f"Tenant A {unique}",
            slug=f"tenant-a-{unique}",
            contact_email=f"a-{unique}@example.com",
            is_active=True,
            created_by=self.superuser,
        )
        self.tenant_b = Tenant.objects.create(
            name=f"Tenant B {unique}",
            slug=f"tenant-b-{unique}",
            contact_email=f"b-{unique}@example.com",
            is_active=True,
            created_by=self.superuser,
        )

        self.client.force_login(self.superuser)

    def test_superuser_can_create_invitation_for_selected_tenant(self):
        response = self.client.post(
            "/api/v1/invitations/",
            {
                "email": "invitee@example.com",
                "role": "user",
                "message": "Welcome aboard",
            },
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant_a.id),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        invitation = TenantInvitation.objects.get(email="invitee@example.com")
        self.assertEqual(invitation.tenant, self.tenant_a)
        self.assertEqual(invitation.invited_by, self.superuser)

    def test_superuser_invitation_list_scopes_to_selected_tenant(self):
        invitation_a = TenantInvitation.objects.create(
            tenant=self.tenant_a,
            invited_by=self.superuser,
            email="tenant-a@example.com",
            role="user",
        )
        TenantInvitation.objects.create(
            tenant=self.tenant_b,
            invited_by=self.superuser,
            email="tenant-b@example.com",
            role="user",
        )

        response = self.client.get(
            "/api/v1/invitations/",
            HTTP_X_TENANT_ID=str(self.tenant_a.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data.get("results", response.data) if hasattr(response.data, "get") else response.data
        self.assertEqual(len(payload), 1)
        self.assertEqual(str(payload[0]["id"]), str(invitation_a.id))
