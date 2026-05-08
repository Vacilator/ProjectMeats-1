"""Deal desk models."""
from __future__ import annotations

import uuid
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.utils import timezone

from apps.core.models import SoftDeleteModel, TenantAwareModel


class DealStatus(models.TextChoices):
    """Lifecycle states for a trader deal."""

    DRAFT = "draft", "Draft"
    ACTIVE = "active", "Active"
    IN_TRANSIT = "in_transit", "In Transit"
    DELIVERED = "delivered", "Delivered"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class DealActionItemStatus(models.TextChoices):
    """Status for deal reminder tasks."""

    OPEN = "open", "Open"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class DealActionItemPriority(models.TextChoices):
    """Priority for deal reminder tasks."""

    LOW = "low", "Low"
    NORMAL = "normal", "Normal"
    HIGH = "high", "High"
    URGENT = "urgent", "Urgent"


class Deal(SoftDeleteModel, TenantAwareModel):
    """Unified trader abstraction linking PO, SO, and fulfillment."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deal_number = models.CharField(max_length=32, editable=False)
    status = models.CharField(
        max_length=20,
        choices=DealStatus.choices,
        default=DealStatus.DRAFT,
        db_index=True,
    )
    purchase_order = models.OneToOneField(
        "purchase_orders.PurchaseOrder",
        on_delete=models.PROTECT,
        related_name="deal",
    )
    sales_order = models.OneToOneField(
        "sales_orders.SalesOrder",
        on_delete=models.PROTECT,
        related_name="deal",
    )
    fulfillment = models.OneToOneField(
        "fulfillments.Fulfillment",
        on_delete=models.PROTECT,
        related_name="deal",
        null=True,
        blank=True,
    )
    assigned_trader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="assigned_deals",
        null=True,
        blank=True,
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_on"]
        indexes = [
            models.Index(fields=["tenant", "deal_number"]),
            models.Index(fields=["tenant", "status"]),
            models.Index(fields=["assigned_trader"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "deal_number"],
                name="unique_tenant_deal_number",
            ),
        ]

    def __str__(self) -> str:
        return self.deal_number

    def save(self, *args, **kwargs):
        """Generate a tenant-scoped deal number on first save."""
        if self.pk or self.deal_number or not self.tenant_id:
            super().save(*args, **kwargs)
            return

        last_error: IntegrityError | None = None
        for _ in range(3):
            self.deal_number = self._generate_deal_number()
            try:
                with transaction.atomic():
                    super().save(*args, **kwargs)
                return
            except IntegrityError as exc:
                last_error = exc
                self.deal_number = ""

        if last_error is not None:
            raise last_error

    def _generate_deal_number(self) -> str:
        year = timezone.now().year
        prefix = f"DEAL-{year}-"
        last_deal = (
            Deal.objects.for_tenant(self.tenant).filter(deal_number__startswith=prefix).order_by("-deal_number").first()
        )

        next_number = 1
        if last_deal and last_deal.deal_number:
            try:
                next_number = int(last_deal.deal_number.split("-")[-1]) + 1
            except (IndexError, ValueError):
                next_number = 1

        return f"{prefix}{next_number:05d}"

    @property
    def gross_revenue(self) -> Decimal:
        return self.sales_order.total_amount or Decimal("0.00")

    @property
    def cogs(self) -> Decimal:
        return self.purchase_order.total_amount or Decimal("0.00")

    @property
    def freight_cost(self) -> Decimal:
        if not self.fulfillment:
            return Decimal("0.00")
        return self.fulfillment.freight_cost or Decimal("0.00")

    @property
    def net_margin(self) -> Decimal:
        return self.gross_revenue - self.cogs - self.freight_cost

    @property
    def open_action_items(self):
        return self.action_items.filter(status=DealActionItemStatus.OPEN).order_by("due_date", "created_on")

    @property
    def next_action(self) -> str:
        item = self.open_action_items.first()
        return item.title if item else ""

    @property
    def next_follow_up_date(self):
        item = self.open_action_items.first()
        return item.due_date if item else None

    @property
    def is_past_due(self) -> bool:
        due_date = self.next_follow_up_date
        if not due_date:
            return False
        return due_date < timezone.now()

    @property
    def supplier(self):
        return self.purchase_order.supplier if self.purchase_order_id else self.sales_order.supplier

    @property
    def customer(self):
        return self.sales_order.customer if self.sales_order_id else None

    @property
    def carrier(self):
        if self.fulfillment_id and self.fulfillment and self.fulfillment.carrier_id:
            return self.fulfillment.carrier
        if self.sales_order_id and self.sales_order.carrier_id:
            return self.sales_order.carrier
        return self.purchase_order.carrier if self.purchase_order_id else None

    @property
    def pickup_date(self):
        if self.sales_order_id and self.sales_order.pick_up_date:
            return self.sales_order.pick_up_date
        if self.purchase_order_id:
            return self.purchase_order.pick_up_date
        return None

    @property
    def delivery_date(self):
        if self.fulfillment_id and self.fulfillment and self.fulfillment.expected_delivery:
            return self.fulfillment.expected_delivery
        if self.sales_order_id:
            return self.sales_order.delivery_date
        return self.purchase_order.delivery_date if self.purchase_order_id else None


class DealActionItem(TenantAwareModel):
    """Tenant-safe reminder surfaced in Deal Desk and Action Items."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deal = models.ForeignKey("deals.Deal", on_delete=models.CASCADE, related_name="action_items")
    fulfillment = models.ForeignKey(
        "fulfillments.Fulfillment",
        on_delete=models.CASCADE,
        related_name="deal_action_items",
        null=True,
        blank=True,
    )
    assigned_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="deal_action_items",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    milestone_key = models.CharField(max_length=64, default="transit_documents")
    priority = models.CharField(
        max_length=16,
        choices=DealActionItemPriority.choices,
        default=DealActionItemPriority.NORMAL,
    )
    status = models.CharField(
        max_length=16,
        choices=DealActionItemStatus.choices,
        default=DealActionItemStatus.OPEN,
        db_index=True,
    )
    due_date = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["due_date", "created_on"]
        indexes = [
            models.Index(fields=["tenant", "status"]),
            models.Index(fields=["tenant", "assigned_user"]),
            models.Index(fields=["tenant", "due_date"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["deal", "fulfillment", "milestone_key"],
                condition=models.Q(status=DealActionItemStatus.OPEN),
                name="unique_open_deal_action_item_per_milestone",
            ),
        ]

    def __str__(self) -> str:
        return self.title

    @property
    def is_overdue(self) -> bool:
        return bool(self.due_date and self.status == DealActionItemStatus.OPEN and self.due_date < timezone.now())

    def mark_completed(self) -> None:
        self.status = DealActionItemStatus.COMPLETED
        self.completed_at = timezone.now()
        self.save(update_fields=["status", "completed_at", "modified_on"])
