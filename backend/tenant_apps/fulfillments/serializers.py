"""Serializers for Fulfillments app."""
from rest_framework import serializers

from apps.core.serializers_trade import TradeTimelineSerializerMixin

from .models import Fulfillment, FulfillmentProduct


class FulfillmentProductSerializer(serializers.ModelSerializer):
    """Serializer for FulfillmentProduct model."""

    product_code = serializers.CharField(source="inquiry_product.product.product_code", read_only=True)
    product_description = serializers.CharField(source="inquiry_product.product.description", read_only=True)
    inquiry_quantity = serializers.DecimalField(
        source="inquiry_product.quantity", max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = FulfillmentProduct
        fields = [
            "id",
            "inquiry_product",
            "product_code",
            "product_description",
            "inquiry_quantity",
            "quantity_fulfilled",
            "unit_price",
            "total",
            "notes",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "created_on", "modified_on"]


class FulfillmentListSerializer(TradeTimelineSerializerMixin, serializers.ModelSerializer):
    """Lightweight serializer for fulfillment list views."""

    trade_timeline = serializers.SerializerMethodField()
    trade_datetime_fields = ("created_on",)
    trade_date_fields = ("ship_date", "expected_delivery", "actual_delivery")

    inquiry_number = serializers.CharField(source="inquiry.inquiry_number", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    carrier_name = serializers.CharField(source="carrier.name", read_only=True)
    product_count = serializers.IntegerField(source="products.count", read_only=True)
    total_value = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Fulfillment
        fields = [
            "id",
            "fulfillment_number",
            "inquiry",
            "inquiry_number",
            "status",
            "supplier",
            "supplier_name",
            "customer",
            "customer_name",
            "carrier",
            "carrier_name",
            "shipping_type",
            "ship_date",
            "expected_delivery",
            "actual_delivery",
            "product_count",
            "total_value",
            "tracking_numbers",
            "freight_cost",
            "document_milestones",
            "trade_timeline",
            "created_on",
        ]


class FulfillmentDetailSerializer(TradeTimelineSerializerMixin, serializers.ModelSerializer):
    """Full serializer for fulfillment detail views."""

    trade_timeline = serializers.SerializerMethodField()
    trade_datetime_fields = ("created_on", "modified_on")
    trade_date_fields = ("ship_date", "expected_delivery", "actual_delivery")

    products = FulfillmentProductSerializer(many=True, read_only=True)
    inquiry_number = serializers.CharField(source="inquiry.inquiry_number", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    carrier_name = serializers.CharField(source="carrier.name", read_only=True)
    total_value = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    is_partial = serializers.BooleanField(read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    shipped_by_name = serializers.CharField(source="shipped_by.get_full_name", read_only=True)

    class Meta:
        model = Fulfillment
        fields = [
            "id",
            "fulfillment_number",
            "inquiry",
            "inquiry_number",
            "status",
            "supplier",
            "supplier_name",
            "customer",
            "customer_name",
            "carrier",
            "carrier_name",
            "shipping_type",
            "ship_date",
            "expected_delivery",
            "actual_delivery",
            "tracking_numbers",
            "freight_cost",
            "document_milestones",
            "notes",
            "products",
            "total_value",
            "is_partial",
            "created_by",
            "created_by_name",
            "shipped_by",
            "shipped_by_name",
            "trade_timeline",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "fulfillment_number", "created_on", "modified_on", "total_value", "is_partial"]


class FulfillmentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating fulfillments with nested products."""

    products = FulfillmentProductSerializer(many=True, required=False)

    class Meta:
        model = Fulfillment
        fields = [
            "inquiry",
            "supplier",
            "customer",
            "carrier",
            "shipping_type",
            "ship_date",
            "expected_delivery",
            "tracking_numbers",
            "freight_cost",
            "document_milestones",
            "notes",
            "products",
        ]

    def create(self, validated_data):
        """Create fulfillment with nested products."""
        products_data = validated_data.pop("products", [])

        # Set tenant from inquiry and created_by from context
        request = self.context.get("request")
        inquiry = validated_data.get("inquiry")

        # Default cascades from inquiry if not provided explicitly.
        if inquiry and not validated_data.get("customer") and getattr(inquiry, "customer_id", None):
            validated_data["customer_id"] = inquiry.customer_id
        if inquiry and not validated_data.get("shipping_type") and getattr(inquiry, "shipping_type", None):
            validated_data["shipping_type"] = inquiry.shipping_type

        validated_data["tenant"] = inquiry.tenant
        if request:
            validated_data["created_by"] = request.user

        fulfillment = Fulfillment.objects.create(**validated_data)

        # Create nested products
        for product_data in products_data:
            FulfillmentProduct.objects.create(fulfillment=fulfillment, **product_data)

        return fulfillment


class ShipFulfillmentSerializer(serializers.Serializer):
    """Serializer for marking fulfillment as shipped."""

    tracking_numbers = serializers.ListField(
        child=serializers.CharField(max_length=100), required=False, help_text="Tracking numbers to add"
    )
    ship_date = serializers.DateField(required=False, help_text="Ship date (defaults to today)")


class DeliverFulfillmentSerializer(serializers.Serializer):
    """Serializer for marking fulfillment as delivered."""

    actual_delivery = serializers.DateField(required=False, help_text="Actual delivery date (defaults to today)")


class PortalFulfillmentTrackingSerializer(TradeTimelineSerializerMixin, serializers.ModelSerializer):
    """Guest-safe fulfillment tracking serializer for signed portal reads."""

    trade_timeline = serializers.SerializerMethodField()
    document_milestones = serializers.SerializerMethodField()
    trade_datetime_fields = ("created_on", "modified_on")
    trade_date_fields = ("ship_date", "expected_delivery", "actual_delivery")
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    carrier_name = serializers.CharField(source="carrier.name", read_only=True)

    class Meta:
        model = Fulfillment
        fields = [
            "fulfillment_number",
            "status",
            "supplier_name",
            "customer_name",
            "carrier_name",
            "shipping_type",
            "ship_date",
            "expected_delivery",
            "actual_delivery",
            "tracking_numbers",
            "document_milestones",
            "trade_timeline",
            "created_on",
        ]
        read_only_fields = fields

    def get_document_milestones(self, obj):
        allowed_keys = {
            "bol_received",
            "bol_requested",
            "coa_received",
            "coa_sent",
            "pod_received",
            "proforma_received",
            "proforma_requested",
        }
        raw_value = obj.document_milestones if isinstance(obj.document_milestones, dict) else {}
        sanitized = {}
        for key, value in raw_value.items():
            if key not in allowed_keys or isinstance(value, (dict, list)):
                continue
            sanitized[key] = value
        return sanitized
