"""Core DRF permissions.

Keep these permissions tenant-safe. Do NOT assume the caller has already filtered
querysets correctly; object permission checks should be defense-in-depth.
"""

from __future__ import annotations

from typing import Any

from rest_framework.permissions import BasePermission


class IsRoleAuthorized(BasePermission):
    """Role-based authorization guard for tenant-scoped mutations.

    Current scope (as requested): intercept PATCH/DELETE for plant/contact edits.

    Rules:
    - owners/admins: allowed
    - plant_manager:
        - Plant: only if plant is in membership.restricted_plants
        - Contact: only if contact.plant is in membership.restricted_plants
    - all other roles: deny PATCH/DELETE by default
    """

    message = 'You do not have permission to modify this resource.'

    def has_permission(self, request: Any, view: Any) -> bool:
        # Allow read-only methods universally; object-level checks handle mutations.
        if request.method in {'GET', 'HEAD', 'OPTIONS', 'POST'}:
            return True
        return True

    def has_object_permission(self, request: Any, view: Any, obj: Any) -> bool:
        if request.method in {'GET', 'HEAD', 'OPTIONS'}:
            return True

        # Only restrict PATCH/DELETE per spec.
        if request.method not in {'PATCH', 'DELETE'}:
            return True

        tenant = getattr(request, 'tenant', None)
        user = getattr(request, 'user', None)
        if not tenant or not user or not getattr(user, 'is_authenticated', False):
            return False

        from apps.tenants.models import TenantUser

        membership = (
            TenantUser.objects.filter(tenant=tenant, user=user, is_active=True)
            .prefetch_related('restricted_plants', 'restricted_locations')
            .first()
        )
        if not membership:
            return False

        role = (membership.role or '').strip().lower()
        if role in {'owner', 'admin'}:
            return True

        if role == 'plant_manager':
            model_name = obj.__class__.__name__
            if model_name == 'Plant':
                return membership.restricted_plants.filter(id=getattr(obj, 'id', None)).exists()

            if model_name == 'Contact':
                plant_id = getattr(obj, 'plant_id', None)
                if not plant_id:
                    return False
                return membership.restricted_plants.filter(id=plant_id).exists()

            return False

        return False
