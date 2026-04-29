"""Fast smoke coverage for always-on API bootstrap endpoints.

These tests intentionally keep assertions shallow so they remain stable while still
catching regressions in the core operator/bootstrap path:
- POST /api/v1/auth/login/
- POST /api/v1/auth/token/
- POST /api/v1/auth/guest-login/
"""

from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from apps.tenants.models import Tenant, TenantUser


User = get_user_model()


class ApiBootstrapSmokeTests(APITestCase):
    def setUp(self):
        cache.clear()
        unique = uuid.uuid4().hex[:8]

        self.password = "SmokePass123!"
        self.user = User.objects.create_user(
            username=f"smoke-user-{unique}",
            email=f"smoke-{unique}@example.com",
            password=self.password,
        )
        self.tenant = Tenant.objects.create(
            name=f"Smoke Tenant {unique}",
            slug=f"smoke-tenant-{unique}",
            contact_email=f"tenant-{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )
        TenantUser.objects.create(
            tenant=self.tenant,
            user=self.user,
            role="admin",
            is_active=True,
        )

        User.objects.filter(username="guest").delete()
        self.guest_user = User.objects.create_user(
            username="guest",
            email=f"guest-{unique}@example.com",
            password=self.password,
        )
        self.guest_tenant = Tenant.objects.create(
            name=f"Guest Tenant {unique}",
            slug=f"guest-tenant-{unique}",
            contact_email=f"guest-tenant-{unique}@example.com",
            is_active=True,
            created_by=self.guest_user,
        )
        TenantUser.objects.create(
            tenant=self.guest_tenant,
            user=self.guest_user,
            role="admin",
            is_active=True,
        )

    def tearDown(self):
        cache.clear()

    def test_legacy_login_bootstrap_returns_token_and_tenants(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {
                "username": self.user.username,
                "password": self.password,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        self.assertIn("token", response.data)
        self.assertIn("user", response.data)
        self.assertIn("tenants", response.data)
        self.assertEqual(response.data["user"]["username"], self.user.username)
        self.assertEqual(len(response.data["tenants"]), 1)
        self.assertEqual(response.data["tenants"][0]["tenant__slug"], self.tenant.slug)

    def test_jwt_token_bootstrap_returns_access_refresh_and_user(self):
        response = self.client.post(
            "/api/v1/auth/token/",
            {
                "username": self.user.username,
                "password": self.password,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["username"], self.user.username)

    def test_legacy_login_bootstrap_rejects_missing_credentials_with_error_shape(self):
        response = self.client.post("/api/v1/auth/login/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.content)
        self.assertIn("error", response.data)

    def test_legacy_login_bootstrap_rejects_invalid_credentials_with_error_shape(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {
                "username": self.user.username,
                "password": "definitely-wrong",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED, response.content)
        self.assertIn("error", response.data)

    def test_jwt_token_bootstrap_rejects_invalid_credentials_with_detail_shape(self):
        response = self.client.post(
            "/api/v1/auth/token/",
            {
                "username": self.user.username,
                "password": "definitely-wrong",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED, response.content)
        self.assertIn("detail", response.data)

    def test_guest_login_bootstrap_returns_token_and_guest_tenant(self):
        response = self.client.post("/api/v1/auth/guest-login/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        self.assertIn("token", response.data)
        self.assertIn("user", response.data)
        self.assertIn("tenant", response.data)
        self.assertEqual(response.data["user"]["username"], "guest")
        self.assertEqual(response.data["tenant"]["slug"], self.guest_tenant.slug)
        self.assertIs(response.data["tenant"]["is_guest"], True)
