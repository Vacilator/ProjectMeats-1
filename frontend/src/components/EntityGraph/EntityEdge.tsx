/**
 * Entity Edge Component (Wave 2: Cockpit Command Center)
 * 
 * Custom styled edge for entity relationship visualization.
 * 
 * Features:
 * - Animated edge path
 * - Relationship type labels
 * - Color-coded by relationship type
 * - Hover state for highlighting
 * 
 * Theme Compliance:
 * - Uses CSS custom properties for colors
 */
import React, { FC, memo } from 'react';
import {
  type EdgeProps,
  type Edge,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from '@xyflow/react';
import styled from 'styled-components';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface EntityEdgeData {
  [key: string]: unknown;
  label?: string;
  relationship?: string;
  animated?: boolean;
}

// ============================================================================
// Relationship Type Colors
// ============================================================================

const RELATIONSHIP_COLORS: Record<string, string> = {
  // Ownership/hierarchy
  owns: 'rgb(var(--color-primary))',
  belongs_to: 'rgb(var(--color-primary))',
  parent: 'rgb(var(--color-primary))',
  child: 'rgb(var(--color-primary))',
  
  // Business relationships
  supplies: 'rgb(var(--color-success))',      // success green
  purchases: 'rgb(var(--color-info))',    // info blue
  has_order: 'rgb(var(--color-warning))',     // warning yellow
  
  // Financial
  invoiced: 'rgb(168, 85, 247)',     // purple
  payment: 'rgb(var(--color-success))',       // success green
  
  // Default
  default: 'rgb(var(--color-text-tertiary))',
};

// ============================================================================
// Styled Components
// ============================================================================

const EdgeLabel = styled.div<{ $color: string }>`
  position: absolute;
  background: rgb(var(--color-bg-secondary));
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  color: ${props => props.$color};
  border: 1px solid ${props => props.$color}40;
  pointer-events: all;
  cursor: default;
  white-space: nowrap;
  
  &:hover {
    background: rgb(var(--color-bg-tertiary));
    transform: scale(1.05);
  }
`;

// ============================================================================
// Component
// ============================================================================

const EntityEdge: FC<EdgeProps<Edge<EntityEdgeData>>> = ({
  id,
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

  // Determine edge color based on relationship type
  const relationship = data?.relationship?.toLowerCase() || 'default';
  const edgeColor = RELATIONSHIP_COLORS[relationship] || RELATIONSHIP_COLORS.default;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: 2,
          opacity: 0.8,
        }}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <EdgeLabel
            $color={edgeColor}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
            className="nodrag nopan"
          >
            {data.label}
          </EdgeLabel>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default memo(EntityEdge);
