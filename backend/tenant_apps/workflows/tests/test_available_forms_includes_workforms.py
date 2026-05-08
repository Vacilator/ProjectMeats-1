from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from tenant_apps.workflows.models import FormStatus, TenantForm

from apps.system.models import TenantWorkForm
from apps.tenants.models import Tenant, TenantUser

User = get_user_model()


class AvailableFormsIncludesWorkformsTests(APITestCase):
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

        other_unique = uuid.uuid4().hex[:8]
        self.other_tenant = Tenant.objects.create(
            name=f"Tenant Other {other_unique}",
            slug=f"tenant-other-{other_unique}",
            contact_email=f"{other_unique}@example.com",
            is_active=True,
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.other_tenant, user=self.user, role="admin", is_active=True)

        self.form = TenantForm.objects.create(
            tenant=self.tenant,
            name="QA Form",
            status=FormStatus.ACTIVE,
            created_by=self.user,
        )

        self.workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name="QA WorkForm",
            status="active",
            workflow_definition={"nodes": [{"id": "t1", "type": "triggerManual"}], "edges": []},
            created_by=self.user,
            updated_by=self.user,
        )

        # Regression: malformed JSON payloads should not 500 available-forms.
        self.malformed_workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name="Malformed WF",
            status="active",
            workflow_definition="oops",
            created_by=self.user,
            updated_by=self.user,
        )

        self.other_workform = TenantWorkForm.objects.create(
            tenant=self.other_tenant,
            name="Other Tenant WF",
            status="active",
            workflow_definition={"nodes": [{"id": "t1", "type": "triggerManual"}], "edges": []},
            created_by=self.user,
            updated_by=self.user,
        )

    def test_available_forms_lists_forms_and_workforms(self):
        resp = self.client.get(
            "/api/v1/workflows/available-forms/",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)

        rows = resp.json()
        seen = {(r.get("type"), r.get("id")) for r in rows}

        self.assertIn(("form", str(self.form.id)), seen)
        self.assertIn(("workflow", str(self.workform.id)), seen)
        self.assertIn(("workflow", str(self.malformed_workform.id)), seen)
        self.assertNotIn(("workflow", str(self.other_workform.id)), seen)

        # Contract: rows must include stable keys needed by the WorkForms catalog.
        for row in rows:
            self.assertIn("id", row)
            self.assertIn("type", row)
            self.assertIn("name", row)
            self.assertIn("status", row)

            if row.get("type") == "form":
                # Forms do not have a node_count.
                self.assertIsNone(row.get("node_count"))
            elif row.get("type") == "workflow":
                self.assertIsInstance(row.get("node_count"), int)

        malformed_row = next(r for r in rows if r.get("id") == str(self.malformed_workform.id))
        self.assertEqual(malformed_row.get("node_count"), 0)
