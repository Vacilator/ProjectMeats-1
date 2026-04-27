from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.system.models import TenantWorkForm
from apps.tenants.models import Tenant, TenantDomain, TenantUser


User = get_user_model()


@override_settings(ALLOWED_HOSTS=['*'])
class TenantWorkFormTenantScopingTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.user = User.objects.create_user(username=f'u-{unique}', password='pw')
        self.client.force_authenticate(self.user)

        self.tenant1 = Tenant.objects.create(
            name=f'Tenant1 {unique}',
            slug=f'tenant1-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )
        self.domain1 = TenantDomain.objects.create(
            tenant=self.tenant1,
            domain=f'{self.tenant1.slug}.example.com',
            is_primary=True,
        )

        self.tenant2 = Tenant.objects.create(
            name=f'Tenant2 {unique}',
            slug=f'tenant2-{unique}',
            contact_email=f'other-{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )
        self.domain2 = TenantDomain.objects.create(
            tenant=self.tenant2,
            domain=f'{self.tenant2.slug}.example.com',
            is_primary=True,
        )

        TenantUser.objects.create(tenant=self.tenant1, user=self.user, role='admin', is_active=True)
        TenantUser.objects.create(tenant=self.tenant2, user=self.user, role='admin', is_active=True)

        self.wf1 = TenantWorkForm.objects.create(
            tenant=self.tenant1,
            name='WF1',
            description='',
            status='draft',
            workflow_definition={'nodes': [], 'edges': []},
            created_by=self.user,
            updated_by=self.user,
        )
        self.wf2 = TenantWorkForm.objects.create(
            tenant=self.tenant2,
            name='WF2',
            description='',
            status='draft',
            workflow_definition={'nodes': [], 'edges': []},
            created_by=self.user,
            updated_by=self.user,
        )

    def test_list_is_tenant_scoped_by_host(self):
        resp = self.client.get('/api/v1/tenant-workforms/', HTTP_HOST=self.domain1.domain)
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)

        results = resp.json().get('results') if isinstance(resp.json(), dict) else resp.json()
        ids = {row.get('id') for row in results}
        self.assertIn(str(self.wf1.id), ids)
        self.assertNotIn(str(self.wf2.id), ids)

    def test_retrieve_other_tenant_fails_closed(self):
        resp = self.client.get(f'/api/v1/tenant-workforms/{self.wf2.id}/', HTTP_HOST=self.domain1.domain)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_other_tenant_fails_closed(self):
        resp = self.client.delete(f'/api/v1/tenant-workforms/{self.wf2.id}/', HTTP_HOST=self.domain1.domain)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_missing_tenant_context_fails_closed(self):
        # No host-based tenant means list should not leak any rows.
        resp = self.client.get('/api/v1/tenant-workforms/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.json().get('results') if isinstance(resp.json(), dict) else resp.json()
        self.assertEqual(len(results), 0)
