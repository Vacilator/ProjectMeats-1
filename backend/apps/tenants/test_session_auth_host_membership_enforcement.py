from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.tenants.models import Tenant, TenantDomain, TenantUser
from tenant_apps.suppliers.models import Supplier


User = get_user_model()


@override_settings(ALLOWED_HOSTS=["*"])
class SessionAuthHostTenantMembershipEnforcementTests(APITestCase):
    """End-to-end regression tests for session-auth + host-resolved tenants.

    Why these tests exist:
    - RequestFactory/APIRequestFactory + force_authenticate can bypass the real middleware/auth stack.
    - We specifically want to ensure the Django middleware chain runs and denies cross-tenant access
      when a user is authenticated via *session* auth and the tenant is resolved via Host.
    """

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

        self.domain_a = TenantDomain.objects.create(
            tenant=self.tenant_a,
            domain=f"{self.tenant_a.slug}.example.com",
            is_primary=True,
        )
        self.domain_b = TenantDomain.objects.create(
            tenant=self.tenant_b,
            domain=f"{self.tenant_b.slug}.example.com",
            is_primary=True,
        )

        # Membership ONLY in tenant A.
        TenantUser.objects.create(tenant=self.tenant_a, user=self.user, role="admin", is_active=True)

        Supplier.objects.create(tenant=self.tenant_a, name="A ONLY SUPPLIER")
        Supplier.objects.create(tenant=self.tenant_b, name="B ONLY SUPPLIER")

        # Use session auth (not JWT / not force_authenticate).
        self.client.force_login(self.user)

    def test_session_user_cannot_access_other_tenant_by_changing_host_domain(self):
        resp = self.client.get("/api/v1/suppliers/", HTTP_HOST=self.domain_b.domain)

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN, resp.content)
        self.assertEqual(resp["Content-Type"], "application/json")
        self.assertEqual(
            resp.json(),
            {"error": "You do not have access to this tenant.", "code": "TENANT_ACCESS_DENIED"},
        )

    def test_session_user_can_access_own_tenant_by_host_domain(self):
        resp = self.client.get("/api/v1/suppliers/", HTTP_HOST=self.domain_a.domain)

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)
        joined = str(resp.json())
        self.assertIn("A ONLY SUPPLIER", joined)
        self.assertNotIn("B ONLY SUPPLIER", joined)

    def test_session_user_cannot_access_other_tenant_by_changing_host_subdomain_resolution(self):
        # Remove TenantDomain mapping so resolution falls back to slug-based subdomain logic.
        TenantDomain.objects.all().delete()

        resp = self.client.get("/api/v1/suppliers/", HTTP_HOST=f"{self.tenant_b.slug}.example.com")

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN, resp.content)
        self.assertEqual(resp["Content-Type"], "application/json")
        self.assertEqual(
            resp.json(),
            {"error": "You do not have access to this tenant.", "code": "TENANT_ACCESS_DENIED"},
        )
