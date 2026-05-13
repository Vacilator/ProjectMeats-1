"""Admin configuration for integrations app."""
from django.contrib import admin
from apps.core.admin import TenantFilteredAdmin
from .models import TenantAPIKey, TenantWebhook, SettlementSource, SettlementEvent


@admin.register(TenantAPIKey)
class TenantAPIKeyAdmin(TenantFilteredAdmin):
    list_display = ('id', 'tenant', 'name', 'key_prefix', 'created_on')
    list_filter = ('tenant',)
    search_fields = ('name', 'key_prefix')
    readonly_fields = ('created_on', 'modified_on', 'key_hash')
    ordering = ('-created_on',)


@admin.register(TenantWebhook)
class TenantWebhookAdmin(TenantFilteredAdmin):
    list_display = ('id', 'tenant', 'target_url', 'event_type', 'is_active', 'created_on')
    list_filter = ('is_active', 'event_type', 'tenant')
    search_fields = ('target_url',)
    readonly_fields = ('created_on', 'modified_on')
    ordering = ('-created_on',)


@admin.register(SettlementSource)
class SettlementSourceAdmin(TenantFilteredAdmin):
    list_display = ('id', 'tenant', 'name', 'provider_code', 'is_active', 'created_on')
    list_filter = ('provider_code', 'is_active', 'tenant')
    search_fields = ('name', 'public_id')
    readonly_fields = ('created_on', 'modified_on')
    ordering = ('-created_on',)


@admin.register(SettlementEvent)
class SettlementEventAdmin(TenantFilteredAdmin):
    list_display = ('id', 'tenant', 'source', 'event_type', 'direction', 'amount', 'created_on')
    list_filter = ('event_type', 'direction', 'tenant')
    search_fields = ('external_event_id', 'source__name')
    readonly_fields = ('created_on', 'modified_on')
    ordering = ('-created_on',)
