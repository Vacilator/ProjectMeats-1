"""
System Choice models for centralized dropdown/choice management.

Replaces scattered TextChoices classes (e.g., ProteinTypeChoices, PackageTypeChoices)
with a database-driven approach that supports:
- Runtime customization by tenant admins
- Audit trail of changes
- Consistent API for all dropdowns
"""
import uuid
from django.db import models
from django.core.validators import RegexValidator


slug_validator = RegexValidator(
    regex=r'^[a-z][a-z0-9_]*$',
    message='Slug must start with a letter and contain only lowercase letters, numbers, and underscores.'
)


class SystemChoiceList(models.Model):
    """
    A collection of choices for a specific field type (e.g., protein_type, package_type).
    
    These are system-wide definitions that can be:
    1. Defined by superusers (core choices)
    2. Overridden by system admins (system-wide defaults)
    3. Extended by tenant admins (tenant-specific additions)
    
    Examples:
    - protein_type: ["BEEF", "PORK", "POULTRY", "SEAFOOD", "LAMB"]
    - package_type: ["FRESH", "FROZEN", "VACUUM_SEALED"]
    - payment_terms: ["NET30", "NET60", "COD", "PREPAID"]
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    slug = models.SlugField(
        max_length=100,
        unique=True,
        validators=[slug_validator],
        help_text="Unique identifier (e.g., 'protein_type', 'payment_terms')"
    )
    name = models.CharField(
        max_length=255,
        help_text="Human-readable name (e.g., 'Protein Type', 'Payment Terms')"
    )
    description = models.TextField(
        blank=True,
        help_text="Optional description of what this choice list is used for"
    )
    
    # Where this choice list is used (for documentation and UI hints)
    model_field_path = models.CharField(
        max_length=255,
        blank=True,
        help_text="Dot-path to model field (e.g., 'products.Product.protein_type')"
    )
    
    # Behavioral flags
    is_extensible = models.BooleanField(
        default=True,
        help_text="Whether tenant admins can add custom items"
    )
    is_reorderable = models.BooleanField(
        default=True,
        help_text="Whether items can be reordered"
    )
    
    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_choice_lists'
    )
    
    class Meta:
        db_table = 'system_choice_list'
        ordering = ['slug']
        verbose_name = 'System Choice List'
        verbose_name_plural = 'System Choice Lists'
    
    def __str__(self):
        return f"{self.name} ({self.slug})"
    
    @property
    def items_count(self):
        """Return count of active items in this list."""
        return self.items.filter(is_active=True).count()


class SystemChoiceItem(models.Model):
    """
    An individual item within a SystemChoiceList.
    
    Items have a hierarchical ownership:
    - tenant=None: System-defined (cannot be deleted by tenants)
    - tenant=X: Tenant-specific addition (owned by that tenant)
    
    Examples for 'protein_type' list:
    - {"value": "BEEF", "label": "Beef", "order": 1, "tenant": None}
    - {"value": "WAGYU", "label": "Wagyu Beef", "order": 100, "tenant": tenant_123}
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    choice_list = models.ForeignKey(
        SystemChoiceList,
        on_delete=models.CASCADE,
        related_name='items',
        help_text="The choice list this item belongs to"
    )
    
    # Tenant ownership (null = system-defined)
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='custom_choice_items',
        help_text="Owning tenant (null for system-defined items)"
    )
    
    # Value (stored in database) and Label (displayed to users)
    value = models.CharField(
        max_length=100,
        help_text="Value stored in database (e.g., 'BEEF', 'NET30')"
    )
    label = models.CharField(
        max_length=255,
        help_text="Human-readable label (e.g., 'Beef', 'Net 30 Days')"
    )
    
    # Optional extra data for complex choices
    extra_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata (e.g., icon, color, description)"
    )
    
    # Ordering and visibility
    order = models.PositiveIntegerField(
        default=0,
        help_text="Sort order within the list (lower = first)"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this item is available for selection"
    )
    is_default = models.BooleanField(
        default=False,
        help_text="Whether this is the default selection"
    )
    
    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'system_choice_item'
        ordering = ['order', 'label']
        verbose_name = 'System Choice Item'
        verbose_name_plural = 'System Choice Items'
        constraints = [
            # Value must be unique within a list for system items
            models.UniqueConstraint(
                fields=['choice_list', 'value'],
                condition=models.Q(tenant__isnull=True),
                name='unique_system_choice_value'
            ),
            # Value must be unique within a list per tenant
            models.UniqueConstraint(
                fields=['choice_list', 'tenant', 'value'],
                condition=models.Q(tenant__isnull=False),
                name='unique_tenant_choice_value'
            ),
        ]
        indexes = [
            models.Index(fields=['choice_list', 'is_active', 'order']),
            models.Index(fields=['tenant', 'choice_list']),
        ]
    
    def __str__(self):
        scope = f"[Tenant: {self.tenant_id}]" if self.tenant_id else "[System]"
        return f"{self.label} ({self.value}) {scope}"
    
    @property
    def is_system_defined(self):
        """Return True if this is a system-defined (non-tenant) item."""
        return self.tenant_id is None
