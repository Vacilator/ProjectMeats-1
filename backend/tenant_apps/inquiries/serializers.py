"""Serializers for Inquiries app."""
from rest_framework import serializers

from apps.core.services.inventory_availability import evaluate_inquiry_route

from .models import (
    Inquiry,
    InquiryProduct,
    InquiryRouteDecisionChoices,
    InquirySourceChoices,
    InquiryTemplate,
    InquiryTemplateProduct,
)


class InquiryContractValidationMixin:
    """Fail closed for tenant-scoped lineage and routing anchors."""

    tenant_scoped_relation_fields = (
        "source_email",
        "requested_master_product",
        "supplier_purchase_order",
        "sales_order",
        "carrier_purchase_order",
    )

    def _get_request_tenant(self):
        request = self.context.get("request")
        return getattr(request, "tenant", None)

    def _get_existing_value(self, field_name):
        if self.instance is None:
            return None
        return getattr(self.instance, field_name, None)

    def _get_active_tenant(self):
        request_tenant = self._get_request_tenant()
        return request_tenant or getattr(self.instance, "tenant", None)

    def _validate_tenant_scoped_relation(self, field_name, relation):
        tenant = self._get_active_tenant()
        if relation is None or tenant is None:
            return relation

        relation_tenant = getattr(relation, "tenant", None)
        if relation_tenant is not None and getattr(relation_tenant, "id", None) != getattr(tenant, "id", None):
            raise serializers.ValidationError("Selected record must belong to the active tenant.")
        return relation

    def validate_source_email(self, value):
        return self._validate_tenant_scoped_relation("source_email", value)

    def validate_requested_master_product(self, value):
        return self._validate_tenant_scoped_relation("requested_master_product", value)

    def validate_supplier_purchase_order(self, value):
        return self._validate_tenant_scoped_relation("supplier_purchase_order", value)

    def validate_sales_order(self, value):
        return self._validate_tenant_scoped_relation("sales_order", value)

    def validate_carrier_purchase_order(self, value):
        return self._validate_tenant_scoped_relation("carrier_purchase_order", value)

    def _apply_contract_defaults(self, data):
        source_email = data.get("source_email", self._get_existing_value("source_email"))
        if source_email:
            if not data.get("source_email_message_id"):
                data["source_email_message_id"] = source_email.message_id or ""
            if not data.get("source_email_thread_id"):
                data["source_email_thread_id"] = source_email.thread_id or ""

        requested_master_product = data.get(
            "requested_master_product",
            self._get_existing_value("requested_master_product"),
        )
        requested_protein = data.get(
            "requested_protein",
            self._get_existing_value("requested_protein"),
        )
        if requested_master_product:
            if requested_protein and requested_protein != requested_master_product.protein:
                raise serializers.ValidationError(
                    {
                        "requested_protein": ("Requested protein must match the selected requested master product."),
                    }
                )
            data["requested_protein"] = requested_master_product.protein

        tenant = self._get_active_tenant()
        if tenant is not None:
            route_evaluation = evaluate_inquiry_route(
                tenant=tenant,
                requested_master_product=requested_master_product,
                requested_protein=data.get(
                    "requested_protein",
                    self._get_existing_value("requested_protein"),
                )
                or "",
            )
            data["route_decision"] = route_evaluation.route_decision

        return data

    def validate(self, data):
        data = super().validate(data)

        source_email = data.get("source_email", self._get_existing_value("source_email"))
        source_type = data.get("source_type", self._get_existing_value("source_type"))
        if source_email and source_type != InquirySourceChoices.EMAIL:
            raise serializers.ValidationError(
                {
                    "source_email": "Source email may only be set when source_type is email.",
                }
            )

        return self._apply_contract_defaults(data)

    def create(self, validated_data):
        return super().create(self._apply_contract_defaults(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._apply_contract_defaults(validated_data))


class InquiryProductSerializer(serializers.ModelSerializer):
    """Serializer for InquiryProduct model."""

    product_code = serializers.CharField(source="product.product_code", read_only=True)
    product_description = serializers.CharField(source="product.description", read_only=True)
    margin = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    margin_percent = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)

    class Meta:
        model = InquiryProduct
        fields = [
            "id",
            "product",
            "product_code",
            "product_description",
            "quantity",
            "supplier",
            "plant",
            # Desired fields
            "desired_total",
            "desired_price_per_unit",
            "desired_uom",
            "desired_uom_value",
            "desired_processed_date",
            "desired_expiration_date",
            "desired_available_date",
            "desired_shipping_date",
            "desired_delivery_date",
            # Actual fields
            "actual_total",
            "actual_price_per_unit",
            "actual_uom",
            "actual_uom_value",
            "actual_processed_date",
            "actual_expiration_date",
            "actual_available_date",
            "actual_shipping_date",
            "actual_delivery_date",
            # Calculated
            "margin",
            "margin_percent",
            # Meta
            "notes",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "created_on", "modified_on"]


class CreateSupplierPurchaseOrderDraftSerializer(serializers.Serializer):
    """Request serializer for drafting a supplier PO from a normalized quote reply."""

    rfq_id = serializers.IntegerField(min_value=1)


class InquiryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for inquiry list views.

    NOTE: The frontend expects a few convenience aliases (customer_name, supplier_name, source, created_on).
    We expose those additively without removing the canonical model fields.
    """

    entity_name = serializers.SerializerMethodField()
    customer = serializers.IntegerField(source="customer_id", read_only=True, allow_null=True, required=False)
    supplier = serializers.IntegerField(source="supplier_id", read_only=True, allow_null=True, required=False)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    source = serializers.CharField(source="source_type", read_only=True)
    route_decision = serializers.ChoiceField(
        choices=InquiryRouteDecisionChoices.choices,
        read_only=True,
        required=False,
    )
    product_count = serializers.IntegerField(source="products.count", read_only=True)
    total_desired = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_actual = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = Inquiry
        fields = [
            "id",
            "inquiry_number",
            "status",
            # Canonical model fields
            "source_type",
            "route_decision",
            "entity_type",
            "shipping_type",
            "requested_master_product",
            "requested_protein",
            # Convenience aliases (frontend)
            "source",
            "customer",
            "customer_name",
            "supplier",
            "supplier_name",
            "entity_name",
            "contact_name",
            "contact_company",
            "inquiry_date",
            "created_on",
            "valid_until",
            "is_expired",
            "product_count",
            "total_desired",
            "total_actual",
        ]

    def get_entity_name(self, obj):
        """Get the name of the linked entity."""
        if obj.supplier:
            return obj.supplier.name
        elif obj.customer:
            return obj.customer.name
        return None


class InquiryDetailSerializer(InquiryContractValidationMixin, serializers.ModelSerializer):
    """Full serializer for inquiry detail views.

    Exposes frontend-friendly aliases additively (source, customer_name/supplier_name,
    contact_snapshot_* fields) while keeping canonical fields.
    """

    products = InquiryProductSerializer(many=True, read_only=True)
    entity_name = serializers.SerializerMethodField()
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    source = serializers.CharField(source="source_type", read_only=True)
    route_decision = serializers.ChoiceField(
        choices=InquiryRouteDecisionChoices.choices,
        read_only=True,
        required=False,
    )
    scheduled_call = serializers.IntegerField(source="source_call_id", read_only=True, allow_null=True, required=False)

    contact_snapshot_name = serializers.CharField(source="contact_name", read_only=True)
    contact_snapshot_email = serializers.CharField(source="contact_email", read_only=True)
    contact_snapshot_phone = serializers.CharField(source="contact_phone", read_only=True)
    contact_snapshot_company = serializers.CharField(source="contact_company", read_only=True)
    contact_snapshot_position = serializers.CharField(source="contact_position", read_only=True)

    total_desired = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_actual = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_margin = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_margin_percent = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)

    class Meta:
        model = Inquiry
        fields = [
            "id",
            "inquiry_number",
            "status",
            # Canonical model fields
            "source_type",
            "route_decision",
            "entity_type",
            "shipping_type",
            "requested_master_product",
            "requested_protein",
            "source_email",
            "source_email_message_id",
            "source_email_thread_id",
            "supplier_purchase_order",
            "sales_order",
            "carrier_purchase_order",
            # Convenience aliases (frontend)
            "source",
            "customer_name",
            "supplier_name",
            "scheduled_call",
            # Entity links
            "supplier",
            "customer",
            "contact",
            "entity_name",
            # Contact snapshot (canonical)
            "contact_name",
            "contact_email",
            "contact_phone",
            "contact_phone_type",
            "contact_company",
            "contact_position",
            # Contact snapshot (aliases)
            "contact_snapshot_name",
            "contact_snapshot_email",
            "contact_snapshot_phone",
            "contact_snapshot_company",
            "contact_snapshot_position",
            # Dates
            "inquiry_date",
            "quoted_date",
            "decision_date",
            "valid_until",
            "is_expired",
            # Totals
            "total_desired",
            "total_actual",
            "total_margin",
            "total_margin_percent",
            # Notes
            "notes",
            "competitor_names",
            "competitor_pricing_notes",
            "win_loss_reason",
            # Related
            "source_call",
            "products",
            # Meta
            "created_by",
            "created_by_name",
            "created_on",
            "modified_on",
        ]
        read_only_fields = [
            "id",
            "inquiry_number",
            "created_on",
            "modified_on",
            "total_desired",
            "total_actual",
            "total_margin",
            "total_margin_percent",
            "route_decision",
        ]

    def get_entity_name(self, obj):
        """Get the name of the linked entity."""
        if obj.supplier:
            return obj.supplier.name
        elif obj.customer:
            return obj.customer.name
        return None


class InquiryCreateSerializer(InquiryContractValidationMixin, serializers.ModelSerializer):
    """Serializer for creating inquiries with nested products."""

    products = InquiryProductSerializer(many=True, required=False)
    route_decision = serializers.ChoiceField(
        choices=InquiryRouteDecisionChoices.choices,
        read_only=True,
        required=False,
    )

    class Meta:
        model = Inquiry
        fields = [
            "entity_type",
            "shipping_type",
            "route_decision",
            "supplier",
            "customer",
            "contact",
            "contact_name",
            "contact_email",
            "contact_phone",
            "contact_phone_type",
            "contact_company",
            "contact_position",
            "source_type",
            "source_call",
            "source_email",
            "source_email_message_id",
            "source_email_thread_id",
            "requested_master_product",
            "requested_protein",
            "supplier_purchase_order",
            "sales_order",
            "carrier_purchase_order",
            "valid_until",
            "notes",
            "competitor_names",
            "competitor_pricing_notes",
            "products",
        ]
        read_only_fields = ["route_decision"]

    def validate(self, data):
        """Validate entity type matches entity link."""
        data = super().validate(data)
        entity_type = data.get("entity_type")
        supplier = data.get("supplier")
        customer = data.get("customer")

        if entity_type == "supplier" and not supplier:
            raise serializers.ValidationError({"supplier": "Supplier is required when entity_type is supplier"})
        if entity_type == "customer" and not customer:
            raise serializers.ValidationError({"customer": "Customer is required when entity_type is customer"})

        return data

    def create(self, validated_data):
        """Create inquiry with nested products."""
        validated_data = self._apply_contract_defaults(validated_data)
        products_data = validated_data.pop("products", [])

        # Set tenant and created_by from context
        request = self.context.get("request")
        if request:
            validated_data["tenant"] = request.tenant
            validated_data["created_by"] = request.user

        inquiry = Inquiry.objects.create(**validated_data)

        # Create nested products
        for product_data in products_data:
            InquiryProduct.objects.create(inquiry=inquiry, **product_data)

        return inquiry


class AddProductsSerializer(serializers.Serializer):
    """Serializer for adding products to an existing inquiry."""

    products = serializers.ListField(
        child=serializers.DictField(), min_length=1, help_text="List of product data to add"
    )

    def validate_products(self, value):
        """Validate product data."""
        for product_data in value:
            if "product" not in product_data:
                raise serializers.ValidationError("Each product must include a 'product' ID")
        return value


class FromCallSerializer(serializers.Serializer):
    """Serializer for pre-populating inquiry from a call."""

    call_id = serializers.UUIDField(required=True)


# ============================================================================
# TEMPLATE SERIALIZERS
# ============================================================================


class InquiryTemplateProductSerializer(serializers.ModelSerializer):
    """Serializer for template products."""

    product_code = serializers.CharField(source="product.product_code", read_only=True)
    product_description = serializers.CharField(source="product.description", read_only=True)

    class Meta:
        model = InquiryTemplateProduct
        fields = [
            "id",
            "product",
            "product_code",
            "product_description",
            "default_quantity",
            "default_uom",
            "default_price_per_unit",
            "notes",
            "sort_order",
        ]
        read_only_fields = ["id"]


class InquiryTemplateListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for template list views."""

    product_count = serializers.IntegerField(source="products.count", read_only=True)

    class Meta:
        model = InquiryTemplate
        fields = [
            "id",
            "name",
            "description",
            "entity_type",
            "is_active",
            "default_valid_days",
            "use_count",
            "product_count",
            "created_on",
            "modified_on",
        ]


class InquiryTemplateDetailSerializer(serializers.ModelSerializer):
    """Full serializer for template detail views."""

    products = InquiryTemplateProductSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)

    class Meta:
        model = InquiryTemplate
        fields = [
            "id",
            "name",
            "description",
            "entity_type",
            "is_active",
            "default_valid_days",
            "default_notes",
            "use_count",
            "products",
            "created_by",
            "created_by_name",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "use_count", "created_on", "modified_on"]


class InquiryTemplateCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating templates with nested products."""

    products = InquiryTemplateProductSerializer(many=True, required=False)

    class Meta:
        model = InquiryTemplate
        fields = ["name", "description", "entity_type", "is_active", "default_valid_days", "default_notes", "products"]

    def create(self, validated_data):
        """Create template with nested products."""
        products_data = validated_data.pop("products", [])

        request = self.context.get("request")
        if request:
            validated_data["tenant"] = request.tenant
            validated_data["created_by"] = request.user

        template = InquiryTemplate.objects.create(**validated_data)

        for idx, product_data in enumerate(products_data):
            product_data["sort_order"] = product_data.get("sort_order", idx)
            InquiryTemplateProduct.objects.create(template=template, **product_data)

        return template

    def update(self, instance, validated_data):
        """Update template with nested products."""
        products_data = validated_data.pop("products", None)

        # Update template fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # If products provided, replace them
        if products_data is not None:
            instance.products.all().delete()
            for idx, product_data in enumerate(products_data):
                product_data["sort_order"] = product_data.get("sort_order", idx)
                InquiryTemplateProduct.objects.create(template=instance, **product_data)

        return instance


class CloneInquirySerializer(serializers.Serializer):
    """Serializer for cloning an existing inquiry."""

    include_products = serializers.BooleanField(default=True)
    include_pricing = serializers.BooleanField(default=False)
    new_entity_id = serializers.UUIDField(required=False, allow_null=True)
    new_contact_id = serializers.UUIDField(required=False, allow_null=True)
