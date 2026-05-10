"""Test that tenant admins (is_staff=True) cannot bypass product visibility.

Regression: tenant admins are promoted to is_staff=True via signals. The product
ViewSet previously used ``is_staff`` to return the unscoped global catalog.  After
the fix, only ``is_superuser`` yields the global catalog; staff users get the same
tenant-scoped visibility as regular users.
"""

from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.db import connection
from rest_framework import status
from rest_framework.test import APITestCase

from apps.system.models import Product, TenantProductPreference
from apps.tenants.models import Tenant, TenantUser

User = get_user_model()


class ProductViewSetStaffBypassTests(APITestCase):
    """Ensure is_staff alone does not grant global product catalog access."""

    @classmethod
    def setUpTestData(cls):
        u = uuid.uuid4().hex[:8]

        cls.superuser = User.objects.create_superuser(
            username=f"super-{u}", password="pw"
        )
        cls.staff_user = User.objects.create_user(
            username=f"staff-{u}", password="pw", is_staff=True
        )
        cls.regular_user = User.objects.create_user(
            username=f"regular-{u}", password="pw"
        )

        cls.tenant = Tenant.objects.create(
            name=f"T-{u}",
            slug=f"t-{u}",
            contact_email=f"{u}@example.com",
            is_active=True,
            created_by=cls.superuser,
        )

        TenantUser.objects.create(
            tenant=cls.tenant, user=cls.staff_user, role="admin", is_active=True
        )
        TenantUser.objects.create(
            tenant=cls.tenant, user=cls.regular_user, role="user", is_active=True
        )

        with connection.cursor() as cur:
            cur.execute("SET app.current_tenant = %s", [str(cls.tenant.id)])

        cls.visible_product = Product.objects.create(
            product_code=f"VIS-{u}",
            name="Visible Product",
            is_system=True,
            is_active=True,
            protein_type="beef",
        )
        cls.hidden_product = Product.objects.create(
            product_code=f"HID-{u}",
            name="Hidden Product",
            is_system=True,
            is_active=True,
            protein_type="pork",
        )

        TenantProductPreference.objects.create(
            tenant=cls.tenant,
            product=cls.hidden_product,
            is_active=False,
            is_custom=False,
        )

        with connection.cursor() as cur:
            cur.execute("RESET app.current_tenant")

    def _get_products(self, user):
        self.client.force_authenticate(user)
        return self.client.get(
            "/api/v1/system/products/",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

    def test_superuser_sees_all_products(self):
        resp = self._get_products(self.superuser)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in resp.data["results"]}
        self.assertIn(str(self.visible_product.id), ids)
        self.assertIn(str(self.hidden_product.id), ids)

    def test_staff_user_does_not_see_hidden_products(self):
        """Staff users must get the same tenant-scoped view as regular users."""
        resp = self._get_products(self.staff_user)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in resp.data["results"]}
        self.assertIn(str(self.visible_product.id), ids)
        self.assertNotIn(
            str(self.hidden_product.id),
            ids,
            "Staff user should NOT see hidden products — is_staff must not bypass tenant visibility",
        )

    def test_regular_user_does_not_see_hidden_products(self):
        resp = self._get_products(self.regular_user)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in resp.data["results"]}
        self.assertIn(str(self.visible_product.id), ids)
        self.assertNotIn(str(self.hidden_product.id), ids)
