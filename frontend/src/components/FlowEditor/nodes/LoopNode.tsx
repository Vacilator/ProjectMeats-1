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
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Card } from 'antd';
import { Repeat } from 'lucide-react';

import type { BaseNodeData } from './BaseNode';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Loop iteration types
 */
export type LoopType = 'for_each' | 'while' | 'for_range';

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

const Wrapper = styled.div`
  min-width: 280px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const Title = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
`;

const Subtitle = styled.div`
  margin-top: 2px;
  font-size: 12px;
  color: rgb(var(--color-text-tertiary));
`;

const Badge = styled.div`
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  background: rgba(234, 179, 8, 0.14);
  border: 1px solid rgba(234, 179, 8, 0.28);
  color: rgb(234, 179, 8);
`;

const HandleLabel = styled.div<{ $side: 'left' | 'right' }>`
  position: absolute;
  ${p => (p.$side === 'left' ? 'left: -2px;' : 'right: -2px;')}
  transform: translate(${p => (p.$side === 'left' ? '-100%' : '100%')}, -50%);
  font-size: 10px;
  font-weight: 700;
  color: rgb(var(--color-text-tertiary));
  white-space: nowrap;
  pointer-events: none;
`;

const BodyHint = styled.div`
  margin-top: 10px;
  padding: 10px;
  border-radius: var(--radius-md);
  border: 1px dashed rgba(234, 179, 8, 0.35);
  background: rgba(234, 179, 8, 0.06);
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
`;

const IterationCounter = styled.div`
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  background: rgba(234, 179, 8, 0.1);
  color: rgb(234, 179, 8);
  font-size: 12px;
  font-weight: 700;
  text-align: center;
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
export const LoopNode: React.FC<LoopNodeProps> = ({ data }) => {
  const isExecuting = data.currentIteration !== undefined && data.currentIteration !== null;

  const loopTypeLabel = getLoopTypeLabel(data.loopType);

  return (
    <Wrapper>
      {/* Target handles (2): Input Array + Trigger */}
      <Handle type="target" position={Position.Left} id="input-array" style={{ top: '38%' }} />
      <HandleLabel $side="left" style={{ top: '38%' }}>
        Input Array
      </HandleLabel>

      <Handle type="target" position={Position.Left} id="trigger" style={{ top: '70%' }} />
      <HandleLabel $side="left" style={{ top: '70%' }}>
        Trigger
      </HandleLabel>

      <Card
        size="small"
        styles={{
          body: { padding: 12 },
          header: { padding: '10px 12px' },
        }}
        title={
          <div>
            <HeaderRow>
              <div>
                <Title>
                  <Repeat size={16} /> Repeat
                </Title>
                {data.description ? <Subtitle>{data.description}</Subtitle> : null}
              </div>
              <Badge>{loopTypeLabel}</Badge>
            </HeaderRow>
          </div>
        }
      >
        <div style={{ fontSize: 12, color: 'rgb(var(--color-text-secondary))' }}>
          {data.loopType === 'for_each' ? (
            <>
              Loop over: <strong>{(data as any).arrayVariable ?? (data as any).dataSource ?? '—'}</strong>
              <br />
              Item var: <strong>{(data as any).itemVariable ?? (data as any).iteratorName ?? 'item'}</strong>
            </>
          ) : data.loopType === 'while' ? (
            <>
              Condition: <strong>{(data as any).condition ?? (data as any).whileCondition ?? '—'}</strong>
            </>
          ) : (
            <>
              Range loop
            </>
          )}
        </div>

        <BodyHint>
          Connect nodes to <strong>Loop Body</strong> to run per-item, and use <strong>On Complete</strong> for the
          post-loop path.
        </BodyHint>

        {data.showIterationCount && isExecuting ? (
          <IterationCounter>
            Iteration {data.currentIteration}
            {data.totalIterations ? ` of ${data.totalIterations}` : ''}
          </IterationCounter>
        ) : null}
      </Card>

      {/* Source handles (2): Loop Body + On Complete */}
      <Handle type="source" position={Position.Right} id="loop-body" style={{ top: '45%' }} />
      <HandleLabel $side="right" style={{ top: '45%' }}>
        Loop Body
      </HandleLabel>

      <Handle type="source" position={Position.Right} id="on-complete" style={{ top: '78%' }} />
      <HandleLabel $side="right" style={{ top: '78%' }}>
        On Complete
      </HandleLabel>
    </Wrapper>
  );
};

export default LoopNode;
