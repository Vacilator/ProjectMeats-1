from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.system.models import TenantWorkForm
from apps.tenants.models import Tenant, TenantUser
from tenant_apps.workflows.models import FormStatus, TenantForm


User = get_user_model()


class QuickActionsPutTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.user = User.objects.create_user(username=f'u-{unique}', password='pw')
        self.client.force_authenticate(self.user)

        self.tenant = Tenant.objects.create(
            name=f'Tenant {unique}',
            slug=f'tenant-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='admin', is_active=True)

        self.form = TenantForm.objects.create(
            tenant=self.tenant,
            name='QA Form',
            status=FormStatus.ACTIVE,
            created_by=self.user,
        )
        self.workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name='QA WorkForm',
            status='active',
            workflow_definition={'nodes': [], 'edges': []},
            created_by=self.user,
            updated_by=self.user,
        )

    def test_put_requires_tenant_context(self):
        resp = self.client.put('/api/v1/workflows/quick-actions/', data={'items': []}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, resp.content)

    def test_put_accepts_valid_form_and_workflow_targets(self):
        payload = {
            'items': [
                {'id': 'qa-form', 'type': 'form', 'form_id': str(self.form.id), 'label': 'QA Form', 'order': 0},
                {
                    'id': 'qa-workflow',
                    'type': 'workflow',
                    'workflow_id': str(self.workform.id),
                    'label': 'QA WorkForm',
                    'order': 1,
                },
            ]
        }

        resp = self.client.put(
            '/api/v1/workflows/quick-actions/',
            data=payload,
            format='json',
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)

        body = resp.json()
        self.assertTrue(body.get('success'))

        items = body.get('items')
        self.assertEqual(len(items), 2)

        # Stored/returned IDs should be strings (JSON safe).
        self.assertEqual(items[0]['type'], 'form')
        self.assertEqual(items[0]['form_id'], str(self.form.id))

        self.assertEqual(items[1]['type'], 'workflow')
        self.assertEqual(items[1]['workflow_id'], str(self.workform.id))

    def test_put_rejects_unknown_form(self):
        payload = {
            'items': [
                {
                    'id': 'missing-form',
                    'type': 'form',
                    'form_id': '00000000-0000-0000-0000-000000000999',
                    'label': 'Missing',
                    'order': 0,
                }
            ]
        }

        resp = self.client.put(
            '/api/v1/workflows/quick-actions/',
            data=payload,
            format='json',
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, resp.content)
        self.assertIn('not found', (resp.json().get('error') or '').lower())
