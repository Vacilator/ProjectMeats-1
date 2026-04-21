from __future__ import annotations

import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.system.models import TenantForm, TenantWorkForm
from apps.tenants.models import Tenant, TenantDomain, TenantUser
from apps.tenants.rls import RlsSetResult


User = get_user_model()


@override_settings(ALLOWED_HOSTS=['*'])
class SystemWorkFormsRlsWriteAssertTests(APITestCase):
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

        self.editor = User.objects.create_user(username=f'editor-{unique}', password='pw')
        TenantUser.objects.create(tenant=self.tenant, user=self.editor, role='manager', is_active=True)

        self.workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name='Existing WF',
            description='',
            status='draft',
            workflow_definition={
                'nodes': [
                    {'id': 'c1', 'type': 'formProcessGroup', 'data': {'containerName': 'Group'}},
                    {'id': 'n1', 'type': 'form', 'parentId': 'c1', 'data': {'label': 'Step 1'}},
                ],
                'edges': [],
            },
            created_by=self.editor,
            updated_by=self.editor,
        )

        self.form_a = TenantForm.objects.create(
            tenant=self.tenant,
            name='Form A',
            description='',
            type='single_step',
            form_definition={'entity_type': 'supplier', 'fields': []},
            created_by=self.editor,
            updated_by=self.editor,
        )
        self.form_b = TenantForm.objects.create(
            tenant=self.tenant,
            name='Form B',
            description='',
            type='single_step',
            form_definition={'entity_type': 'supplier', 'fields': []},
            created_by=self.editor,
            updated_by=self.editor,
        )

        self.multi_form = TenantForm.objects.create(
            tenant=self.tenant,
            name='Multi Form',
            description='',
            type='multi_step',
            form_definition={
                'steps': [
                    {'name': 'Step 1', 'entity_type': 'supplier', 'fields': []},
                    {'name': 'Step 2', 'entity_type': 'supplier', 'fields': []},
                ],
                'navigation': {'show_progress': True, 'allow_back': True},
            },
            created_by=self.editor,
            updated_by=self.editor,
        )

    def _login(self):
        self.client.force_login(self.editor)

    @patch('apps.tenants.rls.set_current_tenant', return_value=RlsSetResult(ok=False, error='boom'))
    @patch('apps.system.workform_views.connection.vendor', 'postgresql')
    def test_write_endpoints_fail_closed_when_rls_unavailable(self, _mock_set_current_tenant):
        self._login()

        # TenantForm CRUD (create)
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
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE, resp.content)

        # WorkForm container mutations
        resp = self.client.post(
            f'/api/v1/tenant-workforms/{self.workform.id}/containers/add-node/',
            data={'node_id': 'n1', 'container_id': 'c1'},
            format='json',
            HTTP_HOST=self.domain.domain,
        )
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE, resp.content)

        # Form merge/split
        resp = self.client.post(
            '/api/v1/tenant-forms/merge/',
            data={
                'container_name': 'Merged',
                'description': '',
                'source_form_ids': [str(self.form_a.id), str(self.form_b.id)],
            },
            format='json',
            HTTP_HOST=self.domain.domain,
        )
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE, resp.content)

        resp = self.client.post(
            '/api/v1/tenant-forms/split/',
            data={
                'source_form_id': str(self.multi_form.id),
                'step_index': 0,
                'new_form_name': 'Split Step',
                'new_form_description': '',
            },
            format='json',
            HTTP_HOST=self.domain.domain,
        )
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE, resp.content)
