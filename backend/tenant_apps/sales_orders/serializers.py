"""
Serializers for Sales Orders app.
"""
from rest_framework import serializers
from .models import SalesOrder, SalesOrderItem
from tenant_apps.locations.serializers import LocationListSerializer


class SalesOrderItemSerializer(serializers.ModelSerializer):
    """Serializer for sales order line items."""

    class Meta:
        model = SalesOrderItem
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
            "notes",
        ]
        read_only_fields = ["id"]


class SalesOrderSerializer(serializers.ModelSerializer):
    """Serializer for SalesOrder model."""
    
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    carrier_name = serializers.CharField(source="carrier.name", read_only=True, allow_null=True)
    product_code = serializers.CharField(source="product.product_code", read_only=True, allow_null=True)
    
    # Nested location serializers (read-only)
    pick_up_location_details = LocationListSerializer(source='pick_up_location', read_only=True)
    delivery_location_details = LocationListSerializer(source='delivery_location', read_only=True)
    items = SalesOrderItemSerializer(many=True, required=False)
    our_sales_order_num = serializers.CharField(required=False, allow_blank=True, max_length=100)

    class Meta:
        model = SalesOrder
        fields = [
            "id",
            "tenant",
            "our_sales_order_num",
            "our_sales_order_number_for_customer",
            "date_time_stamp",
            "supplier",
            "supplier_name",
            "customer",
            "customer_name",
            "carrier",
            "carrier_name",
            "product",
            "product_code",
            "plant",
            "pick_up_location",
            "pick_up_location_details",
            "delivery_location",
            "delivery_location_details",
            "contact",
            "pick_up_date",
            "delivery_date",
            "delivery_po_num",
            "delivery_po_number",
            "carrier_release_number",
            "carrier_release_num",
            "carrier_release_format",
            "how_to_make_appointment",
            "plant_est_number",
            "quantity",
            "total_weight",
            "weight_unit",
            "status",
            "payment_status",
            "outstanding_amount",
            "total_amount",
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
            "notes",
            "items",
            "created_on",
            "modified_on",
        ]
        read_only_fields = [
            "id",
            "date_time_stamp",
            "created_on",
            "modified_on",
            "pick_up_location_details",
            "delivery_location_details",
        ]

    def _replace_items(self, instance: SalesOrder, items_data: list[dict]) -> None:
        instance.items.all().delete()
        for index, item_data in enumerate(items_data, start=1):
            payload = dict(item_data)
            SalesOrderItem.objects.create(
                sales_order=instance,
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
