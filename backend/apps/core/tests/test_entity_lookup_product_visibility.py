from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.core import entity_views
from apps.system.models import Product, TenantProductPreference
from apps.tenants.models import Tenant, TenantUser
from apps.tenants.rls import set_current_tenant

User = get_user_model()


class EntityLookupProductVisibilityTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        unique = uuid.uuid4().hex[:8]

        self.user = User.objects.create_user(username=f"u-{unique}", password="pw")

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

        TenantUser.objects.create(tenant=self.tenant_a, user=self.user, role="admin", is_active=True)
        TenantUser.objects.create(tenant=self.tenant_b, user=self.user, role="admin", is_active=True)

        self.system_product = Product.objects.create(
            product_code=f"SYS-{unique}",
            name="System Product",
            is_system=True,
            protein_type="",
        )
        self.custom_a = Product.objects.create(
            product_code=f"CUST-A-{unique}",
            name="Custom A",
            is_system=False,
            protein_type="",
        )

        # Tenant A owns custom_a, and hides system_product
        set_current_tenant(str(self.tenant_a.id))
        TenantProductPreference.objects.create(
            tenant=self.tenant_a,
            product=self.custom_a,
            is_active=True,
            is_custom=True,
            display_name="Tenant A Custom",
        )
        TenantProductPreference.objects.create(
            tenant=self.tenant_a,
            product=self.system_product,
            is_active=False,
            is_custom=False,
        )

    def tearDown(self):
        with connection.cursor() as cursor:
            cursor.execute("RESET app.current_tenant_id")
            cursor.execute("RESET app.current_tenant")

    def test_entity_lookup_product_respects_visibility(self):
        set_current_tenant(str(self.tenant_a.id))
        request = self.factory.get("/api/v1/entities/product/lookup/?page=1&page_size=200")
        force_authenticate(request, user=self.user)
        request.tenant = self.tenant_a

        response = entity_views.entity_lookup(request, entity_type="product")
        self.assertEqual(response.status_code, 200)

        values = {row["value"] for row in response.data.get("options", [])}

        # Hidden system product must not be visible
        self.assertNotIn(str(self.system_product.id), values)

        # Tenant custom product is visible
        self.assertIn(str(self.custom_a.id), values)
