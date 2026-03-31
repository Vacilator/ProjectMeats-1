from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.tenants.models import Tenant, TenantUser


User = get_user_model()


class TenantListApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.tenant = Tenant.objects.create(
            name='Test Tenant',
            slug='test-tenant-lists',
            schema_name='test_tenant_lists',
            contact_email='test-tenant@example.com',
        )

        self.user = User.objects.create_user(
            username='tenant-admin',
            email='admin@example.com',
            password='testpass123',
        )
        TenantUser.objects.create(
            user=self.user,
            tenant=self.tenant,
            role='admin',
            is_active=True,
        )

        self.client.force_authenticate(user=self.user)

    def test_create_tenant_list_success(self):
        resp = self.client.post(
            '/api/v1/workflows/lists/',
            {
                'name': 'Delivery Methods',
                'description': 'Ways we deliver',
                'is_active': True,
                'options': [
                    {'value': 'pickup', 'label': 'Pickup'},
                    {'value': 'truck', 'label': 'Truck'},
                ],
            },
            format='json',
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        data = resp.json()
        self.assertEqual(data.get('name'), 'Delivery Methods')
        self.assertEqual(data.get('option_count'), 2)

    def test_create_tenant_list_requires_tenant_context(self):
        client = APIClient()
        client.force_authenticate(user=self.user)

        resp = client.post(
            '/api/v1/workflows/lists/',
            {
                'name': 'No Tenant Header',
                'options': [],
            },
            format='json',
        )

        self.assertIn(resp.status_code, (status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN))

    def test_create_tenant_list_duplicate_name_returns_400(self):
        payload = {
            'name': 'Dup List',
            'options': [{'value': 'a', 'label': 'A'}],
        }

        first = self.client.post(
            '/api/v1/workflows/lists/',
            payload,
            format='json',
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.content)

        dup = self.client.post(
            '/api/v1/workflows/lists/',
            payload,
            format='json',
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(dup.status_code, status.HTTP_400_BAD_REQUEST, dup.content)
