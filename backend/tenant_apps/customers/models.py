"""
Customers models for ProjectMeats.

Defines customer entities and related business logic.

Implements tenant ForeignKey field for shared-schema multi-tenancy.
"""
from django.contrib.postgres.fields import ArrayField
from django.db import models

from tenant_apps.contacts.models import Contact
from tenant_apps.locations.models import Location

from apps.core.model_mixins import FinancialTermsMixin
from apps.core.models import (
    AccountingPaymentTermsChoices,
    CertificateTypeChoices,
    CreditLimitChoices,
    EdibleInedibleChoices,
    IndustryChoices,
    OriginChoices,
    PhoneTypeChoices,
    Protein,
    ProteinTypeChoices,
    TenantAwareModel,
)


class Customer(FinancialTermsMixin, TenantAwareModel):
    """Customer model for managing customer information."""

    # Basic information - keeping existing fields with same names
    name = models.CharField(max_length=255, help_text="Customer company name")
    contact_person = models.CharField(max_length=255, blank=True, null=True, help_text="Primary contact person name")
    email = models.EmailField(blank=True, null=True, help_text="Primary contact email")

    # Legacy primary phone (kept for backward compatibility)
    phone = models.CharField(max_length=20, blank=True, null=True, help_text="Primary contact phone number")
    phone_type = models.CharField(
        max_length=10,
        choices=PhoneTypeChoices.choices,
        blank=True,
        default=PhoneTypeChoices.OFFICE,
        help_text="Primary contact phone type (mobile or office)",
    )

    # New: explicit phone slots for creation/edit UX
    phone_mobile = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        default="",
        help_text="Mobile phone number",
    )
    phone_office = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        default="",
        help_text="Office phone number",
    )
    phone_office_extension = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        default="",
        help_text="Office phone extension",
    )

    # Address fields - keeping existing structure but adding street_address for clarity
    address = models.TextField(blank=True, null=True, help_text="Customer address")
    street_address = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        default="",
        help_text="Street address (alternative to address field)",
    )
    city = models.CharField(max_length=100, blank=True, null=True, help_text="City")
    state = models.CharField(max_length=100, blank=True, null=True, help_text="State or province")
    zip_code = models.CharField(max_length=20, blank=True, null=True, help_text="ZIP or postal code")
    country = models.CharField(max_length=100, blank=True, null=True, help_text="Country")

    # New enhanced fields based on spreadsheet requirements
    plant = models.ForeignKey(
        Location,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="customer_plants",
        help_text="Associated plant/location establishment",
    )
    proteins = models.ManyToManyField(Protein, blank=True, help_text="Protein types handled by this customer")
    edible_inedible = models.CharField(
        max_length=50,
        choices=EdibleInedibleChoices.choices,
        blank=True,
        null=True,
        default="",
        help_text="Type of products handled",
    )
    type_of_plant = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        default="",
        help_text="Customer type of plant (e.g., Vertical, Processor)",
    )
    purchasing_preference_origin = models.CharField(
        max_length=100,
        choices=OriginChoices.choices,
        blank=True,
        null=True,
        default="",
        help_text="Purchasing preference origin (e.g., Domestic, Imported)",
    )
    industry = models.CharField(
        max_length=100,
        choices=IndustryChoices.choices,
        blank=True,
        null=True,
        default="",
        verbose_name="Industry Sector",
        help_text="Industry sector (e.g., Pet Sector, Retail)",
    )
    industry_array = ArrayField(
        models.CharField(max_length=100, choices=IndustryChoices.choices),
        blank=True,
        default=list,
        verbose_name="Industry Sectors",
        help_text="Industry sectors (multi-select: Pet Sector, Retail, etc.) - NEW",
    )
    contacts = models.ManyToManyField(
        Contact,
        related_name="customers",
        blank=True,
        help_text="Multiple contacts associated with this customer",
    )
    products = models.ManyToManyField(
        "system.Product",
        related_name="customers",
        blank=True,
        help_text="Products associated with this customer",
    )
    will_pickup_load = models.BooleanField(default=False, help_text="Will customer pickup load?")
    preferred_protein_types = ArrayField(
        models.CharField(max_length=50, choices=ProteinTypeChoices.choices),
        blank=True,
        default=list,
        help_text="Preferred protein types (multi-select: Beef, Chicken, Pork, etc.)",
    )

    # Enhanced payment/credit fields with standardized choices
    accounting_payment_terms = models.CharField(
        max_length=50,
        choices=AccountingPaymentTermsChoices.choices,
        blank=True,
        null=True,
        default="",
        help_text="Payment terms (e.g., Wire, ACH, Check)",
    )
    credit_limits = models.CharField(
        max_length=50,
        choices=CreditLimitChoices.choices,
        blank=True,
        null=True,
        default="",
        help_text="Credit limits/terms (e.g., Net 30, Wire 1 day prior)",
    )
    # Additional buyer contact fields
    buyer_contact_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        default="",
        help_text="Buyer contact name",
    )
    contact_title = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        default="",
        verbose_name="Contact Title",
        help_text="e.g., Vice President, Buyer",
    )
    buyer_contact_phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        default="",
        help_text="Buyer contact phone",
    )
    buyer_contact_email = models.EmailField(
        blank=True,
        null=True,
        default="",
        help_text="Buyer contact email",
    )

    type_of_certificate = models.CharField(
        max_length=100,
        choices=CertificateTypeChoices.choices,
        blank=True,
        null=True,
        default="",
        help_text="Certificate type required (e.g., 3rd Party, BRC)",
    )
    product_exportable = models.BooleanField(
        default=False,
        help_text="Does customer require exportable products?",
    )

    # Deprecated fields - keeping for backward compatibility
    accounting_terms = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        default="",
        help_text="Accounting terms (deprecated, use accounting_payment_terms)",
    )
    accounting_line_of_credit = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        default="",
        help_text="Line of credit amount (deprecated, use account_line_of_credit)",
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "Customer"
        verbose_name_plural = "Customers"
        indexes = [
            models.Index(fields=["tenant", "name"]),
        ]

    def __str__(self):
        return self.name
