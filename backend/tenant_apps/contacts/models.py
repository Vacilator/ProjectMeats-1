"""
Contacts models for ProjectMeats.

Defines contact entities and related business logic.

Implements tenant ForeignKey field for shared-schema multi-tenancy.
"""
from django.db import models
from apps.core.models import ContactTypeChoices, PhoneTypeChoices, StatusChoices, TenantAwareModel


class Contact(TenantAwareModel):
    """Contact model for managing contact information."""
    
    # Parent entity relationships (optional - contact can belong to supplier or customer)
    supplier = models.ForeignKey(
        'suppliers.Supplier',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="contact_persons",
        help_text="Supplier this contact belongs to",
    )
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="contact_persons",
        help_text="Customer this contact belongs to",
    )

    # Child entity relationships (optional)
    # NOTE: These are additive and enable UI drill-down: Supplier -> Plant -> Contacts and Customer -> Location -> Contacts.
    plant = models.ForeignKey(
        'plants.Plant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='contacts',
        help_text='Plant this contact belongs to (optional)',
    )
    location = models.ForeignKey(
        'locations.Location',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='contacts',
        help_text='Location this contact belongs to (optional)',
    )
    
    # Status field for tracking active/inactive contacts
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
        help_text="Current status of the contact",
    )

    first_name = models.CharField(max_length=100, help_text="Contact's first name")
    last_name = models.CharField(max_length=100, help_text="Contact's last name")
    email = models.EmailField(blank=True, null=True, help_text="Contact email address")
    phone = models.CharField(
        max_length=20, blank=True, null=True, help_text="Contact phone number"
    )
    phone_type = models.CharField(
        max_length=10,
        choices=PhoneTypeChoices.choices,
        blank=True,
        default=PhoneTypeChoices.OFFICE,
        help_text="Contact phone type (mobile or office)",
    )
    company = models.CharField(
        max_length=255, blank=True, null=True, help_text="Company or organization"
    )
    position = models.CharField(
        max_length=100, blank=True, null=True, help_text="Job position or title"
    )
    
    # Enhanced fields from Excel requirements
    contact_type = models.CharField(
        max_length=50,
        choices=ContactTypeChoices.choices,
        blank=True,
        default='',
        help_text="Type of contact (e.g., Sales, Accounting, Shipping)",
    )
    contact_title = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Contact title/designation",
    )
    main_phone = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text="Main phone number",
    )
    direct_phone = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text="Direct phone number",
    )
    cell_phone = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text="Cell phone number",
    )
    
    # Additional timestamp fields for consistency with newer models
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        ordering = ["last_name", "first_name"]
        verbose_name = "Contact"
        verbose_name_plural = "Contacts"
        indexes = [
            models.Index(fields=['tenant', 'last_name', 'first_name']),
            models.Index(fields=['tenant', 'supplier']),
            models.Index(fields=['tenant', 'customer']),
            models.Index(fields=['tenant', 'plant']),
            models.Index(fields=['tenant', 'location']),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"
