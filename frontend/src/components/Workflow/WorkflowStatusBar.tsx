/**
 * WorkflowStatusBar — Record-level workflow status header.
 *
 * Displays a prominent status bar at the top of record/detail pages with:
 * - Current status badge
 * - All available action buttons (cascaded by workflow rules)
 * - Party/contact info
 *
 * Inspired by HubSpot's deal stage bar and Monday.com's status header.
 *
 * Theme Compliance: CSS custom properties only.
 */
import React, { useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { Button, Dropdown, message, notification, Space, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { Loader2, MoreHorizontal } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { getDocumentEntityConfig } from '@/components/Operations/documentOperations';
import { StatusBadge } from '@/components/Shared/StatusBadge';
import {
  getTransitionLabel,
  getWorkflowConfig,
  type TransitionMeta,
} from './workflowConfig';

// ============================================================================
// Types
// ============================================================================

export interface WorkflowStatusBarProps {
  entityType: string;
  entityId: string | number;
  /** Party display name (e.g. supplier/customer name) */
  partyName?: string;
  /** Contact person name */
  contactName?: string;
  /** Callback after a successful transition */
  onTransitioned?: () => void;
  /** Show in compact mode (inline, no card) */
  compact?: boolean;
}

type WorkflowResponse = {
  current_status: string;
  allowed_transitions: string[];
  statuses: Array<{ value: string; label: string }>;
};

// ============================================================================
// Styled Components
// ============================================================================

const BarContainer = styled.div<{ $compact?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: ${(p) => (p.$compact ? '8px 0' : '10px 16px')};
  ${(p) =>
    !p.$compact &&
    `
    background: rgb(var(--color-surface));
    border: 1px solid rgb(var(--color-border));
    border-radius: var(--radius-md);
  `}
  flex-wrap: wrap;
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const PartyChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--color-text-secondary));
  background: rgba(var(--color-primary), 0.06);
  border: 1px solid rgba(var(--color-primary), 0.12);
  border-radius: 9999px;
  white-space: nowrap;
`;

const ContactName = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  white-space: nowrap;
`;

const LoadingBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
`;

// ============================================================================
// Component
// ============================================================================

export const WorkflowStatusBar: React.FC<WorkflowStatusBarProps> = ({
  entityType,
  entityId,
  partyName,
  contactName,
  onTransitioned,
  compact = false,
}) => {
  const queryClient = useQueryClient();
  const config = useMemo(() => getDocumentEntityConfig(entityType), [entityType]);
  const workflowConfig = useMemo(() => getWorkflowConfig(entityType), [entityType]);
  const normalizedEntityType = config?.entityType ?? entityType;
  const normalizedEntityId = String(entityId);

  const workflowQueryKey = useMemo(
    () => withTenantQueryKey('document-status-workflow', normalizedEntityType, normalizedEntityId),
    [normalizedEntityId, normalizedEntityType],
  );

  const workflowQuery = useQuery({
    queryKey: workflowQueryKey,
    queryFn: async () => {
      const response = await businessApi.get<WorkflowResponse>(
        `/${config?.endpoint}/${encodeURIComponent(normalizedEntityId)}/status-workflow/`,
      );
      return response.data;
    },
    enabled: Boolean(config) && Boolean(entityId),
    staleTime: 15_000,
    retry: false,
  });

  const transitionMutation = useMutation({
    mutationFn: async (nextStatus: string) => {
      const response = await businessApi.post(
        `/${config?.endpoint}/${encodeURIComponent(normalizedEntityId)}/transition-status/`,
        { status: nextStatus },
      );
      return response.data;
    },
    onSuccess: (data, nextStatus) => {
      const currentStatus = workflowQuery.data?.current_status ?? '';
      const meta = getTransitionLabel(entityType, currentStatus, nextStatus);
      message.success(`${workflowConfig?.label ?? 'Record'} → ${meta.label}`);

      // Show cascade notification with link to the auto-created entity
      const cascade = data?._cascade;
      if (cascade?.triggered && cascade?.created_entity_type && !cascade?.error) {
        const verb = cascade.already_existed ? 'already exists' : 'auto-created';
        const entityLabel = cascade.created_entity_label || 'Downstream record';
        const cascadeEntityId = cascade.created_entity_id;

        // Build navigation path for the cascade-created entity
        const cascadeRouteMap: Record<string, string> = {
          purchase_order: '/purchase-orders',
          sales_order: '/sales-orders',
          carrier_purchase_order: '/purchase-orders?tab=carrier',
          fulfillment: '/fulfillments',
          invoice: '/invoices',
        };
        const basePath = cascadeRouteMap[cascade.created_entity_type];

        notification.success({
          message: `✅ ${entityLabel} ${verb}`,
          description: `The workflow has advanced automatically. ${basePath && cascadeEntityId
            ? 'Click "View" to open it.'
            : ''}`,
          btn: basePath && cascadeEntityId ? (
            <Button
              type="primary"
              size="small"
              onClick={() => {
                const sep = basePath.includes('?') ? '&' : '?';
                window.location.href = `${basePath}${sep}highlight=${cascadeEntityId}`;
              }}
            >
              View {cascade.created_entity_type?.replace(/_/g, ' ')}
            </Button>
          ) : undefined,
          duration: 8,
          placement: 'topRight',
        });
      }

      // Invalidate all relevant queries so lineage, trades, and entity lists refresh
      void queryClient.invalidateQueries({ queryKey: workflowQueryKey });
      void queryClient.invalidateQueries({ queryKey: withTenantQueryKey('trade-lineage') });
      void queryClient.invalidateQueries({ queryKey: withTenantQueryKey('trades') });
      void queryClient.invalidateQueries({ queryKey: withTenantQueryKey('my-trades') });
      void queryClient.invalidateQueries({ queryKey: withTenantQueryKey('process-header') });
      void queryClient.invalidateQueries({ queryKey: withTenantQueryKey('document-status-workflow') });
      void queryClient.invalidateQueries({ queryKey: withTenantQueryKey('action-items') });
      // Invalidate the source entity list + cascade-target entity list
      void queryClient.invalidateQueries({ queryKey: withTenantQueryKey(normalizedEntityType) });
      if (cascade?.created_entity_type) {
        void queryClient.invalidateQueries({ queryKey: withTenantQueryKey(cascade.created_entity_type) });
      }
      onTransitioned?.();
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { status?: string[] } } })?.response?.data?.status;
      const msg = Array.isArray(detail) ? detail[0] : 'Transition failed. Please try again.';
      message.error(msg);
    },
  });

  const handleTransition = useCallback(
    (nextStatus: string) => {
      const currentStatus = workflowQuery.data?.current_status ?? '';
      const meta = getTransitionLabel(entityType, currentStatus, nextStatus);
      if (meta.confirm && !window.confirm(meta.confirm)) return;
      transitionMutation.mutate(nextStatus);
    },
    [entityType, transitionMutation, workflowQuery.data?.current_status],
  );

  if (!config) return null;

  if (workflowQuery.isLoading) {
    return (
      <LoadingBar>
        <Loader2 size={14} className="animate-spin" />
        Loading workflow…
      </LoadingBar>
    );
  }

  const workflow = workflowQuery.data;
  if (!workflow) return null;

  const { current_status, allowed_transitions } = workflow;
  const isTransitioning = transitionMutation.isPending;

  // Separate primary actions (non-cancel, non-danger) from secondary
  const allMeta = allowed_transitions.map((next) => ({
    nextStatus: next,
    meta: getTransitionLabel(entityType, current_status, next),
  }));
  const primaryActions = allMeta.filter(
    (a) => a.meta.intent !== 'danger' && a.nextStatus !== 'cancelled',
  );
  const secondaryActions = allMeta.filter(
    (a) => a.meta.intent === 'danger' || a.nextStatus === 'cancelled',
  );

  // Intent → AntD button type mapping
  const intentToType = (intent: TransitionMeta['intent']): 'primary' | 'default' | 'dashed' => {
    if (intent === 'success' || intent === 'primary') return 'primary';
    return 'default';
  };

  // Build secondary actions dropdown
  const secondaryMenu: MenuProps['items'] = secondaryActions.map((a) => ({
    key: a.nextStatus,
    label: a.meta.label,
    danger: true,
    onClick: () => handleTransition(a.nextStatus),
  }));

  return (
    <BarContainer $compact={compact}>
      <LeftSection>
        <StatusBadge status={current_status} />
        {partyName && (
          <PartyChip>
            {workflowConfig?.partyLabel ?? 'Party'}: <strong>{partyName}</strong>
          </PartyChip>
        )}
        {contactName && <ContactName>Contact: {contactName}</ContactName>}
      </LeftSection>

      {allowed_transitions.length > 0 && (
        <RightSection>
          <Space size={6}>
            {primaryActions.map((a) => (
              <Tooltip key={a.nextStatus} title={a.meta.description}>
                <Button
                  type={intentToType(a.meta.intent)}
                  size="small"
                  loading={isTransitioning}
                  onClick={() => handleTransition(a.nextStatus)}
                  style={
                    a.meta.intent === 'success'
                      ? { background: 'rgb(var(--color-success))', borderColor: 'rgb(var(--color-success))' }
                      : undefined
                  }
                >
                  {a.meta.label}
                </Button>
              </Tooltip>
            ))}
          </Space>
          {secondaryMenu.length > 0 && (
            <Dropdown menu={{ items: secondaryMenu }} trigger={['click']}>
              <Tooltip title="More actions">
                <Button size="small" icon={<MoreHorizontal size={14} />} />
              </Tooltip>
            </Dropdown>
          )}
        </RightSection>
      )}
    </BarContainer>
  );
};

export default WorkflowStatusBar;
