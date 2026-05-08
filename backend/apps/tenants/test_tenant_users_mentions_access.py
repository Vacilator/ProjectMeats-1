from __future__ import annotations

import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.tenants.models import Tenant, TenantUser


class TenantUsersMentionAccessTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.tenant = Tenant.objects.create(
            name=f"Tenant {unique}",
            slug=f"tenant-{unique}",
            contact_email=f"tenant-{unique}@example.com",
        )
        self.user = User.objects.create_user(username=f"user-{unique}", password="pw")
        self.teammate = User.objects.create_user(
            username=f"teammate-{unique}",
            password="pw",
            first_name="Team",
            last_name="Mate",
            email=f"teammate-{unique}@example.com",
        )

        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="user", is_active=True)
        TenantUser.objects.create(tenant=self.tenant, user=self.teammate, role="user", is_active=True)

        self.client = APIClient()
        self.client.force_login(self.user)
        self.tenant_header = {"HTTP_X_TENANT_ID": str(self.tenant.id)}

    def test_regular_tenant_members_can_list_active_tenant_users_for_mentions(self):
        resp = self.client.get("/api/v1/tenant-users/", {"search": "team"}, **self.tenant_header)

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        results = data.get("results", data)
        usernames = [row["username"] for row in results]
        self.assertIn(self.teammate.username, usernames)
