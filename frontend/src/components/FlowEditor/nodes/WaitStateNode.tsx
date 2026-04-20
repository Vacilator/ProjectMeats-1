/**
 * WaitStateNode Component
 * 
 * Node for waiting on external parties or conditions:
 * - Approval Pending (internal approver)
 * - Document Pending (waiting for upload)
 * - Response Pending (external party action)
 * - Payment Pending (payment confirmation)
 * 
 * Features:
 * - Deadline/timeout configuration
 * - Reminder settings
 * - Escalation rules
 * - Visual status indicator
 * 
 * Created: 2026-02-04 - Phase 2.1 Batch 2
 */
import React from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import styled from 'styled-components';
import { Clock, UserCheck, FileText, MessageSquare, CreditCard, AlertCircle } from 'lucide-react';
import { BaseNode, BaseNodeData } from './BaseNode';

// ============================================================================
// Types
// ============================================================================

type WaitType = 'approval' | 'document' | 'response' | 'payment';

interface WaitStateNodeData extends BaseNodeData {
  waitType: WaitType;
  assignedTo?: {
    type: 'user' | 'role' | 'email';
    value: string;
  };
  deadline?: {
    type: 'hours' | 'days' | 'date';
    value: number | string;
  };
  reminderEnabled?: boolean;
  reminderIntervalHours?: number;
  escalationEnabled?: boolean;
  escalationAfterHours?: number;
  escalationTo?: string;
  message?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const WaitInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const InfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Badge = styled.span<{ $variant?: 'warning' | 'info' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
  font-size: 11px;
  font-weight: 500;
  background: ${props =>
    props.$variant === 'warning'
      ? 'rgb(234 179 8 / 0.1)'
      : 'rgb(59 130 246 / 0.1)'};
  color: ${props =>
    props.$variant === 'warning'
      ? 'rgb(234 179 8)'
      : 'rgb(59 130 246)'};
`;

// ============================================================================
// Helper Functions
// ============================================================================

const getWaitTypeInfo = (waitType: WaitType) => {
  switch (waitType) {
    case 'approval':
      return {
        icon: UserCheck,
        label: 'Waiting for Approval',
        color: 'rgb(var(--color-warning))', // Yellow
      };
    case 'document':
      return {
        icon: FileText,
        label: 'Waiting for Document',
        color: 'rgb(var(--color-info))', // Blue
      };
    case 'response':
      return {
        icon: MessageSquare,
        label: 'Waiting for Response',
        color: 'rgb(var(--color-primary))',
      };
    case 'payment':
      return {
        icon: CreditCard,
        label: 'Waiting for Payment',
        color: 'rgb(var(--color-success))', // Green
      };
    default:
      return {
        icon: Clock,
        label: 'Waiting',
        color: 'rgb(var(--color-text-tertiary))',
      };
  }
};

const formatDeadline = (deadline?: { type: string; value: number | string }) => {
  if (!deadline) return null;
  
  if (deadline.type === 'hours') {
    return `${deadline.value} hours`;
  } else if (deadline.type === 'days') {
    return `${deadline.value} days`;
  } else {
    return new Date(deadline.value as string).toLocaleDateString();
  }
};

// ============================================================================
// Component
// ============================================================================

export const WaitStateNode = React.memo<NodeProps<Node<WaitStateNodeData>>>(({ data, id, selected }) => {
  const { waitType, assignedTo, deadline, reminderEnabled, escalationEnabled, message } = data;
  const typeInfo = getWaitTypeInfo(waitType);
  const Icon = typeInfo.icon;

  // Prepare config preview
  const configPreview: React.ReactNode[] = [];
  
  if (assignedTo) {
    configPreview.push(
      <InfoRow key="assignee">
        <Icon size={14} />
        <span>
          {assignedTo.type === 'user' ? 'User: ' : 
           assignedTo.type === 'role' ? 'Role: ' : 
           'Email: '}
          {assignedTo.value}
        </span>
      </InfoRow>
    );
  }

  const deadlineStr = formatDeadline(deadline);
  if (deadlineStr) {
    configPreview.push(
      <InfoRow key="deadline">
        <Clock size={14} />
        <span>Deadline: {deadlineStr}</span>
      </InfoRow>
    );
  }

  const badges: React.ReactNode[] = [];
  if (reminderEnabled) {
    badges.push(
      <Badge key="reminder" $variant="info">
        <Clock size={10} />
        Reminders
      </Badge>
    );
  }
  if (escalationEnabled) {
    badges.push(
      <Badge key="escalation" $variant="warning">
        <AlertCircle size={10} />
        Escalation
      </Badge>
    );
  }

  if (badges.length > 0) {
    configPreview.push(
      <InfoRow key="badges" style={{ gap: '4px', flexWrap: 'wrap' }}>
        {badges}
      </InfoRow>
    );
  }

  if (message) {
    configPreview.push(
      <InfoRow key="message" style={{ fontStyle: 'italic', color: 'rgb(var(--color-text-tertiary))' }}>
        "{message.substring(0, 50)}{message.length > 50 ? '...' : ''}"
      </InfoRow>
    );
  }

  return (
    <BaseNode
      id={id}
      data={{
        ...data,
        label: typeInfo.label,
        icon: Icon,
        color: typeInfo.color,
        configPreview: configPreview.length > 0 ? (
          <WaitInfo>{configPreview}</WaitInfo>
        ) : undefined,
      }}
      selected={selected}
      nodeType={{
        id: 'waitState',
        name: typeInfo.label,
        category: 'wait',
        color: typeInfo.color,
        icon: '⏳',
        description: typeInfo.label,
        maxInputs: 1,
        maxOutputs: 1,
      }}
    />
  );
});

export default WaitStateNode;
