"""
Purchase Orders views for ProjectMeats.

Provides REST API endpoints for purchase order management.
"""
import logging

from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from tenant_apps.inquiries.models import Inquiry, InquirySupplierRFQ
from tenant_apps.purchase_orders.models import (
    CarrierPurchaseOrder,
    PurchaseOrder,
    PurchaseOrderHistory,
    PurchaseOrderStatus,
)
from tenant_apps.purchase_orders.serializers import (
    CarrierPurchaseOrderSerializer,
    PurchaseOrderHistorySerializer,
    PurchaseOrderReviewContextSerializer,
    PurchaseOrderSerializer,
)
from tenant_apps.purchase_orders.services.approval_dispatch import approve_purchase_order_and_send_to_supplier

from apps.core.exporting import CsvExportMixin
from apps.core.serializers_documents import DocumentStatusTransitionSerializer
from apps.core.viewsets_documents import OperationalDocumentActionsMixin, _request_audit_context

logger = logging.getLogger(__name__)


class PurchaseOrderViewSet(OperationalDocumentActionsMixin, CsvExportMixin, viewsets.ModelViewSet):
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
        is_admin = bool(
            getattr(self.request.user, "is_superuser", False) or getattr(self.request.user, "is_staff", False)
        )

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

    @action(detail=True, methods=["post"], url_path="transition-status")
    def transition_status(self, request, pk=None):
        document = self.get_object()
        serializer = DocumentStatusTransitionSerializer(
            data=request.data,
            context={"document": document},
        )
        serializer.is_valid(raise_exception=True)
        next_status = serializer.validated_data["status"]

        if next_status != PurchaseOrderStatus.APPROVED:
            return super().transition_status(request, pk=pk)

        try:
            with _request_audit_context(request):
                result = approve_purchase_order_and_send_to_supplier(
                    tenant=request.tenant,
                    purchase_order=document,
                    user=request.user if request.user.is_authenticated else None,
                )
        except Exception as exc:
            logger.exception(
                "Unexpected error during purchase order approval for PO %s",
                pk,
            )
            return Response(
                {
                    "error": f"Purchase order approval failed: {exc}",
                    "code": "approval_error",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not result.success:
            return Response(
                {
                    "error": result.error_message,
                    "code": result.error_code,
                },
                status=result.http_status,
            )
        refreshed = get_object_or_404(self.get_queryset(), pk=pk)
        return Response(self.get_serializer(refreshed).data)

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
        history_entries = PurchaseOrderHistory.objects.filter(purchase_order=purchase_order).order_by("-created_on")

        serializer = PurchaseOrderHistorySerializer(history_entries, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="create-sales-order-draft")
    def create_sales_order_draft(self, request, pk=None):
        """Create or return the draft sales order from an approved supplier PO.

        POST /api/v1/purchase-orders/{id}/create-sales-order-draft/
        """
        from tenant_apps.sales_orders.serializers import SalesOrderSerializer as SOSerializer
        from tenant_apps.sales_orders.services.draft_sales_order import (
            DraftSalesOrderError,
            create_draft_from_approved_source,
        )

        purchase_order = self.get_object()

        try:
            result = create_draft_from_approved_source(
                tenant=request.tenant,
                purchase_order=purchase_order,
            )
        except DraftSalesOrderError as exc:
            raise DRFValidationError({"detail": str(exc)}) from exc

        response_status = status.HTTP_201_CREATED if result.created else status.HTTP_200_OK
        return Response(
            {
                "created": result.created,
                "source_type": result.source_type,
                "sales_order": SOSerializer(
                    result.sales_order,
                    context={"request": request},
                ).data,
            },
            status=response_status,
        )

    @action(detail=True, methods=["get"], url_path="review-context")
    def review_context(self, request, pk=None):
        purchase_order = self.get_object()
        serializer = PurchaseOrderReviewContextSerializer(self._build_review_context(request, purchase_order))
        return Response(serializer.data)

    def _build_review_context(self, request, purchase_order: PurchaseOrder) -> dict[str, object]:
        custom_data = dict(purchase_order.custom_data or {})
        source_lineage = dict(custom_data.get("source_lineage") or {})
        review_state = str(custom_data.get("review_state") or "").strip()
        inquiry = self._resolve_review_inquiry(
            request=request,
            purchase_order=purchase_order,
            source_lineage=source_lineage,
        )
        rfq = self._resolve_review_rfq(
            request=request,
            purchase_order=purchase_order,
            inquiry=inquiry,
            source_lineage=source_lineage,
        )
        normalized_quote = dict(custom_data.get("normalized_quote") or {})
        supplier_reply_parse = dict(custom_data.get("supplier_reply_parse") or {})
        return {
            "purchase_order": purchase_order,
            "review_state": review_state,
            "review_context_complete": bool(
                review_state and source_lineage and inquiry and rfq and normalized_quote and supplier_reply_parse
            ),
            "source_lineage": source_lineage or None,
            "inquiry": inquiry,
            "rfq": rfq,
            "normalized_quote": normalized_quote or None,
            "supplier_reply_parse": supplier_reply_parse or None,
        }

    def _resolve_review_inquiry(
        self,
        *,
        request,
        purchase_order: PurchaseOrder,
        source_lineage: dict[str, object],
    ) -> Inquiry | None:
        tenant = getattr(request, "tenant", None)
        if tenant is None:
            return None

        queryset = Inquiry.objects.for_tenant(tenant).select_related(
            "customer",
            "supplier",
            "requested_master_product",
        )
        inquiry_id = source_lineage.get("inquiry_id")
        if inquiry_id:
            queryset = queryset.filter(id=inquiry_id)
        return queryset.filter(supplier_purchase_order=purchase_order).first()

    def _resolve_review_rfq(
        self,
        *,
        request,
        purchase_order: PurchaseOrder,
        inquiry: Inquiry | None,
        source_lineage: dict[str, object],
    ) -> InquirySupplierRFQ | None:
        tenant = getattr(request, "tenant", None)
        if tenant is None or inquiry is None:
            return None

        queryset = (
            InquirySupplierRFQ.objects.for_tenant(tenant)
            .select_related("supplier")
            .filter(
                inquiry=inquiry,
                supplier_id=purchase_order.supplier_id,
            )
        )
        rfq_id = source_lineage.get("rfq_id")
        if rfq_id:
            queryset = queryset.filter(id=rfq_id)
        return queryset.first()


class CarrierPurchaseOrderViewSet(OperationalDocumentActionsMixin, viewsets.ModelViewSet):
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
