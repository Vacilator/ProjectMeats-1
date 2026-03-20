from rest_framework import serializers

from apps.system.models import Product as SystemProduct

from tenant_apps.plants.models import Plant
from tenant_apps.products.models import MasterProduct


class SystemProductMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemProduct
        fields = ['id', 'product_code', 'name', 'description', 'protein_type']


class MasterProductMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = MasterProduct
        fields = ['id', 'display_name', 'protein', 'item_name', 'type', 'trim']


class PlantSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )
    supplier_name = serializers.CharField(
        source="supplier.name", read_only=True
    )

    associated_products = serializers.SerializerMethodField()
    associated_master_products = serializers.SerializerMethodField()

    def get_associated_products(self, obj):
        request = self.context.get('request')
        tenant = getattr(request, 'tenant', None) if request else None
        if not tenant:
            return []

        links = obj.associated_product_links.filter(tenant=tenant).select_related('product')
        products = [link.product for link in links]
        return SystemProductMinimalSerializer(products, many=True).data

    def get_associated_master_products(self, obj):
        request = self.context.get('request')
        tenant = getattr(request, 'tenant', None) if request else None
        if not tenant:
            return []

        links = obj.associated_master_product_links.filter(tenant=tenant).select_related('master_product')
        products = [link.master_product for link in links]
        return MasterProductMinimalSerializer(products, many=True).data

    class Meta:
        model = Plant
        fields = [
            "id",
            "name",
            "code",
            "plant_type",
            "supplier",
            "supplier_name",
            "associated_products",
            "associated_master_products",
            "address",
            "city",
            "state",
            "zip_code",
            "country",
            "phone",
            "email",
            "manager",
            "capacity",
            "is_active",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
        ]

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)
