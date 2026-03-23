"""
Suppliers serializers for ProjectMeats.

Provides serialization for supplier API endpoints.
"""
from rest_framework import serializers
from tenant_apps.suppliers.models import Supplier, SupplierAvailableItem
from tenant_apps.locations.serializers import LocationListSerializer


class SupplierSerializer(serializers.ModelSerializer):
    """Serializer for Supplier model."""
    
    # ArrayField serialization
    departments_array = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        allow_empty=True,
    )
    
    # Nested locations (via reverse FK)
    locations = LocationListSerializer(many=True, read_only=True)

    class Meta:
        model = Supplier
        fields = [
            "id",
            "name",
            "contact_person",
            "email",
            "phone",
            "address",
            "street_address",
            "city",
            "state",
            "zip_code",
            "country",
            "plant",
            "proteins",
            "edible_inedible",
            "type_of_plant",
            "type_of_certificate",
            "tested_product",
            "origin",
            "country_origin",
            "contacts",
            "plants",
            "shipping_offered",
            "how_to_book_pickup",
            "offer_contracts",
            "offers_export_documents",
            "accounting_payment_terms",
            "credit_limits",
            "account_line_of_credit",
            "fresh_or_frozen",
            "package_type",
            "net_or_catch",
            "departments",
            "departments_array",
            "locations",
            "accounting_terms",
            "accounting_line_of_credit",
            "credit_app_sent",
            "credit_app_set_up",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "created_on", "modified_on", "locations"]


class SupplierAvailableItemSerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(source='product.product_code', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    protein_type = serializers.CharField(source='product.protein_type', read_only=True)

    class Meta:
        model = SupplierAvailableItem
        fields = [
            'id',
            'supplier',
            'product',
            'product_code',
            'product_name',
            'protein_type',
            'is_active',
            'created_on',
            'modified_on',
        ]
        read_only_fields = ['id', 'created_on', 'modified_on', 'product_code', 'product_name', 'protein_type']
