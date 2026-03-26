/**
 * Error Edge Component
 * 
 * Specialized edge for error handling paths in workflows.
 * Features warning icons, red styling, and error message display.
 * 
 * Sprint 1: Visual Excellence - Task 1.1
 * Created: 2026-02-17
 */
import React, { useCallback, useState } from 'react';
import { type Edge, EdgeProps, getBezierPath, EdgeLabelRenderer, MarkerType, EdgeToolbar, useReactFlow } from '@xyflow/react';
import styled, { keyframes } from 'styled-components';

// ============================================================================
// Types
// ============================================================================

interface ErrorEdgeData extends Record<string, unknown> {
  label?: string;
  errorType?: string;
  animated?: boolean;
  errorCount?: number;
}

// ============================================================================
// Styled Components
// ============================================================================

const dashMove = keyframes`
  0% {
    stroke-dashoffset: 20;
  }
  100% {
    stroke-dashoffset: 0;
  }
`;

const ErrorLabel = styled.div`
  position: absolute;
  background: rgb(254, 226, 226);
  border: 2px solid #ef4444;
  border-radius: var(--radius-md, 6px);
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 700;
  color: rgb(153, 27, 27);
  pointer-events: all;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgb(239 68 68 / 0.2);

  &:hover {
    background: #ef4444;
    color: white;
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgb(239 68 68 / 0.3);
  }

  &::before {
    content: '⚠';
    display: inline-block;
    margin-right: 6px;
    font-size: 14px;
  }
`;

const ErrorPath = styled.path<{ $animate: boolean }>`
  stroke: #ef4444;
  stroke-width: 2.5;
  stroke-dasharray: 5 5;
  fill: none;
  transition: all 0.2s ease;

  ${(p) =>
    p.$animate
      ? `
    animation: ${dashMove} 1.2s linear infinite;
  `
      : ''}
`;

const ToolbarBtn = styled.button`
  appearance: none;
  border: 1px solid rgb(var(--color-border));
  background: rgba(var(--color-background-primary), 0.95);
  color: rgb(var(--color-text-primary));
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;

  &:hover {
    border-color: #ef4444;
    color: #ef4444;
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

export const ErrorEdge = React.memo<EdgeProps<Edge<ErrorEdgeData>>>(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  selected,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const label = data?.label || data?.errorType || 'Catch';
  const animated = data?.animated ?? true;
  const errorCount = data?.errorCount;

  const [isHovered, setIsHovered] = useState(false);
  const { setEdges } = useReactFlow();

  const handleConvertToNormalEdge = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === id
            ? {
                ...edge,
                type: ((edge.data as any)?.pmPrevType as string) || 'enhanced',
                data: {
                  ...(edge.data as any),
                },
              }
            : edge
        )
      );
    },
    [id, setEdges]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEdges((eds) => eds.filter((edge) => edge.id !== id));
    },
    [id, setEdges]
  );

  const edgeStyle: React.CSSProperties = {
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
      <ErrorPath
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        style={edgeStyle}
        markerEnd={`url(#warning-${id})`}
        $animate={animated}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
          title={`Error Edge: ${data?.errorType || 'Convert back or delete'}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {label}
        </ErrorLabel>

        <EdgeToolbar edgeId={id} x={labelX} y={labelY - 40} isVisible>
          <div
            style={{
              display: 'flex',
              gap: 8,
              opacity: isHovered || !!selected ? 1 : 0,
              pointerEvents: isHovered || !!selected ? 'all' : 'none',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <ToolbarBtn title="Convert back to normal" onClick={handleConvertToNormalEdge}>
              Normal
            </ToolbarBtn>
            <ToolbarBtn title="Delete edge" onClick={handleDelete}>
              Delete
            </ToolbarBtn>
          </div>
        </EdgeToolbar>

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
