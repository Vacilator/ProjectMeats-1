from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.system.models import TenantWorkForm
from apps.tenants.models import Tenant, TenantDomain, TenantUser

User = get_user_model()


@override_settings(ALLOWED_HOSTS=["*"])
class WorkFormRuntimeSupportValidationTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.user = User.objects.create_user(username=f"u-{unique}", password="pw")
        self.client.force_authenticate(self.user)

        self.tenant = Tenant.objects.create(
            name=f"Tenant {unique}",
            slug=f"tenant-{unique}",
            contact_email=f"{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )

        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="admin", is_active=True)

        domain = TenantDomain.objects.create(
            tenant=self.tenant,
            domain=f"{self.tenant.slug}.example.com",
            is_primary=True,
        )
        # TenantMiddleware resolves tenant from host (force_authenticate doesn't run through middleware auth).
        self.client.defaults["HTTP_HOST"] = domain.domain

        self.workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name="WF",
            description="",
            status="draft",
            workflow_definition={
                "nodes": [
                    {"id": "t1", "type": "triggerManual", "data": {"label": "Manual Trigger"}},
                    {"id": "bad", "type": "actionHttp", "data": {"label": "HTTP Request"}},
                    {"id": "end", "type": "end", "data": {"label": "End"}},
                ],
                "edges": [
                    {"id": "e1", "source": "t1", "target": "bad", "type": "default"},
                    {"id": "e2", "source": "bad", "target": "end", "type": "default"},
                ],
            },
            created_by=self.user,
            updated_by=self.user,
        )

    def test_validate_endpoint_reports_runtime_unsupported_actions(self):
        resp = self.client.post(
            f"/api/v1/tenant-workforms/{self.workform.id}/validate/",
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)
        data = resp.json()

        self.assertIn("runtime_valid", data)
        self.assertFalse(data["runtime_valid"])
        self.assertIn("runtime", data)

        unsupported = data["runtime"].get("unsupported_actions") or []
        self.assertTrue(any(row.get("node_type") == "actionHttp" for row in unsupported))

    def test_activation_is_blocked_when_runtime_invalid(self):
        resp = self.client.patch(
            f"/api/v1/tenant-workforms/{self.workform.id}/",
            data={"status": "active"},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, resp.content)
        payload = resp.json()
        self.assertEqual(payload.get("error"), "workform_validation_failed")
        self.assertIn("runtime", payload)
        self.assertFalse(payload["runtime"].get("valid", True))

    def test_create_active_is_blocked_when_runtime_invalid(self):
        resp = self.client.post(
            "/api/v1/tenant-workforms/",
            data={
                "name": "WF create",
                "description": "",
                "status": "active",
                "workflow_definition": {
                    "nodes": [
                        {"id": "t1", "type": "triggerManual", "data": {"label": "Manual Trigger"}},
                        {"id": "bad", "type": "actionHttp", "data": {"label": "HTTP Request"}},
                        {"id": "end", "type": "end", "data": {"label": "End"}},
                    ],
                    "edges": [
                        {"id": "e1", "source": "t1", "target": "bad", "type": "default"},
                        {"id": "e2", "source": "bad", "target": "end", "type": "default"},
                    ],
                },
            },
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, resp.content)
        payload = resp.json()
        self.assertEqual(payload.get("error"), "workform_validation_failed")
        self.assertIn("runtime", payload)
        self.assertFalse(payload["runtime"].get("valid", True))

        self.assertFalse(TenantWorkForm.objects.filter(tenant=self.tenant, name="WF create").exists())
