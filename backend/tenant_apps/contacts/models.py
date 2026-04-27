"""
Contacts models for ProjectMeats.

Defines contact entities and related business logic.

Implements tenant ForeignKey field for shared-schema multi-tenancy.
"""
from django.contrib.postgres.fields import ArrayField
from django.db import models
from apps.core.models import ContactTypeChoices, PhoneTypeChoices, StatusChoices, TenantAwareModel


class ContactDepartmentChoices(models.TextChoices):
    SALES = 'sales', 'Sales'
    QA = 'qa', 'Quality Assurance'
    SHIPPING = 'shipping', 'Shipping / Loadout'
    CERTIFICATION = 'certification', 'Certification'
    ACCOUNTING = 'accounting', 'Accounting'

    # Back-compat alias: keep the legacy enum value to satisfy OpenAPI back-compat gates.
    # Data is migrated to SHIPPING; UI should avoid offering BOOKING for new records.
    BOOKING = 'booking', 'Booking (Deprecated)'


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
    title = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Specific job title/role",
    )
    
    # Department-scoped contact fields (Grandparent→Parent→Child hierarchy)
    department = models.CharField(
        max_length=32,
        choices=ContactDepartmentChoices.choices,
        blank=True,
        null=True,
        default='',
        help_text='Department this contact belongs to (Sales, QA, Shipping / Loadout, Certification, Accounting)',
    )
    notes = models.TextField(
        blank=True,
        null=True,
        help_text="Additional contact notes",
    )

    mobile_phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        default='',
        help_text='Mobile phone number (optional)',
    )
    office_phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        default='',
        help_text='Office phone number (optional)',
    )
    office_phone_ext = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        default='',
        help_text='Office phone extension (optional)',
    )

    protein_types_responsible = ArrayField(
        models.CharField(max_length=50),
        blank=True,
        null=True,
        default=list,
        help_text='Protein types this contact is responsible for (Sales only)',
    )
    items_responsible = ArrayField(
        models.CharField(max_length=100),
        blank=True,
        null=True,
        default=list,
        help_text='Items this contact is responsible for (Sales only)',
    )
    documents_responsible_for = ArrayField(
        models.CharField(max_length=100),
        blank=True,
        null=True,
        default=list,
        help_text='Documents this contact is responsible for',
    )

    # =====================================================================
    # Additive M2M responsibilities/preferences (requested for rollups)
    # =====================================================================
    proteins_responsible = models.ManyToManyField(
        'core.Protein',
        through='ContactProteinResponsibility',
        related_name='contacts_responsible',
        blank=True,
        help_text='Proteins this contact is responsible for (department-dependent)',
    )
    products_responsible = models.ManyToManyField(
        'products.MasterProduct',
        through='ContactMasterProductResponsibility',
        related_name='contacts_responsible',
        blank=True,
        help_text='Master products this contact is responsible for (department-dependent)',
    )
    preferred_protein_types = models.ManyToManyField(
        'core.Protein',
        through='ContactPreferredProtein',
        related_name='preferred_by_contacts',
        blank=True,
        help_text='Preferred proteins (used for aggregated customer preferences)',
    )
    preferred_products = models.ManyToManyField(
        'products.MasterProduct',
        through='ContactPreferredMasterProduct',
        related_name='preferred_by_contacts',
        blank=True,
        help_text='Preferred master products (used for aggregated customer preferences)',
    )

    # Enhanced fields from Excel requirements (legacy; kept for backward compatibility)
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


class ContactProteinResponsibility(TenantAwareModel):
    """Tenant-safe link for Contact ↔ core.Protein responsibilities."""

    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='protein_responsibility_links')
    protein = models.ForeignKey('core.Protein', on_delete=models.CASCADE, related_name='contact_responsibility_links')

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'contact', 'protein'],
                name='unique_contact_protein_responsibility_per_tenant',
            )
        ]
        indexes = [
            models.Index(fields=['tenant', 'contact']),
            models.Index(fields=['tenant', 'protein']),
        ]


class ContactMasterProductResponsibility(TenantAwareModel):
    """Tenant-safe link for Contact ↔ products.MasterProduct responsibilities."""

    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='master_product_responsibility_links')
    master_product = models.ForeignKey(
        'products.MasterProduct',
        on_delete=models.CASCADE,
        related_name='contact_responsibility_links',
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'contact', 'master_product'],
                name='unique_contact_master_product_responsibility_per_tenant',
            )
        ]
        indexes = [
            models.Index(fields=['tenant', 'contact']),
            models.Index(fields=['tenant', 'master_product']),
        ]


class ContactPreferredProtein(TenantAwareModel):
    """Tenant-safe link for Contact ↔ core.Protein preferences."""

    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='preferred_protein_links')
    protein = models.ForeignKey('core.Protein', on_delete=models.CASCADE, related_name='preferred_by_contact_links')

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'contact', 'protein'],
                name='unique_contact_preferred_protein_per_tenant',
            )
        ]
        indexes = [
            models.Index(fields=['tenant', 'contact']),
            models.Index(fields=['tenant', 'protein']),
        ]


class ContactPreferredMasterProduct(TenantAwareModel):
    """Tenant-safe link for Contact ↔ products.MasterProduct preferences."""

    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='preferred_master_product_links')
    master_product = models.ForeignKey(
        'products.MasterProduct',
        on_delete=models.CASCADE,
        related_name='preferred_by_contact_links',
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'contact', 'master_product'],
                name='unique_contact_preferred_master_product_per_tenant',
            )
        ]
        indexes = [
            models.Index(fields=['tenant', 'contact']),
            models.Index(fields=['tenant', 'master_product']),
        ]
