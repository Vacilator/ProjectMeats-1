"""System-app permission helpers."""

from rest_framework import permissions

from apps.tenants.models import TenantUser


class IsTenantAdminOrOwnerForTenantContext(permissions.BasePermission):
    """Allow unsafe methods only for tenant admins/owners in request.tenant.

    This is used by tenant-scoped resources that are not Tenant objects themselves
    (e.g., TenantProductPreference).
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser or request.user.is_staff:
            return True

        if request.method in permissions.SAFE_METHODS:
            return True

        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return False

        return TenantUser.objects.filter(
            tenant=tenant,
            user=request.user,
            role__in=['owner', 'admin'],
            is_active=True,
        ).exists()

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser or request.user.is_staff:
            return True

        if request.method in permissions.SAFE_METHODS:
            return getattr(obj, 'tenant_id', None) is not None and TenantUser.objects.filter(
                tenant_id=obj.tenant_id,
                user=request.user,
                is_active=True,
            ).exists()

        return getattr(obj, 'tenant_id', None) is not None and TenantUser.objects.filter(
            tenant_id=obj.tenant_id,
            user=request.user,
            role__in=['owner', 'admin'],
            is_active=True,
        ).exists()
