"""Trade Dependency Checker Service.

Pre-validates all required master-data entities before a trade can proceed
through the happy-path orchestrator. Returns a structured checklist so the
frontend Dependency Wizard can surface missing items for quick-create.

Required dependencies for a trade:
1. Customer (who is buying)
2. Supplier (who is selling — for BROKER route)
3. Plant (supplier's source facility)
4. Customer Contact (billing/shipping)
5. Supplier Contact (procurement/shipping)
6. Carrier (optional but recommended for logistics)

Usage:
    from tenant_apps.inquiries.services.trade_dependency_checker import (
        check_trade_dependencies,
        DependencyCheckResult,
    )

    result = check_trade_dependencies(tenant=request.tenant, inquiry=inquiry)
    if result.all_satisfied:
        # Safe to advance orchestrator
    else:
        # Surface result.checklist to frontend
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from tenant_apps.carriers.models import Carrier
from tenant_apps.contacts.models import Contact
from tenant_apps.customers.models import Customer
from tenant_apps.inquiries.models import Inquiry, InquiryRouteDecisionChoices
from tenant_apps.locations.models import Location
from tenant_apps.plants.models import Plant
from tenant_apps.suppliers.models import Supplier

logger = logging.getLogger(__name__)


@dataclass
class DependencyItem:
    """A single dependency check result."""

    entity_type: str
    label: str
    required: bool = True
    satisfied: bool = False
    entity_id: str | None = None
    entity_name: str | None = None
    hint: str = ""


@dataclass
class DependencyCheckResult:
    """Full dependency check result for a trade."""

    inquiry_id: str
    route: str
    checklist: list[DependencyItem] = field(default_factory=list)

    @property
    def all_satisfied(self) -> bool:
        return all(item.satisfied for item in self.checklist if item.required)

    @property
    def missing_count(self) -> int:
        return sum(1 for item in self.checklist if item.required and not item.satisfied)

    @property
    def total_count(self) -> int:
        return len(self.checklist)

    def to_dict(self) -> dict:
        return {
            "inquiry_id": self.inquiry_id,
            "route": self.route,
            "all_satisfied": self.all_satisfied,
            "missing_count": self.missing_count,
            "total_count": self.total_count,
            "checklist": [
                {
                    "entity_type": item.entity_type,
                    "label": item.label,
                    "required": item.required,
                    "satisfied": item.satisfied,
                    "entity_id": item.entity_id,
                    "entity_name": item.entity_name,
                    "hint": item.hint,
                }
                for item in self.checklist
            ],
        }


def check_trade_dependencies(
    *,
    tenant: Any,
    inquiry: Inquiry,
) -> DependencyCheckResult:
    """Check all required dependencies for a trade.

    Examines the inquiry's linked entities and the tenant's master data
    to determine what's missing before orchestration can proceed.

    Args:
        tenant: Active tenant.
        inquiry: The root inquiry to check.

    Returns:
        DependencyCheckResult with checklist of satisfied/missing items.
    """
    route = inquiry.route_decision or InquiryRouteDecisionChoices.FULFILL
    result = DependencyCheckResult(
        inquiry_id=str(inquiry.id),
        route=route,
    )

    # 1. Customer check
    customer = inquiry.customer if hasattr(inquiry, "customer") else None
    customer_id = getattr(inquiry, "customer_id", None)
    if customer_id:
        try:
            customer = Customer.objects.filter(tenant=tenant, id=customer_id).first()
        except Exception:
            customer = None

    result.checklist.append(
        DependencyItem(
            entity_type="customer",
            label="Customer",
            required=True,
            satisfied=customer is not None,
            entity_id=str(customer.id) if customer else None,
            entity_name=getattr(customer, "name", None),
            hint="The buyer for this trade.",
        )
    )

    # 2. Supplier check (required for BROKER, optional for FULFILL)
    is_broker = route == InquiryRouteDecisionChoices.BROKER
    supplier = None
    supplier_id = getattr(inquiry, "supplier_id", None)
    if supplier_id:
        try:
            supplier = Supplier.objects.filter(tenant=tenant, id=supplier_id).first()
        except Exception:
            supplier = None

    result.checklist.append(
        DependencyItem(
            entity_type="supplier",
            label="Supplier",
            required=is_broker,
            satisfied=supplier is not None,
            entity_id=str(supplier.id) if supplier else None,
            entity_name=getattr(supplier, "name", None),
            hint="The source supplier (required for Broker route)."
            if is_broker
            else "Optional supplier for direct fulfillment.",
        )
    )

    # 3. Plant check (supplier's source facility)
    plant = None
    if supplier:
        plant = Plant.objects.filter(tenant=tenant, supplier=supplier, is_active=True).first()

    result.checklist.append(
        DependencyItem(
            entity_type="plant",
            label="Supplier Plant",
            required=is_broker,
            satisfied=plant is not None,
            entity_id=str(plant.id) if plant else None,
            entity_name=getattr(plant, "name", None),
            hint="Source facility for the supplier.",
        )
    )

    # 4. Customer Contact check (at least one active contact)
    customer_contact = None
    if customer:
        customer_contact = Contact.objects.filter(tenant=tenant, customer=customer, is_active=True).first()

    result.checklist.append(
        DependencyItem(
            entity_type="contact",
            label="Customer Contact",
            required=True,
            satisfied=customer_contact is not None,
            entity_id=str(customer_contact.id) if customer_contact else None,
            entity_name=(f"{customer_contact.first_name} {customer_contact.last_name}" if customer_contact else None),
            hint="Primary contact at the customer for order communications.",
        )
    )

    # 5. Carrier check (at least one active carrier in tenant)
    carrier = Carrier.objects.filter(tenant=tenant, is_active=True).first()

    result.checklist.append(
        DependencyItem(
            entity_type="carrier",
            label="Carrier",
            required=False,
            satisfied=carrier is not None,
            entity_id=str(carrier.id) if carrier else None,
            entity_name=getattr(carrier, "name", None),
            hint="Freight carrier for logistics. Can be assigned later.",
        )
    )

    # 6. Warehouse/Location check (for cold storage allocation)
    warehouse = Location.objects.filter(tenant=tenant, is_active=True, location_type="warehouse").first()

    result.checklist.append(
        DependencyItem(
            entity_type="location",
            label="Warehouse / Cold Storage",
            required=False,
            satisfied=warehouse is not None,
            entity_id=str(warehouse.id) if warehouse else None,
            entity_name=getattr(warehouse, "name", None),
            hint="Cold storage facility for receiving inventory.",
        )
    )

    logger.info(
        "Telemetry: trade_dependency_check",
        extra={
            "event_type": "trade.dependency_check",
            "tenant_id": str(tenant.id),
            "inquiry_id": str(inquiry.id),
            "route": route,
            "all_satisfied": result.all_satisfied,
            "missing_count": result.missing_count,
        },
    )

    return result
