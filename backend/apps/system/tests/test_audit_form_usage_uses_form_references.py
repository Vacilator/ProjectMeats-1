from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.system.models import TenantForm, TenantWorkForm
from apps.system.tasks import audit_form_usage
from apps.tenants.models import Tenant, TenantUser

User = get_user_model()


class AuditFormUsageUsesFormReferencesTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(username=f"u-{unique}", password="pw")

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
            name="Form A",
            description="",
            type="single_step",
            form_definition={"entity_type": "supplier", "fields": []},
            created_by=self.user,
            updated_by=self.user,
            usage_count=0,
        )

        self.workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name="WF",
            description="",
            status="draft",
            workflow_definition={
                "nodes": [
                    {
                        "id": "n1",
                        "type": "formStep",
                        "data": {"tenantFormId": str(self.form.id)},
                    }
                ],
                "edges": [],
            },
            created_by=self.user,
            updated_by=self.user,
        )
        self.workform.update_form_references()

    def test_audit_updates_usage_count_using_form_references(self):
        audit_form_usage()

        self.form.refresh_from_db()
        self.assertEqual(self.form.usage_count, 1)
