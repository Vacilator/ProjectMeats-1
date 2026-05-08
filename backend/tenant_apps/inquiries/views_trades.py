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
