"""
Django admin configuration for Locations app.
Includes unified management for general locations and plant facilities.
"""
from django.contrib import admin
from apps.core.admin import TenantFilteredAdmin
from .models import Location


@admin.register(Location)
class LocationAdmin(TenantFilteredAdmin):
    """Admin interface for Location model with tenant filtering."""

    list_display = (
        'name',
        'code',
        'location_type',
        'city',
        'state',
        'contact_name',
        'supplier',
        'customer',
        'is_active',
        'is_plant_display',
        'created_on',
    )
    list_filter = (
        'location_type',
        'is_active',
        'created_on',
        'modified_on',
    )
    search_fields = (
        'name',
        'code',
        'city',
        'state',
        'address',
        'contact_name',
        'email',
        'plant_est_num',
        'manager',
    )
    readonly_fields = ('created_on', 'modified_on', 'legacy_plant_id')

    fieldsets = (
        (
            'Basic Information',
            {
                'fields': ('name', 'code', 'location_type', 'is_active')
            },
        ),
        (
            'Address',
            {
                'fields': ('address', 'city', 'state', 'zip_code', 'country')
            },
        ),
        (
            'Contact Information',
            {
                'fields': ('phone', 'email', 'contact_name')
            },
        ),
        (
            'Relationships',
            {
                'fields': ('supplier', 'customer')
            },
        ),
        (
            '🏭 Plant/Facility Details',
            {
                'fields': ('plant_est_num', 'manager', 'capacity', 'created_by'),
                'classes': ('collapse',),
                'description': 'These fields apply to plant/facility locations only.',
            },
        ),
        (
            'Metadata',
            {
                'fields': ('tenant', 'legacy_plant_id', 'created_on', 'modified_on'),
                'classes': ('collapse',)
            },
        ),
    )

    @admin.display(boolean=True, description='Is Plant')
    def is_plant_display(self, obj):
        """Display whether this location is a plant."""
        return obj.is_plant
