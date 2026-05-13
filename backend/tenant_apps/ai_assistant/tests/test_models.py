"""Tests for AI Assistant app models.

Uses shared-schema multi-tenancy with tenant ForeignKey isolation.

Note: The test settings (`projectmeats.settings.test`) may exclude `tenant_apps.ai_assistant`
(e.g. when optional Postgres extensions aren't available). In that case, skip this module's tests.
"""

import unittest
import json
import uuid
from datetime import timedelta
from unittest.mock import patch
from django.test import override_settings

from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from django.db import connection
from django.test import TestCase
from rest_framework.response import Response

if 'tenant_apps.ai_assistant' not in settings.INSTALLED_APPS:
    raise unittest.SkipTest('tenant_apps.ai_assistant is excluded from INSTALLED_APPS in test settings')

from tenant_apps.ai_assistant.models import (
    AIApproval,
    AIApprovalStatus,
    AIConfiguration,
    AILineageEvent,
    AIFeedbackLog,
    AIRun,
    AIRunStatus,
    AITask,
    AITaskStatus,
    ChatMessage,
    ChatSession,
    ChatSessionStatusChoices,
    CommunicationLog,
    MessageTypeChoices,
)
from tenant_apps.ai_assistant.session_utils import bind_context_to_tenant
from apps.tenants.models import Tenant, TenantUser


class ChatSessionModelTest(TestCase):
    """Test cases for ChatSession model."""

    @classmethod
    def setUpTestData(cls):
        """Set up test data shared across all tests."""
        unique_id = uuid.uuid4().hex[:8]
        cls.user = User.objects.create_user(
            username=f"testuser-{unique_id}",
            email=f"test-{unique_id}@example.com",
            password="testpass123"
        )
        cls.tenant = Tenant.objects.create(
            name=f"Test Company {unique_id}",
            slug=f"test-company-{unique_id}",
            contact_email=f"admin-{unique_id}@testcompany.com",
            created_by=cls.user,
        )
        TenantUser.objects.create(tenant=cls.tenant, user=cls.user, role="owner")

    def test_create_chat_session(self):
        """Test creating a chat session."""
        session = ChatSession.objects.create(
            title="Test Session",
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
            session_status=ChatSessionStatusChoices.ACTIVE,
        )
        
        self.assertIsNotNone(session.id)
        self.assertEqual(session.title, "Test Session")
        self.assertEqual(session.session_status, "active")
        self.assertEqual(session.owner, self.user)

    def test_chat_session_uuid_id(self):
        """Test that chat sessions have UUID primary keys."""
        session = ChatSession.objects.create(
            title="UUID Test",
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
        )
        
        self.assertIsInstance(session.id, uuid.UUID)

    def test_chat_session_status_choices(self):
        """Test different session statuses."""
        for status in [ChatSessionStatusChoices.ACTIVE, ChatSessionStatusChoices.COMPLETED]:
            session = ChatSession.objects.create(
                title=f"Status {status}",
                owner=self.user,
                created_by=self.user,
                modified_by=self.user,
                session_status=status,
            )
            self.assertEqual(session.session_status, status)

    def test_chat_session_context_data(self):
        """Test storing context data in JSON field."""
        context = {
            "entity_type": "supplier",
            "entity_id": 123,
            "topic": "pricing inquiry"
        }
        session = ChatSession.objects.create(
            title="With Context",
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
            context_data=context,
        )
        
        self.assertEqual(session.context_data, context)
        self.assertEqual(session.context_data["entity_type"], "supplier")

    def test_chat_session_str_with_title(self):
        """Test string representation with title."""
        session = ChatSession.objects.create(
            title="My Chat",
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
        )
        
        self.assertIn("My Chat", str(session))

    def test_chat_session_str_without_title(self):
        """Test string representation without title."""
        session = ChatSession.objects.create(
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
        )
        
        self.assertIn("Session", str(session))
        self.assertIn(session.id.hex[:8], str(session))


class ChatMessageModelTest(TestCase):
    """Test cases for ChatMessage model."""

    @classmethod
    def setUpTestData(cls):
        """Set up test data shared across all tests."""
        unique_id = uuid.uuid4().hex[:8]
        cls.user = User.objects.create_user(
            username=f"testuser-{unique_id}",
            email=f"test-{unique_id}@example.com",
            password="testpass123"
        )
        cls.tenant = Tenant.objects.create(
            name=f"Test Company {unique_id}",
            slug=f"test-company-{unique_id}",
            contact_email=f"admin-{unique_id}@testcompany.com",
            created_by=cls.user,
        )
        TenantUser.objects.create(tenant=cls.tenant, user=cls.user, role="owner")
        
        cls.session = ChatSession.objects.create(
            title="Test Session",
            owner=cls.user,
            created_by=cls.user,
            modified_by=cls.user,
        )

    def test_create_user_message(self):
        """Test creating a user message."""
        message = ChatMessage.objects.create(
            session=self.session,
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
            message_type=MessageTypeChoices.USER,
            content="What suppliers have beef ribeye?",
        )
        
        self.assertIsNotNone(message.id)
        self.assertEqual(message.message_type, "user")
        self.assertIn("ribeye", message.content)

    def test_create_assistant_message(self):
        """Test creating an assistant message."""
        message = ChatMessage.objects.create(
            session=self.session,
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
            message_type=MessageTypeChoices.ASSISTANT,
            content="I found 3 suppliers with beef ribeye in stock.",
        )
        
        self.assertEqual(message.message_type, "assistant")

    def test_message_metadata(self):
        """Test storing metadata on messages."""
        metadata = {
            "model": "gpt-4o-mini",
            "tokens_used": 150,
            "processing_time": 1.2
        }
        message = ChatMessage.objects.create(
            session=self.session,
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
            message_type=MessageTypeChoices.ASSISTANT,
            content="Response",
            metadata=metadata,
        )
        
        self.assertEqual(message.metadata["model"], "gpt-4o-mini")
        self.assertEqual(message.metadata["tokens_used"], 150)

    def test_message_str_truncates_long_content(self):
        """Test that string representation truncates long content."""
        long_content = "A" * 100
        message = ChatMessage.objects.create(
            session=self.session,
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
            message_type=MessageTypeChoices.USER,
            content=long_content,
        )
        
        str_repr = str(message)
        self.assertIn("...", str_repr)
        self.assertTrue(len(str_repr) < len(long_content))


class AIConfigurationModelTest(TestCase):
    """Test cases for AIConfiguration model."""

    @classmethod
    def setUpTestData(cls):
        """Set up test data shared across all tests."""
        unique_id = uuid.uuid4().hex[:8]
        cls.user = User.objects.create_user(
            username=f"testuser-{unique_id}",
            email=f"test-{unique_id}@example.com",
            password="testpass123"
        )
        cls.tenant = Tenant.objects.create(
            name=f"Test Company {unique_id}",
            slug=f"test-company-{unique_id}",
            contact_email=f"admin-{unique_id}@testcompany.com",
            created_by=cls.user,
        )
        TenantUser.objects.create(tenant=cls.tenant, user=cls.user, role="owner")

    def test_create_ai_configuration(self):
        """Test creating an AI configuration."""
        unique_id = uuid.uuid4().hex[:8]
        config = AIConfiguration.objects.create(
            name=f"Default Config {unique_id}",
            provider="openai",
            model_name="gpt-4o-mini",
            is_active=True,
            is_default=True,
            tenant=self.tenant,
        )
        
        self.assertEqual(config.provider, "openai")
        self.assertEqual(config.model_name, "gpt-4o-mini")
        self.assertTrue(config.is_active)
        self.assertTrue(config.is_default)

    def test_ai_configuration_tenant_isolation(self):
        """Test that AI configurations are isolated by tenant."""
        unique_id = uuid.uuid4().hex[:8]
        
        # Create config for first tenant
        config1 = AIConfiguration.objects.create(
            name=f"Config 1 {unique_id}",
            tenant=self.tenant,
        )
        
        # Create second tenant
        other_user = User.objects.create_user(
            username=f"otheruser-{unique_id}",
            email=f"other-{unique_id}@example.com",
            password="testpass123"
        )
        other_tenant = Tenant.objects.create(
            name=f"Other Company {unique_id}",
            slug=f"other-company-{unique_id}",
            contact_email=f"admin-{unique_id}@othercompany.com",
            created_by=other_user,
        )
        
        # Create config for second tenant
        config2 = AIConfiguration.objects.create(
            name=f"Config 2 {unique_id}",
            tenant=other_tenant,
        )
        
        # Verify isolation
        tenant1_configs = AIConfiguration.objects.for_tenant(self.tenant)
        self.assertIn(config1, tenant1_configs)
        self.assertNotIn(config2, tenant1_configs)

    def test_ai_configuration_str_representation(self):
        """Test string representation of AI configuration."""
        unique_id = uuid.uuid4().hex[:8]
        config = AIConfiguration.objects.create(
            name=f"Test Config {unique_id}",
            provider="anthropic",
            model_name="claude-3",
            tenant=self.tenant,
        )
        
        str_repr = str(config)
        self.assertIn("anthropic", str_repr)
        self.assertIn("claude-3", str_repr)


class SwarmToolNotificationTest(TestCase):
    """Tests for Swarm tool-side notifications (create_in_app_notification)."""

    @classmethod
    def setUpTestData(cls):
        unique_id = uuid.uuid4().hex[:8]
        cls.owner = User.objects.create_user(
            username=f"owner-{unique_id}",
            email=f"owner-{unique_id}@example.com",
            password="testpass123",
        )
        cls.other_user = User.objects.create_user(
            username=f"user-{unique_id}",
            email=f"user-{unique_id}@example.com",
            password="testpass123",
        )
        cls.tenant = Tenant.objects.create(
            name=f"Notif Company {unique_id}",
            slug=f"notif-company-{unique_id}",
            contact_email=f"admin-{unique_id}@notifcompany.com",
            created_by=cls.owner,
        )
        TenantUser.objects.create(tenant=cls.tenant, user=cls.owner, role="owner")
        TenantUser.objects.create(tenant=cls.tenant, user=cls.other_user, role="user")

    def test_owner_can_notify_other_user(self):
        from tenant_apps.ai_assistant.swarm.executor import ToolExecutor
        from tenant_apps.workflows.models import UserNotification

        ex = ToolExecutor()
        result = ex._create_in_app_notification(
            {
                "title": "Heads up",
                "message": "Please review the PO.",
                "username": self.other_user.username,
                "notification_type": "system",
                "priority": "high",
            },
            tenant=self.tenant,
            user=self.owner,
        )

        self.assertEqual(result["count"], 1)
        self.assertIn(self.other_user.username, result["notified_usernames"])
        self.assertEqual(UserNotification.objects.filter(user=self.other_user, tenant=self.tenant).count(), 1)

    def test_non_admin_cannot_notify_other_user(self):
        from tenant_apps.ai_assistant.swarm.executor import ToolExecutor

        ex = ToolExecutor()
        with self.assertRaises(ValueError):
            ex._create_in_app_notification(
                {
                    "title": "Heads up",
                    "message": "Please review the PO.",
                    "username": self.owner.username,
                },
                tenant=self.tenant,
                user=self.other_user,
            )

    def test_to_tenant_admins_targets_owner(self):
        from tenant_apps.ai_assistant.swarm.executor import ToolExecutor
        from tenant_apps.workflows.models import UserNotification

        ex = ToolExecutor()
        result = ex._create_in_app_notification(
            {
                "title": "System maintenance",
                "message": "Tonight at 10pm.",
                "to_tenant_admins": True,
            },
            tenant=self.tenant,
            user=self.owner,
        )

        self.assertGreaterEqual(result["count"], 1)
        self.assertIn(self.owner.username, result["notified_usernames"])
        self.assertEqual(UserNotification.objects.filter(user=self.owner, tenant=self.tenant).count(), 1)


class SwarmWorkformAndCommsToolsTest(TestCase):
    """Smoke tests for WorkForm execution + comms draft tools."""

    @classmethod
    def setUpTestData(cls):
        unique_id = uuid.uuid4().hex[:8]
        cls.owner = User.objects.create_user(
            username=f"owner2-{unique_id}",
            email=f"owner2-{unique_id}@example.com",
            password="testpass123",
        )
        cls.tenant = Tenant.objects.create(
            name=f"Tools Company {unique_id}",
            slug=f"tools-company-{unique_id}",
            contact_email=f"admin-{unique_id}@toolscompany.com",
            created_by=cls.owner,
        )
        TenantUser.objects.create(tenant=cls.tenant, user=cls.owner, role="owner")

    def test_trigger_workform_creates_execution(self):
        from apps.system.models import TenantWorkForm
        from tenant_apps.ai_assistant.swarm.executor import ToolExecutor
        from tenant_apps.workflows.models import TenantWorkFormExecution

        wf = TenantWorkForm.objects.create(
            tenant=self.tenant,
            name="Test WF",
            status="draft",
            workflow_definition={
                "nodes": [
                    {"id": "n1", "type": "triggerManual", "data": {"label": "Start"}, "position": {"x": 0, "y": 0}},
                ],
                "edges": [],
            },
        )

        ex = ToolExecutor()
        result = ex._trigger_workform({"workflow_id": str(wf.id), "initial_data": {"hello": "world"}}, tenant=self.tenant, user=self.owner)

        self.assertIn("execution_id", result)
        self.assertEqual(result["status"], "completed")
        self.assertEqual(TenantWorkFormExecution.objects.filter(tenant=self.tenant, workform=wf).count(), 1)

    def test_draft_vendor_email_persists_draft(self):
        from tenant_apps.ai_assistant.swarm.executor import ToolExecutor
        from tenant_apps.ai_assistant.models import CommunicationLog, CommunicationStatus
        from tenant_apps.suppliers.models import Supplier

        supplier = Supplier.objects.create(tenant=self.tenant, name="ACME", email="acme@example.com")

        ex = ToolExecutor()
        result = ex._draft_vendor_email(
            {"vendor_id": str(supplier.id), "context": "Invoice mismatch: PO price differs."},
            tenant=self.tenant,
            user=self.owner,
        )

        self.assertIn("id", result)
        row = CommunicationLog.objects.get(id=result["id"])
        self.assertEqual(row.tenant, self.tenant)
        self.assertEqual(row.status, CommunicationStatus.DRAFT)
        self.assertEqual(row.to_email, "acme@example.com")


class AIDocumentViewSetTenantScopingTests(TestCase):
    def setUp(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from rest_framework.test import APIRequestFactory, force_authenticate

        from tenant_apps.ai_assistant.models import AIDocument

        unique = uuid.uuid4().hex[:8]
        self.factory = APIRequestFactory()
        self._force_authenticate = force_authenticate

        self.user = User.objects.create_user(username=f"aidoc-{unique}", password="pw")

        self.tenant_a = Tenant.objects.create(
            name=f"Tenant A {unique}",
            slug=f"tenant-a-{unique}",
            contact_email=f"a-{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )
        self.tenant_b = Tenant.objects.create(
            name=f"Tenant B {unique}",
            slug=f"tenant-b-{unique}",
            contact_email=f"b-{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )

        TenantUser.objects.create(tenant=self.tenant_a, user=self.user, role="admin", is_active=True)
        TenantUser.objects.create(tenant=self.tenant_b, user=self.user, role="admin", is_active=True)

        file_a = SimpleUploadedFile("a.txt", b"hello a", content_type="text/plain")
        file_b = SimpleUploadedFile("b.txt", b"hello b", content_type="text/plain")

        self.document_a = AIDocument.objects.create(
            tenant=self.tenant_a,
            owner=self.user,
            file=file_a,
            original_filename="a.txt",
        )
        self.document_b = AIDocument.objects.create(
            tenant=self.tenant_b,
            owner=self.user,
            file=file_b,
            original_filename="b.txt",
        )

    def _get(self, tenant):
        request = self.factory.get("/api/v1/ai-assistant/documents/")
        self._force_authenticate(request, user=self.user)
        request.tenant = tenant
        return request

    def _items(self, response):
        data = response.data
        if isinstance(data, dict) and "results" in data:
            return data["results"]
        return data

    def _retrieve(self, tenant, document_id):
        request = self.factory.get(f"/api/v1/ai-assistant/documents/{document_id}/")
        self._force_authenticate(request, user=self.user)
        request.tenant = tenant
        return request

    def test_documents_are_scoped_and_fail_closed(self):
        from tenant_apps.ai_assistant.views import AIDocumentViewSet

        resp = AIDocumentViewSet.as_view({"get": "list"})(self._get(self.tenant_a))
        self.assertEqual(resp.status_code, 200)
        joined = str(self._items(resp))
        self.assertIn("a.txt", joined)
        self.assertNotIn("b.txt", joined)

        resp2 = AIDocumentViewSet.as_view({"get": "list"})(self._get(None))
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(len(self._items(resp2)), 0)

    def test_document_detail_includes_lineage_summary_for_active_tenant(self):
        from tenant_apps.ai_assistant.views import AIDocumentViewSet

        AILineageEvent.objects.create(
            tenant=self.tenant_a,
            document=self.document_a,
            event_type='document_ingested',
            source_type='upload',
            target_type='document',
            summary='Document uploaded into the AI assistant.',
        )
        AILineageEvent.objects.create(
            tenant=self.tenant_a,
            document=self.document_a,
            event_type='document_parsed',
            source_type='document',
            target_type='parsed_document',
            summary='Document parsed successfully.',
        )
        AILineageEvent.objects.create(
            tenant=self.tenant_b,
            document=self.document_b,
            event_type='document_ingested',
            source_type='upload',
            target_type='document',
            summary='Foreign tenant lineage event.',
        )

        response = AIDocumentViewSet.as_view({"get": "retrieve"})(
            self._retrieve(self.tenant_a, self.document_a.id),
            pk=str(self.document_a.id),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['original_filename'], 'a.txt')
        self.assertEqual(response.data['lineage_summary']['event_count'], 2)
        self.assertEqual(response.data['lineage_summary']['latest_event_type'], 'document_parsed')
        self.assertEqual(
            response.data['lineage_summary']['latest_summary'],
            'Document parsed successfully.',
        )
        self.assertEqual(len(response.data['lineage_summary']['recent_events']), 2)

    def test_feedback_backed_document_detail_returns_placeholder_payload(self):
        from tenant_apps.ai_assistant.views import AIDocumentViewSet

        missing_document_id = uuid.uuid4()
        AIFeedbackLog.objects.create(
            tenant=self.tenant_a,
            document_id=missing_document_id,
            document_type='purchase_order',
            original_extracted_data={
                'document_name': 'Document processing...',
                'source': 'microsoft_graph_attachment',
            },
            confidence_score=0.71,
        )

        response = AIDocumentViewSet.as_view({"get": "retrieve"})(
            self._retrieve(self.tenant_a, missing_document_id),
            pk=str(missing_document_id),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], str(missing_document_id))
        self.assertEqual(response.data['original_filename'], 'Document processing...')
        self.assertEqual(response.data['document_type'], 'purchase_order')
        self.assertEqual(response.data['processing_status'], 'processing')
        self.assertEqual(response.data['source_metadata']['source'], 'microsoft_graph_attachment')
        self.assertEqual(response.data['lineage_summary']['latest_event_type'], 'feedback_pending')

class ChatSessionTenantBindingTests(TestCase):
    def setUp(self):
        from rest_framework.test import APIRequestFactory, force_authenticate

        unique = uuid.uuid4().hex[:8]
        self.factory = APIRequestFactory()
        self._force_authenticate = force_authenticate

        self.user = User.objects.create_user(username=f"chatbind-{unique}", password="pw")
        self.tenant_a = Tenant.objects.create(
            name=f"Chat Tenant A {unique}",
            slug=f"chat-tenant-a-{unique}",
            contact_email=f"a-{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )
        self.tenant_b = Tenant.objects.create(
            name=f"Chat Tenant B {unique}",
            slug=f"chat-tenant-b-{unique}",
            contact_email=f"b-{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )

        TenantUser.objects.create(tenant=self.tenant_a, user=self.user, role="admin", is_active=True)
        TenantUser.objects.create(tenant=self.tenant_b, user=self.user, role="admin", is_active=True)

        self.session_a = ChatSession.objects.create(
            title="Tenant A Session",
            tenant=self.tenant_a,
            context_data={"tenant_id": str(self.tenant_a.id)},
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
        )
        self.session_b = ChatSession.objects.create(
            title="Tenant B Session",
            tenant=self.tenant_b,
            context_data={"tenant_id": str(self.tenant_b.id)},
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
        )
        self.session_fk_drift = ChatSession.objects.create(
            title="Tenant A FK Drift Session",
            tenant=self.tenant_a,
            context_data={"tenant_id": str(self.tenant_b.id)},
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
        )
        self.session_unbound = ChatSession.objects.create(
            title="Legacy Context Session",
            context_data={"tenant_id": str(self.tenant_a.id)},
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
        )

        ChatMessage.objects.create(
            session=self.session_a,
            tenant=self.tenant_a,
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
            message_type=MessageTypeChoices.USER,
            content="tenant-a",
        )
        ChatMessage.objects.create(
            session=self.session_b,
            tenant=self.tenant_b,
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
            message_type=MessageTypeChoices.USER,
            content="tenant-b",
        )
        ChatMessage.objects.create(
            session=self.session_fk_drift,
            tenant=self.tenant_a,
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
            message_type=MessageTypeChoices.USER,
            content="tenant-a-fk-drift",
        )
        ChatMessage.objects.create(
            session=self.session_unbound,
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
            message_type=MessageTypeChoices.USER,
            content="legacy",
        )

    def _request(self, method: str, path: str, tenant, data=None, format='json'):
        request_factory = getattr(self.factory, method.lower())
        request = request_factory(path, data or {}, format=format)
        self._force_authenticate(request, user=self.user)
        request.tenant = tenant
        return request

    def _items(self, response):
        data = response.data
        if isinstance(data, dict) and "results" in data:
            return data["results"]
        return data

    def test_chat_sessions_are_tenant_scoped_and_fail_closed(self):
        from tenant_apps.ai_assistant.views import ChatSessionViewSet

        response = ChatSessionViewSet.as_view({"get": "list"})(
            self._request("get", "/api/v1/ai-assistant/sessions/", self.tenant_a)
        )
        self.assertEqual(response.status_code, 200)
        titles = str(self._items(response))
        self.assertIn("Tenant A Session", titles)
        self.assertIn("Tenant A FK Drift Session", titles)
        self.assertNotIn("Tenant B Session", titles)
        self.assertNotIn("Legacy Context Session", titles)

        closed = ChatSessionViewSet.as_view({"get": "list"})(
            self._request("get", "/api/v1/ai-assistant/sessions/", None)
        )
        self.assertEqual(closed.status_code, 200)
        self.assertEqual(len(self._items(closed)), 0)

    def test_chat_session_create_stamps_request_tenant_id(self):
        from tenant_apps.ai_assistant.views import ChatSessionViewSet

        response = ChatSessionViewSet.as_view({"post": "create"})(
            self._request(
                "post",
                "/api/v1/ai-assistant/sessions/",
                self.tenant_a,
                {
                    "title": "Created Session",
                    "context_data": {
                        "topic": "pricing",
                        "tenant_id": str(self.tenant_b.id),
                    },
                },
            )
        )

        self.assertEqual(response.status_code, 201)
        session = ChatSession.objects.get(id=response.data["id"])
        self.assertEqual(session.tenant_id, self.tenant_a.id)
        self.assertEqual(session.context_data["tenant_id"], str(self.tenant_a.id))
        self.assertEqual(session.context_data["topic"], "pricing")

    def test_chat_messages_are_tenant_scoped(self):
        from tenant_apps.ai_assistant.views import ChatMessageViewSet

        response = ChatMessageViewSet.as_view({"get": "list"})(
            self._request("get", "/api/v1/ai-assistant/messages/", self.tenant_a)
        )

        self.assertEqual(response.status_code, 200)
        payload = str(self._items(response))
        self.assertIn("tenant-a", payload)
        self.assertIn("tenant-a-fk-drift", payload)
        self.assertNotIn("tenant-b", payload)
        self.assertNotIn("legacy", payload)

    def test_chat_message_create_rejects_cross_tenant_session(self):
        from tenant_apps.ai_assistant.views import ChatMessageViewSet

        response = ChatMessageViewSet.as_view({"post": "create"})(
            self._request(
                "post",
                "/api/v1/ai-assistant/messages/",
                self.tenant_a,
                {
                    "session": str(self.session_b.id),
                    "message_type": MessageTypeChoices.USER,
                    "content": "hello",
                },
            )
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["session"][0], "Session not found")

    def test_chat_message_create_stamps_request_tenant(self):
        from tenant_apps.ai_assistant.views import ChatMessageViewSet

        response = ChatMessageViewSet.as_view({"post": "create"})(
            self._request(
                "post",
                "/api/v1/ai-assistant/messages/",
                self.tenant_a,
                {
                    "session": str(self.session_a.id),
                    "message_type": MessageTypeChoices.USER,
                    "content": "tenant-create",
                },
            )
        )

        self.assertEqual(response.status_code, 201)
        message = ChatMessage.objects.get(
            session=self.session_a,
            content="tenant-create",
            message_type=MessageTypeChoices.USER,
        )
        self.assertEqual(message.tenant_id, self.tenant_a.id)

    @patch("tenant_apps.ai_assistant.views.ai_not_configured_response")
    def test_chat_api_rejects_legacy_context_only_session_reuse(self, mock_not_configured):
        from tenant_apps.ai_assistant.views import ChatBotAPIViewSet

        legacy_session = ChatSession.objects.create(
            title="Legacy Tenant A Session",
            context_data={"tenant_id": str(self.tenant_a.id)},
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
        )
        mock_not_configured.return_value = Response(
            {"error": "AI disabled"},
            status=503,
        )

        response = ChatBotAPIViewSet.as_view({"post": "chat"})(
            self._request(
                "post",
                "/api/v1/ai-assistant/chat/chat/",
                self.tenant_a,
                {
                    "message": "hello",
                    "session_id": str(legacy_session.id),
                },
            )
        )

        self.assertEqual(response.status_code, 404)
        legacy_session.refresh_from_db()
        self.assertIsNone(legacy_session.tenant_id)

    @override_settings(OPENAI_API_KEY='test-key', AI_SEMANTIC_CACHE_ENABLED=True)
    @patch("tenant_apps.ai_assistant.views.ai_semantic_cache.lookup_cached_response")
    @patch("tenant_apps.ai_assistant.views.ai_semantic_cache.build_context_signature", return_value="ctx-a")
    @patch("tenant_apps.ai_assistant.views.ai_semantic_cache.store_cached_response")
    @patch("tenant_apps.ai_assistant.swarm.router.SwarmOrchestrator.run_tool_loop")
    def test_chat_api_uses_semantic_cache_hits_without_running_tool_loop(
        self,
        mock_run_tool_loop,
        mock_store_cached_response,
        _mock_signature,
        mock_lookup_cached_response,
    ):
        from tenant_apps.ai_assistant.services.semantic_cache import SemanticCacheHit
        from tenant_apps.ai_assistant.views import ChatBotAPIViewSet

        mock_lookup_cached_response.return_value = SemanticCacheHit(
            entry_id='cache-entry-1',
            response_text='Cached answer',
            similarity=0.991,
            model_name='gpt-4o-mini',
            created_at='2026-05-05T00:00:00+00:00',
        )
        mock_run_tool_loop.side_effect = AssertionError("Tool loop should not execute on cache hit")

        response = ChatBotAPIViewSet.as_view({"post": "chat"})(
            self._request(
                "post",
                "/api/v1/ai-assistant/chat/chat/",
                self.tenant_a,
                {
                    "message": "What is the latest beef market update?",
                    "session_id": str(self.session_a.id),
                },
            )
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["response"], "Cached answer")
        self.assertTrue(response.data["metadata"]["cache_hit"])
        self.assertEqual(response.data["metadata"]["response_type"], "semantic_cache_hit")
        self.assertFalse(mock_store_cached_response.called)
        assistant_message = ChatMessage.objects.filter(
            session=self.session_a,
            message_type=MessageTypeChoices.ASSISTANT,
        ).latest("created_on")
        self.assertEqual(assistant_message.content, "Cached answer")
        self.assertTrue(assistant_message.metadata["cache_hit"])

    @override_settings(
        OPENAI_API_KEY='test-key',
        AI_SEMANTIC_CACHE_ENABLED=False,
        AI_CHAT_COMPACTION_ENABLED=True,
        AI_CHAT_COMPACTION_MIN_MESSAGES=4,
        AI_CHAT_COMPACTION_TAIL_MESSAGES=2,
        AI_CHAT_COMPACTION_MAX_SUMMARY_CHARS=800,
    )
    @patch("tenant_apps.ai_assistant.swarm.router.SwarmOrchestrator.run_tool_loop")
    def test_chat_api_compacts_older_session_messages_into_durable_memory(self, mock_run_tool_loop):
        from tenant_apps.ai_assistant.models import TenantAIMemory
        from tenant_apps.ai_assistant.services.tenant_memory_service import session_memory_key
        from tenant_apps.ai_assistant.views import ChatBotAPIViewSet

        mock_run_tool_loop.return_value = {
            "response": "Latest answer",
            "messages": [{"role": "assistant", "content": "Latest answer"}],
        }

        starting_count = ChatMessage.objects.filter(session=self.session_a).count()
        base_time = timezone.now() - timedelta(minutes=30)
        historical_messages = []
        for index, (message_type, content) in enumerate(
            [
                (MessageTypeChoices.USER, "User asked about plant routing."),
                (MessageTypeChoices.ASSISTANT, "Assistant explained the routing constraints."),
                (MessageTypeChoices.USER, "User added the delivery window."),
                (MessageTypeChoices.ASSISTANT, "Assistant confirmed the updated schedule."),
                (MessageTypeChoices.DOCUMENT, "routing.pdf"),
            ]
        ):
            message = ChatMessage.objects.create(
                session=self.session_a,
                tenant=self.tenant_a,
                owner=self.user,
                created_by=self.user,
                modified_by=self.user,
                message_type=message_type,
                content=content,
                metadata={"original_filename": "routing.pdf"} if message_type == MessageTypeChoices.DOCUMENT else {},
            )
            ChatMessage.objects.filter(id=message.id).update(created_on=base_time + timedelta(minutes=index))
            historical_messages.append(message)

        response = ChatBotAPIViewSet.as_view({"post": "chat"})(
            self._request(
                "post",
                "/api/v1/ai-assistant/chat/chat/",
                self.tenant_a,
                {
                    "message": "Can you continue that routing discussion?",
                    "session_id": str(self.session_a.id),
                },
            )
        )

        self.assertEqual(response.status_code, 200)

        session_memory = TenantAIMemory.objects.get(
            tenant=self.tenant_a,
            key=session_memory_key(self.session_a.id),
        )
        self.assertIn("Compacted", session_memory.memory_text)
        self.assertEqual(session_memory.memory_json["kind"], "session_compaction")
        self.assertEqual(session_memory.memory_json["session_id"], str(self.session_a.id))
        self.assertGreaterEqual(session_memory.memory_json["source_count"], 4)

        self.session_a.refresh_from_db()
        compaction_state = self.session_a.context_data["compaction"]
        self.assertEqual(compaction_state["memory_key"], session_memory.key)
        self.assertGreaterEqual(compaction_state["compacted_count"], 4)
        self.assertEqual(
            ChatMessage.objects.filter(session=self.session_a).count(),
            starting_count + len(historical_messages) + 2,
        )

    @override_settings(
        OPENAI_API_KEY='test-key',
        AI_SEMANTIC_CACHE_ENABLED=False,
        AI_CHAT_COMPACTION_ENABLED=True,
    )
    @patch("tenant_apps.ai_assistant.views.ai_semantic_cache.build_context_signature", return_value="ctx-compaction")
    @patch("tenant_apps.ai_assistant.views.ai_semantic_cache.lookup_cached_response")
    @patch("tenant_apps.ai_assistant.views.ai_semantic_cache.store_cached_response")
    @patch("tenant_apps.ai_assistant.swarm.router.SwarmOrchestrator.run_tool_loop")
    def test_chat_api_only_replays_uncompacted_raw_tail_when_session_memory_exists(
        self,
        mock_run_tool_loop,
        _mock_store,
        mock_lookup_cached_response,
        _mock_signature,
    ):
        from tenant_apps.ai_assistant.models import TenantAIMemory
        from tenant_apps.ai_assistant.services.tenant_memory_service import session_memory_key
        from tenant_apps.ai_assistant.views import ChatBotAPIViewSet

        mock_lookup_cached_response.return_value = None
        _mock_store.return_value = None
        mock_run_tool_loop.return_value = {
            "response": "Tail only answer",
            "messages": [{"role": "assistant", "content": "Tail only answer"}],
        }

        old_message = ChatMessage.objects.create(
            session=self.session_a,
            tenant=self.tenant_a,
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
            message_type=MessageTypeChoices.USER,
            content="Older context that should be compacted away.",
        )
        older_assistant = ChatMessage.objects.create(
            session=self.session_a,
            tenant=self.tenant_a,
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
            message_type=MessageTypeChoices.ASSISTANT,
            content="Older assistant response that should be compacted away.",
        )
        recent_message = ChatMessage.objects.create(
            session=self.session_a,
            tenant=self.tenant_a,
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
            message_type=MessageTypeChoices.USER,
            content="Recent raw tail that should stay in history.",
        )

        base_time = timezone.now() - timedelta(minutes=10)
        ChatMessage.objects.filter(id=old_message.id).update(created_on=base_time)
        ChatMessage.objects.filter(id=older_assistant.id).update(created_on=base_time + timedelta(minutes=1))
        ChatMessage.objects.filter(id=recent_message.id).update(created_on=base_time + timedelta(minutes=2))
        old_message.refresh_from_db()
        older_assistant.refresh_from_db()
        recent_message.refresh_from_db()

        TenantAIMemory.objects.create(
            tenant=self.tenant_a,
            key=session_memory_key(self.session_a.id),
            memory_text="Prior compacted summary",
            memory_json={"kind": "session_compaction", "session_id": str(self.session_a.id)},
        )
        self.session_a.context_data = bind_context_to_tenant(
            {
                "compaction": {
                    "memory_key": session_memory_key(self.session_a.id),
                    "last_compacted_created_on": older_assistant.created_on.isoformat(),
                    "last_compacted_message_id": str(older_assistant.id),
                    "compacted_count": 2,
                }
            },
            self.tenant_a,
        )
        self.session_a.save(update_fields=["context_data"])

        response = ChatBotAPIViewSet.as_view({"post": "chat"})(
            self._request(
                "post",
                "/api/v1/ai-assistant/chat/chat/",
                self.tenant_a,
                {
                    "message": "Continue from the recent tail.",
                    "session_id": str(self.session_a.id),
                },
            )
        )

        self.assertEqual(response.status_code, 200)
        history = mock_run_tool_loop.call_args.kwargs["history"]
        contents = [entry["content"] for entry in history if isinstance(entry, dict)]
        self.assertIn("Recent raw tail that should stay in history.", contents)
        self.assertNotIn("Older context that should be compacted away.", contents)
        self.assertNotIn("Older assistant response that should be compacted away.", contents)


class ChatSessionRlsRegressionTests(TestCase):
    def setUp(self):
        unique = uuid.uuid4().hex[:8]
        self.user = User.objects.create_user(username=f"chat-rls-{unique}", password="pw")
        self.tenant_a = Tenant.objects.create(
            name=f"RLS Tenant A {unique}",
            slug=f"rls-tenant-a-{unique}",
            contact_email=f"rls-a-{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )
        self.tenant_b = Tenant.objects.create(
            name=f"RLS Tenant B {unique}",
            slug=f"rls-tenant-b-{unique}",
            contact_email=f"rls-b-{unique}@example.com",
            is_active=True,
            created_by=self.user,
        )

        self.session_a = ChatSession.objects.create(
            title="RLS Tenant A Session",
            tenant=self.tenant_a,
            context_data={"tenant_id": str(self.tenant_a.id)},
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
        )
        self.session_b = ChatSession.objects.create(
            title="RLS Tenant B Session",
            tenant=self.tenant_b,
            context_data={"tenant_id": str(self.tenant_b.id)},
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
        )
        self.message_a = ChatMessage.objects.create(
            session=self.session_a,
            tenant=self.tenant_a,
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
            message_type=MessageTypeChoices.USER,
            content="tenant-a-visible",
        )
        self.message_b = ChatMessage.objects.create(
            session=self.session_b,
            tenant=self.tenant_b,
            owner=self.user,
            created_by=self.user,
            modified_by=self.user,
            message_type=MessageTypeChoices.USER,
            content="tenant-b-hidden",
        )

    def tearDown(self):
        if getattr(connection, "needs_rollback", False):
            connection.rollback()
        with connection.cursor() as cursor:
            cursor.execute("RESET app.current_tenant_id")
            cursor.execute("RESET app.current_tenant")

    def test_chat_tables_register_forced_tenant_rls_policies(self):
        if connection.vendor != "postgresql":
            self.skipTest("RLS enforcement requires PostgreSQL")

        expected_tables = {
            "ai_assistant_chat_sessions": "ai_assistant_chat_sessions_tenant_isolation",
            "ai_assistant_chat_messages": "ai_assistant_chat_messages_tenant_isolation",
        }

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT relname, relrowsecurity, relforcerowsecurity
                FROM pg_class
                WHERE relname = ANY(%s)
                """,
                [list(expected_tables.keys())],
            )
            relation_rows = {
                row[0]: {"rls_enabled": row[1], "rls_forced": row[2]}
                for row in cursor.fetchall()
            }

            cursor.execute(
                """
                SELECT tablename, policyname, qual, with_check
                FROM pg_policies
                WHERE tablename = ANY(%s)
                """,
                [list(expected_tables.keys())],
            )
            policy_rows = {row[0]: row[1:] for row in cursor.fetchall()}

        for table_name, policy_name in expected_tables.items():
            self.assertIn(table_name, relation_rows)
            self.assertTrue(relation_rows[table_name]["rls_enabled"])
            self.assertTrue(relation_rows[table_name]["rls_forced"])

            self.assertIn(table_name, policy_rows)
            actual_policy_name, qual, with_check = policy_rows[table_name]
            self.assertEqual(actual_policy_name, policy_name)
            self.assertIn("tenant_id =", qual)
            self.assertIn("current_setting('app.current_tenant'", qual)
            self.assertIn("tenant_id =", with_check)
            self.assertIn("current_setting('app.current_tenant'", with_check)


class AIControlPlaneFlowTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        from rest_framework.test import APIRequestFactory, force_authenticate
        from tenant_apps.suppliers.models import Supplier

        unique_id = uuid.uuid4().hex[:8]
        cls.owner = User.objects.create_user(
            username=f"ai-owner-{unique_id}",
            email=f"ai-owner-{unique_id}@example.com",
            password="testpass123",
        )
        cls.requester = User.objects.create_user(
            username=f"ai-requester-{unique_id}",
            email=f"ai-requester-{unique_id}@example.com",
            password="testpass123",
        )
        cls.other_user = User.objects.create_user(
            username=f"ai-other-{unique_id}",
            email=f"ai-other-{unique_id}@example.com",
            password="testpass123",
        )
        cls.tenant_a = Tenant.objects.create(
            name=f"AI Control Plane A {unique_id}",
            slug=f"ai-control-plane-a-{unique_id}",
            contact_email=f"tenant-a-{unique_id}@example.com",
            created_by=cls.owner,
        )
        cls.tenant_b = Tenant.objects.create(
            name=f"AI Control Plane B {unique_id}",
            slug=f"ai-control-plane-b-{unique_id}",
            contact_email=f"tenant-b-{unique_id}@example.com",
            created_by=cls.other_user,
        )
        TenantUser.objects.create(tenant=cls.tenant_a, user=cls.owner, role="owner")
        TenantUser.objects.create(tenant=cls.tenant_a, user=cls.requester, role="user")
        TenantUser.objects.create(tenant=cls.tenant_b, user=cls.other_user, role="owner")

        cls.session = ChatSession.objects.create(
            title="AI Control Plane Session",
            tenant=cls.tenant_a,
            owner=cls.requester,
            created_by=cls.requester,
            modified_by=cls.requester,
            context_data={"tenant_id": str(cls.tenant_a.id)},
        )
        cls.supplier = Supplier.objects.create(
            tenant=cls.tenant_a,
            name=f"Supplier {unique_id}",
            email=f"supplier-{unique_id}@example.com",
        )

        cls.factory = APIRequestFactory()
        cls._force_authenticate = force_authenticate

    def _create_run(self, tenant=None, requested_by=None, user_message='Draft a vendor email'):
        active_tenant = tenant or self.tenant_a
        return AIRun.objects.create(
            tenant=active_tenant,
            session=self.session if active_tenant == self.tenant_a else None,
            requested_by=requested_by or self.requester,
            source='chat',
            event_type='user_chat',
            status=AIRunStatus.RUNNING,
            intent='action_create',
            user_message=user_message,
            request_payload={'message': user_message},
        )

    def _request(self, method: str, path: str, tenant, user=None, data=None):
        request_factory = getattr(self.factory, method.lower())
        request = request_factory(path, data or {}, format='json')
        if user is not None:
            self._force_authenticate(request, user=user)
        request.tenant = tenant
        return request

    def _items(self, response):
        if isinstance(response.data, dict) and 'results' in response.data:
            return response.data['results']
        return response.data

    def test_draft_vendor_email_creates_pending_approval_records(self):
        from tenant_apps.ai_assistant.swarm.executor import ToolExecutor

        run = self._create_run()
        result = ToolExecutor().execute(
            'draft_vendor_email',
            {
                'vendor_id': str(self.supplier.id),
                'vendor_type': 'supplier',
                'context': 'Please confirm tomorrow delivery.',
            },
            tenant=self.tenant_a,
            user=self.requester,
            session_id=str(self.session.id),
            run=run,
        )

        payload = json.loads(result)
        self.assertTrue(payload['data']['approval_required'])

        run.refresh_from_db()
        task = AITask.objects.get(run=run)
        approval = AIApproval.objects.get(task=task)

        self.assertEqual(run.status, AIRunStatus.APPROVAL_REQUIRED)
        self.assertEqual(task.status, AITaskStatus.APPROVAL_REQUIRED)
        self.assertTrue(task.requires_approval)
        self.assertEqual(approval.status, AIApprovalStatus.PENDING)
        self.assertEqual(approval.requested_by, self.requester)

    def test_approval_execute_path_is_idempotent_and_persists_result(self):
        from tenant_apps.ai_assistant.swarm.executor import ToolExecutor
        from tenant_apps.ai_assistant.views import AIApprovalViewSet

        run = self._create_run(user_message='Draft supplier follow-up')
        ToolExecutor().execute(
            'draft_vendor_email',
            {
                'vendor_id': str(self.supplier.id),
                'vendor_type': 'supplier',
                'context': 'Please send updated pricing.',
            },
            tenant=self.tenant_a,
            user=self.requester,
            session_id=str(self.session.id),
            run=run,
        )
        approval = AIApproval.objects.get(run=run)

        response = AIApprovalViewSet.as_view({'post': 'approve'})(
            self._request(
                'post',
                f'/api/v1/ai-assistant/approvals/{approval.id}/approve/',
                tenant=self.tenant_a,
                user=self.owner,
                data={'resolution_note': 'Approved for supplier follow-up.'},
            ),
            pk=str(approval.id),
        )
        self.assertEqual(response.status_code, 200)

        approval.refresh_from_db()
        task = approval.task
        task.refresh_from_db()
        run.refresh_from_db()

        self.assertEqual(approval.status, AIApprovalStatus.APPROVED)
        self.assertEqual(task.status, AITaskStatus.COMPLETED)
        self.assertEqual(run.status, AIRunStatus.COMPLETED)
        self.assertEqual(CommunicationLog.objects.filter(tenant=self.tenant_a).count(), 1)

        second = AIApprovalViewSet.as_view({'post': 'approve'})(
            self._request(
                'post',
                f'/api/v1/ai-assistant/approvals/{approval.id}/approve/',
                tenant=self.tenant_a,
                user=self.owner,
                data={'resolution_note': 'Retry'},
            ),
            pk=str(approval.id),
        )
        self.assertEqual(second.status_code, 409)
        self.assertEqual(CommunicationLog.objects.filter(tenant=self.tenant_a).count(), 1)

    def test_approve_returns_404_for_cross_tenant_approval_id(self):
        from tenant_apps.ai_assistant.views import AIApprovalViewSet

        foreign_run = self._create_run(
            tenant=self.tenant_b,
            requested_by=self.other_user,
            user_message='Foreign approval',
        )
        foreign_task = AITask.objects.create(
            tenant=self.tenant_b,
            run=foreign_run,
            requested_by=self.other_user,
            tool_name='draft_vendor_email',
            sequence=1,
            status=AITaskStatus.APPROVAL_REQUIRED,
            requires_approval=True,
            input_payload={'context': 'Foreign approval payload'},
        )
        foreign_approval = AIApproval.objects.create(
            tenant=self.tenant_b,
            run=foreign_run,
            task=foreign_task,
            requested_by=self.other_user,
            tool_name='draft_vendor_email',
            status=AIApprovalStatus.PENDING,
            request_payload=foreign_task.input_payload,
        )

        response = AIApprovalViewSet.as_view({'post': 'approve'})(
            self._request(
                'post',
                f'/api/v1/ai-assistant/approvals/{foreign_approval.id}/approve/',
                tenant=self.tenant_a,
                user=self.owner,
                data={'resolution_note': 'Should not cross tenant boundary'},
            ),
            pk=str(foreign_approval.id),
        )

        self.assertEqual(response.status_code, 404)
        foreign_approval.refresh_from_db()
        self.assertEqual(foreign_approval.status, AIApprovalStatus.PENDING)

    def test_deny_returns_404_for_missing_approval_id(self):
        from tenant_apps.ai_assistant.views import AIApprovalViewSet

        missing_id = uuid.uuid4()
        response = AIApprovalViewSet.as_view({'post': 'deny'})(
            self._request(
                'post',
                f'/api/v1/ai-assistant/approvals/{missing_id}/deny/',
                tenant=self.tenant_a,
                user=self.owner,
                data={'resolution_note': 'Missing approval'},
            ),
            pk=str(missing_id),
        )

        self.assertEqual(response.status_code, 404)

    def test_run_and_approval_queries_are_tenant_scoped(self):
        from tenant_apps.ai_assistant.views import AIApprovalViewSet, AIRunViewSet

        own_run = self._create_run(user_message='Own run')
        owner_run = self._create_run(requested_by=self.owner, user_message='Owner run')
        foreign_run = self._create_run(tenant=self.tenant_b, requested_by=self.other_user, user_message='Foreign run')

        own_task = AITask.objects.create(
            tenant=self.tenant_a,
            run=own_run,
            requested_by=self.requester,
            tool_name='draft_vendor_email',
            sequence=1,
            status=AITaskStatus.APPROVAL_REQUIRED,
            requires_approval=True,
            input_payload={'vendor_id': str(self.supplier.id), 'vendor_type': 'supplier', 'context': 'Own'},
        )
        owner_task = AITask.objects.create(
            tenant=self.tenant_a,
            run=owner_run,
            requested_by=self.owner,
            tool_name='draft_vendor_email',
            sequence=1,
            status=AITaskStatus.APPROVAL_REQUIRED,
            requires_approval=True,
            input_payload={'vendor_id': str(self.supplier.id), 'vendor_type': 'supplier', 'context': 'Owner'},
        )
        foreign_task = AITask.objects.create(
            tenant=self.tenant_b,
            run=foreign_run,
            requested_by=self.other_user,
            tool_name='draft_vendor_email',
            sequence=1,
            status=AITaskStatus.APPROVAL_REQUIRED,
            requires_approval=True,
            input_payload={'vendor_id': str(self.supplier.id), 'vendor_type': 'supplier', 'context': 'Foreign'},
        )
        AIApproval.objects.create(
            tenant=self.tenant_a,
            run=own_run,
            task=own_task,
            requested_by=self.requester,
            tool_name='draft_vendor_email',
            status=AIApprovalStatus.PENDING,
            request_payload=own_task.input_payload,
        )
        AIApproval.objects.create(
            tenant=self.tenant_a,
            run=owner_run,
            task=owner_task,
            requested_by=self.owner,
            tool_name='draft_vendor_email',
            status=AIApprovalStatus.PENDING,
            request_payload=owner_task.input_payload,
        )
        AIApproval.objects.create(
            tenant=self.tenant_b,
            run=foreign_run,
            task=foreign_task,
            requested_by=self.other_user,
            tool_name='draft_vendor_email',
            status=AIApprovalStatus.PENDING,
            request_payload=foreign_task.input_payload,
        )

        own_runs_response = AIRunViewSet.as_view({'get': 'list'})(
            self._request('get', '/api/v1/ai-assistant/runs/', tenant=self.tenant_a, user=self.requester)
        )
        self.assertEqual(own_runs_response.status_code, 200)
        own_run_ids = {item['id'] for item in self._items(own_runs_response)}
        self.assertIn(str(own_run.id), own_run_ids)
        self.assertNotIn(str(owner_run.id), own_run_ids)
        self.assertNotIn(str(foreign_run.id), own_run_ids)

        admin_approvals_response = AIApprovalViewSet.as_view({'get': 'list'})(
            self._request('get', '/api/v1/ai-assistant/approvals/', tenant=self.tenant_a, user=self.owner)
        )
        self.assertEqual(admin_approvals_response.status_code, 200)
        admin_approval_run_ids = {item['run'] for item in self._items(admin_approvals_response)}
        self.assertIn(own_run.id, admin_approval_run_ids)
        self.assertIn(owner_run.id, admin_approval_run_ids)
        self.assertNotIn(foreign_run.id, admin_approval_run_ids)

    def test_control_plane_endpoints_require_authentication(self):
        from tenant_apps.ai_assistant.views import AIRunViewSet

        response = AIRunViewSet.as_view({'get': 'list'})(
            self._request('get', '/api/v1/ai-assistant/runs/', tenant=self.tenant_a)
        )
        self.assertEqual(response.status_code, 401)
