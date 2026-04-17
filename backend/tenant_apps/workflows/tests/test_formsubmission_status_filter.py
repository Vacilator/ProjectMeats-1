from __future__ import annotations

import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.tenants.models import Tenant, TenantUser
from tenant_apps.workflows.models import FormSubmission, FormSubmissionStatus, TenantForm
from tenant_apps.workflows.views import FormSubmissionViewSet


class FormSubmissionStatusFilterTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.factory = APIRequestFactory()

        self.user = User.objects.create_user(username=f'u-{unique}', password='pw', is_staff=True)

        self.tenant = Tenant.objects.create(
            name=f'Tenant {unique}',
            slug=f'tenant-{unique}',
            contact_email=f'{unique}@example.com',
            is_active=True,
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role='admin', is_active=True)

        self.form = TenantForm.objects.create(tenant=self.tenant, name='Form', created_by=self.user)

        self.sub_draft = FormSubmission.objects.create(
            tenant=self.tenant,
            form=self.form,
            created_by=self.user,
            status=FormSubmissionStatus.DRAFT,
        )
        self.sub_in_progress = FormSubmission.objects.create(
            tenant=self.tenant,
            form=self.form,
            created_by=self.user,
            status=FormSubmissionStatus.IN_PROGRESS,
        )

    def _get(self, path: str, tenant):
        request = self.factory.get(path)
        force_authenticate(request, user=self.user)
        request.tenant = tenant
        return request

    def _items(self, response):
        data = response.data
        if isinstance(data, dict) and 'results' in data:
            return data['results']
        return data

    def test_status_accepts_comma_separated_list(self):
        req = self._get('/api/v1/workflows/form-submissions/?status=draft,in_progress', self.tenant)
        resp = FormSubmissionViewSet.as_view({'get': 'list'})(req)
        self.assertEqual(resp.status_code, 200)

        ids = {row.get('id') for row in self._items(resp)}
        self.assertIn(str(self.sub_draft.id), ids)
        self.assertIn(str(self.sub_in_progress.id), ids)
