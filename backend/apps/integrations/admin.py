"""
Admin interface for integrations app.
"""
from django.contrib import admin
from .models import ExternalAuthProvider


@admin.register(ExternalAuthProvider)
class ExternalAuthProviderAdmin(admin.ModelAdmin):
    """Admin for external auth providers."""
    
    list_display = [
        'tenant',
        'provider_type',
        'connected_email',
        'is_active',
        'is_token_expired',
        'created_at',
    ]
    
    list_filter = [
        'provider_type',
        'is_active',
        'created_at',
    ]
    
    search_fields = [
        'tenant__name',
        'connected_email',
        'connected_name',
    ]
    
    readonly_fields = [
        'created_at',
        'updated_at',
        'token_expiry',
        'connected_email',
        'connected_name',
    ]
    
    fieldsets = (
        ('Provider Information', {
            'fields': ('tenant', 'provider_type', 'is_active')
        }),
        ('Connection Details', {
            'fields': ('connected_email', 'connected_name', 'token_expiry')
        }),
        ('Encrypted Tokens', {
            'fields': ('access_token', 'refresh_token'),
            'classes': ('collapse',),
            'description': 'These tokens are encrypted at rest and should not be viewed or edited directly.',
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    
    def get_readonly_fields(self, request, obj=None):
        """Make tokens read-only."""
        readonly = list(super().get_readonly_fields(request, obj))
        if obj:  # Editing existing object
            readonly.extend(['access_token', 'refresh_token'])
        return readonly
