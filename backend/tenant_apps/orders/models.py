"""
Abstract base order models for ProjectMeats.

Defines common fields and behavior shared across PurchaseOrder and SalesOrder.
Uses abstract inheritance to avoid database table changes while enabling
code reuse and future consolidation.

Part of Wave 6: Model Migration (Week 12-13: Orders Consolidation).
"""
from decimal import Decimal
from django.db import models
from apps.core.models import (
    CarrierReleaseFormatChoices,
    TenantAwareModel,
    WeightUnitChoices,
)


class OrderTypeChoices(models.TextChoices):
    """Type discriminator for unified order queries."""
    PURCHASE = "purchase", "Purchase Order"
    SALES = "sales", "Sales Order"
    CARRIER = "carrier", "Carrier Order"


class BaseOrderStatus(models.TextChoices):
    """Base status choices common to all order types."""
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"  # Used by PO
    CONFIRMED = "confirmed", "Confirmed"  # Used by SO
    IN_TRANSIT = "in_transit", "In Transit"  # Used by SO
    DELIVERED = "delivered", "Delivered"
    CANCELLED = "cancelled", "Cancelled"


class PaymentStatus(models.TextChoices):
    """Payment status choices for orders."""
    UNPAID = "unpaid", "Unpaid"
    PARTIAL = "partial", "Partial"
    PAID = "paid", "Paid"


class AbstractBaseOrder(TenantAwareModel):
    """
    Abstract base class for all order types.
    
    Contains fields common to both PurchaseOrder and SalesOrder:
    - Core order data (dates, status, amounts)
    - Carrier and logistics
    - Product details
    - Location references
    
    Subclasses add type-specific fields and relationships.
    """
    
    class Meta:
        abstract = True
    
    # ==========================================================================
    # Core Order Fields
    # ==========================================================================
    date_time_stamp = models.DateTimeField(
        auto_now_add=True,
        help_text="Date and time when order was created",
    )
    
    # Status and Payment
    status = models.CharField(
        max_length=20,
        choices=BaseOrderStatus.choices,
        default=BaseOrderStatus.PENDING,
        help_text="Current status of the order",
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
        help_text="Payment status of the order",
    )
    
    # Amounts
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Total order amount",
    )
    outstanding_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Outstanding amount (calculated: total - paid)",
    )
    
    # Dates
    pick_up_date = models.DateField(
        blank=True,
        null=True,
        help_text="Scheduled pick up date",
    )
    delivery_date = models.DateField(
        blank=True,
        null=True,
        help_text="Scheduled delivery date",
    )
    
    # Notes
    notes = models.TextField(
        blank=True,
        default="",
        help_text="Additional notes",
    )
    
    # ==========================================================================
    # Product Details
    # ==========================================================================
    quantity = models.IntegerField(
        blank=True,
        null=True,
        help_text="Quantity of items",
    )
    total_weight = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Total weight",
    )
    weight_unit = models.CharField(
        max_length=10,
        choices=WeightUnitChoices.choices,
        default=WeightUnitChoices.LBS,
        help_text="Unit of weight (LBS or KG)",
    )
    
    # ==========================================================================
    # Carrier & Logistics
    # ==========================================================================
    carrier_release_num = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Carrier release number",
    )
    carrier_release_format = models.CharField(
        max_length=100,
        choices=CarrierReleaseFormatChoices.choices,
        blank=True,
        default="",
        help_text="Carrier release format",
    )
    
    # ==========================================================================
    # Computed Properties
    # ==========================================================================
    
    @property
    def is_paid(self) -> bool:
        """Check if order is fully paid."""
        return self.payment_status == PaymentStatus.PAID
    
    @property
    def is_complete(self) -> bool:
        """Check if order is in terminal state (delivered or cancelled)."""
        return self.status in (BaseOrderStatus.DELIVERED, BaseOrderStatus.CANCELLED)
    
    @property
    def has_outstanding_balance(self) -> bool:
        """Check if there's an outstanding balance."""
        if self.outstanding_amount is None:
            return False
        return self.outstanding_amount > Decimal("0.00")
    
    # ==========================================================================
    # Common Methods
    # ==========================================================================
    
    def calculate_outstanding(self, paid_amount: Decimal) -> Decimal:
        """Calculate outstanding amount based on total and paid amounts."""
        if self.total_amount is None:
            return Decimal("0.00")
        outstanding = self.total_amount - paid_amount
        return max(outstanding, Decimal("0.00"))
    
    def update_payment_status(self, paid_amount: Decimal) -> None:
        """Update payment status based on paid amount."""
        if self.total_amount is None:
            return
        
        if paid_amount >= self.total_amount:
            self.payment_status = PaymentStatus.PAID
            self.outstanding_amount = Decimal("0.00")
        elif paid_amount > Decimal("0.00"):
            self.payment_status = PaymentStatus.PARTIAL
            self.outstanding_amount = self.calculate_outstanding(paid_amount)
        else:
            self.payment_status = PaymentStatus.UNPAID
            self.outstanding_amount = self.total_amount


class AbstractOrderWithRelations(AbstractBaseOrder):
    """
    Extended abstract base that includes common ForeignKey relationships.
    
    Separated from AbstractBaseOrder because subclasses may need different
    related_name configurations to avoid reverse accessor conflicts.
    
    Note: ForeignKey fields are defined as strings to avoid circular imports.
    Subclasses should define their own FK fields with appropriate related_names.
    """
    
    class Meta:
        abstract = True
    
    # Common relations that need different related_names per subclass
    # Subclasses define: supplier, carrier, product, plant, pick_up_location, delivery_location, contact


# =============================================================================
# Utility Functions
# =============================================================================

def get_order_type_label(order_type: str) -> str:
    """Get human-readable label for order type."""
    return OrderTypeChoices(order_type).label if order_type else "Unknown"


def get_all_order_statuses() -> list:
    """Get all possible order status values."""
    return list(BaseOrderStatus.values)
