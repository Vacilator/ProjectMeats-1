from __future__ import annotations

import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.system.models import Product, TenantProductPreference
from apps.system.views.product_viewset import TenantProductPreferenceViewSet
from apps.tenants.models import Tenant, TenantUser


class TenantProductPreferenceUpsertPermissionTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.tenant = Tenant.objects.create(
            name=f"Tenant {unique}",
            slug=f"tenant-{unique}",
            contact_email=f"t-{unique}@example.com",
            is_active=True,
        )
        self.admin_user = User.objects.create_user(username=f"admin-{unique}", password="pw")
        self.regular_user = User.objects.create_user(username=f"user-{unique}", password="pw")
        TenantUser.objects.create(tenant=self.tenant, user=self.admin_user, role="admin", is_active=True)
        TenantUser.objects.create(tenant=self.tenant, user=self.regular_user, role="user", is_active=True)

        self.product = Product.objects.create(
            product_code=f"P-{unique}",
            name="Product",
            is_system=True,
            protein_type="beef",
            is_active=True,
        )

    def test_regular_user_cannot_create_preference(self):
        factory = APIRequestFactory()
        request = factory.post(
            "/api/v1/system/product-preferences/", {"product": str(self.product.id), "is_active": False}, format="json"
        )
        force_authenticate(request, user=self.regular_user)
        request.tenant = self.tenant

        response = TenantProductPreferenceViewSet.as_view({"post": "create"})(request)
        self.assertEqual(response.status_code, 403)

    def test_admin_user_can_upsert_preference(self):
        factory = APIRequestFactory()

        request1 = factory.post(
            "/api/v1/system/product-preferences/", {"product": str(self.product.id), "is_active": False}, format="json"
        )
        force_authenticate(request1, user=self.admin_user)
        request1.tenant = self.tenant
        response1 = TenantProductPreferenceViewSet.as_view({"post": "create"})(request1)
        self.assertIn(response1.status_code, (200, 201))

        self.assertTrue(TenantProductPreference.objects.filter(tenant=self.tenant, product=self.product).exists())

        request2 = factory.post(
            "/api/v1/system/product-preferences/", {"product": str(self.product.id), "is_active": True}, format="json"
        )
        force_authenticate(request2, user=self.admin_user)
        request2.tenant = self.tenant
        response2 = TenantProductPreferenceViewSet.as_view({"post": "create"})(request2)
        self.assertEqual(response2.status_code, 200)

        pref = TenantProductPreference.objects.get(tenant=self.tenant, product=self.product)
        self.assertTrue(pref.is_active)
