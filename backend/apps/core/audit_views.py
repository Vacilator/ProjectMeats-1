from __future__ import annotations

from rest_framework import permissions, viewsets
from rest_framework.filters import OrderingFilter, SearchFilter

from django_filters.rest_framework import DjangoFilterBackend

from apps.core.models import TenantAuditEvent
from apps.core.serializers_audit import TenantAuditEventSerializer
from apps.tenants.models import TenantUser


class TenantAuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only audit event feed.

    Restricted to authenticated members of the active tenant (and staff/superusers).
    """

    serializer_class = TenantAuditEventSerializer
    permission_classes = [permissions.IsAuthenticated]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = {
        "entity_type": ["exact"],
        "object_id": ["exact"],
        "action": ["exact"],
        "created_at": ["gte", "lte"],
    }
    search_fields = ["entity_type", "entity_name", "object_id", "actor_email"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        user = getattr(self.request, "user", None)
        if not tenant or not user or not user.is_authenticated:
            return TenantAuditEvent.objects.none()

        if user.is_superuser or user.is_staff:
            return TenantAuditEvent.objects.select_related("tenant", "actor", "content_type").all()

        is_member = TenantUser.objects.filter(
            tenant=tenant,
            user=user,
            is_active=True,
        ).exists()
        if not is_member:
            return TenantAuditEvent.objects.none()

        return TenantAuditEvent.objects.filter(tenant=tenant).select_related("tenant", "actor", "content_type")
