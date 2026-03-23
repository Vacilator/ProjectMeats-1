/**
 * Conditional Edge Component
 * 
 * Specialized edge for conditional branching in workflows.
 * Features diamond markers, conditional logic display, and visual feedback.
 * 
 * Sprint 1: Visual Excellence - Task 1.1
 * Created: 2026-02-17
 */
import React from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer, MarkerType } from '@xyflow/react';
import styled from 'styled-components';

// ============================================================================
// Types
// ============================================================================

interface ConditionalEdgeData {
  label?: string;
  condition?: string;
  animated?: boolean;
  isTrue?: boolean; // For visual feedback during execution
}

// ============================================================================
// Styled Components
// ============================================================================

const ConditionLabel = styled.div`
  position: absolute;
  background: rgb(251, 191, 36);
  border: 2px solid rgb(245, 158, 11);
  border-radius: var(--radius-md, 6px);
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  color: rgb(120, 53, 15);
  pointer-events: all;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgb(245 158 11 / 0.2);

  &:hover {
    background: rgb(245, 158, 11);
    color: white;
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgb(245 158 11 / 0.3);
  }

  &::before {
    content: '?';
    display: inline-block;
    margin-right: 4px;
    font-weight: 700;
  }
`;

const TrueFalseIndicator = styled.div<{ isTrue?: boolean }>`
  position: absolute;
  background: ${props => props.isTrue ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'};
  border: 2px solid white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 10px;
  font-weight: 700;
  pointer-events: none;
  animation: pulse 2s ease-in-out infinite;

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.8; }
  }
`;

// ============================================================================
// Component
// ============================================================================

export const ConditionalEdge = React.memo<EdgeProps<ConditionalEdgeData>>(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const label = data?.label || data?.condition || 'Condition';
  const animated = data?.animated || false;
  const isTrue = data?.isTrue;

  const edgeStyle: React.CSSProperties = {
    stroke: 'rgb(245, 158, 11)', // Orange
    strokeWidth: 2.5,
    strokeDasharray: animated ? '8,4' : undefined,
    transition: 'all 0.3s ease',
    ...style,
  };

  // Custom diamond marker for conditional edges
  const markerEnd = {
    type: MarkerType.ArrowClosed,
    width: 24,
    height: 24,
    color: 'rgb(245, 158, 11)',
  };

  return (
    <>
      {/* SVG Marker Definition for Diamond */}
      <defs>
        <marker
          id={`diamond-${id}`}
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M 0,6 L 6,0 L 12,6 L 6,12 Z"
            fill="rgb(245, 158, 11)"
            stroke="rgb(245, 158, 11)"
            strokeWidth="1"
          />
        </marker>
      </defs>

      {/* Main edge path */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        fill="none"
        style={edgeStyle}
        markerEnd={`url(#diamond-${id})`}
      />

      {/* Animated flow indicator */}
      {animated && (
        <circle r="4" fill="rgb(245, 158, 11)">
          <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* Edge labels */}
      <EdgeLabelRenderer>
        {/* Condition label */}
        <ConditionLabel
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          title={`Condition: ${data?.condition || 'Click to edit'}`}
        >
          {label}
        </ConditionLabel>

        {/* True/False execution indicator (during runtime) */}
        {isTrue !== undefined && (
          <TrueFalseIndicator
            isTrue={isTrue}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX + 60}px,${labelY}px)`,
            }}
          >
            {isTrue ? '✓' : '✗'}
          </TrueFalseIndicator>
        )}
      </EdgeLabelRenderer>
    </>
  );
});

export default ConditionalEdge;
