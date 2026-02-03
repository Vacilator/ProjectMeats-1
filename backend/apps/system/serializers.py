"""
Serializers for System app API.

Provides DRF serializers for:
- SystemChoiceList (with nested items)
- SystemChoiceItem
- SystemFieldSchema
- TenantConfig
- ConfigAuditLog
"""
from rest_framework import serializers

from apps.system.models import (
    SystemChoiceList,
    SystemChoiceItem,
    SystemFieldSchema,
    TenantConfig,
    ConfigAuditLog,
)


class SystemChoiceItemSerializer(serializers.ModelSerializer):
    """Serializer for SystemChoiceItem."""
    is_system_defined = serializers.ReadOnlyField()
    
    class Meta:
        model = SystemChoiceItem
        fields = [
            'id',
            'value',
            'label',
            'extra_data',
            'order',
            'is_active',
            'is_default',
            'is_system_defined',
        ]
        read_only_fields = ['id', 'is_system_defined']


class SystemChoiceListSerializer(serializers.ModelSerializer):
    """Serializer for SystemChoiceList with nested items."""
    items = SystemChoiceItemSerializer(many=True, read_only=True)
    items_count = serializers.ReadOnlyField()
    
    class Meta:
        model = SystemChoiceList
        fields = [
            'id',
            'slug',
            'name',
            'description',
            'model_field_path',
            'is_extensible',
            'is_reorderable',
            'items_count',
            'items',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'items_count']


class SystemChoiceListMinimalSerializer(serializers.ModelSerializer):
    """Minimal serializer for listing choice lists without items."""
    items_count = serializers.ReadOnlyField()
    
    class Meta:
        model = SystemChoiceList
        fields = ['id', 'slug', 'name', 'items_count']


class SystemFieldSchemaSerializer(serializers.ModelSerializer):
    """Serializer for SystemFieldSchema."""
    app_label = serializers.ReadOnlyField()
    model_name = serializers.ReadOnlyField()
    field_name = serializers.ReadOnlyField()
    choice_list_slug = serializers.SlugRelatedField(
        source='choice_list',
        slug_field='slug',
        queryset=SystemChoiceList.objects.all(),
        allow_null=True,
        required=False
    )
    
    class Meta:
        model = SystemFieldSchema
        fields = [
            'id',
            'field_path',
            'field_type',
            'app_label',
            'model_name',
            'field_name',
            'label',
            'help_text',
            'placeholder',
            'validation_rules',
            'default_value',
            'is_required',
            'is_readonly',
            'is_hidden',
            'choice_list_slug',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'app_label', 'model_name', 'field_name']


class TenantConfigSerializer(serializers.ModelSerializer):
    """Serializer for TenantConfig."""
    key_parts = serializers.ReadOnlyField()
    
    class Meta:
        model = TenantConfig
        fields = [
            'id',
            'key',
            'value',
            'category',
            'description',
            'key_parts',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'key_parts']


class ChoiceItemCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating tenant-specific choice items."""
    
    class Meta:
        model = SystemChoiceItem
        fields = ['value', 'label', 'extra_data', 'order', 'is_active', 'is_default']
    
    def validate_value(self, value):
        """Ensure value is unique within the choice list for this tenant."""
        choice_list = self.context.get('choice_list')
        tenant = self.context.get('tenant')
        
        if choice_list and tenant:
            existing = SystemChoiceItem.objects.filter(
                choice_list=choice_list,
                tenant=tenant,
                value=value
            ).exists()
            if existing:
                raise serializers.ValidationError(
                    f"Choice item with value '{value}' already exists for this tenant."
                )
        return value


class BulkChoiceUpdateSerializer(serializers.Serializer):
    """Serializer for bulk updating choice item order."""
    items = serializers.ListField(
        child=serializers.DictField(
            child=serializers.CharField()
        )
    )
    
    def validate_items(self, value):
        """Validate item structure."""
        for item in value:
            if 'id' not in item or 'order' not in item:
                raise serializers.ValidationError(
                    "Each item must have 'id' and 'order' fields."
                )
            try:
                int(item['order'])
            except ValueError:
                raise serializers.ValidationError(
                    f"Invalid order value: {item['order']}"
                )
        return value


class ConfigAuditLogSerializer(serializers.ModelSerializer):
    """Serializer for ConfigAuditLog - read-only audit trail."""
    user_display = serializers.SerializerMethodField()
    change_type_display = serializers.CharField(source='get_change_type_display', read_only=True)
    
    class Meta:
        model = ConfigAuditLog
        fields = [
            'id',
            'entity_type',
            'entity_name',
            'change_type',
            'change_type_display',
            'field_name',
            'old_value',
            'new_value',
            'snapshot_before',
            'snapshot_after',
            'user',
            'user_email',
            'user_display',
            'tenant',
            'ip_address',
            'notes',
            'created_at',
        ]
        read_only_fields = fields
    
    def get_user_display(self, obj):
        """Return user display name or email."""
        if obj.user:
            return obj.user.get_full_name() or obj.user.email
        return obj.user_email or 'System'


class ConfigAuditLogSummarySerializer(serializers.ModelSerializer):
    """Minimal serializer for audit log listings."""
    user_display = serializers.SerializerMethodField()
    
    class Meta:
        model = ConfigAuditLog
        fields = [
            'id',
            'entity_type',
            'entity_name',
            'change_type',
            'field_name',
            'user_display',
            'created_at',
        ]
        read_only_fields = fields
    
    def get_user_display(self, obj):
        """Return user display name or email."""
        if obj.user:
            return obj.user.get_full_name() or obj.user.email
        return obj.user_email or 'System'
