"""
Tenant-specific product preferences.

While system.Product defines the master product catalog,
TenantProductPreference allows each tenant to:
- Track which products they use
- Override display names for their context
- Set tenant-specific pricing
- Mark preferred suppliers for a product
"""
import uuid
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models


class TenantProductPreference(models.Model):
    """
    Tenant-specific preferences and overrides for a system product.

    This model links tenants to the system product catalog, allowing each
    tenant to customize how they work with products without duplicating
    the core product data.

    Use cases:
    - Custom display names (tenant calls it "Premium Ribeye" instead of "Choice Ribeye")
    - Tenant-specific pricing
    - Preferred supplier associations
    - Product availability toggles
    - Custom sort order for product lists
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Core relationships
    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="product_preferences",
        help_text="The tenant this preference belongs to",
    )
    product = models.ForeignKey(
        "system.Product",
        on_delete=models.CASCADE,
        related_name="tenant_preferences",
        help_text="The system product this preference is for",
    )

    # Display customization
    display_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Tenant-specific display name (overrides product.name)",
    )
    internal_code = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Tenant's internal product code",
    )
    notes = models.TextField(
        blank=True,
        default="",
        help_text="Tenant-specific notes about this product",
    )

    # Pricing
    default_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0"))],
        help_text="Tenant's default selling price",
    )
    default_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0"))],
        help_text="Tenant's default purchase cost",
    )

    # Supplier preferences
    preferred_supplier = models.ForeignKey(
        "suppliers.Supplier",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="preferred_products",
        help_text="Tenant's preferred supplier for this product",
    )
    supplier_item_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Supplier's item number for this product",
    )

    # Availability and ordering
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this product is active for this tenant",
    )

    # Three-tier product strategy
    # Marks that the tenant created/owns this product (product.is_system=False).
    is_custom = models.BooleanField(
        default=False,
        help_text="Whether this preference row represents a tenant-owned custom product",
    )
    is_favorite = models.BooleanField(
        default=False,
        help_text="Quick-access favorite product",
    )
    sort_order = models.PositiveIntegerField(
        default=0,
        help_text="Sort order in product lists (lower = first)",
    )

    # Audit fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tenant_product_preference"
        verbose_name = "Tenant Product Preference"
        verbose_name_plural = "Tenant Product Preferences"
        constraints = [
            models.UniqueConstraint(fields=["tenant", "product"], name="unique_tenant_product"),
        ]
        indexes = [
            models.Index(fields=["tenant", "is_active", "sort_order"]),
            models.Index(fields=["tenant", "is_favorite"]),
            models.Index(fields=["tenant", "preferred_supplier"]),
        ]
        ordering = ["sort_order", "product__name"]

    def __str__(self):
        name = self.display_name or self.product.name
        return f"{self.tenant.name}: {name}"

    @property
    def effective_name(self):
        """Return display_name if set, otherwise product.name."""
        return self.display_name or self.product.name

    @property
    def effective_code(self):
        """Return internal_code if set, otherwise product.product_code."""
        return self.internal_code or self.product.product_code

    def get_price_for_customer(self, customer=None):
        """
        Get the effective price for a customer.

        Future enhancement: check customer-specific pricing first.
        For now, returns default_price.
        """
        # Note: Customer-specific pricing planned for Wave F (Features)
        # Task F1.4: Customer segmentation
        return self.default_price
