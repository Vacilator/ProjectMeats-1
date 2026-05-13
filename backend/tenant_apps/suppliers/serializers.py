"""
Suppliers serializers for ProjectMeats.

Provides serialization for supplier API endpoints.
"""
from rest_framework import serializers

from apps.core.models import PhoneTypeChoices
from tenant_apps.suppliers.models import Supplier, SupplierAvailableItem
from tenant_apps.locations.serializers import LocationListSerializer


class SupplierSerializer(serializers.ModelSerializer):
    """Serializer for Supplier model."""

    products_available = serializers.ListField(
        child=serializers.IntegerField(),
        read_only=True,
        required=False,
        help_text='Distinct master product IDs aggregated from child plants.',
    )

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
            "phone_mobile",
            "phone_office",
            "phone_office_extension",
            "phone",
            "phone_type",
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
            "payment_terms",
            "credit_limits",
            "credit_limit",
            "account_line_of_credit",
            "fresh_or_frozen",
            "package_type",
            "net_or_catch",
            "departments",
            "departments_array",
            "locations",
            "accounting_payable_contact_name",
            "accounting_payable_contact_phone",
            "accounting_payable_contact_email",
            "contact_title",
            "sales_contact_name",
            "sales_contact_main_phone",
            "sales_contact_direct_phone",
            "sales_contact_cell_phone",
            "sales_contact_email",
            "pick_up_date",
            "delivery_date",
            "our_purchase_order_number_to_supplier",
            "my_customer_number_from_supplier",
            "supplier_confirmation_order_number",
            "carrier_release_format",
            "carrier_release_number",
            "how_to_make_appointment",
            "shipping_contact_name",
            "shipping_contact_phone",
            "shipping_contact_email",
            "bill_of_lading_comments",
            "invoicing_comments",
            "total_net_weight",
            "item_production_date",
            "accounting_terms",
            "accounting_line_of_credit",
            "credit_app_sent",
            "credit_app_set_up",
            "products_available",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "created_on", "modified_on", "locations"]

    def _sync_phone_fields(self, attrs: dict) -> dict:
        """Keep legacy (phone/phone_type) and new explicit phone slots in sync.

        Priority for legacy primary phone:
        - office phone if present
        - else mobile phone if present
        """

        def _clean(v: object) -> str:
            return str(v).strip() if isinstance(v, str) else ''

        has_mobile_key = 'phone_mobile' in attrs
        has_office_key = 'phone_office' in attrs
        has_legacy_phone_key = 'phone' in attrs
        has_legacy_type_key = 'phone_type' in attrs

        mobile = _clean(attrs.get('phone_mobile')) if has_mobile_key else ''
        office = _clean(attrs.get('phone_office')) if has_office_key else ''

        # If an older client sends legacy phone only, populate new slots.
        if has_legacy_phone_key and not has_mobile_key and not has_office_key:
            legacy_phone = _clean(attrs.get('phone'))
            legacy_type = _clean(attrs.get('phone_type')) if has_legacy_type_key else ''

            if legacy_phone:
                if legacy_type == PhoneTypeChoices.MOBILE:
                    attrs['phone_mobile'] = legacy_phone
                else:
                    attrs['phone_office'] = legacy_phone

        # If new slots are provided and legacy phone isn't, derive legacy.
        if (mobile or office) and not (has_legacy_phone_key and _clean(attrs.get('phone'))):
            if office:
                attrs['phone'] = office
                attrs['phone_type'] = PhoneTypeChoices.OFFICE
            else:
                attrs['phone'] = mobile
                attrs['phone_type'] = PhoneTypeChoices.MOBILE

        return attrs

    def create(self, validated_data):
        validated_data = self._sync_phone_fields(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._sync_phone_fields(validated_data)
        return super().update(instance, validated_data)


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
