"""
Purchase Orders serializers for ProjectMeats.

Provides serialization for purchase order API endpoints.
"""
from rest_framework import serializers
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
            "supplier_corporate_address",
            "supplier_contact_name",
            "supplier_contact_phone",
            "supplier_contact_email",
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
            "payment_terms",
            "credit_limit",
            "notes",
            "items",
            "trade_timeline",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "created_on", "modified_on", "pick_up_location_details", "delivery_location_details"]

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
        instance = super().update(instance, validated_data)
        if items_data is not None:
            self._replace_items(instance, items_data)
        return instance


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
            "how_to_make_appointment",
            "how_carrier_make_appointment",
            "departments_of_carrier",
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
