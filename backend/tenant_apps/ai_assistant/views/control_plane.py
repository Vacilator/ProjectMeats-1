"""Control plane views for AI Assistant.

Provides read-only viewsets for monitoring AI automation runs, tasks, and approvals
within the tenant-scoped control plane.
"""
import logging

from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from ..models import (
    AIRun,
    AITask,
)
from ..serializers import (
    AIRunSerializer,
    AITaskSerializer,
)
from ..session_utils import get_request_tenant_id
from ._base import _can_review_ai_approvals

logger = logging.getLogger(__name__)


class _TenantScopedAIControlPlaneViewSet(viewsets.ReadOnlyModelViewSet):
    """Base viewset for tenant-scoped AI control plane resources.

    Provides common tenant filtering logic via ``_tenant_queryset``.
    Not intended for direct URL registration.
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering = ["-created_on"]

    def _tenant_queryset(self, queryset):
        tenant = getattr(self.request, "tenant", None)
        tenant_id = get_request_tenant_id(self.request)
        if not tenant_id or tenant is None:
            return queryset.none()
        return queryset.filter(tenant_id=tenant_id), tenant


class AIRunViewSet(_TenantScopedAIControlPlaneViewSet):
    """Tenant-scoped read-only viewset for AI automation runs.

    Lists and retrieves AIRun records filtered by the current tenant.
    Owners/admins see all runs; other users see only their own.
    Supports ordering by created_on, modified_on, and completed_at.
    """

    queryset = AIRun.objects.select_related("tenant", "session", "requested_by")
    serializer_class = AIRunSerializer
    ordering_fields = ["created_on", "modified_on", "completed_at"]

    def get_queryset(self):
        scoped = self._tenant_queryset(self.queryset)
        if not isinstance(scoped, tuple):
            return scoped
        queryset, tenant = scoped
        if _can_review_ai_approvals(user=self.request.user, tenant=tenant):
            return queryset
        return queryset.filter(requested_by=self.request.user)


class AITaskViewSet(_TenantScopedAIControlPlaneViewSet):
    """Tenant-scoped read-only viewset for AI automation tasks.

    Lists and retrieves AITask records filtered by the current tenant.
    Owners/admins see all tasks; other users see only their own.
    Supports ordering by created_on, modified_on, executed_at, resolved_at, and sequence.
    """

    queryset = AITask.objects.select_related("tenant", "run", "requested_by")
    serializer_class = AITaskSerializer
    ordering_fields = ["created_on", "modified_on", "executed_at", "resolved_at", "sequence"]

    def get_queryset(self):
        scoped = self._tenant_queryset(self.queryset)
        if not isinstance(scoped, tuple):
            return scoped
        queryset, tenant = scoped
        if _can_review_ai_approvals(user=self.request.user, tenant=tenant):
            return queryset
        return queryset.filter(requested_by=self.request.user)
