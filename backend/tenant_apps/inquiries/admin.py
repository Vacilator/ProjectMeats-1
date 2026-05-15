"""Admin configuration for Inquiries."""
from django.contrib import admin
from apps.core.admin_site import admin_site
from apps.core.admin import TenantFilteredAdmin
from .models import (
    Inquiry, InquiryProduct, InquiryProductSupplierBid, InquirySupplierRFQ,
    InquiryTemplate, InquiryTemplateProduct, TradeSession,
)


class InquiryProductInline(admin.TabularInline):
    """Inline admin for inquiry products."""
    model = InquiryProduct
    extra = 0
    readonly_fields = ['margin', 'margin_percent']
    fields = [
        'product', 'quantity',
        'desired_price_per_unit', 'desired_total', 'desired_uom',
        'actual_price_per_unit', 'actual_total', 'actual_uom',
        'margin', 'margin_percent'
    ]


class InquiryAdmin(TenantFilteredAdmin):
    """Admin for Inquiry model."""
    list_display = [
        'inquiry_number', 'entity_type', 'get_entity_name', 
        'status', 'source_type', 'inquiry_date', 'valid_until'
    ]
    list_filter = ['status', 'entity_type', 'source_type', 'tenant']
    search_fields = ['inquiry_number', 'contact_name', 'contact_company', 'notes']
    readonly_fields = [
        'inquiry_number', 'created_on', 'modified_on',
        'total_desired', 'total_actual', 'total_margin', 'total_margin_percent'
    ]
    date_hierarchy = 'inquiry_date'
    inlines = [InquiryProductInline]
    
    fieldsets = (
        ('Identification', {
            'fields': ('tenant', 'inquiry_number', 'status', 'source_type', 'source_call')
        }),
        ('Entity', {
            'fields': ('entity_type', 'supplier', 'customer', 'contact')
        }),
        ('Contact Snapshot', {
            'fields': ('contact_name', 'contact_email', 'contact_phone', 'contact_company', 'contact_position'),
            'classes': ('collapse',)
        }),
        ('Dates', {
            'fields': ('inquiry_date', 'quoted_date', 'decision_date', 'valid_until')
        }),
        ('Totals (Calculated)', {
            'fields': ('total_desired', 'total_actual', 'total_margin', 'total_margin_percent'),
            'classes': ('collapse',)
        }),
        ('Notes & Competition', {
            'fields': ('notes', 'competitor_names', 'competitor_pricing_notes', 'win_loss_reason'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_on', 'modified_on'),
            'classes': ('collapse',)
        }),
    )
    
    def get_entity_name(self, obj):
        """Display entity name."""
        return obj.supplier.name if obj.supplier else (obj.customer.name if obj.customer else '-')
    get_entity_name.short_description = 'Entity'
    
    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        return super().get_queryset(request).select_related(
            'tenant', 'supplier', 'customer', 'contact', 'source_call', 'created_by'
        )


class InquiryTemplateProductInline(admin.TabularInline):
    """Inline admin for template products."""
    model = InquiryTemplateProduct
    extra = 1
    fields = ['product', 'default_quantity', 'default_uom', 'default_price_per_unit', 'sort_order', 'notes']


class InquiryTemplateAdmin(TenantFilteredAdmin):
    """Admin for InquiryTemplate model."""
    list_display = [
        'name', 'entity_type', 'is_active', 'use_count', 
        'get_product_count', 'default_valid_days', 'created_on'
    ]
    list_filter = ['entity_type', 'is_active', 'tenant']
    search_fields = ['name', 'description']
    readonly_fields = ['use_count', 'created_on', 'modified_on']
    inlines = [InquiryTemplateProductInline]
    
    fieldsets = (
        ('Template Info', {
            'fields': ('tenant', 'name', 'description', 'entity_type', 'is_active')
        }),
        ('Defaults', {
            'fields': ('default_valid_days', 'default_notes')
        }),
        ('Usage', {
            'fields': ('use_count',),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_on', 'modified_on'),
            'classes': ('collapse',)
        }),
    )
    
    def get_product_count(self, obj):
        """Count products in template."""
        return obj.products.count()
    get_product_count.short_description = 'Products'
    
    def get_queryset(self, request):
        """Optimize queryset."""
        return super().get_queryset(request).select_related('tenant', 'created_by').prefetch_related('products')


# Register models with custom admin site
admin_site.register(Inquiry, InquiryAdmin)
admin_site.register(InquiryTemplate, InquiryTemplateAdmin)


class InquirySupplierRFQAdmin(TenantFilteredAdmin):
    """Admin for outbound RFQ audit records."""

    list_display = ['inquiry', 'supplier', 'status', 'recipient_email', 'sent_at', 'attempt_count']
    list_filter = ['status', 'provider', 'tenant']
    search_fields = ['recipient_email', 'recipient_name', 'subject']
    readonly_fields = ['correlation_key', 'created_on', 'modified_on', 'sent_at', 'last_attempted_at']
    raw_id_fields = ['inquiry', 'supplier', 'created_by']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('tenant', 'inquiry', 'supplier')


class TradeSessionAdmin(TenantFilteredAdmin):
    """Admin for trade lineage tracking."""

    list_display = ['trade_id', 'status', 'inquiry', 'created_on']
    list_filter = ['status', 'tenant']
    search_fields = ['trade_id']
    readonly_fields = ['trade_id', 'created_on', 'modified_on']
    raw_id_fields = ['inquiry']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('tenant', 'inquiry')


admin_site.register(InquirySupplierRFQ, InquirySupplierRFQAdmin)
admin_site.register(TradeSession, TradeSessionAdmin)


class InquiryProductSupplierBidAdmin(TenantFilteredAdmin):
    """Admin for per-product supplier bids."""
    list_display = ['id', 'inquiry_product', 'supplier', 'plant', 'bid_status', 'bid_price_per_unit', 'bid_total', 'requested_at', 'responded_at']
    list_filter = ['bid_status']
    search_fields = ['supplier__name', 'inquiry_product__inquiry__inquiry_number']
    raw_id_fields = ['inquiry_product', 'supplier', 'plant', 'contact', 'rfq', 'tenant']
    readonly_fields = ['created_on', 'modified_on']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('tenant', 'supplier', 'plant', 'inquiry_product')


admin_site.register(InquiryProductSupplierBid, InquiryProductSupplierBidAdmin)
