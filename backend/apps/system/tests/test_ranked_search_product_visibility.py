from __future__ import annotations

import uuid

from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.system.models import Product, TenantProductPreference
from apps.system.views.search_viewset import RankedSearchViewSet
from apps.tenants.models import Tenant, TenantUser
from django.contrib.auth.models import User


class RankedSearchProductVisibilityTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.tenant = Tenant.objects.create(
            name=f"Tenant {unique}",
            slug=f"tenant-{unique}",
            contact_email=f"t-{unique}@example.com",
            is_active=True,
        )
        self.user = User.objects.create_user(username=f"u-{unique}", password='pw')
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='user', is_active=True)

        self.visible_product = Product.objects.create(
            product_code=f"V-{unique}",
            name="Visible Product",
            is_system=True,
            protein_type='beef',
            is_active=True,
        )
        self.inactive_product = Product.objects.create(
            product_code=f"I-{unique}",
            name="Inactive Product",
            is_system=True,
            protein_type='beef',
            is_active=False,
        )
        self.hidden_product = Product.objects.create(
            product_code=f"H-{unique}",
            name="Hidden Product",
            is_system=True,
            protein_type='beef',
            is_active=True,
        )
        TenantProductPreference.objects.create(
            tenant=self.tenant,
            product=self.hidden_product,
            is_active=False,
            is_custom=False,
        )

    def test_ranked_search_excludes_globally_inactive_and_tenant_hidden_products(self):
        factory = APIRequestFactory()
        request = factory.get('/api/v1/system/search/ranked/', {'q': 'Product', 'entity_types': 'product', 'limit': 50})
        force_authenticate(request, user=self.user)
        request.tenant = self.tenant

        response = RankedSearchViewSet.as_view({'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)

        results = response.data.get('results', [])
        found_ids = {str(r.get('id')) for r in results if r.get('type') == 'product'}

        self.assertIn(str(self.visible_product.id), found_ids)
        self.assertNotIn(str(self.inactive_product.id), found_ids)
        self.assertNotIn(str(self.hidden_product.id), found_ids)
