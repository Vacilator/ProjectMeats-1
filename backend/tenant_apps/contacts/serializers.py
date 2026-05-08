"""
Contacts serializers for ProjectMeats.

Provides serialization for contact API endpoints.
"""
from rest_framework import serializers

from tenant_apps.contacts.models import Contact


class ContactSerializer(serializers.ModelSerializer):
    """Serializer for Contact model."""

    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    plant_name = serializers.CharField(source="plant.name", read_only=True)
    location_name = serializers.CharField(source="location.name", read_only=True)

    class Meta:
        model = Contact
        fields = [
            "id",
            "first_name",
            "last_name",
            "email",
            # Legacy phone fields (backward compatibility)
            "phone",
            "phone_type",
            # New department + phone slots
            "department",
            "title",
            "notes",
            "mobile_phone",
            "office_phone",
            "office_phone_ext",
            "protein_types_responsible",
            "items_responsible",
            "documents_responsible_for",
            "company",
            "position",
            "status",
            "supplier",
            "supplier_name",
            "customer",
            "customer_name",
            "plant",
            "plant_name",
            "location",
            "location_name",
            "created_on",
            "modified_on",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "supplier_name",
            "customer_name",
            "plant_name",
            "location_name",
            "created_on",
            "modified_on",
            "created_at",
            "updated_at",
        ]

    def validate_first_name(self, value):
        """Validate first name is provided and is a valid string."""
        if not value or not isinstance(value, str) or not value.strip():
            raise serializers.ValidationError("First name is required and must be a non-empty string.")
        return value.strip()

    def validate_last_name(self, value):
        """Validate last name is provided and is a valid string."""
        if not value or not isinstance(value, str) or not value.strip():
            raise serializers.ValidationError("Last name is required and must be a non-empty string.")
        return value.strip()

    def validate_email(self, value):
        """Validate email format if provided."""
        if value and "@" not in value:
            raise serializers.ValidationError("Invalid email format.")
        return value
