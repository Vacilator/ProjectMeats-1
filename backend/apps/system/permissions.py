"""System-app permission helpers."""

from rest_framework import permissions

from apps.tenants.models import TenantUser


def _get_request_tenant(request):
    django_request = getattr(request, "_request", None)
    return getattr(request, "tenant", None) or getattr(django_request, "tenant", None)


class IsTenantAdminOrOwnerForTenantContext(permissions.BasePermission):
    """Allow unsafe methods only for tenant admins/owners in the tenant context."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser or request.user.is_staff:
            return True

        if request.method in permissions.SAFE_METHODS:
            return True

        tenant = _get_request_tenant(request)
        if not tenant:
            return False

        return TenantUser.objects.filter(
            tenant=tenant,
            user=request.user,
            role__in=["owner", "admin"],
            is_active=True,
        ).exists()

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser or request.user.is_staff:
            return True

        if request.method in permissions.SAFE_METHODS:
            return (
                getattr(obj, "tenant_id", None) is not None
                and TenantUser.objects.filter(
                    tenant_id=obj.tenant_id,
                    user=request.user,
                    is_active=True,
                ).exists()
            )

        return (
            getattr(obj, "tenant_id", None) is not None
            and TenantUser.objects.filter(
                tenant_id=obj.tenant_id,
                user=request.user,
                role__in=["owner", "admin"],
                is_active=True,
            ).exists()
        )


class IsTenantEditorForTenantContext(permissions.BasePermission):
    """Allow unsafe WorkForms/FormBuilder mutations only for tenant editors."""

    editor_roles = ["owner", "admin", "manager"]

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser or request.user.is_staff:
            return True

        if request.method in permissions.SAFE_METHODS:
            return True

        django_request = getattr(request, "_request", None)
        tenant_user = getattr(request, "tenant_user", None) or getattr(django_request, "tenant_user", None)
        if tenant_user is not None:
            return getattr(tenant_user, "role", None) in self.editor_roles

        tenant = _get_request_tenant(request)
        if not tenant:
            return False

        return TenantUser.objects.filter(
            tenant=tenant,
            user=request.user,
            role__in=self.editor_roles,
            is_active=True,
        ).exists()

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser or request.user.is_staff:
            return True

        if request.method in permissions.SAFE_METHODS:
            return (
                getattr(obj, "tenant_id", None) is not None
                and TenantUser.objects.filter(
                    tenant_id=obj.tenant_id,
                    user=request.user,
                    is_active=True,
                ).exists()
            )

        django_request = getattr(request, "_request", None)
        tenant_user = getattr(request, "tenant_user", None) or getattr(django_request, "tenant_user", None)
        if tenant_user is not None and getattr(obj, "tenant_id", None) == getattr(tenant_user, "tenant_id", None):
            return getattr(tenant_user, "role", None) in self.editor_roles

        return (
            getattr(obj, "tenant_id", None) is not None
            and TenantUser.objects.filter(
                tenant_id=obj.tenant_id,
                user=request.user,
                role__in=self.editor_roles,
                is_active=True,
            ).exists()
        )


class IsActiveTenantMemberForTenantContext(permissions.BasePermission):
    """Allow actions only for active tenant members in the tenant context.

    This permission is intended for actions like workform execution.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser or request.user.is_staff:
            return True

        tenant = _get_request_tenant(request)
        if not tenant and hasattr(request, "headers"):
            tenant_id = request.headers.get("X-Tenant-ID")
            if tenant_id:
                try:
                    tu = TenantUser.objects.select_related("tenant").get(
                        tenant_id=tenant_id,
                        user=request.user,
                        is_active=True,
                    )
                    tenant = tu.tenant
                    setattr(request, "tenant", tenant)
                    django_request = getattr(request, "_request", None)
                    if django_request is not None:
                        setattr(django_request, "tenant", tenant)
                except TenantUser.DoesNotExist:
                    return False

        if not tenant:
            return False

        return TenantUser.objects.filter(
            tenant=tenant,
            user=request.user,
            is_active=True,
        ).exists()
