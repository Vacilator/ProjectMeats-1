"""
Customers serializers for ProjectMeats.

Provides serialization for customer API endpoints.
"""
from rest_framework import serializers

from tenant_apps.customers.models import Customer
from tenant_apps.locations.serializers import LocationListSerializer

from apps.core.models import PhoneTypeChoices


class CustomerSerializer(serializers.ModelSerializer):
    """Serializer for Customer model."""

    aggregated_preferred_products = serializers.SerializerMethodField()

    # ArrayField serialization
    industry_array = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        allow_empty=True,
    )
    preferred_protein_types = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        allow_empty=True,
    )

    # Nested locations (via reverse FK)
    locations = LocationListSerializer(many=True, read_only=True)

    class Meta:
        model = Customer
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
            "purchasing_preference_origin",
            "industry",
            "industry_array",
            "preferred_protein_types",
            "aggregated_preferred_products",
            "contacts",
            "products",
            "will_pickup_load",
            "locations",
            "accounting_payment_terms",
            "payment_terms",
            "credit_limits",
            "credit_limit",
            "account_line_of_credit",
            "accounting_payable_contact_name",
            "accounting_payable_contact_phone",
            "accounting_payable_contact_email",
            "pick_up_date",
            "delivery_date",
            "our_sales_order_number_for_customer",
            "delivery_po_number",
            "buyer_contact_name",
            "buyer_contact_phone",
            "buyer_contact_main_phone",
            "buyer_contact_direct_phone",
            "buyer_contact_cell_phone",
            "buyer_contact_email",
            "contact_title",
            "total_net_weight",
            "uom",
            "product_exportable",
            "accounting_terms",
            "accounting_line_of_credit",
            "created_on",
            "modified_on",
        ]
        read_only_fields = ["id", "created_on", "modified_on", "locations"]

    def get_aggregated_preferred_products(self, obj) -> list[int]:
        """Return distinct master product IDs aggregated from child locations/contacts.

        NOTE: This is computed from queryset annotations to avoid N+1 queries.
        """

        values: list[int] = []
        for field in ("preferred_products_from_locations", "preferred_products_from_contacts"):
            raw = getattr(obj, field, None)
            if not raw:
                continue
            values.extend([int(v) for v in raw if v is not None])

        seen: set[int] = set()
        out: list[int] = []
        for v in values:
            if v in seen:
                continue
            seen.add(v)
            out.append(v)
        return out

    def validate_name(self, value):
        """Validate customer name is provided and is a valid string."""
        if not value or not isinstance(value, str) or not value.strip():
            raise serializers.ValidationError("Customer name is required and must be a non-empty string.")
        return value.strip()

    def validate_email(self, value):
        """Validate email format if provided."""
        if value and "@" not in value:
            raise serializers.ValidationError("Invalid email format.")
        return value

    def _sync_phone_fields(self, attrs: dict) -> dict:
        """Keep legacy (phone/phone_type) and new explicit phone slots in sync.

        Priority for legacy primary phone:
        - office phone if present
        - else mobile phone if present
        """

        # Normalize empties
        def _clean(v: object) -> str:
            return str(v).strip() if isinstance(v, str) else ""

        has_mobile_key = "phone_mobile" in attrs
        has_office_key = "phone_office" in attrs
        has_legacy_phone_key = "phone" in attrs
        has_legacy_type_key = "phone_type" in attrs

        mobile = _clean(attrs.get("phone_mobile")) if has_mobile_key else ""
        office = _clean(attrs.get("phone_office")) if has_office_key else ""

        # If an older client sends legacy phone only, populate new slots.
        if has_legacy_phone_key and not has_mobile_key and not has_office_key:
            legacy_phone = _clean(attrs.get("phone"))
            legacy_type = _clean(attrs.get("phone_type")) if has_legacy_type_key else ""

            if legacy_phone:
                if legacy_type == PhoneTypeChoices.MOBILE:
                    attrs["phone_mobile"] = legacy_phone
                else:
                    attrs["phone_office"] = legacy_phone

        # If new slots are provided and legacy phone isn't, derive legacy.
        if (mobile or office) and not (has_legacy_phone_key and _clean(attrs.get("phone"))):
            if office:
                attrs["phone"] = office
                attrs["phone_type"] = PhoneTypeChoices.OFFICE
            else:
                attrs["phone"] = mobile
                attrs["phone_type"] = PhoneTypeChoices.MOBILE

        return attrs

    def create(self, validated_data):
        validated_data = self._sync_phone_fields(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._sync_phone_fields(validated_data)
        return super().update(instance, validated_data)
