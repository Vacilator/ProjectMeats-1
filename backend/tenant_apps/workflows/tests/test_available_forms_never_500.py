from __future__ import annotations

import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.system.models import TenantWorkForm
from apps.tenants.models import Tenant, TenantUser
from tenant_apps.workflows.models import FormStatus, TenantForm


User = get_user_model()


class AvailableFormsNever500Tests(APITestCase):
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
            workflow_definition={'nodes': [{'id': 't1', 'type': 'triggerManual'}], 'edges': []},
            created_by=self.user,
            updated_by=self.user,
        )

    def test_never_500_when_form_serializer_raises(self):
        # Force the serializer to error in a way we might see from malformed data.
        # We patch the serializer class so that instantiation raises, which should be
        # handled per-row and never bubble up as a 500.
        with patch('tenant_apps.workflows.views.AvailableFormSerializer') as mocked:
            mocked.side_effect = RuntimeError('boom')

            resp = self.client.get(
                '/api/v1/workflows/available-forms/',
                HTTP_X_TENANT_ID=str(self.tenant.id),
            )

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)
        rows = resp.json()
        self.assertIsInstance(rows, list)

        # WorkForms should still return even if forms serialization fails.
        seen = {(r.get('type'), r.get('id')) for r in rows}
        self.assertIn(('workflow', str(self.workform.id)), seen)
