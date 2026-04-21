from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from apps.system.workform_views import _get_request_tenant
from apps.tenants.models import Tenant, TenantUser


User = get_user_model()


class GetRequestTenantResolutionTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        unique = uuid.uuid4().hex[:8]

        self.tenant_a = Tenant.objects.create(
            name=f'Tenant A {unique}',
            slug=f'tenant-a-{unique}',
            contact_email=f'{unique}-a@example.com',
            is_active=True,
        )
        self.tenant_b = Tenant.objects.create(
            name=f'Tenant B {unique}',
            slug=f'tenant-b-{unique}',
            contact_email=f'{unique}-b@example.com',
            is_active=True,
        )

        self.user = User.objects.create_user(username=f'u-{unique}', password='pw')
        TenantUser.objects.create(tenant=self.tenant_a, user=self.user, role='user', is_active=True)

    def test_returns_none_without_tenant_context(self):
        req = self.factory.get('/api/v1/tenant-workforms/')
        req.user = self.user

        tenant = _get_request_tenant(req)
        self.assertIsNone(tenant)

    def test_resolves_from_x_tenant_id_for_active_member_and_caches(self):
        req = self.factory.get('/api/v1/tenant-workforms/', HTTP_X_TENANT_ID=str(self.tenant_a.id))
        req.user = self.user

        tenant = _get_request_tenant(req)
        self.assertIsNotNone(tenant)
        self.assertEqual(tenant.id, self.tenant_a.id)

        # Cached onto request for subsequent access.
        self.assertTrue(hasattr(req, 'tenant'))
        self.assertEqual(req.tenant.id, self.tenant_a.id)

    def test_fails_closed_when_header_tenant_not_in_user_memberships(self):
        req = self.factory.get('/api/v1/tenant-workforms/', HTTP_X_TENANT_ID=str(self.tenant_b.id))
        req.user = self.user

        tenant = _get_request_tenant(req)
        self.assertIsNone(tenant)
        self.assertFalse(hasattr(req, 'tenant'))
