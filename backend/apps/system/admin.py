"""
Django Admin configuration for System app.

Provides admin interfaces for:
- SystemChoiceList with inline items
- SystemFieldSchema
- TenantConfig
"""
from django.contrib import admin
from django.utils.html import format_html

from apps.system.models import (
    SystemChoiceList,
    SystemChoiceItem,
    SystemFieldSchema,
    TenantConfig,
)


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
    """Admin for SystemChoiceList."""
    list_display = ('slug', 'name', 'items_count_display', 'is_extensible', 'model_field_path', 'updated_at')
    list_filter = ('is_extensible', 'is_reorderable')
    search_fields = ('slug', 'name', 'description', 'model_field_path')
    readonly_fields = ('id', 'created_at', 'updated_at')
    inlines = [SystemChoiceItemInline]
    
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
    
    def items_count_display(self, obj):
        """Display item count with color coding."""
        count = obj.items_count
        if count == 0:
            return format_html('<span style="color: red;">0 items</span>')
        return format_html('<span style="color: green;">{} items</span>', count)
    items_count_display.short_description = 'Items'
    
    def save_model(self, request, obj, form, change):
        if not change:  # New object
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(SystemChoiceItem)
class SystemChoiceItemAdmin(admin.ModelAdmin):
    """Admin for SystemChoiceItem (separate view for tenant items)."""
    list_display = ('choice_list', 'value', 'label', 'order', 'is_active', 'is_default', 'tenant', 'scope_display')
    list_filter = ('choice_list', 'is_active', 'is_default', 'tenant')
    search_fields = ('value', 'label', 'choice_list__slug')
    list_editable = ('order', 'is_active', 'is_default')
    readonly_fields = ('id', 'created_at', 'updated_at')
    
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
    
    def scope_display(self, obj):
        """Display whether item is system or tenant-specific."""
        if obj.is_system_defined:
            return format_html('<span style="color: blue;">System</span>')
        return format_html('<span style="color: orange;">Tenant</span>')
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
