"""Contact resolution service for Workform nodes (RT-04.1).

Resolves the correct recipient contact from Plant Contact Type, Title,
and "Responsible For" multi-selects for RFQ dispatch, PO generation, and
bid selection nodes.

Usage:
    from tenant_apps.workflows.services.contact_resolution import (
        resolve_rfq_recipient,
        resolve_po_contact,
        resolve_bid_evaluator,
    )
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger("trade")


@dataclass
class ResolvedContact:
    """Result of contact resolution for a workform node."""

    contact_id: str
    name: str
    email: str
    phone: str
    contact_type: str
    title: str
    department: str
    responsibilities: list[str]
    resolution_method: str  # 'type_match', 'department_match', 'fallback', 'manual'


def resolve_rfq_recipient(
    *,
    tenant: Any,
    supplier: Any,
    preferred_contact_type: str = "Sales",
    fallback_contact_type: str = "General",
    product_context: str | None = None,
) -> ResolvedContact | None:
    """Resolve the correct contact for sending an RFQ to a supplier.

    Resolution order:
    1. Contact with matching contact_type for the supplier
    2. Contact with matching department for the supplier
    3. Contact with protein/product responsibility matching the inquiry
    4. Fallback to first active contact for supplier
    """
    from tenant_apps.contacts.models import Contact

    # Get all contacts for this supplier
    contacts = Contact.objects.filter(
        tenant=tenant,
        supplier=supplier,
        status="active",
    ).order_by("-contact_type", "last_name")

    if not contacts.exists():
        logger.info(
            "No active contacts for supplier %s (tenant %s)",
            supplier.pk,
            tenant.pk,
        )
        return None

    # 1. Match by contact_type (e.g., "Sales")
    type_match = contacts.filter(contact_type__iexact=preferred_contact_type).first()
    if type_match:
        return _to_resolved(type_match, "type_match")

    # 2. Match by department (cascading: use preferred_contact_type as department name)
    dept_match = contacts.filter(department__iexact=preferred_contact_type).first()
    if dept_match:
        return _to_resolved(dept_match, "department_match")

    # 3. Match by protein/product responsibility
    if product_context:
        responsibility_match = contacts.filter(
            protein_responsibilities__protein__name__icontains=product_context
        ).first()
        if responsibility_match:
            return _to_resolved(responsibility_match, "responsibility_match")

    # 4. Fallback contact type
    if fallback_contact_type and fallback_contact_type != preferred_contact_type:
        fallback_match = contacts.filter(contact_type__iexact=fallback_contact_type).first()
        if fallback_match:
            return _to_resolved(fallback_match, "fallback_type_match")

    # 5. Any active contact
    fallback = contacts.first()
    if fallback:
        return _to_resolved(fallback, "fallback")

    return None


def resolve_po_contact(
    *,
    tenant: Any,
    supplier: Any,
    contact_type: str = "Accounting",
) -> ResolvedContact | None:
    """Resolve the correct contact for Purchase Order generation.

    For POs, we prefer Accounting contacts to ensure invoicing is routed
    correctly. Falls back to Sales if no Accounting contact exists.
    """
    from tenant_apps.contacts.models import Contact

    contacts = Contact.objects.filter(
        tenant=tenant,
        supplier=supplier,
        status="active",
    )

    # Prefer specified type
    match = contacts.filter(contact_type__iexact=contact_type).first()
    if match:
        return _to_resolved(match, "type_match")

    # Fallback to Sales
    sales_match = contacts.filter(contact_type__iexact="Sales").first()
    if sales_match:
        return _to_resolved(sales_match, "fallback")

    # Any contact
    any_contact = contacts.first()
    if any_contact:
        return _to_resolved(any_contact, "fallback")

    return None


def resolve_bid_evaluator(
    *,
    tenant: Any,
    supplier: Any,
) -> ResolvedContact | None:
    """Resolve the contact associated with a bid from a supplier.

    For bid evaluation, we want the Sales contact who provided the quote.
    """
    return resolve_rfq_recipient(
        tenant=tenant,
        supplier=supplier,
        preferred_contact_type="Sales",
        fallback_contact_type="Operations",
    )


def resolve_customer_contact(
    *,
    tenant: Any,
    customer: Any,
    contact_type: str = "Sales",
) -> ResolvedContact | None:
    """Resolve the correct customer contact for Sales Order dispatch."""
    from tenant_apps.contacts.models import Contact

    contacts = Contact.objects.filter(
        tenant=tenant,
        customer=customer,
        status="active",
    )

    match = contacts.filter(contact_type__iexact=contact_type).first()
    if match:
        return _to_resolved(match, "type_match")

    any_contact = contacts.first()
    if any_contact:
        return _to_resolved(any_contact, "fallback")

    return None


def _to_resolved(contact: Any, method: str) -> ResolvedContact:
    """Convert a Contact model instance to a ResolvedContact dataclass."""
    # Gather responsibilities from M2M relations
    responsibilities: list[str] = []
    if hasattr(contact, "protein_responsibilities"):
        responsibilities.extend(contact.protein_responsibilities.values_list("protein__name", flat=True)[:10])
    if hasattr(contact, "product_responsibilities"):
        responsibilities.extend(contact.product_responsibilities.values_list("master_product__name", flat=True)[:10])

    return ResolvedContact(
        contact_id=str(contact.pk),
        name=f"{contact.first_name or ''} {contact.last_name or ''}".strip() or str(contact),
        email=getattr(contact, "email", "") or "",
        phone=getattr(contact, "main_phone", "") or getattr(contact, "cell_phone", "") or "",
        contact_type=getattr(contact, "contact_type", "") or "",
        title=getattr(contact, "contact_title", "") or getattr(contact, "title", "") or "",
        department=getattr(contact, "department", "") or "",
        responsibilities=responsibilities,
        resolution_method=method,
    )
