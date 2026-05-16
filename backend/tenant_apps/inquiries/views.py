"""ViewSets for Inquiries app."""

import logging
from datetime import timedelta

from django.db.models import Avg, Count, F, Prefetch, Q, Sum

logger = logging.getLogger(__name__)
from django.db.models.functions import TruncWeek
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.services.idempotency_enforcement import idempotent_create

from tenant_apps.purchase_orders.serializers import PurchaseOrderSerializer

from apps.core.viewsets_documents import OperationalDocumentActionsMixin

from .models import (
    Inquiry,
    InquiryProduct,
    InquiryProductSupplierBid,
    InquiryRouteDecisionChoices,
    InquiryTemplate,
    InquiryTemplateProduct,
    SupplierBidStatusChoices,
    TradeDocument,
)
from .serializers import (
    AddProductsSerializer,
    CloneInquirySerializer,
    CreateSupplierPurchaseOrderDraftSerializer,
    InquiryCreateSerializer,
    InquiryDetailSerializer,
    InquiryListSerializer,
    InquiryProductSerializer,
    InquiryProductSupplierBidSerializer,
    InquiryTemplateCreateSerializer,
    InquiryTemplateDetailSerializer,
    InquiryTemplateListSerializer,
    TradeDocumentSerializer,
    TradeDocumentUploadSerializer,
)
from .services import create_supplier_quote_purchase_order_draft
from .services.supplier_quote_po_draft import SupplierQuotePODraftError


class InquiryViewSet(OperationalDocumentActionsMixin, viewsets.ModelViewSet):
    """ViewSet for Inquiry CRUD operations."""

    permission_classes = [IsAuthenticated]

    def perform_document_status_transition(self, request, document, next_status):
        """Override to track inquiry-specific timestamps and ensure trade session."""
        from tenant_apps.inquiries.services.trade_session import (
            get_or_create_trade_session,
            update_trade_session_status,
        )
        from tenant_apps.inquiries.models import TradeSessionStatus

        now = timezone.now()
        if next_status == "quoted":
            document.quoted_date = now
        elif next_status in ("accepted", "rejected"):
            document.decision_date = now
            if next_status == "rejected":
                document.win_loss_reason = request.data.get("reason", "")

        # Ensure a TradeSession exists so My Trades picks up this inquiry
        tenant = getattr(request, "tenant", None)
        if tenant and next_status not in ("cancelled",):
            try:
                ts, _ = get_or_create_trade_session(tenant=tenant, inquiry=document)
                # Advance trade session status to match inquiry progression
                status_map = {
                    "quoted": TradeSessionStatus.QUOTED,
                    "accepted": TradeSessionStatus.ORDERED,
                }
                target = status_map.get(next_status)
                if target and ts.status != target:
                    update_trade_session_status(trade_session=ts, new_status=target)
            except Exception:
                logger.warning(
                    "Failed to create/update TradeSession for inquiry %s during %s transition",
                    document.id,
                    next_status,
                    exc_info=True,
                )

        return super().perform_document_status_transition(request, document, next_status)

    def get_queryset(self):
        """Filter by tenant and apply common list filters.

        The UI expects query params like:
        - search: free-text search
        - status: filter by Inquiry.status
        - entity_type: customer|supplier
        - customer / customer_id
        - supplier / supplier_id
        - ordering: inquiry_date|created_on (prefix with - for desc)
        """
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return Inquiry.objects.none()

        qs = (
            Inquiry.objects.filter(tenant=tenant)
            .select_related(
                "supplier",
                "customer",
                "contact",
                "source_call",
                "source_email",
                "requested_master_product",
                "supplier_purchase_order",
                "sales_order",
                "carrier_purchase_order",
                "created_by",
            )
            .prefetch_related(
                "products",
                "products__product",
                "products__supplier_bids",
                "products__supplier_bids__supplier",
                "products__supplier_bids__plant",
                "products__supplier_bids__contact",
            )
        )

        params = getattr(self.request, "query_params", {})

        status_value = params.get("status")
        if status_value:
            qs = qs.filter(status=status_value)

        entity_type = params.get("entity_type")
        if entity_type in ("customer", "supplier"):
            qs = qs.filter(entity_type=entity_type)

        route_decision = params.get("route_decision")
        if route_decision in InquiryRouteDecisionChoices.values:
            qs = qs.filter(route_decision=route_decision)

        customer_id = params.get("customer") or params.get("customer_id")
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        supplier_id = params.get("supplier") or params.get("supplier_id")
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)

        search = params.get("search")
        if search:
            qs = qs.filter(
                Q(inquiry_number__icontains=search)
                | Q(contact_name__icontains=search)
                | Q(customer__name__icontains=search)
                | Q(supplier__name__icontains=search)
            )

        ordering = params.get("ordering")
        allowed = {
            "inquiry_date",
            "-inquiry_date",
            "created_on",
            "-created_on",
        }
        if ordering in allowed:
            qs = qs.order_by(ordering)

        return qs

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == "list":
            return InquiryListSerializer
        elif self.action == "create":
            return InquiryCreateSerializer
        return InquiryDetailSerializer

    def perform_create(self, serializer):
        """Set tenant and created_by on create."""
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            raise ValidationError({"error": "Tenant context is required"})

        serializer.save(tenant=tenant, created_by=self.request.user)

    @idempotent_create(source="api")
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def add_products(self, request, pk=None):
        """Add products to an existing inquiry."""
        inquiry = self.get_object()
        serializer = AddProductsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        created_products = []
        for product_data in serializer.validated_data["products"]:
            product = InquiryProduct.objects.create(inquiry=inquiry, **product_data)
            created_products.append(product)

        return Response(InquiryProductSerializer(created_products, many=True).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def create_fulfillment(self, request, pk=None):
        """Create a fulfillment from this inquiry."""
        from tenant_apps.carriers.models import Carrier
        from tenant_apps.fulfillments.models import Fulfillment, FulfillmentProduct
        from tenant_apps.fulfillments.serializers import FulfillmentDetailSerializer
        from tenant_apps.suppliers.models import Supplier

        inquiry = self.get_object()

        supplier_id = request.data.get("supplier")
        carrier_id = request.data.get("carrier")
        product_quantities = request.data.get("products", [])

        # Validate supplier belongs to this tenant
        supplier = None
        if supplier_id:
            try:
                supplier = Supplier.objects.get(pk=supplier_id, tenant=inquiry.tenant)
            except Supplier.DoesNotExist:
                raise ValidationError({"supplier": "Supplier not found for this tenant."})

        # Validate carrier belongs to this tenant
        carrier = None
        if carrier_id:
            try:
                carrier = Carrier.objects.get(pk=carrier_id, tenant=inquiry.tenant)
            except Carrier.DoesNotExist:
                raise ValidationError({"carrier": "Carrier not found for this tenant."})

        # Validate product quantities payload structure
        if product_quantities:
            if not isinstance(product_quantities, list):
                raise ValidationError({"products": "Products must be a list."})
            inquiry_product_ids = set(inquiry.products.values_list("pk", flat=True))
            for idx, pq in enumerate(product_quantities):
                if not isinstance(pq, dict):
                    raise ValidationError({"products": f"Item {idx} must be an object."})
                ipid = pq.get("inquiry_product_id")
                if not ipid:
                    raise ValidationError({"products": f"Item {idx} missing inquiry_product_id."})
                if ipid not in inquiry_product_ids:
                    raise ValidationError(
                        {"products": (f"inquiry_product_id {ipid} does not belong " "to this inquiry.")}
                    )

        # Create fulfillment
        fulfillment = Fulfillment.objects.create(
            tenant=inquiry.tenant,
            inquiry=inquiry,
            supplier=supplier,
            customer=inquiry.customer,
            shipping_type=getattr(inquiry, "shipping_type", None) or "tenant",
            created_by=request.user,
        )

        if carrier:
            fulfillment.carrier = carrier
            fulfillment.save(update_fields=["carrier"])

        # Create fulfillment products
        if product_quantities:
            for pq in product_quantities:
                FulfillmentProduct.objects.create(
                    fulfillment=fulfillment,
                    inquiry_product_id=pq["inquiry_product_id"],
                    quantity_fulfilled=pq.get("quantity_fulfilled", 0),
                    unit_price=pq.get("unit_price"),
                )
        else:
            for ip in inquiry.products.all():
                FulfillmentProduct.objects.create(
                    fulfillment=fulfillment,
                    inquiry_product=ip,
                    quantity_fulfilled=ip.quantity,
                    unit_price=ip.actual_price_per_unit,
                )

        return Response(FulfillmentDetailSerializer(fulfillment).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="from-call/(?P<call_id>[^/.]+)")
    def from_call(self, request, call_id=None):
        """Pre-populate inquiry data from a scheduled call."""
        from tenant_apps.cockpit.models import ScheduledCall

        try:
            call = ScheduledCall.objects.get(id=call_id, tenant=request.tenant)
        except ScheduledCall.DoesNotExist:
            return Response({"error": "Call not found"}, status=status.HTTP_404_NOT_FOUND)

        # Build pre-populated data from call
        data = {
            "source_type": "scheduled_call",
            "source_call": str(call.id),
            "entity_type": call.entity_type,
        }

        # Set entity based on type
        if call.entity_type == "supplier" and call.entity_id:
            data["supplier"] = call.entity_id
            from tenant_apps.suppliers.models import Supplier

            try:
                supplier = Supplier.objects.get(id=call.entity_id, tenant=request.tenant)
                data["contact_company"] = supplier.name
                data["contact_name"] = supplier.contact_person or ""
                data["contact_email"] = supplier.email or ""
                data["contact_phone"] = supplier.phone or ""
            except Supplier.DoesNotExist:
                pass
        elif call.entity_type == "customer" and call.entity_id:
            data["customer"] = call.entity_id
            from tenant_apps.customers.models import Customer

            try:
                customer = Customer.objects.get(id=call.entity_id, tenant=request.tenant)
                data["contact_company"] = customer.name
                data["contact_name"] = customer.contact_person or ""
                data["contact_email"] = customer.email or ""
                data["contact_phone"] = customer.phone or ""
            except Customer.DoesNotExist:
                pass

        # Add call description to inquiry notes
        if call.description:
            data["notes"] = f"From call: {call.description}"

        return Response(data)

    @action(detail=True, methods=["post"], url_path="update-status")
    def update_status(self, request, pk=None):
        """Update inquiry status — delegates to transition-status for cascade support.

        DEPRECATED: This endpoint is kept for backward compatibility.
        New code should use POST /{id}/transition-status/ directly.
        """
        from apps.core.services.workflow_cascade import attempt_cascade

        inquiry = self.get_object()
        new_status = request.data.get("status")

        if not new_status:
            return Response({"error": "status is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Use the golden transition path so timestamps + cascade fire properly
        self.perform_document_status_transition(request, inquiry, new_status)

        # Attempt downstream cascade (best-effort, same as transition-status)
        cascade = attempt_cascade(
            tenant=getattr(request, "tenant", None),
            document=inquiry,
            new_status=new_status,
        )

        response_data = InquiryDetailSerializer(inquiry).data
        if cascade.triggered:
            response_data["_cascade"] = {
                "created_entity_type": cascade.created_entity_type,
                "created_entity_id": cascade.created_entity_id,
                "created_entity_label": cascade.created_entity_label,
                "already_existed": cascade.already_existed,
                "error": cascade.error,
            }
        return Response(response_data)

    @action(detail=True, methods=["post"], url_path="create-supplier-po-draft")
    def create_supplier_po_draft(self, request, pk=None):
        """Create or return the draft supplier PO for a qualifying normalized quote reply."""
        inquiry = self.get_object()
        serializer = CreateSupplierPurchaseOrderDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = create_supplier_quote_purchase_order_draft(
                tenant=request.tenant,
                inquiry=inquiry,
                rfq_id=serializer.validated_data["rfq_id"],
            )
        except SupplierQuotePODraftError as exc:
            raise ValidationError({"rfq_id": str(exc)}) from exc

        response_status = status.HTTP_201_CREATED if result.created else status.HTTP_200_OK
        return Response(
            {
                "created": result.created,
                "purchase_order": PurchaseOrderSerializer(
                    result.purchase_order,
                    context={"request": request},
                ).data,
            },
            status=response_status,
        )

    @action(detail=True, methods=["post"], url_path="create-sales-order-draft")
    def create_sales_order_draft(self, request, pk=None):
        """Create or return the draft sales order for a FULFILL-routed inquiry.

        POST /api/v1/inquiries/{id}/create-sales-order-draft/
        """
        from tenant_apps.sales_orders.serializers import SalesOrderSerializer as SOSerializer
        from tenant_apps.sales_orders.services.draft_sales_order import DraftSalesOrderError, create_draft_from_fulfill

        inquiry = self.get_object()

        try:
            result = create_draft_from_fulfill(
                tenant=request.tenant,
                inquiry=inquiry,
            )
        except DraftSalesOrderError as exc:
            raise ValidationError({"detail": str(exc)}) from exc

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

    @action(detail=True, methods=["post"])
    def clone(self, request, pk=None):
        """Clone an existing inquiry, optionally with products and pricing."""
        inquiry = self.get_object()
        serializer = CloneInquirySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        include_products = serializer.validated_data.get("include_products", True)
        include_pricing = serializer.validated_data.get("include_pricing", False)
        new_entity_id = serializer.validated_data.get("new_entity_id")
        new_contact_id = serializer.validated_data.get("new_contact_id")

        # Clone inquiry (without products first)
        new_inquiry = Inquiry.objects.create(
            tenant=inquiry.tenant,
            status="draft",
            source_type=inquiry.source_type,
            entity_type=inquiry.entity_type,
            route_decision=inquiry.route_decision,
            supplier_id=new_entity_id if new_entity_id and inquiry.entity_type == "supplier" else inquiry.supplier_id,
            customer_id=new_entity_id if new_entity_id and inquiry.entity_type == "customer" else inquiry.customer_id,
            contact_id=new_contact_id or inquiry.contact_id,
            requested_master_product=inquiry.requested_master_product,
            requested_protein=inquiry.requested_protein,
            contact_name=inquiry.contact_name,
            contact_email=inquiry.contact_email,
            contact_phone=inquiry.contact_phone,
            contact_company=inquiry.contact_company,
            contact_position=inquiry.contact_position,
            notes=f"Cloned from {inquiry.inquiry_number}\n{inquiry.notes}",
            created_by=request.user,
        )

        # Clone products if requested
        if include_products:
            for ip in inquiry.products.all():
                product_data = {
                    "inquiry": new_inquiry,
                    "product": ip.product,
                    "quantity": ip.quantity,
                    "desired_uom": ip.desired_uom,
                    "desired_uom_value": ip.desired_uom_value,
                    "notes": ip.notes,
                }

                # Include pricing if requested
                if include_pricing:
                    product_data.update(
                        {
                            "desired_total": ip.desired_total,
                            "desired_price_per_unit": ip.desired_price_per_unit,
                        }
                    )

                InquiryProduct.objects.create(**product_data)

        return Response(InquiryDetailSerializer(new_inquiry).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="download-quote")
    def download_quote(self, request, pk=None):
        """Generate and download a PDF quote for the inquiry."""
        from django.http import HttpResponse

        from .services.pdf_generator import InquiryPDFGenerator

        inquiry = self.get_object()

        # Generate PDF
        generator = InquiryPDFGenerator(inquiry)
        pdf_buffer = generator.generate()

        # Create response
        response = HttpResponse(pdf_buffer.read(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{generator.get_filename()}"'

        return response

    @action(detail=False, methods=["post"], url_path="from-template/(?P<template_id>[^/.]+)")
    def from_template(self, request, template_id=None):
        """Create a new inquiry from a template."""
        try:
            template = InquiryTemplate.objects.prefetch_related(
                Prefetch("products", queryset=InquiryTemplateProduct.objects.select_related("product"))
            ).get(id=template_id, tenant=request.tenant, is_active=True)
        except InquiryTemplate.DoesNotExist:
            return Response({"error": "Template not found or inactive"}, status=status.HTTP_404_NOT_FOUND)

        # Get entity and contact from request
        entity_id = request.data.get("entity_id")
        contact_id = request.data.get("contact_id")

        # Build inquiry data
        inquiry_data = {
            "tenant": request.tenant,
            "status": "draft",
            "entity_type": template.entity_type,
            "notes": template.default_notes,
            "created_by": request.user,
        }

        # Set valid_until from template
        if template.default_valid_days:
            inquiry_data["valid_until"] = timezone.now().date() + timezone.timedelta(days=template.default_valid_days)

        # Set entity based on type
        if template.entity_type == "supplier" and entity_id:
            inquiry_data["supplier_id"] = entity_id
        elif template.entity_type == "customer" and entity_id:
            inquiry_data["customer_id"] = entity_id

        if contact_id:
            inquiry_data["contact_id"] = contact_id

        # Create inquiry
        inquiry = Inquiry.objects.create(**inquiry_data)

        # Create products from template
        for tp in template.products.all():
            InquiryProduct.objects.create(
                inquiry=inquiry,
                product=tp.product,
                quantity=tp.default_quantity,
                desired_uom=tp.default_uom,
                desired_price_per_unit=tp.default_price_per_unit,
                notes=tp.notes,
            )

        # Increment template use count (tenant-scoped for safety)
        InquiryTemplate.objects.filter(id=template_id, tenant=request.tenant).update(use_count=F("use_count") + 1)

        return Response(InquiryDetailSerializer(inquiry).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def analytics(self, request):
        """
        Get win/loss analytics and inquiry statistics.

        Query params:
        - period: 'week', 'month', 'quarter', 'year' (default: 'month')
        - entity_type: 'supplier' or 'customer' (optional filter)
        """
        period = request.query_params.get("period", "month")
        entity_type = request.query_params.get("entity_type")

        # Calculate date range based on period
        now = timezone.now()
        if period == "week":
            start_date = now - timedelta(days=7)
        elif period == "month":
            start_date = now - timedelta(days=30)
        elif period == "quarter":
            start_date = now - timedelta(days=90)
        elif period == "year":
            start_date = now - timedelta(days=365)
        else:
            start_date = now - timedelta(days=30)

        # Base queryset
        base_qs = Inquiry.objects.filter(tenant=request.tenant, inquiry_date__gte=start_date)

        if entity_type:
            base_qs = base_qs.filter(entity_type=entity_type)

        # Status distribution
        status_counts = base_qs.values("status").annotate(count=Count("id")).order_by("status")

        # Win/Loss metrics
        total_closed = base_qs.filter(status__in=["accepted", "rejected"]).count()
        wins = base_qs.filter(status="accepted").count()
        losses = base_qs.filter(status="rejected").count()
        win_rate = (wins / total_closed * 100) if total_closed > 0 else 0

        # Value metrics
        value_metrics = base_qs.filter(status="accepted").aggregate(
            total_won_value=Sum("products__actual_total"),
            avg_deal_size=Avg("products__actual_total"),
        )

        lost_value = (
            base_qs.filter(status="rejected").aggregate(total_lost_value=Sum("products__desired_total"))[
                "total_lost_value"
            ]
            or 0
        )

        # Time to close (average days from creation to decision)
        closed_inquiries = base_qs.filter(status__in=["accepted", "rejected"], decision_date__isnull=False)

        avg_days_to_close = None
        if closed_inquiries.exists():
            total_days = sum(
                (i.decision_date - i.inquiry_date).days for i in closed_inquiries if i.decision_date and i.inquiry_date
            )
            avg_days_to_close = total_days / closed_inquiries.count() if closed_inquiries.count() > 0 else None

        # Trend data (grouped by week)
        trend_data = (
            base_qs.annotate(week=TruncWeek("inquiry_date"))
            .values("week")
            .annotate(
                total=Count("id"),
                accepted=Count("id", filter=Q(status="accepted")),
                rejected=Count("id", filter=Q(status="rejected")),
            )
            .order_by("week")
        )

        # Top win/loss reasons
        win_reasons = (
            base_qs.filter(status="accepted", win_loss_reason__isnull=False)
            .exclude(win_loss_reason="")
            .values_list("win_loss_reason", flat=True)[:10]
        )

        loss_reasons = (
            base_qs.filter(status="rejected", win_loss_reason__isnull=False)
            .exclude(win_loss_reason="")
            .values_list("win_loss_reason", flat=True)[:10]
        )

        # Competitor mentions
        competitor_data = base_qs.exclude(competitor_names="").values_list("competitor_names", flat=True)

        # Parse competitor names (simple split by comma/newline)
        competitor_counts = {}
        for comp_str in competitor_data:
            if comp_str:
                for comp in comp_str.replace("\n", ",").split(","):
                    comp = comp.strip()
                    if comp:
                        competitor_counts[comp] = competitor_counts.get(comp, 0) + 1

        # Sort by count and take top 10
        top_competitors = sorted(competitor_counts.items(), key=lambda x: x[1], reverse=True)[:10]

        # Source type breakdown
        source_breakdown = (
            base_qs.values("source_type")
            .annotate(
                count=Count("id"),
                won=Count("id", filter=Q(status="accepted")),
            )
            .order_by("-count")
        )

        return Response(
            {
                "period": period,
                "date_range": {
                    "start": start_date.isoformat(),
                    "end": now.isoformat(),
                },
                "summary": {
                    "total_inquiries": base_qs.count(),
                    "pending": base_qs.filter(status__in=["draft", "pending", "quoted"]).count(),
                    "won": wins,
                    "lost": losses,
                    "win_rate": round(win_rate, 1),
                    "total_won_value": float(value_metrics["total_won_value"] or 0),
                    "total_lost_value": float(lost_value),
                    "avg_deal_size": float(value_metrics["avg_deal_size"] or 0),
                    "avg_days_to_close": round(avg_days_to_close, 1) if avg_days_to_close else None,
                },
                "status_distribution": list(status_counts),
                "trend": list(trend_data),
                "source_breakdown": list(source_breakdown),
                "top_competitors": [{"name": name, "count": count} for name, count in top_competitors],
                "recent_win_reasons": list(win_reasons),
                "recent_loss_reasons": list(loss_reasons),
            }
        )

    # ------------------------------------------------------------------
    # Orchestrator endpoints (CTE-04.5)
    # ------------------------------------------------------------------

    @action(detail=True, methods=["get"], url_path="orchestrator-state")
    def orchestrator_state(self, request, pk=None):
        """Get the current happy-path orchestrator state for this inquiry.

        GET /api/v1/inquiries/{id}/orchestrator-state/
        """
        from .services.happy_path_orchestrator import get_lineage_chain, get_orchestrator_state

        inquiry = self.get_object()
        current_step = get_orchestrator_state(tenant=request.tenant, inquiry=inquiry)
        lineage = get_lineage_chain(tenant=request.tenant, inquiry=inquiry)

        return Response(
            {
                "current_step": current_step.value,
                "lineage": lineage,
            }
        )

    @action(detail=True, methods=["post"], url_path="orchestrator-advance")
    def orchestrator_advance(self, request, pk=None):
        """Advance the happy-path orchestrator for this inquiry.

        POST /api/v1/inquiries/{id}/orchestrator-advance/
        Body (optional): {"advance_through": "draft_sales_order"}
        """
        from .services.happy_path_orchestrator import OrchestratorStep, advance_orchestrator

        inquiry = self.get_object()
        advance_through = request.data.get("advance_through")

        target_step = None
        if advance_through:
            try:
                target_step = OrchestratorStep(advance_through)
            except ValueError:
                raise ValidationError(
                    {
                        "advance_through": f"Invalid step: '{advance_through}'. "
                        f"Valid: {[s.value for s in OrchestratorStep]}"
                    }
                )

        result = advance_orchestrator(
            tenant=request.tenant,
            inquiry=inquiry,
            advance_through=target_step,
            user=request.user,
        )

        return Response(
            {
                "inquiry_id": result.inquiry_id,
                "route": result.route,
                "current_step": result.current_step.value,
                "completed": result.completed,
                "blocked": result.blocked,
                "blocked_reason": result.blocked_reason,
                "steps_executed": [
                    {
                        "step": s.step.value,
                        "success": s.success,
                        "message": s.message,
                        "entity_id": s.entity_id,
                        "entity_type": s.entity_type,
                    }
                    for s in result.steps_executed
                ],
            }
        )

    @action(detail=True, methods=["get"], url_path="lineage")
    def lineage(self, request, pk=None):
        """Get the full lineage chain for this inquiry (for Process Cockpit React Flow).

        GET /api/v1/inquiries/{id}/lineage/
        """
        from .services.happy_path_orchestrator import get_lineage_chain

        inquiry = self.get_object()
        chain = get_lineage_chain(tenant=request.tenant, inquiry=inquiry)
        return Response(chain)

    @action(detail=True, methods=["get"], url_path="lineage/node-detail")
    def lineage_node_detail(self, request, pk=None):
        """Get enriched node detail for the trade lineage diagram (RT-03.3).

        GET /api/v1/inquiries/{id}/lineage/node-detail/?entity_type=...&entity_id=...

        Returns contact info, documents, inputs/outputs summary for a specific
        entity in the trade lineage chain.
        """
        inquiry = self.get_object()
        entity_type = request.query_params.get("entity_type", "")
        entity_id = request.query_params.get("entity_id", "")

        if not entity_type or not entity_id:
            return Response(
                {"detail": "entity_type and entity_id are required"},
                status=400,
            )

        detail = self._resolve_node_detail(
            inquiry=inquiry,
            entity_type=entity_type,
            entity_id=entity_id,
            tenant=request.tenant,
        )
        return Response(detail)

    def _resolve_node_detail(self, *, inquiry, entity_type, entity_id, tenant):
        """Resolve enriched detail for a lineage node."""
        from tenant_apps.purchase_orders.models import PurchaseOrder
        from tenant_apps.sales_orders.models import SalesOrder

        result = {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "label": "",
            "status": "",
            "contact": None,
            "documents": [],
            "inputs_summary": None,
            "outputs_summary": None,
        }

        if entity_type == "inquiry":
            result["label"] = f"Inquiry {getattr(inquiry, 'inquiry_number', '') or str(inquiry.id)[:8]}"
            result["status"] = inquiry.status
            result["inputs_summary"] = f"Customer: {inquiry.customer}" if inquiry.customer else None
            result["outputs_summary"] = f"Route: {inquiry.route_decision}" if inquiry.route_decision else None
            contact = getattr(inquiry, "contact", None)
            if contact:
                result["contact"] = {
                    "name": str(contact),
                    "email": getattr(contact, "email", ""),
                    "phone": getattr(contact, "phone", ""),
                    "contact_type": getattr(contact, "contact_type", ""),
                    "title": getattr(contact, "title", ""),
                    "responsibilities": [],
                }

        elif entity_type == "supplier_purchase_order":
            try:
                po = PurchaseOrder.objects.select_related("supplier").get(id=entity_id, tenant=tenant)
                result["label"] = f"Supplier PO {po.order_number or str(po.id)[:8]}"
                result["status"] = po.status
                result["outputs_summary"] = f"Supplier: {po.supplier}" if po.supplier else None
                if hasattr(po, "supplier") and po.supplier:
                    # Try to get plant contact
                    plant = po.supplier.plants.first()
                    if plant:
                        contact = plant.contacts.first()
                        if contact:
                            result["contact"] = {
                                "name": str(contact),
                                "email": getattr(contact, "email", ""),
                                "phone": getattr(contact, "phone", ""),
                                "contact_type": getattr(contact, "contact_type", ""),
                                "title": getattr(contact, "title", ""),
                                "responsibilities": list(getattr(contact, "responsibilities", None) or []),
                            }
            except PurchaseOrder.DoesNotExist:
                result["label"] = "Supplier PO (not found)"

        elif entity_type == "sales_order":
            try:
                so = SalesOrder.objects.get(id=entity_id, tenant=tenant)
                result["label"] = f"Sales Order {so.our_sales_order_num or str(so.id)[:8]}"
                result["status"] = so.status
                result["inputs_summary"] = "From bid selection"
                result["outputs_summary"] = f"Amount: {getattr(so, 'total_amount', 'N/A')}"
            except SalesOrder.DoesNotExist:
                result["label"] = "Sales Order (not found)"

        elif entity_type == "carrier_purchase_order":
            try:
                cpo = PurchaseOrder.objects.get(id=entity_id, tenant=tenant)
                result["label"] = f"Carrier PO {getattr(cpo, 'our_carrier_po_num', '') or str(cpo.id)[:8]}"
                result["status"] = cpo.status
            except PurchaseOrder.DoesNotExist:
                result["label"] = "Carrier PO (not found)"

        return result

    # ------------------------------------------------------------------
    # Trade Dependency Check (Trader Cockpit)
    # ------------------------------------------------------------------

    @action(detail=True, methods=["get"], url_path="dependency-check")
    def dependency_check(self, request, pk=None):
        """Check all required dependencies before a trade can proceed.

        GET /api/v1/inquiries/{id}/dependency-check/

        Returns a structured checklist with satisfied/missing status for
        all required master-data entities (Customer, Supplier, Plant, etc.).
        """
        from .services.trade_dependency_checker import check_trade_dependencies

        inquiry = self.get_object()
        result = check_trade_dependencies(tenant=request.tenant, inquiry=inquiry)
        return Response(result.to_dict())


class InquiryProductViewSet(viewsets.ModelViewSet):
    """ViewSet for InquiryProduct CRUD operations."""

    permission_classes = [IsAuthenticated]
    serializer_class = InquiryProductSerializer

    def get_queryset(self):
        """Filter by tenant via inquiry, prefetch supplier bids."""
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return InquiryProduct.objects.none()
        return (
            InquiryProduct.objects.filter(inquiry__tenant=tenant)
            .select_related("product", "inquiry", "ship_to_location")
            .prefetch_related("supplier_bids", "supplier_bids__supplier", "supplier_bids__plant", "supplier_bids__contact")
        )


class InquiryProductSupplierBidViewSet(viewsets.ModelViewSet):
    """ViewSet for per-product supplier bid CRUD operations."""

    permission_classes = [IsAuthenticated]
    serializer_class = InquiryProductSupplierBidSerializer

    def get_queryset(self):
        """Filter by tenant — bids belong to inquiry products scoped by tenant."""
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return InquiryProductSupplierBid.objects.none()
        return (
            InquiryProductSupplierBid.objects.filter(tenant=tenant)
            .select_related("supplier", "plant", "contact", "inquiry_product", "inquiry_product__product")
        )

    def perform_create(self, serializer):
        """Set tenant from the inquiry product's inquiry."""
        inquiry_product_id = serializer.validated_data.get('inquiry_product')
        if hasattr(inquiry_product_id, 'pk'):
            inquiry_product_id = inquiry_product_id.pk if hasattr(inquiry_product_id, 'pk') else inquiry_product_id
        serializer.save(tenant=self.request.tenant)

    @action(detail=True, methods=['post'], url_path='request-bid')
    def request_bid(self, request, pk=None):
        """Mark a single bid as 'requested' and trigger outbound email."""
        bid = self.get_object()
        if bid.bid_status not in (SupplierBidStatusChoices.DRAFT, SupplierBidStatusChoices.EXPIRED):
            return Response(
                {"error": f"Cannot request bid in status '{bid.bid_status}'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bid.bid_status = SupplierBidStatusChoices.REQUESTED
        bid.requested_at = timezone.now()
        bid.save(update_fields=['bid_status', 'requested_at', 'modified_on'])

        # Dispatch outbound RFQ email for this supplier
        rfq_error = None
        try:
            from tenant_apps.inquiries.services.supplier_rfq_email import send_supplier_rfqs_for_inquiry

            inquiry = bid.inquiry_product.inquiry
            result = send_supplier_rfqs_for_inquiry(
                tenant=request.tenant,
                inquiry=inquiry,
                user=request.user,
                supplier_ids=[bid.supplier_id],
            )
            # Link the RFQ audit row to the bid
            for entry in result.entries:
                if entry.rfq_id and entry.supplier_id == bid.supplier_id:
                    bid.rfq_id = entry.rfq_id
                    bid.save(update_fields=['rfq_id', 'modified_on'])
                    break
        except Exception as exc:
            logger.warning("RFQ email dispatch failed for bid %s: %s", bid.id, exc, exc_info=True)
            rfq_error = str(exc)

        data = InquiryProductSupplierBidSerializer(bid).data
        if rfq_error:
            data["rfq_dispatch_error"] = rfq_error
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='request-all-bids')
    def request_all_bids(self, request):
        """Bulk-request bids for all draft bids on a given inquiry product."""
        inquiry_product_id = request.data.get('inquiry_product_id')
        if not inquiry_product_id:
            return Response(
                {"error": "inquiry_product_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        draft_bids = self.get_queryset().filter(
            inquiry_product_id=inquiry_product_id,
            bid_status__in=[SupplierBidStatusChoices.DRAFT, SupplierBidStatusChoices.EXPIRED],
        )

        supplier_ids = list(draft_bids.values_list('supplier_id', flat=True))

        now = timezone.now()
        updated = draft_bids.update(
            bid_status=SupplierBidStatusChoices.REQUESTED,
            requested_at=now,
        )

        # Dispatch outbound RFQ emails for all suppliers in one batch
        rfq_error = None
        rfq_dispatched = 0
        if supplier_ids:
            try:
                from tenant_apps.inquiries.services.supplier_rfq_email import send_supplier_rfqs_for_inquiry

                inquiry_product = InquiryProduct.objects.filter(
                    id=inquiry_product_id, tenant=request.tenant
                ).select_related('inquiry').first()
                if inquiry_product:
                    result = send_supplier_rfqs_for_inquiry(
                        tenant=request.tenant,
                        inquiry=inquiry_product.inquiry,
                        user=request.user,
                        supplier_ids=supplier_ids,
                    )
                    rfq_dispatched = result.dispatched_count
                    # Link RFQ audit rows back to bid records
                    rfq_map = {e.supplier_id: e.rfq_id for e in result.entries if e.rfq_id}
                    for bid in self.get_queryset().filter(
                        inquiry_product_id=inquiry_product_id,
                        supplier_id__in=rfq_map.keys(),
                    ):
                        bid.rfq_id = rfq_map[bid.supplier_id]
                        bid.save(update_fields=['rfq_id', 'modified_on'])
            except Exception as exc:
                logger.warning("Bulk RFQ email dispatch failed: %s", exc, exc_info=True)
                rfq_error = str(exc)

        resp = {
            "updated": updated,
            "rfq_dispatched": rfq_dispatched,
            "message": f"Requested bids for {updated} supplier(s), {rfq_dispatched} email(s) sent",
        }
        if rfq_error:
            resp["rfq_dispatch_error"] = rfq_error
        return Response(resp, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='accept')
    def accept_bid(self, request, pk=None):
        """Accept a received bid — sets it as accepted and updates parent product pricing.

        When all inquiry products have an accepted bid, attempts to advance the
        trade session to the next orchestrator step (draft PO).
        """
        bid = self.get_object()
        if bid.bid_status != SupplierBidStatusChoices.RECEIVED:
            return Response(
                {"error": f"Can only accept bids in 'received' status, got '{bid.bid_status}'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bid.bid_status = SupplierBidStatusChoices.ACCEPTED
        bid.save(update_fields=['bid_status', 'modified_on'])

        # Update the parent inquiry product with accepted bid pricing
        product = bid.inquiry_product
        product.supplier = bid.supplier
        product.plant = bid.plant
        product.actual_price_per_unit = bid.bid_price_per_unit
        product.actual_total = bid.bid_total
        if bid.bid_uom:
            product.actual_uom = bid.bid_uom
        product.save(update_fields=[
            'supplier', 'plant', 'actual_price_per_unit', 'actual_total',
            'actual_uom', 'modified_on',
        ])

        # Reject other received bids for this product
        InquiryProductSupplierBid.objects.filter(
            inquiry_product=product,
            bid_status=SupplierBidStatusChoices.RECEIVED,
            tenant=self.request.tenant,
        ).exclude(pk=bid.pk).update(bid_status=SupplierBidStatusChoices.REJECTED)

        resp_data = InquiryProductSupplierBidSerializer(bid).data

        # Check if ALL products now have an accepted bid → advance trade session
        try:
            inquiry = product.inquiry
            tenant = self.request.tenant
            all_products = InquiryProduct.objects.filter(inquiry=inquiry, tenant=tenant)
            products_with_accepted = InquiryProductSupplierBid.objects.filter(
                inquiry_product__in=all_products,
                bid_status=SupplierBidStatusChoices.ACCEPTED,
                tenant=tenant,
            ).values_list('inquiry_product_id', flat=True).distinct()

            if all_products.count() > 0 and set(all_products.values_list('id', flat=True)).issubset(set(products_with_accepted)):
                # All products have accepted bids — try to advance orchestrator
                from tenant_apps.inquiries.services.happy_path_orchestrator import advance_orchestrator
                result = advance_orchestrator(
                    tenant=tenant,
                    inquiry=inquiry,
                    user=request.user if request.user.is_authenticated else None,
                )
                if result.steps_executed:
                    resp_data['_orchestrator'] = {
                        'advanced': True,
                        'current_step': str(result.current_step.value) if result.current_step else None,
                        'completed': result.completed,
                    }
                    logger.info(
                        "accept_bid: all products have bids accepted, orchestrator advanced to %s for inquiry %s",
                        result.current_step, inquiry.id,
                    )
        except Exception:
            logger.exception("accept_bid: failed to advance orchestrator after bid acceptance")

        return Response(resp_data, status=status.HTTP_200_OK)


class InquiryTemplateViewSet(viewsets.ModelViewSet):
    """ViewSet for InquiryTemplate CRUD operations."""

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter by tenant."""
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return InquiryTemplate.objects.none()
        queryset = InquiryTemplate.objects.filter(tenant=tenant).prefetch_related("products")

        # Filter by entity_type if provided
        entity_type = self.request.query_params.get("entity_type")
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)

        # Filter by is_active if provided
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        return queryset

    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == "list":
            return InquiryTemplateListSerializer
        elif self.action in ("create", "update", "partial_update"):
            return InquiryTemplateCreateSerializer
        return InquiryTemplateDetailSerializer

    def perform_create(self, serializer):
        """Set tenant and created_by on create."""
        serializer.save(tenant=self.request.tenant, created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def add_products(self, request, pk=None):
        """Add products to an existing template."""
        template = self.get_object()
        products_data = request.data.get("products", [])

        created_products = []
        for product_data in products_data:
            product = InquiryTemplateProduct.objects.create(
                template=template,
                product_id=product_data.get("product"),
                default_quantity=product_data.get("default_quantity", 0),
                default_uom=product_data.get("default_uom", "LBS"),
                default_price_per_unit=product_data.get("default_price_per_unit"),
                notes=product_data.get("notes", ""),
                sort_order=product_data.get("sort_order", 0),
            )
            created_products.append(product)

        return Response(InquiryTemplateDetailSerializer(template).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Trade Document CRUD
# ---------------------------------------------------------------------------


class TradeDocumentViewSet(viewsets.ModelViewSet):
    """Tenant-scoped CRUD for trade documents.

    Supports listing documents by trade session or by entity type/id.
    Supports file upload for manual document attachment.
    """

    serializer_class = TradeDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return TradeDocument.objects.none()
        qs = TradeDocument.objects.filter(tenant=tenant)

        session_id = self.request.query_params.get("trade_session")
        if session_id:
            qs = qs.filter(trade_session_id=session_id)

        entity_type = self.request.query_params.get("entity_type")
        entity_id = self.request.query_params.get("entity_id")
        if entity_type and entity_id:
            qs = qs.filter(entity_type=entity_type, entity_id=entity_id)

        stage = self.request.query_params.get("stage")
        if stage:
            qs = qs.filter(stage=stage)

        return qs.select_related("email_log", "trade_session")

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)

    def get_serializer_class(self):
        if self.action == "create":
            return TradeDocumentUploadSerializer
        return TradeDocumentSerializer
