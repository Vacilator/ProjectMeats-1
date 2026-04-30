"""
Serializers for Invoices app.
"""
from rest_framework import serializers
from apps.core.serializers_documents import DocumentStatusValidationMixin
from .models import Claim, Invoice, InvoiceItem, PaymentTransaction


class InvoiceItemSerializer(serializers.ModelSerializer):
    """Serializer for invoice line items."""

    class Meta:
        model = InvoiceItem
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
            "unit_price",
            "line_total",
            "notes",
        ]
        read_only_fields = ["id"]


class InvoiceSerializer(DocumentStatusValidationMixin, serializers.ModelSerializer):
    """Serializer for Invoice model."""
    
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    sales_order_num = serializers.CharField(source="sales_order.our_sales_order_num", read_only=True, allow_null=True)
    product_code = serializers.CharField(source="product.product_code", read_only=True, allow_null=True)
    items = InvoiceItemSerializer(many=True, required=False)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "tenant",
            "invoice_number",
            "is_subscription",
            "date_time_stamp",
            "customer",
            "customer_name",
            "sales_order",
            "sales_order_num",
            "product",
            "product_code",
            "pick_up_date",
            "delivery_date",
            "due_date",
            "our_sales_order_num",
            "our_sales_order_number_for_customer",
            "delivery_po_num",
            "delivery_po_number",
            "payment_terms",
            "carrier_release_format",
            "carrier_release_number",
            "how_to_make_appointment",
            "accounting_payable_contact_name",
            "accounting_payable_contact_phone",
            "accounting_payable_contact_email",
            "accounting_payable_contact_title",
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
            "type_of_protein",
            "description_of_product_item",
            "quantity",
            "total_weight",
            "weight_unit",
            "edible_or_inedible",
            "tested_product",
            "unit_price",
            "total_amount",
            "tax_amount",
            "status",
            "payment_status",
            "outstanding_amount",
            "notes",
            "items",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "date_time_stamp", "created_on", "modified_on"]

    def _replace_items(self, instance: Invoice, items_data: list[dict]) -> None:
        instance.items.all().delete()
        for index, item_data in enumerate(items_data, start=1):
            payload = dict(item_data)
            InvoiceItem.objects.create(
                invoice=instance,
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


class ClaimSerializer(serializers.ModelSerializer):
    """Serializer for Claim model."""
    
    created_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Claim
        fields = [
            "id",
            "claim_number",
            "claim_type",
            "status",
            "supplier",
            "customer",
            "purchase_order",
            "sales_order",
            "invoice",
            "reason",
            "description",
            "claimed_amount",
            "approved_amount",
            "settled_amount",
            "claim_date",
            "resolution_date",
            "resolution_notes",
            "assigned_to",
            "assigned_to_name",
            "created_by",
            "created_by_name",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "created_on", "modified_on", "assigned_to_name", "created_by_name"]
    
    def get_created_by_name(self, obj):
        """Get the name of the user who created this claim."""
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return "System"
    
    def get_assigned_to_name(self, obj):
        """Get the name of the user this claim is assigned to."""
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.username
        return None


class PaymentTransactionSerializer(serializers.ModelSerializer):
    """Serializer for PaymentTransaction model."""
    
    created_by_name = serializers.SerializerMethodField()
    entity_type = serializers.SerializerMethodField()
    entity_reference = serializers.SerializerMethodField()
    
    class Meta:
        model = PaymentTransaction
        fields = [
            'id', 'tenant', 'purchase_order', 'sales_order', 'invoice',
            'amount', 'payment_date', 'payment_method', 'reference_number',
            'notes', 'created_by', 'created_by_name', 'created_on', 'modified_on',
            'entity_type', 'entity_reference'
        ]
        read_only_fields = ['id', 'tenant', 'created_on', 'modified_on', 'created_by_name', 'entity_type', 'entity_reference']
    
    def get_created_by_name(self, obj):
        """Get the name of the user who created the payment."""
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return "System"
    
    def get_entity_type(self, obj):
        """Determine what type of entity this payment is for."""
        if obj.purchase_order:
            return "purchase_order"
        elif obj.sales_order:
            return "sales_order"
        elif obj.invoice:
            return "invoice"
        return None
    
    def get_entity_reference(self, obj):
        """Get a human-readable reference for the related entity."""
        if obj.purchase_order:
            return obj.purchase_order.order_number
        elif obj.sales_order:
            return obj.sales_order.our_sales_order_num
        elif obj.invoice:
            return obj.invoice.invoice_number
        return None
