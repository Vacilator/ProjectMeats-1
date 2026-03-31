"""
Core models for ProjectMeats.

Provides base models and common functionality used across all apps.
"""
from django.contrib.auth.models import User
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone


class TenantManager(models.Manager):
    """
    Custom manager that filters querysets by tenant.
    
    This manager automatically filters all queries by the current tenant
    when available in the context.
    """

    def get_queryset(self):
        """Override to filter by tenant if available in context."""
        return super().get_queryset()

    def for_tenant(self, tenant):
        """Filter queryset for a specific tenant."""
        if tenant:
            return self.filter(tenant=tenant)
        return self.none()


class Protein(models.Model):
    """Protein model for meat types used across suppliers and customers."""

    name = models.CharField(
        max_length=50,
        unique=True,
        help_text="Protein type (e.g., Beef, Pork, Chicken, Lamb)",
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "Protein"
        verbose_name_plural = "Proteins"

    def __str__(self):
        return self.name


class EdibleInedibleChoices(models.TextChoices):
    """Common choices for edible/inedible product types."""

    EDIBLE = "Edible", "Edible"
    INEDIBLE = "Inedible", "Inedible"
    BOTH = "Edible & Inedible", "Edible & Inedible"


class AccountingPaymentTermsChoices(models.TextChoices):
    """Common choices for payment terms."""

    WIRE = "Wire", "Wire"
    ACH = "ACH", "ACH"
    CHECK = "Check", "Check"
    CREDIT_CARD = "Credit Card", "Credit Card"


class CreditLimitChoices(models.TextChoices):
    """Common choices for credit limits."""

    WIRE_1_DAY_PRIOR = "Wire 1 day prior", "Wire 1 day prior"
    NET_7 = "Net 7", "Net 7"
    NET_15 = "Net 15", "Net 15"
    NET_30 = "Net 30", "Net 30"
    NET_45 = "Net 45", "Net 45"
    NET_60 = "Net 60", "Net 60"


class AccountLineOfCreditChoices(models.TextChoices):
    """Common choices for line of credit amounts."""

    RANGE_0_50K = "$0 - $50,000", "$0 - $50,000"
    RANGE_50K_100K = "$50,000 - $100,000", "$50,000 - $100,000"
    RANGE_100K_250K = "$100,000 - $250,000", "$100,000 - $250,000"
    RANGE_250K_500K = "$250,000 - $500,000", "$250,000 - $500,000"
    RANGE_500K_1M = "$500,000 - $1,000,000", "$500,000 - $1,000,000"
    RANGE_1M_PLUS = "$1,000,000+", "$1,000,000+"


class ProteinTypeChoices(models.TextChoices):
    """Common choices for protein types."""

    BEEF = "Beef", "Beef"
    CHICKEN = "Chicken", "Chicken"
    DUCK = "Duck", "Duck"
    PORK = "Pork", "Pork"
    LAMB = "Lamb", "Lamb"
    TURKEY = "Turkey", "Turkey"
    FISH = "Fish", "Fish"
    HORSE = "Horse", "Horse"
    OTHER = "Other", "Other"


class FreshOrFrozenChoices(models.TextChoices):
    """Common choices for fresh or frozen products."""

    FRESH = "Fresh", "Fresh"
    FROZEN = "Frozen", "Frozen"


class PackageTypeChoices(models.TextChoices):
    """Common choices for package types."""

    BOXED_WAX_LINED = "Boxed wax lined", "Boxed wax lined"
    BOXED_CO2 = "Boxed CO2", "Boxed CO2"
    COMBO_BINS = "Combo bins", "Combo bins"
    TOTES = "Totes", "Totes"
    BAGS = "Bags", "Bags"
    BULK = "Bulk", "Bulk"
    POLY_MULTIPLE = "Poly-Multiple", "Poly-Multiple"
    NUDE = "Nude", "Nude"


class NetOrCatchChoices(models.TextChoices):
    """Common choices for net or catch weight."""

    NET = "Net", "Net"
    CATCH = "Catch", "Catch"


class PlantTypeChoices(models.TextChoices):
    """Common choices for plant types."""

    VERTICAL = "Vertical", "Vertical"
    PROCESSOR = "Processor", "Processor"
    DISTRIBUTOR = "Distributor", "Distributor"
    RENDERER = "Renderer", "Renderer"


class CertificateTypeChoices(models.TextChoices):
    """Common choices for certificate types."""

    THIRD_PARTY = "3rd Party", "3rd Party"
    BRC = "BRC", "BRC"
    FSSAI = "FSSAI", "FSSAI"
    SQF = "SQF", "SQF"
    IFS = "IFS", "IFS"
    ISO = "ISO", "ISO"
    HACCP = "HACCP", "HACCP"
    HALAL = "Halal", "Halal"
    KOSHER = "Kosher", "Kosher"
    ORGANIC = "Organic", "Organic"


class OriginChoices(models.TextChoices):
    """Common choices for product origin."""

    DOMESTIC = "Domestic", "Domestic"
    IMPORTED = "Imported", "Imported"


class CountryOriginChoices(models.TextChoices):
    """Common choices for country of origin."""

    USA = "USA", "USA"
    CANADA = "CAN", "Canada"
    MEXICO = "MEX", "Mexico"
    BRAZIL = "BRA", "Brazil"
    AUSTRALIA = "AUS", "Australia"
    NEW_ZEALAND = "NZL", "New Zealand"


class ShippingOfferedChoices(models.TextChoices):
    """Common choices for shipping offered."""

    YES_DOMESTIC = "Yes - Domestic", "Yes - Domestic"
    YES_INTERNATIONAL = "Yes - International", "Yes - International"
    YES_EXPORTED = "Yes - Exported", "Yes - Exported"
    YES_DOMESTIC_EXPORTED = "Yes - Domestic & Exported", "Yes - Domestic & Exported"
    NO = "No", "No"


class IndustryChoices(models.TextChoices):
    """Common choices for customer industry."""

    PET_SECTOR = "Pet Sector", "Pet Sector"
    PET_FOODS = "Pet Foods", "Pet Foods"
    PROCESSOR = "Processor", "Processor"
    RETAIL = "Retail", "Retail"
    WHOLESALER = "Wholesaler", "Wholesaler"
    FOOD_SERVICE = "Food Service", "Food Service"
    EXPORT = "Export", "Export"


class WeightUnitChoices(models.TextChoices):
    """Common choices for weight units."""

    LBS = "LBS", "LBS"
    KG = "KG", "KG"


class AppointmentMethodChoices(models.TextChoices):
    """Common choices for how to make appointments."""

    EMAIL = "Email", "Email"
    PHONE = "Phone", "Phone"
    WEBSITE = "Website", "Website"
    FAX = "Fax", "Fax"
    FCFS = "First Come First Serve", "First Come First Serve"


class PhoneTypeChoices(models.TextChoices):
    """Common choices for phone number type."""

    MOBILE = "mobile", "Mobile"
    OFFICE = "office", "Office"


class ContactTypeChoices(models.TextChoices):
    """Common choices for contact types."""

    SALES = "Sales", "Sales"
    ACCOUNTING = "Accounting", "Accounting"
    SHIPPING = "Shipping", "Shipping"
    RECEIVING = "Receiving", "Receiving"
    OPERATIONS = "Operations", "Operations"
    QUALITY = "Quality", "Quality"
    EXECUTIVE = "Executive", "Executive"
    DOCS_BOL = "Doc's BOL", "Doc's BOL"
    COA = "COA", "COA"
    POD = "POD", "POD"


class DepartmentChoicesSupplier(models.TextChoices):
    """Common choices for supplier departments."""

    SALES = "Sales", "Sales"
    DOCS_BOL = "Doc's BOL", "Doc's BOL"
    DOCS_COA = "Doc's COA", "Doc's COA"
    ACCOUNTING = "Accounting", "Accounting"
    SHIPPING = "Shipping", "Shipping"
    RECEIVING = "Receiving", "Receiving"
    OPERATIONS = "Operations", "Operations"
    QUALITY = "Quality", "Quality"


class CarrierDepartmentChoices(models.TextChoices):
    """Common choices for carrier departments."""

    BOL = "BOL", "BOL"
    COA = "COA", "COA"
    POD = "POD", "POD"


class CartonTypeChoices(models.TextChoices):
    """Common choices for carton types."""

    POLY_MULTIPLE = "Poly-Multiple", "Poly-Multiple"
    WAXED_LINED = "Waxed Lined", "Waxed Lined"
    CARDBOARD = "Cardboard", "Cardboard"
    PLASTIC = "Plastic", "Plastic"


class ItemProductionDateChoices(models.TextChoices):
    """Common choices for item production date."""

    FIVE_DAY_NEWER = "5 day newer", "5 day newer"
    TEN_DAY_NEWER = "10 day newer", "10 day newer"
    FIFTEEN_DAY_NEWER = "15 day newer", "15 day newer"
    THIRTY_DAY_NEWER = "30 day newer", "30 day newer"


class CarrierReleaseFormatChoices(models.TextChoices):
    """Common choices for carrier release format."""

    SUPPLIER_CONFIRMATION_ORDER_NUMBER = "Supplier Confirmation Order Number", "Supplier Confirmation Order Number"
    CARRIER_RELEASE_NUMBER = "Carrier Release Number", "Carrier Release Number"
    BOTH = "Both", "Both"


class LoadStatusChoices(models.TextChoices):
    """Common choices for load status in cold storage."""

    MATCHED = "Matched", "Matched"
    TBD_NOT_MATCHED = "TBD - Not Matched", "TBD - Not Matched"


class ChangeTypeChoices(models.TextChoices):
    """Common choices for change/history tracking."""

    CREATED = "created", "Created"
    UPDATED = "updated", "Updated"
    DELETED = "deleted", "Deleted"


class CarrierTypeChoices(models.TextChoices):
    """Common choices for carrier types."""

    TRUCK = "truck", "Truck"
    RAIL = "rail", "Rail"
    AIR = "air", "Air"
    SEA = "sea", "Sea"
    OTHER = "other", "Other"


class StatusChoices(models.TextChoices):
    """Common status choices for entities."""

    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"
    ARCHIVED = "archived", "Archived"


class StatusModel(models.Model):
    """Abstract base model for entities with status."""

    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
        help_text="Current status of the entity",
    )

    class Meta:
        abstract = True


class TimestampModel(models.Model):
    """Abstract base model for entities with timestamps."""

    created_on = models.DateTimeField(auto_now_add=True)
    modified_on = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class AbstractContact(models.Model):
    """
    Abstract base model for contact information (DRY principle).
    
    Provides common fields found across Customer, Supplier, and Carrier entities
    based on CSV/spreadsheet requirements. Implements US phone validation.
    """
    
    # US phone number validator (supports formats: (555) 123-4567, 555-123-4567, 5551234567)
    phone_validator = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Phone number must be entered in a valid format (e.g., +15551234567 or 5551234567)"
    )
    
    # Contact information fields
    ap_contact_name = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Accounts Payable contact name",
        verbose_name="AP Contact Name"
    )
    ap_phone = models.CharField(
        max_length=20,
        blank=True,
        default='',
        validators=[phone_validator],
        help_text="Accounts Payable phone number",
        verbose_name="AP Phone"
    )
    ap_email = models.EmailField(
        blank=True,
        default='',
        help_text="Accounts Payable email address",
        verbose_name="AP Email"
    )
    corp_address = models.TextField(
        blank=True,
        default='',
        help_text="Corporate address (full address including street, city, state, zip)",
        verbose_name="Corporate Address"
    )
    
    class Meta:
        abstract = True


class TenantAwareModel(TimestampModel):
    """
    Abstract base model for tenant-aware entities.

    Provides tenant isolation via ForeignKey and dynamic schema extension
    through custom_data JSONB field for System Blueprint features.
    """

    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        help_text="Tenant this entity belongs to"
    )

    custom_data = models.JSONField(
        default=dict,
        blank=True,
        help_text='Extensible schema data for dynamic fields defined in Blueprints.'
    )

    objects = TenantManager()

    class Meta:
        abstract = True


class SoftDeleteManager(TenantManager):
    """Default manager that hides soft-deleted records."""

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class SoftDeleteModel(models.Model):
    """Abstract base model for enterprise-grade soft deletes.

    By default, soft-deleted records are hidden from normal queries via `objects`.
    Use `all_objects` when you need to access deleted rows for admin/restore.
    """

    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = TenantManager()

    class Meta:
        abstract = True

    def soft_delete(self, *, using=None, deleted_at=None):
        if self.is_deleted:
            return

        self.is_deleted = True
        self.deleted_at = deleted_at or timezone.now()
        self.save(update_fields=["is_deleted", "deleted_at"])

    def restore(self, *, using=None):
        if not self.is_deleted:
            return

        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=["is_deleted", "deleted_at"])

    def hard_delete(self, using=None, keep_parents=False):
        return super().delete(using=using, keep_parents=keep_parents)

    def delete(self, using=None, keep_parents=False):  # pragma: no cover
        """Override default delete to avoid accidental hard deletes."""
        self.soft_delete(using=using)


class OwnedModel(TimestampModel):
    """Abstract base model for entities with ownership."""

    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        help_text="User who owns this entity",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="%(class)s_created",
        help_text="User who created this entity",
    )
    modified_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="%(class)s_modified",
        help_text="User who last modified this entity",
    )

    class Meta:
        abstract = True


class UserPreferences(models.Model):
    """
    User-specific preferences for UI customization.
    
    Stores theme preferences, layout configurations, widget arrangements,
    and other user-specific UI settings.
    """
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='preferences',
        help_text="User for these preferences"
    )
    
    # Theme preferences
    theme = models.CharField(
        max_length=20,
        choices=[
            ('light', 'Light'),
            ('dark', 'Dark'),
            ('auto', 'Auto'),
        ],
        default='light',
        help_text="UI theme preference"
    )
    
    # Layout and widget configuration (JSON format)
    dashboard_layout = models.JSONField(
        default=dict,
        blank=True,
        help_text="Dashboard widget layout configuration"
    )
    
    sidebar_collapsed = models.BooleanField(
        default=False,
        help_text="Whether sidebar is collapsed by default"
    )
    
    # Quick menu favorites (stored as list of route paths)
    quick_menu_items = models.JSONField(
        default=list,
        blank=True,
        help_text="User's favorite quick menu items"
    )
    
    # Custom widget settings
    widget_preferences = models.JSONField(
        default=dict,
        blank=True,
        help_text="Widget-specific preferences and configurations"
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "User Preferences"
        verbose_name_plural = "User Preferences"
    
    def __str__(self):
        return f"Preferences for {self.user.username}"


class UserFavorite(models.Model):
    """
    User-specific favorites for quick access to entities.

    Allows users to bookmark entities (customers, suppliers, products, etc.)
    for quick access in the Cockpit interface.

    IMPORTANT: Favorites are tenant-scoped to prevent ID collisions across tenants.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='favorites',
        help_text="User who favorited this entity"
    )
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='user_favorites',
        help_text="Tenant context for this favorite"
    )
    entity_type = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Type of entity (customer, supplier, product, etc.)"
    )
    entity_id = models.IntegerField(
        help_text="ID of the favorited entity"
    )
    entity_title = models.CharField(
        max_length=255,
        blank=True,
        help_text="Cached title for display"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="When this was favorited"
    )

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'tenant', 'entity_type', 'entity_id'],
                name='unique_user_tenant_favorite'
            )
        ]
        indexes = [
            models.Index(fields=['user', '-created_at'], name='core_userfa_user_created_idx'),
            models.Index(fields=['user', 'tenant', 'entity_type'], name='core_userfa_user_entity_idx'),
        ]
        verbose_name = 'User Favorite'
        verbose_name_plural = 'User Favorites'

    def __str__(self):
        return f"{self.user.username}'s favorite: {self.entity_type} #{self.entity_id}"
