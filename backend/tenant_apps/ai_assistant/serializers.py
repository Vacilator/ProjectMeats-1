"""
Serializers for AI Assistant functionality.
"""
from rest_framework import serializers
from .models import AIConfiguration, ChatMessage, ChatSession


class VectorMemorySearchRequestSerializer(serializers.Serializer):
    embedding = serializers.ListField(child=serializers.FloatField(), allow_empty=False)
    top_k = serializers.IntegerField(required=False, default=5, min_value=1, max_value=50)

    def validate_embedding(self, value):
        if len(value) != 1536:
            raise serializers.ValidationError('embedding must be a 1536-length float array')
        return value


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


class AIConfigurationSerializer(serializers.ModelSerializer):
    """Serializer for AI configurations."""

    class Meta:
        model = AIConfiguration
        fields = ["id", "name", "provider", "model_name", "is_default"]


class VectorMemorySearchResultSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    source_type = serializers.CharField()
    document_id = serializers.UUIDField(allow_null=True, required=False)
    distance = serializers.FloatField()
    content_preview = serializers.CharField()
    metadata = serializers.JSONField()


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
