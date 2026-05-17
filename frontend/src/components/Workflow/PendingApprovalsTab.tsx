/**
 * PendingApprovalsTab — Unified approval queue for trade entity workflows.
 *
 * Queries all entity types that support `pending_approval` status and surfaces
 * them in a single, actionable list with StatusActionCell for one-click
 * approve/reject.  Also integrates rule-based approval-gate items from
 * /workflows/approvals/pending/.
 *
 * Theme Compliance: CSS custom properties only.
 * Service Layer: businessApi.
 */

import React, { useMemo, useState, useCallback } from 'react';
import dayjs from 'dayjs';
import styled, { keyframes } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { Tooltip, message } from 'antd';
import {
  ShieldCheck,
  ShieldAlert,

  ExternalLink,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { getDocumentEntityConfig } from '@/components/Operations/documentOperations';
import { StatusActionCell } from './StatusActionCell';

// ============================================================================
// Types
// ============================================================================

interface PendingEntity {
  id: string | number;
  entityType: string;
  entityLabel: string;
  identifier: string; // PO number, SO number, etc.
  partyName: string;
  status: string;
  createdAt: string;
  source: 'document' | 'gate';
  gateId?: string;
  rulesSummary?: string[];
  context?: Record<string, string>;
}

export interface PendingApprovalsTabProps {
  onCountChange?: (count: number) => void;
}

// Entity types that support pending_approval status
const APPROVABLE_ENTITIES = [
  {
    type: 'purchase_order',
    endpoint: 'purchase-orders',
    label: 'Purchase Order',
    idField: 'po_number',
    partyField: 'supplier_name',
  },
  {
    type: 'sales_order',
    endpoint: 'sales-orders',
    label: 'Sales Order',
    idField: 'so_number',
    partyField: 'customer_name',
  },
  {
    type: 'invoice',
    endpoint: 'accounting/invoices',
    label: 'Invoice',
    idField: 'invoice_number',
    partyField: 'customer_name',
  },
] as const;

// ============================================================================
// Animations
// ============================================================================

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const KPIStrip = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  overflow-x: auto;
`;

const KPIChip = styled.div<{ $variant?: 'warning' | 'info' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgb(var(--color-surface));
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  white-space: nowrap;
  flex-shrink: 0;
`;

const KPIValue = styled.span<{ $variant?: 'warning' | 'info' }>`
  font-size: 20px;
  font-weight: 700;
  color: ${({ $variant }) => {
    switch ($variant) {
      case 'warning': return 'rgb(var(--color-warning))';
      case 'info': return 'rgb(var(--color-info))';
      default: return 'rgb(var(--color-text-primary))';
    }
  }};
`;

const KPILabel = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const FilterRow = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 4px;
`;

const FilterPill = styled.button<{ $active?: boolean }>`
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s;

  ${({ $active }) => $active
    ? `
      background: rgb(var(--color-primary));
      color: rgb(var(--color-primary-foreground, 255, 255, 255));
      border: 1px solid rgb(var(--color-primary));
    `
    : `
      background: rgb(var(--color-surface));
      color: rgb(var(--color-text-secondary));
      border: 1px solid rgb(var(--color-border));
      &:hover { border-color: rgb(var(--color-primary)); color: rgb(var(--color-primary)); }
    `
  }
`;

const ApprovalRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  cursor: pointer;
  transition: all 0.12s ease;
  animation: ${fadeIn} 0.2s ease;

  &:hover {
    border-color: rgba(var(--color-warning), 0.5);
    box-shadow: var(--shadow-sm);
  }

  & + & { margin-top: 6px; }
`;

const IconWrap = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--color-warning), 0.1);
  color: rgb(var(--color-warning));
  flex-shrink: 0;
`;

const RowContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const RowTitle = styled.span`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RowMeta = styled.span`
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  margin-top: 2px;
`;

const EntityTag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: rgba(var(--color-info), 0.1);
  color: rgb(var(--color-info));
  white-space: nowrap;
`;

const RowActions = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
`;

const ActionBtn = styled.button<{ $variant: 'approve' | 'reject' | 'open' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;

  ${({ $variant }) => {
    switch ($variant) {
      case 'approve': return `
        background: rgb(var(--color-success));
        color: rgb(var(--color-text-inverse));
        border: none;
        &:hover { opacity: 0.9; }
      `;
      case 'reject': return `
        background: rgba(var(--color-error), 0.1);
        color: rgb(var(--color-error));
        border: 1px solid rgba(var(--color-error), 0.3);
        &:hover { background: rgba(var(--color-error), 0.15); }
      `;
      case 'open': return `
        background: transparent;
        color: rgb(var(--color-text-secondary));
        border: 1px solid rgb(var(--color-border));
        &:hover { border-color: rgb(var(--color-primary)); color: rgb(var(--color-primary)); }
      `;
    }
  }}

  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  border-radius: 12px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  text-align: center;
`;

const EmptyIcon = styled.div`
  color: rgb(var(--color-success));
  margin-bottom: 12px;
`;

const EmptyTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 4px;
`;

const EmptyDesc = styled.p`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
`;

const Skeleton = styled.div`
  height: 56px;
  border-radius: 10px;
  background: linear-gradient(90deg,
    rgba(var(--color-border), 0.3) 25%,
    rgba(var(--color-border), 0.5) 50%,
    rgba(var(--color-border), 0.3) 75%);
  background-size: 200% 100%;
  animation: ${shimmer} 1.5s ease infinite;
  & + & { margin-top: 6px; }
`;

const TimeAgo = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
  white-space: nowrap;
`;

// ============================================================================
// Helpers
// ============================================================================

const formatTimeAgo = (dateStr: string): string => {
  const ms = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(ms / 86_400_000);
  if (d < 7) return `${d}d ago`;
  return dayjs(dateStr).format('MMM D');
};

// ============================================================================
// Component
// ============================================================================

export const PendingApprovalsTab: React.FC<PendingApprovalsTabProps> = ({
  onCountChange,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [entityFilter, setEntityFilter] = useState<string>('all');

  // Fetch pending_approval items from each entity type
  const { data: documentItems = [], isLoading: docLoading } = useQuery({
    queryKey: withTenantQueryKey('pending-approvals-documents'),
    queryFn: async () => {
      const results: PendingEntity[] = [];
      const fetches = APPROVABLE_ENTITIES.map(async (entity) => {
        try {
          const res = await businessApi.get(`/${entity.endpoint}/`, {
            params: { status: 'pending_approval', page_size: 50 },
          });
          const items = res.data?.results ?? res.data ?? [];
          for (const item of items) {
            results.push({
              id: item.id,
              entityType: entity.type,
              entityLabel: entity.label,
              identifier: item[entity.idField] || `#${item.id}`,
              partyName: item[entity.partyField] || '—',
              status: item.status || 'pending_approval',
              createdAt: item.created_at || item.date || new Date().toISOString(),
              source: 'document',
            });
          }
        } catch {
          // Entity endpoint may not support status filter — skip gracefully
        }
      });
      await Promise.all(fetches);
      return results;
    },
    refetchInterval: 30_000,
  });

  // Fetch rule-based approval gate items from the AI assistant approval queue.
  const { data: gateItems = [], isLoading: gateLoading } = useQuery({
    queryKey: withTenantQueryKey('pending-approvals-gates'),
    queryFn: async () => {
      const res = await businessApi.get('/ai-assistant/approval-queue/', { params: { status: 'pending' } });
      const items = (res.data?.results ?? res.data ?? []) as Array<{
        id: string;
        request_type: string;
        source_entity_type: string;
        source_entity_id: string;
        subject: string;
        status: string;
        priority: string;
        recipient_name: string;
        created_on: string;
        content_preview?: string;
      }>;
      return items
        .filter((i) => i.status === 'pending')
        .map((i): PendingEntity => ({
          id: i.id,
          entityType: i.source_entity_type || i.request_type || 'approval',
          entityLabel: i.subject || 'Pending Approval',
          identifier: i.subject || i.id,
          partyName: i.recipient_name || '—',
          status: 'pending_approval',
          createdAt: i.created_on,
          source: 'gate',
        }));
    },
    refetchInterval: 30_000,
  });

  const isLoading = docLoading || gateLoading;

  // Combined & sorted
  const allItems = useMemo(() => {
    const combined = [...documentItems, ...gateItems];
    combined.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return combined;
  }, [documentItems, gateItems]);

  // Report count upstream
  React.useEffect(() => {
    onCountChange?.(allItems.length);
  }, [allItems.length, onCountChange]);

  // Filter
  const filteredItems = useMemo(() => {
    if (entityFilter === 'all') return allItems;
    return allItems.filter((i) => i.entityType === entityFilter);
  }, [allItems, entityFilter]);

  // Entity type counts for filter pills
  const entityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    allItems.forEach((i) => {
      counts.set(i.entityType, (counts.get(i.entityType) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
  }, [allItems]);

  // Navigate to record
  const openRecord = useCallback((item: PendingEntity) => {
    const config = getDocumentEntityConfig(item.entityType);
    if (config?.recordPath) {
      navigate(config.recordPath(item.id));
    }
  }, [navigate]);

  // Approve gate item
  const approveMutation = useMutation({
    retry: false,
    mutationFn: async (itemId: string) => {
      return businessApi.post(`/ai-assistant/approval-queue/${itemId}/approve/`, { notes: '' });
    },
    onSuccess: () => {
      message.success('Approved');
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('pending-approvals-gates') });
    },
    onError: () => message.error('Failed to approve'),
  });

  const rejectMutation = useMutation({
    retry: false,
    mutationFn: async (itemId: string) => {
      return businessApi.post(`/ai-assistant/approval-queue/${itemId}/reject/`, { notes: '' });
    },
    onSuccess: () => {
      message.success('Rejected');
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('pending-approvals-gates') });
    },
    onError: () => message.error('Failed to reject'),
  });

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: withTenantQueryKey('pending-approvals-documents') });
    queryClient.invalidateQueries({ queryKey: withTenantQueryKey('pending-approvals-gates') });
  }, [queryClient]);

  const docCount = documentItems.length;
  const gateCount = gateItems.length;

  // ── Render ──
  if (isLoading && allItems.length === 0) {
    return (
      <Container>
        <Skeleton /><Skeleton /><Skeleton /><Skeleton />
      </Container>
    );
  }

  if (allItems.length === 0) {
    return (
      <EmptyState>
        <EmptyIcon><ShieldCheck size={36} strokeWidth={1.5} /></EmptyIcon>
        <EmptyTitle>No pending approvals</EmptyTitle>
        <EmptyDesc>
          Items needing your approval will appear here automatically.
        </EmptyDesc>
      </EmptyState>
    );
  }

  return (
    <Container>
      {/* KPI strip */}
      <KPIStrip>
        <KPIChip $variant="warning">
          <KPIValue $variant="warning">{allItems.length}</KPIValue>
          <KPILabel>Awaiting Approval</KPILabel>
        </KPIChip>
        {docCount > 0 && (
          <KPIChip $variant="info">
            <KPIValue $variant="info">{docCount}</KPIValue>
            <KPILabel>Documents</KPILabel>
          </KPIChip>
        )}
        {gateCount > 0 && (
          <KPIChip>
            <KPIValue>{gateCount}</KPIValue>
            <KPILabel>Rule Gates</KPILabel>
          </KPIChip>
        )}
      </KPIStrip>

      {/* Entity type filter pills */}
      {entityCounts.length > 1 && (
        <FilterRow>
          <FilterPill $active={entityFilter === 'all'} onClick={() => setEntityFilter('all')}>
            All ({allItems.length})
          </FilterPill>
          {entityCounts.map((ec) => (
            <FilterPill
              key={ec.type}
              $active={entityFilter === ec.type}
              onClick={() => setEntityFilter(ec.type)}
            >
              {ec.type.replace(/_/g, ' ')} ({ec.count})
            </FilterPill>
          ))}
        </FilterRow>
      )}

      {/* Item list */}
      <div role="list" aria-label="Pending approvals">
        {filteredItems.map((item) => (
          <ApprovalRow
            key={`${item.source}-${item.entityType}-${item.id}`}
            onClick={() => openRecord(item)}
            role="listitem"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && openRecord(item)}
          >
            <IconWrap>
              <ShieldAlert size={16} />
            </IconWrap>

            <EntityTag>{item.entityLabel}</EntityTag>

            {/* Status action cell for document items */}
            {item.source === 'document' && (
              <div onClick={(e) => e.stopPropagation()}>
                <StatusActionCell
                  entityType={item.entityType}
                  entityId={item.id}
                  status={item.status}
                  compact
                  onTransitioned={handleRefresh}
                />
              </div>
            )}

            <RowContent>
              <RowTitle>{item.identifier}</RowTitle>
              <RowMeta>
                <span>{item.partyName}</span>
                {item.rulesSummary && item.rulesSummary.length > 0 && (
                  <Tooltip title={item.rulesSummary.join(', ')}>
                    <span>📋 {item.rulesSummary.length} rule{item.rulesSummary.length !== 1 ? 's' : ''}</span>
                  </Tooltip>
                )}
              </RowMeta>
            </RowContent>

            <TimeAgo>{formatTimeAgo(item.createdAt)}</TimeAgo>

            <RowActions onClick={(e) => e.stopPropagation()}>
              {item.source === 'gate' && (
                <>
                  <ActionBtn
                    $variant="approve"
                    onClick={() => approveMutation.mutate(String(item.id))}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle2 size={12} /> Approve
                  </ActionBtn>
                  <ActionBtn
                    $variant="reject"
                    onClick={() => rejectMutation.mutate(String(item.id))}
                    disabled={rejectMutation.isPending}
                  >
                    <XCircle size={12} /> Reject
                  </ActionBtn>
                </>
              )}
              <ActionBtn $variant="open" onClick={() => openRecord(item)}>
                <ExternalLink size={12} /> Open
              </ActionBtn>
            </RowActions>
          </ApprovalRow>
        ))}
      </div>
    </Container>
  );
};

export default PendingApprovalsTab;
