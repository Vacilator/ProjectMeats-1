from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from tenant_apps.suppliers.models import Supplier

from apps.tenants.models import Tenant, TenantUser

User = get_user_model()


class QuickCreatePermissionsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            slug="test-tenant",
            schema_name="test_tenant_quick_create",
            contact_email="test-tenant@example.com",
        )

        self.user = User.objects.create_user(
            username="member-user",
            email="member@example.com",
            password="testpass123",
        )
        TenantUser.objects.create(
            user=self.user,
            tenant=self.tenant,
            role="user",
            is_active=True,
        )

        # Session auth so TenantMiddleware can resolve X-Tenant-ID.
        self.client.force_login(self.user)

    def test_quick_create_supplier_allows_tenant_member_without_django_model_perm(self):
        resp = self.client.post(
            "/api/v1/workflows/quick-create/supplier/",
            {"name": "Acme Supplier"},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("entity_type"), "supplier")
        self.assertEqual(data.get("label"), "Acme Supplier")
        self.assertTrue(Supplier.objects.filter(tenant=self.tenant, name="Acme Supplier").exists())

    def test_quick_create_supplier_denies_user_without_tenant_access(self):
        other_user = User.objects.create_user(
            username="non-member",
            email="nonmember@example.com",
            password="testpass123",
        )
        client = APIClient()
        client.force_login(other_user)

        resp = client.post(
            "/api/v1/workflows/quick-create/supplier/",
            {"name": "Blocked Supplier"},
            format="json",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Supplier.objects.filter(tenant=self.tenant, name="Blocked Supplier").exists())
