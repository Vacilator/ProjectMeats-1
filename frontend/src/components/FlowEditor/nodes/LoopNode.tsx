/**
 * Loop Node Component
 * 
 * Implements iteration logic for repeating workflow steps.
 * Supports for-each, while, and for-range loop types.
 * 
 * Phase 7.4: Advanced Node Types - Loop Constructs
 */

import React from 'react';
import styled from 'styled-components';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { BaseNode, BaseNodeData } from './BaseNode';
import { Repeat, RefreshCw } from 'lucide-react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Loop iteration types
 */
export type LoopType = 
  | 'for_each'      // Iterate over array/collection
  | 'while'         // Loop while condition is true
  | 'for_range';    // Loop with start/end/step

/**
 * Data structure for Loop Node
 */
export interface LoopNodeData extends BaseNodeData {
  /** Display name */
  label?: string;
  /** Description */
  description?: string;
  /** Loop type */
  loopType: LoopType;
  /** Data source for for-each (field path) */
  dataSource?: string;
  /** Loop variable name */
  iteratorName?: string;
  /** Condition for while loop */
  whileCondition?: string;
  /** Start value for for-range */
  rangeStart?: number;
  /** End value for for-range */
  rangeEnd?: number;
  /** Step value for for-range */
  rangeStep?: number;
  /** Maximum iterations (safety limit) */
  maxIterations?: number;
  /** Whether to break on error */
  breakOnError?: boolean;
  /** Show iteration count */
  showIterationCount?: boolean;
  /** Current iteration (for runtime display) */
  currentIteration?: number;
  /** Total iterations (for runtime display) */
  totalIterations?: number;
  /** Edit handler */
  onEdit?: () => void;
  /** Delete handler */
  onDelete?: () => void;
}

export interface LoopNodeProps extends NodeProps<LoopNodeData> {}

// ============================================================================
// Styled Components
// ============================================================================

const NodeContainer = styled.div<{ isExecuting?: boolean }>`
  min-width: 260px;
  background: rgb(var(--color-surface));
  border: 2px solid ${props => 
    props.isExecuting 
      ? 'rgb(234, 179, 8)' 
      : 'rgb(var(--color-border))'
  };
  border-radius: var(--radius-md);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  
  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }
`;

const NodeHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(234, 179, 8, 0.08);
  border-bottom: 1px solid rgba(234, 179, 8, 0.2);
`;

const IconWrapper = styled.div<{ isExecuting?: boolean }>`
  display: flex;
  align-items: center;
  color: rgb(234, 179, 8);
  
  ${props => props.isExecuting && `
    animation: spin 2s linear infinite;
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `}
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

const LoopConfig = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
`;

const ConfigRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
`;

const ConfigLabel = styled.div`
  color: rgb(var(--color-text-secondary));
  min-width: 80px;
`;

const ConfigValue = styled.div`
  flex: 1;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 12px;
  padding: 4px 8px;
  background: rgba(234, 179, 8, 0.05);
  border-radius: var(--radius-xs);
  color: rgb(var(--color-text-primary));
  border: 1px solid rgba(234, 179, 8, 0.2);
`;

const LoopTypeBadge = styled.div`
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  border-radius: var(--radius-sm);
  background: rgba(234, 179, 8, 0.15);
  color: rgb(234, 179, 8);
  text-align: center;
`;

const IterationCounter = styled.div`
  margin-top: 12px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  background: rgba(234, 179, 8, 0.1);
  color: rgb(234, 179, 8);
  text-align: center;
`;

const LoopBody = styled.div`
  margin-top: 12px;
  padding: 12px;
  border: 2px dashed rgba(234, 179, 8, 0.3);
  border-radius: var(--radius-sm);
  text-align: center;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get human-readable loop type label
 */
function getLoopTypeLabel(loopType: LoopType): string {
  const labels: Record<LoopType, string> = {
    for_each: 'For Each',
    while: 'While',
    for_range: 'For Range',
  };
  return labels[loopType];
}

/**
 * Get loop configuration display
 */
function getLoopConfigDisplay(data: LoopNodeData): React.ReactNode {
  const { loopType, dataSource, iteratorName, whileCondition, rangeStart, rangeEnd, rangeStep } = data;
  
  switch (loopType) {
    case 'for_each':
      return (
        <>
          {dataSource && (
            <ConfigRow>
              <ConfigLabel>Source:</ConfigLabel>
              <ConfigValue>{dataSource}</ConfigValue>
            </ConfigRow>
          )}
          {iteratorName && (
            <ConfigRow>
              <ConfigLabel>Item:</ConfigLabel>
              <ConfigValue>{iteratorName}</ConfigValue>
            </ConfigRow>
          )}
        </>
      );
      
    case 'while':
      return whileCondition && (
        <ConfigRow>
          <ConfigLabel>Condition:</ConfigLabel>
          <ConfigValue>{whileCondition}</ConfigValue>
        </ConfigRow>
      );
      
    case 'for_range':
      return (
        <>
          <ConfigRow>
            <ConfigLabel>Range:</ConfigLabel>
            <ConfigValue>
              {rangeStart ?? 0} to {rangeEnd ?? 10} (step {rangeStep ?? 1})
            </ConfigValue>
          </ConfigRow>
          {iteratorName && (
            <ConfigRow>
              <ConfigLabel>Counter:</ConfigLabel>
              <ConfigValue>{iteratorName}</ConfigValue>
            </ConfigRow>
          )}
        </>
      );
      
    default:
      return null;
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * Loop Node
 * 
 * Implements iteration logic for repeating workflow steps. Supports
 * multiple loop types (for-each, while, for-range) with safety limits.
 * 
 * Features:
 * - Three loop types (for-each, while, for-range)
 * - Configurable iterator names
 * - Maximum iteration limits (safety)
 * - Break on error option
 * - Runtime iteration counter
 * - Visual execution feedback
 * 
 * Usage:
 * ```tsx
 * // For-each loop
 * const forEachNode = {
 *   type: 'loop',
 *   data: {
 *     label: 'Process Items',
 *     loopType: 'for_each',
 *     dataSource: 'order.items',
 *     iteratorName: 'item',
 *     maxIterations: 100
 *   }
 * };
 * 
 * // While loop
 * const whileNode = {
 *   type: 'loop',
 *   data: {
 *     label: 'Retry Until Success',
 *     loopType: 'while',
 *     whileCondition: 'status !== "complete"',
 *     maxIterations: 10
 *   }
 * };
 * 
 * // For-range loop
 * const forRangeNode = {
 *   type: 'loop',
 *   data: {
 *     label: 'Process Pages',
 *     loopType: 'for_range',
 *     rangeStart: 1,
 *     rangeEnd: 10,
 *     rangeStep: 1,
 *     iteratorName: 'page'
 *   }
 * };
 * ```
 */
export const LoopNode: React.FC<LoopNodeProps> = ({ data, selected }) => {
  const isExecuting = data.currentIteration !== undefined && data.currentIteration !== null;
  
  const loopTypeLabel = getLoopTypeLabel(data.loopType);
  const configDisplay = getLoopConfigDisplay(data);

  const config = (data as any).config || {};
  const arraySource: string | undefined =
    data.dataSource ||
    config.arrayVariable ||
    config.collection ||
    config.array_source ||
    undefined;

  const maxIterations: number | undefined =
    data.maxIterations ??
    (typeof config.maxIterations === 'number'
      ? config.maxIterations
      : typeof config.maxIterations === 'string'
        ? parseInt(config.maxIterations, 10)
        : typeof config.max_iterations === 'number'
          ? config.max_iterations
          : undefined);

  return (
    <NodeContainer isExecuting={isExecuting}>
      {/* Input Array handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ top: '50%' }}
        aria-label="Input Array"
      />

      {/* Header */}
      <NodeHeader>
        <IconWrapper isExecuting={isExecuting}>
          <Repeat size={18} />
        </IconWrapper>
        <NodeTitle>
          <NodeLabel>{data.label || 'Loop'}</NodeLabel>
          {data.description && <NodeDescription>{data.description}</NodeDescription>}
        </NodeTitle>
      </NodeHeader>

      {/* Body */}
      <NodeBody>
        <LoopTypeBadge>{loopTypeLabel}</LoopTypeBadge>

        {/* Array Source */}
        {arraySource && (
          <ConfigRow>
            <ConfigLabel>Array Source:</ConfigLabel>
            <ConfigValue>{arraySource}</ConfigValue>
          </ConfigRow>
        )}

        {/* Config preview (legacy display) */}
        {configDisplay && <LoopConfig>{configDisplay}</LoopConfig>}

        {/* Max iterations badge */}
        {maxIterations !== undefined && !Number.isNaN(maxIterations) && (
          <ConfigRow>
            <ConfigLabel>Max Iterations:</ConfigLabel>
            <ConfigValue>{maxIterations}</ConfigValue>
          </ConfigRow>
        )}

        <LoopBody>
          Loop Body
          <br />
          <small>(Connect child nodes here)</small>
        </LoopBody>

        {data.showIterationCount && isExecuting && (
          <IterationCounter>
            Iteration {data.currentIteration}
            {data.totalIterations && ` of ${data.totalIterations}`}
          </IterationCounter>
        )}
      </NodeBody>

      {/* Loop Body handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="loop-body"
        style={{ top: '50%', background: 'rgb(234, 179, 8)' }}
        aria-label="Loop Body"
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="complete"
        style={{ left: '50%' }}
        aria-label="Loop Complete"
      />
    </NodeContainer>
  );
};

export default LoopNode;
