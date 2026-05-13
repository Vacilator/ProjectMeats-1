from django.db import transaction
from rest_framework import serializers

from apps.core.models import PhoneTypeChoices
from apps.system.models import Product as SystemProduct

from tenant_apps.contacts.models import Contact, ContactDepartmentChoices
from tenant_apps.plants.models import (
    Plant,
    PlantAssociatedMasterProduct,
    PlantProteinOffered,
    PlantProteinTested,
)
from tenant_apps.products.models import MasterProduct
from apps.core.models import Protein


class DepartmentContactInputSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    department = serializers.ChoiceField(
        choices=ContactDepartmentChoices.choices,
        required=False,
        allow_null=True,
    )
    title = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=100)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
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
    documents_responsible_for = serializers.ListField(
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
    contacts = DepartmentContactInputSerializer(many=True, required=False, write_only=True)
    sales_contacts = DepartmentContactInputSerializer(many=True, required=False, write_only=True)
    qa_contacts = DepartmentContactInputSerializer(many=True, required=False, write_only=True)
    booking_contacts = DepartmentContactInputSerializer(many=True, required=False, write_only=True)
    accounting_contacts = DepartmentContactInputSerializer(many=True, required=False, write_only=True)

    # Phase 10: Plant Protein fields
    # Plant.proteins_offered/tested are tenant-aware M2M through tables.
    # We must NOT let DRF call the implicit M2M .set(), because the through rows
    # require tenant_id. The UI uses choice-list values (e.g. "Beef"), so we accept
    # protein *names* and map them to core.Protein rows.
    proteins_offered = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        allow_empty=True,
        write_only=True,
    )
    proteins_tested = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        allow_empty=True,
        write_only=True,
    )
    associated_master_product_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        write_only=True,
        help_text='IDs of MasterProducts to associate with this plant.',
    )

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
            "site_code",
            "plant_type",
            "supplier",
            "supplier_name",
            "associated_products",
            "associated_master_products",
            "associated_master_product_ids",
            "address",
            "city",
            "state",
            "zip_code",
            "country",

            "export_approved",
            "export_documents_handled",
            "proteins_offered",
            "proteins_tested",

            "booking_contact_email",
            "booking_contact_phone",
            "booking_contact_phone_type",
            "capacity",
            "is_active",
            "fcfs",

            "contacts",
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

    def to_representation(self, instance):
        data = super().to_representation(instance)

        request = self.context.get('request')
        tenant = getattr(request, 'tenant', None) if request else getattr(instance, 'tenant', None)

        queryset = instance.contacts.filter(tenant=tenant) if tenant else instance.contacts.none()
        data['contacts'] = DepartmentContactInputSerializer(queryset, many=True).data

        # Tenant-safe representation for tenant-aware M2M through tables.
        # Do NOT rely on the implicit M2M manager (it does not apply tenant filtering).
        if tenant:
            data['proteins_offered'] = [
                link.protein.name
                for link in instance.protein_offered_links.filter(tenant=tenant).select_related('protein').order_by('protein__name')
            ]
            data['proteins_tested'] = [
                link.protein.name
                for link in instance.protein_tested_links.filter(tenant=tenant).select_related('protein').order_by('protein__name')
            ]
        else:
            data['proteins_offered'] = []
            data['proteins_tested'] = []

        return data

    def _extract_nested_contacts(self, validated_data):
        contacts = list(validated_data.pop('contacts', []) or [])
        department_field_map = (
            ('sales_contacts', ContactDepartmentChoices.SALES),
            ('qa_contacts', ContactDepartmentChoices.QA),
            ('booking_contacts', ContactDepartmentChoices.SHIPPING),
            ('accounting_contacts', ContactDepartmentChoices.ACCOUNTING),
        )

        for field_name, department in department_field_map:
            for item in validated_data.pop(field_name, []) or []:
                payload = dict(item)
                payload['department'] = department
                contacts.append(payload)

        return contacts

    def _get_tenant(self, plant: Plant | None = None):
        request = self.context.get('request')
        tenant = getattr(request, 'tenant', None) if request else None
        if not tenant and plant is not None:
            tenant = getattr(plant, 'tenant', None)
        return tenant

    def _sync_master_products(self, plant: Plant, master_product_ids: list[int] | None) -> None:
        if master_product_ids is None:
            return

        tenant = self._get_tenant(plant)
        if not tenant:
            raise serializers.ValidationError({'associated_master_product_ids': ['Tenant context is required.']})

        ids = [int(i) for i in (master_product_ids or []) if i is not None]
        desired = list(MasterProduct.objects.filter(tenant=tenant, id__in=ids)) if ids else []

        desired_ids = {p.id for p in desired}

        # Remove unselected
        PlantAssociatedMasterProduct.objects.filter(tenant=tenant, plant=plant).exclude(
            master_product_id__in=desired_ids
        ).delete()

        # Add missing
        for product in desired:
            PlantAssociatedMasterProduct.objects.get_or_create(
                tenant=tenant,
                plant=plant,
                master_product=product,
            )

    def _sync_proteins(
        self,
        plant: Plant,
        *,
        offered: list[str] | None,
        tested: list[str] | None,
    ) -> None:
        """Replace protein links using tenant-aware through tables.

        Semantics:
        - If offered/tested is None: field not provided -> leave as-is.
        - If offered/tested is []: provided empty -> clear.

        Contract:
        - Accept protein *names* (e.g. "Beef").
        """

        tenant = self._get_tenant(plant)
        if not tenant:
            raise serializers.ValidationError({'proteins_offered': ['Tenant context is required.']})

        def normalize(values: list[str] | None) -> list[str]:
            out: list[str] = []
            seen = set()
            for v in values or []:
                name = str(v).strip()
                if not name:
                    continue
                key = name.lower()
                if key in seen:
                    continue
                seen.add(key)
                out.append(name)
            return out

        def ids_for(names: list[str]) -> list[int]:
            ids: list[int] = []
            for n in names:
                protein, _ = Protein.objects.get_or_create(name=n)
                if protein.id not in ids:
                    ids.append(protein.id)
            return ids

        if offered is not None:
            offered_ids = ids_for(normalize(offered))
            PlantProteinOffered.objects.filter(tenant=tenant, plant=plant).delete()
            if offered_ids:
                PlantProteinOffered.objects.bulk_create(
                    [PlantProteinOffered(tenant=tenant, plant=plant, protein_id=pid) for pid in offered_ids]
                )

        if tested is not None:
            tested_ids = ids_for(normalize(tested))
            PlantProteinTested.objects.filter(tenant=tenant, plant=plant).delete()
            if tested_ids:
                PlantProteinTested.objects.bulk_create(
                    [PlantProteinTested(tenant=tenant, plant=plant, protein_id=pid) for pid in tested_ids]
                )

    def _sync_legacy_phone(self, payload: dict, existing: Contact | None = None) -> dict:
        office = (payload.get('office_phone') or '').strip() if isinstance(payload.get('office_phone'), str) else ''
        mobile = (payload.get('mobile_phone') or '').strip() if isinstance(payload.get('mobile_phone'), str) else ''

        if office:
            return {'phone': office, 'phone_type': PhoneTypeChoices.OFFICE}
        if mobile:
            return {'phone': mobile, 'phone_type': PhoneTypeChoices.MOBILE}
        if 'office_phone' in payload or 'mobile_phone' in payload:
            return {
                'phone': '',
                'phone_type': getattr(existing, 'phone_type', PhoneTypeChoices.OFFICE),
            }
        if existing:
            return {
                'phone': existing.phone,
                'phone_type': existing.phone_type,
            }
        return {}

    def _build_contact_defaults(self, payload: dict, plant: Plant, existing: Contact | None = None) -> dict:
        department = payload.get('department') or getattr(existing, 'department', None)
        if not department:
            raise serializers.ValidationError({'contacts': ['Each contact requires a department.']})

        return {
            'supplier': getattr(plant, 'supplier', None),
            'plant': plant,
            'department': department,
            'first_name': payload.get('first_name', getattr(existing, 'first_name', '')),
            'last_name': payload.get('last_name', getattr(existing, 'last_name', '')),
            'email': payload.get('email', getattr(existing, 'email', None)) or None,
            'title': payload.get('title', getattr(existing, 'title', None)),
            'notes': payload.get('notes', getattr(existing, 'notes', None)),
            'mobile_phone': payload.get('mobile_phone', getattr(existing, 'mobile_phone', '')) or '',
            'office_phone': payload.get('office_phone', getattr(existing, 'office_phone', '')) or '',
            'office_phone_ext': payload.get('office_phone_ext', getattr(existing, 'office_phone_ext', '')) or '',
            'protein_types_responsible': payload.get(
                'protein_types_responsible',
                getattr(existing, 'protein_types_responsible', []),
            ) or [],
            'items_responsible': payload.get(
                'items_responsible',
                getattr(existing, 'items_responsible', []),
            ) or [],
            'documents_responsible_for': payload.get(
                'documents_responsible_for',
                getattr(existing, 'documents_responsible_for', []),
            ) or [],
            **self._sync_legacy_phone(payload, existing),
        }

    def _upsert_contacts(self, plant: Plant, contacts: list[dict]) -> None:
        request = self.context.get('request')
        tenant = getattr(request, 'tenant', None) or getattr(plant, 'tenant', None)
        if not tenant:
            raise serializers.ValidationError({'contacts': ['Tenant context is required for nested contact writes.']})

        for payload in contacts or []:
            contact_id = payload.get('id')
            existing = None
            if contact_id is not None:
                existing = Contact.objects.filter(
                    tenant=tenant,
                    plant=plant,
                    id=contact_id,
                ).first()
                if not existing:
                    raise serializers.ValidationError(
                        {'contacts': [f'Contact {contact_id} was not found for this plant.']}
                    )
                defaults = self._build_contact_defaults(payload, plant, existing=existing)
                Contact.objects.update_or_create(
                    id=contact_id,
                    tenant=tenant,
                    plant=plant,
                    defaults=defaults,
                )
                continue

            Contact.objects.create(
                tenant=tenant,
                **self._build_contact_defaults(payload, plant),
            )

    def to_internal_value(self, data):
        # Back-compat: allow callers to send associated master products under the legacy key.
        # We keep `associated_master_products` as a read-only detail list.
        if isinstance(data, dict):
            if 'associated_master_product_ids' not in data and 'associated_master_products' in data:
                data = dict(data)
                data['associated_master_product_ids'] = data.get('associated_master_products')
        return super().to_internal_value(data)

    def validate(self, attrs):
        export_approved = attrs.get('export_approved')
        if export_approved is False:
            # Keep server state consistent with showWhen UI.
            attrs['export_documents_handled'] = []
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        nested_contacts = self._extract_nested_contacts(validated_data)

        proteins_offered = validated_data.pop('proteins_offered', None)
        proteins_tested = validated_data.pop('proteins_tested', None)
        master_product_ids = validated_data.pop('associated_master_product_ids', None)

        request = self.context.get('request')
        validated_data["created_by"] = request.user if request else None

        plant = super().create(validated_data)

        self._upsert_contacts(plant, nested_contacts)
        self._sync_proteins(plant, offered=proteins_offered, tested=proteins_tested)
        self._sync_master_products(plant, master_product_ids)

        return plant

    @transaction.atomic
    def update(self, instance, validated_data):
        nested_contacts = self._extract_nested_contacts(validated_data)

        proteins_offered = validated_data.pop('proteins_offered', None)
        proteins_tested = validated_data.pop('proteins_tested', None)
        master_product_ids = validated_data.pop('associated_master_product_ids', None)

        plant = super().update(instance, validated_data)

        self._upsert_contacts(plant, nested_contacts)
        self._sync_proteins(plant, offered=proteins_offered, tested=proteins_tested)
        self._sync_master_products(plant, master_product_ids)

        return plant
