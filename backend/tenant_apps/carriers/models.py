"""
Carriers models for ProjectMeats.

Implements tenant ForeignKey field for shared-schema multi-tenancy.
"""

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.postgres.fields import ArrayField
from django.db import models

from tenant_apps.contacts.models import Contact

from apps.core.model_mixins import FinancialTermsMixin
from apps.core.models import (
    AccountingPaymentTermsChoices,
    AppointmentMethodChoices,
    CarrierDepartmentChoices,
    CarrierTypeChoices,
    CreditLimitChoices,
    EdibleInedibleChoices,
    FreshOrFrozenChoices,
    NetOrCatchChoices,
    PackageTypeChoices,
    PhoneTypeChoices,
    ProteinTypeChoices,
    TenantAwareModel,
)


class Carrier(FinancialTermsMixin, TenantAwareModel):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50)
    carrier_type = models.CharField(max_length=20, choices=CarrierTypeChoices.choices, default=CarrierTypeChoices.TRUCK)
    contact_person = models.CharField(max_length=100, blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")
    phone_type = models.CharField(
        max_length=10,
        choices=PhoneTypeChoices.choices,
        blank=True,
        default=PhoneTypeChoices.OFFICE,
        help_text="Carrier phone type (mobile or office)",
    )
    email = models.EmailField(blank=True, default="")
    address = models.TextField(blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    state = models.CharField(max_length=100, blank=True, default="")
    zip_code = models.CharField(max_length=20, blank=True, default="")
    country = models.CharField(max_length=100, default="USA")
    mc_number = models.CharField(max_length=50, blank=True, default="", help_text="Motor Carrier Number")
    dot_number = models.CharField(
        max_length=50, blank=True, default="", help_text="Department of Transportation Number"
    )
    insurance_provider = models.CharField(max_length=200, blank=True, default="")
    insurance_policy_number = models.CharField(max_length=100, blank=True, default="")
    insurance_expiry = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    # Enhanced fields from Excel requirements
    my_customer_num_from_carrier = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Our customer number with this carrier",
    )
    accounting_payable_contact_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Accounting payable contact name",
    )
    accounting_payable_contact_phone = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="Accounting payable contact phone",
    )
    accounting_payable_contact_email = models.EmailField(
        blank=True,
        default="",
        help_text="Accounting payable contact email",
    )
    sales_contact_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Sales contact name",
    )
    contact_title = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Primary carrier contact title",
    )
    sales_contact_phone = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="Sales contact phone",
    )
    sales_contact_main_phone = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="Sales contact main phone number",
    )
    sales_contact_direct_phone = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="Sales contact direct phone number",
    )
    sales_contact_cell_phone = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="Sales contact cell phone number",
    )
    sales_contact_email = models.EmailField(
        blank=True,
        default="",
        help_text="Sales contact email",
    )
    accounting_payment_terms = models.CharField(
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
        help_text="Credit limits/terms (e.g., Net 30, Wire 1 day prior)",
    )
    departments = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Departments (comma-separated: BOL, COA, POD, etc.)",
    )
    departments_array = ArrayField(
        models.CharField(max_length=50, choices=CarrierDepartmentChoices.choices),
        blank=True,
        default=list,
        help_text="Departments (multi-select: BOL, COA, POD) - NEW",
    )
    how_carrier_make_appointment = models.CharField(
        max_length=50,
        choices=AppointmentMethodChoices.choices,
        blank=True,
        default="",
        help_text="How carrier makes appointments (e.g., Email, Phone)",
    )
    pick_up_date = models.DateField(blank=True, null=True, help_text="Default pick up date")
    delivery_date = models.DateField(blank=True, null=True, help_text="Default delivery date")
    our_purchase_order_number_to_supplier = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Default supplier PO number reference",
    )
    supplier_confirmation_order_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Default supplier confirmation order number reference",
    )
    delivery_po_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Default delivery PO number reference",
    )
    carrier_release_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Default carrier release number reference",
    )
    type_of_protein = models.CharField(
        max_length=50,
        choices=ProteinTypeChoices.choices,
        blank=True,
        default="",
        help_text="Default type of protein hauled by this carrier",
    )
    description_of_product_item = models.TextField(
        blank=True,
        default="",
        help_text="Default product item description",
    )
    fresh_or_frozen = models.CharField(
        max_length=20,
        choices=FreshOrFrozenChoices.choices,
        blank=True,
        default="",
        help_text="Default fresh or frozen setting",
    )
    package_type = models.CharField(
        max_length=50,
        choices=PackageTypeChoices.choices,
        blank=True,
        default="",
        help_text="Default package type",
    )
    quantity = models.IntegerField(
        blank=True,
        null=True,
        help_text="Default quantity",
    )
    total_weight = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Default total weight",
    )
    net_or_catch_of_package = models.CharField(
        max_length=20,
        choices=NetOrCatchChoices.choices,
        blank=True,
        default="",
        help_text="Default net or catch of package",
    )
    pickup_delivery_building_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Business building name for pick up / delivery",
    )
    pickup_delivery_address = models.TextField(
        blank=True,
        default="",
        help_text="Address of pick up / delivery location",
    )
    pickup_delivery_city = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="City for pick up / delivery location",
    )
    pickup_delivery_state_zip = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="State and ZIP for pick up / delivery location",
    )
    shipping_contact_name = models.CharField(max_length=255, blank=True, default="")
    shipping_contact_phone = models.CharField(max_length=20, blank=True, default="")
    shipping_contact_email = models.EmailField(blank=True, default="")
    receiving_contact_name = models.CharField(max_length=255, blank=True, default="")
    receiving_contact_phone = models.CharField(max_length=20, blank=True, default="")
    receiving_contact_email = models.EmailField(blank=True, default="")
    edible_or_inedible = models.CharField(
        max_length=50,
        choices=EdibleInedibleChoices.choices,
        blank=True,
        default="",
        help_text="Default edible / inedible classification",
    )
    tested_product = models.BooleanField(
        default=False,
        help_text="Default tested-product flag",
    )
    plant_address = models.TextField(blank=True, default="", help_text="Plant address")
    plant_city = models.CharField(max_length=100, blank=True, default="", help_text="Plant city")
    plant_state_zip = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Plant state and ZIP",
    )
    contacts = models.ManyToManyField(
        Contact,
        related_name="carriers",
        blank=True,
        help_text="Multiple contacts associated with this carrier",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Carrier"
        verbose_name_plural = "Carriers"
        indexes = [
            models.Index(fields=["tenant", "name"]),
            models.Index(fields=["mc_number"]),
            models.Index(fields=["dot_number"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"


class CarrierFreightInquiryStatus(models.TextChoices):
    """Status for carrier freight inquiry (outbound RFQ) lifecycle."""

    PENDING = "pending", "Pending"
    SENDING = "sending", "Sending"
    SENT = "sent", "Sent"
    REPLIED = "replied", "Replied"
    ACCEPTED = "accepted", "Accepted"
    DECLINED = "declined", "Declined"
    EXPIRED = "expired", "Expired"
    FAILED = "failed", "Failed"


def carrier_freight_inquiry_upload_to(instance, filename):
    return f"carriers/freight_inquiries/{instance.tenant_id}/{filename}"


class CarrierFreightInquiry(TenantAwareModel):
    """Durable audit row for an outbound freight inquiry (carrier RFQ) email.

    Each row represents one carrier contacted for one freight lane,
    linked to the originating sales order.
    """

    carrier = models.ForeignKey(
        Carrier,
        on_delete=models.CASCADE,
        related_name="freight_inquiries",
    )
    sales_order = models.ForeignKey(
        "sales_orders.SalesOrder",
        on_delete=models.CASCADE,
        related_name="carrier_freight_inquiries",
    )
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="carrier_freight_inquiries_initiated",
    )
    sender_provider = models.ForeignKey(
        "integrations.ExternalAuthProvider",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="carrier_freight_inquiries",
    )

    # Email details
    sender_email = models.EmailField(blank=True, default="")
    recipient_email = models.EmailField(blank=True, default="")
    recipient_name = models.CharField(max_length=255, blank=True, default="")
    subject = models.CharField(max_length=300, default="")
    body = models.TextField(default="")

    # Freight details (copied from SO at time of inquiry for immutability)
    origin_city = models.CharField(max_length=100, blank=True, default="")
    origin_state = models.CharField(max_length=100, blank=True, default="")
    destination_city = models.CharField(max_length=100, blank=True, default="")
    destination_state = models.CharField(max_length=100, blank=True, default="")
    commodity = models.CharField(max_length=255, blank=True, default="")
    weight = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    weight_unit = models.CharField(max_length=10, blank=True, default="lbs")
    pickup_date = models.DateField(null=True, blank=True)
    delivery_date = models.DateField(null=True, blank=True)
    special_instructions = models.TextField(blank=True, default="")

    # Attachment
    inquiry_pdf = models.FileField(
        upload_to=carrier_freight_inquiry_upload_to,
        blank=True,
        default="",
    )

    # Dispatch status
    status = models.CharField(
        max_length=16,
        choices=CarrierFreightInquiryStatus.choices,
        default=CarrierFreightInquiryStatus.PENDING,
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
        verbose_name = "Carrier Freight Inquiry"
        verbose_name_plural = "Carrier Freight Inquiries"
        indexes = [
            models.Index(fields=["tenant", "status"], name="cfi_tenant_status_idx"),
            models.Index(fields=["tenant", "sales_order"], name="cfi_tenant_so_idx"),
            models.Index(fields=["tenant", "carrier"], name="cfi_tenant_carrier_idx"),
        ]

    def __str__(self):
        carrier_name = self.carrier.name if self.carrier_id else "unbound"
        return f"Freight inquiry to {carrier_name} (status={self.status})"
