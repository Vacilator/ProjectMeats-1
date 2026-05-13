"""Admin configuration for deals app."""
from django.contrib import admin
from apps.core.admin import TenantFilteredAdmin
from .models import Deal, DealActionItem


@admin.register(Deal)
class DealAdmin(TenantFilteredAdmin):
    list_display = ('id', 'deal_number', 'tenant', 'status', 'created_on')
    list_filter = ('status', 'tenant')
    search_fields = ('deal_number',)
    readonly_fields = ('created_on', 'modified_on')
    ordering = ('-created_on',)


@admin.register(DealActionItem)
class DealActionItemAdmin(TenantFilteredAdmin):
    list_display = ('id', 'title', 'deal', 'tenant', 'priority', 'status', 'created_on')
    list_filter = ('priority', 'status', 'tenant')
    search_fields = ('title', 'deal__deal_number')
    readonly_fields = ('created_on', 'modified_on')
    ordering = ('-created_on',)
