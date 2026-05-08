"""Unified Business Party service for cross-entity operations.

Provides a canonical interface to query, search, and operate across
Supplier, Customer, and Carrier entities as a unified "Business Party" concept.

This avoids duplicating logic in each entity's ViewSet and provides
a single service for AI proposals, dependency resolution, and the
Smart Trade Creator to find and create parties.

Usage:
    from apps.core.services.party_service import BusinessPartyService

    service = BusinessPartyService(tenant)

    # Unified search across all party types
    results = service.search('Tyson', party_types=['supplier', 'customer'])

    # Get party summary (works for any type)
    summary = service.get_party_summary(party_type='supplier', party_id=uuid)

    # Find or create a party (for dependency resolution)
    party, created = service.find_or_create('supplier', name='New Supplier Inc')
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from django.db.models import Q, QuerySet

logger = logging.getLogger(__name__)


@dataclass
class PartySummary:
    """Unified summary of any business party."""

    party_type: str
    id: str
    name: str
    contact_person: str
    email: str
    phone: str
    city: str
    state: str
    country: str
    is_active: bool
    extra: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            'party_type': self.party_type,
            'id': self.id,
            'name': self.name,
            'contact_person': self.contact_person,
            'email': self.email,
            'phone': self.phone,
            'city': self.city,
            'state': self.state,
            'country': self.country,
            'is_active': self.is_active,
            **self.extra,
        }


class BusinessPartyService:
    """Unified service for cross-entity business party operations.

    Treats Supplier, Customer, and Carrier as facets of a single
    "Business Party" concept with consistent interface.
    """

    PARTY_TYPES = ('supplier', 'customer', 'carrier')

    def __init__(self, tenant):
        self.tenant = tenant

    def search(
        self,
        query: str,
        party_types: list[str] | None = None,
        limit: int = 20,
        active_only: bool = True,
    ) -> list[PartySummary]:
        """Search across all party types with a single query.

        Args:
            query: Search term (matched against name, contact, email, city).
            party_types: Restrict to specific types. Default: all.
            limit: Maximum results per type.
            active_only: Only return active parties.

        Returns:
            List of PartySummary sorted by relevance.
        """
        party_types = party_types or list(self.PARTY_TYPES)
        results: list[PartySummary] = []

        for ptype in party_types:
            if ptype not in self.PARTY_TYPES:
                continue
            qs = self._get_queryset(ptype, active_only)
            if query:
                qs = qs.filter(
                    Q(name__icontains=query)
                    | Q(contact_person__icontains=query)
                    | Q(email__icontains=query)
                    | Q(city__icontains=query)
                )
            for obj in qs[:limit]:
                results.append(self._to_summary(ptype, obj))

        return results

    def get_party_summary(self, party_type: str, party_id: str) -> PartySummary | None:
        """Get a unified summary for a specific party."""
        qs = self._get_queryset(party_type, active_only=False)
        try:
            obj = qs.get(id=party_id)
            return self._to_summary(party_type, obj)
        except Exception:
            return None

    def find_or_create(
        self,
        party_type: str,
        name: str,
        defaults: dict[str, Any] | None = None,
    ) -> tuple[Any, bool]:
        """Find an existing party by name or create a new one.

        Used by dependency resolution and AI auto-creation flows.
        """
        model = self._get_model(party_type)
        if model is None:
            raise ValueError(f'Unknown party type: {party_type}')

        defaults = defaults or {}
        defaults['tenant'] = self.tenant

        obj, created = model.objects.get_or_create(
            tenant=self.tenant,
            name__iexact=name,
            defaults={'name': name, **defaults},
        )

        if created:
            logger.info(
                '[BusinessPartyService] Created %s "%s" for tenant=%s',
                party_type,
                name,
                self.tenant.id,
            )

        return obj, created

    def get_party_contacts(self, party_type: str, party_id: str) -> list[dict[str, Any]]:
        """Get all contacts associated with a party."""
        try:
            from tenant_apps.contacts.models import Contact

            filter_kwargs = {'tenant': self.tenant}
            if party_type == 'supplier':
                filter_kwargs['supplier_id'] = party_id
            elif party_type == 'customer':
                filter_kwargs['customer_id'] = party_id
            else:
                return []

            contacts = Contact.objects.filter(**filter_kwargs).values(
                'id', 'first_name', 'last_name', 'email', 'phone',
                'title', 'department', 'contact_type', 'status',
            )
            return list(contacts[:50])
        except Exception:
            return []

    def get_counts(self, active_only: bool = True) -> dict[str, int]:
        """Get party counts by type (for dashboard stats)."""
        counts = {}
        for ptype in self.PARTY_TYPES:
            qs = self._get_queryset(ptype, active_only)
            counts[ptype] = qs.count()
        return counts

    def _get_model(self, party_type: str):
        """Get the Django model class for a party type."""
        if party_type == 'supplier':
            from tenant_apps.suppliers.models import Supplier
            return Supplier
        elif party_type == 'customer':
            from tenant_apps.customers.models import Customer
            return Customer
        elif party_type == 'carrier':
            from tenant_apps.carriers.models import Carrier
            return Carrier
        return None

    def _get_queryset(self, party_type: str, active_only: bool = True) -> QuerySet:
        """Get a filtered queryset for a party type."""
        model = self._get_model(party_type)
        if model is None:
            from django.db.models import QuerySet as QS
            return QS().none()

        qs = model.objects.filter(tenant=self.tenant)
        if active_only and hasattr(model, 'is_active'):
            # Carrier uses is_active field
            qs = qs.filter(is_active=True)
        return qs

    def _to_summary(self, party_type: str, obj) -> PartySummary:
        """Convert any party model instance to a unified PartySummary."""
        return PartySummary(
            party_type=party_type,
            id=str(obj.id),
            name=getattr(obj, 'name', ''),
            contact_person=getattr(obj, 'contact_person', ''),
            email=getattr(obj, 'email', ''),
            phone=getattr(obj, 'phone', ''),
            city=getattr(obj, 'city', ''),
            state=getattr(obj, 'state', ''),
            country=getattr(obj, 'country', 'USA'),
            is_active=getattr(obj, 'is_active', True),
            extra={
                'payment_terms': getattr(obj, 'payment_terms', '') or getattr(obj, 'accounting_payment_terms', ''),
            },
        )
