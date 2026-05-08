/**
 * Snap Preview Overlay Component
 *
 * Displays visual indicators for magnetic snapping during drag operations.
 * Shows where a node will land before you drop it.
 *
 * Phase 7.2: Enhanced Container Management (Part 3/3)
 */

import React from 'react';
import styled, { keyframes } from 'styled-components';
import { XYPosition } from '@xyflow/react';

// ============================================================================
// Animations
// ============================================================================

const pulse = keyframes`
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
`;

// ============================================================================
// Styled Components
// ============================================================================

const OverlayContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
`;

const SnapPreviewBox = styled.div<{
  left: number;
  top: number;
  width: number;
  height: number;
}>`
  position: absolute;
  left: ${props => props.left}px;
  top: ${props => props.top}px;
  width: ${props => props.width}px;
  height: ${props => props.height}px;

  border: 2px dashed rgb(var(--color-primary));
  border-radius: var(--radius-md);
  background: rgba(var(--color-primary), 0.1);

  animation: ${pulse} 1.5s ease-in-out infinite;

  box-shadow:
    0 0 0 4px rgba(var(--color-primary), 0.1),
    inset 0 0 20px rgba(var(--color-primary), 0.2);

  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
`;

const SnapLabel = styled.div<{ left: number; top: number }>`
  position: absolute;
  left: ${props => props.left}px;
  top: ${props => props.top - 30}px;

  padding: 4px 12px;
  background: rgba(var(--color-primary), 0.95);
  color: rgb(var(--color-text-inverse));
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-radius: var(--radius-sm);
  white-space: nowrap;

  box-shadow: 0 2px 8px rgba(var(--color-primary), 0.4);
  animation: ${fadeIn} 0.2s ease-out;

  &::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 4px solid rgba(var(--color-primary), 0.95);
  }
`;

const SnapLine = styled.div<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  orientation: 'horizontal' | 'vertical';
}>`
  position: absolute;
  background: rgba(var(--color-primary), 0.4);

  ${props => props.orientation === 'horizontal' ? `
    left: ${Math.min(props.x1, props.x2)}px;
    top: ${props.y1}px;
    width: ${Math.abs(props.x2 - props.x1)}px;
    height: 2px;
  ` : `
    left: ${props.x1}px;
    top: ${Math.min(props.y1, props.y2)}px;
    width: 2px;
    height: ${Math.abs(props.y2 - props.y1)}px;
  `}

  animation: ${fadeIn} 0.2s ease-out;
`;

const SnapPoint = styled.div<{ left: number; top: number }>`
  position: absolute;
  left: ${props => props.left - 4}px;
  top: ${props => props.top - 4}px;
  width: 8px;
  height: 8px;

  background: rgb(var(--color-primary));
  border: 2px solid white;
  border-radius: 50%;

  box-shadow:
    0 0 0 2px rgba(var(--color-primary), 0.3),
    0 2px 4px rgba(var(--color-overlay), 0.2);

  animation: ${pulse} 1s ease-in-out infinite;
`;

// ============================================================================
// Component
// ============================================================================

export interface SnapPreviewOverlayProps {
  /** Position where node will snap to (null if not snapping) */
  snapPosition: XYPosition | null;
  /** Size of the node being dragged */
  nodeSize: { width: number; height: number };
  /** Optional label text (e.g., "Drop Here", "Snap to Grid") */
  label?: string;
  /** Optional snap lines to display */
  snapLines?: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    orientation: 'horizontal' | 'vertical';
  }>;
  /** Optional snap points to highlight */
  snapPoints?: Array<XYPosition>;
}

/**
 * Displays visual preview of where a node will snap when dropped
 *
 * Features:
 * - Dashed outline box showing final position
 * - Optional label above the preview
 * - Snap lines showing alignment
 * - Snap points for magnetic targets
 * - Smooth animations
 *
 * Usage:
 * ```tsx
 * <SnapPreviewOverlay
 *   snapPosition={{ x: 250, y: 300 }}
 *   nodeSize={{ width: 200, height: 100 }}
 *   label="Drop into container"
 *   snapLines={[
 *     { x1: 250, y1: 0, x2: 250, y2: 600, orientation: 'vertical' }
 *   ]}
 * />
 * ```
 */
export const SnapPreviewOverlay: React.FC<SnapPreviewOverlayProps> = ({
  snapPosition,
  nodeSize,
  label = 'Snap Here',
  snapLines = [],
  snapPoints = [],
}) => {
  if (!snapPosition) return null;

  return (
    <OverlayContainer>
      {/* Snap lines (alignment guides) */}
      {snapLines.map((line, index) => (
        <SnapLine
          key={`line-${index}`}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          orientation={line.orientation}
        />
      ))}

      {/* Snap points (magnetic targets) */}
      {snapPoints.map((point, index) => (
        <SnapPoint
          key={`point-${index}`}
          left={point.x}
          top={point.y}
        />
      ))}

      {/* Preview box (where node will land) */}
      <SnapPreviewBox
        left={snapPosition.x}
        top={snapPosition.y}
        width={nodeSize.width}
        height={nodeSize.height}
      />

      {/* Label */}
      {label && (
        <SnapLabel
          left={snapPosition.x + nodeSize.width / 2}
          top={snapPosition.y}
        >
          {label}
        </SnapLabel>
      )}
    </OverlayContainer>
  );
};

/**
 * Hook for calculating snap preview data from drag state
 *
 * @param dragState - Current drag state from useContainerDragAndDrop
 * @param containerPosition - Position of target container
 * @param containerSize - Size of target container
 * @returns Props ready for SnapPreviewOverlay component
 */
export function useSnapPreviewData(
  dragState: {
    draggingNodeId: string | null;
    dropTargetId: string | null;
    snapPreview: XYPosition | null;
  },
  containerPosition?: XYPosition,
  containerSize?: { width: number; height: number }
): Omit<SnapPreviewOverlayProps, 'nodeSize'> {
  if (!dragState.snapPreview || !containerPosition || !containerSize) {
    return {
      snapPosition: null,
    };
  }

  // Calculate vertical centerline
  const centerX = containerPosition.x + containerSize.width / 2;

  return {
    snapPosition: dragState.snapPreview,
    label: dragState.dropTargetId ? 'Drop into Container' : 'Snap Here',
    snapLines: [
      // Vertical centerline of container
      {
        x1: centerX,
        y1: containerPosition.y + 48, // Below header
        x2: centerX,
        y2: containerPosition.y + containerSize.height - 32, // Above bottom padding
        orientation: 'vertical' as const,
      },
    ],
    snapPoints: [
      // Snap target point
      {
        x: centerX,
        y: dragState.snapPreview.y + 50, // Center of node (estimated)
      },
    ],
  };
}

export default SnapPreviewOverlay;
