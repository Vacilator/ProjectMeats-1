"""
Tests for AI Assistant app models.

Uses shared-schema multi-tenancy with tenant ForeignKey isolation.
"""
import uuid
from django.test import TestCase
from django.contrib.auth.models import User
from tenant_apps.ai_assistant.models import (
    ChatSession,
    ChatSessionStatusChoices,
    ChatMessage,
    MessageTypeChoices,
    AIConfiguration,
)
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
        )
        
        self.assertIsInstance(session.id, uuid.UUID)

    def test_chat_session_status_choices(self):
        """Test different session statuses."""
        for status in [ChatSessionStatusChoices.ACTIVE, ChatSessionStatusChoices.COMPLETED]:
            session = ChatSession.objects.create(
                title=f"Status {status}",
                owner=self.user,
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
            context_data=context,
        )
        
        self.assertEqual(session.context_data, context)
        self.assertEqual(session.context_data["entity_type"], "supplier")

    def test_chat_session_str_with_title(self):
        """Test string representation with title."""
        session = ChatSession.objects.create(
            title="My Chat",
            owner=self.user,
        )
        
        self.assertIn("My Chat", str(session))

    def test_chat_session_str_without_title(self):
        """Test string representation without title."""
        session = ChatSession.objects.create(
            owner=self.user,
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
        )

    def test_create_user_message(self):
        """Test creating a user message."""
        message = ChatMessage.objects.create(
            session=self.session,
            owner=self.user,
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
