import uuid

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
    code = serializers.CharField(required=False, allow_blank=True)

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
            "phone_type",
            "email",
            "booking_contact_email",
            "booking_contact_phone",
            "booking_contact_phone_type",
            "manager",
            "capacity",
            "is_active",
            "fcfs",
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

    def _generate_code(self, name: str | None) -> str:
        base = (name or 'Plant').strip().upper()
        base = ''.join(ch for ch in base if ch.isalnum())
        prefix = (base[:3] or 'PLT').ljust(3, 'T')

        for _ in range(20):
            candidate = f"{prefix}-{uuid.uuid4().hex[:8].upper()}"
            if not Plant.objects.filter(code=candidate).exists():
                return candidate

        return f"PLT-{uuid.uuid4().hex[:12].upper()}"

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user

        code = validated_data.get('code')
        if not code or not str(code).strip():
            validated_data['code'] = self._generate_code(validated_data.get('name'))

        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'code' in validated_data:
            code = validated_data.get('code')
            if not code or not str(code).strip():
                validated_data['code'] = self._generate_code(validated_data.get('name') or instance.name)

        return super().update(instance, validated_data)
