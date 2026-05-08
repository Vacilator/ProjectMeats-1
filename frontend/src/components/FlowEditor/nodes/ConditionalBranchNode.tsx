/**
 * Conditional Branch Node Component
 *
 * Implements if/else logic branching in workflow execution.
 * Evaluates conditions and routes to different paths based on results.
 *
 * Phase 7.4: Advanced Node Types - Conditional Branching
 */

import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { BaseNode, BaseNodeData } from './BaseNode';
import { GitBranch, Plus, Trash2 } from 'lucide-react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Condition evaluation types
 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty'
  | 'matches_regex';

/**
 * Single condition configuration
 */
export interface Condition {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean;
}

/**
 * Condition group (AND/OR logic)
 */
export interface ConditionGroup {
  id: string;
  logic: 'AND' | 'OR';
  conditions: Condition[];
}

/**
 * Data structure for Conditional Branch Node
 */
export interface ConditionalBranchData extends BaseNodeData {
  /** Display name */
  label?: string;
  /** Description of the condition logic */
  description?: string;
  /** Condition groups (can have multiple groups with AND/OR between them) */
  conditionGroups: ConditionGroup[];
  /** Logic between condition groups (AND/OR) */
  groupLogic: 'AND' | 'OR';
  /** Path names (true/false branches) */
  trueBranchLabel?: string;
  falseBranchLabel?: string;
  /** Whether to show evaluation result in node */
  showResult?: boolean;
  /** Last evaluation result (for debugging) */
  lastResult?: boolean | null;
  /** Edit handler */
  onEdit?: () => void;
  /** Delete handler */
  onDelete?: () => void;
}

export interface ConditionalBranchNodeProps extends NodeProps<Node<ConditionalBranchData>> {}

// ============================================================================
// Styled Components
// ============================================================================

const NodeContainer = styled.div<{ isEvaluating?: boolean }>`
  min-width: 280px;
  background: rgb(var(--color-surface));
  border: 2px solid ${props =>
    props.isEvaluating
      ? 'rgb(var(--color-info))'
      : 'rgb(var(--color-border))'
  };
  border-radius: var(--radius-md);
  box-shadow: 0 2px 8px rgba(var(--color-overlay), 0.1);
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 4px 16px rgba(var(--color-overlay), 0.15);
  }
`;

const NodeHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(var(--color-info), 0.08);
  border-bottom: 1px solid rgba(var(--color-info), 0.2);
`;

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  color: rgb(var(--color-info));
`;

const NodeTitle = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const NodeLabel = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
`;

const NodeDescription = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const NodeBody = styled.div`
  padding: 16px;
`;

const ConditionSummary = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 12px;
  padding: 8px 12px;
  background: rgba(var(--color-info), 0.05);
  border-radius: var(--radius-sm);
  border-left: 3px solid rgb(var(--color-info));
`;

const BranchesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const BranchRow = styled.div<{ branchType: 'true' | 'false' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: ${props =>
    props.branchType === 'true'
      ? 'rgba(var(--color-success), 0.08)'
      : 'rgba(var(--color-error), 0.08)'
  };
  border-radius: var(--radius-sm);
  border: 1px solid ${props =>
    props.branchType === 'true'
      ? 'rgba(var(--color-success), 0.2)'
      : 'rgba(var(--color-error), 0.2)'
  };
`;

const BranchLabel = styled.div<{ branchType: 'true' | 'false' }>`
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: ${props =>
    props.branchType === 'true'
      ? 'rgb(var(--color-success))'
      : 'rgb(var(--color-error))'
  };
`;

const BranchBadge = styled.div<{ branchType: 'true' | 'false' }>`
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  border-radius: var(--radius-xs);
  background: ${props =>
    props.branchType === 'true'
      ? 'rgba(var(--color-success), 0.15)'
      : 'rgba(var(--color-error), 0.15)'
  };
  color: ${props =>
    props.branchType === 'true'
      ? 'rgb(var(--color-success))'
      : 'rgb(var(--color-error))'
  };
`;

const EvaluationResult = styled.div<{ result: boolean }>`
  margin-top: 12px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  background: ${props =>
    props.result
      ? 'rgba(var(--color-success), 0.1)'
      : 'rgba(var(--color-error), 0.1)'
  };
  color: ${props =>
    props.result
      ? 'rgb(var(--color-success))'
      : 'rgb(var(--color-error))'
  };
  text-align: center;
`;

const StyledHandle = styled(Handle)<{ handleType: 'true' | 'false' }>`
  width: 14px;
  height: 14px;
  border: 2px solid ${props =>
    props.handleType === 'true'
      ? 'rgb(var(--color-success))'
      : 'rgb(var(--color-error))'
  };
  background: rgb(var(--color-surface));
  border-radius: 6px;
  cursor: crosshair;
  z-index: 20;

  &.react-flow__handle-top,
  &[data-handlepos='top'] {
    top: -12px;
  }

  &.react-flow__handle-bottom,
  &[data-handlepos='bottom'] {
    bottom: -12px;
  }

  &:hover {
    background: ${props =>
      props.handleType === 'true'
        ? 'rgba(var(--color-success), 0.2)'
        : 'rgba(var(--color-error), 0.2)'
    };
    transform: scale(1.08);
  }
`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate human-readable summary of conditions
 */
function getConditionSummary(data: ConditionalBranchData): string {
  const { conditionGroups, groupLogic } = data;

  if (conditionGroups.length === 0) {
    return 'No conditions defined';
  }

  const groupSummaries = conditionGroups.map(group => {
    const condCount = group.conditions.length;
    if (condCount === 0) return null;

    return `${condCount} condition${condCount > 1 ? 's' : ''} (${group.logic})`;
  }).filter(Boolean);

  if (groupSummaries.length === 0) {
    return 'No conditions defined';
  }

  return groupSummaries.join(` ${groupLogic} `);
}

// ============================================================================
// Component
// ============================================================================

/**
 * Conditional Branch Node
 *
 * Implements if/else branching logic in workflows. Evaluates conditions
 * and routes execution to true or false branch based on result.
 *
 * Features:
 * - Multiple condition groups with AND/OR logic
 * - Rich set of comparison operators
 * - Visual feedback for evaluation results
 * - Labeled true/false branches
 * - Configurable via DynamicConfigPanel
 *
 * Usage:
 * ```tsx
 * const node = {
 *   id: 'cond-1',
 *   type: 'conditionalBranch',
 *   position: { x: 100, y: 100 },
 *   data: {
 *     label: 'Check Order Total',
 *     conditionGroups: [{
 *       id: 'g1',
 *       logic: 'AND',
 *       conditions: [{
 *         id: 'c1',
 *         field: 'order.total',
 *         operator: 'greater_than',
 *         value: 100
 *       }]
 *     }],
 *     trueBranchLabel: 'Apply Discount',
 *     falseBranchLabel: 'Standard Pricing'
 *   }
 * };
 * ```
 */
export const ConditionalBranchNode: React.FC<ConditionalBranchNodeProps> = ({
  data,
  selected
}) => {
  const [isEvaluating, setIsEvaluating] = useState(false);

  const conditionSummary = getConditionSummary(data);

  const trueBranchLabel = data.trueBranchLabel || 'True';
  const falseBranchLabel = data.falseBranchLabel || 'False';

  return (
    <NodeContainer isEvaluating={isEvaluating}>
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="input"
        style={{
          left: '50%',
          width: 14,
          height: 14,
          background: 'rgb(var(--color-primary))',
          border: '2px solid rgb(var(--color-surface))',
          borderRadius: 6,
          transform: 'translateX(-50%)',
        }}
        aria-label="Conditional Branch input"
      />

      {/* Header */}
      <NodeHeader>
        <IconWrapper>
          <GitBranch size={18} />
        </IconWrapper>
        <NodeTitle>
          <NodeLabel>{data.label || 'Conditional Branch'}</NodeLabel>
          {data.description && (
            <NodeDescription>{data.description}</NodeDescription>
          )}
        </NodeTitle>
      </NodeHeader>

      {/* Body */}
      <NodeBody>
        {/* Condition summary */}
        <ConditionSummary>
          {conditionSummary}
        </ConditionSummary>

        {/* Branch labels */}
        <BranchesContainer>
          <BranchRow branchType="true">
            <BranchLabel branchType="true">{trueBranchLabel}</BranchLabel>
            <BranchBadge branchType="true">True</BranchBadge>
          </BranchRow>

          <BranchRow branchType="false">
            <BranchLabel branchType="false">{falseBranchLabel}</BranchLabel>
            <BranchBadge branchType="false">False</BranchBadge>
          </BranchRow>
        </BranchesContainer>

        {/* Evaluation result (if enabled) */}
        {data.showResult && data.lastResult !== null && data.lastResult !== undefined && (
          <EvaluationResult result={data.lastResult}>
            Last evaluation: {data.lastResult ? 'TRUE' : 'FALSE'}
          </EvaluationResult>
        )}
      </NodeBody>

      {/* Output handles */}
      <StyledHandle
        type="source"
        position={Position.Bottom}
        id="true"
        handleType="true"
        style={{ left: '35%', transform: 'translateX(-50%)' }}
        aria-label="Conditional Branch true path"
      />
      <StyledHandle
        type="source"
        position={Position.Bottom}
        id="false"
        handleType="false"
        style={{ left: '65%', transform: 'translateX(-50%)' }}
        aria-label="Conditional Branch false path"
      />
    </NodeContainer>
  );
};

export default ConditionalBranchNode;
