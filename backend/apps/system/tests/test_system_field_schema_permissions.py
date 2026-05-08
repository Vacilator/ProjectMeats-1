from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.system.models import SystemFieldSchema
from apps.tenants.models import Tenant, TenantDomain, TenantUser

User = get_user_model()


@override_settings(ALLOWED_HOSTS=["*"])
class SystemFieldSchemaPermissionsTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.tenant_admin = User.objects.create_user(
            username=f"tenant-admin-{unique}",
            password="pw",
        )
        self.superuser = User.objects.create_superuser(
            username=f"superuser-{unique}",
            email=f"superuser-{unique}@example.com",
            password="pw",
        )
        self.reader = User.objects.create_user(
            username=f"reader-{unique}",
            password="pw",
        )

        self.tenant = Tenant.objects.create(
            name=f"Tenant {unique}",
            slug=f"tenant-{unique}",
            contact_email=f"{unique}@example.com",
            is_active=True,
            created_by=self.superuser,
        )
        self.domain = TenantDomain.objects.create(
            tenant=self.tenant,
            domain=f"{self.tenant.slug}.example.com",
            is_primary=True,
        )
        TenantUser.objects.create(
            tenant=self.tenant,
            user=self.tenant_admin,
            role="admin",
            is_active=True,
        )
        TenantUser.objects.create(
            tenant=self.tenant,
            user=self.reader,
            role="member",
            is_active=True,
        )

        self.schema = SystemFieldSchema.objects.create(
            field_path=f"products.product.name_{unique}",
            field_type=SystemFieldSchema.FieldType.TEXT,
            label="Product Name",
        )

        self.headers = {
            "HTTP_X_TENANT_ID": str(self.tenant.id),
            "HTTP_HOST": self.domain.domain,
        }

    def test_authenticated_reader_can_read_system_field_schema(self):
        self.client.force_authenticate(self.reader)

        resp = self.client.get("/api/v1/system/field-schemas/", **self.headers)

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)
        body = resp.json()
        results = body["results"] if isinstance(body, dict) and "results" in body else body
        field_paths = {row.get("field_path") for row in results}
        self.assertIn(self.schema.field_path, field_paths)

    def test_tenant_admin_is_staff_cannot_create_system_field_schema(self):
        self.client.force_authenticate(self.tenant_admin)

        resp = self.client.post(
            "/api/v1/system/field-schemas/",
            {
                "field_path": f"products.product.tenant_admin_{uuid.uuid4().hex[:8]}",
                "field_type": SystemFieldSchema.FieldType.TEXT,
                "label": "Tenant Override",
            },
            format="json",
            **self.headers,
        )

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN, resp.content)
        self.assertEqual(SystemFieldSchema.objects.count(), 1)

    def test_superuser_can_create_system_field_schema(self):
        self.client.force_authenticate(self.superuser)

        new_field_path = f"products.product.superuser_{uuid.uuid4().hex[:8]}"
        resp = self.client.post(
            "/api/v1/system/field-schemas/",
            {
                "field_path": new_field_path,
                "field_type": SystemFieldSchema.FieldType.TEXT,
                "label": "Canonical Product Name",
            },
            format="json",
            **self.headers,
        )

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        self.assertTrue(SystemFieldSchema.objects.filter(field_path=new_field_path).exists())
