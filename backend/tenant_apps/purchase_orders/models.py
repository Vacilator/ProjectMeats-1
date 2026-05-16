"""
Purchase Orders models for ProjectMeats.

Defines purchase order entities and related business logic.

Implements tenant ForeignKey field for shared-schema multi-tenancy.
Uses OrderMethodsMixin for shared order behavior (payment calculations, status checks).
"""
import logging
import uuid
from decimal import Decimal

logger = logging.getLogger(__name__)

from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from tenant_apps.contacts.services import resolve_supplier_order_contact_routes
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
    AccountingPaymentTermsChoices,
    AppointmentMethodChoices,
    ChangeTypeChoices,
    CreditLimitChoices,
    EdibleInedibleChoices,
    FreshOrFrozenChoices,
    ItemProductionDateChoices,
    LoadStatusChoices,
    NetOrCatchChoices,
    PackageTypeChoices,
    ProteinTypeChoices,
    SoftDeleteModel,
    TenantAwareModel,
    TenantManager,
    TimestampModel,
    WeightUnitChoices,
)
from apps.tenants.models import Tenant


class PurchaseOrderStatus(models.TextChoices):
    """Status choices for purchase orders."""

    DRAFT = "draft", "Draft"
    PENDING = "pending", "Pending"
    PENDING_APPROVAL = "pending_approval", "Pending Approval"
    APPROVED = "approved", "Approved"
    SENT = "sent", "Sent"
    CARRIER_ASSIGNED = "carrier_assigned", "Carrier Assigned"
    IN_TRANSIT = "in_transit", "In Transit"
    DELIVERED = "delivered", "Delivered"
    INVOICED = "invoiced", "Invoiced"
    CANCELLED = "cancelled", "Cancelled"


class CarrierPurchaseOrderStatus(models.TextChoices):
    """Status choices for freight orders / carrier POs."""

    DRAFT = "draft", "Draft"
    PENDING_APPROVAL = "pending_approval", "Pending Approval"
    APPROVED = "approved", "Approved"
    DISPATCHED = "dispatched", "Dispatched"
    IN_TRANSIT = "in_transit", "In Transit"
    DELIVERED = "delivered", "Delivered"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


# Note: PaymentStatus is now imported from orders.models for consistency
# Local definition kept for backward compatibility reference:
# class PaymentStatus(models.TextChoices):
#     UNPAID = "unpaid", "Unpaid"
#     PARTIAL = "partial", "Partial"
#     PAID = "paid", "Paid"


class LogisticsScenarioChoices(models.TextChoices):
    """Type of pick up for purchase orders (business-friendly labels)."""

    CUSTOMER_PICKUP = "customer_pickup", "Customer - Picking Up"
    SUPPLIER_DELIVERY = "supplier_delivery", "Supplier - Delivering"
    WE_PICKUP = "we_pickup", "Tenant - Pickup (We Handle Logistics)"


class PurchaseOrderApprovalDispatchStatus(models.TextChoices):
    """Delivery lifecycle for the approved supplier PO artifact/send bundle."""

    PENDING = "pending", "Pending"
    SENDING = "sending", "Sending"
    SENT = "sent", "Sent"
    FAILED = "failed", "Failed"


def purchase_order_approval_dispatch_upload_to(instance, filename: str) -> str:
    """Keep approved supplier-PO PDFs tenant-scoped and collision-safe."""

    tenant_part = str(getattr(instance, "tenant_id", None) or "unknown-tenant")
    safe_name = str(filename or "approved-purchase-order.pdf").replace("\\", "/").rsplit("/", 1)[-1]
    return f"purchase_orders/approved_dispatches/{tenant_part}_{uuid.uuid4().hex}_{safe_name}"


class PurchaseOrder(
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
    Purchase Order model for managing purchase orders.

    Inherits from:
    - OrderMethodsMixin: Shared order behavior (is_paid, is_complete, etc.)
    - TenantAwareModel: Provides tenant FK, custom_data JSONB, TenantManager
    """

    order_number = models.CharField(max_length=50, help_text="Order number (unique per tenant)")
    supplier = models.ForeignKey(
        "suppliers.Supplier",
        on_delete=models.CASCADE,
        help_text="Supplier for this purchase order",
    )
    product = models.ForeignKey(
        "system.Product",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        help_text="Product being purchased",
    )
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        verbose_name="Total Amount ($)",
        help_text="Total order amount",
    )
    status = models.CharField(
        max_length=20,
        choices=PurchaseOrderStatus.choices,
        default=PurchaseOrderStatus.PENDING,
        help_text="Current status of the purchase order",
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
        help_text="Payment status of the purchase order",
    )
    outstanding_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Outstanding amount (calculated: total - paid)",
    )
    order_date = models.DateField(help_text="Date the order was placed")
    delivery_date = models.DateField(blank=True, null=True, help_text="Expected delivery date")
    notes = models.TextField(blank=True, null=True, help_text="Additional notes")

    # LOGISTICS SCENARIO TOGGLE (Controls Form Field Visibility)
    logistics_scenario = models.CharField(
        max_length=50,
        choices=LogisticsScenarioChoices.choices,
        default=LogisticsScenarioChoices.SUPPLIER_DELIVERY,
        help_text="Logistics scenario: Customer Pickup, Supplier Delivery, or We Pickup",
    )

    # Enhanced fields from Excel requirements (All 41 Fields)
    date_time_stamp = models.DateTimeField(
        auto_now_add=True,
        null=True,
        blank=True,
        help_text="Date and time when PO was created",
    )
    our_purchase_order_num = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Our internal purchase order number",
    )
    our_purchase_order_number_to_supplier = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Canonical purchase order number shown to the supplier.",
    )
    my_customer_number_from_supplier = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Our customer number from the supplier master profile.",
    )
    supplier_confirmation_order_num = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Supplier's confirmation order number",
    )
    supplier_confirmation_order_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Canonical supplier confirmation order number.",
    )

    # Supplier Auto-Populated Fields (from Supplier model on selection)
    supplier_corporate_address = models.TextField(
        blank=True, default="", help_text="Auto-populated from Supplier - Corporate address"
    )
    supplier_contact_name = models.CharField(
        max_length=255, blank=True, default="", help_text="Auto-populated from Supplier - Contact person name"
    )
    supplier_contact_phone = models.CharField(
        max_length=20, blank=True, default="", help_text="Auto-populated from Supplier - Contact phone"
    )
    supplier_contact_email = models.EmailField(
        blank=True, default="", help_text="Auto-populated from Supplier - Contact email"
    )

    # Carrier and Logistics Fields
    carrier = models.ForeignKey(
        "carriers.Carrier",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Carrier for this purchase order",
    )
    carrier_release_num = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Carrier release number",
    )
    how_carrier_make_appointment = models.CharField(
        max_length=50,
        choices=AppointmentMethodChoices.choices,
        blank=True,
        default="",
        help_text="How carrier makes appointments",
    )

    # Product Details
    quantity = models.IntegerField(
        blank=True,
        null=True,
        verbose_name="Quantity",
        help_text="Quantity of items",
    )
    total_weight = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name="Total Weight (LBS)",
        help_text="Total weight",
    )
    weight_unit = models.CharField(
        max_length=10,
        choices=WeightUnitChoices.choices,
        default=WeightUnitChoices.LBS,
        verbose_name="Weight Unit",
        help_text="Unit of weight (LBS or KG)",
    )
    price_per_unit = models.DecimalField(
        max_digits=10, decimal_places=2, blank=True, null=True, help_text="Price per unit/pound"
    )
    type_of_protein = models.CharField(
        max_length=50,
        choices=ProteinTypeChoices.choices,
        blank=True,
        default="",
        help_text="Type of protein (Beef, Pork, Chicken, etc.)",
    )
    fresh_or_frozen = models.CharField(
        max_length=20,
        choices=FreshOrFrozenChoices.choices,
        blank=True,
        default="",
        help_text="Product state (Fresh or Frozen)",
    )
    package_type = models.CharField(
        max_length=50,
        choices=PackageTypeChoices.choices,
        blank=True,
        default="",
        help_text="Package type (Combo, Box, Bag, etc.)",
    )
    net_or_catch = models.CharField(
        max_length=20, choices=NetOrCatchChoices.choices, blank=True, default="", help_text="Weight type (Net or Catch)"
    )
    edible_or_inedible = models.CharField(
        max_length=50,
        choices=EdibleInedibleChoices.choices,
        blank=True,
        default="",
        help_text="Edible or inedible product",
    )

    # Facility and Contact
    plant = models.ForeignKey(
        "locations.Location",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="plant_purchase_orders",
        help_text="Plant/facility for this order (location with plant_* type)",
    )
    pick_up_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pickup_purchase_orders",
        help_text="Pick up location for this order",
    )
    delivery_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="delivery_purchase_orders",
        help_text="Delivery location for this order",
    )
    contact = models.ForeignKey(
        "contacts.Contact",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Primary contact for this order",
    )

    # Payment Terms
    payment_terms = models.CharField(
        max_length=50,
        choices=AccountingPaymentTermsChoices.choices,
        blank=True,
        default="",
        help_text="Payment terms (Wire, ACH, Check, etc.)",
    )
    credit_limit = models.CharField(
        max_length=50, choices=CreditLimitChoices.choices, blank=True, default="", help_text="Credit limit/terms"
    )
    delivery_po_number = models.CharField(max_length=100, blank=True, default="")
    total_net_weight = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    tested_product = models.BooleanField(default=False)
    bill_of_lading_comments = models.TextField(blank=True, default="")
    invoicing_comments = models.TextField(blank=True, default="")
    item_production_date = models.CharField(
        max_length=50,
        choices=ItemProductionDateChoices.choices,
        blank=True,
        default="",
    )
    receiving_contact_name = models.CharField(max_length=255, blank=True, default="")
    receiving_contact_phone = models.CharField(max_length=20, blank=True, default="")
    receiving_contact_email = models.EmailField(blank=True, default="")
    receiving_contact_title = models.CharField(max_length=100, blank=True, default="")

    # Additional Metadata
    item_description = models.TextField(blank=True, default="", help_text="Detailed item description")
    special_instructions = models.TextField(blank=True, default="", help_text="Special instructions or notes")
    trade_session = models.ForeignKey(
        "inquiries.TradeSession",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_orders",
        help_text="Trade session lineage key (CTE-05.1).",
    )

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "order_number"]),
            models.Index(fields=["tenant", "order_date"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["tenant", "order_number"], name="unique_tenant_purchase_order_number"),
        ]

    def __str__(self):
        return f"PO-{self.order_number}"

    @classmethod
    def generate_next_order_number(cls, tenant: Tenant) -> str:
        """Generate the next Purchase Order number using format: 2YYNNN.

        - 2 = Purchase Order indicator
        - YY = 2-digit year
        - NNN = zero-padded increment (per-tenant, per-year)

        Example: 226040 => 2 + 26 + 040
        """
        from django.db import transaction
        from django.utils import timezone

        prefix = f"2{timezone.now().strftime('%y')}"

        with transaction.atomic():
            # Ensure we have a lock even if there are zero POs yet.
            try:
                Tenant.objects.select_for_update().filter(id=tenant.id).first()
            except Exception:
                logger.debug("Non-critical exception suppressed", exc_info=True)

            existing = (
                cls.objects.filter(tenant=tenant, order_number__startswith=prefix)
                .select_for_update()
                .values_list("order_number", flat=True)
            )

            max_seq = 0
            for val in existing:
                tail = str(val or "")[len(prefix) :]
                if tail.isdigit():
                    max_seq = max(max_seq, int(tail))

            return f"{prefix}{max_seq + 1:03d}"

    def save(self, *args, **kwargs):
        """Auto-generate order_number if missing.

        We keep this at the model layer so admin/scripts are consistent with the API.
        """
        from django.db import transaction

        with transaction.atomic():
            sync_alias_pair(self, "our_purchase_order_number_to_supplier", "our_purchase_order_num")
            sync_alias_pair(
                self,
                "supplier_confirmation_order_number",
                "supplier_confirmation_order_num",
            )
            if not self.order_number and self.tenant_id:
                self.order_number = PurchaseOrder.generate_next_order_number(self.tenant)

            super().save(*args, **kwargs)


class PurchaseOrderItem(BaseLineItem):
    """Tenant-aware purchase order line item."""

    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="items",
    )
    line_number = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["purchase_order_id", "line_number", "created_on"]
        indexes = [
            models.Index(fields=["tenant", "purchase_order"]),
        ]

    def save(self, *args, **kwargs):
        if self.purchase_order_id and not self.tenant_id:
            self.tenant = self.purchase_order.tenant
        super().save(*args, **kwargs)


class CarrierPurchaseOrder(
    BillingContactSnapshotMixin,
    BillingAddressSnapshotMixin,
    ShippingContactSnapshotMixin,
    ShippingAddressSnapshotMixin,
    LogisticsMixin,
    TenantAwareModel,
):
    """
    Carrier Purchase Order model for managing carrier-specific purchase orders.

    Inherits from TenantAwareModel: Provides tenant FK, custom_data JSONB, TenantManager
    """

    # Generated timestamp
    date_time_stamp_created = models.DateTimeField(
        auto_now_add=True,
        help_text="Date and time when carrier PO was created",
    )

    # Related entities
    carrier = models.ForeignKey(
        "carriers.Carrier",
        on_delete=models.CASCADE,
        help_text="Carrier for this purchase order",
    )
    supplier = models.ForeignKey(
        "suppliers.Supplier",
        on_delete=models.CASCADE,
        help_text="Supplier for this carrier purchase order",
    )
    plant = models.ForeignKey(
        "locations.Location",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="plant_carrier_purchase_orders",
        help_text="Plant/facility for this order (location with plant_* type)",
    )
    pick_up_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pickup_carrier_purchase_orders",
        help_text="Pick up location for this carrier order",
    )
    delivery_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="delivery_carrier_purchase_orders",
        help_text="Delivery location for this carrier order",
    )
    product = models.ForeignKey(
        "system.Product",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Product being ordered",
    )

    # CRITICAL: Logistics Bridge - Links CarrierPO to SupplierPO
    # This field answers "Who is hauling this meat?" directly from the Supplier PO
    linked_order = models.ForeignKey(
        "PurchaseOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="carrier_logistics",
        help_text="Link to the associated Supplier Purchase Order (SupplierPO). "
        "This creates the logistics bridge to track which carrier is hauling which supplier order.",
    )

    # Logistics Bridge - Links CarrierPO to SalesOrder for tracking via Sales Order Number
    sales_order = models.ForeignKey(
        "sales_orders.SalesOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="carrier_logistics",
        help_text="Link to the associated Sales Order for logistics tracking via Sales Order Number (spreadsheet #7).",
    )

    # Order details
    our_carrier_po_num = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Our carrier purchase order number",
    )
    status = models.CharField(
        max_length=32,
        choices=CarrierPurchaseOrderStatus.choices,
        default=CarrierPurchaseOrderStatus.DRAFT,
        help_text="Current freight order workflow status.",
    )
    carrier_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Carrier company name",
    )
    # Payment and credit information
    payment_terms = models.CharField(
        max_length=50,
        choices=AccountingPaymentTermsChoices.choices,
        blank=True,
        default="",
        help_text="Payment terms (e.g., Wire, ACH, Check)",
    )
    credit_limits = models.CharField(
        max_length=50,
        choices=CreditLimitChoices.choices,
        blank=True,
        default="",
        help_text="Credit limits/terms",
    )

    # Product details
    type_of_protein = models.CharField(
        max_length=50,
        choices=ProteinTypeChoices.choices,
        blank=True,
        default="",
        help_text="Type of protein",
    )
    fresh_or_frozen = models.CharField(
        max_length=20,
        choices=FreshOrFrozenChoices.choices,
        blank=True,
        default="",
        help_text="Product state (Fresh or Frozen)",
    )
    package_type = models.CharField(
        max_length=50,
        choices=PackageTypeChoices.choices,
        blank=True,
        default="",
        help_text="Package type",
    )
    net_or_catch = models.CharField(
        max_length=20,
        choices=NetOrCatchChoices.choices,
        blank=True,
        default="",
        help_text="Weight type (Net or Catch)",
    )
    edible_or_inedible = models.CharField(
        max_length=50,
        choices=EdibleInedibleChoices.choices,
        blank=True,
        default="",
        help_text="Edible or inedible product",
    )

    # Weight and quantity
    total_weight = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name="Total Weight (LBS)",
        help_text="Total weight",
    )
    weight_unit = models.CharField(
        max_length=10,
        choices=WeightUnitChoices.choices,
        default=WeightUnitChoices.LBS,
        verbose_name="Weight Unit",
        help_text="Unit of weight (LBS or KG)",
    )
    quantity = models.IntegerField(
        blank=True,
        null=True,
        verbose_name="Quantity",
        help_text="Quantity of items",
    )
    description_of_product_item = models.TextField(blank=True, default="")
    tested_product = models.BooleanField(default=False)
    total_net_weight = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)

    # Carrier appointment details
    how_carrier_make_appointment = models.CharField(
        max_length=50,
        choices=AppointmentMethodChoices.choices,
        blank=True,
        default="",
        help_text="How carrier makes appointments",
    )
    departments_of_carrier = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Departments (comma-separated: BOL, COA, POD, etc.)",
    )
    our_purchase_order_number_to_supplier = models.CharField(max_length=100, blank=True, default="")
    supplier_confirmation_order_number = models.CharField(max_length=100, blank=True, default="")
    delivery_po_number = models.CharField(max_length=100, blank=True, default="")
    receiving_contact_name = models.CharField(max_length=255, blank=True, default="")
    receiving_contact_phone = models.CharField(max_length=20, blank=True, default="")
    receiving_contact_email = models.EmailField(blank=True, default="")
    receiving_contact_title = models.CharField(max_length=100, blank=True, default="")
    trade_session = models.ForeignKey(
        "inquiries.TradeSession",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="carrier_purchase_orders",
        help_text="Trade session lineage key (CTE-05.1).",
    )

    class Meta:
        indexes = [
            models.Index(fields=["tenant", "our_carrier_po_num"]),
        ]

    def __str__(self):
        return f"Carrier PO-{self.our_carrier_po_num or self.id}"


class CarrierPOItem(BaseLineItem):
    """Tenant-aware carrier PO line item."""

    carrier_purchase_order = models.ForeignKey(
        CarrierPurchaseOrder,
        on_delete=models.CASCADE,
        related_name="items",
    )
    line_number = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["carrier_purchase_order_id", "line_number", "created_on"]
        indexes = [
            models.Index(fields=["tenant", "carrier_purchase_order"]),
        ]

    def save(self, *args, **kwargs):
        if self.carrier_purchase_order_id and not self.tenant_id:
            self.tenant = self.carrier_purchase_order.tenant
        super().save(*args, **kwargs)


class ColdStorageEntry(TenantAwareModel):
    """
    Cold Storage Entry model for tracking boxing and cold storage operations.

    Inherits from TenantAwareModel: Provides tenant FK, custom_data JSONB, TenantManager
    """

    # Generated timestamp
    date_time_stamp_created = models.DateTimeField(
        auto_now_add=True,
        help_text="Date and time when entry was created",
    )

    # Related entities
    supplier_po = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cold_storage_entries",
        help_text="Related supplier purchase order",
    )
    customer_sales_order = models.ForeignKey(
        "sales_orders.SalesOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cold_storage_entries",
        help_text="Related customer sales order",
    )
    product = models.ForeignKey(
        "system.Product",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Product being stored",
    )

    # Status and dates
    status_of_load = models.CharField(
        max_length=50,
        choices=LoadStatusChoices.choices,
        blank=True,
        default="",
        help_text="Load matching status",
    )
    item_production_date = models.DateField(
        blank=True,
        null=True,
        help_text="Item production date",
    )

    # Product details
    item_description = models.TextField(
        blank=True,
        default="",
        help_text="Description of item (e.g., 50% Beef Trim fresh - Tested)",
    )

    # Boxing fields (conditional based on status)
    finished_weight = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Finished weight after boxing",
    )
    shrink = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Shrink amount",
    )
    boxing_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Cost of boxing",
    )

    # Cold storage costs
    cold_storage_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Cost of cold storage",
    )
    total_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Total cost (boxing + cold storage)",
    )

    notes = models.TextField(
        blank=True,
        default="",
        help_text="Additional notes",
    )

    class Meta:
        ordering = ["-date_time_stamp_created", "-created_on"]
        verbose_name = "Cold Storage Entry"
        verbose_name_plural = "Cold Storage Entries"
        indexes = [
            models.Index(fields=["tenant", "date_time_stamp_created"]),
        ]

    def __str__(self):
        return f"Cold Storage Entry-{self.id} ({self.status_of_load})"


class PurchaseOrderHistory(TimestampModel):
    """Version history for Purchase Order modifications."""

    # Use custom manager for multi-tenancy
    objects = TenantManager()

    # Multi-tenancy
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="purchase_order_histories",
        help_text="Tenant this history entry belongs to",
    )

    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="history",
        help_text="Purchase order this history entry belongs to",
    )
    changed_data = models.JSONField(
        help_text="JSON representation of changed fields and their values",
    )
    changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="User who made the change",
    )
    change_type = models.CharField(
        max_length=20,
        choices=ChangeTypeChoices.choices,
        default=ChangeTypeChoices.UPDATED,
        help_text="Type of change made",
    )

    class Meta:
        ordering = ["-created_on"]
        verbose_name = "Purchase Order History"
        verbose_name_plural = "Purchase Order Histories"
        indexes = [
            models.Index(fields=["purchase_order", "-created_on"]),
        ]

    def __str__(self):
        return f"History for {self.purchase_order.order_number} at {self.created_on}"


class PurchaseOrderApprovalDispatch(TenantAwareModel):
    """Durable audit row for the one approved-PDF + supplier-email dispatch per PO."""

    purchase_order = models.OneToOneField(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="approval_dispatch",
    )
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_order_approval_dispatches",
    )
    sender_provider = models.ForeignKey(
        "integrations.ExternalAuthProvider",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_order_approval_dispatches",
    )
    approved_pdf = models.FileField(
        upload_to=purchase_order_approval_dispatch_upload_to,
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
        choices=PurchaseOrderApprovalDispatchStatus.choices,
        default=PurchaseOrderApprovalDispatchStatus.PENDING,
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
        verbose_name = "Purchase Order Approval Dispatch"
        verbose_name_plural = "Purchase Order Approval Dispatches"
        indexes = [
            models.Index(fields=["tenant", "status"], name="po_dispatch_tenant_status_idx"),
            models.Index(fields=["tenant", "sent_at"], name="po_dispatch_tenant_sent_idx"),
        ]

    def __str__(self):
        reference = self.purchase_order.order_number if self.purchase_order_id else "unbound"
        return f"Approval dispatch for {reference}"


@receiver(pre_save, sender=PurchaseOrder)
def auto_populate_supplier_fields(sender, instance, **kwargs):
    """
    Signal handler to auto-populate supplier contact fields when a supplier is selected.

    This runs BEFORE saving the PurchaseOrder and populates:
    - supplier_corporate_address
    - supplier_contact_name
    - supplier_contact_phone
    - supplier_contact_email

    Only populates if supplier is set and fields are currently empty.
    """
    if instance.supplier:
        supplier = instance.supplier
        contact_routing = _resolve_purchase_order_contact_routing(instance)

        # Auto-populate only if fields are empty
        if not instance.supplier_corporate_address and supplier.address:
            instance.supplier_corporate_address = supplier.address

        _apply_contact_snapshot(instance, "supplier_contact", contact_routing.get("supplier_contact") or {})
        _apply_contact_snapshot(instance, "billing_contact", contact_routing.get("billing_contact") or {})
        _apply_contact_snapshot(instance, "shipping_contact", contact_routing.get("shipping_contact") or {})

        if not instance.supplier_contact_name and supplier.contact_person:
            instance.supplier_contact_name = supplier.contact_person

        if not instance.supplier_contact_phone and supplier.phone:
            instance.supplier_contact_phone = supplier.phone

        if not instance.supplier_contact_email and supplier.email:
            instance.supplier_contact_email = supplier.email

        if not instance.billing_contact_name and instance.supplier_contact_name:
            instance.billing_contact_name = instance.supplier_contact_name

        if not instance.billing_contact_phone and instance.supplier_contact_phone:
            instance.billing_contact_phone = instance.supplier_contact_phone

        if not instance.billing_contact_email and instance.supplier_contact_email:
            instance.billing_contact_email = instance.supplier_contact_email

        if not instance.billing_address_street:
            instance.billing_address_street = supplier.street_address or supplier.address or ""

        if not instance.billing_address_city and supplier.city:
            instance.billing_address_city = supplier.city

        if not instance.billing_address_state_zip and (supplier.state or supplier.zip_code):
            instance.billing_address_state_zip = " ".join(
                part for part in [supplier.state or "", supplier.zip_code or ""] if part
            )


def _resolve_purchase_order_contact_routing(instance: PurchaseOrder) -> dict[str, dict]:
    custom_data = dict(instance.custom_data or {})
    stored_routing = custom_data.get("contact_routing")
    contact_routing = dict(stored_routing) if isinstance(stored_routing, dict) else {}

    tenant = getattr(instance, "tenant", None)
    supplier = getattr(instance, "supplier", None)
    if not tenant or not supplier:
        return contact_routing

    resolved = resolve_supplier_order_contact_routes(
        tenant=tenant,
        supplier=supplier,
    )
    for role, resolution in resolved.items():
        contact_routing[role] = _merge_contact_routing_payload(
            existing=contact_routing.get(role),
            generated=resolution.as_dict(),
        )

    custom_data["contact_routing"] = contact_routing
    instance.custom_data = custom_data
    return contact_routing


def _merge_contact_routing_payload(*, existing, generated: dict[str, object]) -> dict[str, object]:
    next_payload = dict(existing) if isinstance(existing, dict) else {}
    for key, value in generated.items():
        if next_payload.get(key) in (None, "", [], {}):
            next_payload[key] = value
    return next_payload


def _apply_contact_snapshot(instance: PurchaseOrder, prefix: str, payload: dict[str, object]) -> None:
    name_key = f"{prefix}_name"
    phone_key = f"{prefix}_phone"
    email_key = f"{prefix}_email"
    title_key = f"{prefix}_title"

    if hasattr(instance, name_key) and not getattr(instance, name_key):
        setattr(instance, name_key, str(payload.get("recipient_name") or ""))
    if hasattr(instance, phone_key) and not getattr(instance, phone_key):
        setattr(instance, phone_key, str(payload.get("phone") or ""))
    if hasattr(instance, email_key) and not getattr(instance, email_key):
        setattr(instance, email_key, str(payload.get("recipient_email") or ""))
    if hasattr(instance, title_key) and not getattr(instance, title_key):
        setattr(instance, title_key, str(payload.get("title") or ""))


@receiver(post_save, sender=PurchaseOrder)
def create_purchase_order_history(sender, instance, created, **kwargs):
    """
    Signal handler to create history entry when a PurchaseOrder is saved.

    Args:
        sender: The model class (PurchaseOrder)
        instance: The actual instance being saved
        created: Boolean indicating if this is a new record
        **kwargs: Additional signal arguments including 'update_fields'
    """
    # Skip if this is during migration or fixture loading
    if kwargs.get("raw", False):
        return

    # Determine the user from kwargs if available
    user = kwargs.get("user", None)

    # Prepare change data
    changed_data = {}
    change_type = "created" if created else "updated"

    if created:
        # For new records, store all field values
        for field in instance._meta.fields:
            if field.name not in ["id", "created_on", "modified_on"]:
                value = getattr(instance, field.name)
                # Convert to JSON-serializable format
                if value is None:
                    changed_data[field.name] = None
                elif hasattr(value, "pk"):
                    # Foreign key - store the ID
                    changed_data[field.name] = str(value.pk)
                elif isinstance(value, Decimal):
                    changed_data[field.name] = str(value)
                elif hasattr(value, "isoformat"):
                    # Date/DateTime - store ISO format
                    changed_data[field.name] = value.isoformat()
                else:
                    changed_data[field.name] = str(value)
    else:
        # For updates, we need to track what changed
        # Since we don't have the old values in post_save, store current state
        update_fields = kwargs.get("update_fields", None)
        if update_fields:
            for field_name in update_fields:
                value = getattr(instance, field_name)
                if value is None:
                    changed_data[field_name] = None
                elif hasattr(value, "pk"):
                    changed_data[field_name] = str(value.pk)
                elif isinstance(value, Decimal):
                    changed_data[field_name] = str(value)
                elif hasattr(value, "isoformat"):
                    changed_data[field_name] = value.isoformat()
                else:
                    changed_data[field_name] = str(value)
        else:
            # If update_fields not specified, log that an update occurred
            changed_data["note"] = "Update occurred but specific fields not tracked"

    # Create history entry
    PurchaseOrderHistory.objects.create(
        purchase_order=instance,
        tenant=instance.tenant,  # Inherit tenant from parent PurchaseOrder
        changed_data=changed_data,
        changed_by=user,
        change_type=change_type,
    )
