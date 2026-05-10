"""Cross-tenant WorkForm execution spoofing tests.

Verifies that:
- A user in Tenant A cannot list executions from Tenant B
- A user in Tenant A cannot retrieve an execution detail from Tenant B (404)
- Missing tenant context returns empty results (fail-closed)
- The workflow `run` action cannot be triggered cross-tenant
"""

from __future__ import annotations

import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.tenants.models import Tenant, TenantUser
from apps.system.models.tenant_workform import TenantWorkForm
from tenant_apps.workflows.models import (
    TenantWorkFormExecution,
    TenantWorkFormExecutionStatus,
    TenantWorkflow,
    WorkflowStatus,
    TriggerType,
)
from tenant_apps.workflows.views import (
    TenantWorkFormExecutionViewSet,
    TenantWorkflowViewSet,
)


class CrossTenantExecutionSpoofingTests(TestCase):
    """Verify that execution data is strictly tenant-isolated."""

    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.factory = APIRequestFactory()

        self.user_a = User.objects.create_user(username=f"user-a-{unique}", password="pw")
        self.user_b = User.objects.create_user(username=f"user-b-{unique}", password="pw")

        self.tenant_a = Tenant.objects.create(
            name=f"Tenant A {unique}",
            slug=f"tenant-a-{unique}",
            contact_email=f"a-{unique}@example.com",
            is_active=True,
            created_by=self.user_a,
        )
        self.tenant_b = Tenant.objects.create(
            name=f"Tenant B {unique}",
            slug=f"tenant-b-{unique}",
            contact_email=f"b-{unique}@example.com",
            is_active=True,
            created_by=self.user_b,
        )

        TenantUser.objects.create(tenant=self.tenant_a, user=self.user_a, role="admin", is_active=True)
        TenantUser.objects.create(tenant=self.tenant_b, user=self.user_b, role="admin", is_active=True)

        # WorkForms in each tenant
        self.workform_a = TenantWorkForm.objects.create(
            tenant=self.tenant_a,
            name="WorkForm A",
            created_by=self.user_a,
        )
        self.workform_b = TenantWorkForm.objects.create(
            tenant=self.tenant_b,
            name="WorkForm B",
            created_by=self.user_b,
        )

        # Executions in each tenant
        self.exec_a = TenantWorkFormExecution.objects.create(
            tenant=self.tenant_a,
            workform=self.workform_a,
            started_by=self.user_a,
            status=TenantWorkFormExecutionStatus.COMPLETED,
            initial_data={"entity_type": "customer", "entity_id": "42"},
        )
        self.exec_b = TenantWorkFormExecution.objects.create(
            tenant=self.tenant_b,
            workform=self.workform_b,
            started_by=self.user_b,
            status=TenantWorkFormExecutionStatus.IN_PROGRESS,
            initial_data={"entity_type": "supplier", "entity_id": "99"},
        )

        # Workflows for run action tests
        self.workflow_a = TenantWorkflow.objects.create(
            tenant=self.tenant_a,
            name="Workflow A",
            status=WorkflowStatus.ACTIVE,
            trigger_type=TriggerType.MANUAL,
            created_by=self.user_a,
        )

    def _get(self, path: str, tenant, user=None):
        request = self.factory.get(path)
        force_authenticate(request, user=user or self.user_a)
        request.tenant = tenant
        return request

    def _post(self, path: str, tenant, user=None, data=None):
        request = self.factory.post(path, data=data or {}, format="json")
        force_authenticate(request, user=user or self.user_a)
        request.tenant = tenant
        return request

    def _items(self, response):
        data = response.data
        if isinstance(data, dict) and "results" in data:
            return data["results"]
        return data

    # --- List isolation ---

    def test_execution_list_returns_only_own_tenant(self):
        """User in Tenant A sees only Tenant A executions."""
        view = TenantWorkFormExecutionViewSet.as_view({"get": "list"})
        resp = view(self._get("/api/v1/workforms/executions/", self.tenant_a))
        self.assertEqual(resp.status_code, 200)
        items = self._items(resp)
        ids = {str(row["id"]) for row in items}
        self.assertIn(str(self.exec_a.id), ids)
        self.assertNotIn(str(self.exec_b.id), ids)

    def test_execution_list_cross_tenant_gets_empty(self):
        """User A with Tenant B context cannot see Tenant A's executions."""
        view = TenantWorkFormExecutionViewSet.as_view({"get": "list"})
        resp = view(self._get("/api/v1/workforms/executions/", self.tenant_b, user=self.user_a))
        self.assertEqual(resp.status_code, 200)
        items = self._items(resp)
        # user_a is not in tenant_b, so should see nothing (or only tenant_b data)
        ids = {str(row["id"]) for row in items}
        self.assertNotIn(str(self.exec_a.id), ids)

    def test_execution_list_no_tenant_fails_closed(self):
        """Missing tenant context returns empty results."""
        view = TenantWorkFormExecutionViewSet.as_view({"get": "list"})
        resp = view(self._get("/api/v1/workforms/executions/", None))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(self._items(resp)), 0)

    # --- Detail isolation ---

    def test_execution_detail_cross_tenant_returns_404(self):
        """Requesting Tenant B's execution with Tenant A context returns 404."""
        view = TenantWorkFormExecutionViewSet.as_view({"get": "retrieve"})
        resp = view(
            self._get(f"/api/v1/workforms/executions/{self.exec_b.id}/", self.tenant_a),
            pk=str(self.exec_b.id),
        )
        self.assertEqual(resp.status_code, 404)

    def test_execution_detail_no_tenant_returns_404(self):
        """Requesting execution without tenant context returns 404."""
        view = TenantWorkFormExecutionViewSet.as_view({"get": "retrieve"})
        resp = view(
            self._get(f"/api/v1/workforms/executions/{self.exec_a.id}/", None),
            pk=str(self.exec_a.id),
        )
        self.assertEqual(resp.status_code, 404)

    def test_execution_detail_own_tenant_succeeds(self):
        """Requesting own tenant's execution returns 200."""
        view = TenantWorkFormExecutionViewSet.as_view({"get": "retrieve"})
        resp = view(
            self._get(f"/api/v1/workforms/executions/{self.exec_a.id}/", self.tenant_a),
            pk=str(self.exec_a.id),
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(str(resp.data["id"]), str(self.exec_a.id))

    # --- Run action isolation ---

    def test_workflow_run_cross_tenant_returns_404(self):
        """Running Tenant A's workflow with Tenant B context returns 404."""
        view = TenantWorkflowViewSet.as_view({"post": "run"})
        resp = view(
            self._post(f"/api/v1/workflows/{self.workflow_a.id}/run/", self.tenant_b, user=self.user_b),
            pk=str(self.workflow_a.id),
        )
        self.assertEqual(resp.status_code, 404)

    def test_workflow_run_no_tenant_returns_404(self):
        """Running workflow without tenant context returns 404."""
        view = TenantWorkflowViewSet.as_view({"post": "run"})
        resp = view(
            self._post(f"/api/v1/workflows/{self.workflow_a.id}/run/", None),
            pk=str(self.workflow_a.id),
        )
        self.assertEqual(resp.status_code, 404)

    # --- started_by filter cannot enumerate other tenant's users ---

    def test_started_by_filter_does_not_leak_cross_tenant(self):
        """started_by=<user_b_id> with Tenant A context returns empty (no user enumeration)."""
        view = TenantWorkFormExecutionViewSet.as_view({"get": "list"})
        resp = view(
            self._get(
                f"/api/v1/workforms/executions/?started_by={self.user_b.id}",
                self.tenant_a,
            ),
        )
        self.assertEqual(resp.status_code, 200)
        # Should return empty — user_a is admin in tenant_a but user_b's id maps to
        # no executions in tenant_a
        self.assertEqual(len(self._items(resp)), 0)
