from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from apps.tenants.models import Tenant, TenantInvitation


User = get_user_model()


class AdminInviteViewTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.superuser = User.objects.create_superuser(
            username=f"admin-{unique}",
            email=f"admin-{unique}@example.com",
            password="pw",
        )
        self.tenant = Tenant.objects.create(
            name=f"Tenant {unique}",
            slug=f"tenant-{unique}",
            contact_email=f"tenant-{unique}@example.com",
            is_active=True,
            created_by=self.superuser,
        )
        self.client.force_login(self.superuser)
        self.url = reverse("meatscentral_admin:tenants_tenantinvitation_invite")

    def test_superuser_tenant_selector_renders_inside_form(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        form_start = html.index('<form method="post">')
        tenant_select = html.index('name="tenant"')
        form_end = html.index("</form>")

        self.assertLess(form_start, tenant_select)
        self.assertLess(tenant_select, form_end)

    def test_superuser_can_submit_selected_tenant(self):
        response = self.client.post(
            self.url,
            {
                "tenant": str(self.tenant.id),
                "email": "new-admin@example.com",
                "role": "admin",
                "message": "Welcome",
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        invitation = TenantInvitation.objects.get(email="new-admin@example.com")
        self.assertEqual(invitation.tenant, self.tenant)
        self.assertEqual(invitation.invited_by, self.superuser)
