"""Trade Pipeline API Views.

Provides the Trader Cockpit endpoints for initiating, listing, and advancing
trades through the happy-path orchestrator with dependency pre-validation.

Endpoints:
    POST /api/v1/trades/initiate/       — Create inquiry + trade session + dep check
    GET  /api/v1/trades/active/         — List active trade sessions with status
    POST /api/v1/trades/{id}/advance/   — Advance orchestrator (wraps existing)
    GET  /api/v1/trades/{id}/status/    — Get full trade status with lineage
"""

from __future__ import annotations

import logging

from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from tenant_apps.inquiries.models import (
    Inquiry,
    InquiryEntityTypeChoices,
    InquiryRouteDecisionChoices,
    InquiryStatusChoices,
    TradeSession,
    TradeSessionStatus,
)
from tenant_apps.inquiries.services.happy_path_orchestrator import (
    OrchestratorStep,
    advance_orchestrator,
    get_lineage_chain,
    get_orchestrator_state,
)
from tenant_apps.inquiries.services.trade_dependency_checker import check_trade_dependencies
from tenant_apps.inquiries.services.trade_session import get_or_create_trade_session

from apps.tenants.rls import tenant_rls

logger = logging.getLogger(__name__)


class TradePipelineViewSet(viewsets.ViewSet):
    """Trade Pipeline API for the Trader Cockpit.

    Provides high-level trade lifecycle management that wraps the existing
    inquiry + orchestrator + trade session infrastructure.
    """

    permission_classes = [IsAuthenticated]

    def _get_tenant(self, request):
        """Safe tenant accessor — returns None if tenant missing."""
        return getattr(request, "tenant", None)

    def _require_tenant(self, request):
        """Safe tenant accessor — returns (tenant, error_response) tuple."""
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return None, Response(
                {"detail": "Tenant context not available."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return tenant, None

    def list(self, request):
        """GET /api/v1/trades/ — List trade sessions.

        Returns trade sessions with their current orchestrator state,
        dependency status, and key metadata.

        Supports optional query params:
        - status: filter by session status (e.g., ?status=active or ?status=completed)
        - If no status param, returns ALL trade sessions for client-side filtering.

        NOTE: Also lazily creates TradeSession records for any orphaned inquiries
        (inquiries without a trade session) so all user-created inquiries appear.
        """
        tenant, err = self._require_tenant(request)
        if err:
            return err

        try:
            return self._list_trades(request, tenant)
        except Exception as exc:
            logger.exception("Unhandled error in trades list endpoint: %s", exc)
            return Response(
                {"count": 0, "results": [], "error": f"Failed to load trades: {type(exc).__name__}"},
                status=status.HTTP_200_OK,
            )

    def _list_trades(self, request, tenant):
        """Internal implementation of trade listing (extracted for error isolation)."""

        # Lazily backfill: find inquiries without a trade session and create one.
        # This handles legacy inquiries created before auto-TradeSession was deployed,
        # or cases where the auto-create in perform_create silently failed.
        orphaned_inquiries = (
            Inquiry.objects.filter(tenant=tenant)
            .filter(trade_session__isnull=True)
            .exclude(status="cancelled")
            .order_by("-created_on")[:50]
        )
        for inq in orphaned_inquiries:
            try:
                get_or_create_trade_session(tenant=tenant, inquiry=inq)
            except Exception:
                logger.debug(
                    "Failed to backfill TradeSession for inquiry %s",
                    inq.id,
                    exc_info=True,
                )

        qs = (
            TradeSession.objects.filter(tenant=tenant)
            .select_related(
                "inquiry",
                "inquiry__customer",
                "inquiry__supplier",
                "inquiry__supplier_purchase_order",
                "inquiry__sales_order",
            )
            .prefetch_related("inquiry__products", "inquiry__products__product")
            .order_by("-initiated_at")
        )

        # Optional server-side status filtering
        status_filter = request.query_params.get("status")
        if status_filter == "active":
            qs = qs.exclude(
                status__in=[
                    TradeSessionStatus.COMPLETED,
                    TradeSessionStatus.CANCELLED,
                    TradeSessionStatus.HALTED,
                ],
            )
        elif status_filter == "completed":
            qs = qs.filter(
                status__in=[
                    TradeSessionStatus.COMPLETED,
                    TradeSessionStatus.CANCELLED,
                    TradeSessionStatus.HALTED,
                ],
            )
        elif status_filter and status_filter in TradeSessionStatus.values:
            qs = qs.filter(status=status_filter)

        sessions = list(qs[:100])

        trades = []
        for session in sessions:
            inquiry = session.inquiry
            try:
                current_step = get_orchestrator_state(tenant=tenant, inquiry=inquiry)
                step_value = current_step.value if current_step else ""
            except Exception:
                logger.warning(
                    "Failed to derive orchestrator state for trade %s (inquiry %s)",
                    session.trade_id,
                    inquiry.id,
                )
                step_value = session.status or ""

            try:
                products_summary = ""
                if hasattr(inquiry, "products"):
                    product_names = []
                    for p in list(inquiry.products.all())[:3]:
                        if p.product_id and p.product is not None:
                            name = getattr(p.product, "name", None) or getattr(p.product, "item_name", None)
                            if name:
                                product_names.append(name)
                    products_summary = ", ".join(product_names)

                trades.append(
                    {
                        "id": str(session.id),
                        "trade_id": session.trade_id,
                        "status": session.status,
                        "route": session.route_decision or inquiry.route_decision or "",
                        "current_step": step_value,
                        "inquiry_id": str(inquiry.id),
                        "entity_type": inquiry.entity_type or "",
                        "customer_name": (getattr(inquiry.customer, "name", None) if inquiry.customer_id else None),
                        "supplier_name": (getattr(inquiry.supplier, "name", None) if inquiry.supplier_id else None),
                        "party_name": (
                            getattr(inquiry.supplier, "name", None)
                            if inquiry.entity_type == "supplier" and inquiry.supplier_id
                            else (getattr(inquiry.customer, "name", None) if inquiry.customer_id else None)
                        ),
                        "products_summary": products_summary,
                        "valid_until": (inquiry.valid_until.isoformat() if inquiry.valid_until else None),
                        "source_email_subject": session.source_email_subject or "",
                        "initiated_at": session.initiated_at.isoformat() if session.initiated_at else None,
                        "updated_at": (
                            session.updated_at.isoformat()
                            if hasattr(session, "updated_at") and session.updated_at
                            else None
                        ),
                        "supplier_purchase_order_id": (
                            str(inquiry.supplier_purchase_order_id) if inquiry.supplier_purchase_order_id else None
                        ),
                        "sales_order_id": str(inquiry.sales_order_id) if inquiry.sales_order_id else None,
                        "carrier_purchase_order_id": (
                            str(inquiry.carrier_purchase_order_id) if inquiry.carrier_purchase_order_id else None
                        ),
                        "fulfillment_id": (inquiry.custom_data or {}).get("fulfillment_id"),
                        "invoice_id": (inquiry.custom_data or {}).get("invoice_id"),
                    }
                )
            except Exception:
                logger.warning(
                    "Failed to serialize trade %s (inquiry %s), skipping",
                    session.trade_id,
                    inquiry.id,
                    exc_info=True,
                )

        return Response(
            {
                "count": len(trades),
                "results": trades,
            }
        )

    @action(detail=False, methods=["post"], url_path="initiate")
    def initiate(self, request):
        """POST /api/v1/trades/initiate/ — Create a new trade.

        Creates an inquiry + trade session and returns the dependency check.

        Body:
            {
                "customer_id": "uuid" (optional),
                "supplier_id": "uuid" (optional),
                "route": "FULFILL" | "BROKER" (default: FULFILL),
                "description": "string" (optional),
                "type_of_protein": "string" (optional),
            }
        """
        tenant, err = self._require_tenant(request)
        if err:
            return err
        user = request.user
        data = request.data

        route = data.get("route", InquiryRouteDecisionChoices.FULFILL)
        if route not in [InquiryRouteDecisionChoices.FULFILL, InquiryRouteDecisionChoices.BROKER]:
            return Response(
                {"detail": f"Invalid route: {route}. Must be FULFILL or BROKER."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
            # Determine entity_type from provided IDs (customer takes priority)
            customer_id = data.get("customer_id") or None
            supplier_id = data.get("supplier_id") or None
            if customer_id:
                entity_type = InquiryEntityTypeChoices.CUSTOMER
            elif supplier_id:
                entity_type = InquiryEntityTypeChoices.SUPPLIER
            else:
                # Default to customer for manual initiation
                entity_type = InquiryEntityTypeChoices.CUSTOMER

            # Create the root inquiry
            inquiry = Inquiry.objects.create(
                tenant=tenant,
                status=InquiryStatusChoices.DRAFT,
                route_decision=route,
                entity_type=entity_type,
                customer_id=customer_id,
                supplier_id=supplier_id,
                notes=data.get("description", ""),
                requested_protein=data.get("type_of_protein", ""),
                created_by=user,
            )

            # Create trade session
            trade_session, _ = get_or_create_trade_session(tenant=tenant, inquiry=inquiry)

            # Check dependencies
            dep_result = check_trade_dependencies(tenant=tenant, inquiry=inquiry)

        logger.info(
            "Telemetry: trade.initiated",
            extra={
                "event_type": "trade.initiated",
                "tenant_id": str(tenant.id),
                "trade_id": trade_session.trade_id,
                "inquiry_id": str(inquiry.id),
                "route": route,
                "deps_satisfied": dep_result.all_satisfied,
            },
        )

        return Response(
            {
                "trade_id": trade_session.trade_id,
                "trade_session_id": str(trade_session.id),
                "inquiry_id": str(inquiry.id),
                "route": route,
                "dependencies": dep_result.to_dict(),
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="smart-initiate")
    def smart_initiate(self, request):
        """POST /api/v1/trades/smart-initiate/ — Smart trade creation with AI context.

        Accepts a richer payload including free-text descriptions, and returns
        AI-extracted suggestions alongside the standard trade initiation result.

        Body:
            {
                "route": "FULFILL" | "BROKER" (optional, inferred from text),
                "customer_id": "uuid" (optional),
                "supplier_id": "uuid" (optional),
                "description": "string" (optional, free text for AI extraction),
                "type_of_protein": "string" (optional),
                "weight": "string" (optional),
                "delivery_context": "customer_pickup" | "supplier_delivery" (optional),
            }

        Returns standard TradeInitiateResponse plus:
            "context_suggestions": [
                {"field": "...", "value": "...", "confidence": 0.9, "reason": "..."}
            ]
        """
        tenant, err = self._require_tenant(request)
        if err:
            return err
        user = request.user
        data = request.data

        # Determine route (default FULFILL)
        route = data.get("route", InquiryRouteDecisionChoices.FULFILL)
        if route not in [InquiryRouteDecisionChoices.FULFILL, InquiryRouteDecisionChoices.BROKER]:
            route = InquiryRouteDecisionChoices.FULFILL

        # Build context suggestions based on tenant history
        context_suggestions = []

        # If customer specified, suggest billing/delivery from their data
        customer_id = data.get("customer_id")
        if customer_id:
            try:
                from tenant_apps.customers.models import Customer

                customer = Customer.objects.filter(tenant=tenant, id=customer_id).first()
                if customer:
                    if hasattr(customer, "billing_address") and customer.billing_address:
                        context_suggestions.append(
                            {
                                "field": "billing_address",
                                "value": customer.billing_address,
                                "confidence": 0.9,
                                "source": "linked_entity",
                                "reason": f"Billing address from {customer.name}",
                            }
                        )
            except Exception:
                logger.warning("Failed to fetch customer context for trade creation", exc_info=True)

        # Protein type inference from recent trades
        protein = data.get("type_of_protein", "")
        if not protein and customer_id:
            try:
                recent_inquiry = (
                    Inquiry.objects.filter(
                        tenant=tenant,
                        customer_id=customer_id,
                    )
                    .exclude(requested_protein="")
                    .order_by("-created_on")
                    .first()
                )
                if recent_inquiry and recent_inquiry.requested_protein:
                    context_suggestions.append(
                        {
                            "field": "type_of_protein",
                            "value": recent_inquiry.requested_protein,
                            "confidence": 0.7,
                            "source": "history",
                            "reason": "Most recent protein for this customer",
                        }
                    )
                    protein = recent_inquiry.requested_protein
            except Exception:
                logger.warning("Failed to infer protein type from trade history", exc_info=True)

        with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
            # Determine entity_type from provided IDs
            customer_id_val = customer_id or None
            supplier_id_val = data.get("supplier_id") or None
            if customer_id_val:
                entity_type = InquiryEntityTypeChoices.CUSTOMER
            elif supplier_id_val:
                entity_type = InquiryEntityTypeChoices.SUPPLIER
            else:
                entity_type = InquiryEntityTypeChoices.CUSTOMER

            inquiry = Inquiry.objects.create(
                tenant=tenant,
                status=InquiryStatusChoices.DRAFT,
                route_decision=route,
                entity_type=entity_type,
                customer_id=customer_id_val,
                supplier_id=supplier_id_val,
                notes=data.get("description", ""),
                requested_protein=protein,
                created_by=user,
            )

            trade_session, _ = get_or_create_trade_session(tenant=tenant, inquiry=inquiry)

            dep_result = check_trade_dependencies(tenant=tenant, inquiry=inquiry)

        logger.info(
            "Telemetry: trade.smart_initiated",
            extra={
                "event_type": "trade.smart_initiated",
                "tenant_id": str(tenant.id),
                "trade_id": trade_session.trade_id,
                "inquiry_id": str(inquiry.id),
                "route": route,
                "suggestions_count": len(context_suggestions),
                "deps_satisfied": dep_result.all_satisfied,
            },
        )

        return Response(
            {
                "trade_id": trade_session.trade_id,
                "trade_session_id": str(trade_session.id),
                "inquiry_id": str(inquiry.id),
                "route": route,
                "dependencies": dep_result.to_dict(),
                "context_suggestions": context_suggestions,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="advance")
    def advance(self, request, pk=None):
        """POST /api/v1/trades/{id}/advance/ — Advance a trade.

        Wraps the existing orchestrator advance with dependency pre-check.

        Body (optional):
            {"advance_through": "draft_sales_order"}
        """
        tenant, err = self._require_tenant(request)
        if err:
            return err
        user = request.user

        try:
            trade_session = TradeSession.objects.select_related("inquiry").get(
                tenant=tenant,
                id=pk,
            )
        except TradeSession.DoesNotExist:
            return Response(
                {"detail": "Trade session not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        inquiry = trade_session.inquiry

        # Pre-check dependencies
        dep_result = check_trade_dependencies(tenant=tenant, inquiry=inquiry)
        if not dep_result.all_satisfied:
            return Response(
                {
                    "detail": "Cannot advance: missing required dependencies.",
                    "dependencies": dep_result.to_dict(),
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Advance orchestrator
        advance_through = request.data.get("advance_through")
        target_step = None
        if advance_through:
            try:
                target_step = OrchestratorStep(advance_through)
            except ValueError:
                return Response(
                    {"detail": f"Invalid step: '{advance_through}'."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        result = advance_orchestrator(
            tenant=tenant,
            inquiry=inquiry,
            advance_through=target_step,
            user=user,
        )

        return Response(
            {
                "trade_id": trade_session.trade_id,
                "inquiry_id": str(inquiry.id),
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

    @action(detail=True, methods=["get"], url_path="status")
    def trade_status(self, request, pk=None):
        """GET /api/v1/trades/{id}/status/ — Full trade status with lineage.

        Returns current step, dependency check, and full lineage chain.
        """
        tenant, err = self._require_tenant(request)
        if err:
            return err

        try:
            trade_session = TradeSession.objects.select_related("inquiry").get(
                tenant=tenant,
                id=pk,
            )
        except TradeSession.DoesNotExist:
            return Response(
                {"detail": "Trade session not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        inquiry = trade_session.inquiry
        current_step = get_orchestrator_state(tenant=tenant, inquiry=inquiry)
        lineage = get_lineage_chain(tenant=tenant, inquiry=inquiry)
        dep_result = check_trade_dependencies(tenant=tenant, inquiry=inquiry)

        return Response(
            {
                "trade_id": trade_session.trade_id,
                "trade_session_id": str(trade_session.id),
                "status": trade_session.status,
                "route": trade_session.route_decision or inquiry.route_decision or "",
                "current_step": current_step.value,
                "initiated_at": trade_session.initiated_at.isoformat() if trade_session.initiated_at else None,
                "inquiry_id": str(inquiry.id),
                "customer_name": (
                    getattr(inquiry.customer, "name", None)
                    if hasattr(inquiry, "customer") and inquiry.customer_id
                    else None
                ),
                "lineage": lineage,
                "dependencies": dep_result.to_dict(),
            }
        )

    @action(detail=False, methods=["get"], url_path="proposals")
    def proposals(self, request):
        """GET /api/v1/trades/proposals/ — AI-generated trade proposals.

        Returns proactive trade suggestions based on recent emails, tenant
        history, customer patterns, and market signals.
        """
        tenant, err = self._require_tenant(request)
        if err:
            return err
        proposals = []

        # Generate proposals from recent draft inquiries without active trade sessions
        draft_inquiries = (
            Inquiry.objects.filter(
                tenant=tenant,
                status=InquiryStatusChoices.DRAFT,
            )
            .select_related("customer")
            .order_by("-created_on")[:10]
        )

        for inquiry in draft_inquiries:
            # Check if this inquiry already has an active trade session
            existing = (
                TradeSession.objects.filter(tenant=tenant, inquiry=inquiry)
                .exclude(status=TradeSessionStatus.CANCELLED)
                .first()
            )
            if existing:
                continue

            # Calculate confidence based on data completeness
            confidence = 0.5
            if inquiry.customer_id:
                confidence += 0.15
            if inquiry.requested_protein:
                confidence += 0.1
            if inquiry.notes:
                confidence += 0.1
            if inquiry.route_decision:
                confidence += 0.1

            source = "email" if getattr(inquiry, "source_email_subject", None) else "history"
            title = (
                getattr(inquiry, "source_email_subject", "")
                or inquiry.notes
                or f"Trade for {inquiry.requested_protein or 'unknown protein'}"
            )

            proposals.append(
                {
                    "id": str(inquiry.id),
                    "title": title[:80],
                    "confidence": round(min(confidence, 0.99), 2),
                    "source": source,
                    "route": inquiry.route_decision or "FULFILL",
                    "customer_name": getattr(inquiry.customer, "name", None) if inquiry.customer_id else None,
                    "supplier_name": None,
                    "type_of_protein": inquiry.requested_protein or None,
                    "weight": None,
                    "delivery_context": None,
                    "suggested_fields": [],
                    "created_at": (
                        inquiry.created_on.isoformat()
                        if hasattr(inquiry, "created_on") and inquiry.created_on
                        else None
                    ),
                    "expires_at": None,
                    "status": "pending",
                }
            )

        return Response({"results": proposals})

    @action(detail=True, methods=["post"], url_path="execute-proposal")
    def execute_proposal(self, request, pk=None):
        """POST /api/v1/trades/{inquiry_id}/execute-proposal/ — Execute an AI proposal.

        Takes a draft inquiry and converts it into a full trade with session
        and dependency check, identical to smart-initiate but from existing inquiry.
        """
        tenant, err = self._require_tenant(request)
        if err:
            return err
        request.user

        try:
            inquiry = Inquiry.objects.get(tenant=tenant, id=pk)
        except Inquiry.DoesNotExist:
            return Response(
                {"error": "Proposal not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        route = inquiry.route_decision or InquiryRouteDecisionChoices.FULFILL

        with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
            inquiry.status = InquiryStatusChoices.PENDING
            inquiry.save(update_fields=["status"])

            trade_session, _ = get_or_create_trade_session(tenant=tenant, inquiry=inquiry)
            dep_result = check_trade_dependencies(tenant=tenant, inquiry=inquiry)

        logger.info(
            "Telemetry: trade.proposal_executed",
            extra={
                "event_type": "trade.proposal_executed",
                "tenant_id": str(tenant.id),
                "trade_id": trade_session.trade_id,
                "inquiry_id": str(inquiry.id),
            },
        )

        return Response(
            {
                "trade_id": trade_session.trade_id,
                "trade_session_id": str(trade_session.id),
                "inquiry_id": str(inquiry.id),
                "route": route,
                "dependencies": dep_result.to_dict(),
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="proposal-feedback")
    def proposal_feedback(self, request, pk=None):
        """POST /api/v1/trades/{inquiry_id}/proposal-feedback/ — Submit feedback on a proposal.

        Records user feedback for confidence engine training.
        """
        tenant, err = self._require_tenant(request)
        if err:
            return err
        signal = request.data.get("signal", "")
        comment = request.data.get("comment", "")

        if signal not in ("thumbs_up", "thumbs_down"):
            return Response(
                {"error": "signal must be 'thumbs_up' or 'thumbs_down'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        logger.info(
            "Telemetry: trade.proposal_feedback",
            extra={
                "event_type": "trade.proposal_feedback",
                "tenant_id": str(tenant.id),
                "proposal_id": pk,
                "signal": signal,
                "comment": comment[:200] if comment else "",
            },
        )

        return Response({"status": "recorded"})
