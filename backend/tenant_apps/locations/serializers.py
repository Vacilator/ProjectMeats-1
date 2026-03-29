"""
Serializers for Locations app.
"""
from rest_framework import serializers

from apps.system.models import Product as SystemProduct

from .models import Location


class SystemProductMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemProduct
        fields = ['id', 'product_code', 'name', 'description', 'protein_type']


class LocationSerializer(serializers.ModelSerializer):
    """Serializer for Location model."""

    # Read-only fields for related entity names
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)

    associated_products = serializers.SerializerMethodField()

    def get_associated_products(self, obj):
        request = self.context.get('request')
        tenant = getattr(request, 'tenant', None) if request else None
        if not tenant:
            return []

        links = obj.associated_product_links.filter(tenant=tenant).select_related('product')
        products = [link.product for link in links]
        return SystemProductMinimalSerializer(products, many=True).data

    class Meta:
        model = Location
        fields = [
            'id',
            'name',
            'code',
            'location_type',
            'address',
            'city',
            'state',
            'zip_code',
            'country',
            'phone',
            'phone_type',
            'email',
            'contact_name',
            'is_active',
            'supplier',
            'supplier_name',
            'customer',
            'customer_name',
            'associated_products',
            'created_on',
            'modified_on',
        ]
        read_only_fields = ['id', 'supplier_name', 'customer_name', 'created_on', 'modified_on']


class LocationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for location lists."""

    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)

    associated_products_count = serializers.SerializerMethodField()

    def get_associated_products_count(self, obj):
        request = self.context.get('request')
        tenant = getattr(request, 'tenant', None) if request else None
        if not tenant:
            return 0
        return obj.associated_product_links.filter(tenant=tenant).count()

    class Meta:
        model = Location
        fields = [
            'id',
            'name',
            'code',
            'location_type',
            'city',
            'state',
            'supplier',
            'supplier_name',
            'customer',
            'customer_name',
            'associated_products_count',
        ]
        read_only_fields = ['id', 'supplier_name', 'customer_name']
