"""
Core models for ProjectMeats.

Provides base models and common functionality used across all apps.
"""
import hashlib
import hmac
import secrets
import uuid

from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone

from apps.core.security import B2B_PORTAL_ALLOWED_DOCUMENT_SOURCES, B2B_PORTAL_ALLOWED_ENTITY_SCOPES


class TenantManager(models.Manager):
    """
    Custom manager that filters querysets by tenant.

    Application-level tenant helper manager.

    NOTE: Row-level security (RLS) at the PostgreSQL level provides the
    actual database-enforced tenant isolation via `app.current_tenant`
    session variable set by TenantMiddleware.  This manager provides
    convenience methods (.for_tenant()) for explicit application-level
    filtering where needed.
    """

    def get_queryset(self):
        """Return base queryset — RLS policies enforce tenant isolation at DB level."""
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
    WIRE_2_DAY_PRIOR = "Wire 2 day prior", "Wire 2 day prior"
    WIRE_3_DAY_PRIOR = "Wire 3 day prior", "Wire 3 day prior"
    WIRE_4_DAY_PRIOR = "Wire 4 day prior", "Wire 4 day prior"
    WIRE_5_DAY_PRIOR = "Wire 5 day prior", "Wire 5 day prior"
    ACH_1_DAY_PRIOR = "ACH 1 day prior", "ACH 1 day prior"
    ACH_2_DAY_PRIOR = "ACH 2 day prior", "ACH 2 day prior"
    ACH_3_DAY_PRIOR = "ACH 3 day prior", "ACH 3 day prior"
    ACH_4_DAY_PRIOR = "ACH 4 day prior", "ACH 4 day prior"
    NET_5_DAYS = "Net 5 days", "Net 5 days"
    NET_7_DAYS = "Net 7 days", "Net 7 days"
    NET_10_DAYS = "Net 10 days", "Net 10 days"
    NET_14_DAYS = "Net 14 days", "Net 14 days"
    NET_30_DAYS = "Net 30 days", "Net 30 days"
    # Legacy values kept for backward compatibility with existing records.
    NET_7 = "Net 7", "Net 7"
    NET_15 = "Net 15", "Net 15"
    NET_30 = "Net 30", "Net 30"
    NET_45 = "Net 45", "Net 45"
    NET_60 = "Net 60", "Net 60"


class AccountLineOfCreditChoices(models.TextChoices):
    """Common choices for line of credit amounts."""

    AMOUNT_50K = "$50K", "$50K"
    RANGE_50K_100K_SHORT = "50K-100K", "50K-100K"
    RANGE_100K_150K = "100K-150K", "100K-150K"
    RANGE_150K_200K = "150K-200K", "150K-200K"
    ETC = "Etc.", "Etc."
    WIRE = "Wire", "Wire"
    # Legacy values kept for backward compatibility with existing records.
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
    FOWL = "Fowl", "Fowl"
    TURKEY = "Turkey", "Turkey"
    LAMB = "Lamb", "Lamb"
    VEAL = "Veal", "Veal"
    SEAFOOD = "Seafood", "Seafood"
    VENISON = "Venison", "Venison"
    BISON = "Bison", "Bison"
    DUCK = "Duck", "Duck"
    RABBIT = "Rabbit", "Rabbit"
    GOAT = "Goat", "Goat"
    MUTTON = "Mutton", "Mutton"
    PORK = "Pork", "Pork"
    # Legacy values kept for backward compatibility with existing records/integrations.
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
    BOXED_POLY = "Boxed Poly", "Boxed Poly"
    COMBOS = "Combos", "Combos"
    NUDE_BLOCK = "Nude Block", "Nude Block"
    BOXED_COV = "Boxed COV", "Boxed COV"
    BOXED_CO2 = "Boxed CO2", "Boxed CO2"
    # Legacy values kept for backward compatibility with existing records.
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
    FCFS = "FCFS", "FCFS"
    # Legacy value kept for backward compatibility with existing records.
    FAX = "Fax", "Fax"
    FIRST_COME_FIRST_SERVE = "First Come First Serve", "First Come First Serve"


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
    THIRTY_DAY_NEWER = "30 day newer", "30 day newer"
    TWO_MONTH_NEWER = "2 month newer", "2 month newer"
    THREE_MONTH_NEWER = "3 month newer", "3 month newer"
    SIX_MONTH_NEWER = "6 month newer", "6 month newer"
    TWELVE_MONTH_NEWER = "12 month newer", "12 month newer"
    # Legacy value kept for backward compatibility with existing records.
    FIFTEEN_DAY_NEWER = "15 day newer", "15 day newer"


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
        regex=r"^\+?1?\d{9,15}$",
        message="Phone number must be entered in a valid format (e.g., +15551234567 or 5551234567)",
    )

    # Contact information fields
    ap_contact_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Accounts Payable contact name",
        verbose_name="AP Contact Name",
    )
    ap_phone = models.CharField(
        max_length=20,
        blank=True,
        default="",
        validators=[phone_validator],
        help_text="Accounts Payable phone number",
        verbose_name="AP Phone",
    )
    ap_email = models.EmailField(
        blank=True, default="", help_text="Accounts Payable email address", verbose_name="AP Email"
    )
    corp_address = models.TextField(
        blank=True,
        default="",
        help_text="Corporate address (full address including street, city, state, zip)",
        verbose_name="Corporate Address",
    )

    class Meta:
        abstract = True


class TenantAwareModel(TimestampModel):
    """
    Abstract base model for tenant-aware entities.

    Provides tenant isolation via ForeignKey and dynamic schema extension
    through custom_data JSONB field for System Blueprint features.
    """

    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE, help_text="Tenant this entity belongs to")

    custom_data = models.JSONField(
        default=dict, blank=True, help_text="Extensible schema data for dynamic fields defined in Blueprints."
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
        User, on_delete=models.CASCADE, related_name="preferences", help_text="User for these preferences"
    )

    # Theme preferences
    theme = models.CharField(
        max_length=20,
        choices=[
            ("light", "Light"),
            ("dark", "Dark"),
            ("auto", "Auto"),
        ],
        default="light",
        help_text="UI theme preference",
    )

    # Layout and widget configuration (JSON format)
    dashboard_layout = models.JSONField(default=dict, blank=True, help_text="Dashboard widget layout configuration")

    sidebar_collapsed = models.BooleanField(default=False, help_text="Whether sidebar is collapsed by default")

    # Quick menu favorites (stored as list of route paths)
    quick_menu_items = models.JSONField(default=list, blank=True, help_text="User's favorite quick menu items")

    # Custom widget settings
    widget_preferences = models.JSONField(
        default=dict, blank=True, help_text="Widget-specific preferences and configurations"
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
        User, on_delete=models.CASCADE, related_name="favorites", help_text="User who favorited this entity"
    )
    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="user_favorites",
        help_text="Tenant context for this favorite",
    )
    entity_type = models.CharField(
        max_length=50, db_index=True, help_text="Type of entity (customer, supplier, product, etc.)"
    )
    entity_id = models.IntegerField(help_text="ID of the favorited entity")
    entity_title = models.CharField(max_length=255, blank=True, help_text="Cached title for display")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, help_text="When this was favorited")

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "tenant", "entity_type", "entity_id"], name="unique_user_tenant_favorite"
            )
        ]
        indexes = [
            models.Index(fields=["user", "-created_at"], name="core_userfa_user_created_idx"),
            models.Index(fields=["user", "tenant", "entity_type"], name="core_userfa_user_entity_idx"),
        ]
        verbose_name = "User Favorite"
        verbose_name_plural = "User Favorites"

    def __str__(self):
        return f"{self.user.username}'s favorite: {self.entity_type} #{self.entity_id}"


class TenantAuditEvent(models.Model):
    """Append-only audit events for compliance/traceability.

    Tracks changes across tenant-aware entities via a GenericForeignKey.

    IMPORTANT: Treat as immutable. API surfaces MUST be read-only.
    """

    class Action(models.TextChoices):
        CREATE = "CREATE", "Created"
        UPDATE = "UPDATE", "Updated"
        DELETE = "DELETE", "Deleted"
        ACCESS = "ACCESS", "Accessed"

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="audit_events",
        db_index=True,
    )

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=255, db_index=True)
    content_object = GenericForeignKey("content_type", "object_id")

    entity_type = models.CharField(max_length=100, db_index=True)
    entity_name = models.CharField(max_length=255, blank=True, default="")

    action = models.CharField(max_length=10, choices=Action.choices)

    changed_fields = models.JSONField(null=True, blank=True)
    snapshot_before = models.JSONField(null=True, blank=True)
    snapshot_after = models.JSONField(null=True, blank=True)

    actor = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tenant_audit_events",
    )
    actor_email = models.EmailField(blank=True, default="")

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant", "-created_at"], name="core_audit_tenant_created_idx"),
            models.Index(fields=["entity_type", "object_id"], name="core_audit_entity_obj_idx"),
            models.Index(fields=["action", "-created_at"], name="core_audit_action_created_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.tenant_id} {self.action} {self.entity_type}:{self.object_id}"


class ETLImportBatch(TenantAwareModel):
    """Restart-safe tenant-scoped ETL dry-run batches."""

    class Mode(models.TextChoices):
        DRY_RUN = "dry_run", "Dry Run"
        APPLY_MASTER_DATA = "apply_master_data", "Apply Master Data"
        APPLY_TRANSACTIONS = "apply_transactions", "Apply Transactions"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run_key = models.CharField(
        max_length=64,
        db_index=True,
        help_text="Deterministic batch key derived from tenant + manifest checksum + dry-run options.",
    )
    mode = models.CharField(max_length=20, choices=Mode.choices, default=Mode.DRY_RUN)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    source_manifest = models.JSONField(default=dict, blank=True)
    manifest_checksum = models.CharField(max_length=64, blank=True, default="")
    command_options = models.JSONField(default=dict, blank=True)
    resume_cursor = models.JSONField(default=dict, blank=True)
    summary = models.JSONField(default=dict, blank=True)
    failure_message = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_checkpoint_at = models.DateTimeField(null=True, blank=True)
    total_rows = models.PositiveIntegerField(default=0)
    processed_rows = models.PositiveIntegerField(default=0)
    would_create_count = models.PositiveIntegerField(default=0)
    would_update_count = models.PositiveIntegerField(default=0)
    would_skip_count = models.PositiveIntegerField(default=0)
    error_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_on"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "run_key"],
                name="core_etlb_tenant_run_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "status", "-created_on"], name="core_etlb_tenant_status_idx"),
            models.Index(fields=["tenant", "manifest_checksum"], name="core_etlb_manifest_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.tenant_id} {self.mode} {self.run_key}"


class ETLImportRowJournal(TenantAwareModel):
    """Row-level dry-run journal entries for a single ETL batch."""

    class PlannedAction(models.TextChoices):
        WOULD_CREATE = "would_create", "Would Create"
        WOULD_UPDATE = "would_update", "Would Update"
        WOULD_SKIP = "would_skip", "Would Skip"
        ERROR = "error", "Error"

    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        ERROR = "error", "Error"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(
        ETLImportBatch,
        on_delete=models.CASCADE,
        related_name="row_journals",
        help_text="Owning ETL dry-run batch.",
    )
    entity = models.CharField(max_length=100, db_index=True)
    source_path = models.CharField(max_length=500)
    source_sheet = models.CharField(max_length=255, blank=True, default="")
    source_row_number = models.PositiveIntegerField()
    source_identifier = models.CharField(max_length=255, blank=True, default="")
    normalized_lookup_key = models.CharField(max_length=255, blank=True, default="")
    row_fingerprint = models.CharField(max_length=64, blank=True, default="", db_index=True)
    planned_action = models.CharField(max_length=20, choices=PlannedAction.choices, db_index=True)
    target_model = models.CharField(max_length=255, blank=True, default="")
    target_identifier = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    error_code = models.CharField(max_length=100, blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    side_effects_suppressed = models.JSONField(default=list, blank=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    normalized_payload = models.JSONField(default=dict, blank=True)
    warnings = models.JSONField(default=list, blank=True)
    processed_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["batch_id", "entity", "source_row_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["batch", "entity", "source_path", "source_sheet", "source_row_number"],
                name="core_etlr_batch_source_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "batch", "planned_action"], name="core_etlr_batch_action_idx"),
            models.Index(fields=["tenant", "entity", "row_fingerprint"], name="core_etlr_entity_fp_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.batch_id} {self.entity} row {self.source_row_number}"


class ArchiveLegalHold(TenantAwareModel):
    """Tenant-scoped legal holds that block archive processing for selected records."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scope_model = models.CharField(max_length=255, db_index=True)
    scope_selector = models.JSONField(default=dict, blank=True)
    reason_code = models.CharField(max_length=100)
    notes = models.TextField(blank=True, default="")
    placed_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="archive_legal_holds_placed",
    )
    placed_by_email = models.EmailField(blank=True, default="")
    placed_at = models.DateTimeField(default=timezone.now, db_index=True)
    released_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="archive_legal_holds_released",
    )
    released_by_email = models.EmailField(blank=True, default="")
    released_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["-placed_at", "-created_on"]
        indexes = [
            models.Index(fields=["tenant", "scope_model", "released_at"], name="core_archhold_scope_idx"),
            models.Index(fields=["tenant", "-placed_at"], name="core_archhold_tenant_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.tenant_id} hold {self.scope_model}"


class ArchiveBatch(TenantAwareModel):
    """Tenant-scoped archive execution batches."""

    class Mode(models.TextChoices):
        DRY_RUN = "dry_run", "Dry Run"
        EXECUTE = "execute", "Execute"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run_key = models.CharField(max_length=64, db_index=True)
    mode = models.CharField(max_length=20, choices=Mode.choices, default=Mode.DRY_RUN)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    cutoff_date = models.DateField(db_index=True)
    command_options = models.JSONField(default=dict, blank=True)
    summary = models.JSONField(default=dict, blank=True)
    failure_message = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    requested_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="archive_batches_requested",
    )
    requested_by_email = models.EmailField(blank=True, default="")
    approved_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="archive_batches_approved",
    )
    approved_by_email = models.EmailField(blank=True, default="")
    dry_run_record_count = models.PositiveIntegerField(default=0)
    archived_record_count = models.PositiveIntegerField(default=0)
    legal_hold_skip_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_on"]
        constraints = [
            models.UniqueConstraint(fields=["tenant", "run_key"], name="core_archbatch_tenant_run_uniq"),
        ]
        indexes = [
            models.Index(fields=["tenant", "status", "-created_on"], name="core_archbatch_status_idx"),
            models.Index(fields=["tenant", "cutoff_date"], name="core_archbatch_cutoff_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.tenant_id} {self.mode} {self.cutoff_date}"


class ArchiveRecordSnapshot(TenantAwareModel):
    """Snapshot evidence for one archived record within an archive batch."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(
        ArchiveBatch,
        on_delete=models.CASCADE,
        related_name="snapshots",
        help_text="Owning archive batch.",
    )
    model_label = models.CharField(max_length=255, db_index=True)
    archive_class = models.CharField(max_length=100, db_index=True)
    object_pk = models.CharField(max_length=255, db_index=True)
    parent_model_label = models.CharField(max_length=255, blank=True, default="")
    parent_object_pk = models.CharField(max_length=255, blank=True, default="")
    retention_basis_date = models.DateField(null=True, blank=True)
    snapshot_payload = models.JSONField(default=dict, blank=True)
    payload_checksum = models.CharField(max_length=64, blank=True, default="", db_index=True)

    class Meta:
        ordering = ["batch_id", "model_label", "object_pk"]
        constraints = [
            models.UniqueConstraint(
                fields=["batch", "model_label", "object_pk"],
                name="core_archsnap_batch_model_obj_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "batch", "model_label"], name="core_archsnap_batch_model_idx"),
            models.Index(fields=["tenant", "retention_basis_date"], name="core_archsnap_retention_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.batch_id} {self.model_label}:{self.object_pk}"


class PortalGrant(TenantAwareModel):
    """Tenant-scoped signed grants for future read-only B2B portal access."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CONSUMED = "consumed", "Consumed"
        REVOKED = "revoked", "Revoked"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject_email = models.EmailField(db_index=True)
    token_hash = models.CharField(
        max_length=64,
        help_text="SHA-256 digest of the opaque grant secret. Raw tokens are never stored.",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    resource_scope = models.JSONField(
        default=dict,
        blank=True,
        help_text="Tenant-explicit record scope keyed by entity type.",
    )
    document_sources = models.JSONField(
        default=list,
        blank=True,
        help_text="Allowed guest-safe document source categories for this grant.",
    )
    expires_at = models.DateTimeField(db_index=True)
    revoked_at = models.DateTimeField(null=True, blank=True, db_index=True)
    revoked_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="portal_grants_revoked",
    )
    revoked_reason = models.CharField(max_length=255, blank=True, default="")
    created_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="portal_grants_created",
    )
    last_accessed_at = models.DateTimeField(null=True, blank=True)
    max_uses = models.PositiveIntegerField(default=1)
    use_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_on"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(max_uses__gte=1),
                name="core_pgrant_max_uses_gte_1",
            ),
            models.UniqueConstraint(fields=["tenant", "token_hash"], name="core_pgrant_tenant_hash_uniq"),
        ]
        indexes = [
            models.Index(fields=["tenant", "status", "expires_at"], name="core_pgrant_status_idx"),
            models.Index(fields=["tenant", "subject_email"], name="core_pgrant_subject_idx"),
            models.Index(fields=["tenant", "revoked_at"], name="core_pgrant_revoke_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.tenant_id} {self.subject_email} {self.status}"

    def clean(self):
        super().clean()

        if not isinstance(self.resource_scope, dict) or not self.resource_scope:
            raise ValidationError({"resource_scope": "Portal grants require at least one scoped entity."})

        unsupported_scopes = set(self.resource_scope.keys()) - set(B2B_PORTAL_ALLOWED_ENTITY_SCOPES)
        if unsupported_scopes:
            raise ValidationError(
                {"resource_scope": f"Unsupported portal entity scopes: {', '.join(sorted(unsupported_scopes))}."}
            )

        if not isinstance(self.document_sources, list) or not self.document_sources:
            raise ValidationError({"document_sources": "Portal grants require at least one document source."})

        unsupported_sources = set(self.document_sources) - set(B2B_PORTAL_ALLOWED_DOCUMENT_SOURCES)
        if unsupported_sources:
            raise ValidationError(
                {
                    "document_sources": (
                        "Unsupported portal document sources: " f"{', '.join(sorted(unsupported_sources))}."
                    )
                }
            )

        if self.max_uses < 1:
            raise ValidationError({"max_uses": "Portal grants must allow at least one use."})

    def issue_token(self, raw_token: str | None = None) -> str:
        """Generate or assign a raw portal token and store only its digest."""
        raw_token = raw_token or secrets.token_urlsafe(48)
        self.token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        return raw_token

    def token_matches(self, raw_token: str) -> bool:
        """Check a raw token against the persisted SHA-256 digest."""
        expected = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        return hmac.compare_digest(self.token_hash, expected)

    @property
    def is_expired(self) -> bool:
        """Return True when the grant is no longer within its TTL window."""
        return timezone.now() >= self.expires_at

    @property
    def is_active(self) -> bool:
        """Return True when the grant can still authorize a portal read."""
        if self.status != self.Status.ACTIVE:
            return False
        if self.revoked_at is not None or self.is_expired:
            return False
        return self.use_count < self.max_uses

    def revoke(self, *, user: User | None = None, reason: str = "") -> None:
        """Revoke this grant and persist the evidence fields."""
        self.status = self.Status.REVOKED
        self.revoked_at = timezone.now()
        self.revoked_by = user
        self.revoked_reason = reason

    def mark_accessed(self) -> None:
        """Record a portal read and consume one bounded-use slot."""
        self.use_count += 1
        self.last_accessed_at = timezone.now()
        if self.use_count >= self.max_uses:
            self.status = self.Status.CONSUMED

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class PortalDocumentReference(TenantAwareModel):
    """Curated registry entry for a portal-safe document or status artifact."""

    class SourceKind(models.TextChoices):
        INVOICE_SUMMARY = "invoice_summary", "Invoice Summary"
        INVOICE_PDF = "invoice_pdf", "Invoice PDF"
        SALES_ORDER_STATUS = "sales_order_status", "Sales Order Status"
        PURCHASE_ORDER_STATUS = "purchase_order_status", "Purchase Order Status"
        FULFILLMENT_TRACKING = "fulfillment_tracking", "Fulfillment Tracking"
        FULFILLMENT_BOL = "fulfillment_bol", "Fulfillment BOL"
        FULFILLMENT_POD = "fulfillment_pod", "Fulfillment POD"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source_kind = models.CharField(max_length=50, choices=SourceKind.choices, db_index=True)
    source_record_type = models.CharField(max_length=100, db_index=True)
    source_record_id = models.CharField(max_length=255, db_index=True)
    display_name = models.CharField(max_length=255)
    original_filename = models.CharField(max_length=255, blank=True, default="")
    mime_type = models.CharField(max_length=100, blank=True, default="")
    byte_size = models.PositiveBigIntegerField(default=0)
    checksum = models.CharField(max_length=64, blank=True, default="", db_index=True)
    storage_backend = models.CharField(
        max_length=100,
        blank=True,
        default="default",
        help_text="Internal storage backend identifier. Do not expose in portal serializers.",
    )
    storage_key = models.CharField(
        max_length=500,
        help_text="Internal-only storage locator. Never expose to portal clients.",
    )
    metadata = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    published_at = models.DateTimeField(default=timezone.now, db_index=True)
    created_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="portal_document_references_created",
    )

    class Meta:
        ordering = ["-published_at", "-created_on"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "storage_backend", "storage_key"],
                name="core_pdocref_tenant_key_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "source_kind", "published_at"], name="core_pdocref_source_idx"),
            models.Index(
                fields=["tenant", "source_record_type", "source_record_id"],
                name="core_pdocref_record_idx",
            ),
            models.Index(fields=["tenant", "is_active", "published_at"], name="core_pdocref_active_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.tenant_id} {self.source_kind} {self.display_name}"


class PortalGrantDocumentAccess(TenantAwareModel):
    """Explicit tenant-scoped link between a portal grant and curated document rows."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    grant = models.ForeignKey(
        PortalGrant,
        on_delete=models.CASCADE,
        related_name="document_links",
        help_text="Portal grant that may expose this curated document.",
    )
    document_reference = models.ForeignKey(
        PortalDocumentReference,
        on_delete=models.CASCADE,
        related_name="grant_links",
        help_text="Curated portal-safe document registry entry.",
    )
    linked_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="portal_grant_document_links_created",
    )
    linked_at = models.DateTimeField(default=timezone.now)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["grant_id", "sort_order", "created_on"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "grant", "document_reference"],
                name="core_pgrantdoc_tenant_link_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "grant", "sort_order"], name="core_pgrantdoc_grant_idx"),
            models.Index(fields=["tenant", "document_reference"], name="core_pgrantdoc_doc_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.grant_id} -> {self.document_reference_id}"

    def clean(self):
        super().clean()
        if not self.grant_id or not self.document_reference_id:
            return

        if self.grant.tenant_id != self.document_reference.tenant_id:
            raise ValidationError("Portal grant/document link must stay within one tenant.")

        if self.tenant_id and self.tenant_id != self.grant.tenant_id:
            raise ValidationError("Portal grant/document link tenant must match the linked grant.")

    def save(self, *args, **kwargs):
        if self.grant_id:
            self.tenant_id = self.grant.tenant_id
        self.full_clean()
        super().save(*args, **kwargs)


class Comment(TenantAwareModel):
    """Universal tenant-scoped comments attachable to supported entities."""

    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        help_text="Type of entity this comment belongs to",
    )
    object_id = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Primary key of the related entity",
    )
    content_object = GenericForeignKey("content_type", "object_id")

    entity_type = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Canonical entity type slug",
    )
    body = models.TextField(help_text="Comment body")
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="core_comments",
        help_text="User who authored this comment",
    )
    mentions = models.JSONField(
        default=list,
        blank=True,
        help_text="Mentioned tenant user ids",
    )

    class Meta:
        ordering = ["-created_on"]
        indexes = [
            models.Index(fields=["tenant", "entity_type", "object_id"]),
            models.Index(fields=["tenant", "-created_on"]),
            models.Index(fields=["content_type", "object_id"]),
        ]

    def __str__(self):
        return f"{self.entity_type}:{self.object_id} comment #{self.pk}"


class IdempotencyKey(TenantAwareModel):
    """Tenant-scoped request deduplication records for write endpoints."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    idempotency_key = models.CharField(
        max_length=255,
        help_text="Caller-supplied Idempotency-Key header value",
    )
    request_method = models.CharField(
        max_length=10,
        help_text="HTTP method for the original mutation request",
    )
    request_path = models.CharField(
        max_length=255,
        help_text="Canonical request path used for idempotency scoping",
    )
    request_fingerprint = models.CharField(
        max_length=64,
        help_text="SHA-256 fingerprint of the request payload",
    )
    response_status = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Cached HTTP status for completed idempotent responses",
    )
    response_body = models.JSONField(
        null=True,
        blank=True,
        help_text="Cached JSON response payload for completed requests",
    )
    locked_until = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Lease expiration for in-flight requests using this key",
    )

    class Meta:
        ordering = ["-created_on"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "idempotency_key"],
                name="core_idempotencykey_tenant_key_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "idempotency_key"]),
            models.Index(fields=["tenant", "locked_until"]),
            models.Index(fields=["tenant", "-created_on"]),
        ]

    def __str__(self):
        return f"{self.tenant_id}:{self.idempotency_key}"


# ---------------------------------------------------------------------------
# TradeEventLog — Durable storage for domain events (CTE-06.1)
# ---------------------------------------------------------------------------


class TradeEventLog(TenantAwareModel):
    """Durable log of domain events for the trading engine.

    Stores every trade-state transition event for audit, replay,
    and saga consumer processing. Events are immutable once stored.
    """

    event_id = models.CharField(
        max_length=36,
        unique=True,
        help_text="Unique UUID for this event instance.",
    )
    event_type = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Canonical event type (e.g., 'supplier_po.approved').",
    )
    trade_session_id = models.BigIntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text="FK to TradeSession (stored as int for flexibility).",
    )
    trade_id = models.CharField(
        max_length=50,
        blank=True,
        default="",
        db_index=True,
        help_text="Human-readable trade ID (TRD-YYYY-NNNNN).",
    )
    entity_type = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Source entity class name.",
    )
    entity_id = models.CharField(
        max_length=36,
        blank=True,
        default="",
        help_text="Source entity PK.",
    )
    actor_user_id = models.CharField(
        max_length=36,
        blank=True,
        default="",
        help_text="User who triggered the event.",
    )
    payload = models.JSONField(
        default=dict,
        blank=True,
        help_text="Full serialized event payload.",
    )
    route_decision = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="FULFILL or BROKER route.",
    )
    processed = models.BooleanField(
        default=False,
        help_text="Whether this event has been consumed by saga handlers.",
    )
    processed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this event was processed.",
    )

    class Meta:
        ordering = ["-created_on"]
        verbose_name = "Trade Event Log"
        verbose_name_plural = "Trade Event Logs"
        indexes = [
            models.Index(fields=["tenant", "event_type"]),
            models.Index(fields=["tenant", "trade_session_id"]),
            models.Index(fields=["tenant", "trade_id"]),
            models.Index(fields=["tenant", "processed", "-created_on"]),
        ]

    def __str__(self):
        return f"{self.event_type} [{self.event_id[:8]}]"


# ---------------------------------------------------------------------------
# TradeExceptionQueue — Dead-letter queue for failed trade steps (CTE-08.1)
# ---------------------------------------------------------------------------


class TradeExceptionQueue(TenantAwareModel):
    """Dead-letter queue for failed automated trade steps.

    Records failures with full context for operator investigation and retry.
    Halts the affected trade session until resolved.
    """

    EXCEPTION_STATUS_CHOICES = [
        ("open", "Open"),
        ("retrying", "Retrying"),
        ("resolved", "Resolved"),
        ("exhausted", "Max Retries Exhausted"),
    ]

    trade_session_id = models.BigIntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text="FK to TradeSession (stored as int for flexibility).",
    )
    trade_id = models.CharField(
        max_length=50,
        blank=True,
        default="",
        db_index=True,
        help_text="Human-readable trade ID (TRD-YYYY-NNNNN).",
    )
    failed_step = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Step identifier that failed (e.g., 'sales_order.pdf_generation').",
    )
    reason_code = models.CharField(
        max_length=50,
        default="UNKNOWN",
        db_index=True,
        help_text="Classification code for the failure type.",
    )
    error_message = models.TextField(
        blank=True,
        default="",
        help_text="Human-readable error description.",
    )
    stack_trace = models.TextField(
        blank=True,
        default="",
        help_text="Python stack trace (truncated to 2000 chars).",
    )
    entity_type = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Entity being operated on when failure occurred.",
    )
    entity_id = models.CharField(
        max_length=36,
        blank=True,
        default="",
        help_text="Entity PK.",
    )
    source_event_id = models.CharField(
        max_length=36,
        blank=True,
        default="",
        help_text="Domain event that triggered the failed step.",
    )
    context_payload = models.JSONField(
        default=dict,
        blank=True,
        help_text="Full context for debugging and retry.",
    )
    status = models.CharField(
        max_length=20,
        choices=EXCEPTION_STATUS_CHOICES,
        default="open",
        db_index=True,
    )
    retry_count = models.PositiveSmallIntegerField(
        default=0,
        help_text="Number of retry attempts.",
    )
    last_retry_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    resolved_by = models.CharField(
        max_length=36,
        blank=True,
        default="",
        help_text="User ID who resolved this exception.",
    )
    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    resolution_notes = models.TextField(
        blank=True,
        default="",
        help_text="Operator notes on how the issue was resolved.",
    )

    class Meta:
        ordering = ["-created_on"]
        verbose_name = "Trade Exception Queue"
        verbose_name_plural = "Trade Exception Queue"
        indexes = [
            models.Index(fields=["tenant", "status", "-created_on"]),
            models.Index(fields=["tenant", "trade_session_id"]),
            models.Index(fields=["tenant", "reason_code"]),
        ]

    def __str__(self):
        return f"[{self.status}] {self.failed_step} - {self.error_message[:50]}"


class RuntimeErrorLog(TimestampModel):
    """Persists frontend/backend runtime errors for diagnostics.

    NOT tenant-aware — errors can occur before tenant context is established.
    Optional tenant_id stored as metadata for filtering.
    Old entries are auto-pruned by management command or DB job.
    """

    LEVEL_CHOICES = [
        ("error", "Error"),
        ("warn", "Warning"),
        ("fatal", "Fatal"),
    ]

    SOURCE_CHOICES = [
        ("frontend", "Frontend"),
        ("backend", "Backend"),
        ("api", "API"),
    ]

    level = models.CharField(
        max_length=10,
        choices=LEVEL_CHOICES,
        default="error",
        db_index=True,
    )
    source = models.CharField(
        max_length=10,
        choices=SOURCE_CHOICES,
        default="frontend",
        db_index=True,
    )
    message = models.TextField(help_text="Error message (truncated to 2000 chars).")
    stack_trace = models.TextField(
        blank=True, default="", help_text="Stack trace if available."
    )
    component = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
        help_text="Component/module where error occurred.",
    )
    url = models.URLField(
        max_length=2048,
        blank=True,
        default="",
        help_text="Page URL when error occurred.",
    )
    user_agent = models.CharField(
        max_length=512,
        blank=True,
        default="",
        help_text="Browser user agent string.",
    )
    tenant_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Tenant context (if available when error occurred).",
    )
    user_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="User ID (if authenticated when error occurred).",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional context (API status, request method, etc.).",
    )
    fingerprint = models.CharField(
        max_length=64,
        blank=True,
        default="",
        db_index=True,
        help_text="SHA-256 hash for deduplication.",
    )
    occurrence_count = models.PositiveIntegerField(
        default=1,
        help_text="Number of times this exact error has been seen.",
    )

    class Meta:
        ordering = ["-created_on"]
        indexes = [
            models.Index(fields=["-created_on"]),
            models.Index(fields=["source", "level", "-created_on"]),
            models.Index(fields=["fingerprint"]),
        ]

    def __str__(self):
        return f"[{self.level}/{self.source}] {self.message[:80]}"
