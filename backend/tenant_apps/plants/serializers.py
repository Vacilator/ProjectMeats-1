from rest_framework import serializers

from apps.core.models import PhoneTypeChoices
from apps.system.models import Product as SystemProduct

from tenant_apps.contacts.models import Contact
from tenant_apps.plants.models import Plant
from tenant_apps.products.models import MasterProduct


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


class MasterProductMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = MasterProduct
        fields = ['id', 'display_name', 'protein', 'item_name', 'type', 'trim']


class PlantSerializer(serializers.ModelSerializer):
    sales_contacts = DepartmentContactInputSerializer(many=True, required=False, write_only=True)
    qa_contacts = DepartmentContactInputSerializer(many=True, required=False, write_only=True)
    booking_contacts = DepartmentContactInputSerializer(many=True, required=False, write_only=True)
    accounting_contacts = DepartmentContactInputSerializer(many=True, required=False, write_only=True)

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
            "plant_est_num",
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
            "booking_contact_email",
            "booking_contact_phone",
            "booking_contact_phone_type",
            "capacity",
            "is_active",
            "fcfs",

            # Nested contacts (write-only)
            "sales_contacts",
            "qa_contacts",
            "booking_contacts",
            "accounting_contacts",

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
        sales_contacts = validated_data.pop('sales_contacts', [])
        qa_contacts = validated_data.pop('qa_contacts', [])
        booking_contacts = validated_data.pop('booking_contacts', [])
        accounting_contacts = validated_data.pop('accounting_contacts', [])

        request = self.context.get('request')
        validated_data["created_by"] = request.user if request else None

        plant = super().create(validated_data)

        tenant = validated_data.get('tenant') or getattr(request, 'tenant', None) or getattr(plant, 'tenant', None)
        supplier = getattr(plant, 'supplier', None)

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
                    plant=plant,
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

        return plant

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)
