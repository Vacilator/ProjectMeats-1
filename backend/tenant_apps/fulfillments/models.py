"""
Fulfillment models for ProjectMeats.

Tracks fulfillment of inquiries with support for partial shipments
and multiple tracking numbers.

Implements tenant ForeignKey field for shared-schema multi-tenancy.
"""
from decimal import Decimal
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.utils import timezone

from apps.core.models import SoftDeleteModel, TenantAwareModel


class FulfillmentStatusChoices(models.TextChoices):
    """Status progression for fulfillments."""
    PENDING = "pending", "Pending"
    IN_PROGRESS = "in_progress", "In Progress"
    SHIPPED = "shipped", "Shipped"
    DELIVERED = "delivered", "Delivered"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class FulfillmentShippingTypeChoices(models.TextChoices):
    """Shipping type for fulfillment (defaults from inquiry)."""
    TENANT = "tenant", "Tenant"
    CUSTOMER_PICKUP = "customer_pickup", "Customer Pick-Up"
    SUPPLIER_DELIVERING = "supplier_delivering", "Supplier Delivering"


class Fulfillment(SoftDeleteModel, TenantAwareModel):
    """
    Fulfillment model for tracking shipments from inquiries.
    
    Supports partial fulfillment - one inquiry can have multiple
    fulfillments, and each fulfillment can have different quantities.
    """
    
    # Auto-generated unique number per tenant
    fulfillment_number = models.CharField(
        max_length=20,
        editable=False,
        help_text="Auto-generated fulfillment number (FUL-YYYY-NNNNN)"
    )
    
    # Link to source inquiry
    inquiry = models.ForeignKey(
        'inquiries.Inquiry',
        on_delete=models.CASCADE,
        related_name='fulfillments',
        help_text="Source inquiry being fulfilled"
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=FulfillmentStatusChoices.choices,
        default=FulfillmentStatusChoices.PENDING,
        db_index=True,
        help_text="Current status of the fulfillment"
    )
    
    # Entity links
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fulfillments',
        help_text="Supplier fulfilling the order"
    )
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fulfillments',
        help_text="Customer receiving the order"
    )
    carrier = models.ForeignKey(
        'carriers.Carrier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fulfillments',
        help_text="Shipment carrier"
    )

    shipping_type = models.CharField(
        max_length=32,
        choices=FulfillmentShippingTypeChoices.choices,
        default=FulfillmentShippingTypeChoices.TENANT,
        db_index=True,
        help_text="Shipping type (cascaded from inquiry)",
    )
    
    # Logistics and dates
    ship_date = models.DateField(
        null=True,
        blank=True,
        help_text="When the shipment was sent"
    )
    expected_delivery = models.DateField(
        null=True,
        blank=True,
        help_text="Expected delivery date"
    )
    actual_delivery = models.DateField(
        null=True,
        blank=True,
        help_text="Actual delivery date"
    )
    
    # Multiple tracking numbers support (for multi-box shipments)
    tracking_numbers = ArrayField(
        models.CharField(max_length=100),
        blank=True,
        default=list,
        help_text="Tracking numbers for this shipment"
    )

    freight_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Freight or carrier cost attributed to this load",
    )
    document_milestones = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Document milestone flags such as proforma_requested, proforma_received, "
            "bol_requested, bol_received, coa_received, and coa_sent."
        ),
    )
    
    # Notes
    notes = models.TextField(
        blank=True,
        default='',
        help_text="Fulfillment notes"
    )
    
    # User tracking
    created_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_fulfillments',
        help_text="User who created this fulfillment"
    )
    shipped_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shipped_fulfillments',
        help_text="User who marked as shipped"
    )

    class Meta:
        verbose_name = "Fulfillment"
        verbose_name_plural = "Fulfillments"
        ordering = ['-created_on']
        indexes = [
            models.Index(fields=['tenant', 'fulfillment_number']),
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['inquiry']),
        ]

    def __str__(self):
        return f"{self.fulfillment_number} ({self.inquiry.inquiry_number})"

    def save(self, *args, **kwargs):
        """Auto-generate fulfillment number on first save."""
        if not self.fulfillment_number:
            self.fulfillment_number = self._generate_fulfillment_number()
        super().save(*args, **kwargs)

    def _generate_fulfillment_number(self):
        """Generate unique fulfillment number: FUL-YYYY-NNNNN."""
        year = timezone.now().year
        prefix = f"FUL-{year}-"
        
        # Get the last fulfillment number for this tenant and year
        last_fulfillment = Fulfillment.objects.filter(
            tenant=self.tenant,
            fulfillment_number__startswith=prefix
        ).order_by('-fulfillment_number').first()
        
        if last_fulfillment:
            try:
                last_num = int(last_fulfillment.fulfillment_number.split('-')[-1])
                next_num = last_num + 1
            except (ValueError, IndexError):
                next_num = 1
        else:
            next_num = 1
        
        return f"{prefix}{next_num:05d}"

    @property
    def total_value(self):
        """Calculate total value of fulfilled products."""
        return self.products.aggregate(
            total=models.Sum('total')
        )['total'] or Decimal('0.00')

    @property
    def is_partial(self):
        """Check if this is a partial fulfillment."""
        for fp in self.products.all():
            if fp.inquiry_product:
                if fp.quantity_fulfilled < fp.inquiry_product.quantity:
                    return True
        return False


class FulfillmentProduct(TenantAwareModel):
    """
    Through table for Fulfillment products with quantity tracking.

    This is tenant-aware (shared schema): we persist tenant_id directly for
    consistent RLS enforcement, even though the parent Fulfillment is already tenant-aware.
    """

    # NOTE: temporarily nullable for data backfill migration.
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        db_index=True,
        related_name='fulfillment_products',
    )

    fulfillment = models.ForeignKey(
        Fulfillment,
        on_delete=models.CASCADE,
        related_name='products'
    )
    inquiry_product = models.ForeignKey(
        'inquiries.InquiryProduct',
        on_delete=models.CASCADE,
        related_name='fulfillment_lines',
        help_text="Link to the inquiry product being fulfilled"
    )
    
    # Quantity being fulfilled in this shipment
    quantity_fulfilled = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Quantity being fulfilled in this shipment"
    )
    
    # Pricing for this fulfillment
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Price per unit for this fulfillment"
    )
    total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Line total for this fulfillment"
    )
    
    # Metadata
    notes = models.TextField(
        blank=True,
        default='',
        help_text="Line item notes"
    )
    created_on = models.DateTimeField(auto_now_add=True)
    modified_on = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Fulfillment Product"
        verbose_name_plural = "Fulfillment Products"
        ordering = ['id']

    def __str__(self):
        product = self.inquiry_product.product if self.inquiry_product else None
        product_name = (
            getattr(product, 'name', '').strip()
            or getattr(product, 'product_code', '').strip()
            or 'Product'
        )[:30]
        return f"{self.fulfillment.fulfillment_number} - {product_name}"

    @property
    def parent_tenant(self):
        """Tenant derived from the parent Fulfillment (for legacy call sites)."""
        return self.fulfillment.tenant

    @property
    def product(self):
        """Shortcut to the actual product."""
        return self.inquiry_product.product

    def save(self, *args, **kwargs):
        """Auto-calculate total if unit_price is set."""
        if getattr(self, 'tenant_id', None) is None and self.fulfillment_id is not None:
            self.tenant = self.fulfillment.tenant

        if self.unit_price and self.quantity_fulfilled and not self.total:
            self.total = self.unit_price * self.quantity_fulfilled
        super().save(*args, **kwargs)
