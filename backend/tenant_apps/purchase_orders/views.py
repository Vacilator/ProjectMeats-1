"""
Purchase Orders views for ProjectMeats.

Provides REST API endpoints for purchase order management.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError as DRFValidationError
from django.core.exceptions import ValidationError
from tenant_apps.purchase_orders.models import CarrierPurchaseOrder, PurchaseOrder, PurchaseOrderHistory
from tenant_apps.purchase_orders.serializers import (
    CarrierPurchaseOrderSerializer,
    PurchaseOrderSerializer,
    PurchaseOrderHistorySerializer,
)
from apps.core.exporting import CsvExportMixin
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)


class PurchaseOrderViewSet(CsvExportMixin, viewsets.ModelViewSet):
    """ViewSet for managing purchase orders."""

    queryset = PurchaseOrder.objects.all()
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_csv_export_columns(self):
        return [
            ("Order Number", "order_number"),
            ("Supplier", "supplier.name"),
            ("Product", "product.product_code"),
            ("Item Description", "item_description"),
            ("Total Amount", "total_amount"),
            ("Status", "status"),
            ("Payment Status", "payment_status"),
            ("Order Date", "order_date"),
            ("Delivery Date", "delivery_date"),
            ("Created On", "created_on"),
        ]

    def get_csv_export_queryset(self, queryset):
        return queryset.select_related("supplier", "product")

    def get_queryset(self):
        """Filter purchase orders by current tenant.

        Soft deletes:
        - default: hide deleted
        - admin: allow include_deleted=1
        """
        if not (hasattr(self.request, "tenant") and self.request.tenant):
            return PurchaseOrder.objects.none()

        include_deleted = str(self.request.query_params.get("include_deleted") or "").strip().lower() in {
            "1",
            "true",
            "t",
            "yes",
            "y",
        }
        is_admin = bool(getattr(self.request.user, "is_superuser", False) or getattr(self.request.user, "is_staff", False))

        if include_deleted and is_admin:
            return PurchaseOrder.all_objects.for_tenant(self.request.tenant)

        return PurchaseOrder.objects.for_tenant(self.request.tenant)

    def perform_destroy(self, instance):
        instance.soft_delete()

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, pk=None):
        if not (getattr(request.user, "is_superuser", False) or getattr(request.user, "is_staff", False)):
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        po = PurchaseOrder.all_objects.for_tenant(request.tenant).filter(pk=pk).first()
        if not po:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        po.restore()
        return Response(PurchaseOrderSerializer(po).data)

    def perform_create(self, serializer):
        """Set the tenant when creating a new purchase order.

        Tenant context must be explicitly resolved by middleware/auth.
        We do not silently default to the user's first tenant on writes.
        """

        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            logger.error(
                "Purchase order creation attempted without tenant context",
                extra={
                    "user": self.request.user.username
                    if self.request.user and self.request.user.is_authenticated
                    else "Anonymous",
                    "has_request_tenant": hasattr(self.request, "tenant"),
                    "timestamp": timezone.now().isoformat(),
                },
            )
            raise DRFValidationError("Tenant context is required to create a purchase order.")

        # Delegate order_number generation to the model layer (2YYNNN format).
        serializer.save(tenant=tenant)

    def create(self, request, *args, **kwargs):
        """Create a new purchase order with enhanced error handling."""
        try:
            return super().create(request, *args, **kwargs)
        except DRFValidationError as e:
            logger.error(
                f"Validation error creating purchase order: {str(e.detail)}",
                extra={
                    "request_data": request.data,
                    "user": request.user.username if request.user else "Anonymous",
                    "timestamp": timezone.now().isoformat(),
                },
            )
            # Re-raise DRF validation errors to return 400
            raise
        except ValidationError as e:
            logger.error(
                f"Validation error creating purchase order: {str(e)}",
                extra={
                    "request_data": request.data,
                    "user": request.user.username if request.user else "Anonymous",
                    "timestamp": timezone.now().isoformat(),
                },
            )
            return Response(
                {"error": "Validation failed", "details": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(
                f"Error creating purchase order: {str(e)}",
                exc_info=True,
                extra={
                    "request_data": request.data,
                    "user": request.user.username if request.user else "Anonymous",
                    "timestamp": timezone.now().isoformat(),
                },
            )
            return Response(
                {
                    "error": "Failed to create purchase order",
                    "details": "Internal server error",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        """
        Retrieve version history for a specific purchase order.

        GET /api/v1/purchase-orders/{id}/history/

        Returns a list of all historical changes made to the purchase order.
        """
        purchase_order = self.get_object()
        history_entries = PurchaseOrderHistory.objects.filter(
            purchase_order=purchase_order
        ).order_by("-created_on")

        serializer = PurchaseOrderHistorySerializer(history_entries, many=True)
        return Response(serializer.data)


class CarrierPurchaseOrderViewSet(viewsets.ModelViewSet):
    """ViewSet for managing canonical Carrier PO / freight orders."""

    queryset = CarrierPurchaseOrder.objects.all()
    serializer_class = CarrierPurchaseOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return CarrierPurchaseOrder.objects.none()
        return CarrierPurchaseOrder.objects.for_tenant(tenant).select_related(
            "carrier",
            "supplier",
            "linked_order",
            "sales_order",
            "pick_up_location",
            "delivery_location",
            "product",
        )

    def perform_create(self, serializer):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            raise DRFValidationError("Tenant context is required to create a carrier PO.")
        serializer.save(tenant=tenant)
