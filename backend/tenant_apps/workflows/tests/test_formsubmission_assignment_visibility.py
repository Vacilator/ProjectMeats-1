from __future__ import annotations

import uuid

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from tenant_apps.workflows.models import (
    FormSubmission,
    FormSubmissionStatus,
    StepAssignment,
    TenantForm,
    TenantFormEntity,
)

from apps.tenants.models import Tenant, TenantUser

User = get_user_model()


class FormSubmissionAssignmentVisibilityTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]

        self.creator = User.objects.create_user(username=f"creator-{unique}", password="pw")
        self.assignee = User.objects.create_user(username=f"assignee-{unique}", password="pw")

        self.tenant = Tenant.objects.create(
            name=f"Tenant {unique}",
            slug=f"tenant-{unique}",
            contact_email=f"{unique}@example.com",
            is_active=True,
            created_by=self.creator,
        )

        # Creator is an admin so they can build the form and assignment
        TenantUser.objects.create(tenant=self.tenant, user=self.creator, role="admin", is_active=True)
        # Assignee is a non-admin tenant member with a role used by role-based assignments
        TenantUser.objects.create(tenant=self.tenant, user=self.assignee, role="manager", is_active=True)

        self.form = TenantForm.objects.create(tenant=self.tenant, name="My Form", created_by=self.creator)
        self.step = TenantFormEntity.objects.create(form=self.form, tenant=self.tenant, entity_type="customer", order=0)

        StepAssignment.objects.create(
            tenant=self.tenant,
            form=self.form,
            step=self.step,
            assignment_type="role",
            assigned_role="manager",
            created_by=self.creator,
        )

        self.submission = FormSubmission.objects.create(
            tenant=self.tenant,
            form=self.form,
            created_by=self.creator,
            status=FormSubmissionStatus.IN_PROGRESS,
            current_step=self.step,
        )

    def test_non_admin_sees_role_assigned_submission_by_default(self):
        # Session auth so TenantMiddleware can resolve X-Tenant-ID.
        self.client.force_login(self.assignee)

        resp = self.client.get(
            "/api/v1/workflows/form-submissions/",
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.content)

        data = resp.json()
        rows = data.get("results", data)
        ids = {r.get("id") for r in rows}
        self.assertIn(str(self.submission.id), ids)
