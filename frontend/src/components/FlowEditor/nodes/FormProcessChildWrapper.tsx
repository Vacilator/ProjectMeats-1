/**
 * Form Process Child Wrapper Component
 * 
 * Wrapper for child nodes inside FormProcessGroupNode that provides:
 * - Vertical auto-layout
 * - Consistent spacing
 * - Visual indicators for parent-child relationship
 * - Drag constraints (extent: 'parent')
 * 
 * This component is used by the FormProcessGroupNode to ensure all children
 * follow consistent layout rules without manual positioning.
 * 
 * Created: 2026-02-19 - Phase E.3
 * 
 * @module FormProcessChildWrapper
 */

import React from 'react';
import styled from 'styled-components';
import type { Node, NodeProps } from '@xyflow/react';
import { BaseNodeData } from './BaseNode';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Child wrapper data interface
 * Extends BaseNodeData with position-in-parent metadata
 */
export interface FormProcessChildData extends BaseNodeData {
  /** Index of this step within the parent container */
  stepIndex?: number;
  /** Total steps in parent container */
  totalSteps?: number;
  /** Parent container ID */
  parentId?: string;
}

export type ChildWrapperProps = FormProcessChildWrapperProps;

export interface FormProcessChildWrapperProps extends NodeProps<Node<FormProcessChildData>> {
  /** Child content to render */
  children?: React.ReactNode;
}

// ============================================================================
// Styled Components
// ============================================================================

/**
 * Wrapper container with auto-layout styling
 */
const ChildContainer = styled.div<{ stepIndex: number; isFirst: boolean; isLast: boolean }>`
  position: relative;
  width: 100%;
  margin-bottom: ${props => props.isLast ? '0' : '24px'};
  padding: 16px;
  background: rgb(var(--color-background-primary));
  border: 2px solid rgba(var(--color-primary), 0.2);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(var(--color-overlay), 0.05);
  transition: all 0.2s ease;
  
  /* Step indicator line */
  ${props => !props.isLast && `
    &::after {
      content: '';
      position: absolute;
      left: 50%;
      bottom: -24px;
      transform: translateX(-50%);
      width: 2px;
      height: 24px;
      background: rgba(var(--color-primary), 0.3);
      pointer-events: none;
    }
  `}
  
  &:hover {
    border-color: rgba(var(--color-primary), 0.4);
    box-shadow: 0 4px 12px rgba(var(--color-overlay), 0.08);
  }
  
  /* Drag handle indicator */
  &::before {
    content: '⋮⋮';
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 14px;
    color: rgba(var(--color-primary), 0.3);
    cursor: grab;
    user-select: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  &:hover::before {
    opacity: 1;
  }
`;

/**
 * Step number badge
 */
const StepBadge = styled.div`
  position: absolute;
  top: -12px;
  left: 12px;
  background: rgba(var(--color-primary), 0.9);
  color: rgb(var(--color-text-inverse));
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(var(--color-overlay), 0.15);
  z-index: 1;
  pointer-events: none;
  user-select: none;
`;

/**
 * Content area for wrapped child node
 */
const ContentArea = styled.div`
  position: relative;
  padding-left: 24px; /* Space for drag handle */
`;

// ============================================================================
// Layout Calculation Utilities
// ============================================================================

/**
 * Calculate vertical position for a child node based on its index
 * 
 * (Kept for backward compatibility; the Book+Pages paradigm prefers horizontal sequencing.)
 */
export function calculateChildYPosition(
  stepIndex: number,
  baseY: number = 60,
  spacing: number = 120
): number {
  return baseY + (stepIndex * spacing);
}

/**
 * Calculate horizontal position for a child node based on its index
 * 
 * Book+Pages: steps flow left-to-right like pages on a track.
 */
export function calculateChildXPosition(
  stepIndex: number,
  baseX: number = 20,
  spacing: number = 350
): number {
  return baseX + (stepIndex * spacing);
}

/**
 * Auto-layout children within a container
 * Updates node positions to follow horizontal "pages" sequencing
 */
export function autoLayoutChildren(
  childNodes: any[],
  _containerWidth: number = 560
): any[] {
  const baseX = 20; // Left margin
  const baseY = 80; // Row position (below header)
  const spacingX = 350; // Horizontal spacing between pages

  return childNodes.map((node, index) => ({
    ...node,
    position: {
      x: calculateChildXPosition(index, baseX, spacingX),
      y: baseY,
    },
    data: {
      ...node.data,
      stepIndex: index,
      totalSteps: childNodes.length,
    },
  }));
}

// ============================================================================
// Component
// ============================================================================

/**
 * Form Process Child Wrapper
 * 
 * Wraps child nodes to provide consistent layout and visual indicators.
 * Used internally by FormProcessGroupNode for children rendering.
 * 
 * @param props - Node props with child-specific data
 */
export const FormProcessChildWrapper: React.FC<FormProcessChildWrapperProps> = (props) => {
  const { data, children } = props;
  
  const stepIndex = data.stepIndex ?? 0;
  const totalSteps = data.totalSteps ?? 1;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;
  
  return (
    <ChildContainer
      stepIndex={stepIndex}
      isFirst={isFirst}
      isLast={isLast}
      data-step-index={stepIndex}
      data-parent-id={data.parentId}
    >
      <StepBadge>Step {stepIndex + 1}</StepBadge>
      <ContentArea>{children}</ContentArea>
    </ChildContainer>
  );
};

/**
 * Higher-Order Component to wrap any node as a child within FormProcessGroup
 * 
 * @param WrappedComponent - The node component to wrap
 * @returns Wrapped component with child layout behavior
 */
export function withChildWrapper<P extends NodeProps<Node<any>>>(
  WrappedComponent: React.ComponentType<P>
): React.FC<P> {
  return (props: P) => {
    // Only apply wrapper if node has parentId (is inside a group)
    if (!props.data.parentId) {
      return <WrappedComponent {...props} />;
    }
    
    return (
      <FormProcessChildWrapper {...props}>
        <WrappedComponent {...props} />
      </FormProcessChildWrapper>
    );
  };
}

export default FormProcessChildWrapper;
