"""Unified Trade Lifecycle service for canonical E2E trade state management.

Provides a single service to query and manage trade state across the
full lifecycle: Inquiry → PO → SO → Carrier → ColdStorage → Invoice.

This consolidates the fragmented state tracking that currently lives
across PurchaseOrder.status, SalesOrder.status, CarrierPO.status,
and various workflow execution states into a single queryable interface.

Usage:
    from apps.core.services.trade_lifecycle import TradeLifecycleService

    service = TradeLifecycleService(tenant)

    # Get unified trade state
    state = service.get_trade_state(trade_session_id)

    # Get pipeline summary for dashboard
    pipeline = service.get_pipeline_summary()

    # Check if a trade is ready for next step
    ready = service.is_ready_for_next_step(trade_session_id)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class TradeStageInfo:
    """Information about a single stage in the trade lifecycle."""

    stage: str
    status: str  # 'not_started', 'in_progress', 'completed', 'failed', 'skipped'
    entity_type: str  # 'purchase_order', 'sales_order', etc.
    entity_id: str | None = None
    entity_number: str = ''
    started_at: str | None = None
    completed_at: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class TradeLifecycleState:
    """Complete lifecycle state for a trade."""

    trade_session_id: str
    tenant_id: str
    current_stage: str
    overall_status: str  # 'active', 'completed', 'failed', 'paused'
    stages: list[TradeStageInfo]
    created_at: str | None = None
    completion_percentage: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            'trade_session_id': self.trade_session_id,
            'tenant_id': self.tenant_id,
            'current_stage': self.current_stage,
            'overall_status': self.overall_status,
            'stages': [
                {
                    'stage': s.stage,
                    'status': s.status,
                    'entity_type': s.entity_type,
                    'entity_id': s.entity_id,
                    'entity_number': s.entity_number,
                    'started_at': s.started_at,
                    'completed_at': s.completed_at,
                    'metadata': s.metadata,
                }
                for s in self.stages
            ],
            'completion_percentage': self.completion_percentage,
            'created_at': self.created_at,
        }


# Canonical stage ordering for a full meat trade
TRADE_STAGES = [
    'inquiry',
    'purchase_order',
    'sales_order',
    'carrier_booking',
    'cold_storage',
    'invoicing',
]


class TradeLifecycleService:
    """Unified trade lifecycle state machine and query service.

    Aggregates state from PurchaseOrder, SalesOrder, CarrierPurchaseOrder,
    ColdStorageEntry, and Invoice models into a single coherent view.
    """

    def __init__(self, tenant):
        self.tenant = tenant

    def get_trade_state(self, trade_session_id: str) -> TradeLifecycleState | None:
        """Get the complete lifecycle state for a trade session.

        Queries across all trade-related models to build a unified view.
        """
        try:
            from tenant_apps.inquiries.models import Inquiry
            from tenant_apps.purchase_orders.models import (
                CarrierPurchaseOrder,
                ColdStorageEntry,
                PurchaseOrder,
            )
            from tenant_apps.sales_orders.models import SalesOrder
            from tenant_apps.invoices.models import Invoice

            stages: list[TradeStageInfo] = []

            # Inquiry stage
            inquiry = Inquiry.objects.filter(
                tenant=self.tenant,
                trade_session_id=trade_session_id,
            ).first()
            if inquiry:
                stages.append(TradeStageInfo(
                    stage='inquiry',
                    status='completed',
                    entity_type='inquiry',
                    entity_id=str(inquiry.id),
                    entity_number=getattr(inquiry, 'inquiry_number', ''),
                    started_at=str(inquiry.created_on) if hasattr(inquiry, 'created_on') else None,
                ))
            else:
                stages.append(TradeStageInfo(stage='inquiry', status='not_started', entity_type='inquiry'))

            # Purchase Order stage
            po = PurchaseOrder.objects.filter(
                tenant=self.tenant,
                trade_session_id=trade_session_id,
            ).first()
            if po:
                po_status = 'completed' if po.status in ('received', 'closed') else 'in_progress'
                stages.append(TradeStageInfo(
                    stage='purchase_order',
                    status=po_status,
                    entity_type='purchase_order',
                    entity_id=str(po.id),
                    entity_number=getattr(po, 'po_number', ''),
                    started_at=str(po.created_on),
                    metadata={'amount': str(po.total_amount) if po.total_amount else ''},
                ))
            else:
                stages.append(TradeStageInfo(stage='purchase_order', status='not_started', entity_type='purchase_order'))

            # Sales Order stage
            so = SalesOrder.objects.filter(
                tenant=self.tenant,
                trade_session_id=trade_session_id,
            ).first()
            if so:
                so_status = 'completed' if so.status in ('shipped', 'delivered', 'closed') else 'in_progress'
                stages.append(TradeStageInfo(
                    stage='sales_order',
                    status=so_status,
                    entity_type='sales_order',
                    entity_id=str(so.id),
                    entity_number=getattr(so, 'so_number', ''),
                    started_at=str(so.created_on),
                ))
            else:
                stages.append(TradeStageInfo(stage='sales_order', status='not_started', entity_type='sales_order'))

            # Carrier Booking stage
            carrier_po = CarrierPurchaseOrder.objects.filter(
                tenant=self.tenant,
                trade_session_id=trade_session_id,
            ).first()
            if carrier_po:
                stages.append(TradeStageInfo(
                    stage='carrier_booking',
                    status='completed' if carrier_po.status == 'delivered' else 'in_progress',
                    entity_type='carrier_purchase_order',
                    entity_id=str(carrier_po.id),
                    entity_number=getattr(carrier_po, 'carrier_po_number', ''),
                    started_at=str(carrier_po.created_on),
                ))
            else:
                stages.append(TradeStageInfo(stage='carrier_booking', status='not_started', entity_type='carrier_purchase_order'))

            # Cold Storage stage
            cold_storage = ColdStorageEntry.objects.filter(
                tenant=self.tenant,
                purchase_order__trade_session_id=trade_session_id,
            ).first()
            if cold_storage:
                stages.append(TradeStageInfo(
                    stage='cold_storage',
                    status='completed' if cold_storage.status == 'released' else 'in_progress',
                    entity_type='cold_storage_entry',
                    entity_id=str(cold_storage.id),
                    started_at=str(cold_storage.created_on),
                ))
            else:
                stages.append(TradeStageInfo(stage='cold_storage', status='not_started', entity_type='cold_storage_entry'))

            # Invoicing stage
            invoice = Invoice.objects.filter(
                tenant=self.tenant,
                sales_order__trade_session_id=trade_session_id,
            ).first()
            if invoice:
                stages.append(TradeStageInfo(
                    stage='invoicing',
                    status='completed' if invoice.status in ('paid', 'closed') else 'in_progress',
                    entity_type='invoice',
                    entity_id=str(invoice.id),
                    entity_number=getattr(invoice, 'invoice_number', ''),
                    started_at=str(invoice.created_on),
                ))
            else:
                stages.append(TradeStageInfo(stage='invoicing', status='not_started', entity_type='invoice'))

            # Calculate current stage and completion
            completed_count = sum(1 for s in stages if s.status == 'completed')
            total_count = len(stages)
            current_stage = next(
                (s.stage for s in stages if s.status in ('in_progress', 'not_started')),
                'invoicing',
            )
            overall_status = (
                'completed' if completed_count == total_count
                else 'failed' if any(s.status == 'failed' for s in stages)
                else 'active'
            )

            return TradeLifecycleState(
                trade_session_id=trade_session_id,
                tenant_id=str(self.tenant.id),
                current_stage=current_stage,
                overall_status=overall_status,
                stages=stages,
                completion_percentage=(completed_count / total_count) * 100 if total_count else 0,
                created_at=str(inquiry.created_on) if inquiry else None,
            )

        except Exception as e:
            logger.error(
                '[TradeLifecycleService] Failed to get trade state: %s',
                str(e),
                exc_info=True,
            )
            return None

    def get_pipeline_summary(self, limit: int = 50) -> dict[str, Any]:
        """Get pipeline summary counts for the dashboard.

        Returns counts of trades at each stage and overall health metrics.
        """
        try:
            from tenant_apps.purchase_orders.models import PurchaseOrder
            from tenant_apps.sales_orders.models import SalesOrder

            active_pos = PurchaseOrder.objects.filter(
                tenant=self.tenant,
            ).exclude(status__in=['received', 'closed', 'cancelled']).count()

            active_sos = SalesOrder.objects.filter(
                tenant=self.tenant,
            ).exclude(status__in=['shipped', 'delivered', 'closed', 'cancelled']).count()

            return {
                'active_purchase_orders': active_pos,
                'active_sales_orders': active_sos,
                'total_active_trades': active_pos + active_sos,
            }
        except Exception as e:
            logger.debug('Pipeline summary failed: %s', e)
            return {'active_purchase_orders': 0, 'active_sales_orders': 0, 'total_active_trades': 0}

    def is_ready_for_next_step(self, trade_session_id: str) -> dict[str, Any]:
        """Check if a trade is ready to advance to its next stage.

        Returns readiness status and any blocking dependencies.
        """
        state = self.get_trade_state(trade_session_id)
        if not state:
            return {'ready': False, 'reason': 'Trade session not found'}

        current = state.current_stage
        current_idx = TRADE_STAGES.index(current) if current in TRADE_STAGES else -1

        if current_idx < 0:
            return {'ready': False, 'reason': f'Unknown stage: {current}'}

        # Check if previous stage is completed
        if current_idx > 0:
            prev_stage = state.stages[current_idx - 1]
            if prev_stage.status != 'completed':
                return {
                    'ready': False,
                    'reason': f'Previous stage "{prev_stage.stage}" is {prev_stage.status}',
                    'blocking_stage': prev_stage.stage,
                }

        return {
            'ready': True,
            'current_stage': current,
            'next_stage': TRADE_STAGES[current_idx + 1] if current_idx < len(TRADE_STAGES) - 1 else None,
        }
