"""
System-wide Product model.

Products are shared across all tenants - they represent the master product catalog.
Each product has a unique code and is not tenant-specific.

This replaces the tenant_apps/products model with a system-wide approach:
- Products are defined once, used by all tenants
- Product deduplication: 235 tenant copies → ~32 unique products
- FK references updated to point to system.Product
"""
import uuid
from django.db import models


class ProductCategoryChoices(models.TextChoices):
    """Top-level product category classification."""
    BEEF = 'BEEF', 'Beef'
    PORK = 'PORK', 'Pork'
    POULTRY = 'POULTRY', 'Poultry'
    SEAFOOD = 'SEAFOOD', 'Seafood'
    LAMB = 'LAMB', 'Lamb'
    VEAL = 'VEAL', 'Veal'
    GAME = 'GAME', 'Game'
    OTHER = 'OTHER', 'Other'


class Product(models.Model):
    """
    System-wide product definition.
    
    This is a non-tenant model - products are shared across all tenants.
    The master product list defines what products exist; tenants can
    reference these products in their orders, invoices, etc.
    
    Key differences from the old tenant_apps/products model:
    - No tenant ForeignKey (system-wide)
    - UUIDs for cleaner cross-system references
    - Legacy tenant_product_id for migration tracking
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Product identification
    product_code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique product code (e.g., 'BEEF-RIBEYE-001')",
    )
    name = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Short product name",
    )
    description = models.TextField(
        blank=True,
        help_text="Detailed description of the product",
    )
    
    # Classification (using database-driven choices via SystemChoiceList)
    category = models.CharField(
        max_length=50,
        choices=ProductCategoryChoices.choices,
        default=ProductCategoryChoices.OTHER,
        help_text="Primary product category",
    )
    protein_type = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Type of protein (references SystemChoiceList 'protein_type')",
    )
    
    # Physical properties
    fresh_or_frozen = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text="Product state: FRESH, FROZEN, or blank",
    )
    package_type = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Package type (references SystemChoiceList 'package_type')",
    )
    carton_type = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Type of carton (references SystemChoiceList 'carton_type')",
    )
    unit_weight = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Standard unit weight in default UOM",
    )
    uom = models.CharField(
        max_length=10,
        blank=True,
        default='LB',
        help_text="Unit of measure (LB, KG, etc.)",
    )
    pcs_per_carton = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Pieces per carton (e.g., '4/10')",
    )
    
    # Industry codes
    namp_code = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="NAMP (North American Meat Processors) code",
    )
    usda_code = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="USDA code",
    )
    ub_code = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="UB code",
    )
    
    # Product attributes
    edible_or_inedible = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Edible or inedible classification",
    )
    net_or_catch = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text="Weight type: NET or CATCH",
    )
    tested_product = models.BooleanField(
        default=False,
        help_text="Whether this product requires testing",
    )
    
    # Status
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this product is active and available",
    )
    
    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Migration tracking
    legacy_tenant_product_id = models.IntegerField(
        blank=True,
        null=True,
        db_index=True,
        help_text="Original ID from tenant_apps.products for migration tracking",
    )
    
    class Meta:
        db_table = 'system_product'
        ordering = ['product_code']
        verbose_name = 'Product'
        verbose_name_plural = 'Products'
        indexes = [
            models.Index(fields=['category', 'is_active']),
            models.Index(fields=['protein_type', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.product_code} - {self.name}"
    
    @property
    def display_name(self):
        """Return the best available display name."""
        return self.name or self.product_code
    
    @property
    def is_frozen(self):
        """Check if product is frozen."""
        return self.fresh_or_frozen.upper() == 'FROZEN'
    
    @property
    def is_fresh(self):
        """Check if product is fresh."""
        return self.fresh_or_frozen.upper() == 'FRESH'
