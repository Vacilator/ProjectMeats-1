from __future__ import annotations

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.tenants.models import TenantUser

from .models import TenantAPIKey, TenantWebhook
from .serializers import (
    TenantAPIKeyCreateSerializer,
    TenantAPIKeySerializer,
    TenantWebhookCreateSerializer,
    TenantWebhookRotateSecretSerializer,
    TenantWebhookSerializer,
)


def _is_tenant_admin(user, tenant) -> bool:
    if not user or not user.is_authenticated or not tenant:
        return False
    if user.is_superuser or user.is_staff:
        return True
    return TenantUser.objects.filter(
        tenant=tenant,
        user=user,
        role__in=['owner', 'admin'],
        is_active=True,
    ).exists()


class TenantAdminOnlyMixin:
    """Mixin that restricts all access to tenant owners/admins (and staff/superusers)."""

    def _assert_admin(self):
        tenant = getattr(self.request, 'tenant', None)
        if not _is_tenant_admin(self.request.user, tenant):
            raise PermissionDenied('Tenant admin/owner access required')

    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        if not _is_tenant_admin(self.request.user, tenant):
            return self.queryset.none()
        return self.queryset.filter(tenant=tenant)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['tenant'] = getattr(self.request, 'tenant', None)
        ctx['user'] = getattr(self.request, 'user', None)
        return ctx


class TenantWebhookViewSet(TenantAdminOnlyMixin, viewsets.ModelViewSet):
    queryset = TenantWebhook.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return TenantWebhookCreateSerializer
        return TenantWebhookSerializer

    def perform_create(self, serializer):
        self._assert_admin()
        serializer.save(tenant=self.request.tenant, created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def rotate_secret(self, request, pk=None):
        self._assert_admin()
        webhook = self.get_object()
        secret_value = webhook.rotate_secret()
        serializer = TenantWebhookRotateSecretSerializer({'signing_secret': secret_value})
        return Response(serializer.data, status=status.HTTP_200_OK)


class TenantAPIKeyViewSet(TenantAdminOnlyMixin, viewsets.ModelViewSet):
    queryset = TenantAPIKey.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return TenantAPIKeyCreateSerializer
        return TenantAPIKeySerializer

    def perform_create(self, serializer):
        self._assert_admin()
        serializer.save(tenant=self.request.tenant, created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        """Revoke instead of hard delete."""
        self._assert_admin()
        obj = self.get_object()
        obj.revoke()
        return Response(status=status.HTTP_204_NO_CONTENT)
