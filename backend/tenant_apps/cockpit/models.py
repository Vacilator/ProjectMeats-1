"""
Cockpit models for ProjectMeats.

Provides activity tracking and logging functionality for all business entities.

Implements tenant ForeignKey field for shared-schema multi-tenancy.
"""
from django.db import models
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

from apps.core.models import TenantAwareModel


class EntityTypeChoices(models.TextChoices):
    """Entity types that can have activity logs."""
    SUPPLIER = "supplier", "Supplier"
    CUSTOMER = "customer", "Customer"
    PLANT = "plant", "Plant"
    LOCATION = "location", "Location"
    PURCHASE_ORDER = "purchase_order", "Purchase Order"
    SALES_ORDER = "sales_order", "Sales Order"
    CARRIER = "carrier", "Carrier"
    PRODUCT = "product", "Product"
    INVOICE = "invoice", "Invoice"
    CONTACT = "contact", "Contact"
    INQUIRY = "inquiry", "Inquiry"
    FULFILLMENT = "fulfillment", "Fulfillment"


class ActivityLog(TenantAwareModel):
    """
    Activity Log model for tracking notes and history across all entities.
    
    This model provides a universal "notes feed" where multiple notes can be attached
    to any business entity (Supplier, Customer, PO, SO, etc.).
    
    Example usage:
        - Cockpit Call Log: Log calls with suppliers/customers
        - Order Notes: Track order-specific communications
        - Contact History: Record all interactions with contacts
    """
    
    # Entity tracking (Generic Foreign Key for flexibility - optional)
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Type of entity this log relates to"
    )
    object_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="ID of the related entity"
    )
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Alternative simple approach (denormalized for faster queries)
    entity_type = models.CharField(
        max_length=50,
        choices=EntityTypeChoices.choices,
        help_text="Entity type (Supplier, Customer, Order, etc.)"
    )
    entity_id = models.PositiveIntegerField(
        help_text="ID of the entity"
    )
    
    # Activity content
    title = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Optional title/subject of the activity"
    )
    content = models.TextField(
        help_text="Activity note content (supports multiline text)"
    )
    
    # Metadata
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_logs",
        help_text="User who created this log entry"
    )
    is_pinned = models.BooleanField(
        default=False,
        help_text="Pin important notes to top of feed"
    )
    
    # Tags for categorization (optional)
    tags = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Comma-separated tags (e.g., 'call, follow-up, urgent')"
    )
    
    class Meta:
        ordering = ["-created_on"]  # Latest first
        verbose_name = "Activity Log"
        verbose_name_plural = "Activity Logs"
        indexes = [
            models.Index(fields=['tenant', 'entity_type', 'entity_id']),
            models.Index(fields=['tenant', '-created_on']),
            models.Index(fields=['content_type', 'object_id']),
        ]
    
    def __str__(self):
        return f"{self.entity_type} #{self.entity_id} - {self.title or 'Note'}"


class ScheduledCall(TenantAwareModel):
    """
    Scheduled Call model for Cockpit Calendar/Scheduler functionality.
    
    Supports the "Call Slotting" feature where users can schedule follow-up calls
    with suppliers, customers, or other contacts.
    """
    
    # Related entity (what/who is this call about?)
    entity_type = models.CharField(
        max_length=50,
        choices=EntityTypeChoices.choices,
        help_text="Entity type for this call"
    )
    entity_id = models.PositiveIntegerField(
        help_text="ID of the related entity"
    )
    
    # Call details
    title = models.CharField(
        max_length=255,
        help_text="Call subject/title"
    )
    description = models.TextField(
        blank=True,
        default='',
        help_text="Call notes/agenda"
    )
    
    # Scheduling
    scheduled_for = models.DateTimeField(
        help_text="When is this call scheduled?"
    )
    duration_minutes = models.PositiveIntegerField(
        default=30,
        help_text="Expected call duration in minutes"
    )
    
    # Status
    is_completed = models.BooleanField(
        default=False,
        help_text="Has this call been completed?"
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When was this call completed?"
    )
    
    # Assignment
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scheduled_calls",
        help_text="User responsible for this call"
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_scheduled_calls",
        help_text="User who created this scheduled call"
    )
    
    # Linked Activity Log (if call results in a log entry)
    activity_log = models.ForeignKey(
        ActivityLog,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scheduled_calls",
        help_text="Activity log created from this call (if completed)"
    )
    
    class Meta:
        ordering = ["scheduled_for"]
        verbose_name = "Scheduled Call"
        verbose_name_plural = "Scheduled Calls"
        indexes = [
            models.Index(fields=['tenant', 'scheduled_for']),
            models.Index(fields=['tenant', 'is_completed']),
            models.Index(fields=['entity_type', 'entity_id']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.scheduled_for.strftime('%Y-%m-%d %H:%M')}"


class UserWorkspaceLayout(models.Model):
    """
    Persists user's Workspace/Cockpit layout configuration.
    
    Stores the widget positions, sizes, and enabled widgets per user.
    Falls back to default layout if no saved layout exists.
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="workspace_layout",
        help_text="User this layout belongs to"
    )
    
    # Layout data stored as JSON
    layout = models.JSONField(
        default=list,
        help_text="Widget layout positions (react-grid-layout format)"
    )
    widgets = models.JSONField(
        default=list,
        help_text="Widget configurations (id, type, title)"
    )
    
    # Version for migrations if layout schema changes
    version = models.PositiveIntegerField(
        default=1,
        help_text="Layout schema version for future migrations"
    )
    
    # Timestamps
    created_on = models.DateTimeField(auto_now_add=True)
    modified_on = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "User Workspace Layout"
        verbose_name_plural = "User Workspace Layouts"
    
    def __str__(self):
        return f"{self.user.username}'s Workspace Layout"
