"""
Inquiry models for ProjectMeats.

Tracks product inquiries from initial contact through fulfillment, with
desired vs actual pricing/dates for margin calculation.

Implements tenant ForeignKey field for shared-schema multi-tenancy.
"""
from decimal import Decimal
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.utils import timezone

from apps.core.models import TenantAwareModel, TenantManager


class InquiryStatusChoices(models.TextChoices):
    """Status progression for inquiries."""
    DRAFT = "draft", "Draft"
    PENDING = "pending", "Pending"
    QUOTED = "quoted", "Quoted"
    ACCEPTED = "accepted", "Accepted"
    REJECTED = "rejected", "Rejected"
    FULFILLED = "fulfilled", "Fulfilled"
    CANCELLED = "cancelled", "Cancelled"


class InquirySourceChoices(models.TextChoices):
    """Source of the inquiry."""
    SCHEDULED_CALL = "scheduled_call", "Scheduled Call"
    INBOUND_CALL = "inbound_call", "Inbound Call"
    EMAIL = "email", "Email"
    WEBSITE = "website", "Website"
    TRADE_SHOW = "trade_show", "Trade Show"
    REFERRAL = "referral", "Referral"
    OTHER = "other", "Other"


class InquiryEntityTypeChoices(models.TextChoices):
    """Entity type for the inquiry (supplier or customer)."""
    SUPPLIER = "supplier", "Supplier"
    CUSTOMER = "customer", "Customer"


class UOMChoices(models.TextChoices):
    """Unit of measure choices aligned with existing WeightUnitChoices."""
    LBS = "LBS", "Pounds"
    KG = "KG", "Kilograms"
    CS = "CS", "Cases"
    EA = "EA", "Each"
    PLT = "PLT", "Pallets"
    BOX = "BOX", "Boxes"


class Inquiry(TenantAwareModel):
    """
    Inquiry model for tracking product interest from calls.
    
    Links to a source call (optional) and captures contact information
    at the time of inquiry for historical accuracy.
    """
    
    # Auto-generated unique number per tenant
    inquiry_number = models.CharField(
        max_length=20,
        editable=False,
        help_text="Auto-generated inquiry number (INQ-YYYY-NNNNN)"
    )
    
    # Status and source tracking
    status = models.CharField(
        max_length=20,
        choices=InquiryStatusChoices.choices,
        default=InquiryStatusChoices.DRAFT,
        db_index=True,
        help_text="Current status of the inquiry"
    )
    source_type = models.CharField(
        max_length=20,
        choices=InquirySourceChoices.choices,
        default=InquirySourceChoices.OTHER,
        help_text="How this inquiry originated"
    )
    source_call = models.ForeignKey(
        'cockpit.ScheduledCall',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inquiries',
        help_text="Source scheduled call (if applicable)"
    )
    
    # Entity link (supplier OR customer)
    entity_type = models.CharField(
        max_length=20,
        choices=InquiryEntityTypeChoices.choices,
        help_text="Whether this inquiry is from a supplier or customer"
    )
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='inquiries',
        help_text="Supplier (if entity_type is supplier)"
    )
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='inquiries',
        help_text="Customer (if entity_type is customer)"
    )
    contact = models.ForeignKey(
        'contacts.Contact',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inquiries',
        help_text="Primary contact person"
    )
    
    # Contact info snapshot (preserved at time of inquiry)
    contact_name = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Contact name at time of inquiry"
    )
    contact_email = models.EmailField(
        blank=True,
        default='',
        help_text="Contact email at time of inquiry"
    )
    contact_phone = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Contact phone at time of inquiry"
    )
    contact_company = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Company name at time of inquiry"
    )
    contact_position = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Contact position/title at time of inquiry"
    )
    
    # Timestamps and validity
    inquiry_date = models.DateTimeField(
        default=timezone.now,
        help_text="When the inquiry was created"
    )
    quoted_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the quote was provided"
    )
    decision_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the inquiry was accepted or rejected"
    )
    valid_until = models.DateField(
        null=True,
        blank=True,
        help_text="Quote expiration date"
    )
    
    # Notes and competitor tracking
    notes = models.TextField(
        blank=True,
        default='',
        help_text="General notes about this inquiry"
    )
    competitor_names = models.TextField(
        blank=True,
        default='',
        help_text="Known competitors for this deal"
    )
    competitor_pricing_notes = models.TextField(
        blank=True,
        default='',
        help_text="Intel on competitor pricing"
    )
    win_loss_reason = models.TextField(
        blank=True,
        default='',
        help_text="Reason for win or loss (filled on close)"
    )
    
    # User tracking
    created_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_inquiries',
        help_text="User who created this inquiry"
    )
    
    class Meta:
        verbose_name = "Inquiry"
        verbose_name_plural = "Inquiries"
        ordering = ['-inquiry_date']
        indexes = [
            models.Index(fields=['tenant', 'inquiry_number']),
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['tenant', 'entity_type']),
        ]

    def __str__(self):
        entity_name = self.supplier.name if self.supplier else (self.customer.name if self.customer else "Unknown")
        return f"{self.inquiry_number} - {entity_name}"

    def save(self, *args, **kwargs):
        """Auto-generate inquiry number on first save."""
        if not self.inquiry_number:
            self.inquiry_number = self._generate_inquiry_number()
        super().save(*args, **kwargs)

    def _generate_inquiry_number(self):
        """Generate unique inquiry number: INQ-YYYY-NNNNN."""
        year = timezone.now().year
        prefix = f"INQ-{year}-"
        
        # Get the last inquiry number for this tenant and year
        last_inquiry = Inquiry.objects.filter(
            tenant=self.tenant,
            inquiry_number__startswith=prefix
        ).order_by('-inquiry_number').first()
        
        if last_inquiry:
            try:
                last_num = int(last_inquiry.inquiry_number.split('-')[-1])
                next_num = last_num + 1
            except (ValueError, IndexError):
                next_num = 1
        else:
            next_num = 1
        
        return f"{prefix}{next_num:05d}"

    @property
    def is_expired(self):
        """Check if the quote has expired."""
        if not self.valid_until:
            return False
        return self.valid_until < timezone.now().date()

    @property
    def total_desired(self):
        """Sum of all line item desired totals."""
        return self.products.aggregate(
            total=models.Sum('desired_total')
        )['total'] or Decimal('0.00')

    @property
    def total_actual(self):
        """Sum of all line item actual totals."""
        return self.products.aggregate(
            total=models.Sum('actual_total')
        )['total'] or Decimal('0.00')

    @property
    def total_margin(self):
        """Difference between actual and desired totals."""
        actual = self.total_actual
        desired = self.total_desired
        if actual and desired:
            return actual - desired
        return None

    @property
    def total_margin_percent(self):
        """Margin as percentage of desired total."""
        desired = self.total_desired
        margin = self.total_margin
        if desired and margin and desired != 0:
            return (margin / desired) * 100
        return None

    @property
    def entity(self):
        """Return the linked entity (supplier or customer)."""
        return self.supplier if self.entity_type == InquiryEntityTypeChoices.SUPPLIER else self.customer


class InquiryProduct(models.Model):
    """
    Through table for Inquiry products with desired vs actual tracking.
    
    Each line tracks expected (desired) values from the inquiry and
    confirmed (actual) values from the quote/negotiation.
    """
    
    objects = TenantManager()
    
    inquiry = models.ForeignKey(
        Inquiry,
        on_delete=models.CASCADE,
        related_name='products'
    )
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='inquiry_lines'
    )
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Requested quantity"
    )
    
    # Desired fields (customer/inquiry expectations)
    desired_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Expected total amount"
    )
    desired_price_per_unit = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Expected price per unit"
    )
    desired_uom = models.CharField(
        max_length=10,
        choices=UOMChoices.choices,
        default=UOMChoices.LBS,
        help_text="Expected unit of measure"
    )
    desired_uom_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Quantity in UOM"
    )
    desired_processed_date = models.DateField(
        null=True,
        blank=True,
        help_text="Expected processing date"
    )
    desired_expiration_date = models.DateField(
        null=True,
        blank=True,
        help_text="Expected expiration date"
    )
    desired_available_date = models.DateField(
        null=True,
        blank=True,
        help_text="When needed/available"
    )
    desired_shipping_date = models.DateField(
        null=True,
        blank=True,
        help_text="Expected ship date"
    )
    desired_delivery_date = models.DateField(
        null=True,
        blank=True,
        help_text="Expected delivery date"
    )
    
    # Actual fields (reality/confirmed values)
    actual_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Actual total amount"
    )
    actual_price_per_unit = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Actual price per unit"
    )
    actual_uom = models.CharField(
        max_length=10,
        choices=UOMChoices.choices,
        blank=True,
        default='',
        help_text="Actual unit of measure"
    )
    actual_uom_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Actual quantity in UOM"
    )
    actual_processed_date = models.DateField(
        null=True,
        blank=True,
        help_text="Actual processing date"
    )
    actual_expiration_date = models.DateField(
        null=True,
        blank=True,
        help_text="Actual expiration date"
    )
    actual_available_date = models.DateField(
        null=True,
        blank=True,
        help_text="Actual availability date"
    )
    actual_shipping_date = models.DateField(
        null=True,
        blank=True,
        help_text="Actual ship date"
    )
    actual_delivery_date = models.DateField(
        null=True,
        blank=True,
        help_text="Actual delivery date"
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
        verbose_name = "Inquiry Product"
        verbose_name_plural = "Inquiry Products"
        ordering = ['id']

    def __str__(self):
        return f"{self.inquiry.inquiry_number} - {self.product.description_of_product_item[:50]}"

    @property
    def tenant(self):
        """Inherit tenant from parent inquiry."""
        return self.inquiry.tenant

    @property
    def margin(self):
        """Calculate margin (actual - desired) for this line."""
        if self.actual_total and self.desired_total:
            return self.actual_total - self.desired_total
        return None

    @property
    def margin_percent(self):
        """Calculate margin percentage for this line."""
        if self.margin and self.desired_total and self.desired_total != 0:
            return (self.margin / self.desired_total) * 100
        return None


class InquiryTemplate(TenantAwareModel):
    """
    Reusable inquiry templates with pre-configured products and settings.
    
    Allows quick creation of common inquiry types (e.g., "Weekly Beef Order",
    "Standard Pork Inquiry") with pre-selected products and default pricing.
    """
    
    name = models.CharField(
        max_length=100,
        help_text="Template name (e.g., 'Weekly Beef Order')"
    )
    description = models.TextField(
        blank=True,
        default='',
        help_text="Description of this template's purpose"
    )
    entity_type = models.CharField(
        max_length=20,
        choices=InquiryEntityTypeChoices.choices,
        help_text="Whether this template is for suppliers or customers"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this template is available for use"
    )
    
    # Default settings
    default_valid_days = models.PositiveIntegerField(
        default=7,
        help_text="Default number of days quote is valid"
    )
    default_notes = models.TextField(
        blank=True,
        default='',
        help_text="Default notes to include in inquiry"
    )
    
    # Usage tracking
    use_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of times this template has been used"
    )
    
    created_on = models.DateTimeField(auto_now_add=True)
    modified_on = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_inquiry_templates'
    )
    
    class Meta:
        verbose_name = "Inquiry Template"
        verbose_name_plural = "Inquiry Templates"
        ordering = ['-use_count', 'name']
        indexes = [
            models.Index(fields=['tenant', 'entity_type', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.entity_type})"


class InquiryTemplateProduct(models.Model):
    """Products included in an inquiry template with default values."""
    
    objects = TenantManager()
    
    template = models.ForeignKey(
        InquiryTemplate,
        on_delete=models.CASCADE,
        related_name='products'
    )
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='template_lines'
    )
    
    # Default values for this product in this template
    default_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Default quantity to request"
    )
    default_uom = models.CharField(
        max_length=10,
        choices=UOMChoices.choices,
        default=UOMChoices.LBS,
        help_text="Default unit of measure"
    )
    default_price_per_unit = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Default price per unit (if known)"
    )
    notes = models.TextField(
        blank=True,
        default='',
        help_text="Notes for this product in this template"
    )
    sort_order = models.PositiveIntegerField(
        default=0,
        help_text="Display order in template"
    )
    
    class Meta:
        verbose_name = "Template Product"
        verbose_name_plural = "Template Products"
        ordering = ['sort_order', 'id']
        unique_together = [['template', 'product']]
    
    def __str__(self):
        return f"{self.template.name} - {self.product.description_of_product_item[:30]}"
    
    @property
    def tenant(self):
        """Inherit tenant from parent template."""
        return self.template.tenant
