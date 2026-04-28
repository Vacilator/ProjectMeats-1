"""
Locations models for ProjectMeats.

Defines location entities for suppliers and customers.
Also includes plant/facility locations (merged from plants app).

Implements tenant ForeignKey field for shared-schema multi-tenancy.
Row-level security (RLS) enabled for additional isolation at PostgreSQL level.
"""
from django.db import models
from django.contrib.auth.models import User

from apps.core.models import (
    PhoneTypeChoices,
    SoftDeleteModel,
    TenantAwareModel,
)


class LocationTypeChoices(models.TextChoices):
    """Location type choices including plant types."""
    # General location types
    WAREHOUSE = 'warehouse', 'Warehouse'
    STORE = 'store', 'Store'
    DISTRIBUTION_CENTER = 'distribution_center', 'Distribution Center'
    OFFICE = 'office', 'Office'
    # Plant types (merged from plants app)
    PLANT_PROCESSING = 'plant_processing', 'Processing Plant'
    PLANT_DISTRIBUTION = 'plant_distribution', 'Plant Distribution Center'
    PLANT_WAREHOUSE = 'plant_warehouse', 'Plant Warehouse'
    PLANT_RETAIL = 'plant_retail', 'Retail Location'
    PLANT_VERTICAL = 'plant_vertical', 'Vertical (Kill to Capture)'
    PLANT_OTHER = 'plant_other', 'Other Plant'
    # Legacy/generic
    OTHER = 'other', 'Other'


class Location(SoftDeleteModel, TenantAwareModel):
    """
    Unified Location model for supplier/customer addresses and plant facilities.
    
    This model consolidates the former Plant model with locations, using
    location_type to distinguish between general locations and plant facilities.
    
    Inherits from TenantAwareModel: Provides tenant FK, custom_data JSONB, TenantManager
    """

    # Basic information
    name = models.CharField(
        max_length=255,
        help_text="Location name or identifier"
    )
    code = models.CharField(
        max_length=50,
        blank=True,
        default='',
        db_index=True,
        help_text="Location code or identifier (unique for plants)"
    )
    location_type = models.CharField(
        max_length=50,
        choices=LocationTypeChoices.choices,
        default=LocationTypeChoices.OTHER,
        help_text="Type of location"
    )
    address = models.TextField(
        blank=True,
        default='',
        help_text="Full street address"
    )
    city = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="City"
    )
    state = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="State or province"
    )
    zip_code = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text="ZIP or postal code"
    )
    country = models.CharField(
        max_length=100,
        blank=True,
        default='USA',
        help_text="Country"
    )

    # Contact information
    phone = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text="Location phone number"
    )
    phone_type = models.CharField(
        max_length=10,
        choices=PhoneTypeChoices.choices,
        blank=True,
        default=PhoneTypeChoices.OFFICE,
        help_text="Location phone type (mobile or office)",
    )
    email = models.EmailField(
        blank=True,
        default='',
        help_text="Location email address"
    )
    contact_name = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Contact person name"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this location is active"
    )

    # Relationships to Supplier and Customer
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='supplier_locations',
        help_text="Associated supplier"
    )
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_locations',
        help_text="Associated customer"
    )

    # Known products (Three-Tier Product Strategy)
    # Tenant-safe affinity stored via through model (TenantAwareModel + RLS)
    associated_products = models.ManyToManyField(
        'system.Product',
        through='LocationAssociatedProduct',
        related_name='purchased_by_locations',
        blank=True,
        verbose_name='Known Products Purchased',
        help_text='Products commonly purchased/handled at this location',
    )

    # Known products (new: tenant-scoped MasterProduct)
    associated_master_products = models.ManyToManyField(
        'products.MasterProduct',
        through='LocationAssociatedMasterProduct',
        related_name='known_by_locations',
        blank=True,
        verbose_name='Known Master Products',
        help_text='Master products commonly purchased/handled at this location',
    )

    # =========================================================================
    # Plant-specific fields (from merged plants app)
    # These fields are only used when location_type starts with 'plant_'
    # =========================================================================
    plant_est_num = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Plant establishment number (USDA/FDA)",
    )
    manager = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Plant manager name"
    )
    capacity = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Capacity in units (for plants)"
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_locations',
        help_text="User who created this location"
    )
    
    # Legacy plant ID for migration tracking
    legacy_plant_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Original Plant ID before migration (for reference)"
    )

    class Meta:
        ordering = ['name']
        verbose_name = 'Location'
        verbose_name_plural = 'Locations'
        indexes = [
            models.Index(fields=['tenant', 'name']),
            models.Index(fields=['tenant', 'supplier']),
            models.Index(fields=['tenant', 'customer']),
            models.Index(fields=['tenant', 'location_type']),
            models.Index(fields=['tenant', 'code']),
        ]
        constraints = [
            # Plant codes should be unique within a tenant
            models.UniqueConstraint(
                fields=['tenant', 'code'],
                condition=models.Q(code__gt='', is_deleted=False),
                name='unique_location_code_per_tenant'
            ),
        ]

    def __str__(self):
        if self.code:
            return f"{self.code} - {self.name}"
        return f"{self.name} ({self.city or 'No city'})"

    @property
    def is_plant(self) -> bool:
        """Check if this location is a plant/facility."""
        return self.location_type.startswith('plant_')

    @classmethod
    def get_plant_type_choices(cls):
        """Get only plant-related location types."""
        return [
            (choice.value, choice.label)
            for choice in LocationTypeChoices
            if choice.value.startswith('plant_')
        ]


class LocationAssociatedProduct(TenantAwareModel):
    """Tenant-safe link table for Location ↔ system.Product affinity."""

    location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name='associated_product_links',
    )
    product = models.ForeignKey(
        'system.Product',
        on_delete=models.CASCADE,
        related_name='location_affinity_links',
    )

    class Meta:
        verbose_name = 'Location Known Product'
        verbose_name_plural = 'Location Known Products'
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'location', 'product'],
                name='unique_location_product_affinity_per_tenant',
            )
        ]
        indexes = [
            models.Index(fields=['tenant', 'location']),
            models.Index(fields=['tenant', 'product']),
        ]


class LocationAssociatedMasterProduct(TenantAwareModel):
    """Tenant-safe link table for Location ↔ products.MasterProduct affinity."""

    location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name='associated_master_product_links',
    )
    master_product = models.ForeignKey(
        'products.MasterProduct',
        on_delete=models.CASCADE,
        related_name='location_affinity_links',
    )

    class Meta:
        verbose_name = 'Location Known Master Product'
        verbose_name_plural = 'Location Known Master Products'
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'location', 'master_product'],
                name='unique_location_master_product_affinity_per_tenant',
            )
        ]
        indexes = [
            models.Index(fields=['tenant', 'location']),
            models.Index(fields=['tenant', 'master_product']),
        ]
