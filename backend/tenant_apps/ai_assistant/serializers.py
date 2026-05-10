"""
Serializers for AI Assistant functionality.
"""
from rest_framework import serializers

from .models import (
    AIApproval,
    AIDocument,
    AIFeedbackLog,
    AIConfiguration,
    AIRun,
    AITask,
    ChatMessage,
    ChatSession,
)
from .session_utils import bind_context_to_tenant, get_request_tenant_id, session_matches_tenant
from .services.document_parser import validate_ai_document_upload
from .services.extract_to_schema import EXTRACT_TO_SCHEMA_CHOICES
from .services.lineage import get_document_lineage_summary



def _validate_request_session(value, request):
    if not value or not request:
        return value

    if getattr(value, 'owner_id', None) != getattr(request.user, 'id', None):
        raise serializers.ValidationError('Session not found')

    tenant_id = get_request_tenant_id(request)
    if not tenant_id:
        raise serializers.ValidationError('Tenant context required')

    if not session_matches_tenant(value, getattr(request, 'tenant', None)):
        raise serializers.ValidationError('Session not found')

    return value


class PendingReviewResolveRequestSerializer(serializers.Serializer):
    user_corrected_data = serializers.JSONField(required=False, allow_null=True)

    def validate_user_corrected_data(self, value):
        if value is None:
            return value
        if not isinstance(value, dict):
            raise serializers.ValidationError('user_corrected_data must be an object')
        return value


class ContextualSuggestionsRequestSerializer(serializers.Serializer):
    entity_type = serializers.CharField(max_length=100)
    entity_id = serializers.CharField(max_length=100)
    current_state = serializers.JSONField(required=False, default=dict)

    def validate_current_state(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('current_state must be an object')
        return value


class ContextualSuggestionSerializer(serializers.Serializer):
    action = serializers.CharField()
    label = serializers.CharField()
    confidence = serializers.FloatField()
    reason = serializers.CharField(required=False, allow_blank=True)
    prompt = serializers.CharField(required=False, allow_blank=True)
    target_url = serializers.CharField(required=False, allow_blank=True)


class ContextualSuggestionsResponseSerializer(serializers.Serializer):
    suggestions = ContextualSuggestionSerializer(many=True)


class AIFeedbackSubmitSerializer(serializers.Serializer):
    """Public-ish write path for HITL corrections.

    The frontend HITL card posts corrected key/value fields here.
    """

    document_id = serializers.UUIDField()
    document_type = serializers.CharField(required=False, allow_blank=True, default='unknown', max_length=64)

    original_extracted_data = serializers.JSONField(required=False, default=dict)
    user_corrected_data = serializers.JSONField(required=False, default=dict)

    confidence_score = serializers.FloatField(required=False, default=0.0)
    feedback_signal = serializers.ChoiceField(
        choices=AIFeedbackLog.FeedbackSignal.choices,
        required=False,
        allow_null=True,
        default=None,
    )
    feedback_comment = serializers.CharField(required=False, allow_blank=True, default='', max_length=4000)
    feedback_source = serializers.CharField(required=False, allow_blank=True, default='', max_length=64)

    def validate_original_extracted_data(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('original_extracted_data must be an object')
        return value

    def validate_user_corrected_data(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('user_corrected_data must be an object')
        return value

    def validate(self, attrs):
        signal = attrs.get('feedback_signal')
        comment = (attrs.get('feedback_comment') or '').strip()
        if signal == AIFeedbackLog.FeedbackSignal.THUMBS_DOWN and not comment:
            raise serializers.ValidationError({'feedback_comment': 'A reason is required for thumbs-down feedback.'})

        attrs['feedback_comment'] = comment
        attrs['feedback_source'] = (attrs.get('feedback_source') or '').strip()
        return attrs


class AILearningMetricsSerializer(serializers.Serializer):
    totalDocumentsParsed = serializers.IntegerField(min_value=0)
    correctionsLearned = serializers.IntegerField(min_value=0)
    precisionScore = serializers.FloatField(min_value=0.0, max_value=1.0)
    confidenceTrend = serializers.ListField(child=serializers.DictField(), required=False)


class ChatSessionListSerializer(serializers.ModelSerializer):
    """Serializer for chat session list view."""

    message_count = serializers.ReadOnlyField()

    class Meta:
        model = ChatSession
        fields = [
            "id",
            "title",
            "session_status",
            "last_activity",
            "created_on",
            "message_count",
        ]


class ChatSessionDetailSerializer(serializers.ModelSerializer):
    """Serializer for chat session detail view."""

    message_count = serializers.ReadOnlyField()

    def validate_context_data(self, value):
        if value is None:
            value = {}
        if not isinstance(value, dict):
            raise serializers.ValidationError('context_data must be an object')

        request = self.context.get('request')
        tenant_id = get_request_tenant_id(request)
        if request and request.method in {'POST', 'PUT', 'PATCH'} and not tenant_id:
            raise serializers.ValidationError('Tenant context required')

        if tenant_id:
            return bind_context_to_tenant(value, getattr(request, 'tenant', None))
        return value

    class Meta:
        model = ChatSession
        fields = [
            "id",
            "title",
            "session_status",
            "context_data",
            "last_activity",
            "created_on",
            "modified_on",
            "message_count",
        ]


class ChatMessageSerializer(serializers.ModelSerializer):
    """Serializer for chat messages."""

    class Meta:
        model = ChatMessage
        fields = [
            "id",
            "session",
            "message_type",
            "content",
            "metadata",
            "is_processed",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "created_on", "modified_on"]


class ChatMessageCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating chat messages."""

    def validate_session(self, value):
        return _validate_request_session(value, self.context.get('request'))

    class Meta:
        model = ChatMessage
        fields = ["session", "message_type", "content"]


class ChatBotRequestSerializer(serializers.Serializer):
    """Serializer for chat bot API requests."""

    message = serializers.CharField(max_length=5000)
    session_id = serializers.UUIDField(required=False, allow_null=True)
    context = serializers.JSONField(required=False, default=dict)


class ChatBotResponseSerializer(serializers.Serializer):
    """Serializer for chat bot API responses."""

    response = serializers.CharField()
    session_id = serializers.UUIDField()
    message_id = serializers.UUIDField()
    processing_time = serializers.FloatField()
    metadata = serializers.JSONField(default=dict)


class ToolsOpenResponseSerializer(serializers.Serializer):
    tools = serializers.ListField(child=serializers.JSONField())


class RecentErrorIssueSerializer(serializers.Serializer):
    id = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    shortId = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    title = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    permalink = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    culprit = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    level = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    status = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    firstSeen = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    lastSeen = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    count = serializers.CharField(allow_blank=True, allow_null=True, required=False)


class RecentErrorsResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    tenant_id = serializers.UUIDField(required=False)
    error = serializers.CharField(required=False)
    detail = serializers.CharField(required=False)
    status = serializers.IntegerField(required=False)
    issues = RecentErrorIssueSerializer(many=True)


class AIDocumentSerializer(serializers.ModelSerializer):
    """Serializer for AI assistant document uploads.

    Additive compatibility: some frontend surfaces expect `file_type` and
    `document_type` fields. The canonical stored field is `content_type`, and
    document classification may not be available at upload time.
    """

    file_type = serializers.CharField(source='content_type', read_only=True)
    document_type = serializers.SerializerMethodField(read_only=True)
    source_metadata = serializers.SerializerMethodField(read_only=True)
    processing_metadata = serializers.SerializerMethodField(read_only=True)
    lineage_summary = serializers.SerializerMethodField(read_only=True, required=False)

    def validate_session(self, value):
        return _validate_request_session(value, self.context.get('request'))

    def get_document_type(self, obj) -> str:
        # Infer document type from processing metadata or content type
        metadata = getattr(obj, 'custom_data', None) or {}
        if isinstance(metadata, dict):
            doc_type = metadata.get('document_type') or metadata.get('doc_type')
            if doc_type:
                return str(doc_type)
        # Infer from content type
        ct = getattr(obj, 'content_type', '') or ''
        if 'pdf' in ct:
            return 'pdf'
        if 'spreadsheet' in ct or 'excel' in ct or 'csv' in ct:
            return 'spreadsheet'
        if 'image' in ct:
            return 'image'
        if 'word' in ct or 'document' in ct:
            return 'document'
        if 'text' in ct:
            return 'text'
        return 'unknown'

    def get_source_metadata(self, obj) -> dict:
        metadata = getattr(obj, 'custom_data', None)
        if not isinstance(metadata, dict):
            return {}

        allowed_keys = (
            'source',
            'message_id',
            'attachment_id',
            'ingested_at',
            'uploaded_at',
            'session_id',
            'graph_name',
            'graph_content_type',
            'graph_size',
            'graph_attachment_type',
        )
        return {
            key: metadata[key]
            for key in allowed_keys
            if metadata.get(key) not in (None, '')
        }

    def get_processing_metadata(self, obj) -> dict:
        metadata = getattr(obj, 'custom_data', None)
        if not isinstance(metadata, dict):
            return {}

        allowed_keys = (
            'parser',
            'processing_started_at',
            'parsed_at',
            'failed_at',
            'parse_error_code',
            'parse_error_message',
            'truncated',
            'warnings',
            'semantic_indexing',
        )
        result = {}
        for key in allowed_keys:
            value = metadata.get(key)
            if value in (None, '', []):
                continue
            result[key] = value
        return result

    def get_lineage_summary(self, obj):
        view = self.context.get('view')
        action = getattr(view, 'action', '')
        if action == 'list':
            return None
        return get_document_lineage_summary(obj)

    def validate_file(self, value):
        try:
            validate_ai_document_upload(
                filename=getattr(value, 'name', ''),
                content_type=getattr(value, 'content_type', ''),
            )
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        return value

    class Meta:
        model = AIDocument
        fields = [
            'id',
            'tenant',
            'owner',
            'session',
            'file',
            'original_filename',
            'content_type',
            'file_type',
            'file_size',
            'processing_status',
            'document_type',
            'source_metadata',
            'processing_metadata',
            'lineage_summary',
            'created_on',
        ]
        read_only_fields = ['id', 'tenant', 'owner', 'content_type', 'file_type', 'file_size', 'document_type', 'created_on']


class ExtractToSchemaRequestSerializer(serializers.Serializer):
    """Request payload for serializer-backed document extraction."""

    document_id = serializers.CharField()
    entity_type = serializers.ChoiceField(choices=EXTRACT_TO_SCHEMA_CHOICES)


class ExtractToSchemaResponseSerializer(serializers.Serializer):
    """Validated extraction draft returned to the frontend."""

    document_id = serializers.CharField()
    entity_type = serializers.CharField()
    serializer_name = serializers.CharField()
    parser = serializers.CharField(allow_blank=True)
    model_name = serializers.CharField()
    warnings = serializers.ListField(child=serializers.CharField(), required=False)
    extracted_data = serializers.JSONField()


class AIConfigurationSerializer(serializers.ModelSerializer):
    """Serializer for AI configurations."""

    class Meta:
        model = AIConfiguration
        fields = ["id", "name", "provider", "model_name", "is_default"]



class SwarmInvokeRequestSerializer(serializers.Serializer):
    event_type = serializers.ChoiceField(choices=['email', 'user_chat', 'webhook'])
    payload = serializers.JSONField()
    correlation_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_payload(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('payload must be an object')
        return value


class SwarmInvokeResponseSerializer(serializers.Serializer):
    tenant_id = serializers.UUIDField()
    correlation_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    event_type = serializers.CharField()
    intent = serializers.CharField()
    urgency = serializers.CharField()
    agent_chain = serializers.ListField(child=serializers.CharField())
    notes = serializers.CharField(required=False, allow_blank=True)


class AIRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIRun
        fields = [
            'id',
            'tenant',
            'session',
            'requested_by',
            'source',
            'event_type',
            'status',
            'correlation_id',
            'intent',
            'user_message',
            'response_text',
            'request_payload',
            'response_payload',
            'error_message',
            'approval_required_at',
            'completed_at',
            'created_on',
            'modified_on',
        ]
        read_only_fields = fields


class AITaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = AITask
        fields = [
            'id',
            'tenant',
            'run',
            'requested_by',
            'tool_name',
            'sequence',
            'status',
            'requires_approval',
            'approval_requested_at',
            'executed_at',
            'resolved_at',
            'input_payload',
            'output_payload',
            'error_message',
            'target_entity_type',
            'target_entity_id',
            'created_on',
            'modified_on',
        ]
        read_only_fields = fields


class AIApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIApproval
        fields = [
            'id',
            'tenant',
            'run',
            'task',
            'requested_by',
            'resolved_by',
            'tool_name',
            'status',
            'request_payload',
            'response_payload',
            'resolution_note',
            'expires_at',
            'resolved_at',
            'created_on',
            'modified_on',
        ]
        read_only_fields = fields


class AIApprovalResolutionRequestSerializer(serializers.Serializer):
    resolution_note = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class AIApprovalActionResponseSerializer(serializers.Serializer):
    approval = AIApprovalSerializer()
    task = AITaskSerializer()
    run = AIRunSerializer()


class PendingReviewItemSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    document_id = serializers.UUIDField()
    document_type = serializers.CharField()
    confidence_score = serializers.FloatField()
    precision_delta = serializers.FloatField()
    created_on = serializers.DateTimeField()
    original_extracted_data = serializers.JSONField()
    sender = serializers.CharField(required=False, allow_blank=True)
    source_subject = serializers.CharField(required=False, allow_blank=True)
    source_summary = serializers.CharField(required=False, allow_blank=True)
    source_document_name = serializers.CharField(required=False, allow_blank=True)
    intent_label = serializers.CharField(required=False, allow_blank=True)
    review_entity_type = serializers.CharField(required=False, allow_blank=True)
    review_target_url = serializers.CharField(required=False, allow_blank=True)
    feedback_signal = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    feedback_comment = serializers.CharField(required=False, allow_blank=True)
    retraining_status = serializers.CharField(required=False, allow_blank=True)
    retraining_queued_at = serializers.DateTimeField(required=False, allow_null=True)
    attachment_count = serializers.IntegerField(required=False, default=0)
    attachment_filenames = serializers.ListField(
        child=serializers.CharField(), required=False, default=list,
    )


class PendingReviewListResponseSerializer(serializers.Serializer):
    pending_reviews = PendingReviewItemSerializer(many=True)
    results = PendingReviewItemSerializer(many=True)


class PendingReviewResolveResponseSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    resolved_by = serializers.UUIDField()
    precision_delta = serializers.FloatField()


class AIFeedbackLogSerializer(serializers.ModelSerializer):
    """Model serializer for AIFeedbackLog (staff-only admin APIs)."""

    class Meta:
        model = AIFeedbackLog
        fields = [
            'id',
            'tenant',
            'document_id',
            'document_type',
            'original_extracted_data',
            'user_corrected_data',
            'confidence_score',
            'precision_delta',
            'feedback_signal',
            'feedback_comment',
            'feedback_source',
            'submitted_by',
            'retraining_status',
            'retraining_queued_at',
            'resolved_by',
            'created_on',
            'modified_on',
        ]
        read_only_fields = ['id', 'tenant', 'precision_delta', 'created_on', 'modified_on']


# ---------------------------------------------------------------------------
# RT-02.4: Cockpit Draft Form serializers
# ---------------------------------------------------------------------------


class CockpitDraftFormSerializer(serializers.ModelSerializer):
    """Read serializer for CockpitDraftForm."""

    class Meta:
        from tenant_apps.ai_assistant.models import CockpitDraftForm

        model = CockpitDraftForm
        fields = [
            'id',
            'tenant',
            'source_feedback_id',
            'source_document_id',
            'form_type',
            'form_data',
            'parsed_payload',
            'status',
            'assigned_to',
            'submitted_entity_type',
            'submitted_entity_id',
            'submitted_at',
            'submitted_by',
            'notes',
            'created_on',
            'modified_on',
        ]
        read_only_fields = ['id', 'tenant', 'created_on', 'modified_on']


class CockpitDraftCreateSerializer(serializers.Serializer):
    """Create a draft from an existing feedback item (route to cockpit)."""

    feedback_id = serializers.IntegerField(help_text="AIFeedbackLog PK to route")
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class CockpitDraftUpdateSerializer(serializers.Serializer):
    """Update draft form_data or status."""

    form_data = serializers.JSONField(required=False)
    status = serializers.ChoiceField(
        choices=[('in_progress', 'In Progress'), ('submitted', 'Submitted'), ('discarded', 'Discarded')],
        required=False,
    )
    submitted_entity_type = serializers.CharField(required=False, allow_blank=True, default='')
    submitted_entity_id = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')

