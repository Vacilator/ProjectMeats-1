"""ViewSets for Deal Desk APIs."""
from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Deal, DealActionItemStatus
from .serializers import DealDetailSerializer, DealListSerializer, DealWriteSerializer


class DealViewSet(viewsets.ModelViewSet):
    """Tenant-safe CRUD API for deals."""

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return Deal.objects.none()

        include_deleted = str(self.request.query_params.get("include_deleted") or "").strip().lower() in {
            "1",
            "true",
            "t",
            "yes",
            "y",
        }
        is_admin = bool(
            getattr(self.request.user, "is_superuser", False) or getattr(self.request.user, "is_staff", False)
        )
        manager = Deal.all_objects if include_deleted and is_admin else Deal.objects
        return (
            manager.for_tenant(tenant)
            .select_related(
                "purchase_order",
                "purchase_order__supplier",
                "purchase_order__carrier",
                "sales_order",
                "sales_order__supplier",
                "sales_order__customer",
                "sales_order__carrier",
                "fulfillment",
                "fulfillment__carrier",
                "assigned_trader",
            )
            .prefetch_related("action_items")
        )

    def get_serializer_class(self):
        if self.action == "list":
            return DealListSerializer
        if self.action in {"create", "update", "partial_update"}:
            return DealWriteSerializer
        return DealDetailSerializer

    def perform_create(self, serializer):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            raise DRFValidationError("Tenant context is required to create a deal.")

        serializer.save(tenant=tenant)

    def perform_destroy(self, instance):
        instance.soft_delete()

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, pk=None):
        if not (getattr(request.user, "is_superuser", False) or getattr(request.user, "is_staff", False)):
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

        deal = Deal.all_objects.for_tenant(tenant).filter(pk=pk).first()
        if not deal:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        deal.restore()
        return Response(DealDetailSerializer(deal).data)

    @action(detail=True, methods=["post"], url_path="complete-next-action")
    def complete_next_action(self, request, pk=None):
        deal = self.get_object()
        reminder = deal.action_items.filter(status=DealActionItemStatus.OPEN).order_by("due_date", "created_on").first()
        if not reminder:
            return Response({"error": "No open action item found."}, status=status.HTTP_400_BAD_REQUEST)

        reminder.mark_completed()
        return Response(DealDetailSerializer(deal).data)
