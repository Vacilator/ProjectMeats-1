"""Admin configuration for Fulfillments."""
from django.contrib import admin
from apps.core.admin_site import admin_site
from .models import Fulfillment, FulfillmentProduct


class FulfillmentProductInline(admin.TabularInline):
    """Inline admin for fulfillment products."""
    model = FulfillmentProduct
    extra = 0
    fields = ['inquiry_product', 'quantity_fulfilled', 'unit_price', 'total', 'notes']
    readonly_fields = ['total']


class FulfillmentAdmin(admin.ModelAdmin):
    """Admin for Fulfillment model."""
    list_display = [
        'fulfillment_number', 'inquiry', 'status',
        'supplier', 'customer', 'carrier',
        'ship_date', 'expected_delivery', 'actual_delivery'
    ]
    list_filter = ['status', 'tenant']
    search_fields = ['fulfillment_number', 'inquiry__inquiry_number', 'notes']
    readonly_fields = ['fulfillment_number', 'created_on', 'modified_on', 'total_value']
    date_hierarchy = 'created_on'
    inlines = [FulfillmentProductInline]
    
    fieldsets = (
        ('Identification', {
            'fields': ('tenant', 'fulfillment_number', 'inquiry', 'status')
        }),
        ('Parties', {
            'fields': ('supplier', 'customer', 'carrier')
        }),
        ('Logistics', {
            'fields': ('ship_date', 'expected_delivery', 'actual_delivery', 'tracking_numbers')
        }),
        ('Totals', {
            'fields': ('total_value',)
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_by', 'shipped_by', 'created_on', 'modified_on'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        return super().get_queryset(request).select_related(
            'tenant', 'inquiry', 'supplier', 'customer', 'carrier', 'created_by', 'shipped_by'
        )


# Register models with custom admin site
admin_site.register(Fulfillment, FulfillmentAdmin)
