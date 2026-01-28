"""Admin configuration for Inquiries."""
from django.contrib import admin
from .models import Inquiry, InquiryProduct, InquiryTemplate, InquiryTemplateProduct


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


@admin.register(Inquiry)
class InquiryAdmin(admin.ModelAdmin):
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


@admin.register(InquiryTemplate)
class InquiryTemplateAdmin(admin.ModelAdmin):
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
