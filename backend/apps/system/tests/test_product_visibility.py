"""Tests for three-tier product visibility rules.

These tests ensure system products remain visible by default while allowing
per-tenant hide/override behavior and tenant-owned custom products.

Three-tier strategy:
- system.Product(is_system=True): visible unless hidden by TenantProductPreference(is_active=False)
- system.Product(is_system=False): visible only when tenant has an active preference row with is_custom=True
"""

from __future__ import annotations

import uuid

from django.db import connection
from django.test import TestCase

from apps.tenants.models import Tenant
from apps.system.models import Product, TenantProductPreference
from apps.system.services.product_visibility import visible_products_qs


class ProductVisibilityTestCase(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.tenant_a = Tenant.objects.create(
            name=f"Tenant A {unique}",
            slug=f"tenant-a-{unique}",
            contact_email=f"a-{unique}@example.com",
            is_active=True,
        )
        self.tenant_b = Tenant.objects.create(
            name=f"Tenant B {unique}",
            slug=f"tenant-b-{unique}",
            contact_email=f"b-{unique}@example.com",
            is_active=True,
        )

        self._set_db_tenant(self.tenant_a)

        self.system_product = Product.objects.create(
            product_code=f"SYS-{unique}",
            name="System Product",
            is_system=True,
            protein_type="beef",
        )

        self.custom_product = Product.objects.create(
            product_code=f"CUST-{unique}",
            name="Custom Product",
            is_system=False,
            protein_type="beef",
        )

        TenantProductPreference.objects.create(
            tenant=self.tenant_a,
            product=self.custom_product,
            is_active=True,
            is_custom=True,
            display_name="Tenant A Custom",
        )

    def tearDown(self):
        self._reset_db_tenant()

    def _set_db_tenant(self, tenant: Tenant) -> None:
        with connection.cursor() as cursor:
            cursor.execute("SET app.current_tenant_id = %s", [str(tenant.id)])
            cursor.execute("SET app.current_tenant = %s", [str(tenant.id)])

    def _reset_db_tenant(self) -> None:
        with connection.cursor() as cursor:
            cursor.execute("RESET app.current_tenant_id")
            cursor.execute("RESET app.current_tenant")

    def test_system_products_visible_by_default(self):
        ids = set(visible_products_qs(tenant=self.tenant_a).values_list("id", flat=True))
        self.assertIn(self.system_product.id, ids)

    def test_hidden_system_product_excluded(self):
        TenantProductPreference.objects.create(
            tenant=self.tenant_a,
            product=self.system_product,
            is_active=False,
            is_custom=False,
        )

        ids = set(visible_products_qs(tenant=self.tenant_a).values_list("id", flat=True))
        self.assertNotIn(self.system_product.id, ids)

    def test_custom_product_visible_only_to_owner_tenant(self):
        ids_a = set(visible_products_qs(tenant=self.tenant_a).values_list("id", flat=True))
        ids_b = set(visible_products_qs(tenant=self.tenant_b).values_list("id", flat=True))

        self.assertIn(self.custom_product.id, ids_a)
        self.assertNotIn(self.custom_product.id, ids_b)

    def test_no_tenant_context_returns_only_system(self):
        ids = set(visible_products_qs(tenant=None).values_list("id", flat=True))
        self.assertIn(self.system_product.id, ids)
        self.assertNotIn(self.custom_product.id, ids)
