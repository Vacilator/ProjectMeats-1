"""
Django Admin configuration for System app.

Provides admin interfaces for:
- SystemChoiceList with inline items (drag-drop, import/export)
- SystemFieldSchema
- TenantConfig
- Product (system-wide product catalog)
- TenantProductPreference (tenant product customizations)

Wave 4 enhancements:
- Custom change_form.html with Alpine.js
- Drag-drop reordering via SortableJS
- JSON import/export for choice items
- Tier-based permission checks (system vs tenant)
"""
import json
from django.contrib import admin
from django.contrib.admin import SimpleListFilter
from django.http import HttpResponse, JsonResponse
from django.urls import path
from django.utils.html import format_html

from apps.system.models import (
    SystemChoiceList,
    SystemChoiceItem,
    SystemFieldSchema,
    TenantConfig,
    Product,
    ProductCategoryChoices,
    TenantProductPreference,
)


class TierFilter(SimpleListFilter):
    """Filter items by tier (System or Tenant)."""
    title = 'Tier'
    parameter_name = 'tier'
    
    def lookups(self, request, model_admin):
        return (
            ('system', '🔒 System'),
            ('tenant', '🏢 Tenant'),
        )
    
    def queryset(self, request, queryset):
        if self.value() == 'system':
            return queryset.filter(tenant__isnull=True)
        if self.value() == 'tenant':
            return queryset.filter(tenant__isnull=False)
        return queryset


class SystemChoiceItemInline(admin.TabularInline):
    """Inline admin for choice items within a list."""
    model = SystemChoiceItem
    extra = 1
    fields = ('value', 'label', 'order', 'is_active', 'is_default', 'tenant')
    ordering = ('order', 'label')
    
    def get_queryset(self, request):
        """Show only system items (tenant=None) in the inline."""
        qs = super().get_queryset(request)
        return qs.filter(tenant__isnull=True)


@admin.register(SystemChoiceList)
class SystemChoiceListAdmin(admin.ModelAdmin):
    """
    Admin for SystemChoiceList with enhanced features:
    - Custom change_form with Alpine.js
    - Drag-drop reordering
    - JSON import/export
    - Tier-based permissions
    """
    list_display = ('slug', 'name', 'items_count_display', 'tier_display', 'is_extensible', 'model_field_path', 'updated_at')
    list_filter = ('is_extensible', 'is_reorderable')
    search_fields = ('slug', 'name', 'description', 'model_field_path')
    readonly_fields = ('id', 'created_at', 'updated_at')
    inlines = [SystemChoiceItemInline]
    change_form_template = 'admin/system/systemchoicelist/change_form.html'
    actions = ['export_selected_json', 'duplicate_choice_list']
    
    fieldsets = (
        (None, {
            'fields': ('id', 'slug', 'name', 'description')
        }),
        ('Configuration', {
            'fields': ('model_field_path', 'is_extensible', 'is_reorderable')
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at', 'created_by'),
            'classes': ('collapse',)
        }),
    )
    
    def get_urls(self):
        """Add custom URLs for import/export API."""
        urls = super().get_urls()
        custom_urls = [
            path(
                '<int:pk>/export/',
                self.admin_site.admin_view(self.export_json_view),
                name='system_systemchoicelist_export'
            ),
            path(
                '<int:pk>/import/',
                self.admin_site.admin_view(self.import_json_view),
                name='system_systemchoicelist_import'
            ),
        ]
        return custom_urls + urls
    
    def export_json_view(self, request, pk):
        """Export choice list items as JSON."""
        try:
            choice_list = SystemChoiceList.objects.get(pk=pk)
            items = choice_list.items.filter(tenant__isnull=True).order_by('order')
            data = {
                'slug': choice_list.slug,
                'name': choice_list.name,
                'is_extensible': choice_list.is_extensible,
                'is_reorderable': choice_list.is_reorderable,
                'items': [
                    {
                        'value': item.value,
                        'label': item.label,
                        'order': item.order,
                        'is_active': item.is_active,
                        'is_default': item.is_default,
                        'extra_data': item.extra_data,
                    }
                    for item in items
                ]
            }
            response = HttpResponse(
                json.dumps(data, indent=2),
                content_type='application/json'
            )
            response['Content-Disposition'] = f'attachment; filename="{choice_list.slug}.json"'
            return response
        except SystemChoiceList.DoesNotExist:
            return JsonResponse({'error': 'Choice list not found'}, status=404)
    
    def import_json_view(self, request, pk):
        """Import choice items from JSON."""
        if request.method != 'POST':
            return JsonResponse({'error': 'POST required'}, status=405)
        
        try:
            choice_list = SystemChoiceList.objects.get(pk=pk)
            data = json.loads(request.body)
            items = data if isinstance(data, list) else data.get('items', [])
            
            created_count = 0
            for item_data in items:
                obj, created = SystemChoiceItem.objects.update_or_create(
                    choice_list=choice_list,
                    value=item_data['value'],
                    tenant=None,
                    defaults={
                        'label': item_data.get('label', item_data['value']),
                        'order': item_data.get('order', 0),
                        'is_active': item_data.get('is_active', True),
                        'is_default': item_data.get('is_default', False),
                        'extra_data': item_data.get('extra_data', {}),
                    }
                )
                if created:
                    created_count += 1
            
            return JsonResponse({
                'success': True,
                'imported': len(items),
                'created': created_count
            })
        except SystemChoiceList.DoesNotExist:
            return JsonResponse({'error': 'Choice list not found'}, status=404)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    @admin.action(description='📤 Export selected as JSON')
    def export_selected_json(self, request, queryset):
        """Export multiple choice lists as a single JSON file."""
        data = []
        for choice_list in queryset:
            items = choice_list.items.filter(tenant__isnull=True).order_by('order')
            data.append({
                'slug': choice_list.slug,
                'name': choice_list.name,
                'is_extensible': choice_list.is_extensible,
                'items': [
                    {'value': item.value, 'label': item.label, 'order': item.order}
                    for item in items
                ]
            })
        
        response = HttpResponse(
            json.dumps(data, indent=2),
            content_type='application/json'
        )
        response['Content-Disposition'] = 'attachment; filename="choice-lists-export.json"'
        return response
    
    @admin.action(description='📋 Duplicate selected')
    def duplicate_choice_list(self, request, queryset):
        """Duplicate choice lists with their items."""
        for choice_list in queryset:
            items = list(choice_list.items.filter(tenant__isnull=True))
            choice_list.pk = None
            choice_list.slug = f"{choice_list.slug}_copy"
            choice_list.name = f"{choice_list.name} (Copy)"
            choice_list.save()
            
            for item in items:
                item.pk = None
                item.choice_list = choice_list
                item.save()
        
        self.message_user(request, f'Successfully duplicated {queryset.count()} choice list(s).')
    
    def items_count_display(self, obj):
        """Display item count with color coding."""
        count = obj.items_count
        if count == 0:
            return format_html('<span style="color: red;">0 items</span>')
        return format_html('<span style="color: green;">{} items</span>', count)
    items_count_display.short_description = 'Items'
    
    def tier_display(self, obj):
        """Display tier level (system lists are not extensible)."""
        if obj.is_extensible:
            return format_html('<span style="background: #fff3e0; color: #e65100; padding: 2px 8px; border-radius: 4px; font-size: 11px;">🏢 Extensible</span>')
        return format_html('<span style="background: #e3f2fd; color: #1565c0; padding: 2px 8px; border-radius: 4px; font-size: 11px;">🔒 System Only</span>')
    tier_display.short_description = 'Tier'
    
    def save_model(self, request, obj, form, change):
        if not change:  # New object
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(SystemChoiceItem)
class SystemChoiceItemAdmin(admin.ModelAdmin):
    """Admin for SystemChoiceItem (separate view for tenant items)."""
    list_display = ('choice_list', 'value', 'label', 'order', 'is_active', 'is_default', 'tenant', 'scope_display')
    list_filter = ('choice_list', 'is_active', 'is_default', TierFilter)
    search_fields = ('value', 'label', 'choice_list__slug')
    list_editable = ('order', 'is_active', 'is_default')
    readonly_fields = ('id', 'created_at', 'updated_at')
    actions = ['mark_active', 'mark_inactive', 'reset_order']
    
    fieldsets = (
        (None, {
            'fields': ('id', 'choice_list', 'tenant')
        }),
        ('Item Definition', {
            'fields': ('value', 'label', 'extra_data')
        }),
        ('Display', {
            'fields': ('order', 'is_active', 'is_default')
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    @admin.action(description='✅ Mark selected as active')
    def mark_active(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} item(s) marked as active.')
    
    @admin.action(description='❌ Mark selected as inactive')
    def mark_inactive(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} item(s) marked as inactive.')
    
    @admin.action(description='🔢 Reset order (alphabetical)')
    def reset_order(self, request, queryset):
        items = list(queryset.order_by('label'))
        for i, item in enumerate(items):
            item.order = i
            item.save(update_fields=['order'])
        self.message_user(request, f'Reset order for {len(items)} item(s).')
    
    def scope_display(self, obj):
        """Display whether item is system or tenant-specific."""
        if obj.is_system_defined:
            return format_html('<span style="color: blue;">🔒 System</span>')
        return format_html('<span style="color: orange;">🏢 Tenant</span>')
    scope_display.short_description = 'Scope'


@admin.register(SystemFieldSchema)
class SystemFieldSchemaAdmin(admin.ModelAdmin):
    """Admin for SystemFieldSchema."""
    list_display = ('field_path', 'field_type', 'label', 'is_required', 'is_readonly', 'is_hidden', 'choice_list')
    list_filter = ('field_type', 'is_required', 'is_readonly', 'is_hidden')
    search_fields = ('field_path', 'label', 'help_text')
    readonly_fields = ('id', 'created_at', 'updated_at', 'app_label', 'model_name', 'field_name')
    
    fieldsets = (
        (None, {
            'fields': ('id', 'field_path', 'field_type')
        }),
        ('Parsed Path', {
            'fields': ('app_label', 'model_name', 'field_name'),
            'classes': ('collapse',)
        }),
        ('Display', {
            'fields': ('label', 'help_text', 'placeholder')
        }),
        ('Validation', {
            'fields': ('validation_rules', 'default_value')
        }),
        ('Behavior', {
            'fields': ('is_required', 'is_readonly', 'is_hidden')
        }),
        ('Choice Configuration', {
            'fields': ('choice_list',),
            'classes': ('collapse',)
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(TenantConfig)
class TenantConfigAdmin(admin.ModelAdmin):
    """Admin for TenantConfig."""
    list_display = ('tenant', 'key', 'category', 'value_preview', 'updated_at', 'updated_by')
    list_filter = ('tenant', 'category')
    search_fields = ('key', 'description', 'tenant__name')
    readonly_fields = ('id', 'created_at', 'updated_at')
    
    fieldsets = (
        (None, {
            'fields': ('id', 'tenant', 'key', 'category')
        }),
        ('Value', {
            'fields': ('value', 'description')
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at', 'updated_by'),
            'classes': ('collapse',)
        }),
    )
    
    def value_preview(self, obj):
        """Show truncated value preview."""
        value_str = str(obj.value)
        if len(value_str) > 50:
            return value_str[:50] + '...'
        return value_str
    value_preview.short_description = 'Value'
    
    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


class ProductCategoryFilter(SimpleListFilter):
    """Filter products by category."""
    title = 'Category'
    parameter_name = 'category'
    
    def lookups(self, request, model_admin):
        return ProductCategoryChoices.choices
    
    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(category=self.value())
        return queryset


class TenantProductPreferenceInline(admin.TabularInline):
    """Inline for tenant product preferences."""
    model = TenantProductPreference
    extra = 0
    readonly_fields = ('tenant', 'created_at')
    fields = ('tenant', 'display_name', 'internal_code', 'default_price', 'default_cost', 'is_active', 'is_favorite')
    can_delete = False
    
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    """
    Admin for system-wide Product catalog.
    
    Features:
    - Category filtering
    - Search by code, name, protein type
    - Inline tenant preferences
    - Status badges
    """
    list_display = (
        'product_code', 'name_truncated', 'category_display', 
        'protein_type', 'fresh_or_frozen_display', 'is_active_display',
        'tenant_usage_count', 'updated_at'
    )
    list_filter = (ProductCategoryFilter, 'is_active', 'fresh_or_frozen', 'tested_product')
    search_fields = ('product_code', 'name', 'description', 'protein_type', 'namp_code', 'usda_code')
    readonly_fields = ('id', 'created_at', 'updated_at', 'legacy_tenant_product_id')
    ordering = ('product_code',)
    inlines = [TenantProductPreferenceInline]
    actions = ['mark_active', 'mark_inactive', 'export_products_csv']
    
    fieldsets = (
        ('Identification', {
            'fields': ('id', 'product_code', 'name', 'description')
        }),
        ('Classification', {
            'fields': ('category', 'protein_type', 'fresh_or_frozen', 'edible_or_inedible')
        }),
        ('Packaging', {
            'fields': ('package_type', 'carton_type', 'pcs_per_carton', 'unit_weight', 'uom')
        }),
        ('Industry Codes', {
            'fields': ('namp_code', 'usda_code', 'ub_code'),
            'classes': ('collapse',)
        }),
        ('Attributes', {
            'fields': ('net_or_catch', 'tested_product')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Audit', {
            'fields': ('legacy_tenant_product_id', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def name_truncated(self, obj):
        """Truncate long names."""
        if len(obj.name) > 40:
            return obj.name[:40] + '...'
        return obj.name
    name_truncated.short_description = 'Name'
    
    def category_display(self, obj):
        """Display category with color badge."""
        colors = {
            'BEEF': '#dc2626',
            'PORK': '#ea580c',
            'POULTRY': '#ca8a04',
            'SEAFOOD': '#0284c7',
            'LAMB': '#7c3aed',
            'VEAL': '#be185d',
            'GAME': '#15803d',
            'OTHER': '#6b7280',
        }
        color = colors.get(obj.category, '#6b7280')
        return format_html(
            '<span style="background: {}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">{}</span>',
            color, obj.get_category_display()
        )
    category_display.short_description = 'Category'
    
    def fresh_or_frozen_display(self, obj):
        """Display fresh/frozen with icon."""
        if obj.is_fresh:
            return format_html('<span style="color: green;">🥬 Fresh</span>')
        elif obj.is_frozen:
            return format_html('<span style="color: blue;">❄️ Frozen</span>')
        return '—'
    fresh_or_frozen_display.short_description = 'State'
    
    def is_active_display(self, obj):
        """Display active status."""
        if obj.is_active:
            return format_html('<span style="color: green;">✓ Active</span>')
        return format_html('<span style="color: red;">✗ Inactive</span>')
    is_active_display.short_description = 'Status'
    
    def tenant_usage_count(self, obj):
        """Count how many tenants use this product."""
        count = obj.tenant_preferences.count()
        if count == 0:
            return format_html('<span style="color: gray;">0 tenants</span>')
        return format_html('<span style="color: blue;">{} tenants</span>', count)
    tenant_usage_count.short_description = 'Usage'
    
    @admin.action(description='✅ Mark selected as active')
    def mark_active(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} product(s) marked as active.')
    
    @admin.action(description='❌ Mark selected as inactive')
    def mark_inactive(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} product(s) marked as inactive.')
    
    @admin.action(description='📤 Export selected as CSV')
    def export_products_csv(self, request, queryset):
        """Export products to CSV."""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="products.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Code', 'Name', 'Category', 'Protein Type', 'Fresh/Frozen', 'Active'])
        
        for product in queryset:
            writer.writerow([
                product.product_code,
                product.name,
                product.category,
                product.protein_type,
                product.fresh_or_frozen,
                product.is_active,
            ])
        
        return response


@admin.register(TenantProductPreference)
class TenantProductPreferenceAdmin(admin.ModelAdmin):
    """
    Admin for tenant-specific product preferences.
    
    Features:
    - Filter by tenant
    - Search by product code/name
    - Pricing management
    """
    list_display = (
        'product_code', 'product_name', 'tenant', 'display_name',
        'default_price_display', 'default_cost_display', 
        'is_active_display', 'is_favorite_display', 'updated_at'
    )
    list_filter = ('tenant', 'is_active', 'is_favorite')
    search_fields = ('product__product_code', 'product__name', 'display_name', 'internal_code', 'tenant__name')
    readonly_fields = ('id', 'created_at', 'updated_at')
    autocomplete_fields = ('product', 'tenant', 'preferred_supplier')
    ordering = ('tenant', 'product__product_code')
    
    fieldsets = (
        ('Relationships', {
            'fields': ('id', 'tenant', 'product')
        }),
        ('Display Customization', {
            'fields': ('display_name', 'internal_code', 'notes')
        }),
        ('Pricing', {
            'fields': ('default_price', 'default_cost')
        }),
        ('Supplier', {
            'fields': ('preferred_supplier', 'supplier_item_number')
        }),
        ('Status', {
            'fields': ('is_active', 'is_favorite', 'sort_order')
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def product_code(self, obj):
        return obj.product.product_code
    product_code.short_description = 'Product Code'
    product_code.admin_order_field = 'product__product_code'
    
    def product_name(self, obj):
        return obj.product.name[:30] + '...' if len(obj.product.name) > 30 else obj.product.name
    product_name.short_description = 'Product'
    
    def default_price_display(self, obj):
        if obj.default_price:
            return format_html('<span style="color: green;">${:,.2f}</span>', obj.default_price)
        return '—'
    default_price_display.short_description = 'Price'
    
    def default_cost_display(self, obj):
        if obj.default_cost:
            return format_html('<span style="color: blue;">${:,.2f}</span>', obj.default_cost)
        return '—'
    default_cost_display.short_description = 'Cost'
    
    def is_active_display(self, obj):
        if obj.is_active:
            return format_html('<span style="color: green;">✓</span>')
        return format_html('<span style="color: red;">✗</span>')
    is_active_display.short_description = 'Active'
    
    def is_favorite_display(self, obj):
        if obj.is_favorite:
            return format_html('<span style="color: gold;">⭐</span>')
        return ''
    is_favorite_display.short_description = '⭐'
