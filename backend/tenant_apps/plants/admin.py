"""
Django admin configuration for Plants app.
"""
from apps.core.admin import TenantFilteredAdmin
from apps.core.admin_site import admin_site

from .models import Plant


class PlantAdmin(TenantFilteredAdmin):
    """Admin interface for Plant model with tenant filtering."""

    list_display = (
        "name",
        "plant_est_num",
        "plant_type",
        "city",
        "state",
        "is_active",
        "created_at",
    )
    list_filter = ("plant_type", "is_active", "country", "state", "created_at")
    search_fields = ("name", "plant_est_num", "city")
    readonly_fields = ("created_at", "updated_at")

    fieldsets = (
        (
            "Basic Information",
            {"fields": ("name", "plant_est_num", "plant_type")},
        ),
        ("Address", {"fields": ("address", "city", "state", "zip_code", "country")}),
        (
            "Booking Contact (Optional)",
            {"fields": ("booking_contact_email", "booking_contact_phone", "booking_contact_phone_type")},
        ),
        ("Operational Details", {"fields": ("capacity", "is_active", "fcfs")}),
        (
            "Metadata",
            {
                "fields": ("tenant", "created_by", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )


# Register models with custom admin site
admin_site.register(Plant, PlantAdmin)
