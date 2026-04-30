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
