from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.system.models import Product, SystemChoiceItem, SystemChoiceList, TenantConfig
from apps.tenants.models import Tenant, TenantDomain, TenantUser


User = get_user_model()


@override_settings(ALLOWED_HOSTS=['*'])
class CachedSystemEndpointsTests(APITestCase):
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

        self.tenant_headers = {
            'HTTP_X_TENANT_ID': str(self.tenant.id),
            'HTTP_HOST': self.domain.domain,
        }

        self.choice_list, _ = SystemChoiceList.objects.get_or_create(
            slug='protein_type',
            defaults={
                'name': 'Protein Type',
                'description': 'Protein choices',
                'is_extensible': True,
                'is_reorderable': True,
                'created_by': self.user,
            },
        )
        SystemChoiceItem.objects.get_or_create(
            choice_list=self.choice_list,
            tenant=None,
            value='BEEF',
            defaults={'label': 'Beef', 'order': 1, 'is_active': True},
        )

    def tearDown(self):
        cache.clear()

    def test_system_choices_cache_refreshes_after_item_mutation(self):
        response = self.client.get(
            '/api/v1/system/choices/',
            {'list': 'protein-types'},
            **self.tenant_headers,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        baseline_values = {item['value'] for item in response.json()}

        SystemChoiceItem.objects.create(
            choice_list=self.choice_list,
            tenant=self.tenant,
            value='LAMB',
            label='Lamb',
            order=99,
            is_active=True,
        )

        refreshed = self.client.get(
            '/api/v1/system/choices/',
            {'list': 'protein-types'},
            **self.tenant_headers,
        )
        self.assertEqual(refreshed.status_code, status.HTTP_200_OK, refreshed.content)
        refreshed_values = {item['value'] for item in refreshed.json()}

        self.assertIn('BEEF', baseline_values)
        self.assertNotIn('LAMB', baseline_values)
        self.assertIn('LAMB', refreshed_values)

    def test_tenant_config_resolve_cache_refreshes_after_update(self):
        config = TenantConfig.objects.create(
            tenant=self.tenant,
            key='features.command_palette.enabled',
            value=False,
            updated_by=self.user,
        )

        first = self.client.get(
            '/api/v1/system/config/resolve/',
            {'key': config.key},
            **self.tenant_headers,
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK, first.content)
        self.assertFalse(first.json()['value'])

        config.value = True
        config.updated_by = self.user
        config.save()

        second = self.client.get(
            '/api/v1/system/config/resolve/',
            {'key': config.key},
            **self.tenant_headers,
        )
        self.assertEqual(second.status_code, status.HTTP_200_OK, second.content)
        self.assertTrue(second.json()['value'])

    def test_system_products_cache_refreshes_after_shared_product_create(self):
        Product.objects.create(product_code='CACHE-BEEF', name='Cache Beef')

        first = self.client.get(
            '/api/v1/system/products/',
            {'limit': 1000},
            **self.tenant_headers,
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK, first.content)
        first_rows = first.json().get('results', first.json())
        first_codes = {row['product_code'] for row in first_rows}
        self.assertIn('CACHE-BEEF', first_codes)

        Product.objects.create(product_code='CACHE-PORK', name='Cache Pork')

        second = self.client.get(
            '/api/v1/system/products/',
            {'limit': 1000},
            **self.tenant_headers,
        )
        self.assertEqual(second.status_code, status.HTTP_200_OK, second.content)
        second_rows = second.json().get('results', second.json())
        second_codes = {row['product_code'] for row in second_rows}
        self.assertIn('CACHE-PORK', second_codes)
