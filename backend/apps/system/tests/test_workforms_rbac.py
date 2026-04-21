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
class WorkFormsRBACSystemViewSetsTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.tenant = Tenant.objects.create(
            name=f'Tenant {unique}',
            slug=f'tenant-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
        )
        self.domain = TenantDomain.objects.create(
            tenant=self.tenant,
            domain=f'{self.tenant.slug}.example.com',
            is_primary=True,
        )

        self.viewer = User.objects.create_user(username=f'viewer-{unique}', password='pw')
        self.editor = User.objects.create_user(username=f'editor-{unique}', password='pw')

        TenantUser.objects.create(tenant=self.tenant, user=self.viewer, role='user', is_active=True)
        TenantUser.objects.create(tenant=self.tenant, user=self.editor, role='manager', is_active=True)

        self.workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name='Existing WF',
            description='',
            status='draft',
            workflow_definition={'nodes': [], 'edges': []},
            created_by=self.editor,
            updated_by=self.editor,
        )

    def test_viewer_can_list_workforms(self):
        self.client.force_login(self.viewer)
        resp = self.client.get('/api/v1/tenant-workforms/', HTTP_HOST=self.domain.domain)
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)

    def test_viewer_cannot_create_workform(self):
        self.client.force_login(self.viewer)
        resp = self.client.post(
            '/api/v1/tenant-workforms/',
            data={
                'name': 'New WF',
                'description': '',
                'status': 'draft',
                'workflow_definition': {'nodes': [], 'edges': []},
            },
            format='json',
            HTTP_HOST=self.domain.domain,
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN, resp.content)

    def test_editor_can_create_workform(self):
        self.client.force_login(self.editor)
        resp = self.client.post(
            '/api/v1/tenant-workforms/',
            data={
                'name': 'New WF',
                'description': '',
                'status': 'draft',
                'workflow_definition': {'nodes': [], 'edges': []},
            },
            format='json',
            HTTP_HOST=self.domain.domain,
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)

    def test_viewer_cannot_create_tenant_form(self):
        self.client.force_login(self.viewer)
        resp = self.client.post(
            '/api/v1/tenant-forms/',
            data={
                'name': 'New Form',
                'description': '',
                'type': 'single_step',
                'entity_type': 'supplier',
                'schema': {'fields': []},
            },
            format='json',
            HTTP_HOST=self.domain.domain,
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN, resp.content)

    def test_editor_can_create_tenant_form(self):
        self.client.force_login(self.editor)
        resp = self.client.post(
            '/api/v1/tenant-forms/',
            data={
                'name': 'New Form',
                'description': '',
                'type': 'single_step',
                'entity_type': 'supplier',
                'schema': {'fields': []},
            },
            format='json',
            HTTP_HOST=self.domain.domain,
        )
        # Serializer may perform additional validation; this test only asserts we don't 403.
        self.assertNotEqual(resp.status_code, status.HTTP_403_FORBIDDEN, resp.content)
