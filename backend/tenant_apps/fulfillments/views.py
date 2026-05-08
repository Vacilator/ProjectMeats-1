"""ViewSets for Fulfillments app."""
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Fulfillment, FulfillmentProduct, FulfillmentStatusChoices
from .serializers import (
    DeliverFulfillmentSerializer,
    FulfillmentCreateSerializer,
    FulfillmentDetailSerializer,
    FulfillmentListSerializer,
    FulfillmentProductSerializer,
    ShipFulfillmentSerializer,
)


class FulfillmentViewSet(viewsets.ModelViewSet):
    """ViewSet for Fulfillment CRUD operations."""

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter by tenant.

        Soft deletes:
        - default: hide deleted
        - admin: allow include_deleted=1
        """
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

        qs = Fulfillment.all_objects if (include_deleted and is_admin) else Fulfillment.objects

        return (
            qs.filter(tenant=self.request.tenant)
            .select_related("inquiry", "supplier", "customer", "carrier", "created_by", "shipped_by")
            .prefetch_related("products")
        )

    def perform_destroy(self, instance):
        instance.soft_delete()

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, pk=None):
        if not (getattr(request.user, "is_superuser", False) or getattr(request.user, "is_staff", False)):
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        fulfillment = Fulfillment.all_objects.filter(tenant=request.tenant, pk=pk).first()
        if not fulfillment:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        fulfillment.restore()
        return Response(FulfillmentDetailSerializer(fulfillment).data)

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == "list":
            return FulfillmentListSerializer
        elif self.action == "create":
            return FulfillmentCreateSerializer
        return FulfillmentDetailSerializer

    def perform_create(self, serializer):
        """Set tenant from inquiry and created_by on create."""
        inquiry = serializer.validated_data.get("inquiry")
        serializer.save(tenant=inquiry.tenant, created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def ship(self, request, pk=None):
        """Mark fulfillment as shipped."""
        fulfillment = self.get_object()
        serializer = ShipFulfillmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Update status
        fulfillment.status = FulfillmentStatusChoices.SHIPPED
        fulfillment.shipped_by = request.user

        # Set ship date (default to today)
        ship_date = serializer.validated_data.get("ship_date")
        fulfillment.ship_date = ship_date or timezone.now().date()

        # Add tracking numbers if provided
        tracking_numbers = serializer.validated_data.get("tracking_numbers", [])
        if tracking_numbers:
            fulfillment.tracking_numbers = list(set(fulfillment.tracking_numbers + tracking_numbers))

        fulfillment.save()

        return Response(FulfillmentDetailSerializer(fulfillment).data)

    @action(detail=True, methods=["post"])
    def deliver(self, request, pk=None):
        """Mark fulfillment as delivered."""
        fulfillment = self.get_object()
        serializer = DeliverFulfillmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Update status
        fulfillment.status = FulfillmentStatusChoices.DELIVERED

        # Set actual delivery date (default to today)
        actual_delivery = serializer.validated_data.get("actual_delivery")
        fulfillment.actual_delivery = actual_delivery or timezone.now().date()

        fulfillment.save()

        return Response(FulfillmentDetailSerializer(fulfillment).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """Mark fulfillment as completed."""
        fulfillment = self.get_object()

        fulfillment.status = FulfillmentStatusChoices.COMPLETED
        fulfillment.save()

        # Update inquiry status if all fulfillments are complete
        inquiry = fulfillment.inquiry
        all_complete = all(f.status == FulfillmentStatusChoices.COMPLETED for f in inquiry.fulfillments.all())
        if all_complete:
            inquiry.status = "fulfilled"
            inquiry.save()

        return Response(FulfillmentDetailSerializer(fulfillment).data)

    @action(detail=True, methods=["post"])
    def add_tracking(self, request, pk=None):
        """Add tracking number(s) to fulfillment."""
        fulfillment = self.get_object()
        tracking_numbers = request.data.get("tracking_numbers", [])

        if isinstance(tracking_numbers, str):
            tracking_numbers = [tracking_numbers]

        if tracking_numbers:
            fulfillment.tracking_numbers = list(set(fulfillment.tracking_numbers + tracking_numbers))
            fulfillment.save()

        return Response(FulfillmentDetailSerializer(fulfillment).data)


class FulfillmentProductViewSet(viewsets.ModelViewSet):
    """ViewSet for FulfillmentProduct CRUD operations."""

    permission_classes = [IsAuthenticated]
    serializer_class = FulfillmentProductSerializer

    def get_queryset(self):
        """Filter by tenant via fulfillment."""
        return FulfillmentProduct.objects.filter(fulfillment__tenant=self.request.tenant).select_related(
            "fulfillment", "inquiry_product", "inquiry_product__product"
        )
