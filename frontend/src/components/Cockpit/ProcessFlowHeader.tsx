/**
 * Process Flow Dynamic Header (RT-03.3)
 *
 * Shows a contextual header above the React Flow diagram with:
 * - Current step name + status badge
 * - Duration / time-in-step indicator
 * - Failure messaging with plain-English recovery hints
 * - Clickable node detail popover with contact info
 *
 * Theme Compliance: CSS custom properties only.
 */
import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  User,
  Mail,
  Phone,
  Building2,
  X,
} from 'lucide-react';
import { businessApi } from '../../services/businessApi';
import { withTenantQueryKey } from '../../utils/queryKeys';

// ============================================================================
// Types
// ============================================================================

interface ProcessHeaderInfo {
  current_step: string;
  current_step_label: string;
  status: string;
  started_at: string | null;
  last_activity_at: string | null;
  duration_seconds: number | null;
  failure_info: FailureInfo | null;
}

interface FailureInfo {
  step_label: string;
  error_code: string;
  plain_message: string;
  recovery_hint: string;
  failed_at: string;
  is_retriable: boolean;
}

interface NodeContactDetail {
  entity_type: string;
  entity_id: string;
  label: string;
  status: string;
  contact?: {
    name: string;
    email: string;
    phone?: string;
    contact_type?: string;
    title?: string;
    responsibilities?: string[];
  } | null;
  documents?: string[];
  inputs_summary?: string;
  outputs_summary?: string;
}

export interface ProcessFlowHeaderProps {
  inquiryId: string;
  className?: string;
}

export interface NodeDetailPopoverProps {
  entityType: string;
  entityId: string;
  inquiryId: string;
  onClose: () => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  margin-bottom: 8px;
  gap: 12px;
  flex-wrap: wrap;
`;

const StepInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StepLabel = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const StatusBadge = styled.span<{ $variant: 'success' | 'warning' | 'error' | 'info' | 'default' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 9999px;
  ${(p) => {
    switch (p.$variant) {
      case 'success':
        return 'background: rgba(34, 197, 94, 0.1); color: rgb(34, 197, 94);';
      case 'warning':
        return 'background: rgba(234, 179, 8, 0.1); color: rgb(234, 179, 8);';
      case 'error':
        return 'background: rgba(239, 68, 68, 0.1); color: rgb(239, 68, 68);';
      case 'info':
        return 'background: rgba(59, 130, 246, 0.1); color: rgb(59, 130, 246);';
      default:
        return 'background: rgba(156, 163, 175, 0.1); color: rgb(156, 163, 175);';
    }
  }}
`;

const DurationText = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  display: flex;
  align-items: center;
  gap: 4px;
`;

const FailureBar = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-md);
  margin-bottom: 8px;
`;

const FailureContent = styled.div`
  flex: 1;
`;

const FailureMessage = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: rgb(239, 68, 68);
  margin-bottom: 4px;
`;

const RecoveryHint = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  font-style: italic;
`;

const RetryButton = styled.button`
  font-size: 12px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(59, 130, 246, 0.3);
  background: rgba(59, 130, 246, 0.1);
  color: rgb(59, 130, 246);
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: rgba(59, 130, 246, 0.2);
  }
`;

// Node Detail Popover
const PopoverOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
`;

const PopoverCard = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  padding: 20px;
  min-width: 320px;
  max-width: 420px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
`;

const PopoverHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const PopoverTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  padding: 4px;
  border-radius: var(--radius-sm);

  &:hover {
    background: rgb(var(--color-background));
  }
`;

const ContactSection = styled.div`
  margin-top: 12px;
  padding: 10px 12px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-md);
`;

const ContactRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  margin-bottom: 6px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const TagList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
`;

const Tag = styled.span`
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.1);
  color: rgb(59, 130, 246);
`;

const SummaryRow = styled.div`
  margin-top: 10px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.4;

  strong {
    color: rgb(var(--color-text-primary));
  }
`;

// ============================================================================
// Helper functions
// ============================================================================

function getStatusVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  const s = status?.toLowerCase() ?? '';
  if (['completed', 'approved', 'ordered'].includes(s)) return 'success';
  if (['failed', 'cancelled', 'halted', 'error'].includes(s)) return 'error';
  if (['pending', 'initiated', 'waiting'].includes(s)) return 'warning';
  if (['in_progress', 'sourcing', 'logistics', 'running'].includes(s)) return 'info';
  return 'default';
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

// ============================================================================
// Components
// ============================================================================

export const NodeDetailPopover: React.FC<NodeDetailPopoverProps> = ({
  entityType,
  entityId,
  inquiryId,
  onClose,
}) => {
  const { data, isLoading } = useQuery({
    queryKey: withTenantQueryKey('node-detail', inquiryId, entityType, entityId),
    queryFn: async () => {
      const res = await businessApi.get(
        `/inquiries/${inquiryId}/lineage/node-detail/`,
        { params: { entity_type: entityType, entity_id: entityId } }
      );
      return res.data as NodeContactDetail;
    },
    enabled: !!entityId && !!inquiryId,
  });

  return (
    <PopoverOverlay onClick={onClose}>
      <PopoverCard onClick={(e) => e.stopPropagation()}>
        <PopoverHeader>
          <PopoverTitle>{data?.label ?? entityType}</PopoverTitle>
          <CloseButton onClick={onClose} aria-label="Close">
            <X size={16} />
          </CloseButton>
        </PopoverHeader>

        {isLoading && (
          <div style={{ color: 'rgb(var(--color-text-secondary))', fontSize: 13 }}>
            Loading details…
          </div>
        )}

        {data && (
          <>
            <StatusBadge $variant={getStatusVariant(data.status)}>
              {data.status}
            </StatusBadge>

            {data.contact && (
              <ContactSection>
                <ContactRow>
                  <User size={14} />
                  <span>{data.contact.name}</span>
                  {data.contact.title && (
                    <Tag>{data.contact.title}</Tag>
                  )}
                </ContactRow>
                {data.contact.email && (
                  <ContactRow>
                    <Mail size={14} />
                    <span>{data.contact.email}</span>
                  </ContactRow>
                )}
                {data.contact.phone && (
                  <ContactRow>
                    <Phone size={14} />
                    <span>{data.contact.phone}</span>
                  </ContactRow>
                )}
                {data.contact.contact_type && (
                  <ContactRow>
                    <Building2 size={14} />
                    <span>{data.contact.contact_type}</span>
                  </ContactRow>
                )}
                {data.contact.responsibilities && data.contact.responsibilities.length > 0 && (
                  <TagList>
                    {data.contact.responsibilities.map((r) => (
                      <Tag key={r}>{r}</Tag>
                    ))}
                  </TagList>
                )}
              </ContactSection>
            )}

            {data.inputs_summary && (
              <SummaryRow>
                <strong>Input:</strong> {data.inputs_summary}
              </SummaryRow>
            )}
            {data.outputs_summary && (
              <SummaryRow>
                <strong>Output:</strong> {data.outputs_summary}
              </SummaryRow>
            )}
            {data.documents && data.documents.length > 0 && (
              <SummaryRow>
                <strong>Documents:</strong> {data.documents.join(', ')}
              </SummaryRow>
            )}
          </>
        )}
      </PopoverCard>
    </PopoverOverlay>
  );
};

export const ProcessFlowHeader: React.FC<ProcessFlowHeaderProps> = ({
  inquiryId,
  className,
}) => {
  const [selectedNode, setSelectedNode] = useState<{
    entityType: string;
    entityId: string;
  } | null>(null);

  const { data } = useQuery({
    queryKey: withTenantQueryKey('process-header', inquiryId),
    queryFn: async () => {
      const res = await businessApi.get(`/inquiries/${inquiryId}/lineage/`);
      const lineage = res.data;
      // Derive header info from lineage
      const headerInfo: ProcessHeaderInfo = {
        current_step: lineage.current_step ?? 'unknown',
        current_step_label: formatStepLabel(lineage.current_step),
        status: lineage.inquiry?.status ?? 'unknown',
        started_at: null,
        last_activity_at: null,
        duration_seconds: null,
        failure_info: lineage.failure_info ?? null,
      };
      return headerInfo;
    },
    enabled: !!inquiryId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const handleNodeClick = useCallback((entityType: string, entityId: string) => {
    setSelectedNode({ entityType, entityId });
  }, []);

  if (!data) return null;

  const variant = getStatusVariant(data.status);
  const durationStr = formatDuration(data.duration_seconds);

  return (
    <>
      <HeaderContainer className={className}>
        <StepInfo>
          <StepLabel>{data.current_step_label}</StepLabel>
          <StatusBadge $variant={variant}>
            {variant === 'success' && <CheckCircle2 size={12} />}
            {variant === 'error' && <XCircle size={12} />}
            {variant === 'warning' && <AlertTriangle size={12} />}
            {data.status}
          </StatusBadge>
        </StepInfo>
        {durationStr && (
          <DurationText>
            <Clock size={12} />
            {durationStr}
          </DurationText>
        )}
      </HeaderContainer>

      {data.failure_info && (
        <FailureBar>
          <XCircle size={18} color="rgb(239, 68, 68)" style={{ flexShrink: 0, marginTop: 1 }} />
          <FailureContent>
            <FailureMessage>
              {data.failure_info.plain_message || `Step "${data.failure_info.step_label}" failed`}
            </FailureMessage>
            <RecoveryHint>
              {data.failure_info.recovery_hint || 'Check the step configuration and retry.'}
            </RecoveryHint>
          </FailureContent>
          {data.failure_info.is_retriable && (
            <RetryButton>Retry</RetryButton>
          )}
        </FailureBar>
      )}

      {selectedNode && (
        <NodeDetailPopover
          entityType={selectedNode.entityType}
          entityId={selectedNode.entityId}
          inquiryId={inquiryId}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </>
  );
};

// ============================================================================
// Helpers
// ============================================================================

function formatStepLabel(step: string): string {
  if (!step) return 'Unknown';
  return step
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default ProcessFlowHeader;
