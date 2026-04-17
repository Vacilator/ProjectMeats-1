from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.tenants.models import Tenant, TenantUser
from tenant_apps.suppliers.models import Supplier


User = get_user_model()


class TenantHeaderSpoofingTests(APITestCase):
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

        TenantUser.objects.create(tenant=self.tenant_a, user=self.user, role='admin', is_active=True)
        Supplier.objects.create(tenant=self.tenant_b, name='B only supplier')

        access = RefreshToken.for_user(self.user).access_token
        self.token = str(access)

    def test_jwt_cannot_spoof_other_tenant_via_header(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f'Bearer {self.token}',
            HTTP_X_TENANT_ID=str(self.tenant_b.id),
        )
        resp = self.client.get('/api/v1/suppliers/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_jwt_can_access_own_tenant(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f'Bearer {self.token}',
            HTTP_X_TENANT_ID=str(self.tenant_a.id),
        )
        resp = self.client.get('/api/v1/suppliers/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
