"""Test factories for ProjectMeats backend (INFRA-01.1).

Provides factory_boy factories for all core business models.
All factories auto-create tenant hierarchy so tests can create
complex object graphs in 1-3 lines.

Usage:
    from apps.core.tests.factories import (
        TenantFactory,
        SupplierFactory,
        CustomerFactory,
        InquiryFactory,
        PurchaseOrderFactory,
        SalesOrderFactory,
        TradeSessionFactory,
    )

    # Simple - creates tenant automatically
    supplier = SupplierFactory()

    # Share a tenant across objects
    tenant = TenantFactory()
    supplier = SupplierFactory(tenant=tenant)
    customer = CustomerFactory(tenant=tenant)
    po = PurchaseOrderFactory(tenant=tenant, supplier=supplier)
"""

from __future__ import annotations

import uuid
from datetime import date

from django.contrib.auth import get_user_model

import factory
from factory.django import DjangoModelFactory

User = get_user_model()


# ---------------------------------------------------------------------------
# Auth / Infrastructure
# ---------------------------------------------------------------------------


class UserFactory(DjangoModelFactory):
    """Creates a Django user."""

    class Meta:
        model = User
        django_get_or_create = ("username",)

    username = factory.LazyFunction(lambda: f"user-{uuid.uuid4().hex[:8]}")
    email = factory.LazyAttribute(lambda o: f"{o.username}@example.com")
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    is_active = True


# ---------------------------------------------------------------------------
# Tenant
# ---------------------------------------------------------------------------


class TenantFactory(DjangoModelFactory):
    """Creates a Tenant with unique slug."""

    class Meta:
        model = "tenants.Tenant"
        django_get_or_create = ("slug",)

    name = factory.Sequence(lambda n: f"Test Tenant {n}")
    slug = factory.Sequence(lambda n: f"test-tenant-{n}")
    schema_name = factory.LazyAttribute(lambda o: o.slug)


# ---------------------------------------------------------------------------
# Master Data: Suppliers, Customers, Plants, Contacts
# ---------------------------------------------------------------------------


class SupplierFactory(DjangoModelFactory):
    """Creates a Supplier with auto-created tenant."""

    class Meta:
        model = "suppliers.Supplier"

    tenant = factory.SubFactory(TenantFactory)
    name = factory.Sequence(lambda n: f"Supplier {n}")
    email = factory.LazyAttribute(lambda o: f"supplier-{o.name.lower().replace(' ', '')}@example.com")


class CustomerFactory(DjangoModelFactory):
    """Creates a Customer with auto-created tenant."""

    class Meta:
        model = "customers.Customer"

    tenant = factory.SubFactory(TenantFactory)
    name = factory.Sequence(lambda n: f"Customer {n}")
    email = factory.LazyAttribute(lambda o: f"customer-{o.name.lower().replace(' ', '')}@example.com")


class PlantFactory(DjangoModelFactory):
    """Creates a Plant with auto-created tenant."""

    class Meta:
        model = "plants.Plant"

    tenant = factory.SubFactory(TenantFactory)
    name = factory.Sequence(lambda n: f"Plant {n}")
    city = factory.Faker("city")
    country = "US"


class ContactFactory(DjangoModelFactory):
    """Creates a Contact with auto-created tenant."""

    class Meta:
        model = "contacts.Contact"

    tenant = factory.SubFactory(TenantFactory)
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    email = factory.LazyAttribute(lambda o: f"{o.first_name.lower()}.{o.last_name.lower()}@example.com")


# ---------------------------------------------------------------------------
# Trade Entities: Inquiries, Orders, Sessions
# ---------------------------------------------------------------------------


class InquiryFactory(DjangoModelFactory):
    """Creates an Inquiry with auto-created tenant."""

    class Meta:
        model = "inquiries.Inquiry"

    tenant = factory.SubFactory(TenantFactory)
    inquiry_number = factory.Sequence(lambda n: f"INQ-2026-{n:05d}")
    entity_type = "supplier"
    status = "draft"
    source_type = "other"


class PurchaseOrderFactory(DjangoModelFactory):
    """Creates a PurchaseOrder with auto-created tenant and supplier."""

    class Meta:
        model = "purchase_orders.PurchaseOrder"

    tenant = factory.SubFactory(TenantFactory)
    supplier = factory.SubFactory(SupplierFactory, tenant=factory.SelfAttribute("..tenant"))
    order_number = factory.Sequence(lambda n: f"PO-2026-{n:05d}")
    order_date = factory.LazyFunction(date.today)
    status = "draft"
    total_amount = factory.Faker("pydecimal", left_digits=5, right_digits=2, positive=True)


class SalesOrderFactory(DjangoModelFactory):
    """Creates a SalesOrder with auto-created tenant, supplier, and customer."""

    class Meta:
        model = "sales_orders.SalesOrder"

    tenant = factory.SubFactory(TenantFactory)
    supplier = factory.SubFactory(SupplierFactory, tenant=factory.SelfAttribute("..tenant"))
    customer = factory.SubFactory(CustomerFactory, tenant=factory.SelfAttribute("..tenant"))
    our_sales_order_num = factory.Sequence(lambda n: f"SO-2026-{n:05d}")
    status = "draft"


class CarrierFactory(DjangoModelFactory):
    """Creates a Carrier with auto-created tenant."""

    class Meta:
        model = "carriers.Carrier"

    tenant = factory.SubFactory(TenantFactory)
    name = factory.Sequence(lambda n: f"Carrier {n}")
    code = factory.Sequence(lambda n: f"CAR{n:04d}")


class CarrierPurchaseOrderFactory(DjangoModelFactory):
    """Creates a CarrierPurchaseOrder with auto-created tenant, carrier, and supplier."""

    class Meta:
        model = "purchase_orders.CarrierPurchaseOrder"

    tenant = factory.SubFactory(TenantFactory)
    carrier = factory.SubFactory(CarrierFactory, tenant=factory.SelfAttribute("..tenant"))
    supplier = factory.SubFactory(SupplierFactory, tenant=factory.SelfAttribute("..tenant"))
    status = "draft"


class TradeSessionFactory(DjangoModelFactory):
    """Creates a TradeSession with auto-created tenant and inquiry."""

    class Meta:
        model = "inquiries.TradeSession"

    tenant = factory.SubFactory(TenantFactory)
    inquiry = factory.SubFactory(InquiryFactory, tenant=factory.SelfAttribute("..tenant"))
    trade_id = factory.Sequence(lambda n: f"TRD-2026-{n:05d}")
    status = "initiated"


# ---------------------------------------------------------------------------
# Core Infrastructure Models
# ---------------------------------------------------------------------------


class TradeExceptionQueueFactory(DjangoModelFactory):
    """Creates a TradeExceptionQueue entry."""

    class Meta:
        model = "core.TradeExceptionQueue"

    tenant = factory.SubFactory(TenantFactory)
    failed_step = factory.Sequence(lambda n: f"step_{n}")
    reason_code = "UNKNOWN"
    error_message = factory.Faker("sentence")
    status = "open"


class TradeEventLogFactory(DjangoModelFactory):
    """Creates a TradeEventLog entry."""

    class Meta:
        model = "core.TradeEventLog"

    tenant = factory.SubFactory(TenantFactory)
    event_id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    event_type = "inquiry.created"
    trade_id = factory.Sequence(lambda n: f"TRD-2026-{n:05d}")
    payload = factory.LazyFunction(dict)
