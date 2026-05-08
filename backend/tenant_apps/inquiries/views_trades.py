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

from apps.tenants.rls import tenant_rls
from tenant_apps.inquiries.models import (
    Inquiry,
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
from tenant_apps.inquiries.services.trade_dependency_checker import (
    check_trade_dependencies,
)
from tenant_apps.inquiries.services.trade_session import (
    get_or_create_trade_session,
)

logger = logging.getLogger(__name__)


class TradePipelineViewSet(viewsets.ViewSet):
    """Trade Pipeline API for the Trader Cockpit.

    Provides high-level trade lifecycle management that wraps the existing
    inquiry + orchestrator + trade session infrastructure.
    """

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """GET /api/v1/trades/ — List active trade sessions.

        Returns active trade sessions with their current orchestrator state,
        dependency status, and key metadata.
        """
        tenant = request.tenant
        sessions = TradeSession.objects.filter(
            tenant=tenant,
        ).exclude(
            status__in=[TradeSessionStatus.COMPLETED, TradeSessionStatus.CANCELLED],
        ).select_related("inquiry").order_by("-initiated_at")[:50]

        trades = []
        for session in sessions:
            inquiry = session.inquiry
            current_step = get_orchestrator_state(
                tenant=tenant, inquiry=inquiry
            )

            trades.append({
                "id": str(session.id),
                "trade_id": session.trade_id,
                "status": session.status,
                "route": session.route_decision or inquiry.route_decision or "",
                "current_step": current_step.value,
                "inquiry_id": str(inquiry.id),
                "customer_name": getattr(inquiry.customer, "name", None) if hasattr(inquiry, "customer") and inquiry.customer_id else None,
                "source_email_subject": session.source_email_subject or "",
                "initiated_at": session.initiated_at.isoformat() if session.initiated_at else None,
                "updated_at": session.updated_at.isoformat() if hasattr(session, "updated_at") and session.updated_at else None,
            })

        return Response({
            "count": len(trades),
            "results": trades,
        })

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
        tenant = request.tenant
        user = request.user
        data = request.data

        route = data.get("route", InquiryRouteDecisionChoices.FULFILL)
        if route not in [InquiryRouteDecisionChoices.FULFILL, InquiryRouteDecisionChoices.BROKER]:
            return Response(
                {"detail": f"Invalid route: {route}. Must be FULFILL or BROKER."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
            # Create the root inquiry
            inquiry = Inquiry.objects.create(
                tenant=tenant,
                status=InquiryStatusChoices.DRAFT,
                route_decision=route,
                customer_id=data.get("customer_id") or None,
                supplier_id=data.get("supplier_id") or None,
                description=data.get("description", ""),
                type_of_protein=data.get("type_of_protein", ""),
                created_by=user,
            )

            # Create trade session
            trade_session, _ = get_or_create_trade_session(
                tenant=tenant, inquiry=inquiry
            )

            # Check dependencies
            dep_result = check_trade_dependencies(
                tenant=tenant, inquiry=inquiry
            )

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

        return Response({
            "trade_id": trade_session.trade_id,
            "trade_session_id": str(trade_session.id),
            "inquiry_id": str(inquiry.id),
            "route": route,
            "dependencies": dep_result.to_dict(),
        }, status=status.HTTP_201_CREATED)

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
        tenant = request.tenant
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
                customer = Customer.objects.filter(
                    tenant=tenant, id=customer_id
                ).first()
                if customer:
                    if hasattr(customer, "billing_address") and customer.billing_address:
                        context_suggestions.append({
                            "field": "billing_address",
                            "value": customer.billing_address,
                            "confidence": 0.9,
                            "source": "linked_entity",
                            "reason": f"Billing address from {customer.name}",
                        })
            except Exception:
                pass

        # Protein type inference from recent trades
        protein = data.get("type_of_protein", "")
        if not protein and customer_id:
            try:
                recent_inquiry = Inquiry.objects.filter(
                    tenant=tenant, customer_id=customer_id,
                ).exclude(type_of_protein="").order_by("-created_at").first()
                if recent_inquiry and recent_inquiry.type_of_protein:
                    context_suggestions.append({
                        "field": "type_of_protein",
                        "value": recent_inquiry.type_of_protein,
                        "confidence": 0.7,
                        "source": "history",
                        "reason": f"Most recent protein for this customer",
                    })
                    protein = recent_inquiry.type_of_protein
            except Exception:
                pass

        with transaction.atomic(), tenant_rls(str(tenant.id), strict=True):
            inquiry = Inquiry.objects.create(
                tenant=tenant,
                status=InquiryStatusChoices.DRAFT,
                route_decision=route,
                customer_id=customer_id or None,
                supplier_id=data.get("supplier_id") or None,
                description=data.get("description", ""),
                type_of_protein=protein,
                created_by=user,
            )

            trade_session, _ = get_or_create_trade_session(
                tenant=tenant, inquiry=inquiry
            )

            dep_result = check_trade_dependencies(
                tenant=tenant, inquiry=inquiry
            )

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

        return Response({
            "trade_id": trade_session.trade_id,
            "trade_session_id": str(trade_session.id),
            "inquiry_id": str(inquiry.id),
            "route": route,
            "dependencies": dep_result.to_dict(),
            "context_suggestions": context_suggestions,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="advance")
    def advance(self, request, pk=None):
        """POST /api/v1/trades/{id}/advance/ — Advance a trade.

        Wraps the existing orchestrator advance with dependency pre-check.

        Body (optional):
            {"advance_through": "draft_sales_order"}
        """
        tenant = request.tenant
        user = request.user

        try:
            trade_session = TradeSession.objects.select_related("inquiry").get(
                tenant=tenant, id=pk,
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
            return Response({
                "detail": "Cannot advance: missing required dependencies.",
                "dependencies": dep_result.to_dict(),
            }, status=status.HTTP_409_CONFLICT)

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

        return Response({
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
        })

    @action(detail=True, methods=["get"], url_path="status")
    def trade_status(self, request, pk=None):
        """GET /api/v1/trades/{id}/status/ — Full trade status with lineage.

        Returns current step, dependency check, and full lineage chain.
        """
        tenant = request.tenant

        try:
            trade_session = TradeSession.objects.select_related("inquiry").get(
                tenant=tenant, id=pk,
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

        return Response({
            "trade_id": trade_session.trade_id,
            "trade_session_id": str(trade_session.id),
            "status": trade_session.status,
            "route": trade_session.route_decision or inquiry.route_decision or "",
            "current_step": current_step.value,
            "initiated_at": trade_session.initiated_at.isoformat() if trade_session.initiated_at else None,
            "inquiry_id": str(inquiry.id),
            "customer_name": getattr(inquiry.customer, "name", None) if hasattr(inquiry, "customer") and inquiry.customer_id else None,
            "lineage": lineage,
            "dependencies": dep_result.to_dict(),
        })

    @action(detail=False, methods=["get"], url_path="proposals")
    def proposals(self, request):
        """GET /api/v1/trades/proposals/ — AI-generated trade proposals.

        Returns proactive trade suggestions based on recent emails, tenant
        history, customer patterns, and market signals.
        """
        tenant = request.tenant
        proposals = []

        # Generate proposals from recent draft inquiries without active trade sessions
        draft_inquiries = Inquiry.objects.filter(
            tenant=tenant,
            status=InquiryStatusChoices.DRAFT,
        ).select_related("customer").order_by("-created_at")[:10]

        for inquiry in draft_inquiries:
            # Check if this inquiry already has an active trade session
            existing = TradeSession.objects.filter(
                tenant=tenant, inquiry=inquiry
            ).exclude(status=TradeSessionStatus.CANCELLED).first()
            if existing:
                continue

            # Calculate confidence based on data completeness
            confidence = 0.5
            if inquiry.customer_id:
                confidence += 0.15
            if inquiry.type_of_protein:
                confidence += 0.1
            if inquiry.description:
                confidence += 0.1
            if inquiry.route_decision:
                confidence += 0.1

            source = "email" if inquiry.source_email_subject else "history"
            title = inquiry.source_email_subject or inquiry.description or f"Trade for {inquiry.type_of_protein or 'unknown protein'}"

            proposals.append({
                "id": str(inquiry.id),
                "title": title[:80],
                "confidence": round(min(confidence, 0.99), 2),
                "source": source,
                "route": inquiry.route_decision or "FULFILL",
                "customer_name": getattr(inquiry.customer, "name", None) if inquiry.customer_id else None,
                "supplier_name": None,
                "type_of_protein": inquiry.type_of_protein or None,
                "weight": None,
                "delivery_context": None,
                "suggested_fields": [],
                "created_at": inquiry.created_at.isoformat() if hasattr(inquiry, "created_at") and inquiry.created_at else None,
                "expires_at": None,
                "status": "pending",
            })

        return Response({"results": proposals})

    @action(detail=True, methods=["post"], url_path="execute-proposal")
    def execute_proposal(self, request, pk=None):
        """POST /api/v1/trades/{inquiry_id}/execute-proposal/ — Execute an AI proposal.

        Takes a draft inquiry and converts it into a full trade with session
        and dependency check, identical to smart-initiate but from existing inquiry.
        """
        tenant = request.tenant
        user = request.user

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

            trade_session, _ = get_or_create_trade_session(
                tenant=tenant, inquiry=inquiry
            )
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

        return Response({
            "trade_id": trade_session.trade_id,
            "trade_session_id": str(trade_session.id),
            "inquiry_id": str(inquiry.id),
            "route": route,
            "dependencies": dep_result.to_dict(),
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="proposal-feedback")
    def proposal_feedback(self, request, pk=None):
        """POST /api/v1/trades/{inquiry_id}/proposal-feedback/ — Submit feedback on a proposal.

        Records user feedback for confidence engine training.
        """
        tenant = request.tenant
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
