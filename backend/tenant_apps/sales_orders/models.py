"""
Sales Orders models for ProjectMeats.

Defines sales order entities and related business logic.

Implements tenant ForeignKey field for shared-schema multi-tenancy.
Uses OrderMethodsMixin for shared order behavior (payment calculations, status checks).
"""
from django.conf import settings
from django.db import models

from tenant_apps.orders.models import OrderMethodsMixin, PaymentStatus

from apps.core.model_mixins import (
    BaseLineItem,
    BillingAddressSnapshotMixin,
    BillingContactSnapshotMixin,
    LogisticsMixin,
    ShippingAddressSnapshotMixin,
    ShippingContactSnapshotMixin,
    sync_alias_pair,
)
from apps.core.models import (
    EdibleInedibleChoices,
    FreshOrFrozenChoices,
    NetOrCatchChoices,
    PackageTypeChoices,
    ProteinTypeChoices,
    SoftDeleteModel,
    TenantAwareModel,
    WeightUnitChoices,
)


class SalesOrderStatus(models.TextChoices):
    """Status choices for sales orders."""

    DRAFT = "draft", "Draft"
    PENDING = "pending", "Pending"
    PENDING_APPROVAL = "pending_approval", "Pending Approval"
    APPROVED = "approved", "Approved"
    CONFIRMED = "confirmed", "Confirmed"
    SENT = "sent", "Sent"
    IN_TRANSIT = "in_transit", "In Transit"
    DELIVERED = "delivered", "Delivered"
    INVOICED = "invoiced", "Invoiced"
    CANCELLED = "cancelled", "Cancelled"


class SalesOrderLogisticsScenarioChoices(models.TextChoices):
    CUSTOMER_PICKUP = "customer_pickup", "Customer - Picking Up"
    SUPPLIER_DELIVERY = "supplier_delivery", "Supplier - Delivering"
    WE_PICKUP = "we_pickup", "Tenant - Pickup (We Handle Logistics)"


# Note: PaymentStatus is now imported from orders.models for consistency
# Local definition kept for backward compatibility reference:
# class PaymentStatus(models.TextChoices):
#     UNPAID = "unpaid", "Unpaid"
#     PARTIAL = "partial", "Partial"
#     PAID = "paid", "Paid"


class SalesOrder(
    BillingContactSnapshotMixin,
    BillingAddressSnapshotMixin,
    ShippingContactSnapshotMixin,
    ShippingAddressSnapshotMixin,
    LogisticsMixin,
    OrderMethodsMixin,
    SoftDeleteModel,
    TenantAwareModel,
):
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
    our_sales_order_number_for_customer = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Canonical sales order number shown to the customer.",
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

    # Order details
    logistics_scenario = models.CharField(
        max_length=50,
        choices=SalesOrderLogisticsScenarioChoices.choices,
        default=SalesOrderLogisticsScenarioChoices.SUPPLIER_DELIVERY,
        help_text="Logistics scenario for this sales order",
    )
    delivery_po_num = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Delivery PO number",
    )
    delivery_po_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Canonical delivery PO number.",
    )
    carrier_release_num = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Carrier release number",
    )
    plant_est_number = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Plant establishment number",
    )
    quantity = models.IntegerField(
        blank=True,
        null=True,
        help_text="Quantity of items",
    )
    type_of_protein = models.CharField(
        max_length=50,
        choices=ProteinTypeChoices.choices,
        blank=True,
        default="",
    )
    description_of_product_item = models.TextField(blank=True, default="")
    fresh_or_frozen = models.CharField(
        max_length=20,
        choices=FreshOrFrozenChoices.choices,
        blank=True,
        default="",
    )
    package_type = models.CharField(
        max_length=50,
        choices=PackageTypeChoices.choices,
        blank=True,
        default="",
    )
    uom = models.CharField(
        max_length=10,
        choices=WeightUnitChoices.choices,
        default=WeightUnitChoices.LBS,
    )
    net_or_catch = models.CharField(
        max_length=20,
        choices=NetOrCatchChoices.choices,
        blank=True,
        default="",
    )
    edible_or_inedible = models.CharField(
        max_length=50,
        choices=EdibleInedibleChoices.choices,
        blank=True,
        default="",
    )
    tested_product = models.BooleanField(default=False)
    total_net_weight = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
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
    receiving_contact_name = models.CharField(max_length=255, blank=True, default="")
    receiving_contact_phone = models.CharField(max_length=20, blank=True, default="")
    receiving_contact_email = models.EmailField(blank=True, default="")
    receiving_contact_title = models.CharField(max_length=100, blank=True, default="")
    notes = models.TextField(
        blank=True,
        default="",
        help_text="Additional notes",
    )
    trade_session = models.ForeignKey(
        "inquiries.TradeSession",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales_orders",
        help_text="Trade session lineage key (CTE-05.1).",
    )

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "our_sales_order_num"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["tenant", "our_sales_order_num"], name="unique_tenant_sales_order_num"),
        ]

    def __str__(self):
        return f"SO-{self.our_sales_order_num}"

    def save(self, *args, **kwargs):
        sync_alias_pair(self, "our_sales_order_number_for_customer", "our_sales_order_num")
        sync_alias_pair(self, "delivery_po_number", "delivery_po_num")
        super().save(*args, **kwargs)


class SalesOrderItem(BaseLineItem):
    """Tenant-aware sales order line item."""

    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.CASCADE,
        related_name="items",
    )
    line_number = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["sales_order_id", "line_number", "created_on"]
        indexes = [
            models.Index(fields=["tenant", "sales_order"]),
        ]

    def save(self, *args, **kwargs):
        if self.sales_order_id and not self.tenant_id:
            self.tenant = self.sales_order.tenant
        super().save(*args, **kwargs)


class SalesOrderApprovalDispatchStatus(models.TextChoices):
    """Status for the sales order approval dispatch lifecycle."""

    PENDING = "pending", "Pending"
    SENDING = "sending", "Sending"
    SENT = "sent", "Sent"
    FAILED = "failed", "Failed"


def sales_order_approval_dispatch_upload_to(instance, filename):
    return f"sales_orders/approval_dispatch/{instance.tenant_id}/{filename}"


class SalesOrderApprovalDispatch(TenantAwareModel):
    """Durable audit row for the one approved-PDF + customer-email dispatch per SO."""

    sales_order = models.OneToOneField(
        SalesOrder,
        on_delete=models.CASCADE,
        related_name="approval_dispatch",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales_order_approval_dispatches",
    )
    sender_provider = models.ForeignKey(
        "integrations.ExternalAuthProvider",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales_order_approval_dispatches",
    )
    approved_pdf = models.FileField(
        upload_to=sales_order_approval_dispatch_upload_to,
        blank=True,
        default="",
    )
    approved_pdf_checksum = models.CharField(max_length=64, blank=True, default="")
    approved_pdf_byte_size = models.PositiveBigIntegerField(default=0)
    pdf_generated_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    sender_email = models.EmailField(blank=True, default="")
    recipient_email = models.EmailField(blank=True, default="")
    recipient_name = models.CharField(max_length=255, blank=True, default="")
    subject = models.CharField(max_length=300, default="")
    body = models.TextField(default="")
    provider = models.CharField(max_length=32, default="microsoft")
    status = models.CharField(
        max_length=16,
        choices=SalesOrderApprovalDispatchStatus.choices,
        default=SalesOrderApprovalDispatchStatus.PENDING,
        db_index=True,
    )
    attempt_count = models.PositiveIntegerField(default=0)
    last_attempted_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    provider_message_id = models.CharField(max_length=255, blank=True, default="")
    provider_thread_id = models.CharField(max_length=255, blank=True, default="")
    provider_internet_message_id = models.CharField(max_length=255, blank=True, default="")
    error_message = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_on"]
        verbose_name = "Sales Order Approval Dispatch"
        verbose_name_plural = "Sales Order Approval Dispatches"
        indexes = [
            models.Index(fields=["tenant", "status"], name="so_dispatch_tenant_status_idx"),
            models.Index(fields=["tenant", "sent_at"], name="so_dispatch_tenant_sent_idx"),
        ]

    def __str__(self):
        reference = self.sales_order.our_sales_order_num if self.sales_order_id else "unbound"
        return f"SO Approval dispatch for {reference}"
