/**
 * UtilityNode Component
 *
 * Node for data operations and utilities:
 * - Transform (map/filter/reduce data)
 * - Lookup (query related records)
 * - Merge (combine data from multiple branches)
 * - Comment (visual annotation)
 *
 * Features:
 * - Data transformation rules
 * - Query builders
 * - Merge strategies
 * - Visual documentation
 *
 * Created: 2026-02-04 - Phase 2.1 Batch 2
 */
import React from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import styled from 'styled-components';
import { Shuffle, Search, GitMerge, MessageCircle, Code, Database } from 'lucide-react';
import { BaseNode, BaseNodeData } from './BaseNode';

// ============================================================================
// Types
// ============================================================================

type UtilityType = 'transform' | 'lookup' | 'merge' | 'comment';

interface UtilityNodeData extends BaseNodeData {
  utilityType: UtilityType;
  transformRules?: Array<{
    field: string;
    operation: string;
    value?: string;
  }>;
  lookupConfig?: {
    entity: string;
    field: string;
    value: string;
  };
  mergeStrategy?: 'first' | 'last' | 'all' | 'custom';
  commentText?: string;
  code?: string; // For custom transformations
}

// ============================================================================
// Styled Components
// ============================================================================

const UtilityInfo = styled.div`
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

const CommentBox = styled.div`
  padding: 8px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm, 4px);
  font-size: 11px;
  font-style: italic;
  color: rgb(var(--color-text-tertiary));
  white-space: pre-wrap;
  max-height: 80px;
  overflow-y: auto;
`;

const CodeBlock = styled.pre`
  padding: 8px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm, 4px);
  font-size: 10px;
  font-family: 'Monaco', 'Courier New', monospace;
  color: rgb(var(--color-text-secondary));
  max-height: 80px;
  overflow: auto;
  margin: 0;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  background: rgb(var(--color-primary) / 0.1);
  color: rgb(var(--color-primary));
`;

// ============================================================================
// Helper Functions
// ============================================================================

const getUtilityTypeInfo = (utilityType: UtilityType) => {
  switch (utilityType) {
    case 'transform':
      return {
        icon: Shuffle,
        label: 'Transform Data',
        color: 'rgb(var(--color-info))', // Blue
      };
    case 'lookup':
      return {
        icon: Search,
        label: 'Lookup Records',
        color: 'rgb(var(--color-primary))',
      };
    case 'merge':
      return {
        icon: GitMerge,
        label: 'Merge Data',
        color: 'rgb(var(--color-success))', // Green
      };
    case 'comment':
      return {
        icon: MessageCircle,
        label: 'Comment',
        color: 'rgb(var(--color-warning))', // Yellow
      };
    default:
      return {
        icon: Code,
        label: 'Utility',
        color: 'rgb(var(--color-text-tertiary))',
      };
  }
};

// ============================================================================
// Component
// ============================================================================

export const UtilityNode = React.memo<NodeProps<Node<UtilityNodeData>>>(({ data, id, selected }) => {
  const { utilityType, transformRules, lookupConfig, mergeStrategy, commentText, code } = data;

  const typeInfo = getUtilityTypeInfo(utilityType);
  const Icon = typeInfo.icon;

  // Prepare config preview
  const configPreview: React.ReactNode[] = [];

  if (utilityType === 'transform' && transformRules && transformRules.length > 0) {
    configPreview.push(
      <InfoRow key="rules">
        <Shuffle size={14} />
        <span>{transformRules.length} transformation{transformRules.length !== 1 ? 's' : ''}</span>
      </InfoRow>
    );

    if (code) {
      configPreview.push(
        <CodeBlock key="code">{code.substring(0, 100)}{code.length > 100 ? '...' : ''}</CodeBlock>
      );
    }
  }

  if (utilityType === 'lookup' && lookupConfig) {
    configPreview.push(
      <InfoRow key="lookup">
        <Database size={14} />
        <span>Entity: {lookupConfig.entity}</span>
      </InfoRow>
    );
    configPreview.push(
      <InfoRow key="field">
        <span>
          {lookupConfig.field} = {lookupConfig.value}
        </span>
      </InfoRow>
    );
  }

  if (utilityType === 'merge' && mergeStrategy) {
    configPreview.push(
      <InfoRow key="strategy">
        <GitMerge size={14} />
        <span>Strategy:</span>
        <Badge>{mergeStrategy}</Badge>
      </InfoRow>
    );
  }

  if (utilityType === 'comment' && commentText) {
    configPreview.push(
      <CommentBox key="comment">{commentText}</CommentBox>
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
          <UtilityInfo>{configPreview}</UtilityInfo>
        ) : undefined,
      }}
      selected={selected}
      nodeType={{
        id: 'utility',
        name: typeInfo.label,
        category: 'utility',
        color: typeInfo.color,
        icon: '🛠️',
        description: typeInfo.label,
        maxInputs: 1,
        maxOutputs: 1,
      }}
    />
  );
});

export default UtilityNode;
