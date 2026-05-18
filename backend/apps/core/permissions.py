"""Core DRF permissions.

Keep these permissions tenant-safe. Do NOT assume the caller has already filtered
querysets correctly; object permission checks should be defense-in-depth.
"""

from __future__ import annotations

from typing import Any

from rest_framework.permissions import BasePermission


class IsRoleAuthorized(BasePermission):
    """Role-based authorization guard for tenant-scoped mutations.

    Rules:
    - superusers / staff: always allowed
    - owners / admins / managers: allowed for PATCH/PUT/DELETE
    - plant_manager:
        - Plant: only if plant is in membership.restricted_plants (or unrestricted)
        - Contact: only if contact.plant is in membership.restricted_plants
    - sales_rep / user: allowed for PATCH (edit), denied for DELETE
    - readonly / auditor: deny mutations
    """

    message = 'You do not have permission to modify this resource.'

    def has_permission(self, request: Any, view: Any) -> bool:
        # Allow read-only methods universally.
        if request.method in {'GET', 'HEAD', 'OPTIONS'}:
            return True
        # Allow all authenticated users to attempt mutations;
        # object-level checks handle fine-grained access.
        return True

    def has_object_permission(self, request: Any, view: Any, obj: Any) -> bool:
        if request.method in {'GET', 'HEAD', 'OPTIONS'}:
            return True

        # Only restrict PATCH/PUT/DELETE per spec.
        if request.method not in {'PATCH', 'PUT', 'DELETE'}:
            return True

        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return False

        # Superusers and staff always have full access
        if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
            return True

        tenant = getattr(request, 'tenant', None)
        if not tenant:
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

        # Full access roles
        if role in {'owner', 'admin', 'manager'}:
            return True

        # Plant manager: fine-grained plant-level restriction
        if role == 'plant_manager':
            # If no restricted_plants configured, allow all plants
            restricted = membership.restricted_plants.all()
            if not restricted.exists():
                return True

            model_name = obj.__class__.__name__
            if model_name == 'Plant':
                return restricted.filter(id=getattr(obj, 'id', None)).exists()

            if model_name == 'Contact':
                plant_id = getattr(obj, 'plant_id', None)
                if not plant_id:
                    return False
                return restricted.filter(id=plant_id).exists()

            return True

        # Sales rep / user: allow edits (PATCH/PUT) but not deletes
        if role in {'sales_rep', 'user'}:
            return request.method in {'PATCH', 'PUT'}

        # Readonly and auditor: no mutations
        return False
