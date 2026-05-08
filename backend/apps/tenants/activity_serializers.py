"""
Serializers for activity logging.
"""

from rest_framework import serializers

from .activity_models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    """Serializer for ActivityLog model.

    Frontend Admin Workspace expects nested user + tenant objects.
    """

    tenant = serializers.SerializerMethodField()
    user = serializers.SerializerMethodField()
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = ActivityLog
        fields = [
            "id",
            "tenant",
            "user",
            "action",
            "action_display",
            "entity_type",
            "entity_id",
            "description",
            "metadata",
            "ip_address",
            "created_at",
        ]
        read_only_fields = fields

    def get_user(self, obj):
        if not obj.user:
            return None

        return {
            "id": obj.user.id,
            "username": obj.user.username,
            "first_name": obj.user.first_name,
            "last_name": obj.user.last_name,
        }

    def get_tenant(self, obj):
        return {
            "id": obj.tenant_id,
            "name": obj.tenant.name,
        }
