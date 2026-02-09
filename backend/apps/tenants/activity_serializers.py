"""
Serializers for activity logging.
"""

from rest_framework import serializers
from .activity_models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    """Serializer for ActivityLog model."""
    
    user_name = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    
    class Meta:
        model = ActivityLog
        fields = [
            'id',
            'tenant',
            'user',
            'user_name',
            'action',
            'action_display',
            'entity_type',
            'entity_id',
            'description',
            'metadata',
            'ip_address',
            'created_at',
        ]
        read_only_fields = fields
    
    def get_user_name(self, obj):
        """Get username or 'System' if user is None."""
        return obj.user.username if obj.user else 'System'
