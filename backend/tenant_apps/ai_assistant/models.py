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

from tenant_apps.ai_assistant.services.document_parser import AI_DOCUMENT_ALLOWED_EXTENSIONS

from apps.core.models import OwnedModel, StatusModel, TenantAwareModel


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

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="ai_chat_sessions",
        null=True,
        blank=True,
        help_text="Tenant this chat session belongs to",
    )

    last_activity = models.DateTimeField(auto_now=True, help_text="Timestamp of last activity in this session")

    class Meta:
        db_table = "ai_assistant_chat_sessions"
        verbose_name = "Chat Session"
        verbose_name_plural = "Chat Sessions"
        ordering = ["-last_activity"]
        indexes = [
            models.Index(fields=["tenant", "owner", "-last_activity"]),
        ]

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

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="ai_chat_messages",
        null=True,
        blank=True,
        help_text="Tenant this chat message belongs to",
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

    is_processed = models.BooleanField(default=True, help_text="Whether the message has been fully processed")

    class Meta:
        db_table = "ai_assistant_chat_messages"
        verbose_name = "Chat Message"
        verbose_name_plural = "Chat Messages"
        ordering = ["created_on"]
        indexes = [
            models.Index(fields=["tenant", "session", "created_on"]),
        ]

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

    class FeedbackSignal(models.TextChoices):
        THUMBS_UP = "thumbs_up", "Thumbs Up"
        THUMBS_DOWN = "thumbs_down", "Thumbs Down"

    class RetrainingStatus(models.TextChoices):
        NOT_QUEUED = "not_queued", "Not queued"
        QUEUED = "queued", "Queued"
        EXPORTED = "exported", "Exported"

    document_id = models.UUIDField(help_text="Upstream document identifier")
    document_type = models.CharField(max_length=64, help_text="Classified document type")

    original_extracted_data = models.JSONField(default=dict, blank=True)
    user_corrected_data = models.JSONField(default=dict, blank=True)

    confidence_score = models.FloatField(default=0.0, help_text="Model confidence from 0.0 to 1.0")
    precision_delta = models.FloatField(default=0.0, help_text="Derived change ratio between original and corrected")
    feedback_signal = models.CharField(
        max_length=16,
        choices=FeedbackSignal.choices,
        blank=True,
        null=True,
        help_text="Optional inbox reaction signal captured from the operator.",
    )
    feedback_comment = models.TextField(
        blank=True,
        default="",
        help_text="Operator comment captured with inbox feedback; required for negative feedback.",
    )
    feedback_source = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Surface where the operator submitted feedback (for example: ai_inbox).",
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_feedback_submissions",
    )
    retraining_status = models.CharField(
        max_length=16,
        choices=RetrainingStatus.choices,
        default=RetrainingStatus.NOT_QUEUED,
        help_text="Tracks whether the feedback has been queued/exported for retraining workflows.",
    )
    retraining_queued_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when this feedback was queued for retraining.",
    )

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
            models.Index(fields=["tenant", "retraining_status", "created_on"], name="ai_fb_retrain_idx"),
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
        related_name="ai_feedback_items",
    )

    user_message = models.TextField(blank=True, default="")
    assistant_message = models.TextField(blank=True, default="")

    user_correction = models.TextField(help_text="User-provided correction")
    lesson_text = models.TextField(help_text="Normalized lesson learned to apply in future responses")

    entity_type = models.CharField(max_length=64, blank=True, default="")
    entity_id = models.CharField(max_length=64, blank=True, default="")

    tags = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "ai_assistant_feedback"
        verbose_name = "AI Feedback"
        verbose_name_plural = "AI Feedback"
        indexes = [
            models.Index(fields=["tenant", "is_active", "created_on"], name="ai_fb_item_queue_idx"),
            models.Index(fields=["tenant", "entity_type", "created_on"], name="ai_fb_item_entity_idx"),
        ]


class VectorMemory(TenantAwareModel):
    """Tenant-scoped vector memory for PM-AS.

    Stores embeddings for historical purchase orders and industry context snippets.
    """

    source_type = models.CharField(max_length=64, default="context", help_text="context|purchase_order|other")
    document_id = models.UUIDField(null=True, blank=True)
    content = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)

    embedding = models.JSONField(
        default=list,
        blank=True,
        help_text="Embedding vector as JSON array (pgvector optional).",
    )

    class Meta:
        db_table = "ai_assistant_vector_memory"
        verbose_name = "Vector Memory"
        verbose_name_plural = "Vector Memory"
        indexes = [
            models.Index(fields=["tenant", "source_type"], name="ai_vec_tenant_src_idx"),
        ]


class TenantKnowledgeFact(TenantAwareModel):
    """Tenant-scoped knowledge facts for RAG.

    These are short, durable facts learned from interactions and gatekept extraction.
    Retrieval is done via pgvector similarity search.
    """

    domain_category = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Optional domain label (e.g. ordering, invoicing, cold_storage)",
    )
    fact_text = models.TextField(help_text="Canonical tenant fact text")
    embedding = models.JSONField(
        default=list,
        null=True,
        blank=True,
        help_text="Embedding vector as JSON array (pgvector optional).",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "ai_assistant_tenant_knowledge_facts"
        verbose_name = "Tenant Knowledge Fact"
        verbose_name_plural = "Tenant Knowledge Facts"
        indexes = [
            models.Index(fields=["tenant", "domain_category"], name="ai_kf_tenant_domain_idx"),
        ]


class TenantAIMemory(TenantAwareModel):
    """Tenant-scoped long-term memory for durable rules/preferences.

    This is distinct from AIFeedback (which is conversational corrections).
    """

    key = models.CharField(
        max_length=128,
        help_text="Stable key for upserts (e.g. vendor:acme:routing_rule)",
    )
    memory_text = models.TextField(blank=True, default="", help_text="Human-readable memory text")
    memory_json = models.JSONField(default=dict, blank=True, help_text="Optional structured memory payload")
    tags = models.JSONField(default=dict, blank=True)
    embedding = models.JSONField(
        default=list,
        blank=True,
        help_text="Embedding vector as JSON array (pgvector optional).",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "ai_assistant_tenant_memory"
        verbose_name = "Tenant AI Memory"
        verbose_name_plural = "Tenant AI Memories"
        constraints = [
            models.UniqueConstraint(fields=["tenant", "key"], name="unique_ai_memory_key_per_tenant"),
        ]
        indexes = [
            models.Index(fields=["tenant", "key"], name="ai_mem_tenant_key_idx"),
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
        related_name="ai_documents",
        help_text="User who uploaded this document",
    )

    session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name="documents",
        null=True,
        blank=True,
        help_text="Optional chat session this document was uploaded into",
    )

    file = models.FileField(
        upload_to=aidocument_upload_to,
        validators=[FileExtensionValidator(allowed_extensions=list(AI_DOCUMENT_ALLOWED_EXTENSIONS))],
    )

    original_filename = models.CharField(max_length=255, blank=True, default="")
    content_type = models.CharField(max_length=128, blank=True, default="")
    file_size = models.BigIntegerField(default=0)

    processing_status = models.CharField(
        max_length=20,
        default="pending",
        choices=[
            ("pending", "pending"),
            ("processing", "processing"),
            ("completed", "completed"),
            ("failed", "failed"),
        ],
    )

    class Meta:
        db_table = "ai_assistant_documents"
        verbose_name = "AI Document"
        verbose_name_plural = "AI Documents"
        indexes = [
            models.Index(fields=["tenant", "owner", "created_on"], name="aidoc_tnt_owner_created_idx"),
        ]


class AIDocumentSemanticChunk(TenantAwareModel):
    """Semantic retrieval chunks derived from a parsed AI document."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(
        AIDocument,
        on_delete=models.CASCADE,
        related_name="semantic_chunks",
    )
    chunk_index = models.PositiveIntegerField(default=0)
    content = models.TextField(default="")
    content_hash = models.CharField(max_length=64, blank=True, default="")
    embedding = models.JSONField(
        default=list,
        blank=True,
        help_text="Embedding vector as JSON array (pgvector optional).",
    )
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "ai_assistant_document_semantic_chunks"
        verbose_name = "AI Document Semantic Chunk"
        verbose_name_plural = "AI Document Semantic Chunks"
        constraints = [
            models.UniqueConstraint(fields=["document", "chunk_index"], name="unique_ai_document_chunk_index"),
        ]
        indexes = [
            models.Index(fields=["tenant", "document", "chunk_index"], name="ai_doc_chunk_doc_idx"),
            models.Index(fields=["tenant", "created_on"], name="ai_doc_chunk_created_idx"),
        ]

    def __str__(self):
        return f"Document chunk {self.chunk_index} for {self.document_id}"


class AILineageEvent(TenantAwareModel):
    """Tenant-scoped lineage events connecting source artifacts to AI outcomes."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(
        AIDocument,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lineage_events",
    )
    run = models.ForeignKey(
        "AIRun",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lineage_events",
    )
    task = models.ForeignKey(
        "AITask",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lineage_events",
    )
    approval = models.ForeignKey(
        "AIApproval",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lineage_events",
    )
    event_type = models.CharField(max_length=64)
    source_type = models.CharField(max_length=64, blank=True, default="")
    source_id = models.CharField(max_length=128, blank=True, default="")
    target_type = models.CharField(max_length=64, blank=True, default="")
    target_id = models.CharField(max_length=128, blank=True, default="")
    summary = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "ai_assistant_lineage_events"
        verbose_name = "AI Lineage Event"
        verbose_name_plural = "AI Lineage Events"
        indexes = [
            models.Index(fields=["tenant", "event_type", "created_on"], name="ai_lineage_event_type_idx"),
            models.Index(fields=["tenant", "document", "created_on"], name="ai_lineage_document_idx"),
            models.Index(fields=["tenant", "run", "created_on"], name="ai_lineage_run_idx"),
            models.Index(fields=["tenant", "task", "created_on"], name="ai_lineage_task_idx"),
        ]

    def __str__(self):
        return f"{self.event_type} ({self.source_type}->{self.target_type})"


class CommunicationStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SENT = "sent", "Sent"
    CANCELLED = "cancelled", "Cancelled"
    FAILED = "failed", "Failed"


class CommunicationLog(TenantAwareModel):
    """Tenant-scoped outbound communications staged by the AI assistant."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="communication_logs_created",
    )

    # Generic link to a vendor/customer/etc (supports UUID or int PKs; stored as string)
    entity_type = models.CharField(max_length=32, default="supplier")
    entity_id = models.CharField(max_length=64, blank=True, default="")

    to_email = models.EmailField()
    subject = models.CharField(max_length=300, default="")
    body = models.TextField(default="")

    provider = models.CharField(
        max_length=32,
        default="manual",
        help_text="manual|outlook (send is always human-approved)",
    )

    status = models.CharField(
        max_length=16, choices=CommunicationStatus.choices, default=CommunicationStatus.DRAFT, db_index=True
    )

    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "ai_assistant_communication_logs"
        verbose_name = "Communication Log"
        verbose_name_plural = "Communication Logs"
        indexes = [
            models.Index(fields=["tenant", "status", "created_on"], name="ai_comms_tenant_status_idx"),
            models.Index(fields=["tenant", "entity_type", "created_on"], name="ai_comms_tenant_entity_idx"),
        ]


class AIRunStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    APPROVAL_REQUIRED = "approval_required", "Approval Required"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"
    DENIED = "denied", "Denied"


class AITaskStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    APPROVAL_REQUIRED = "approval_required", "Approval Required"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"
    DENIED = "denied", "Denied"


class AIApprovalStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    DENIED = "denied", "Denied"
    EXPIRED = "expired", "Expired"


class AIRun(TenantAwareModel):
    """Persist one governed AI execution run for a tenant-scoped request."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        ChatSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_runs",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_runs_requested",
    )
    source = models.CharField(max_length=32, default="chat")
    event_type = models.CharField(max_length=32, default="user_chat")
    status = models.CharField(max_length=32, choices=AIRunStatus.choices, default=AIRunStatus.PENDING)
    correlation_id = models.CharField(max_length=128, blank=True, default="")
    intent = models.CharField(max_length=128, blank=True, default="")
    user_message = models.TextField(blank=True, default="")
    response_text = models.TextField(blank=True, default="")
    request_payload = models.JSONField(default=dict, blank=True)
    response_payload = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True, default="")
    approval_required_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "ai_assistant_runs"
        verbose_name = "AI Run"
        verbose_name_plural = "AI Runs"
        indexes = [
            models.Index(fields=["tenant", "status", "created_on"], name="ai_run_tenant_status_idx"),
            models.Index(fields=["tenant", "requested_by", "created_on"], name="ai_run_tenant_user_idx"),
            models.Index(fields=["tenant", "session", "created_on"], name="ai_run_tenant_session_idx"),
        ]

    def __str__(self):
        return f"AI Run {self.id} ({self.status})"


class AITask(TenantAwareModel):
    """Persist one tool step executed or staged within an AI run."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        AIRun,
        on_delete=models.CASCADE,
        related_name="tasks",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_tasks_requested",
    )
    tool_name = models.CharField(max_length=128)
    sequence = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=32, choices=AITaskStatus.choices, default=AITaskStatus.PENDING)
    requires_approval = models.BooleanField(default=False)
    approval_requested_at = models.DateTimeField(null=True, blank=True)
    executed_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    input_payload = models.JSONField(default=dict, blank=True)
    output_payload = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True, default="")
    target_entity_type = models.CharField(max_length=64, blank=True, default="")
    target_entity_id = models.CharField(max_length=64, blank=True, default="")

    class Meta:
        db_table = "ai_assistant_tasks"
        verbose_name = "AI Task"
        verbose_name_plural = "AI Tasks"
        constraints = [
            models.UniqueConstraint(fields=["run", "sequence"], name="unique_ai_task_sequence_per_run"),
        ]
        indexes = [
            models.Index(fields=["tenant", "status", "created_on"], name="ai_task_tenant_status_idx"),
            models.Index(fields=["tenant", "run", "sequence"], name="ai_task_tenant_run_idx"),
            models.Index(fields=["tenant", "tool_name", "created_on"], name="ai_task_tenant_tool_idx"),
        ]

    def __str__(self):
        return f"{self.tool_name} ({self.status})"


class AIApproval(TenantAwareModel):
    """Persist a human approval record for a governed AI task."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        AIRun,
        on_delete=models.CASCADE,
        related_name="approvals",
    )
    task = models.OneToOneField(
        AITask,
        on_delete=models.CASCADE,
        related_name="approval",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_approvals_requested",
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_approvals_resolved",
    )
    tool_name = models.CharField(max_length=128)
    status = models.CharField(max_length=32, choices=AIApprovalStatus.choices, default=AIApprovalStatus.PENDING)
    request_payload = models.JSONField(default=dict, blank=True)
    response_payload = models.JSONField(default=dict, blank=True)
    resolution_note = models.TextField(blank=True, default="")
    expires_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "ai_assistant_approvals"
        verbose_name = "AI Approval"
        verbose_name_plural = "AI Approvals"
        indexes = [
            models.Index(fields=["tenant", "status", "created_on"], name="ai_appr_tenant_status_idx"),
            models.Index(fields=["tenant", "requested_by", "created_on"], name="ai_appr_tenant_user_idx"),
            models.Index(fields=["tenant", "tool_name", "created_on"], name="ai_appr_tenant_tool_idx"),
        ]

    def __str__(self):
        return f"{self.tool_name} approval ({self.status})"


# ---------------------------------------------------------------------------
# RT-02.4: Cockpit Draft Form — routes parsed inbox items into Process Cockpit
# ---------------------------------------------------------------------------


class CockpitDraftStatus(models.TextChoices):
    PENDING = "pending", "Pending Review"
    IN_PROGRESS = "in_progress", "In Progress"
    SUBMITTED = "submitted", "Submitted"
    DISCARDED = "discarded", "Discarded"


class CockpitDraftForm(TenantAwareModel):
    """Draft form entry routed from AI Inbox to Process Cockpit.

    Stores pre-populated form data from parsed emails, enabling users
    to review, edit, and submit as proper entity records (PO, Inquiry, etc.).

    Lifecycle: pending → in_progress → submitted/discarded
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Link to source
    source_feedback_id = models.BigIntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text="FK to AIFeedbackLog that triggered this draft.",
    )
    source_document_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Source document/email UUID.",
    )

    # Form type and data
    form_type = models.CharField(
        max_length=64,
        db_index=True,
        help_text="Target form type: purchase_order, inquiry, sales_order, bid, etc.",
    )
    form_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Pre-populated form fields from parsed email/document.",
    )
    parsed_payload = models.JSONField(
        default=dict,
        blank=True,
        help_text="Full parsed payload (provenance) from email parser.",
    )

    # Status tracking
    status = models.CharField(
        max_length=16,
        choices=CockpitDraftStatus.choices,
        default=CockpitDraftStatus.PENDING,
        db_index=True,
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cockpit_draft_assignments",
        help_text="User assigned to review this draft.",
    )

    # Result tracking
    submitted_entity_type = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Entity type created on submission (e.g., PurchaseOrder).",
    )
    submitted_entity_id = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="PK of created entity.",
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cockpit_draft_submissions",
    )

    # Notes
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "ai_assistant_cockpit_drafts"
        verbose_name = "Cockpit Draft Form"
        verbose_name_plural = "Cockpit Draft Forms"
        ordering = ["-created_on"]
        indexes = [
            models.Index(fields=["tenant", "status", "-created_on"], name="ai_draft_tenant_status_idx"),
            models.Index(fields=["tenant", "form_type", "-created_on"], name="ai_draft_tenant_type_idx"),
            models.Index(fields=["tenant", "assigned_to", "status"], name="ai_draft_assigned_idx"),
        ]

    def __str__(self):
        return f"Draft({self.form_type}) [{self.status}]"
