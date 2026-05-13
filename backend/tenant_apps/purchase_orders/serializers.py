"""
Purchase Orders serializers for ProjectMeats.

Provides serialization for purchase order API endpoints.
"""
from rest_framework import serializers
from apps.core.services.document_workflows import get_status_workflow_payload
from apps.core.serializers_trade import TradeTimelineSerializerMixin, TradeWeightSerializerMixin
from apps.core.serializers_documents import DocumentStatusValidationMixin
from tenant_apps.purchase_orders.models import (
    CarrierPOItem,
    CarrierPurchaseOrder,
    ColdStorageEntry,
    PurchaseOrder,
    PurchaseOrderHistory,
    PurchaseOrderItem,
)
from tenant_apps.inquiries.models import Inquiry, InquirySupplierRFQ
from tenant_apps.locations.serializers import LocationListSerializer


class PurchaseOrderItemSerializer(TradeWeightSerializerMixin, serializers.ModelSerializer):
    """Serializer for purchase order line items."""

    trade_weight = serializers.SerializerMethodField()
    trade_weight_value_field = "total_net_weight"
    trade_weight_unit_field = "uom"

    class Meta:
        model = PurchaseOrderItem
        fields = [
            "id",
            "line_number",
            "protein_type",
            "product_description",
            "fresh_or_frozen",
            "package_type",
            "quantity",
            "uom",
            "net_or_catch",
            "edible_or_inedible",
            "tested_product",
            "total_net_weight",
            "trade_weight",
            "notes",
        ]
        read_only_fields = ["id"]


class PurchaseOrderSerializer(
    TradeWeightSerializerMixin,
    TradeTimelineSerializerMixin,
    DocumentStatusValidationMixin,
    serializers.ModelSerializer,
):
    """Serializer for PurchaseOrder model."""

    trade_weight = serializers.SerializerMethodField()
    trade_timeline = serializers.SerializerMethodField()
    trade_weight_value_field = "total_weight"
    trade_weight_unit_field = "weight_unit"
    trade_datetime_fields = ("created_on", "modified_on")
    trade_date_fields = ("order_date", "delivery_date", "pick_up_date")
    
    # Nested location serializers (read-only)
    pick_up_location_details = LocationListSerializer(source='pick_up_location', read_only=True)
    delivery_location_details = LocationListSerializer(source='delivery_location', read_only=True)
    items = PurchaseOrderItemSerializer(many=True, required=False)
    contact_routing_details = serializers.SerializerMethodField()
    
    # Allow order_number to be optional (auto-generated if not provided)
    order_number = serializers.CharField(required=False, allow_blank=True, max_length=50)

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "order_number",
            "supplier",
            "product",
            "item_description",
            "fresh_or_frozen",
            "package_type",
            "quantity",
            "total_weight",
            "weight_unit",
            "trade_weight",
            "price_per_unit",
            "total_amount",
            "status",
            "payment_status",
            "outstanding_amount",
            "order_date",
            "delivery_date",
            "pick_up_date",
            "logistics_scenario",
            "pick_up_location",
            "pick_up_location_details",
            "delivery_location",
            "delivery_location_details",
            "plant",
            "contact",
            "carrier",
            "carrier_release_format",
            "carrier_release_number",
            "carrier_release_num",
            "how_to_make_appointment",
            "how_carrier_make_appointment",
            "our_purchase_order_num",
            "our_purchase_order_number_to_supplier",
            "my_customer_number_from_supplier",
            "supplier_confirmation_order_num",
            "supplier_confirmation_order_number",
            "delivery_po_number",
            "supplier_corporate_address",
            "supplier_contact_name",
            "supplier_contact_phone",
            "supplier_contact_email",
            "contact_routing_details",
            "billing_contact_name",
            "billing_contact_phone",
            "billing_contact_email",
            "billing_contact_title",
            "billing_address_street",
            "billing_address_city",
            "billing_address_state_zip",
            "billing_building_name",
            "shipping_contact_name",
            "shipping_contact_phone",
            "shipping_contact_email",
            "shipping_contact_title",
            "shipping_address_street",
            "shipping_address_city",
            "shipping_address_state_zip",
            "shipping_building_name",
            "receiving_contact_name",
            "receiving_contact_phone",
            "receiving_contact_email",
            "receiving_contact_title",
            "total_net_weight",
            "tested_product",
            "bill_of_lading_comments",
            "invoicing_comments",
            "item_production_date",
            "payment_terms",
            "credit_limit",
            "notes",
            "items",
            "trade_timeline",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "created_on", "modified_on", "pick_up_location_details", "delivery_location_details"]

    def get_contact_routing_details(self, obj: PurchaseOrder) -> dict:
        custom_data = obj.custom_data if isinstance(obj.custom_data, dict) else {}
        contact_routing = custom_data.get("contact_routing")
        return contact_routing if isinstance(contact_routing, dict) else {}

    def _replace_items(self, instance: PurchaseOrder, items_data: list[dict]) -> None:
        instance.items.all().delete()
        for index, item_data in enumerate(items_data, start=1):
            payload = dict(item_data)
            PurchaseOrderItem.objects.create(
                purchase_order=instance,
                tenant=instance.tenant,
                line_number=payload.pop("line_number", None) or index,
                **payload,
            )

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        instance = super().create(validated_data)
        self._replace_items(instance, items_data)
        return instance

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        next_status = validated_data.get("status")
        if next_status is not None and str(next_status) != str(instance.status):
            raise serializers.ValidationError(
                {"status": "Use the explicit transition-status action for purchase order status changes."}
            )
        instance = super().update(instance, validated_data)
        if items_data is not None:
            self._replace_items(instance, items_data)
        return instance


class PurchaseOrderReviewSourceLineageSerializer(serializers.Serializer):
    inquiry_id = serializers.IntegerField(required=False, allow_null=True)
    inquiry_number = serializers.CharField(required=False, allow_blank=True)
    rfq_id = serializers.IntegerField(required=False, allow_null=True)
    supplier_id = serializers.IntegerField(required=False, allow_null=True)
    correlation_key = serializers.CharField(required=False, allow_blank=True)
    email_log_id = serializers.IntegerField(required=False, allow_null=True)
    email_message_id = serializers.CharField(required=False, allow_blank=True)
    email_thread_id = serializers.CharField(required=False, allow_blank=True)


class PurchaseOrderReviewInquirySerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True, default="")
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default="")
    requested_master_product_name = serializers.CharField(
        source="requested_master_product.item_name",
        read_only=True,
        default="",
    )

    class Meta:
        model = Inquiry
        fields = [
            "id",
            "inquiry_number",
            "entity_type",
            "route_decision",
            "requested_protein",
            "requested_master_product_name",
            "customer_name",
            "supplier_name",
            "contact_name",
            "contact_email",
            "source_email_message_id",
            "source_email_thread_id",
        ]


class PurchaseOrderReviewRFQSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default="")

    class Meta:
        model = InquirySupplierRFQ
        fields = [
            "id",
            "correlation_key",
            "status",
            "supplier_name",
            "recipient_email",
            "recipient_name",
            "subject",
            "sent_at",
            "provider_message_id",
            "provider_thread_id",
        ]


class PurchaseOrderReviewNormalizedQuoteSerializer(serializers.Serializer):
    availability_status = serializers.CharField(required=False, allow_blank=True)
    offered_product_name = serializers.CharField(required=False, allow_blank=True)
    quantity = serializers.JSONField(required=False)
    uom = serializers.CharField(required=False, allow_blank=True)
    price_per_unit = serializers.JSONField(required=False)
    lead_time_text = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class PurchaseOrderReviewParseSerializer(serializers.Serializer):
    parse_status = serializers.CharField(required=False, allow_blank=True)
    correlation_status = serializers.CharField(required=False, allow_blank=True)
    correlation_method = serializers.CharField(required=False, allow_blank=True)
    confidence = serializers.FloatField(required=False)
    summary = serializers.CharField(required=False, allow_blank=True)


class PurchaseOrderReviewContextSerializer(serializers.Serializer):
    purchase_order = PurchaseOrderSerializer(read_only=True)
    review_state = serializers.CharField(required=False, allow_blank=True)
    review_context_complete = serializers.BooleanField()
    workflow = serializers.SerializerMethodField()
    source_lineage = PurchaseOrderReviewSourceLineageSerializer(required=False, allow_null=True)
    inquiry = PurchaseOrderReviewInquirySerializer(required=False, allow_null=True)
    rfq = PurchaseOrderReviewRFQSerializer(required=False, allow_null=True)
    normalized_quote = PurchaseOrderReviewNormalizedQuoteSerializer(required=False, allow_null=True)
    supplier_reply_parse = PurchaseOrderReviewParseSerializer(required=False, allow_null=True)

    def get_workflow(self, obj: dict[str, object]) -> dict[str, object]:
        purchase_order = obj.get("purchase_order")
        return get_status_workflow_payload(purchase_order) if isinstance(purchase_order, PurchaseOrder) else {}


class CarrierPOItemSerializer(TradeWeightSerializerMixin, serializers.ModelSerializer):
    """Serializer for carrier PO line items."""

    trade_weight = serializers.SerializerMethodField()
    trade_weight_value_field = "total_net_weight"
    trade_weight_unit_field = "uom"

    class Meta:
        model = CarrierPOItem
        fields = [
            "id",
            "line_number",
            "protein_type",
            "product_description",
            "fresh_or_frozen",
            "package_type",
            "quantity",
            "uom",
            "net_or_catch",
            "edible_or_inedible",
            "tested_product",
            "total_net_weight",
            "trade_weight",
            "notes",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        instance = super().create(validated_data)
        self._replace_items(instance, items_data)
        return instance

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        instance = super().update(instance, validated_data)
        if items_data is not None:
            self._replace_items(instance, items_data)
        return instance


class CarrierPurchaseOrderSerializer(
    TradeWeightSerializerMixin,
    TradeTimelineSerializerMixin,
    DocumentStatusValidationMixin,
    serializers.ModelSerializer,
):
    """Serializer for CarrierPurchaseOrder model."""

    trade_weight = serializers.SerializerMethodField()
    trade_timeline = serializers.SerializerMethodField()
    trade_weight_value_field = "total_weight"
    trade_weight_unit_field = "weight_unit"
    trade_datetime_fields = ("date_time_stamp_created", "created_on", "modified_on")
    trade_date_fields = ("pick_up_date", "delivery_date")
    
    # Nested location serializers (read-only)
    pick_up_location_details = LocationListSerializer(source='pick_up_location', read_only=True)
    delivery_location_details = LocationListSerializer(source='delivery_location', read_only=True)
    purchase_order = serializers.PrimaryKeyRelatedField(
        source="linked_order",
        queryset=PurchaseOrder.objects.all(),
        required=False,
        allow_null=True,
    )
    items = CarrierPOItemSerializer(many=True, required=False)

    class Meta:
        model = CarrierPurchaseOrder
        fields = [
            "id",
            "date_time_stamp_created",
            "status",
            "carrier",
            "supplier",
            "plant",
            "purchase_order",
            "pick_up_location",
            "pick_up_location_details",
            "delivery_location",
            "delivery_location_details",
            "product",
            "sales_order",
            "pick_up_date",
            "delivery_date",
            "our_carrier_po_num",
            "carrier_name",
            "carrier_release_format",
            "carrier_release_number",
            "payment_terms",
            "credit_limits",
            "type_of_protein",
            "fresh_or_frozen",
            "package_type",
            "net_or_catch",
            "edible_or_inedible",
            "total_weight",
            "weight_unit",
            "trade_weight",
            "quantity",
            "description_of_product_item",
            "tested_product",
            "total_net_weight",
            "how_to_make_appointment",
            "how_carrier_make_appointment",
            "departments_of_carrier",
            "our_purchase_order_number_to_supplier",
            "supplier_confirmation_order_number",
            "delivery_po_number",
            "billing_contact_name",
            "billing_contact_phone",
            "billing_contact_email",
            "billing_contact_title",
            "billing_address_street",
            "billing_address_city",
            "billing_address_state_zip",
            "billing_building_name",
            "shipping_contact_name",
            "shipping_contact_phone",
            "shipping_contact_email",
            "shipping_contact_title",
            "shipping_address_street",
            "shipping_address_city",
            "shipping_address_state_zip",
            "shipping_building_name",
            "receiving_contact_name",
            "receiving_contact_phone",
            "receiving_contact_email",
            "receiving_contact_title",
            "items",
            "trade_timeline",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "date_time_stamp_created", "created_on", "modified_on", "pick_up_location_details", "delivery_location_details"]

    def _replace_items(self, instance: CarrierPurchaseOrder, items_data: list[dict]) -> None:
        instance.items.all().delete()
        for index, item_data in enumerate(items_data, start=1):
            payload = dict(item_data)
            CarrierPOItem.objects.create(
                carrier_purchase_order=instance,
                tenant=instance.tenant,
                line_number=payload.pop("line_number", None) or index,
                **payload,
            )

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        instance = super().create(validated_data)
        self._replace_items(instance, items_data)
        return instance

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        instance = super().update(instance, validated_data)
        if items_data is not None:
            self._replace_items(instance, items_data)
        return instance


class ColdStorageEntrySerializer(serializers.ModelSerializer):
    """Serializer for ColdStorageEntry model."""

    class Meta:
        model = ColdStorageEntry
        fields = [
            "id",
            "tenant",
            "date_time_stamp_created",
            "supplier_po",
            "customer_sales_order",
            "product",
            "status_of_load",
            "item_production_date",
            "item_description",
            "finished_weight",
            "shrink",
            "boxing_cost",
            "cold_storage_cost",
            "total_cost",
            "notes",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "date_time_stamp_created", "created_on", "modified_on"]

class PurchaseOrderHistorySerializer(serializers.ModelSerializer):
    """Serializer for PurchaseOrderHistory model."""

    changed_by_username = serializers.CharField(
        source="changed_by.username", read_only=True, allow_null=True
    )
    purchase_order_number = serializers.CharField(
        source="purchase_order.order_number", read_only=True
    )

    class Meta:
        model = PurchaseOrderHistory
        fields = [
            "id",
            "purchase_order",
            "purchase_order_number",
            "changed_data",
            "changed_by",
            "changed_by_username",
            "change_type",
            "created_on",
            "modified_on",
        ]
        read_only_fields = [
            "id",
            "purchase_order",
            "changed_data",
            "changed_by",
            "change_type",
            "created_on",
            "modified_on",
        ]
