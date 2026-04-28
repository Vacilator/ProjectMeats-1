"""
Serializers for AI Assistant functionality.
"""
from rest_framework import serializers

from .models import AIDocument, AIFeedbackLog, AIConfiguration, ChatMessage, ChatSession
from .services.document_parser import validate_ai_document_upload



class PendingReviewResolveRequestSerializer(serializers.Serializer):
    user_corrected_data = serializers.JSONField(required=False, allow_null=True)

    def validate_user_corrected_data(self, value):
        if value is None:
            return value
        if not isinstance(value, dict):
            raise serializers.ValidationError('user_corrected_data must be an object')
        return value


class AIFeedbackSubmitSerializer(serializers.Serializer):
    """Public-ish write path for HITL corrections.

    The frontend HITL card posts corrected key/value fields here.
    """

    document_id = serializers.UUIDField()
    document_type = serializers.CharField(required=False, allow_blank=True, default='unknown', max_length=64)

    original_extracted_data = serializers.JSONField(required=False, default=dict)
    user_corrected_data = serializers.JSONField(required=False, default=dict)

    confidence_score = serializers.FloatField(required=False, default=0.0)

    def validate_original_extracted_data(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('original_extracted_data must be an object')
        return value

    def validate_user_corrected_data(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('user_corrected_data must be an object')
        return value


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


class AIDocumentSerializer(serializers.ModelSerializer):
    """Serializer for AI assistant document uploads.

    Additive compatibility: some frontend surfaces expect `file_type` and
    `document_type` fields. The canonical stored field is `content_type`, and
    document classification may not be available at upload time.
    """

    file_type = serializers.CharField(source='content_type', read_only=True)
    document_type = serializers.SerializerMethodField(read_only=True)

    def validate_session(self, value):
        request = self.context.get('request')
        if not value or not request:
            return value

        if getattr(value, 'owner_id', None) != getattr(request.user, 'id', None):
            raise serializers.ValidationError('Session not found')

        return value

    def get_document_type(self, obj) -> str:
        # Classification may happen asynchronously; keep this additive and deterministic.
        return 'unknown'

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
            'created_on',
        ]
        read_only_fields = ['id', 'tenant', 'owner', 'content_type', 'file_type', 'file_size', 'document_type', 'created_on']


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


class PendingReviewItemSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    document_id = serializers.UUIDField()
    document_type = serializers.CharField()
    confidence_score = serializers.FloatField()
    precision_delta = serializers.FloatField()
    created_on = serializers.DateTimeField()
    original_extracted_data = serializers.JSONField()


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
            'resolved_by',
            'created_on',
            'modified_on',
        ]
        read_only_fields = ['id', 'tenant', 'precision_delta', 'created_on', 'modified_on']
