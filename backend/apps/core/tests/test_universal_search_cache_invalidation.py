from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.tenants.models import Tenant, TenantDomain, TenantUser
from tenant_apps.suppliers.models import Supplier


User = get_user_model()


@override_settings(ALLOWED_HOSTS=['*'])
class UniversalSearchCacheInvalidationTests(APITestCase):
    def setUp(self):
        cache.clear()
        unique = uuid.uuid4().hex[:8]

        self.user = User.objects.create_user(username=f'user-{unique}', password='pw')
        self.client.force_authenticate(self.user)

        self.tenant = Tenant.objects.create(
            name=f'Tenant {unique}',
            slug=f'tenant-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )
        self.domain = TenantDomain.objects.create(
            tenant=self.tenant,
            domain=f'{self.tenant.slug}.example.com',
            is_primary=True,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='admin', is_active=True)

        self.headers = {
            'HTTP_X_TENANT_ID': str(self.tenant.id),
            'HTTP_HOST': self.domain.domain,
        }

        self.supplier = Supplier.objects.create(tenant=self.tenant, name='Acme Proteins')

    def tearDown(self):
        cache.clear()

    def test_universal_search_refreshes_titles_after_supplier_update(self):
        first = self.client.get('/api/v1/search/universal/', {'q': 'Acme'}, **self.headers)
        self.assertEqual(first.status_code, status.HTTP_200_OK, first.content)
        first_titles = [item['title'] for item in first.json()['results']]
        self.assertIn('Acme Proteins', first_titles)

        self.supplier.name = 'Acme Prime Proteins'
        self.supplier.save(update_fields=['name'])

        second = self.client.get('/api/v1/search/universal/', {'q': 'Acme'}, **self.headers)
        self.assertEqual(second.status_code, status.HTTP_200_OK, second.content)
        second_titles = [item['title'] for item in second.json()['results']]
        self.assertIn('Acme Prime Proteins', second_titles)
