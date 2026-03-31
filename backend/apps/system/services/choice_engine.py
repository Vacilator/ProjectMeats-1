"""
Tiered Choice Engine Service.

Provides high-level methods for resolving choices through the 3-tier hierarchy:
1. System Root (tenant=None, SystemChoiceItem records)
2. Tenant Custom (tenant=X, SystemChoiceItem records with tenant FK)
3. WorkForm Override (future: TenantChoiceOverride per form)

This service abstracts the complexity of filtering across tiers and respects
PostgreSQL RLS policies via request.tenant context.

Phase 3: Data Architecture - Virtual Schema & Tiered Choice Engine
"""
from typing import List, Dict, Any, Optional
from django.db.models import Q
from apps.system.models import SystemChoiceList, SystemChoiceItem, TenantChoiceOverride


class ChoiceEngineService:
    """
    Service for resolving choices through the tiered choice hierarchy.
    
    Usage:
        service = ChoiceEngineService(tenant=request.tenant)
        choices = service.get_choices_for_field('protein_type')
        # Returns: System choices + tenant custom choices (minus disabled)
    """
    
    def __init__(self, tenant=None):
        """
        Initialize the choice engine with tenant context.
        
        Args:
            tenant: Tenant instance from request.tenant (set by TenantMiddleware)
        """
        self.tenant = tenant
    
    def get_choices_for_field(
        self,
        slug: str,
        include_inactive: bool = False,
        workform_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get all choices for a specific field, respecting tenant hierarchy.
        
        Args:
            slug: SystemChoiceList slug (e.g., 'protein_type')
            include_inactive: Whether to include deactivated items
            workform_id: Future: WorkForm-specific overrides (not implemented yet)
        
        Returns:
            List of choice dicts with keys: id, value, label, order, is_default, extra_data
        
        Raises:
            SystemChoiceList.DoesNotExist: If slug not found
        """
        choice_list = SystemChoiceList.objects.get(slug=slug)
        
        # Base queryset: system items + tenant custom items
        items_qs = SystemChoiceItem.objects.filter(choice_list=choice_list)
        
        if not include_inactive:
            items_qs = items_qs.filter(is_active=True)
        
        if self.tenant:
            # System items + tenant's custom items
            items_qs = items_qs.filter(
                Q(tenant__isnull=True) | Q(tenant=self.tenant)
            )
            
            # Apply tenant overrides (disabled items)
            try:
                override = TenantChoiceOverride.objects.get(
                    tenant=self.tenant,
                    choice_list=choice_list
                )
                if override.disabled_system_items:
                    items_qs = items_qs.exclude(id__in=override.disabled_system_items)
            except TenantChoiceOverride.DoesNotExist:
                pass  # No overrides, show all
        else:
            # No tenant: system items only
            items_qs = items_qs.filter(tenant__isnull=True)
        
        # Order by priority: order field, then label
        items_qs = items_qs.order_by('order', 'label')
        
        # Serialize to dict
        choices = []
        for item in items_qs:
            choices.append({
                'id': str(item.id),
                'value': item.value,
                'label': item.label,
                'order': item.order,
                'is_default': item.is_default,
                'is_system': item.tenant_id is None,
                'extra_data': item.extra_data or {},
            })
        
        return choices
    
    def get_default_choice(self, slug: str) -> Optional[Dict[str, Any]]:
        """
        Get the default choice for a field (is_default=True).
        
        Args:
            slug: SystemChoiceList slug
        
        Returns:
            Choice dict or None if no default set
        """
        choices = self.get_choices_for_field(slug)
        defaults = [c for c in choices if c['is_default']]
        return defaults[0] if defaults else None
    
    def validate_choice_value(self, slug: str, value: str) -> bool:
        """
        Check if a value is valid for this choice list (in current tenant context).
        
        Args:
            slug: SystemChoiceList slug
            value: Value to validate
        
        Returns:
            True if value exists in current tenant's choices, False otherwise
        """
        choices = self.get_choices_for_field(slug)
        valid_values = {c['value'] for c in choices}
        return value in valid_values
    
    def add_tenant_custom_choice(
        self,
        slug: str,
        value: str,
        label: str,
        order: int = 100,
        extra_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Add a custom choice item for the current tenant.
        
        Args:
            slug: SystemChoiceList slug
            value: Choice value (unique per tenant per list)
            label: Display label
            order: Sort order (default 100 = after system items)
            extra_data: Optional metadata
        
        Returns:
            Created choice dict
        
        Raises:
            ValueError: If tenant not set or list not extensible
            SystemChoiceList.DoesNotExist: If slug not found
        """
        if not self.tenant:
            raise ValueError("Tenant context required to add custom choices")
        
        choice_list = SystemChoiceList.objects.get(slug=slug)
        
        if not choice_list.is_extensible:
            raise ValueError(f"Choice list '{slug}' does not allow custom items")
        
        # Check for duplicate value
        exists = SystemChoiceItem.objects.filter(
            choice_list=choice_list,
            tenant=self.tenant,
            value=value
        ).exists()
        
        if exists:
            raise ValueError(f"Choice value '{value}' already exists for this tenant")
        
        item = SystemChoiceItem.objects.create(
            choice_list=choice_list,
            tenant=self.tenant,
            value=value,
            label=label,
            order=order,
            extra_data=extra_data or {},
            is_active=True,
            is_default=False,
        )
        
        return {
            'id': str(item.id),
            'value': item.value,
            'label': item.label,
            'order': item.order,
            'is_default': item.is_default,
            'is_system': False,
            'extra_data': item.extra_data,
        }
    
    def disable_system_choice(self, slug: str, item_id: str) -> None:
        """
        Disable a system choice for the current tenant (hide from dropdowns).
        
        Args:
            slug: SystemChoiceList slug
            item_id: UUID of SystemChoiceItem to disable
        
        Raises:
            ValueError: If tenant not set or trying to disable tenant-custom item
        """
        if not self.tenant:
            raise ValueError("Tenant context required to override choices")
        
        choice_list = SystemChoiceList.objects.get(slug=slug)
        
        # Verify item is system-defined
        item = SystemChoiceItem.objects.get(id=item_id, choice_list=choice_list)
        if item.tenant_id is not None:
            raise ValueError("Can only disable system-defined items (use delete for custom items)")
        
        # Get or create override record
        override, _ = TenantChoiceOverride.objects.get_or_create(
            tenant=self.tenant,
            choice_list=choice_list
        )
        
        # Add to disabled list
        if item_id not in override.disabled_system_items:
            override.disabled_system_items.append(item_id)
            override.save()
    
    def enable_system_choice(self, slug: str, item_id: str) -> None:
        """
        Re-enable a previously disabled system choice for the current tenant.
        
        Args:
            slug: SystemChoiceList slug
            item_id: UUID of SystemChoiceItem to enable
        """
        if not self.tenant:
            return  # No-op if no tenant
        
        choice_list = SystemChoiceList.objects.get(slug=slug)
        
        try:
            override = TenantChoiceOverride.objects.get(
                tenant=self.tenant,
                choice_list=choice_list
            )
            
            if item_id in override.disabled_system_items:
                override.disabled_system_items.remove(item_id)
                override.save()
        except TenantChoiceOverride.DoesNotExist:
            pass  # No overrides, nothing to enable
    
    def get_all_choice_lists(self) -> List[Dict[str, Any]]:
        """
        Get metadata for all choice lists (for admin UIs).
        
        Returns:
            List of choice list dicts with keys: slug, name, description, items_count
        """
        lists_qs = SystemChoiceList.objects.all().order_by('slug')
        
        results = []
        for choice_list in lists_qs:
            # Count items visible to tenant
            items_count = len(self.get_choices_for_field(choice_list.slug))
            
            results.append({
                'slug': choice_list.slug,
                'name': choice_list.name,
                'description': choice_list.description,
                'model_field_path': choice_list.model_field_path,
                'is_extensible': choice_list.is_extensible,
                'is_reorderable': choice_list.is_reorderable,
                'items_count': items_count,
            })
        
        return results
