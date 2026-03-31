"""
Django admin configuration for Products app.
"""
from apps.core.admin_site import admin_site
from apps.core.admin import TenantFilteredAdmin
from .models import MasterProduct


class MasterProductAdmin(TenantFilteredAdmin):
    """Admin interface for MasterProduct model with tenant filtering."""

    list_display = (
        'display_name',
        'protein',
        'item_name',
        'type',
        'trim',
        'is_active',
        'created_on',
    )
    list_filter = ('protein', 'type', 'trim', 'is_active', 'created_on')
    search_fields = ('display_name', 'item_name')
    readonly_fields = ('display_name', 'created_on', 'modified_on')

    fieldsets = (
        (
            'Master Product',
            {
                'fields': (
                    'protein',
                    'item_name',
                    'type',
                    'trim',
                    'display_name',
                    'is_active',
                )
            },
        ),
        (
            'Metadata',
            {
                'fields': ('tenant', 'created_on', 'modified_on'),
                'classes': ('collapse',),
            },
        ),
    )


# Register models with custom admin site
admin_site.register(MasterProduct, MasterProductAdmin)
