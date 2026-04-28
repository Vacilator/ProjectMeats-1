"""
AI Assistant models for ProjectMeats.

This module provides AI-powered chatbot functionality for meat market operations,
including document processing, entity extraction, and intelligent assistance
for purchase orders, suppliers, customers, and other business entities.
"""
import os
import uuid

from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils import timezone


from apps.core.models import OwnedModel, StatusModel, TenantAwareModel
from tenant_apps.ai_assistant.services.document_parser import AI_DOCUMENT_ALLOWED_EXTENSIONS


class ChatSessionStatusChoices(models.TextChoices):
    """Status choices for chat sessions."""

    ACTIVE = "active", "Active"
    COMPLETED = "completed", "Completed"
    ARCHIVED = "archived", "Archived"


class ChatSession(OwnedModel, StatusModel):
    """Chat session model for managing conversations with the AI assistant."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique identifier for the chat session",
    )

    title = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Optional title for the chat session",
    )

    session_status = models.CharField(
        max_length=20,
        choices=ChatSessionStatusChoices.choices,
        default=ChatSessionStatusChoices.ACTIVE,
        help_text="Current status of the chat session",
    )

    context_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="JSON field for storing session context",
    )

    last_activity = models.DateTimeField(
        auto_now=True, help_text="Timestamp of last activity in this session"
    )

    class Meta:
        db_table = "ai_assistant_chat_sessions"
        verbose_name = "Chat Session"
        verbose_name_plural = "Chat Sessions"
        ordering = ["-last_activity"]

    def __str__(self):
        return f"Chat Session: {self.title or f'Session {self.id.hex[:8]}'}"


class MessageTypeChoices(models.TextChoices):
    """Message type choices for chat messages."""

    USER = "user", "User Message"
    ASSISTANT = "assistant", "AI Assistant Response"
    SYSTEM = "system", "System Message"
    DOCUMENT = "document", "Document Upload"


class ChatMessage(OwnedModel):
    """Individual chat message within a session."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique identifier for the message",
    )

    session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name="messages",
        help_text="Chat session this message belongs to",
    )

    message_type = models.CharField(
        max_length=20,
        choices=MessageTypeChoices.choices,
        help_text="Type of message",
    )

    content = models.TextField(help_text="Message content/text")

    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata about the message",
    )

    is_processed = models.BooleanField(
        default=True, help_text="Whether the message has been fully processed"
    )

    class Meta:
        db_table = "ai_assistant_chat_messages"
        verbose_name = "Chat Message"
        verbose_name_plural = "Chat Messages"
        ordering = ["created_on"]

    def __str__(self):
        preview = self.content[:50] + "..." if len(self.content) > 50 else self.content
        return f"{self.get_message_type_display()}: {preview}"


class AIConfiguration(TenantAwareModel):
    """Configuration settings for AI providers and models."""

    name = models.CharField(max_length=100)
    provider = models.CharField(max_length=50, default="openai")
    model_name = models.CharField(max_length=100, default="gpt-4o-mini")
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_assistant_configurations"
        verbose_name = "AI Configuration"
        verbose_name_plural = "AI Configurations"

    def __str__(self):
        return f"{self.name} ({self.provider} - {self.model_name})"


class AIFeedbackLog(TenantAwareModel):
    """Human-in-the-loop feedback for extracted document data.

    This is the core reinforcement flywheel: store what the AI extracted, what the user corrected,
    and derived quality signals.

    NOTE: `precision_delta` is stored for reporting; the exact scoring algorithm can evolve.
    """

    document_id = models.UUIDField(help_text="Upstream document identifier")
    document_type = models.CharField(max_length=64, help_text="Classified document type")

    original_extracted_data = models.JSONField(default=dict, blank=True)
    user_corrected_data = models.JSONField(default=dict, blank=True)

    confidence_score = models.FloatField(default=0.0, help_text="Model confidence from 0.0 to 1.0")
    precision_delta = models.FloatField(default=0.0, help_text="Derived change ratio between original and corrected")

    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_feedback_resolutions",
    )

    class Meta:
        db_table = "ai_assistant_feedback_logs"
        verbose_name = "AI Feedback Log"
        verbose_name_plural = "AI Feedback Logs"
        indexes = [
            models.Index(fields=["tenant", "document_id"], name="ai_fb_tenant_doc_idx"),
            models.Index(fields=["tenant", "document_type"], name="ai_fb_tenant_type_idx"),
            # Optimizes the pending-review queue: tenant + unresolved + confidence + time.
            models.Index(fields=["tenant", "resolved_by", "confidence_score", "created_on"], name="ai_fb_queue_idx"),
        ]

    def _calculate_precision_delta(self) -> float:
        orig = self.original_extracted_data or {}
        corr = self.user_corrected_data or {}

        if not isinstance(orig, dict) or not isinstance(corr, dict):
            return 1.0

        keys = set(orig.keys()) | set(corr.keys())
        if not keys:
            return 0.0

        changed = sum(1 for k in keys if orig.get(k) != corr.get(k))
        return changed / max(1, len(keys))

    def save(self, *args, **kwargs):
        self.precision_delta = float(self._calculate_precision_delta())
        super().save(*args, **kwargs)


class AIFeedback(TenantAwareModel):
    """Tenant-scoped conversational feedback.

    Stores user-provided corrections as durable "lessons learned" that can be injected
    into the assistant's system prompt on future conversations.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ai_feedback_items',
    )

    user_message = models.TextField(blank=True, default='')
    assistant_message = models.TextField(blank=True, default='')

    user_correction = models.TextField(help_text='User-provided correction')
    lesson_text = models.TextField(help_text='Normalized lesson learned to apply in future responses')

    entity_type = models.CharField(max_length=64, blank=True, default='')
    entity_id = models.CharField(max_length=64, blank=True, default='')

    tags = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'ai_assistant_feedback'
        verbose_name = 'AI Feedback'
        verbose_name_plural = 'AI Feedback'
        indexes = [
            models.Index(fields=['tenant', 'is_active', 'created_on'], name='ai_fb_item_queue_idx'),
            models.Index(fields=['tenant', 'entity_type', 'created_on'], name='ai_fb_item_entity_idx'),
        ]


class VectorMemory(TenantAwareModel):
    """Tenant-scoped vector memory for PM-AS.

    Stores embeddings for historical purchase orders and industry context snippets.
    """

    source_type = models.CharField(max_length=64, default='context', help_text='context|purchase_order|other')
    document_id = models.UUIDField(null=True, blank=True)
    content = models.TextField(blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)

    embedding = models.JSONField(
        default=list,
        blank=True,
        help_text='Embedding vector as JSON array (pgvector optional).',
    )

    class Meta:
        db_table = 'ai_assistant_vector_memory'
        verbose_name = 'Vector Memory'
        verbose_name_plural = 'Vector Memory'
        indexes = [
            models.Index(fields=['tenant', 'source_type'], name='ai_vec_tenant_src_idx'),
        ]


class TenantKnowledgeFact(TenantAwareModel):
    """Tenant-scoped knowledge facts for RAG.

    These are short, durable facts learned from interactions and gatekept extraction.
    Retrieval is done via pgvector similarity search.
    """

    domain_category = models.CharField(
        max_length=64,
        blank=True,
        default='',
        help_text='Optional domain label (e.g. ordering, invoicing, cold_storage)',
    )
    fact_text = models.TextField(help_text='Canonical tenant fact text')
    embedding = models.JSONField(
        default=list,
        null=True,
        blank=True,
        help_text='Embedding vector as JSON array (pgvector optional).',
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'ai_assistant_tenant_knowledge_facts'
        verbose_name = 'Tenant Knowledge Fact'
        verbose_name_plural = 'Tenant Knowledge Facts'
        indexes = [
            models.Index(fields=['tenant', 'domain_category'], name='ai_kf_tenant_domain_idx'),
        ]


class TenantAIMemory(TenantAwareModel):
    """Tenant-scoped long-term memory for durable rules/preferences.

    This is distinct from AIFeedback (which is conversational corrections).
    """

    key = models.CharField(
        max_length=128,
        help_text='Stable key for upserts (e.g. vendor:acme:routing_rule)',
    )
    memory_text = models.TextField(blank=True, default='', help_text='Human-readable memory text')
    memory_json = models.JSONField(default=dict, blank=True, help_text='Optional structured memory payload')
    tags = models.JSONField(default=dict, blank=True)
    embedding = models.JSONField(
        default=list,
        blank=True,
        help_text='Embedding vector as JSON array (pgvector optional).',
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'ai_assistant_tenant_memory'
        verbose_name = 'Tenant AI Memory'
        verbose_name_plural = 'Tenant AI Memories'
        constraints = [
            models.UniqueConstraint(fields=['tenant', 'key'], name='unique_ai_memory_key_per_tenant'),
        ]
        indexes = [
            models.Index(fields=['tenant', 'key'], name='ai_mem_tenant_key_idx'),
        ]


def aidocument_upload_to(instance: "AIDocument", filename: str) -> str:
    """Return a tenant-scoped upload path for AI document uploads.

    Includes tenant UUID + date buckets + unique prefix to prevent naming collisions.
    """

    safe_name = os.path.basename(filename or "upload")
    tenant_id = getattr(instance, "tenant_id", None) or getattr(getattr(instance, "tenant", None), "id", None)
    tenant_part = str(tenant_id) if tenant_id else "unknown-tenant"

    timezone.now()
    unique = uuid.uuid4().hex

    # Keep a flat-ish structure to avoid permission issues on hosts where the
    # mounted media volume is writable but does not allow creating deep directory trees.
    # Still includes tenant + UUID to prevent naming collisions.
    return f"ai_assistant/documents/{tenant_part}_{unique}_{safe_name}"


class AIDocument(TenantAwareModel):
    """Tenant + user-scoped document uploads for the AI assistant."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ai_documents',
        help_text='User who uploaded this document',
    )

    session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name='documents',
        null=True,
        blank=True,
        help_text='Optional chat session this document was uploaded into',
    )

    file = models.FileField(
        upload_to=aidocument_upload_to,
        validators=[
            FileExtensionValidator(
                allowed_extensions=list(AI_DOCUMENT_ALLOWED_EXTENSIONS)
            )
        ],
    )

    original_filename = models.CharField(max_length=255, blank=True, default='')
    content_type = models.CharField(max_length=128, blank=True, default='')
    file_size = models.BigIntegerField(default=0)

    processing_status = models.CharField(
        max_length=20,
        default='pending',
        choices=[
            ('pending', 'pending'),
            ('processing', 'processing'),
            ('completed', 'completed'),
            ('failed', 'failed'),
        ],
    )

    class Meta:
        db_table = 'ai_assistant_documents'
        verbose_name = 'AI Document'
        verbose_name_plural = 'AI Documents'
        indexes = [
            models.Index(fields=['tenant', 'owner', 'created_on'], name='aidoc_tnt_owner_created_idx'),
        ]


class CommunicationStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    SENT = 'sent', 'Sent'
    CANCELLED = 'cancelled', 'Cancelled'
    FAILED = 'failed', 'Failed'


class CommunicationLog(TenantAwareModel):
    """Tenant-scoped outbound communications staged by the AI assistant."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='communication_logs_created',
    )

    # Generic link to a vendor/customer/etc (supports UUID or int PKs; stored as string)
    entity_type = models.CharField(max_length=32, default='supplier')
    entity_id = models.CharField(max_length=64, blank=True, default='')

    to_email = models.EmailField()
    subject = models.CharField(max_length=300, default='')
    body = models.TextField(default='')

    provider = models.CharField(
        max_length=32,
        default='manual',
        help_text='manual|outlook (send is always human-approved)',
    )

    status = models.CharField(max_length=16, choices=CommunicationStatus.choices, default=CommunicationStatus.DRAFT, db_index=True)

    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'ai_assistant_communication_logs'
        verbose_name = 'Communication Log'
        verbose_name_plural = 'Communication Logs'
        indexes = [
            models.Index(fields=['tenant', 'status', 'created_on'], name='ai_comms_tenant_status_idx'),
            models.Index(fields=['tenant', 'entity_type', 'created_on'], name='ai_comms_tenant_entity_idx'),
        ]
