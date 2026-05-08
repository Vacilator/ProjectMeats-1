from __future__ import annotations

import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from tenant_apps.workflows.models import TenantForm
from tenant_apps.workflows.views import FormExportAPIView

from apps.tenants.models import Tenant, TenantUser


class WorkflowAdminAPIViewTenantScopingTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.factory = APIRequestFactory()

        self.staff = User.objects.create_user(username=f"staff-{unique}", password="pw", is_staff=True)

        self.tenant_a = Tenant.objects.create(
            name=f"Tenant A {unique}",
            slug=f"tenant-a-{unique}",
            contact_email=f"a-{unique}@example.com",
            is_active=True,
            created_by=self.staff,
        )
        self.tenant_b = Tenant.objects.create(
            name=f"Tenant B {unique}",
            slug=f"tenant-b-{unique}",
            contact_email=f"b-{unique}@example.com",
            is_active=True,
            created_by=self.staff,
        )

        TenantUser.objects.create(tenant=self.tenant_a, user=self.staff, role="admin", is_active=True)
        TenantUser.objects.create(tenant=self.tenant_b, user=self.staff, role="admin", is_active=True)

        self.form_a = TenantForm.objects.create(tenant=self.tenant_a, name="Form A", created_by=self.staff)

    def _get(self, tenant=None):
        req = self.factory.get(f"/api/v1/workflows/forms/{self.form_a.id}/export/")
        force_authenticate(req, user=self.staff)
        if tenant is not None:
            req.tenant = tenant
        return req

    def test_form_export_requires_tenant_context(self):
        resp = FormExportAPIView.as_view()(self._get(), form_id=str(self.form_a.id))
        self.assertEqual(resp.status_code, 400)

    def test_form_export_is_scoped_to_tenant(self):
        # Wrong tenant should not be able to resolve the form
        resp = FormExportAPIView.as_view()(self._get(self.tenant_b), form_id=str(self.form_a.id))
        self.assertEqual(resp.status_code, 404)
