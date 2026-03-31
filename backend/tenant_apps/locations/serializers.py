"""
Serializers for Locations app.
"""
from rest_framework import serializers

from apps.core.models import PhoneTypeChoices
from apps.system.models import Product as SystemProduct

from tenant_apps.contacts.models import Contact

from .models import Location


class DepartmentContactInputSerializer(serializers.Serializer):
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    mobile_phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    office_phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    office_phone_ext = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    protein_types_responsible = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        allow_empty=True,
    )
    items_responsible = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        allow_empty=True,
    )


class SystemProductMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemProduct
        fields = ['id', 'product_code', 'name', 'description', 'protein_type']


class LocationSerializer(serializers.ModelSerializer):
    """Serializer for Location model."""

    sales_contacts = DepartmentContactInputSerializer(many=True, required=False, write_only=True)
    qa_contacts = DepartmentContactInputSerializer(many=True, required=False, write_only=True)
    booking_contacts = DepartmentContactInputSerializer(many=True, required=False, write_only=True)
    accounting_contacts = DepartmentContactInputSerializer(many=True, required=False, write_only=True)

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
            'plant_est_num',
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

            # Nested contacts (write-only)
            'sales_contacts',
            'qa_contacts',
            'booking_contacts',
            'accounting_contacts',

            'created_on',
            'modified_on',
        ]
        read_only_fields = ['id', 'supplier_name', 'customer_name', 'created_on', 'modified_on']

    def create(self, validated_data):
        sales_contacts = validated_data.pop('sales_contacts', [])
        qa_contacts = validated_data.pop('qa_contacts', [])
        booking_contacts = validated_data.pop('booking_contacts', [])
        accounting_contacts = validated_data.pop('accounting_contacts', [])

        location = super().create(validated_data)

        request = self.context.get('request')
        tenant = validated_data.get('tenant') or getattr(request, 'tenant', None) or getattr(location, 'tenant', None)
        supplier = getattr(location, 'supplier', None)
        customer = getattr(location, 'customer', None)

        def _sync_legacy_phone(payload: dict) -> dict:
            office = (payload.get('office_phone') or '').strip() if isinstance(payload.get('office_phone'), str) else ''
            mobile = (payload.get('mobile_phone') or '').strip() if isinstance(payload.get('mobile_phone'), str) else ''
            if office:
                return {'phone': office, 'phone_type': PhoneTypeChoices.OFFICE}
            if mobile:
                return {'phone': mobile, 'phone_type': PhoneTypeChoices.MOBILE}
            return {}

        def _create_contacts(items: list[dict], department: str):
            for item in items or []:
                Contact.objects.create(
                    tenant=tenant,
                    supplier=supplier,
                    customer=customer,
                    location=location,
                    department=department,
                    first_name=item.get('first_name', ''),
                    last_name=item.get('last_name', ''),
                    email=item.get('email') or None,
                    mobile_phone=item.get('mobile_phone') or '',
                    office_phone=item.get('office_phone') or '',
                    office_phone_ext=item.get('office_phone_ext') or '',
                    protein_types_responsible=item.get('protein_types_responsible') or [],
                    items_responsible=item.get('items_responsible') or [],
                    **_sync_legacy_phone(item),
                )

        if tenant:
            _create_contacts(sales_contacts, 'sales')
            _create_contacts(qa_contacts, 'qa')
            _create_contacts(booking_contacts, 'booking')
            _create_contacts(accounting_contacts, 'accounting')

        return location


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
