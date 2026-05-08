"""Regression tests for WorkForm container methods.

These APIs back the "Container Version" / container browsing endpoints.
They must work for both legacy containerNodeId wiring and modern React Flow
sub-flow grouping (parentId/parentNode).
"""

from django.test import TestCase

from apps.system.models import TenantWorkForm
from apps.tenants.models import Tenant


class TenantWorkFormContainerMethodsTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name="Test Tenant", slug="test-tenant")

    def test_get_container_nodes_includes_form_process_group(self):
        workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name="WF",
            workflow_definition={
                "nodes": [
                    {"id": "c1", "type": "formProcessGroup", "data": {"containerName": "Group"}},
                    {"id": "s1", "type": "form", "parentId": "c1", "data": {"label": "Step 1"}},
                ],
                "edges": [],
            },
        )

        containers = workform.get_container_nodes()
        self.assertEqual(len(containers), 1)
        self.assertEqual(containers[0]["id"], "c1")
        self.assertEqual(containers[0]["type"], "formProcessGroup")

    def test_get_nodes_in_container_supports_parent_id(self):
        workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name="WF",
            workflow_definition={
                "nodes": [
                    {"id": "c1", "type": "formProcessGroup", "data": {"containerName": "Group"}},
                    {"id": "s1", "type": "form", "parentId": "c1", "data": {"label": "Step 1"}},
                    {"id": "s2", "type": "action", "parentId": "c1", "data": {"label": "Action"}},
                    {"id": "outside", "type": "form", "data": {"label": "Outside"}},
                ],
                "edges": [],
            },
        )

        children = workform.get_nodes_in_container("c1")
        child_ids = {n["id"] for n in children}
        self.assertEqual(child_ids, {"s1", "s2"})

    def test_get_nodes_in_container_supports_legacy_container_node_id(self):
        workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name="WF",
            workflow_definition={
                "nodes": [
                    {"id": "c1", "type": "formMultiStepContainer", "data": {"label": "Legacy Container"}},
                    {"id": "s1", "type": "formStep", "data": {"containerNodeId": "c1", "tenantFormId": None}},
                    {"id": "outside", "type": "formStep", "data": {}},
                ],
                "edges": [],
            },
        )

        children = workform.get_nodes_in_container("c1")
        self.assertEqual([n["id"] for n in children], ["s1"])

    def test_get_container_summary_prefers_container_name(self):
        workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name="WF",
            workflow_definition={
                "nodes": [
                    {"id": "c1", "type": "formProcessGroup", "data": {"containerName": "Onboarding"}},
                    {
                        "id": "s1",
                        "type": "form",
                        "parentId": "c1",
                        "data": {"label": "Step 1", "tenantFormId": "00000000-0000-0000-0000-000000000001"},
                    },
                ],
                "edges": [],
            },
        )

        summary = workform.get_container_summary("c1")
        self.assertEqual(summary["container_name"], "Onboarding")
        self.assertEqual(summary["total_nodes"], 1)
        self.assertEqual(summary["node_types"]["form"], 1)
        self.assertEqual(summary["form_references"], ["00000000-0000-0000-0000-000000000001"])
