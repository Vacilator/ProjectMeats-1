"""
Sales Orders views for ProjectMeats.

Provides REST API endpoints for sales order management.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError as DRFValidationError
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from tenant_apps.sales_orders.models import SalesOrder
from tenant_apps.sales_orders.serializers import SalesOrderSerializer
from apps.core.exporting import CsvExportMixin
from apps.core.viewsets_documents import OperationalDocumentActionsMixin
import logging

logger = logging.getLogger(__name__)


class SalesOrderViewSet(OperationalDocumentActionsMixin, CsvExportMixin, viewsets.ModelViewSet):
    """ViewSet for managing sales orders."""

    queryset = SalesOrder.objects.all()
    serializer_class = SalesOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_csv_export_columns(self):
        return [
            ("Sales Order #", "our_sales_order_num"),
            ("Customer", "customer.name"),
            ("Supplier", "supplier.name"),
            ("Carrier", "carrier.name"),
            ("Product", "product.product_code"),
            ("Quantity", "quantity"),
            ("Total Weight", "total_weight"),
            ("Weight Unit", "weight_unit"),
            ("Total Amount", "total_amount"),
            ("Status", "status"),
            ("Payment Status", "payment_status"),
            ("Pick Up Date", "pick_up_date"),
            ("Delivery Date", "delivery_date"),
            ("Created On", "created_on"),
        ]

    def get_csv_export_queryset(self, queryset):
        return queryset.select_related("customer", "supplier", "carrier", "product")

    def get_queryset(self):
        """Filter sales orders by current tenant.

        Soft deletes:
        - default: hide deleted
        - admin: allow include_deleted=1
        """
        if not (hasattr(self.request, "tenant") and self.request.tenant):
            return SalesOrder.objects.none()

        include_deleted = str(self.request.query_params.get("include_deleted") or "").strip().lower() in {
            "1",
            "true",
            "t",
            "yes",
            "y",
        }
        is_admin = bool(getattr(self.request.user, "is_superuser", False) or getattr(self.request.user, "is_staff", False))

        if include_deleted and is_admin:
            return SalesOrder.all_objects.for_tenant(self.request.tenant)

        return SalesOrder.objects.for_tenant(self.request.tenant)

    def perform_destroy(self, instance):
        instance.soft_delete()

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, pk=None):
        if not (getattr(request.user, "is_superuser", False) or getattr(request.user, "is_staff", False)):
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        so = SalesOrder.all_objects.for_tenant(request.tenant).filter(pk=pk).first()
        if not so:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        so.restore()
        return Response(SalesOrderSerializer(so).data)

    def perform_create(self, serializer):
        """Set the tenant and auto-generate our_sales_order_num when creating a new sales order.

        Tenant context must be explicitly resolved by middleware/auth.
        We do not silently default to the user's first tenant on writes.
        """

        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            logger.error(
                "Sales order creation attempted without tenant context",
                extra={
                    "user": self.request.user.username
                    if self.request.user and self.request.user.is_authenticated
                    else "Anonymous",
                    "has_request_tenant": hasattr(self.request, "tenant"),
                    "timestamp": timezone.now().isoformat(),
                },
            )
            raise DRFValidationError("Tenant context is required to create a sales order.")

        # Auto-generate our_sales_order_num if not provided (atomic to prevent duplicates)
        with transaction.atomic():
            if not serializer.validated_data.get('our_sales_order_num'):
                # Get all existing sales orders for this tenant with a lock
                existing_sos = SalesOrder.objects.filter(tenant=tenant).select_for_update()
                
                # Find the highest numeric sales order number
                max_order_num = 0
                for so in existing_sos:
                    try:
                        # Try to extract numeric value from our_sales_order_num
                        num = int(so.our_sales_order_num)
                        if num > max_order_num:
                            max_order_num = num
                    except (ValueError, TypeError):
                        # Skip non-numeric order numbers
                        continue
                
                # Increment and assign
                next_order_num = str(max_order_num + 1)
                serializer.validated_data['our_sales_order_num'] = next_order_num
                
                logger.info(
                    f"Auto-generated our_sales_order_num: {next_order_num} for tenant {tenant.name}",
                    extra={
                        "tenant_id": tenant.id,
                        "our_sales_order_num": next_order_num,
                        "timestamp": timezone.now().isoformat(),
                    }
                )

            serializer.save(tenant=tenant)

    def create(self, request, *args, **kwargs):
        """Create a new sales order with enhanced error handling."""
        try:
            return super().create(request, *args, **kwargs)
        except DRFValidationError as e:
            logger.error(
                f"Validation error creating sales order: {str(e.detail)}",
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
                f"Validation error creating sales order: {str(e)}",
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
                f"Error creating sales order: {str(e)}",
                exc_info=True,
                extra={
                    "request_data": request.data,
                    "user": request.user.username if request.user else "Anonymous",
                    "timestamp": timezone.now().isoformat(),
                },
            )
            return Response(
                {
                    "error": "Failed to create sales order",
                    "details": "Internal server error",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
