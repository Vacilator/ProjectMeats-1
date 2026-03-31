"""
Sales Orders models for ProjectMeats.

Defines sales order entities and related business logic.

Implements tenant ForeignKey field for shared-schema multi-tenancy.
Uses OrderMethodsMixin for shared order behavior (payment calculations, status checks).
"""
from django.db import models
from apps.tenants.models import Tenant
from apps.core.models import (
    CarrierReleaseFormatChoices,
    SoftDeleteModel,
    TenantAwareModel,
    WeightUnitChoices,
)
from tenant_apps.orders.models import OrderMethodsMixin, PaymentStatus, BaseOrderStatus


class SalesOrderStatus(models.TextChoices):
    """Status choices for sales orders."""

    PENDING = "pending", "Pending"
    CONFIRMED = "confirmed", "Confirmed"
    IN_TRANSIT = "in_transit", "In Transit"
    DELIVERED = "delivered", "Delivered"
    CANCELLED = "cancelled", "Cancelled"


# Note: PaymentStatus is now imported from orders.models for consistency
# Local definition kept for backward compatibility reference:
# class PaymentStatus(models.TextChoices):
#     UNPAID = "unpaid", "Unpaid"
#     PARTIAL = "partial", "Partial"
#     PAID = "paid", "Paid"


class SalesOrder(OrderMethodsMixin, SoftDeleteModel, TenantAwareModel):
    """
    Sales Order model for managing customer sales orders.
    
    Inherits from OrderMethodsMixin for shared order behavior:
    - is_paid, is_complete, has_outstanding_balance properties
    - calculate_outstanding(), update_payment_status() methods
    """
    
    # Order identification
    our_sales_order_num = models.CharField(
        max_length=100,
        help_text="Our sales order number (unique per tenant)",
    )
    date_time_stamp = models.DateTimeField(
        auto_now_add=True,
        help_text="Date and time when SO was created",
    )
    
    # Related entities
    supplier = models.ForeignKey(
        "suppliers.Supplier",
        on_delete=models.CASCADE,
        help_text="Supplier for this sales order (required to complete sourcing chain)",
    )
    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.CASCADE,
        help_text="Customer for this sales order",
    )
    carrier = models.ForeignKey(
        "carriers.Carrier",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Carrier for this sales order",
    )
    product = models.ForeignKey(
        "system.Product",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Product being sold",
    )
    plant = models.ForeignKey(
        "locations.Location",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="plant_sales_orders",
        help_text="Plant/facility for this order (location with plant_* type)",
    )
    pick_up_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pickup_sales_orders",
        help_text="Pick up location for this sales order",
    )
    delivery_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="delivery_sales_orders",
        help_text="Delivery location for this sales order",
    )
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Primary contact for this order",
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
    
    # Order details
    delivery_po_num = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Delivery PO number",
    )
    carrier_release_num = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Carrier release number",
    )
    carrier_release_format = models.CharField(
        max_length=100,
        choices=CarrierReleaseFormatChoices.choices,
        blank=True,
        default='',
        help_text="Carrier release format",
    )
    plant_est_number = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Plant establishment number",
    )
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
    
    # Status and pricing
    status = models.CharField(
        max_length=20,
        choices=SalesOrderStatus.choices,
        default=SalesOrderStatus.PENDING,
        help_text="Current status of the sales order",
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
        help_text="Payment status of the sales order",
    )
    outstanding_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Outstanding amount (calculated: total - paid)",
    )
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Total order amount",
    )
    notes = models.TextField(
        blank=True,
        default='',
        help_text="Additional notes",
    )
    class Meta:
        ordering = ["-date_time_stamp", "-created_on"]
        verbose_name = "Sales Order"
        verbose_name_plural = "Sales Orders"
        indexes = [
            models.Index(fields=['tenant', 'our_sales_order_num']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'our_sales_order_num'],
                name='unique_tenant_sales_order_num'
            ),
        ]

    def __str__(self):
        return f"SO-{self.our_sales_order_num}"

