/**
 * Success Edge Component
 * 
 * Specialized edge for successful completion paths in workflows.
 * Features checkmark indicators, green styling, and success metrics.
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

interface SuccessEdgeData {
  label?: string;
  successMessage?: string;
  animated?: boolean;
  successCount?: number;
}

// ============================================================================
// Styled Components
// ============================================================================

const SuccessLabel = styled.div`
  position: absolute;
  background: rgb(220, 252, 231);
  border: 2px solid rgb(34, 197, 94);
  border-radius: var(--radius-md, 6px);
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  color: rgb(21, 128, 61);
  pointer-events: all;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgb(34 197 94 / 0.2);

  &:hover {
    background: rgb(34, 197, 94);
    color: white;
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgb(34 197 94 / 0.3);
  }

  &::before {
    content: '✓';
    display: inline-block;
    margin-right: 4px;
    font-size: 14px;
    font-weight: 700;
  }
`;

const SuccessBadge = styled.div`
  position: absolute;
  background: rgb(22, 163, 74);
  border: 2px solid white;
  border-radius: 50%;
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 10px;
  font-weight: 700;
  pointer-events: none;
  box-shadow: 0 2px 4px rgb(0 0 0 / 0.2);
  animation: celebratePulse 2s ease-in-out infinite;

  @keyframes celebratePulse {
    0%, 100% { transform: scale(1); box-shadow: 0 2px 4px rgb(0 0 0 / 0.2); }
    50% { transform: scale(1.15); box-shadow: 0 4px 12px rgb(34 197 94 / 0.4); }
  }
`;

// ============================================================================
// Component
// ============================================================================

export const SuccessEdge = React.memo<EdgeProps<SuccessEdgeData>>(({
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

  const label = data?.label || data?.successMessage || 'Success';
  const animated = data?.animated || false;
  const successCount = data?.successCount;

  const { strokeWidth: _strokeWidth, vectorEffect: _vectorEffect, ...safeStyle } = (style || {}) as any;

  const edgeStyle: React.CSSProperties = {
    ...safeStyle,
    stroke: 'rgb(34, 197, 94)', // Green
    strokeWidth: 3,
    vectorEffect: 'non-scaling-stroke',
    transition: 'all 0.3s ease',
  };

  // Custom checkmark marker for success edges
  const markerEnd = {
    type: MarkerType.ArrowClosed,
    width: 24,
    height: 24,
    color: 'rgb(34, 197, 94)',
  };

  return (
    <>
      {/* SVG Marker Definition for Checkmark */}
      <defs>
        <marker
          id={`checkmark-${id}`}
          markerWidth="16"
          markerHeight="16"
          refX="13"
          refY="8"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <circle cx="8" cy="8" r="7" fill="rgb(34, 197, 94)" stroke="white" strokeWidth="1" />
          <path
            d="M 5,8 L 7,10 L 11,6"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>

      {/* Main edge path */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        style={edgeStyle}
        markerEnd={`url(#checkmark-${id})`}
      />

      {/* Animated sparkle effect for success */}
      {animated && (
        <>
          <circle r="3" fill="rgb(34, 197, 94)" opacity="1">
            <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r="2" fill="rgb(134, 239, 172)" opacity="0.7">
            <animateMotion dur="1.5s" begin="0.3s" repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r="2" fill="rgb(134, 239, 172)" opacity="0.7">
            <animateMotion dur="1.5s" begin="0.6s" repeatCount="indefinite" path={edgePath} />
          </circle>
        </>
      )}

      {/* Edge labels */}
      <EdgeLabelRenderer>
        {/* Success label */}
        <SuccessLabel
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          title={`Success Path: ${data?.successMessage || 'Completed successfully'}`}
        >
          {label}
        </SuccessLabel>

        {/* Success count badge (if tracking metrics) */}
        {successCount !== undefined && successCount > 0 && (
          <SuccessBadge
            style={{
              transform: `translate(-50%, -50%) translate(${labelX + 50}px,${labelY}px)`,
            }}
            title={`${successCount} successful execution${successCount !== 1 ? 's' : ''}`}
          >
            {successCount}
          </SuccessBadge>
        )}
      </EdgeLabelRenderer>
    </>
  );
});

export default SuccessEdge;
