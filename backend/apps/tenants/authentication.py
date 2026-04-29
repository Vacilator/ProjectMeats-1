from __future__ import annotations

import logging

from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.tenants.models import Tenant, TenantUser
from apps.tenants.rls import set_current_tenant

logger = logging.getLogger(__name__)


class _TenantContextMixin:
    def _resolve_tenant_for_user(self, request, user):
        # 1) Explicit tenant selection via header
        tenant_id = request.headers.get('X-Tenant-ID')
        if tenant_id:
            try:
                tenant = Tenant.objects.get(id=tenant_id, is_active=True)
            except Tenant.DoesNotExist:
                raise AuthenticationFailed('Invalid tenant.')
            except ValueError:
                raise AuthenticationFailed('Invalid tenant.')

            is_global_admin = user.groups.filter(name='Global System Admins').exists()
            if not (user.is_superuser or is_global_admin):
                if not TenantUser.objects.filter(user=user, tenant=tenant, is_active=True).exists():
                    raise PermissionDenied('You do not have access to this tenant.')

            return tenant

        # 2) If middleware already resolved tenant (domain/subdomain), validate membership
        tenant = getattr(request, 'tenant', None)
        if tenant is not None:
            is_global_admin = user.groups.filter(name='Global System Admins').exists()
            if not (user.is_superuser or is_global_admin):
                if not TenantUser.objects.filter(user=user, tenant=tenant, is_active=True).exists():
                    raise PermissionDenied('You do not have access to this tenant.')
            return tenant

        # 3) Default tenant from membership, but only when unambiguous.
        memberships = list(
            TenantUser.objects.filter(user=user, is_active=True)
            .select_related('tenant')
            .order_by('-role')[:2]
        )
        if len(memberships) == 1:
            return memberships[0].tenant
        if len(memberships) > 1:
            return None

        # 4) Global admins default to system root (if present)
        if user.groups.filter(name='Global System Admins').exists():
            try:
                return Tenant.objects.get(id='00000000-0000-0000-0000-000000000000')
            except Tenant.DoesNotExist:
                return None

        return None

    def _set_tenant_context(self, request, user) -> None:
        tenant = self._resolve_tenant_for_user(request, user)
        request.tenant = tenant

        if not tenant:
            return

        rls = set_current_tenant(str(tenant.id))
        if rls.ok:
            request._rls_set = True
        else:
            logger.warning('RLS: failed to set session vars for tenant=%s: %s', tenant.id, rls.error)


class TenantAwareJWTAuthentication(_TenantContextMixin, JWTAuthentication):
    def authenticate(self, request):
        out = super().authenticate(request)
        if out is None:
            return None
        user, token = out
        self._set_tenant_context(request, user)
        return (user, token)


class TenantAwareTokenAuthentication(_TenantContextMixin, TokenAuthentication):
    def authenticate(self, request):
        out = super().authenticate(request)
        if out is None:
            return None
        user, token = out
        self._set_tenant_context(request, user)
        return (user, token)
