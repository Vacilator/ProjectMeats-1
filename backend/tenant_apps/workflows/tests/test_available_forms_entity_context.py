from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from tenant_apps.workflows.models import FormStatus, TenantForm

from apps.tenants.models import Tenant, TenantUser

User = get_user_model()


class AvailableFormsEntityContextTests(APITestCase):
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

        self.form = TenantForm.objects.create(
            tenant=self.tenant,
            name="QA Form",
            status=FormStatus.ACTIVE,
            created_by=self.user,
        )

    def test_requires_entity_type_and_id_pair(self):
        resp = self.client.get(
            "/api/v1/workflows/available-forms/?entity_type=plant",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_unknown_entity_type(self):
        resp = self.client.get(
            "/api/v1/workflows/available-forms/?entity_type=unknown&entity_id=1",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_invalid_entity_id_format(self):
        resp = self.client.get(
            "/api/v1/workflows/available-forms/?entity_type=plant&entity_id=not-an-int",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_returns_400_for_missing_entity(self):
        resp = self.client.get(
            "/api/v1/workflows/available-forms/?entity_type=plant&entity_id=999999",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_valid_entity_context_returns_200(self):
        from tenant_apps.plants.models import Plant
        from tenant_apps.suppliers.models import Supplier

        supplier = Supplier.objects.create(tenant=self.tenant, name="Supplier A")
        plant = Plant.objects.create(tenant=self.tenant, supplier=supplier, name="Plant A", plant_est_num="123")

        resp = self.client.get(
            f"/api/v1/workflows/available-forms/?entity_type=plant&entity_id={plant.id}",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)

        rows = resp.json()
        self.assertIsInstance(rows, list)
        seen = {(r.get("type"), r.get("id")) for r in rows}
        self.assertIn(("form", str(self.form.id)), seen)
