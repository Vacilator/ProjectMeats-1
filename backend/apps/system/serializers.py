"""
Serializers for System app API.

Provides DRF serializers for:
- SystemChoiceList (with nested items)
- SystemChoiceItem
- SystemFieldSchema
- TenantConfig
- ConfigAuditLog
- Product (system-wide)
- TenantProductPreference (tenant customizations)
"""
from rest_framework import serializers

from apps.system.models import (
    SystemChoiceList,
    SystemChoiceItem,
    SystemFieldSchema,
    TenantConfig,
    ConfigAuditLog,
    Product,
    TenantProductPreference,
    TenantChoiceOverride,
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


class TenantChoiceOverrideSerializer(serializers.ModelSerializer):
    """Serializer for tenant-specific choice list overrides."""

    class Meta:
        model = TenantChoiceOverride
        fields = [
            'id',
            'tenant',
            'choice_list',
            'disabled_system_items',
            'display_config',
            'notes',
            'updated_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'tenant', 'updated_by', 'created_at', 'updated_at']


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
        read_only_fields = [
            'id',
            'entity_type',
            'entity_name',
            'change_type',
            'field_name',
            'user_display',
            'created_at',
        ]
    
    def get_user_display(self, obj):
        """Return user display name or email."""
        if obj.user:
            return obj.user.get_full_name() or obj.user.email
        return obj.user_email or 'System'


# === PRODUCT SERIALIZERS ===

class SystemProductSerializer(serializers.ModelSerializer):
    """
    Serializer for system-wide products (read-only).
    
    System products are the master catalog shared by all tenants.
    Created via: python manage.py seed_system_products
    
    Validation Layer (Phase 3):
    - Enforces protein_type against SystemChoiceList
    - Prevents "Zombie Products" with invalid categories
    - Maintains cascade filtering data contract
    """
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    is_frozen = serializers.BooleanField(read_only=True)
    is_fresh = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Product
        fields = [
            'id',
            'product_code',
            'name',
            'description',
            'category',
            'category_display',
            'protein_type',
            'fresh_or_frozen',
            'is_frozen',
            'is_fresh',
            'package_type',
            'carton_type',
            'unit_weight',
            'uom',
            'pcs_per_carton',
            'namp_code',
            'usda_code',
            'ub_code',
            'edible_or_inedible',
            'net_or_catch',
            'tested_product',
            'is_active',
            'is_system',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'product_code',
            'name',
            'description',
            'category',
            'category_display',
            'protein_type',
            'fresh_or_frozen',
            'is_frozen',
            'is_fresh',
            'package_type',
            'carton_type',
            'unit_weight',
            'uom',
            'pcs_per_carton',
            'namp_code',
            'usda_code',
            'ub_code',
            'edible_or_inedible',
            'net_or_catch',
            'tested_product',
            'is_active',
            'is_system',
            'created_at',
            'updated_at',
        ]
    
    def validate_protein_type(self, value):
        """
        Validate protein_type against SystemChoiceList.
        
        This provides early validation at the API layer before
        the model's clean() method runs.
        """
        from apps.system.validators.product_validators import validate_protein_type
        
        if value:
            # Normalize and validate
            normalized_value = value.lower().strip()
            validate_protein_type(normalized_value)
            return normalized_value
        return value  # All fields read-only


class TenantProductPreferenceSerializer(serializers.ModelSerializer):
    """
    Serializer for tenant product preferences.
    
    Allows tenants to customize system products:
    - Custom display names
    - Pricing
    - Preferred suppliers
    - Favorites
    """
    product_code = serializers.CharField(source='product.product_code', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    effective_name = serializers.CharField(read_only=True)
    effective_code = serializers.CharField(read_only=True)
    
    class Meta:
        model = TenantProductPreference
        fields = [
            'id',
            'product',
            'product_code',
            'product_name',
            'display_name',
            'effective_name',
            'internal_code',
            'effective_code',
            'notes',
            'default_price',
            'default_cost',
            'preferred_supplier',
            'supplier_item_number',
            'is_active',
            'is_custom',
            'is_favorite',
            'sort_order',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'product_code', 'product_name', 'effective_name', 'effective_code']


class TenantProductSerializer(serializers.ModelSerializer):
    """
    Serializer for combined product + tenant preference.
    
    Used in /api/v1/products/my-products/ endpoint.
    Returns system product data WITH tenant customizations.
    """
    # System product fields
    product_code = serializers.CharField(source='product.product_code', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    description = serializers.CharField(source='product.description', read_only=True)
    category = serializers.CharField(source='product.category', read_only=True)
    protein_type = serializers.CharField(source='product.protein_type', read_only=True)
    fresh_or_frozen = serializers.CharField(source='product.fresh_or_frozen', read_only=True)
    package_type = serializers.CharField(source='product.package_type', read_only=True)
    unit_weight = serializers.DecimalField(source='product.unit_weight', max_digits=10, decimal_places=2, read_only=True)
    uom = serializers.CharField(source='product.uom', read_only=True)
    namp_code = serializers.CharField(source='product.namp_code', read_only=True)
    
    # Tenant preference fields
    effective_name = serializers.CharField(read_only=True)
    effective_code = serializers.CharField(read_only=True)
    
    class Meta:
        model = TenantProductPreference
        fields = [
            'id',
            'product',
            'product_code',
            'product_name',
            'description',
            'category',
            'protein_type',
            'fresh_or_frozen',
            'package_type',
            'unit_weight',
            'uom',
            'namp_code',
            'display_name',
            'effective_name',
            'effective_code',
            'default_price',
            'default_cost',
            'preferred_supplier',
            'is_active',
            'is_favorite',
            'sort_order',
        ]
        read_only_fields = [
            'id',
            'product',
            'product_code',
            'product_name',
            'description',
            'category',
            'protein_type',
            'fresh_or_frozen',
            'package_type',
            'unit_weight',
            'uom',
            'namp_code',
            'display_name',
            'effective_name',
            'effective_code',
            'default_price',
            'default_cost',
            'preferred_supplier',
            'is_active',
            'is_favorite',
            'sort_order',
        ]  # All read-only (used for display)
