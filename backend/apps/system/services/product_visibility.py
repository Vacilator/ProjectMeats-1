"""Tenant-visible product queryset helpers.

Three-tier product strategy:
- Tier 1 (System golden list): system.Product where is_system=True
- Tier 2 (Tenant preferences): TenantProductPreference overrides/hide/pricing
- Tier 3 (Tenant custom products): system.Product where is_system=False, visible only
  to tenants that have an ACTIVE TenantProductPreference row with is_custom=True.

This module centralizes the visibility rules so Cockpit search and form dropdowns
return consistent results.
"""

from __future__ import annotations

from django.db.models import Q, QuerySet

from apps.system.models import Product, TenantProductPreference
from apps.tenants.models import Tenant


def visible_products_qs(
    *,
    tenant: Tenant | None,
    qs: QuerySet[Product] | None = None,
    include_inactive: bool = False,
) -> QuerySet[Product]:
    """Return the product queryset visible to a tenant.

    Rules:
    - If tenant is None: return only active system products.
    - System products (is_system=True): visible unless tenant explicitly hides them
      via TenantProductPreference(is_active=False).
    - Custom products (is_system=False): visible only when tenant has
      TenantProductPreference(is_active=True, is_custom=True).

    Notes:
    - We intentionally do NOT require a preference row for every system product.
      Absence means "visible by default".
    """

    base = qs if qs is not None else Product.objects.all()

    # Global product deactivation must always be respected for tenant-visible catalogs.
    # TenantProductPreference can hide/override, but should never resurrect globally inactive products.
    base = base.filter(is_active=True)

    if not tenant:
        return base.filter(is_system=True)

    hidden_ids = TenantProductPreference.objects.filter(
        tenant=tenant,
        is_active=False,
    ).values_list("product_id", flat=True)

    return base.filter(
        Q(is_system=True) & ~Q(id__in=hidden_ids)
        | Q(
            is_system=False,
            tenant_preferences__tenant=tenant,
            tenant_preferences__is_active=True,
            tenant_preferences__is_custom=True,
        )
    ).distinct()
