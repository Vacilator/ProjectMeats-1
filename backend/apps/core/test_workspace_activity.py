from __future__ import annotations

import uuid
from datetime import timedelta

from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from tenant_apps.ai_assistant.models import AILineageEvent
from tenant_apps.cockpit.models import ActivityLog
from tenant_apps.suppliers.models import Supplier
from tenant_apps.workflows.models import ExecutionEventLog, TenantWorkFormExecution

from apps.core.models import TenantAuditEvent
from apps.system.models import TenantWorkForm
from apps.tenants.models import Tenant, TenantUser


@override_settings(ALLOWED_HOSTS=["testserver", "localhost"])
class WorkspaceActivityViewTests(APITestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(
            username=f"activity-{unique}",
            email=f"activity-{unique}@example.com",
            password="pw123456",
            first_name="Ava",
            last_name="Reviewer",
        )
        self.tenant = Tenant.objects.create(
            name=f"Activity Tenant {unique}",
            slug=f"activity-tenant-{unique}",
            contact_email=f"tenant-{unique}@example.com",
            created_by=self.user,
        )
        TenantUser.objects.create(tenant=self.tenant, user=self.user, role="owner", is_active=True)
        self.client.force_login(self.user)

        self.supplier = Supplier.objects.create(tenant=self.tenant, name="North Packing")
        self.other_supplier = Supplier.objects.create(tenant=self.tenant, name="South Packing")

        self.note = ActivityLog.objects.create(
            tenant=self.tenant,
            entity_type="supplier",
            entity_id=self.supplier.id,
            title="Buyer note",
            content="Called the supplier to confirm pack dates.",
            created_by=self.user,
        )

        supplier_content_type = ContentType.objects.get_for_model(Supplier)
        self.audit_event = TenantAuditEvent.objects.create(
            tenant=self.tenant,
            content_type=supplier_content_type,
            object_id=str(self.supplier.id),
            entity_type="Supplier",
            entity_name=self.supplier.name,
            action=TenantAuditEvent.Action.UPDATE,
            changed_fields={"name": {"before": "North", "after": "North Packing"}},
            actor=self.user,
            actor_email=self.user.email,
        )

        self.ai_event = AILineageEvent.objects.create(
            tenant=self.tenant,
            event_type="email_review_draft_created",
            source_type="email_log",
            source_id="email-1",
            target_type="supplier",
            target_id=str(self.supplier.id),
            summary="Created AI review draft for a supplier PO email.",
            metadata={
                "subject": "PO-001 pending review",
                "sender_email": "buyer@example.com",
                "category": "purchase_order",
            },
        )

        definition = {
            "nodes": [
                {"id": "n1", "type": "actionEmail", "data": {"label": "Send Email"}},
            ],
            "edges": [],
        }
        self.workform = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name="Email Approval",
            workflow_definition=definition,
            status="active",
            created_by=self.user,
            updated_by=self.user,
        )
        self.execution = TenantWorkFormExecution.objects.create(
            tenant=self.tenant,
            workform=self.workform,
            status="completed",
            initial_data={
                "entity_type": "supplier",
                "entity_id": str(self.supplier.id),
            },
            started_by=self.user,
            started_at=timezone.now() - timedelta(minutes=2),
            completed_at=timezone.now() - timedelta(minutes=1),
        )
        self.workflow_event = ExecutionEventLog.objects.create(
            tenant=self.tenant,
            workform=self.workform,
            workform_execution=self.execution,
            sequence=1,
            event_type="action_success",
            status="success",
            node_id="n1",
            node_type="actionEmail",
            started_at=timezone.now() - timedelta(minutes=2),
            completed_at=timezone.now() - timedelta(minutes=1, seconds=30),
            duration_ms=30000,
            payload={"node_label": "Send Email"},
        )

    def test_workspace_activity_aggregates_multiple_sources(self):
        response = self.client.get(
            "/api/v1/workspace/activity/recent/",
            {"limit": 10},
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        sources = {item["source"] for item in response.data["results"]}
        self.assertTrue({"audit", "ai", "workflow", "note"}.issubset(sources))

        workflow_item = next(item for item in response.data["results"] if item["source"] == "workflow")
        self.assertEqual(workflow_item["entity_type"], "supplier")
        self.assertEqual(workflow_item["entity_id"], str(self.supplier.id))
        self.assertEqual(workflow_item["metadata"]["workform_execution_id"], str(self.execution.id))

    def test_workspace_activity_filters_by_entity_source_and_date(self):
        old_note = ActivityLog.objects.create(
            tenant=self.tenant,
            entity_type="supplier",
            entity_id=self.other_supplier.id,
            title="Old note",
            content="Too old for the filtered feed.",
            created_by=self.user,
        )
        ActivityLog.objects.filter(pk=old_note.pk).update(created_on=timezone.now() - timedelta(days=14))

        response = self.client.get(
            "/api/v1/workspace/activity/recent/",
            {
                "limit": 10,
                "entity_type": "supplier",
                "entity_id": str(self.supplier.id),
                "sources": "note,ai",
                "start_date": timezone.localdate().isoformat(),
            },
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual({item["source"] for item in response.data["results"]}, {"note", "ai"})
        self.assertTrue(all(item["entity_id"] == str(self.supplier.id) for item in response.data["results"]))

    def test_workspace_activity_filters_workform_execution_scope(self):
        response = self.client.get(
            "/api/v1/workspace/activity/recent/",
            {
                "entity_type": "workform_execution",
                "entity_id": str(self.execution.id),
                "sources": "workflow",
            },
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["entity_id"], str(self.execution.id))

    def test_workspace_activity_includes_workflow_when_entity_matches_execution_context(self):
        response = self.client.get(
            "/api/v1/workspace/activity/recent/",
            {
                "entity_type": "supplier",
                "entity_id": str(self.supplier.id),
                "sources": "workflow",
            },
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["source"], "workflow")
        self.assertEqual(response.data["results"][0]["entity_type"], "supplier")
