/**
 * Process Quick Actions Panel (RT-06.2)
 *
 * Context-aware action buttons for the trading process.
 * Shows only relevant actions based on the current entity state.
 * Used in Cockpit workspace panels and entity detail pages.
 *
 * Theme Compliance: CSS custom properties only.
 */
import React, { useMemo, useCallback } from 'react';
import styled from 'styled-components';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { confirmDialog } from '@/utils/uiDialogs';
import {
  Send,
  CheckCircle2,
  FileText,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { businessApi } from '../../services/businessApi';
import { withTenantQueryKey } from '../../utils/queryKeys';

// ============================================================================
// Types
// ============================================================================

export type ProcessActionId =
  | 'send_rfq'
  | 'approve_bid'
  | 'reject_bid'
  | 'generate_sales_order'
  | 'approve_po'
  | 'reject_po'
  | 'escalate'
  | 'send_sales_order'
  | 'mark_po_received';

export interface ProcessAction {
  id: ProcessActionId;
  label: string;
  description: string;
  icon: React.FC<{ size?: number }>;
  variant: 'primary' | 'success' | 'danger' | 'warning' | 'default';
  /** Conditions: entity must be in one of these statuses for action to show */
  visibleWhenStatus: string[];
  /** Which entity types this action applies to */
  entityTypes: string[];
  /** API endpoint to call */
  endpoint: string;
  /** HTTP method */
  method: 'POST' | 'PUT' | 'PATCH';
  /** Requires confirmation dialog */
  requiresConfirmation: boolean;
}

export interface ProcessQuickActionsProps {
  entityType: string;
  entityId: string;
  entityStatus: string;
  inquiryId?: string;
  compact?: boolean;
  className?: string;
  onActionComplete?: (actionId: ProcessActionId) => void;
}

// ============================================================================
// Action Registry
// ============================================================================

const PROCESS_ACTIONS: ProcessAction[] = [
  {
    id: 'send_rfq',
    label: 'Send RFQ',
    description: 'Send Request for Quote to supplier',
    icon: Send,
    variant: 'primary',
    visibleWhenStatus: ['pending', 'sourcing', 'draft'],
    entityTypes: ['inquiry'],
    endpoint: '/inquiries/{id}/orchestrator/advance/',
    method: 'POST',
    requiresConfirmation: false,
  },
  {
    id: 'approve_bid',
    label: 'Approve Bid',
    description: 'Approve selected supplier bid',
    icon: CheckCircle2,
    variant: 'success',
    visibleWhenStatus: ['quoted', 'bid_received', 'pending_approval'],
    entityTypes: ['inquiry'],
    endpoint: '/inquiries/{id}/orchestrator/advance/',
    method: 'POST',
    requiresConfirmation: true,
  },
  {
    id: 'reject_bid',
    label: 'Reject Bid',
    description: 'Reject and request new quote',
    icon: XCircle,
    variant: 'danger',
    visibleWhenStatus: ['quoted', 'bid_received', 'pending_approval'],
    entityTypes: ['inquiry'],
    endpoint: '/inquiries/{id}/reject-bid/',
    method: 'POST',
    requiresConfirmation: true,
  },
  {
    id: 'generate_sales_order',
    label: 'Generate Sales Order',
    description: 'Create Sales Order from approved bid',
    icon: FileText,
    variant: 'primary',
    visibleWhenStatus: ['approved', 'po_approved'],
    entityTypes: ['inquiry'],
    endpoint: '/inquiries/{id}/orchestrator/advance/',
    method: 'POST',
    requiresConfirmation: false,
  },
  {
    id: 'send_sales_order',
    label: 'Send to Customer',
    description: 'Send Sales Order to customer',
    icon: Send,
    variant: 'primary',
    visibleWhenStatus: ['draft', 'generated'],
    entityTypes: ['sales_order'],
    endpoint: '/sales-orders/{id}/send/',
    method: 'POST',
    requiresConfirmation: true,
  },
  {
    id: 'approve_po',
    label: 'Approve PO',
    description: 'Approve Purchase Order',
    icon: CheckCircle2,
    variant: 'success',
    visibleWhenStatus: ['pending_approval', 'draft', 'review'],
    entityTypes: ['purchase_order', 'supplier_purchase_order'],
    endpoint: '/purchase-orders/{id}/approve/',
    method: 'POST',
    requiresConfirmation: true,
  },
  {
    id: 'reject_po',
    label: 'Reject PO',
    description: 'Reject Purchase Order with reason',
    icon: XCircle,
    variant: 'danger',
    visibleWhenStatus: ['pending_approval', 'review'],
    entityTypes: ['purchase_order', 'supplier_purchase_order'],
    endpoint: '/purchase-orders/{id}/reject/',
    method: 'POST',
    requiresConfirmation: true,
  },
  {
    id: 'mark_po_received',
    label: 'Mark PO Received',
    description: 'Confirm customer PO received',
    icon: CheckCircle2,
    variant: 'success',
    visibleWhenStatus: ['awaiting_po', 'sent', 'in_progress'],
    entityTypes: ['inquiry'],
    endpoint: '/inquiries/{id}/mark-po-received/',
    method: 'POST',
    requiresConfirmation: false,
  },
  {
    id: 'escalate',
    label: 'Escalate',
    description: 'Escalate to supervisor',
    icon: AlertTriangle,
    variant: 'warning',
    visibleWhenStatus: ['overdue', 'failed', 'halted', 'blocked'],
    entityTypes: ['inquiry', 'purchase_order', 'sales_order'],
    endpoint: '/inquiries/{id}/escalate/',
    method: 'POST',
    requiresConfirmation: true,
  },
];

// ============================================================================
// Styled Components
// ============================================================================

const PanelContainer = styled.div<{ $compact?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${(p) => (p.$compact ? '6px' : '8px')};
  padding: ${(p) => (p.$compact ? '8px' : '12px')};
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgb(var(--color-border));
  margin-bottom: 4px;
`;

const PanelTitle = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ActionButton = styled.button<{ $variant: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
  text-align: left;

  ${(p) => {
    switch (p.$variant) {
      case 'primary':
        return `
          background: rgba(var(--color-info), 0.08);
          color: rgb(var(--color-info));
          border-color: rgba(var(--color-info), 0.2);
          &:hover { background: rgba(var(--color-info), 0.15); }
        `;
      case 'success':
        return `
          background: rgba(var(--color-success), 0.08);
          color: rgb(var(--color-success));
          border-color: rgba(var(--color-success), 0.2);
          &:hover { background: rgba(var(--color-success), 0.15); }
        `;
      case 'danger':
        return `
          background: rgba(var(--color-error), 0.08);
          color: rgb(var(--color-error));
          border-color: rgba(var(--color-error), 0.2);
          &:hover { background: rgba(var(--color-error), 0.15); }
        `;
      case 'warning':
        return `
          background: rgba(var(--color-warning), 0.08);
          color: rgb(var(--color-warning));
          border-color: rgba(var(--color-warning), 0.2);
          &:hover { background: rgba(var(--color-warning), 0.15); }
        `;
      default:
        return `
          background: rgb(var(--color-background));
          color: rgb(var(--color-text-primary));
          border-color: rgb(var(--color-border));
          &:hover { background: rgb(var(--color-surface)); }
        `;
    }
  }}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ActionLabel = styled.span`
  flex: 1;
`;

const ActionDescription = styled.span`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  font-weight: 400;
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  font-style: italic;
`;

// ============================================================================
// Main Component
// ============================================================================

export const ProcessQuickActions: React.FC<ProcessQuickActionsProps> = ({
  entityType,
  entityId,
  entityStatus,
  inquiryId,
  compact = false,
  className,
  onActionComplete,
}) => {
  const queryClient = useQueryClient();

  // Filter actions relevant to current entity state
  const availableActions = useMemo(() => {
    const normalizedStatus = entityStatus?.toLowerCase() ?? '';
    return PROCESS_ACTIONS.filter(
      (action) =>
        action.entityTypes.includes(entityType) &&
        action.visibleWhenStatus.some((s) => normalizedStatus.includes(s))
    );
  }, [entityType, entityStatus]);

  // Action execution mutation
  const executeMutation = useMutation({
    mutationFn: async ({ action }: { action: ProcessAction }) => {
      const resolvedId = entityType === 'inquiry' ? entityId : (inquiryId ?? entityId);
      const url = action.endpoint.replace('{id}', resolvedId);
      const response = await businessApi[action.method.toLowerCase() as 'post' | 'put' | 'patch'](
        url,
        { action: action.id }
      );
      return response.data;
    },
    onSuccess: (_, { action }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('trade-lineage') });
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('inquiries') });
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('purchase-orders') });
      onActionComplete?.(action.id);
    },
  });

  const handleAction = useCallback(
    async (action: ProcessAction) => {
      if (action.requiresConfirmation) {
        const confirmed = await confirmDialog({
          title: action.label,
          content: `${action.description}. Proceed?`,
          okText: 'Confirm',
          cancelText: 'Cancel',
        });
        if (!confirmed) return;
      }
      executeMutation.mutate({ action });
    },
    [executeMutation]
  );

  if (availableActions.length === 0) {
    if (compact) return null;
    return (
      <PanelContainer $compact={compact} className={className}>
        <PanelHeader>
          <Zap size={14} />
          <PanelTitle>Quick Actions</PanelTitle>
        </PanelHeader>
        <EmptyState>No actions available for current state</EmptyState>
      </PanelContainer>
    );
  }

  return (
    <PanelContainer $compact={compact} className={className}>
      {!compact && (
        <PanelHeader>
          <Zap size={14} />
          <PanelTitle>Quick Actions</PanelTitle>
        </PanelHeader>
      )}
      {availableActions.map((action) => {
        const Icon = action.icon;
        const isExecuting =
          executeMutation.isPending &&
          (executeMutation.variables as { action: ProcessAction } | undefined)?.action?.id === action.id;

        return (
          <ActionButton
            key={action.id}
            $variant={action.variant}
            onClick={() => handleAction(action)}
            disabled={executeMutation.isPending}
            title={action.description}
          >
            {isExecuting ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
            <ActionLabel>{action.label}</ActionLabel>
            {!compact && <ActionDescription>{action.description}</ActionDescription>}
            <ChevronRight size={12} />
          </ActionButton>
        );
      })}
    </PanelContainer>
  );
};

export default ProcessQuickActions;
