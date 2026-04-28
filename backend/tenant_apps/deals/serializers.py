"""Serializers for the deals app."""
from __future__ import annotations

from rest_framework import serializers

from apps.tenants.models import TenantUser

from .models import Deal, DealActionItem


class DealActionItemSerializer(serializers.ModelSerializer):
    """Serializer for deal reminder records."""

    assigned_user_name = serializers.CharField(source="assigned_user.get_full_name", read_only=True)

    class Meta:
        model = DealActionItem
        fields = [
            "id",
            "title",
            "description",
            "milestone_key",
            "priority",
            "status",
            "due_date",
            "completed_at",
            "assigned_user",
            "assigned_user_name",
            "created_on",
        ]
        read_only_fields = ["id", "completed_at", "created_on"]


class DealListSerializer(serializers.ModelSerializer):
    """Dense list serializer for the Deal Desk."""

    purchase_order_number = serializers.CharField(source="purchase_order.order_number", read_only=True)
    sales_order_number = serializers.CharField(source="sales_order.our_sales_order_num", read_only=True)
    supplier_name = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    carrier_name = serializers.SerializerMethodField()
    gross_revenue = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    cogs = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    freight_cost = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    net_margin = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    next_action = serializers.CharField(read_only=True)
    next_follow_up_date = serializers.DateTimeField(read_only=True, allow_null=True)
    is_past_due = serializers.BooleanField(read_only=True)
    pickup_date = serializers.DateField(read_only=True, allow_null=True)
    delivery_date = serializers.DateField(read_only=True, allow_null=True)

    class Meta:
        model = Deal
        fields = [
            "id",
            "deal_number",
            "status",
            "purchase_order",
            "purchase_order_number",
            "sales_order",
            "sales_order_number",
            "fulfillment",
            "assigned_trader",
            "supplier_name",
            "customer_name",
            "carrier_name",
            "pickup_date",
            "delivery_date",
            "gross_revenue",
            "cogs",
            "freight_cost",
            "net_margin",
            "next_action",
            "next_follow_up_date",
            "is_past_due",
            "created_on",
            "modified_on",
        ]

    def get_supplier_name(self, obj: Deal) -> str:
        supplier = obj.supplier
        return getattr(supplier, "name", "") or ""

    def get_customer_name(self, obj: Deal) -> str:
        customer = obj.customer
        return getattr(customer, "name", "") or ""

    def get_carrier_name(self, obj: Deal) -> str:
        carrier = obj.carrier
        return getattr(carrier, "name", "") or ""


class DealDetailSerializer(DealListSerializer):
    """Detailed deal serializer with reminder records."""

    action_items = DealActionItemSerializer(many=True, read_only=True)

    class Meta(DealListSerializer.Meta):
        fields = DealListSerializer.Meta.fields + [
            "notes",
            "action_items",
        ]


class DealWriteSerializer(serializers.ModelSerializer):
    """Serializer for deal create/update operations."""

    class Meta:
        model = Deal
        fields = [
            "id",
            "status",
            "purchase_order",
            "sales_order",
            "fulfillment",
            "assigned_trader",
            "notes",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        tenant = getattr(self.context.get("request"), "tenant", None)
        if tenant is None:
            raise serializers.ValidationError({"tenant": "Tenant context required."})

        for field in ("purchase_order", "sales_order", "fulfillment"):
            obj = attrs.get(field) or getattr(self.instance, field, None)
            if obj is not None and getattr(obj, "tenant_id", None) != tenant.id:
                raise serializers.ValidationError({field: "Selected record must belong to the active tenant."})

        assigned_trader = attrs.get("assigned_trader") or getattr(self.instance, "assigned_trader", None)
        if assigned_trader is not None:
            if not assigned_trader.is_active:
                raise serializers.ValidationError({"assigned_trader": "Assigned trader must be active."})
            if not TenantUser.objects.filter(tenant=tenant, user=assigned_trader, is_active=True).exists():
                raise serializers.ValidationError({"assigned_trader": "Assigned trader must belong to the active tenant."})

        return attrs
