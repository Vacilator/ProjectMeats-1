/**
 * TerminalNode Component
 * 
 * End nodes for workflows:
 * - Success (completed successfully)
 * - Error (terminated with error)
 * - Cancel (user or system cancellation)
 * 
 * Features:
 * - Final status message
 * - Data to return
 * - Notification settings
 * - Cleanup actions
 * 
 * Created: 2026-02-04 - Phase 2.1 Batch 2
 */
import React from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import styled from 'styled-components';
import { CheckCircle2, XCircle, Ban } from 'lucide-react';
import { BaseNode, BaseNodeData } from './BaseNode';

// ============================================================================
// Types
// ============================================================================

type TerminalType = 'success' | 'error' | 'cancel';

interface TerminalNodeData extends BaseNodeData {
  terminalType: TerminalType;
  message?: string;
  returnData?: Record<string, any>;
  notifyUser?: boolean;
  notificationMessage?: string;
  cleanupActions?: string[];
}

// ============================================================================
// Styled Components
// ============================================================================

const TerminalInfo = styled.div`
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

const MessageBox = styled.div<{ $type: TerminalType }>`
  padding: 8px;
  background: ${props =>
    props.$type === 'success'
      ? 'rgb(34 197 94 / 0.1)'
      : props.$type === 'error'
      ? 'rgb(239 68 68 / 0.1)'
      : 'rgb(156 163 175 / 0.1)'};
  border: 1px solid ${props =>
    props.$type === 'success'
      ? 'rgb(34 197 94 / 0.2)'
      : props.$type === 'error'
      ? 'rgb(239 68 68 / 0.2)'
      : 'rgb(156 163 175 / 0.2)'};
  border-radius: var(--radius-sm, 4px);
  font-size: 11px;
  color: ${props =>
    props.$type === 'success'
      ? 'rgb(21 128 61)'
      : props.$type === 'error'
      ? 'rgb(185 28 28)'
      : 'rgb(75 85 99)'};
  white-space: pre-wrap;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
  font-size: 10px;
  font-weight: 600;
  background: rgb(59 130 246 / 0.1);
  color: rgb(59 130 246);
`;

// ============================================================================
// Helper Functions
// ============================================================================

const getTerminalTypeInfo = (terminalType: TerminalType) => {
  switch (terminalType) {
    case 'success':
      return {
        icon: CheckCircle2,
        label: 'Success',
        color: 'rgb(var(--color-success))', // Green
      };
    case 'error':
      return {
        icon: XCircle,
        label: 'Error',
        color: 'rgb(var(--color-error))', // Red
      };
    case 'cancel':
      return {
        icon: Ban,
        label: 'Cancelled',
        color: 'rgb(var(--color-text-tertiary))',
      };
    default:
      return {
        icon: CheckCircle2,
        label: 'End',
        color: 'rgb(var(--color-text-tertiary))',
      };
  }
};

// ============================================================================
// Component
// ============================================================================

export const TerminalNode = React.memo<NodeProps<Node<TerminalNodeData>>>(({ data, id, selected }) => {
  const {
    terminalType,
    message,
    returnData,
    notifyUser,
    notificationMessage,
    cleanupActions,
  } = data;

  const typeInfo = getTerminalTypeInfo(terminalType);
  const Icon = typeInfo.icon;

  // Prepare config preview
  const configPreview: React.ReactNode[] = [];

  if (message) {
    configPreview.push(
      <MessageBox key="message" $type={terminalType}>
        {message}
      </MessageBox>
    );
  }

  if (returnData && Object.keys(returnData).length > 0) {
    configPreview.push(
      <InfoRow key="return">
        <span>Returns {Object.keys(returnData).length} field{Object.keys(returnData).length !== 1 ? 's' : ''}</span>
      </InfoRow>
    );
  }

  if (notifyUser && notificationMessage) {
    configPreview.push(
      <InfoRow key="notify">
        <Badge>
          🔔 Notification
        </Badge>
        <span style={{ fontSize: '11px', color: 'rgb(var(--color-text-tertiary))' }}>
          {notificationMessage.substring(0, 30)}{notificationMessage.length > 30 ? '...' : ''}
        </span>
      </InfoRow>
    );
  }

  if (cleanupActions && cleanupActions.length > 0) {
    configPreview.push(
      <InfoRow key="cleanup">
        <span style={{ fontSize: '11px', color: 'rgb(var(--color-text-tertiary))' }}>
          🧹 {cleanupActions.length} cleanup action{cleanupActions.length !== 1 ? 's' : ''}
        </span>
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
        maxInputs: 1, // Terminal nodes only have one input
        maxOutputs: 0, // Terminal nodes have no outputs
        configPreview: configPreview.length > 0 ? (
          <TerminalInfo>{configPreview}</TerminalInfo>
        ) : undefined,
      }}
      selected={selected}
      nodeType={{
        id: 'terminal',
        name: typeInfo.label,
        category: 'terminal',
        color: typeInfo.color,
        icon: '🏁',
        description: typeInfo.label,
        maxInputs: 1,
        maxOutputs: 0,
      }}
    />
  );
});

export default TerminalNode;
