/**
 * CockpitApprovalPanel (RT-07.2)
 *
 * Surfaces pending approvals in the Process Cockpit with:
 * - Clear list of items awaiting approval
 * - Rule context (why approval is needed)
 * - One-click approve/reject buttons
 * - Decision comment input
 * - Integrates with ApprovalGate backend service
 *
 * Theme Compliance: CSS custom properties only.
 * Service Layer: Uses businessApi for approval actions.
 */
import React, { useState, useCallback, useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Clock,
  AlertTriangle,
  User,
  Building2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { businessApi } from '../../services/businessApi';
import { withTenantQueryKey } from '../../utils/queryKeys';
import { getValidTenantId } from '../../utils/tenantId';

// ============================================================================
// Types
// ============================================================================

interface ApprovalItem {
  id: string;
  gate_id: string;
  entity_type: string;
  entity_id: string;
  entity_label: string;
  status: 'pending' | 'approved' | 'rejected';
  rules_summary: string[];
  target_department: string;
  created_at: string;
  context?: {
    margin_percent?: string;
    order_total?: string;
    supplier_name?: string;
  };
}

export interface CockpitApprovalPanelProps {
  compact?: boolean;
  className?: string;
}

// ============================================================================
// Animations
// ============================================================================

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
`;

// ============================================================================
// Styled Components
// ============================================================================

const PanelContainer = styled.div<{ $compact?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${(p) => (p.$compact ? '8px' : '12px')};
`;

const ApprovalCard = styled.div<{ $expanded?: boolean }>`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  overflow: hidden;
  animation: ${fadeIn} 0.2s ease;
  transition: box-shadow 0.15s;

  ${(p) => p.$expanded && `
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    border-color: rgba(var(--color-warning), 0.4);
  `}
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.1s;

  &:hover {
    background: rgba(var(--color-border), 0.2);
  }
`;

const StatusIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--color-warning), 0.1);
  color: rgb(var(--color-warning));
  flex-shrink: 0;
`;

const CardInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const CardTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CardMeta = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ExpandIcon = styled.div`
  color: rgb(var(--color-text-secondary));
`;

const CardBody = styled.div`
  padding: 0 16px 16px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
`;

const RulesSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const RuleItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const ContextGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
`;

const ContextItem = styled.div`
  padding: 6px 10px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-sm);
  font-size: 11px;
`;

const ContextLabel = styled.div`
  color: rgb(var(--color-text-secondary));
  margin-bottom: 2px;
`;

const ContextValue = styled.div`
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const CommentInput = styled.textarea`
  width: 100%;
  min-height: 60px;
  padding: 8px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));

  &:focus {
    outline: none;
    border-color: rgb(var(--color-info));
  }

  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

const ActionRow = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`;

const ActionBtn = styled.button<{ $variant: 'approve' | 'reject' }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.1s;

  ${(p) =>
    p.$variant === 'approve'
      ? `
    background: rgb(var(--color-success));
    color: rgb(var(--color-text-inverse));
    &:hover { background: rgb(var(--color-success)); opacity: 0.9; }
  `
      : `
    background: rgba(var(--color-error), 0.1);
    color: rgb(var(--color-error));
    border: 1px solid rgba(var(--color-error), 0.3);
    &:hover { background: rgba(var(--color-error), 0.15); }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
  gap: 8px;
`;

const BadgeCount = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: rgba(var(--color-warning), 0.15);
  color: rgb(161, 98, 7);
`;

// ============================================================================
// Component
// ============================================================================

export const CockpitApprovalPanel: React.FC<CockpitApprovalPanelProps> = ({
  compact = false,
  className,
}) => {
  const tenantId = getValidTenantId();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  // Fetch pending approvals
  const { data: approvals, isLoading } = useQuery({
    queryKey: withTenantQueryKey('cockpit-pending-approvals'),
    queryFn: async () => {
      try {
        const res = await businessApi.get('/workflows/approvals/pending/');
        return (res.data?.results ?? res.data ?? []) as ApprovalItem[];
      } catch {
        // API may not exist yet — return empty gracefully
        return [] as ApprovalItem[];
      }
    },
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });

  const pendingItems = useMemo(
    () => (approvals || []).filter((a) => a.status === 'pending'),
    [approvals],
  );

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ gateId, comment }: { gateId: string; comment: string }) => {
      return businessApi.post(`/workflows/approvals/${gateId}/approve/`, { comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('cockpit-pending-approvals') });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ gateId, comment }: { gateId: string; comment: string }) => {
      return businessApi.post(`/workflows/approvals/${gateId}/reject/`, { comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('cockpit-pending-approvals') });
    },
  });

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleApprove = useCallback(
    (item: ApprovalItem) => {
      approveMutation.mutate({
        gateId: item.gate_id,
        comment: comments[item.id] || '',
      });
    },
    [approveMutation, comments],
  );

  const handleReject = useCallback(
    (item: ApprovalItem) => {
      rejectMutation.mutate({
        gateId: item.gate_id,
        comment: comments[item.id] || '',
      });
    },
    [rejectMutation, comments],
  );

  if (isLoading) {
    return (
      <EmptyState>
        <Clock size={24} />
        Loading approvals...
      </EmptyState>
    );
  }

  if (pendingItems.length === 0) {
    return (
      <EmptyState>
        <ShieldCheck size={28} strokeWidth={1.5} />
        <span>No pending approvals</span>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          Approval requests will appear here when triggered.
        </span>
      </EmptyState>
    );
  }

  return (
    <PanelContainer $compact={compact} className={className}>
      {pendingItems.map((item) => {
        const isExpanded = expandedId === item.id;

        return (
          <ApprovalCard key={item.id} $expanded={isExpanded}>
            <CardHeader onClick={() => handleToggle(item.id)}>
              <StatusIcon>
                <ShieldAlert size={16} />
              </StatusIcon>
              <CardInfo>
                <CardTitle>{item.entity_label}</CardTitle>
                <CardMeta>
                  <Building2 size={11} />
                  <span>{item.target_department}</span>
                  <span>•</span>
                  <Clock size={11} />
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                </CardMeta>
              </CardInfo>
              <ExpandIcon>
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </ExpandIcon>
            </CardHeader>

            {isExpanded && (
              <CardBody>
                {/* Rules that triggered this gate */}
                {item.rules_summary.length > 0 && (
                  <RulesSection>
                    {item.rules_summary.map((rule, idx) => (
                      <RuleItem key={idx}>
                        <AlertTriangle size={11} />
                        <span>{rule}</span>
                      </RuleItem>
                    ))}
                  </RulesSection>
                )}

                {/* Context data */}
                {item.context && (
                  <ContextGrid>
                    {item.context.margin_percent && (
                      <ContextItem>
                        <ContextLabel>Margin</ContextLabel>
                        <ContextValue>{item.context.margin_percent}%</ContextValue>
                      </ContextItem>
                    )}
                    {item.context.order_total && (
                      <ContextItem>
                        <ContextLabel>Order Total</ContextLabel>
                        <ContextValue>${Number(item.context.order_total).toLocaleString()}</ContextValue>
                      </ContextItem>
                    )}
                    {item.context.supplier_name && (
                      <ContextItem>
                        <ContextLabel>Supplier</ContextLabel>
                        <ContextValue>{item.context.supplier_name}</ContextValue>
                      </ContextItem>
                    )}
                  </ContextGrid>
                )}

                {/* Comment input */}
                <CommentInput
                  placeholder="Add a comment (optional for approve, recommended for reject)..."
                  value={comments[item.id] || ''}
                  onChange={(e) =>
                    setComments((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                />

                {/* Action buttons */}
                <ActionRow>
                  <ActionBtn
                    $variant="reject"
                    onClick={() => handleReject(item)}
                    disabled={rejectMutation.isPending}
                  >
                    <XCircle size={14} />
                    Reject
                  </ActionBtn>
                  <ActionBtn
                    $variant="approve"
                    onClick={() => handleApprove(item)}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle2 size={14} />
                    Approve
                  </ActionBtn>
                </ActionRow>
              </CardBody>
            )}
          </ApprovalCard>
        );
      })}
    </PanelContainer>
  );
};

export default CockpitApprovalPanel;
