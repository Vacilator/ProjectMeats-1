"""
ConfigResolver service for cascading configuration resolution.

Implements a 3-tier configuration lookup:
1. Tenant-specific override (TenantConfig)
2. System-level default (SystemFieldSchema or SystemChoiceList)
3. Code-defined fallback

Usage:
    resolver = ConfigResolver(tenant=request.tenant)

    # Get a single config value
    theme_color = resolver.get('ui.theme.primary_color', default='#667eea')

    # Get all choices for a dropdown
    protein_choices = resolver.get_choices('protein_type')

    # Get field schema
    field_schema = resolver.get_field_schema('products.product.protein_type')
"""
from typing import Any, Dict, List, Optional

from django.core.cache import cache
from django.db.models import Q

from apps.system.models import SystemChoiceItem, SystemFieldSchema, TenantConfig


class ConfigResolver:
    """
    Resolves configuration values with tenant-aware cascading.

    Priority (highest to lowest):
    1. Tenant-specific TenantConfig
    2. SystemFieldSchema defaults
    3. Code-defined defaults passed to get()

    Caching:
    - System-level configs cached for 5 minutes
    - Tenant-level configs cached for 1 minute
    - Cache invalidated on model save (via signals)
    """

    # Cache timeouts in seconds
    SYSTEM_CACHE_TTL = 300  # 5 minutes
    TENANT_CACHE_TTL = 60  # 1 minute

    def __init__(self, tenant=None):
        """
        Initialize resolver with optional tenant context.

        Args:
            tenant: Tenant instance or None for system-level resolution
        """
        self.tenant = tenant
        self.tenant_id = tenant.id if tenant else None

    def get(self, key: str, default: Any = None) -> Any:
        """
        Get a configuration value with cascading resolution.

        Args:
            key: Configuration key (e.g., 'ui.theme.primary_color')
            default: Fallback value if not found anywhere

        Returns:
            Resolved configuration value
        """
        # 1. Check tenant-specific config
        if self.tenant_id:
            tenant_value = self._get_tenant_config(key)
            if tenant_value is not None:
                return tenant_value

        # 2. Check system field schema defaults
        system_value = self._get_system_default(key)
        if system_value is not None:
            return system_value

        # 3. Return code-defined default
        return default

    def get_choices(
        self, list_slug: str, include_inactive: bool = False, include_tenant_custom: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Get choice items for a dropdown field.

        Args:
            list_slug: The slug of the SystemChoiceList
            include_inactive: Include inactive items (default: False)
            include_tenant_custom: Include tenant-specific additions (default: True)

        Returns:
            List of choice dicts: [{"value": "X", "label": "X Label", ...}, ...]
        """
        cache_key = self._get_choices_cache_key(list_slug, include_inactive, include_tenant_custom)
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        # Build query for items
        items_query = SystemChoiceItem.objects.filter(choice_list__slug=list_slug)

        if not include_inactive:
            items_query = items_query.filter(is_active=True)

        # Filter by tenant scope
        if include_tenant_custom and self.tenant_id:
            # System items + this tenant's custom items
            items_query = items_query.filter(Q(tenant__isnull=True) | Q(tenant_id=self.tenant_id))
        else:
            # System items only
            items_query = items_query.filter(tenant__isnull=True)

        items_query = items_query.order_by("order", "label")

        choices = [
            {
                "value": item.value,
                "label": item.label,
                "is_default": item.is_default,
                "is_system": item.tenant_id is None,
                "extra_data": item.extra_data,
            }
            for item in items_query
        ]

        # Cache result
        ttl = self.TENANT_CACHE_TTL if self.tenant_id else self.SYSTEM_CACHE_TTL
        cache.set(cache_key, choices, ttl)

        return choices

    def get_field_schema(self, field_path: str) -> Optional[Dict[str, Any]]:
        """
        Get schema configuration for a specific field.

        Args:
            field_path: Dot-path to field (e.g., 'products.product.protein_type')

        Returns:
            Dict with field configuration or None if not defined
        """
        cache_key = f"field_schema:{field_path}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            schema = SystemFieldSchema.objects.get(field_path=field_path)
            result = {
                "field_path": schema.field_path,
                "field_type": schema.field_type,
                "label": schema.label,
                "help_text": schema.help_text,
                "placeholder": schema.placeholder,
                "validation_rules": schema.validation_rules,
                "default_value": schema.default_value,
                "is_required": schema.is_required,
                "is_readonly": schema.is_readonly,
                "is_hidden": schema.is_hidden,
                "choice_list_slug": schema.choice_list.slug if schema.choice_list else None,
            }
            cache.set(cache_key, result, self.SYSTEM_CACHE_TTL)
            return result
        except SystemFieldSchema.DoesNotExist:
            return None

    def get_all_tenant_configs(self, category: Optional[str] = None) -> Dict[str, Any]:
        """
        Get all configuration values for the current tenant.

        Args:
            category: Optional category filter

        Returns:
            Dict mapping keys to values
        """
        if not self.tenant_id:
            return {}

        query = TenantConfig.objects.filter(tenant_id=self.tenant_id)
        if category:
            query = query.filter(category=category)

        return {config.key: config.value for config in query}

    def set_tenant_config(
        self, key: str, value: Any, category: str = "OTHER", description: str = "", user=None
    ) -> TenantConfig:
        """
        Set a tenant configuration value.

        Args:
            key: Configuration key
            value: Configuration value
            category: Config category
            description: Optional description
            user: User making the change

        Returns:
            Created or updated TenantConfig instance
        """
        if not self.tenant_id:
            raise ValueError("Cannot set tenant config without tenant context")

        config, created = TenantConfig.objects.update_or_create(
            tenant_id=self.tenant_id,
            key=key,
            defaults={
                "value": value,
                "category": category,
                "description": description,
                "updated_by": user,
            },
        )

        # Invalidate cache
        self._invalidate_tenant_cache(key)

        return config

    # Private helper methods

    def _get_tenant_config(self, key: str) -> Optional[Any]:
        """Get tenant-specific config value."""
        cache_key = f"tenant_config:{self.tenant_id}:{key}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            config = TenantConfig.objects.get(tenant_id=self.tenant_id, key=key)
            cache.set(cache_key, config.value, self.TENANT_CACHE_TTL)
            return config.value
        except TenantConfig.DoesNotExist:
            return None

    def _get_system_default(self, key: str) -> Optional[Any]:
        """Get system-level default value."""
        # Check if this maps to a field schema default
        cache_key = f"system_default:{key}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        # Try to find a matching field schema
        try:
            schema = SystemFieldSchema.objects.get(field_path=key)
            if schema.default_value is not None:
                cache.set(cache_key, schema.default_value, self.SYSTEM_CACHE_TTL)
                return schema.default_value
        except SystemFieldSchema.DoesNotExist:
            pass

        return None

    def _get_choices_cache_key(self, list_slug: str, include_inactive: bool, include_tenant_custom: bool) -> str:
        """Generate cache key for choices query."""
        tenant_part = f":{self.tenant_id}" if self.tenant_id and include_tenant_custom else ":system"
        inactive_part = ":with_inactive" if include_inactive else ""
        return f"choices:{list_slug}{tenant_part}{inactive_part}"

    def _invalidate_tenant_cache(self, key: str) -> None:
        """Invalidate cache for a tenant config key."""
        if self.tenant_id:
            cache.delete(f"tenant_config:{self.tenant_id}:{key}")


def get_config(key: str, tenant=None, default: Any = None) -> Any:
    """
    Convenience function for getting config values.

    Usage:
        from apps.system.services.config_resolver import get_config

        theme = get_config('ui.theme.primary_color', tenant=request.tenant, default='#667eea')
    """
    resolver = ConfigResolver(tenant=tenant)
    return resolver.get(key, default=default)


def get_choices(list_slug: str, tenant=None) -> List[Dict[str, Any]]:
    """
    Convenience function for getting choice lists.

    Usage:
        from apps.system.services.config_resolver import get_choices

        proteins = get_choices('protein_type', tenant=request.tenant)
    """
    resolver = ConfigResolver(tenant=tenant)
    return resolver.get_choices(list_slug)
