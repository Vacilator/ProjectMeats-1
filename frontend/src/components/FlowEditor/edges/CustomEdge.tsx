/**
 * Custom Edge Component
 * 
 * Enhanced edge with visual feedback for the flow editor.
 * 
 * Features:
 * - Animated dots during execution
 * - Hover effects
 * - Click-to-insert node
 * - Type-specific styling
 * 
 * Created: 2026-02-04 - Phase 2.1 Batch 2
 */
import React from 'react';
import { type Edge, EdgeProps, getBezierPath, EdgeLabelRenderer } from '@xyflow/react';
import styled from 'styled-components';

// ============================================================================
// Types
// ============================================================================

interface CustomEdgeData extends Record<string, unknown> {
  label?: string;
  edgeType?: 'default' | 'conditional' | 'success' | 'error';
  animated?: boolean;
}

// ============================================================================
// Styled Components
// ============================================================================

const EdgeLabel = styled.div`
  position: absolute;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm, 4px);
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  pointer-events: all;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);

  &:hover {
    background: rgb(var(--color-surface-hover));
    border-color: rgb(var(--color-primary));
    transform: scale(1.05);
  }
`;

const AddNodeButton = styled.button`
  position: absolute;
  width: 24px;
  height: 24px;
  background: rgb(var(--color-primary));
  border: 2px solid rgb(var(--color-background));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: all;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 2px 8px rgb(var(--color-primary) / 0.3);
  }

  .react-flow__edge:hover & {
    opacity: 1;
  }
`;

// ============================================================================
// Helper Functions
// ============================================================================

const getEdgeStyle = (edgeType?: string, animated?: boolean) => {
  const baseStyle: React.CSSProperties = {
    strokeWidth: 2,
    transition: 'stroke 0.2s ease',
  };

  switch (edgeType) {
    case 'conditional':
      return {
        ...baseStyle,
        stroke: 'rgb(var(--color-info))',
        strokeDasharray: animated ? '5,5' : undefined,
      };
    case 'success':
      return {
        ...baseStyle,
        stroke: 'rgb(var(--color-success))',
        strokeWidth: 2.5,
      };
    case 'error':
      return {
        ...baseStyle,
        stroke: 'rgb(var(--color-error))',
        strokeDasharray: '4,4',
      };
    default:
      return {
        ...baseStyle,
        stroke: 'rgb(var(--color-border))',
      };
  }
};

// ============================================================================
// Component
// ============================================================================

export const CustomEdge = React.memo<EdgeProps<Edge<CustomEdgeData>>>(({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeType = data?.edgeType || 'default';
  const animated = data?.animated || false;
  const label = data?.label;

  const edgeStyle = {
    ...getEdgeStyle(edgeType, animated),
    ...style,
  };

  const handleAddNode = (event: React.MouseEvent) => {
    event.stopPropagation();

    window.dispatchEvent(
      new CustomEvent('insert-node-between', {
        detail: {
          edgeId: id,
          // Keep the originally requested keys for compatibility with existing handlers
          source: sourceX,
          target: targetX,
          // Helpful extras (no behavior change if ignored)
          sourceNodeId: source,
          targetNodeId: target,
          sourceY,
          targetY,
        },
      })
    );
  };

  return (
    <>
      {/* Invisible thick hitbox under the visible edge to prevent hover flicker */}
      <path
        d={edgePath}
        className="react-flow__edge-path"
        fill="none"
        style={{ stroke: 'transparent', strokeWidth: 30, strokeOpacity: 0 }}
        pointerEvents="stroke"
      />

      {/* Main edge path */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        fill="none"
        style={edgeStyle}
        markerEnd={markerEnd}
      />

      {/* Animated dots for execution preview */}
      {animated && (
        <circle r="3" fill={edgeStyle.stroke}>
          <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* Edge label and add button */}
      <EdgeLabelRenderer>
        {/* Conditional label */}
        {label && (
          <EdgeLabel
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {label}
          </EdgeLabel>
        )}

        {/* Add node button (appears on hover) */}
        <AddNodeButton
          onClick={handleAddNode}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          title="Add node between"
        >
          +
        </AddNodeButton>
      </EdgeLabelRenderer>
    </>
  );
});

export default CustomEdge;
