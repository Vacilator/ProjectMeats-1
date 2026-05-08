"""
Django admin configuration for AI Assistant app.
"""
from django.contrib import admin
from apps.core.admin_site import admin_site
from .models import (
    ChatSession, ChatMessage, AIConfiguration,
    AIFeedbackLog, AIRun, AIApproval, CockpitDraftForm,
)


class ChatSessionAdmin(admin.ModelAdmin):
    """Admin interface for ChatSession model."""

    list_display = (
        "title",
        "owner",
        "session_status",
        "get_message_count",
        "last_activity",
        "created_on",
    )
    list_filter = ("session_status", "status", "created_on", "last_activity")
    search_fields = ("title", "owner__username")
    readonly_fields = ("id", "created_on", "modified_on", "last_activity")

    def get_message_count(self, obj):
        """Return the number of messages in this session."""
        return obj.chatmessage_set.count()

    get_message_count.short_description = "Messages"

    fieldsets = (
        (
            "Basic Information",
            {"fields": ("title", "owner", "session_status", "status")},
        ),
        ("Context & Data", {"fields": ("context_data",), "classes": ("collapse",)}),
        (
            "Metadata",
            {
                "fields": ("id", "created_on", "modified_on", "last_activity"),
                "classes": ("collapse",),
            },
        ),
    )


class ChatMessageAdmin(admin.ModelAdmin):
    """Admin interface for ChatMessage model."""

    list_display = (
        "get_content_preview",
        "session",
        "message_type",
        "owner",
        "is_processed",
        "created_on",
    )
    list_filter = ("message_type", "is_processed", "created_on")
    search_fields = ("content", "session__title", "owner__username")
    readonly_fields = ("id", "created_on", "modified_on")

    def get_content_preview(self, obj):
        """Return a preview of the message content."""
        return obj.content[:100] + "..." if len(obj.content) > 100 else obj.content

    get_content_preview.short_description = "Content Preview"

    fieldsets = (
        (
            "Message Information",
            {"fields": ("session", "message_type", "owner", "is_processed")},
        ),
        ("Content", {"fields": ("content",)}),
        ("Metadata", {"fields": ("metadata",), "classes": ("collapse",)}),
        (
            "System Information",
            {"fields": ("id", "created_on", "modified_on"), "classes": ("collapse",)},
        ),
    )


class AIConfigurationAdmin(admin.ModelAdmin):
    """Admin interface for AIConfiguration model."""

    list_display = (
        "name",
        "provider",
        "model_name",
        "is_active",
        "is_default",
        "created_at",
    )
    list_filter = ("provider", "is_active", "is_default", "created_at")
    search_fields = ("name", "model_name")
    readonly_fields = ("created_at",)

    fieldsets = (
        ("Configuration", {"fields": ("name", "provider", "model_name")}),
        ("Settings", {"fields": ("is_active", "is_default")}),
        ("Metadata", {"fields": ("created_at",), "classes": ("collapse",)}),
    )


# Register models with custom admin site
admin_site.register(ChatSession, ChatSessionAdmin)
admin_site.register(ChatMessage, ChatMessageAdmin)
admin_site.register(AIConfiguration, AIConfigurationAdmin)


class AIFeedbackLogAdmin(admin.ModelAdmin):
    """Admin for AI feedback/retraining review."""

    list_display = ['document_type', 'feedback_signal', 'confidence_score', 'retraining_status', 'created_on']
    list_filter = ['feedback_signal', 'retraining_status', 'document_type', 'tenant']
    search_fields = ['document_type', 'feedback_comment']
    readonly_fields = ['created_on', 'modified_on']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('tenant', 'submitted_by')


class AIRunAdmin(admin.ModelAdmin):
    """Admin for AI execution run tracking."""

    list_display = ['id', 'source', 'event_type', 'status', 'intent', 'created_on']
    list_filter = ['status', 'source', 'event_type', 'tenant']
    search_fields = ['intent', 'user_message', 'correlation_id']
    readonly_fields = ['id', 'created_on', 'modified_on', 'completed_at']
    raw_id_fields = ['session', 'requested_by']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('tenant', 'requested_by', 'session')


class AIApprovalAdmin(admin.ModelAdmin):
    """Admin for AI approval workflow items."""

    list_display = ['id', 'tool_name', 'status', 'requested_by', 'resolved_by', 'created_on']
    list_filter = ['status', 'tool_name', 'tenant']
    search_fields = ['tool_name', 'resolution_note']
    readonly_fields = ['id', 'created_on', 'modified_on', 'resolved_at', 'expires_at']
    raw_id_fields = ['run', 'task', 'requested_by', 'resolved_by']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('tenant', 'requested_by', 'resolved_by')


class CockpitDraftFormAdmin(admin.ModelAdmin):
    """Admin for AI inbox draft forms."""

    list_display = ['id', 'form_type', 'status', 'assigned_to', 'created_on']
    list_filter = ['status', 'form_type', 'tenant']
    search_fields = ['form_type']
    readonly_fields = ['id', 'created_on', 'modified_on']
    raw_id_fields = ['assigned_to']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('tenant', 'assigned_to')


admin_site.register(AIFeedbackLog, AIFeedbackLogAdmin)
admin_site.register(AIRun, AIRunAdmin)
admin_site.register(AIApproval, AIApprovalAdmin)
admin_site.register(CockpitDraftForm, CockpitDraftFormAdmin)
