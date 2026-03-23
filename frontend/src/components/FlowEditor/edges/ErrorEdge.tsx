/**
 * Error Edge Component
 * 
 * Specialized edge for error handling paths in workflows.
 * Features warning icons, red styling, and error message display.
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

interface ErrorEdgeData {
  label?: string;
  errorType?: string;
  animated?: boolean;
  errorCount?: number;
}

// ============================================================================
// Styled Components
// ============================================================================

const ErrorLabel = styled.div`
  position: absolute;
  background: rgb(254, 226, 226);
  border: 2px solid rgb(239, 68, 68);
  border-radius: var(--radius-md, 6px);
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  color: rgb(153, 27, 27);
  pointer-events: all;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgb(239 68 68 / 0.2);

  &:hover {
    background: rgb(239, 68, 68);
    color: white;
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgb(239 68 68 / 0.3);
  }

  &::before {
    content: '⚠';
    display: inline-block;
    margin-right: 4px;
    font-size: 14px;
  }
`;

const ErrorBadge = styled.div`
  position: absolute;
  background: rgb(220, 38, 38);
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
  animation: shake 0.5s ease-in-out infinite;

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-2px); }
    75% { transform: translateX(2px); }
  }
`;

// ============================================================================
// Component
// ============================================================================

export const ErrorEdge = React.memo<EdgeProps<ErrorEdgeData>>(({
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

  const label = data?.label || data?.errorType || 'Error Handler';
  const animated = data?.animated || false;
  const errorCount = data?.errorCount;

  const edgeStyle: React.CSSProperties = {
    stroke: 'rgb(239, 68, 68)', // Red
    strokeWidth: 2.5,
    strokeDasharray: '6,6',
    transition: 'all 0.3s ease',
    ...style,
  };

  // Custom warning marker for error edges
  const markerEnd = {
    type: MarkerType.ArrowClosed,
    width: 24,
    height: 24,
    color: 'rgb(239, 68, 68)',
  };

  return (
    <>
      {/* SVG Marker Definition for Warning Triangle */}
      <defs>
        <marker
          id={`warning-${id}`}
          markerWidth="16"
          markerHeight="16"
          refX="13"
          refY="8"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M 8,2 L 14,14 L 2,14 Z"
            fill="rgb(239, 68, 68)"
            stroke="white"
            strokeWidth="1"
          />
          <text
            x="8"
            y="12"
            textAnchor="middle"
            fill="white"
            fontSize="8"
            fontWeight="700"
          >
            !
          </text>
        </marker>
      </defs>

      {/* Main edge path */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        fill="none"
        style={edgeStyle}
        markerEnd={`url(#warning-${id})`}
      />

      {/* Animated pulsing dots for errors */}
      {animated && (
        <>
          <circle r="4" fill="rgb(239, 68, 68)" opacity="0.8">
            <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r="4" fill="rgb(239, 68, 68)" opacity="0.6">
            <animateMotion dur="2s" begin="0.5s" repeatCount="indefinite" path={edgePath} />
          </circle>
        </>
      )}

      {/* Edge labels */}
      <EdgeLabelRenderer>
        {/* Error label */}
        <ErrorLabel
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          title={`Error Handler: ${data?.errorType || 'Click to configure'}`}
        >
          {label}
        </ErrorLabel>

        {/* Error count badge (if errors have occurred) */}
        {errorCount !== undefined && errorCount > 0 && (
          <ErrorBadge
            style={{
              transform: `translate(-50%, -50%) translate(${labelX + 60}px,${labelY}px)`,
            }}
            title={`${errorCount} error${errorCount !== 1 ? 's' : ''} caught`}
          >
            {errorCount}
          </ErrorBadge>
        )}
      </EdgeLabelRenderer>
    </>
  );
});

export default ErrorEdge;
