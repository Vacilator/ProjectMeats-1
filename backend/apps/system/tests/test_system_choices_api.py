from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.system.models import SystemChoiceItem, SystemChoiceList
from apps.tenants.models import Tenant, TenantDomain, TenantUser

User = get_user_model()


@override_settings(ALLOWED_HOSTS=["*"])
class SystemChoicesApiTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.user = User.objects.create_user(username=f"user-{unique}", password="pw")
        self.client.force_authenticate(self.user)

        self.tenant = Tenant.objects.create(
            name=f"Tenant {unique}",
            slug=f"tenant-{unique}",
            contact_email=f"{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )
        self.domain = TenantDomain.objects.create(
            tenant=self.tenant,
            domain=f"{self.tenant.slug}.example.com",
            is_primary=True,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="admin", is_active=True)

        self.choice_list, _ = SystemChoiceList.objects.get_or_create(
            slug="protein_type",
            defaults={
                "name": "Protein Type",
                "description": "Protein choices",
                "is_extensible": True,
                "is_reorderable": True,
                "created_by": self.user,
            },
        )
        self.system_item = (
            SystemChoiceItem.objects.filter(choice_list=self.choice_list, tenant__isnull=True)
            .order_by("order", "label")
            .first()
        )
        if self.system_item is None:
            self.system_item = SystemChoiceItem.objects.create(
                choice_list=self.choice_list,
                tenant=None,
                value="BEEF",
                label="Beef",
                order=1,
                is_active=True,
            )

        self.tenant_item = SystemChoiceItem.objects.create(
            choice_list=self.choice_list,
            tenant=self.tenant,
            value=f"WAGYU_{unique.upper()}",
            label="Wagyu",
            order=2,
            is_active=True,
        )

        self.tenant_headers = {
            "HTTP_X_TENANT_ID": str(self.tenant.id),
            "HTTP_HOST": self.domain.domain,
        }

    def test_missing_list_returns_200_with_empty_array(self):
        response = self.client.get("/api/v1/system/choices/", {"list": "does-not-exist"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), [])

    def test_protein_type_aliases_resolve_in_single_endpoint(self):
        response = self.client.get(
            "/api/v1/system/choices/",
            {"list": "protein-types"},
            **self.tenant_headers,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        values = [item["value"] for item in response.json()]

        self.assertIn(self.system_item.value, values)
        self.assertIn(self.tenant_item.value, values)

    def test_without_tenant_context_only_system_items_are_returned(self):
        response = self.client.get("/api/v1/system/choices/", {"list": "protein_types"})

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        values = [item["value"] for item in response.json()]

        self.assertIn(self.system_item.value, values)
        self.assertNotIn(self.tenant_item.value, values)
