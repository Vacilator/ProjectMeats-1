from rest_framework import serializers

from tenant_apps.carriers.models import Carrier


class CarrierSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)

    # ArrayField serialization
    departments_array = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = Carrier
        fields = [
            "id",
            "name",
            "code",
            "carrier_type",
            "contact_person",
            "phone",
            "phone_type",
            "email",
            "address",
            "city",
            "state",
            "zip_code",
            "country",
            "mc_number",
            "dot_number",
            "insurance_provider",
            "insurance_policy_number",
            "insurance_expiry",
            "is_active",
            "notes",
            "my_customer_num_from_carrier",
            "accounting_payable_contact_name",
            "accounting_payable_contact_phone",
            "accounting_payable_contact_email",
            "contact_title",
            "sales_contact_name",
            "sales_contact_phone",
            "sales_contact_main_phone",
            "sales_contact_direct_phone",
            "sales_contact_cell_phone",
            "sales_contact_email",
            "accounting_payment_terms",
            "payment_terms",
            "credit_limits",
            "credit_limit",
            "account_line_of_credit",
            "departments",
            "departments_array",
            "how_carrier_make_appointment",
            "pick_up_date",
            "delivery_date",
            "our_purchase_order_number_to_supplier",
            "supplier_confirmation_order_number",
            "delivery_po_number",
            "carrier_release_number",
            "type_of_protein",
            "description_of_product_item",
            "fresh_or_frozen",
            "package_type",
            "quantity",
            "total_weight",
            "net_or_catch_of_package",
            "pickup_delivery_building_name",
            "pickup_delivery_address",
            "pickup_delivery_city",
            "pickup_delivery_state_zip",
            "shipping_contact_name",
            "shipping_contact_phone",
            "shipping_contact_email",
            "receiving_contact_name",
            "receiving_contact_phone",
            "receiving_contact_email",
            "edible_or_inedible",
            "tested_product",
            "plant_address",
            "plant_city",
            "plant_state_zip",
            "contacts",
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
