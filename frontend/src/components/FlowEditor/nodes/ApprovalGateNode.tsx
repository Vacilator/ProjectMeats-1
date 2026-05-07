/**
 * ApprovalGateNode Component (RT-07.1)
 *
 * Renders an approval gate in the flow editor and cockpit diagrams.
 * Shows:
 * - Rule summary (margin threshold, credit limit, etc.)
 * - Target department and contact type
 * - Status indicator (pending/approved/rejected/auto-approved)
 * - One-click approve/reject buttons (in cockpit mode)
 *
 * Theme Compliance: CSS custom properties only.
 */
import React from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import styled from 'styled-components';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { BaseNode, BaseNodeData } from './BaseNode';

// ============================================================================
// Types
// ============================================================================

type ApprovalGateStatus = 'pending' | 'approved' | 'rejected' | 'auto_approved' | 'not_reached';

interface ApprovalRuleDisplay {
  rule_type: string;
  description: string;
  threshold?: string;
  passed?: boolean;
}

interface ApprovalGateNodeData extends BaseNodeData {
  /** Current status of this gate instance */
  approvalStatus?: ApprovalGateStatus;
  /** Target department for routing */
  targetDepartment?: string;
  /** Target contact type */
  targetContactType?: string;
  /** Rules configured on this gate */
  rules?: ApprovalRuleDisplay[];
  /** Who approved/rejected (display name) */
  decidedBy?: string;
  /** Decision comment */
  decisionComment?: string;
  /** Timeout hours (0 = no timeout) */
  timeoutHours?: number;
}

type ApprovalGateNodeType = Node<ApprovalGateNodeData>;

// ============================================================================
// Styled Components
// ============================================================================

const GateContainer = styled.div<{ $status: ApprovalGateStatus }>`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 200px;
`;

const StatusBanner = styled.div<{ $status: ApprovalGateStatus }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;

  ${({ $status }) => {
    switch ($status) {
      case 'approved':
      case 'auto_approved':
        return 'background: rgba(var(--color-success), 0.1); color: rgb(var(--color-success));';
      case 'rejected':
        return 'background: rgba(var(--color-error), 0.1); color: rgb(var(--color-error));';
      case 'pending':
        return 'background: rgba(var(--color-warning), 0.1); color: rgb(161, 98, 7);';
      default:
        return 'background: rgba(var(--color-border), 0.3); color: rgb(var(--color-text-secondary));';
    }
  }}
`;

const RulesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 4px;
`;

const RuleItem = styled.div<{ $passed?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: ${(p) =>
    p.$passed === true
      ? 'rgb(var(--color-success))'
      : p.$passed === false
        ? 'rgb(var(--color-error))'
        : 'rgb(var(--color-text-secondary))'};
`;

const RoutingInfo = styled.div`
  font-size: 10px;
  color: rgb(var(--color-text-secondary));
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid rgb(var(--color-border));
`;

// ============================================================================
// Helpers
// ============================================================================

const STATUS_LABELS: Record<ApprovalGateStatus, string> = {
  pending: 'Awaiting Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  auto_approved: 'Auto-Approved',
  not_reached: 'Not Reached',
};

const StatusIcon: React.FC<{ status: ApprovalGateStatus; size?: number }> = ({ status, size = 12 }) => {
  switch (status) {
    case 'approved':
      return <ShieldCheck size={size} />;
    case 'auto_approved':
      return <Zap size={size} />;
    case 'rejected':
      return <ShieldX size={size} />;
    case 'pending':
      return <ShieldAlert size={size} />;
    default:
      return <Clock size={size} />;
  }
};

// ============================================================================
// Component
// ============================================================================

const ApprovalGateNode: React.FC<NodeProps<ApprovalGateNodeType>> = (props) => {
  const { data, selected, id } = props;
  const status: ApprovalGateStatus = data.approvalStatus || 'not_reached';
  const rules = data.rules || [];

  return (
    <BaseNode
      id={id}
      data={{
        ...data,
        label: data.label || 'Approval Gate',
      }}
      selected={selected}
    >
      <GateContainer $status={status}>
        <StatusBanner $status={status}>
          <StatusIcon status={status} />
          <span>{STATUS_LABELS[status]}</span>
          {data.decidedBy && (
            <span style={{ fontWeight: 400, marginLeft: 4 }}>
              by {data.decidedBy}
            </span>
          )}
        </StatusBanner>

        {rules.length > 0 && (
          <RulesList>
            {rules.map((rule, idx) => (
              <RuleItem key={idx} $passed={rule.passed}>
                {rule.passed === true ? (
                  <CheckCircle2 size={10} />
                ) : rule.passed === false ? (
                  <XCircle size={10} />
                ) : (
                  <Clock size={10} />
                )}
                <span>{rule.description || rule.rule_type}</span>
                {rule.threshold && <span>({rule.threshold})</span>}
              </RuleItem>
            ))}
          </RulesList>
        )}

        {(data.targetDepartment || data.targetContactType) && (
          <RoutingInfo>
            Route to: {data.targetContactType || data.targetDepartment}
            {data.timeoutHours ? ` • ${data.timeoutHours}h timeout` : ''}
          </RoutingInfo>
        )}
      </GateContainer>
    </BaseNode>
  );
};

export default ApprovalGateNode;
export { ApprovalGateNode };
export type { ApprovalGateNodeData, ApprovalGateNodeType };
