"""Serializers for Inquiries app."""
from rest_framework import serializers
from .models import (
    Inquiry, InquiryProduct, InquiryStatusChoices,
    InquiryTemplate, InquiryTemplateProduct
)


class InquiryProductSerializer(serializers.ModelSerializer):
    """Serializer for InquiryProduct model."""
    
    product_code = serializers.CharField(source='product.product_code', read_only=True)
    product_description = serializers.CharField(source='product.description', read_only=True)
    margin = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    margin_percent = serializers.DecimalField(
        max_digits=8, decimal_places=2, read_only=True
    )
    
    class Meta:
        model = InquiryProduct
        fields = [
            'id', 'product', 'product_code', 'product_description', 'quantity',
            # Desired fields
            'desired_total', 'desired_price_per_unit', 'desired_uom', 'desired_uom_value',
            'desired_processed_date', 'desired_expiration_date', 'desired_available_date',
            'desired_shipping_date', 'desired_delivery_date',
            # Actual fields
            'actual_total', 'actual_price_per_unit', 'actual_uom', 'actual_uom_value',
            'actual_processed_date', 'actual_expiration_date', 'actual_available_date',
            'actual_shipping_date', 'actual_delivery_date',
            # Calculated
            'margin', 'margin_percent',
            # Meta
            'notes', 'created_on', 'modified_on'
        ]
        read_only_fields = ['id', 'created_on', 'modified_on']


class InquiryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for inquiry list views.

    NOTE: The frontend expects a few convenience aliases (customer_name, supplier_name, source, created_on).
    We expose those additively without removing the canonical model fields.
    """

    entity_name = serializers.SerializerMethodField()
    customer = serializers.IntegerField(source='customer_id', read_only=True, allow_null=True, required=False)
    supplier = serializers.IntegerField(source='supplier_id', read_only=True, allow_null=True, required=False)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    source = serializers.CharField(source='source_type', read_only=True)
    product_count = serializers.IntegerField(source='products.count', read_only=True)
    total_desired = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_actual = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Inquiry
        fields = [
            'id',
            'inquiry_number',
            'status',
            # Canonical model fields
            'source_type',
            'entity_type',
            'shipping_type',
            # Convenience aliases (frontend)
            'source',
            'customer',
            'customer_name',
            'supplier',
            'supplier_name',
            'entity_name',
            'contact_name',
            'contact_company',
            'inquiry_date',
            'created_on',
            'valid_until',
            'is_expired',
            'product_count',
            'total_desired',
            'total_actual',
        ]
    
    def get_entity_name(self, obj):
        """Get the name of the linked entity."""
        if obj.supplier:
            return obj.supplier.name
        elif obj.customer:
            return obj.customer.name
        return None


class InquiryDetailSerializer(serializers.ModelSerializer):
    """Full serializer for inquiry detail views.

    Exposes frontend-friendly aliases additively (source, customer_name/supplier_name,
    contact_snapshot_* fields) while keeping canonical fields.
    """

    products = InquiryProductSerializer(many=True, read_only=True)
    entity_name = serializers.SerializerMethodField()
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    source = serializers.CharField(source='source_type', read_only=True)
    scheduled_call = serializers.IntegerField(source='source_call_id', read_only=True, allow_null=True, required=False)

    contact_snapshot_name = serializers.CharField(source='contact_name', read_only=True)
    contact_snapshot_email = serializers.CharField(source='contact_email', read_only=True)
    contact_snapshot_phone = serializers.CharField(source='contact_phone', read_only=True)
    contact_snapshot_company = serializers.CharField(source='contact_company', read_only=True)
    contact_snapshot_position = serializers.CharField(source='contact_position', read_only=True)

    total_desired = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_actual = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_margin = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    total_margin_percent = serializers.DecimalField(
        max_digits=8, decimal_places=2, read_only=True
    )
    is_expired = serializers.BooleanField(read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True
    )
    
    class Meta:
        model = Inquiry
        fields = [
            'id',
            'inquiry_number',
            'status',
            # Canonical model fields
            'source_type',
            'entity_type',
            'shipping_type',
            # Convenience aliases (frontend)
            'source',
            'customer_name',
            'supplier_name',
            'scheduled_call',
            # Entity links
            'supplier',
            'customer',
            'contact',
            'entity_name',
            # Contact snapshot (canonical)
            'contact_name',
            'contact_email',
            'contact_phone',
            'contact_phone_type',
            'contact_company',
            'contact_position',
            # Contact snapshot (aliases)
            'contact_snapshot_name',
            'contact_snapshot_email',
            'contact_snapshot_phone',
            'contact_snapshot_company',
            'contact_snapshot_position',
            # Dates
            'inquiry_date',
            'quoted_date',
            'decision_date',
            'valid_until',
            'is_expired',
            # Totals
            'total_desired',
            'total_actual',
            'total_margin',
            'total_margin_percent',
            # Notes
            'notes',
            'competitor_names',
            'competitor_pricing_notes',
            'win_loss_reason',
            # Related
            'source_call',
            'products',
            # Meta
            'created_by',
            'created_by_name',
            'created_on',
            'modified_on',
        ]
        read_only_fields = [
            'id', 'inquiry_number', 'created_on', 'modified_on',
            'total_desired', 'total_actual', 'total_margin', 'total_margin_percent'
        ]
    
    def get_entity_name(self, obj):
        """Get the name of the linked entity."""
        if obj.supplier:
            return obj.supplier.name
        elif obj.customer:
            return obj.customer.name
        return None


class InquiryCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating inquiries with nested products."""
    
    products = InquiryProductSerializer(many=True, required=False)
    
    class Meta:
        model = Inquiry
        fields = [
            'entity_type', 'shipping_type', 'supplier', 'customer', 'contact',
            'contact_name', 'contact_email', 'contact_phone', 'contact_phone_type',
            'contact_company', 'contact_position',
            'source_type', 'source_call', 'valid_until',
            'notes', 'competitor_names', 'competitor_pricing_notes',
            'products'
        ]
    
    def validate(self, data):
        """Validate entity type matches entity link."""
        entity_type = data.get('entity_type')
        supplier = data.get('supplier')
        customer = data.get('customer')
        
        if entity_type == 'supplier' and not supplier:
            raise serializers.ValidationError({
                'supplier': 'Supplier is required when entity_type is supplier'
            })
        if entity_type == 'customer' and not customer:
            raise serializers.ValidationError({
                'customer': 'Customer is required when entity_type is customer'
            })
        
        return data
    
    def create(self, validated_data):
        """Create inquiry with nested products."""
        products_data = validated_data.pop('products', [])
        
        # Set tenant and created_by from context
        request = self.context.get('request')
        if request:
            validated_data['tenant'] = request.tenant
            validated_data['created_by'] = request.user
        
        inquiry = Inquiry.objects.create(**validated_data)
        
        # Create nested products
        for product_data in products_data:
            InquiryProduct.objects.create(inquiry=inquiry, **product_data)
        
        return inquiry


class AddProductsSerializer(serializers.Serializer):
    """Serializer for adding products to an existing inquiry."""
    
    products = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
        help_text="List of product data to add"
    )
    
    def validate_products(self, value):
        """Validate product data."""
        for product_data in value:
            if 'product' not in product_data:
                raise serializers.ValidationError(
                    "Each product must include a 'product' ID"
                )
        return value


class FromCallSerializer(serializers.Serializer):
    """Serializer for pre-populating inquiry from a call."""
    
    call_id = serializers.UUIDField(required=True)


# ============================================================================
# TEMPLATE SERIALIZERS
# ============================================================================

class InquiryTemplateProductSerializer(serializers.ModelSerializer):
    """Serializer for template products."""
    
    product_code = serializers.CharField(source='product.product_code', read_only=True)
    product_description = serializers.CharField(source='product.description', read_only=True)
    
    class Meta:
        model = InquiryTemplateProduct
        fields = [
            'id', 'product', 'product_code', 'product_description',
            'default_quantity', 'default_uom', 'default_price_per_unit',
            'notes', 'sort_order'
        ]
        read_only_fields = ['id']


class InquiryTemplateListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for template list views."""
    
    product_count = serializers.IntegerField(source='products.count', read_only=True)
    
    class Meta:
        model = InquiryTemplate
        fields = [
            'id', 'name', 'description', 'entity_type', 'is_active',
            'default_valid_days', 'use_count', 'product_count',
            'created_on', 'modified_on'
        ]


class InquiryTemplateDetailSerializer(serializers.ModelSerializer):
    """Full serializer for template detail views."""
    
    products = InquiryTemplateProductSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True
    )
    
    class Meta:
        model = InquiryTemplate
        fields = [
            'id', 'name', 'description', 'entity_type', 'is_active',
            'default_valid_days', 'default_notes', 'use_count',
            'products', 'created_by', 'created_by_name',
            'created_on', 'modified_on'
        ]
        read_only_fields = ['id', 'use_count', 'created_on', 'modified_on']


class InquiryTemplateCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating templates with nested products."""
    
    products = InquiryTemplateProductSerializer(many=True, required=False)
    
    class Meta:
        model = InquiryTemplate
        fields = [
            'name', 'description', 'entity_type', 'is_active',
            'default_valid_days', 'default_notes', 'products'
        ]
    
    def create(self, validated_data):
        """Create template with nested products."""
        products_data = validated_data.pop('products', [])
        
        request = self.context.get('request')
        if request:
            validated_data['tenant'] = request.tenant
            validated_data['created_by'] = request.user
        
        template = InquiryTemplate.objects.create(**validated_data)
        
        for idx, product_data in enumerate(products_data):
            product_data['sort_order'] = product_data.get('sort_order', idx)
            InquiryTemplateProduct.objects.create(template=template, **product_data)
        
        return template
    
    def update(self, instance, validated_data):
        """Update template with nested products."""
        products_data = validated_data.pop('products', None)
        
        # Update template fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # If products provided, replace them
        if products_data is not None:
            instance.products.all().delete()
            for idx, product_data in enumerate(products_data):
                product_data['sort_order'] = product_data.get('sort_order', idx)
                InquiryTemplateProduct.objects.create(template=instance, **product_data)
        
        return instance


class CloneInquirySerializer(serializers.Serializer):
    """Serializer for cloning an existing inquiry."""
    
    include_products = serializers.BooleanField(default=True)
    include_pricing = serializers.BooleanField(default=False)
    new_entity_id = serializers.UUIDField(required=False, allow_null=True)
    new_contact_id = serializers.UUIDField(required=False, allow_null=True)
