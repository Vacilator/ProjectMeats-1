from __future__ import annotations

import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.system.views.search_viewset import RankedSearchViewSet
from apps.tenants.models import Tenant, TenantUser
from tenant_apps.customers.models import Customer
from tenant_apps.suppliers.models import Supplier


class RankedSearchTenantScopingTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.user = User.objects.create_user(username=f'u-{unique}', password='pw')

        self.tenant_a = Tenant.objects.create(
            name=f'Tenant A {unique}',
            slug=f'tenant-a-{unique}',
            contact_email=f'a-{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )
        self.tenant_b = Tenant.objects.create(
            name=f'Tenant B {unique}',
            slug=f'tenant-b-{unique}',
            contact_email=f'b-{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )

        # User belongs to both tenants; API must still be scoped by request.tenant.
        TenantUser.objects.create(tenant=self.tenant_a, user=self.user, role='admin', is_active=True)
        TenantUser.objects.create(tenant=self.tenant_b, user=self.user, role='admin', is_active=True)

        Customer.objects.create(tenant=self.tenant_a, name='Scoped Customer A ONLY')
        Customer.objects.create(tenant=self.tenant_b, name='Scoped Customer B ONLY')

        Supplier.objects.create(tenant=self.tenant_a, name='Scoped Supplier A ONLY')
        Supplier.objects.create(tenant=self.tenant_b, name='Scoped Supplier B ONLY')

    def _call(self, tenant):
        factory = APIRequestFactory()
        request = factory.get(
            '/api/v1/system/search/ranked/',
            {
                'q': 'Scoped',
                'entity_types': 'customer,supplier',
                'limit': 50,
            },
        )
        force_authenticate(request, user=self.user)
        request.tenant = tenant
        response = RankedSearchViewSet.as_view({'get': 'list'})(request)
        return response

    def test_ranked_search_is_scoped_to_request_tenant(self):
        resp = self._call(self.tenant_a)
        self.assertEqual(resp.status_code, 200)

        joined = str(resp.data)
        self.assertIn('Customer A ONLY', joined)
        self.assertIn('Supplier A ONLY', joined)
        self.assertNotIn('Customer B ONLY', joined)
        self.assertNotIn('Supplier B ONLY', joined)

    def test_ranked_search_fails_closed_without_tenant(self):
        resp = self._call(None)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data.get('total'), 0)
        self.assertEqual(resp.data.get('results'), [])
