"""Shared additive schema mixins for golden document models."""

from django.db import models

from apps.core.models import (
    AccountingPaymentTermsChoices,
    AccountLineOfCreditChoices,
    AppointmentMethodChoices,
    CarrierReleaseFormatChoices,
    CreditLimitChoices,
    EdibleInedibleChoices,
    FreshOrFrozenChoices,
    NetOrCatchChoices,
    PackageTypeChoices,
    ProteinTypeChoices,
    TenantAwareModel,
    WeightUnitChoices,
)


def sync_alias_pair(instance: models.Model, canonical_name: str, alias_name: str) -> None:
    """Keep canonical and legacy alias fields in sync without overwriting data."""

    if not hasattr(instance, canonical_name) or not hasattr(instance, alias_name):
        return

    canonical_value = getattr(instance, canonical_name)
    alias_value = getattr(instance, alias_name)

    if canonical_value in ("", None) and alias_value not in ("", None):
        setattr(instance, canonical_name, alias_value)
    elif alias_value in ("", None) and canonical_value not in ("", None):
        setattr(instance, alias_name, canonical_value)


class ContactSnapshotMixin(models.Model):
    """Immutable contact snapshot for printed document contexts."""

    contact_name = models.CharField(max_length=255, blank=True, default="")
    contact_phone = models.CharField(max_length=20, blank=True, default="")
    contact_email = models.EmailField(blank=True, default="")
    contact_title = models.CharField(max_length=100, blank=True, default="")

    class Meta:
        abstract = True


class AddressSnapshotMixin(models.Model):
    """Immutable address snapshot for printed document contexts."""

    address_street = models.CharField(max_length=255, blank=True, default="")
    address_city = models.CharField(max_length=100, blank=True, default="")
    address_state_zip = models.CharField(max_length=100, blank=True, default="")
    building_name = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        abstract = True


class BillingContactSnapshotMixin(models.Model):
    """Frozen billing contact details for document headers."""

    billing_contact_name = models.CharField(max_length=255, blank=True, default="")
    billing_contact_phone = models.CharField(max_length=20, blank=True, default="")
    billing_contact_email = models.EmailField(blank=True, default="")
    billing_contact_title = models.CharField(max_length=100, blank=True, default="")

    class Meta:
        abstract = True


class BillingAddressSnapshotMixin(models.Model):
    """Frozen billing address details for document headers."""

    billing_address_street = models.CharField(max_length=255, blank=True, default="")
    billing_address_city = models.CharField(max_length=100, blank=True, default="")
    billing_address_state_zip = models.CharField(max_length=100, blank=True, default="")
    billing_building_name = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        abstract = True


class ShippingContactSnapshotMixin(models.Model):
    """Frozen shipping contact details for document headers."""

    shipping_contact_name = models.CharField(max_length=255, blank=True, default="")
    shipping_contact_phone = models.CharField(max_length=20, blank=True, default="")
    shipping_contact_email = models.EmailField(blank=True, default="")
    shipping_contact_title = models.CharField(max_length=100, blank=True, default="")

    class Meta:
        abstract = True


class ShippingAddressSnapshotMixin(models.Model):
    """Frozen shipping address details for document headers."""

    shipping_address_street = models.CharField(max_length=255, blank=True, default="")
    shipping_address_city = models.CharField(max_length=100, blank=True, default="")
    shipping_address_state_zip = models.CharField(max_length=100, blank=True, default="")
    shipping_building_name = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        abstract = True


class AccountsPayableContactSnapshotMixin(models.Model):
    """Frozen AP contact details for invoices and vendor-facing documents."""

    accounting_payable_contact_name = models.CharField(max_length=255, blank=True, default="")
    accounting_payable_contact_phone = models.CharField(max_length=20, blank=True, default="")
    accounting_payable_contact_email = models.EmailField(blank=True, default="")
    accounting_payable_contact_title = models.CharField(max_length=100, blank=True, default="")

    class Meta:
        abstract = True


class FinancialTermsMixin(models.Model):
    """Canonical financial terms with additive syncing to legacy aliases."""

    payment_terms = models.CharField(
        max_length=50,
        choices=AccountingPaymentTermsChoices.choices,
        blank=True,
        null=True,
        default="",
    )
    credit_limit = models.CharField(
        max_length=50,
        choices=CreditLimitChoices.choices,
        blank=True,
        null=True,
        default="",
    )
    account_line_of_credit = models.CharField(
        max_length=50,
        choices=AccountLineOfCreditChoices.choices,
        blank=True,
        null=True,
        default="",
    )

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        sync_alias_pair(self, "payment_terms", "accounting_payment_terms")
        sync_alias_pair(self, "credit_limit", "credit_limits")
        sync_alias_pair(self, "account_line_of_credit", "accounting_line_of_credit")
        super().save(*args, **kwargs)


class LogisticsMixin(models.Model):
    """Canonical logistics fields with additive syncing to legacy aliases."""

    pick_up_date = models.DateField(blank=True, null=True)
    delivery_date = models.DateField(blank=True, null=True)
    carrier_release_format = models.CharField(
        max_length=100,
        choices=CarrierReleaseFormatChoices.choices,
        blank=True,
        default="",
    )
    carrier_release_number = models.CharField(max_length=100, blank=True, default="")
    how_to_make_appointment = models.CharField(
        max_length=50,
        choices=AppointmentMethodChoices.choices,
        blank=True,
        default="",
    )

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        sync_alias_pair(self, "carrier_release_number", "carrier_release_num")
        sync_alias_pair(self, "how_to_make_appointment", "how_carrier_make_appointment")
        super().save(*args, **kwargs)


class BaseLineItem(TenantAwareModel):
    """Canonical tenant-aware transactional line item."""

    protein_type = models.CharField(
        max_length=50,
        choices=ProteinTypeChoices.choices,
        blank=True,
        default="",
    )
    product_description = models.ForeignKey(
        "system.Product",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="%(app_label)s_%(class)s_product_descriptions",
    )
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
    quantity = models.IntegerField(blank=True, null=True)
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
    total_net_weight = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
    )

    class Meta:
        abstract = True


# ==============================================================================
# Phase 10: Canonical Business Entity Consolidation Mixins
# ==============================================================================
# These mixins provide DRY, reusable field sets and helper methods for
# business entities. Use for NEW models or when refactoring existing ones.
# Existing models continue to work unchanged (additive only).
# ==============================================================================


class AddressMixin(models.Model):
    """Canonical mutable address fields for live business entities.

    Use for: Supplier, Customer, Carrier, Plant, Location, Warehouse.
    (Distinct from AddressSnapshotMixin which is for immutable document contexts.)

    Field naming convention matches existing patterns across all entity models.
    """

    address = models.TextField(blank=True, default="", help_text="Full address or street address")
    city = models.CharField(max_length=100, blank=True, default="")
    state = models.CharField(max_length=100, blank=True, default="")
    zip_code = models.CharField(max_length=20, blank=True, default="")
    country = models.CharField(max_length=100, default="USA")

    class Meta:
        abstract = True

    @property
    def full_address(self) -> str:
        """Human-readable single-line address."""
        parts = [
            self.address,
            self.city,
            f"{self.state} {self.zip_code}".strip() if self.state or self.zip_code else "",
            self.country if self.country != "USA" else "",
        ]
        return ", ".join(p for p in parts if p)

    @property
    def has_address(self) -> bool:
        """Check if at least city+state are populated."""
        return bool(self.city and self.state)


class BusinessPartyMixin(models.Model):
    """Canonical fields for any business party (Customer, Supplier, Carrier).

    Captures the shared party identity: name, primary contact, phone, email,
    active status, and a classification/type field.

    Use this as a base for new party-like models or reference for existing ones.
    """

    # Shared party fields (already exist on Supplier/Customer/Carrier)
    # These are documented here as the canonical definition:
    # - name: CharField(max_length=255)
    # - contact_person: CharField (primary contact name)
    # - email: EmailField (primary email)
    # - phone: CharField (primary phone)
    # - is_active: BooleanField

    class Meta:
        abstract = True

    @classmethod
    def get_party_type(cls) -> str:
        """Return the party type string for this model."""
        return cls.__name__.lower()

    def get_display_name(self) -> str:
        """Return the best display name for this party."""
        if hasattr(self, "name") and self.name:
            return self.name
        if hasattr(self, "contact_person") and self.contact_person:
            return self.contact_person
        return f"{self.__class__.__name__} #{self.pk}"

    def get_primary_email(self) -> str:
        """Return the primary email for this party."""
        for field in ("email", "ap_email", "contact_email"):
            val = getattr(self, field, None)
            if val:
                return val
        return ""

    def get_primary_phone(self) -> str:
        """Return the best phone number for this party."""
        for field in ("phone", "phone_office", "phone_mobile", "ap_phone"):
            val = getattr(self, field, None)
            if val:
                return val
        return ""


class WeightMeasurementMixin(models.Model):
    """Canonical weight and quantity fields for trade documents.

    Used by: PurchaseOrder, SalesOrder, Invoice, CarrierFreightInquiry, LineItems.
    Provides helper methods for weight conversion and display.
    """

    LBS_TO_KG = 0.453592
    KG_TO_LBS = 2.20462

    class Meta:
        abstract = True

    def get_weight_display(self) -> str:
        """Human-readable weight string (e.g., '5,000 LBS')."""
        weight = getattr(self, "total_weight", None) or getattr(self, "total_net_weight", None)
        unit = getattr(self, "weight_unit", None) or getattr(self, "uom", "LBS")
        if weight is None:
            return ""
        return f"{weight:,.2f} {unit}"

    def get_weight_in_lbs(self) -> float | None:
        """Return weight normalized to LBS."""
        weight = getattr(self, "total_weight", None) or getattr(self, "total_net_weight", None)
        if weight is None:
            return None
        unit = getattr(self, "weight_unit", None) or getattr(self, "uom", "LBS")
        if unit == "KG":
            return float(weight) * self.KG_TO_LBS
        return float(weight)

    def get_weight_in_kg(self) -> float | None:
        """Return weight normalized to KG."""
        weight = getattr(self, "total_weight", None) or getattr(self, "total_net_weight", None)
        if weight is None:
            return None
        unit = getattr(self, "weight_unit", None) or getattr(self, "uom", "LBS")
        if unit == "LBS":
            return float(weight) * self.LBS_TO_KG
        return float(weight)


class MonetaryFieldsMixin(models.Model):
    """Canonical monetary calculation helpers for order-like entities.

    Works with existing `total_amount` and `outstanding_amount` fields
    present on PurchaseOrder, SalesOrder, and Invoice models.
    """

    class Meta:
        abstract = True

    @property
    def is_fully_paid(self) -> bool:
        """Check if the outstanding amount is zero or negative."""
        outstanding = getattr(self, "outstanding_amount", None)
        if outstanding is None:
            return False
        return float(outstanding) <= 0

    @property
    def payment_percentage(self) -> float:
        """Calculate percentage paid (0.0 to 100.0)."""
        total = getattr(self, "total_amount", None)
        outstanding = getattr(self, "outstanding_amount", None)
        if not total or float(total) == 0:
            return 0.0
        if outstanding is None:
            return 0.0
        paid = float(total) - float(outstanding)
        return min(100.0, max(0.0, (paid / float(total)) * 100))

    @property
    def amount_paid(self) -> float:
        """Calculate amount already paid."""
        total = getattr(self, "total_amount", None) or 0
        outstanding = getattr(self, "outstanding_amount", None) or 0
        return max(0.0, float(total) - float(outstanding))


class ApprovalTrackingMixin(models.Model):
    """Reusable approval tracking for entities requiring authorization.

    Provides a standardized approval pattern used by PurchaseOrder,
    SalesOrder, and similar entities that go through approval workflows.
    """

    APPROVAL_PENDING = "pending"
    APPROVAL_APPROVED = "approved"
    APPROVAL_REJECTED = "rejected"
    APPROVAL_CHOICES = [
        (APPROVAL_PENDING, "Pending"),
        (APPROVAL_APPROVED, "Approved"),
        (APPROVAL_REJECTED, "Rejected"),
    ]

    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_CHOICES,
        default=APPROVAL_PENDING,
        blank=True,
        help_text="Current approval status",
    )
    approved_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(app_label)s_%(class)s_approvals",
        help_text="User who approved/rejected",
    )
    approved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When approval decision was made",
    )
    approval_notes = models.TextField(
        blank=True,
        default="",
        help_text="Notes from the approver",
    )

    class Meta:
        abstract = True

    @property
    def is_approved(self) -> bool:
        return self.approval_status == self.APPROVAL_APPROVED

    @property
    def is_pending_approval(self) -> bool:
        return self.approval_status == self.APPROVAL_PENDING

    def approve(self, user, notes: str = "") -> None:
        """Mark as approved with audit trail."""
        from django.utils import timezone

        self.approval_status = self.APPROVAL_APPROVED
        self.approved_by = user
        self.approved_at = timezone.now()
        self.approval_notes = notes

    def reject(self, user, notes: str = "") -> None:
        """Mark as rejected with audit trail."""
        from django.utils import timezone

        self.approval_status = self.APPROVAL_REJECTED
        self.approved_by = user
        self.approved_at = timezone.now()
        self.approval_notes = notes


class AuditUserMixin(models.Model):
    """Standardized audit user tracking (created_by / modified_by).

    Complement to TimestampModel — adds who did it, not just when.
    Use for entities where user attribution matters beyond simple timestamps.
    """

    created_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(app_label)s_%(class)s_created",
        help_text="User who created this record",
    )
    modified_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(app_label)s_%(class)s_modified",
        help_text="User who last modified this record",
    )

    class Meta:
        abstract = True


class LifecycleStateMixin(models.Model):
    """Generic lifecycle state machine with transition validation.

    Provides a standardized pattern for entities that move through
    defined states (e.g., draft → active → completed → archived).

    Subclasses define VALID_TRANSITIONS as a dict mapping current → allowed next states.
    """

    VALID_TRANSITIONS: dict[str, list[str]] = {}

    lifecycle_state = models.CharField(
        max_length=30,
        blank=True,
        default="",
        help_text="Current lifecycle state",
    )
    lifecycle_changed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When state last changed",
    )
    lifecycle_changed_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(app_label)s_%(class)s_lifecycle",
        help_text="Who changed the state",
    )

    class Meta:
        abstract = True

    def can_transition_to(self, new_state: str) -> bool:
        """Check if transition from current state to new_state is valid."""
        if not self.VALID_TRANSITIONS:
            return True  # No restrictions defined
        allowed = self.VALID_TRANSITIONS.get(self.lifecycle_state, [])
        return new_state in allowed

    def transition_to(self, new_state: str, user=None) -> bool:
        """Attempt a state transition. Returns True if successful.

        Raises ValueError if the transition is invalid.
        """
        if not self.can_transition_to(new_state):
            raise ValueError(
                f"Invalid transition: {self.lifecycle_state} → {new_state}. "
                f"Allowed: {self.VALID_TRANSITIONS.get(self.lifecycle_state, [])}"
            )
        from django.utils import timezone

        self.lifecycle_state = new_state
        self.lifecycle_changed_at = timezone.now()
        self.lifecycle_changed_by = user
        return True
