"""Serializers for products.

NOTE: Phase 8.0 Three-Tier Products replaces tenant-level products with system.Product.

This module keeps the legacy ProductSerializer (tenant_apps.products.Product) for any
remaining internal usages, but the /api/v1/products endpoint is now a read-only,
backward-compatible alias to /api/v1/system/products.
"""

from rest_framework import serializers

from apps.system.models import Product as SystemProduct

from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    """Legacy serializer for tenant-level Product model (deprecated)."""

    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "tenant",
            "product_code",
            "description_of_product_item",
            "type_of_protein",
            "fresh_or_frozen",
            "package_type",
            "net_or_catch",
            "edible_or_inedible",
            "tested_product",
            "supplier",
            "supplier_name",
            "supplier_item_number",
            "plants_available",
            "origin",
            "carton_type",
            "pcs_per_carton",
            "uom",
            "namp",
            "usda",
            "ub",
            "unit_weight",
            "is_active",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "tenant", "created_on", "modified_on"]
        extra_kwargs = {
            "product_code": {"required": True},
            "description_of_product_item": {"required": True},
        }


class LegacySystemProductSerializer(serializers.ModelSerializer):
    """Backward-compatible serializer for /api/v1/products alias.

    We expose the historic field names used by older UIs/clients while sourcing
    data from system.Product (three-tier catalog).
    """

    # Legacy field aliases
    description_of_product_item = serializers.CharField(source="description", allow_blank=True, required=False)
    type_of_protein = serializers.CharField(source="protein_type", allow_blank=True, required=False)

    namp = serializers.CharField(source="namp_code", allow_blank=True, required=False)
    usda = serializers.CharField(source="usda_code", allow_blank=True, required=False)
    ub = serializers.CharField(source="ub_code", allow_blank=True, required=False)

    created_on = serializers.DateTimeField(source="created_at", read_only=True)
    modified_on = serializers.DateTimeField(source="updated_at", read_only=True)

    # Tenant-era fields that don't exist on system.Product
    tenant = serializers.SerializerMethodField()
    supplier = serializers.SerializerMethodField()
    supplier_name = serializers.SerializerMethodField()
    supplier_item_number = serializers.SerializerMethodField()
    plants_available = serializers.SerializerMethodField()
    origin = serializers.SerializerMethodField()

    class Meta:
        model = SystemProduct
        fields = [
            "id",
            "tenant",
            "product_code",
            "description_of_product_item",
            "type_of_protein",
            "fresh_or_frozen",
            "package_type",
            "net_or_catch",
            "edible_or_inedible",
            "tested_product",
            "supplier",
            "supplier_name",
            "supplier_item_number",
            "plants_available",
            "origin",
            "carton_type",
            "pcs_per_carton",
            "uom",
            "namp",
            "usda",
            "ub",
            "unit_weight",
            "is_active",
            "created_on",
            "modified_on",
        ]

    def get_tenant(self, _obj):
        return None

    def get_supplier(self, _obj):
        return None

    def get_supplier_name(self, _obj):
        return ""

    def get_supplier_item_number(self, _obj):
        return ""

    def get_plants_available(self, _obj):
        return []

    def get_origin(self, _obj):
        return ""