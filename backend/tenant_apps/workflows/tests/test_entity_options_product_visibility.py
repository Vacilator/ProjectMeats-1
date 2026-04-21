from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.db import connection
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.system.models import Product, TenantProductPreference
from apps.tenants.models import Tenant, TenantUser
from apps.tenants.rls import set_current_tenant
from tenant_apps.workflows.views import EntityOptionsAPIView, QuickCreateEntityAPIView


User = get_user_model()


class EntityOptionsProductVisibilityTests(TestCase):
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

        # Products are global (system.Product)
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
        self.custom_b = Product.objects.create(
            product_code=f"CUST-B-{unique}",
            name="Custom B",
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

        # Tenant B owns custom_b
        set_current_tenant(str(self.tenant_b.id))
        TenantProductPreference.objects.create(
            tenant=self.tenant_b,
            product=self.custom_b,
            is_active=True,
            is_custom=True,
            display_name="Tenant B Custom",
        )

    def tearDown(self):
        with connection.cursor() as cursor:
            cursor.execute("RESET app.current_tenant_id")
            cursor.execute("RESET app.current_tenant")

    def _get_options(self, *, tenant: Tenant, query: str = ""):
        set_current_tenant(str(tenant.id))
        request = self.factory.get(f"/api/v1/workflows/entity-options/product/?limit=500{query}")
        force_authenticate(request, user=self.user)
        request.tenant = tenant
        response = EntityOptionsAPIView.as_view()(request, entity_type="product")
        self.assertEqual(response.status_code, 200)
        return response.data

    def test_entity_options_product_respects_visibility_tenant_a(self):
        data = self._get_options(tenant=self.tenant_a)
        options = data["options"]
        values = {row["value"] for row in options}
        labels = {row["label"] for row in options}

        # Hidden system product must not be visible
        self.assertNotIn(str(self.system_product.id), values)

        # Tenant A custom product is visible to Tenant A
        self.assertIn(str(self.custom_a.id), values)
        self.assertIn("Tenant A Custom", " ".join(labels))

        # Tenant B custom product must not leak
        self.assertNotIn(str(self.custom_b.id), values)

        # Search should not resurrect hidden products
        searched = self._get_options(tenant=self.tenant_a, query="&q=System")
        searched_values = {row["value"] for row in searched["options"]}
        self.assertNotIn(str(self.system_product.id), searched_values)

        # Tenant members should not be able to quick-create global products
        self.assertFalse(data.get("can_create"))

    def test_entity_options_product_respects_visibility_tenant_b(self):
        data = self._get_options(tenant=self.tenant_b)
        values = {row["value"] for row in data["options"]}

        # System product is visible by default to tenant B (not hidden there)
        self.assertIn(str(self.system_product.id), values)

        # Tenant B custom product is visible to Tenant B
        self.assertIn(str(self.custom_b.id), values)

        # Tenant A custom product must not leak
        self.assertNotIn(str(self.custom_a.id), values)

    def test_quick_create_product_denies_tenant_user_even_with_django_perm(self):
        perm = Permission.objects.get(codename="add_product")
        self.user.user_permissions.add(perm)

        set_current_tenant(str(self.tenant_a.id))
        request = self.factory.post(
            "/api/v1/workflows/quick-create/product/",
            {"product_code": "X", "name": "Should not create"},
            format="json",
        )
        force_authenticate(request, user=self.user)
        request.tenant = self.tenant_a

        response = QuickCreateEntityAPIView.as_view()(request, entity_type="product")
        self.assertEqual(response.status_code, 403)
