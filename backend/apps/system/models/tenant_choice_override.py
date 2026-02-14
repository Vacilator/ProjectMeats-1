"""
Tenant Choice Override model.

Allows tenants to:
1. Add custom items to system choice lists (via SystemChoiceItem with tenant FK)
2. Disable specific system items per tenant
3. Reorder items within their view of the list

This provides granular control beyond just adding items.
"""
import uuid
from django.db import models
from django.contrib.postgres.fields import ArrayField


class TenantChoiceOverride(models.Model):
    """
    Tenant-specific overrides for system choice lists.
    
    Allows tenants to:
    - Disable specific system-defined items (hide them from dropdowns)
    - Store custom ordering preferences
    - Add metadata about why items are disabled
    
    Custom items are handled via SystemChoiceItem.tenant FK.
    This model handles visibility and display preferences.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='choice_overrides',
        help_text="Tenant applying these overrides"
    )
    
    choice_list = models.ForeignKey(
        'system.SystemChoiceList',
        on_delete=models.CASCADE,
        related_name='tenant_overrides',
        help_text="The choice list being customized"
    )
    
    # Disabled system items (array of SystemChoiceItem IDs)
    disabled_system_items = ArrayField(
        models.UUIDField(),
        default=list,
        blank=True,
        help_text="IDs of system items to hide from this tenant"
    )
    
    # Custom display configuration
    display_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Custom display preferences (e.g., custom ordering, grouping)"
    )
    
    # Notes about customization
    notes = models.TextField(
        blank=True,
        help_text="Internal notes about why customizations were made"
    )
    
    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="User who last modified these overrides"
    )
    
    class Meta:
        db_table = 'tenant_choice_override'
        ordering = ['tenant', 'choice_list']
        verbose_name = 'Tenant Choice Override'
        verbose_name_plural = 'Tenant Choice Overrides'
        constraints = [
            # One override per tenant per list
            models.UniqueConstraint(
                fields=['tenant', 'choice_list'],
                name='unique_tenant_choice_override'
            ),
        ]
        indexes = [
            models.Index(fields=['tenant', 'choice_list']),
        ]
    
    def __str__(self):
        return f"{self.tenant} overrides for {self.choice_list.slug}"
    
    def get_visible_system_items(self):
        """
        Get system items that are NOT disabled for this tenant.
        
        Returns:
            QuerySet of SystemChoiceItem objects that should be visible
        """
        from apps.system.models import SystemChoiceItem
        
        system_items = SystemChoiceItem.objects.filter(
            choice_list=self.choice_list,
            tenant__isnull=True,
            is_active=True
        )
        
        if self.disabled_system_items:
            system_items = system_items.exclude(id__in=self.disabled_system_items)
        
        return system_items
    
    def get_all_items_for_tenant(self):
        """
        Get all items (system + tenant custom) visible to this tenant.
        
        Returns:
            QuerySet of SystemChoiceItem objects (system + custom)
        """
        from apps.system.models import SystemChoiceItem
        from django.db.models import Q
        
        # System items (not disabled) + tenant's custom items
        query = Q(tenant=self.tenant)
        if self.disabled_system_items:
            query |= Q(tenant__isnull=True) & ~Q(id__in=self.disabled_system_items)
        else:
            query |= Q(tenant__isnull=True)
        
        items = SystemChoiceItem.objects.filter(
            choice_list=self.choice_list,
            is_active=True
        ).filter(query).order_by('order', 'label')
        
        return items
