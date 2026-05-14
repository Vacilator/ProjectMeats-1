/**
 * StatusActionCell — Row-level status badge with quick-action button.
 *
 * Displays the current status as a colored pill and a single primary action
 * button for the most logical next transition. Hover/click reveals all
 * available transitions in a dropdown.
 *
 * Inspired by Linear's row-level status chips and Asana's quick-action patterns.
 *
 * Theme Compliance: CSS custom properties only.
 */
import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Dropdown, message, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { getStatusColors } from '@/utils/statusColors';
import { getDocumentEntityConfig } from '@/components/Operations/documentOperations';
import {
  getTransitionLabel,
  getPrimaryTransition,
  getWorkflowConfig,
} from './workflowConfig';

// ============================================================================
// Types
// ============================================================================

export interface StatusActionCellProps {
  /** Entity type (e.g. 'purchase_order', 'inquiry') */
  entityType: string;
  /** Entity record ID */
  entityId: string | number;
  /** Current status value */
  status: string;
  /** Compact mode — badge only, no action button */
  compact?: boolean;
  /** Callback after a successful transition */
  onTransitioned?: () => void;
}

type WorkflowResponse = {
  current_status: string;
  allowed_transitions: string[];
  statuses: Array<{ value: string; label: string }>;
};

// ============================================================================
// Styled Components
// ============================================================================

const CellWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const StatusPill = styled.span<{ $text: string; $bg: string; $border: string }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
  border-radius: 9999px;
  white-space: nowrap;
  text-transform: capitalize;
  color: ${(p) => p.$text};
  background: ${(p) => p.$bg};
  border: 1px solid ${(p) => p.$border};
`;

const QuickActionBtn = styled.button<{ $intent: string }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;

  background: ${(p) => {
    switch (p.$intent) {
      case 'success': return 'rgba(var(--color-success), 0.1)';
      case 'danger': return 'rgba(var(--color-error), 0.1)';
      case 'warning': return 'rgba(var(--color-warning), 0.1)';
      default: return 'rgba(var(--color-primary), 0.1)';
    }
  }};
  color: ${(p) => {
    switch (p.$intent) {
      case 'success': return 'rgb(var(--color-success))';
      case 'danger': return 'rgb(var(--color-error))';
      case 'warning': return 'rgb(var(--color-warning))';
      default: return 'rgb(var(--color-primary))';
    }
  }};

  &:hover:not(:disabled) {
    background: ${(p) => {
      switch (p.$intent) {
        case 'success': return 'rgba(var(--color-success), 0.2)';
        case 'danger': return 'rgba(var(--color-error), 0.2)';
        case 'warning': return 'rgba(var(--color-warning), 0.2)';
        default: return 'rgba(var(--color-primary), 0.2)';
      }
    }};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// ============================================================================
// Component
// ============================================================================

export const StatusActionCell: React.FC<StatusActionCellProps> = ({
  entityType,
  entityId,
  status,
  compact = false,
  onTransitioned,
}) => {
  const queryClient = useQueryClient();
  const [dropdownOpen, setDropdownOpen] = useState(false);
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
    enabled: Boolean(config) && Boolean(entityId) && !compact,
    staleTime: 30_000,
  });

  const transitionMutation = useMutation({
    mutationFn: async (nextStatus: string) => {
      const response = await businessApi.post(
        `/${config?.endpoint}/${encodeURIComponent(normalizedEntityId)}/transition-status/`,
        { status: nextStatus },
      );
      return response.data;
    },
    onSuccess: (_data, nextStatus) => {
      const meta = getTransitionLabel(entityType, status, nextStatus);
      message.success(`${workflowConfig?.label ?? 'Record'} → ${meta.label}`);
      void queryClient.invalidateQueries({ queryKey: workflowQueryKey });
      onTransitioned?.();
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { status?: string[] } } })?.response?.data?.status;
      const msg = Array.isArray(detail) ? detail[0] : 'Transition failed';
      message.error(msg);
    },
  });

  const handleTransition = useCallback(
    (nextStatus: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const meta = getTransitionLabel(entityType, status, nextStatus);
      if (meta.confirm && !window.confirm(meta.confirm)) return;
      transitionMutation.mutate(nextStatus);
    },
    [entityType, status, transitionMutation],
  );

  // Status pill (always shown)
  const colors = getStatusColors(status);
  const statusLabel = status.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const pill = (
    <StatusPill $text={colors.text} $bg={colors.bg} $border={colors.border}>
      {statusLabel}
    </StatusPill>
  );

  if (compact || !config) {
    return <CellWrapper>{pill}</CellWrapper>;
  }

  const allowed = workflowQuery.data?.allowed_transitions ?? [];
  const primary = getPrimaryTransition(entityType, status, allowed);

  if (!primary || allowed.length === 0) {
    return <CellWrapper>{pill}</CellWrapper>;
  }

  // Build dropdown menu for all transitions
  const menuItems: MenuProps['items'] = allowed.map((nextStatus) => {
    const meta = getTransitionLabel(entityType, status, nextStatus);
    return {
      key: nextStatus,
      label: meta.label,
      danger: meta.intent === 'danger',
      onClick: (info: { domEvent: React.MouseEvent | React.KeyboardEvent }) => {
        info.domEvent.stopPropagation();
        handleTransition(nextStatus);
      },
    };
  });

  const isTransitioning = transitionMutation.isPending;

  return (
    <CellWrapper>
      {pill}
      {allowed.length === 1 ? (
        <Tooltip title={primary.meta.label}>
          <QuickActionBtn
            $intent={primary.meta.intent}
            onClick={(e) => handleTransition(primary.nextStatus, e)}
            disabled={isTransitioning}
            aria-label={primary.meta.label}
          >
            {isTransitioning ? <Loader2 size={11} className="animate-spin" /> : primary.meta.label}
          </QuickActionBtn>
        </Tooltip>
      ) : (
        <Dropdown
          menu={{ items: menuItems }}
          trigger={['click']}
          open={dropdownOpen}
          onOpenChange={(open) => setDropdownOpen(open)}
        >
          <QuickActionBtn
            $intent={primary.meta.intent}
            onClick={(e) => e.stopPropagation()}
            disabled={isTransitioning}
            aria-label={`${primary.meta.label} and more actions`}
          >
            {isTransitioning ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <>
                {primary.meta.label}
                <ChevronDown size={11} />
              </>
            )}
          </QuickActionBtn>
        </Dropdown>
      )}
    </CellWrapper>
  );
};

export default StatusActionCell;
