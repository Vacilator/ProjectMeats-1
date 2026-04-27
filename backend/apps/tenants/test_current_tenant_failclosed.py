"""Fail-closed tenant resolution regression tests.

These tests enforce the "no assumptions" rule for tenant-specific endpoints:
- If a user belongs to multiple tenants, tenant selection must be explicit.

Endpoints under test (apps.tenants.views.TenantViewSet actions):
- GET /api/v1/tenants/current/
- GET /api/v1/tenants/current_theme/
- GET /api/v1/tenants/admin_permissions/
"""

from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.tenants.models import Tenant, TenantUser


User = get_user_model()


class TenantAmbiguityFailClosedTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.user = User.objects.create_user(username=f"u-{unique}", password="pw")

        self.tenant_a = Tenant.objects.create(
            name=f"Tenant A {unique}",
            slug=f"tenant-a-{unique}",
            contact_email=f"a-{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )
        self.tenant_b = Tenant.objects.create(
            name=f"Tenant B {unique}",
            slug=f"tenant-b-{unique}",
            contact_email=f"b-{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )

        TenantUser.objects.create(tenant=self.tenant_a, user=self.user, role="admin", is_active=True)
        TenantUser.objects.create(tenant=self.tenant_b, user=self.user, role="admin", is_active=True)

        # Session auth so TenantMiddleware can safely honor X-Tenant-ID.
        self.client.force_login(self.user)

    def test_current_requires_explicit_tenant_when_multi_membership(self):
        resp = self.client.get("/api/v1/tenants/current/")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data.get("code"), "tenant_required_multi")

        resp = self.client.get("/api/v1/tenants/current/", HTTP_X_TENANT_ID=str(self.tenant_a.id))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("slug"), self.tenant_a.slug)

    def test_current_theme_requires_explicit_tenant_when_multi_membership(self):
        resp = self.client.get("/api/v1/tenants/current_theme/")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data.get("code"), "tenant_required_multi")

        resp = self.client.get(
            "/api/v1/tenants/current_theme/",
            HTTP_X_TENANT_ID=str(self.tenant_b.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_admin_permissions_requires_explicit_tenant_when_multi_membership(self):
        resp = self.client.get("/api/v1/tenants/admin_permissions/")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data.get("code"), "tenant_required_multi")

        resp = self.client.get(
            "/api/v1/tenants/admin_permissions/",
            HTTP_X_TENANT_ID=str(self.tenant_a.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("role"), "admin")


class TenantSingleMembershipDefaultsTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.user = User.objects.create_user(username=f"u1-{unique}", password="pw")
        self.tenant = Tenant.objects.create(
            name=f"Tenant {unique}",
            slug=f"tenant-{unique}",
            contact_email=f"t-{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="admin", is_active=True)
        self.client.force_login(self.user)

    def test_current_allows_safe_default_when_single_membership(self):
        resp = self.client.get("/api/v1/tenants/current/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("slug"), self.tenant.slug)

    def test_current_theme_allows_safe_default_when_single_membership(self):
        resp = self.client.get("/api/v1/tenants/current_theme/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_admin_permissions_allows_safe_default_when_single_membership(self):
        resp = self.client.get("/api/v1/tenants/admin_permissions/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get("role"), "admin")
