/**
 * Enhanced Connection Edge Component
 * Phase 7.2: Visual Connection Indicators
 * 
 * Advanced edge component with visual feedback:
 * - Animated flow indicators (moving particles)
 * - Connection validation states (valid/invalid/warning)
 * - Hover interactions with labels
 * - Theme-compliant colors
 * - Smooth transitions
 * 
 * Created: 2026-02-27
 */

import React, { memo, useMemo, useState } from 'react';
import {
  EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
  useReactFlow,
} from '@xyflow/react';
import styled, { keyframes } from 'styled-components';
import { CheckCircle, AlertCircle, XCircle, Info, Edit2, Trash2, Plus } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type ConnectionStatus = 'valid' | 'invalid' | 'warning' | 'info' | 'default';

export interface EnhancedEdgeData {
  /** Connection validation status */
  status?: ConnectionStatus;
  /** Label text */
  label?: string;
  /** Animated flow indicator */
  animated?: boolean;
  /** Show validation icon */
  showIcon?: boolean;
}

// ============================================================================
// Animations
// ============================================================================

const flowAnimation = keyframes`
  0% {
    stroke-dashoffset: 24;
  }
  100% {
    stroke-dashoffset: 0;
  }
`;

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
`;

// ============================================================================
// Styled Components
// ============================================================================

const EdgeLabel = styled.div<{ $status: ConnectionStatus }>`
  position: absolute;
  transform: translate(-50%, -50%);
  background: rgba(var(--color-background-primary), 0.95);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  color: ${(props) => {
    switch (props.$status) {
      case 'valid':
        return 'rgb(34, 197, 94)'; // Success green
      case 'invalid':
        return 'rgb(239, 68, 68)'; // Error red
      case 'warning':
        return 'rgb(234, 179, 8)'; // Warning yellow
      case 'info':
        return 'rgb(59, 130, 246)'; // Info blue
      default:
        return 'rgb(var(--color-text-secondary))';
    }
  }};
  border: 1px solid currentColor;
  display: flex;
  align-items: center;
  gap: 4px;
  pointer-events: all;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0;
  animation: ${pulse} 2s ease-in-out infinite;

  &:hover {
    opacity: 1;
    animation: none;
    transform: translate(-50%, -50%) scale(1.05);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  svg {
    width: 14px;
    height: 14px;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 0.8;
  }
`;

const EdgeToolbarWrapper = styled.div`
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 4px;
  background: rgb(var(--color-surface));
  padding: 4px;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border));
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: all;
  opacity: 0;
  transition: opacity 0.2s ease;
`;

const EdgeBtn = styled.button`
  padding: 4px;
  border-radius: 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));

  &:hover {
    background: rgba(var(--color-primary), 0.1);
    color: rgb(var(--color-primary));
  }
`;

const AnimatedPath = styled.path<{ $animated: boolean }>`
  stroke-dasharray: ${(props) => (props.$animated ? '8 4' : 'none')};
  animation: ${(props) => (props.$animated ? flowAnimation : 'none')} 1s linear
    infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const DataKeysTooltip = styled.div`
  position: absolute;
  transform: translate(-50%, -50%);
  background: rgba(var(--color-background-primary), 0.95);
  border: 1px solid rgb(var(--color-border));
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  color: rgb(var(--color-text-primary));
  max-width: 260px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
`;

const DataKeysTitle = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 4px;
`;

const DataKeysList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const DataKeyChip = styled.span`
  font-size: 11px;
  font-family: var(--font-family-mono);
  padding: 2px 6px;
  border-radius: 4px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  color: rgb(var(--color-text-secondary));
`;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get edge color based on connection status
 */
function getEdgeColor(status: ConnectionStatus): string {
  switch (status) {
    case 'valid':
      return 'rgb(34, 197, 94)'; // Success
    case 'invalid':
      return 'rgb(239, 68, 68)'; // Error
    case 'warning':
      return 'rgb(234, 179, 8)'; // Warning
    case 'info':
      return 'rgb(59, 130, 246)'; // Info
    default:
      return 'rgb(var(--color-border))';
  }
}

/**
 * Get validation icon based on status
 */
function getStatusIcon(status: ConnectionStatus): React.ReactNode {
  switch (status) {
    case 'valid':
      return <CheckCircle />;
    case 'invalid':
      return <XCircle />;
    case 'warning':
      return <AlertCircle />;
    case 'info':
      return <Info />;
    default:
      return null;
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * Enhanced edge component with visual feedback and validation.
 * Supports animated flow, status indicators, and hover labels.
 * 
 * @example
 * ```typescript
 * const edge: Edge = {
 *   id: 'e1-2',
 *   source: 'node-1',
 *   target: 'node-2',
 *   type: 'enhanced',
 *   data: {
 *     status: 'valid',
 *     label: 'On Success',
 *     animated: true,
 *     showIcon: true,
 *   },
 * };
 * ```
 */
export const EnhancedConnectionEdge: React.FC<EdgeProps<EnhancedEdgeData>> = memo(
  ({
    id,
    source,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    data = {},
    selected,
  }) => {
    const {
      status = 'default',
      label,
      animated = false,
      showIcon = true,
    } = data;

    // Calculate path
    const [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 16,
    });

    const edgeColor = getEdgeColor(status);
    const strokeWidth = selected ? 3 : status !== 'default' ? 2.5 : 2;

    const [isHovered, setIsHovered] = useState(false);

    const { getNode, setEdges } = useReactFlow();

    const handleInsertHere = (e: React.MouseEvent) => {
      e.stopPropagation();
      window.dispatchEvent(
        new CustomEvent('insert-node-between', {
          detail: { edgeId: id },
        })
      );
      window.dispatchEvent(
        new CustomEvent('pm:openNodePalette', {
          detail: { insertOnEdgeId: id },
        })
      );
    };

    const handleDeleteEdge = (e: React.MouseEvent) => {
      e.stopPropagation();
      setEdges((eds) => eds.filter((edge) => edge.id !== id));
    };

    const dataKeys = useMemo(() => {
      const sourceNode = source ? getNode(source) : undefined;
      const keys: string[] = [];

      const outputFields = sourceNode?.data?.outputSchema?.outputFields;
      if (Array.isArray(outputFields)) {
        for (const f of outputFields) {
          const key = f?.fieldName || f?.fieldId;
          if (typeof key === 'string' && key.trim()) keys.push(key);
        }
      }

      if (keys.length === 0) {
        const fields = sourceNode?.data?.fields || sourceNode?.data?.selectedFields;
        if (Array.isArray(fields)) {
          for (const f of fields) {
            const key = typeof f === 'string' ? f : (f?.name || f?.id || f?.key);
            if (typeof key === 'string' && key.trim()) keys.push(key);
          }
        }
      }

      // Unique + stable order
      return Array.from(new Set(keys));
    }, [getNode, source]);

    const visibleKeys = dataKeys.slice(0, 6);
    const remainingCount = Math.max(0, dataKeys.length - visibleKeys.length);

    return (
      <>
        {/* Invisible thick hitbox under the visible edge to stabilize hover/interaction */}
        <path
          d={edgePath}
          style={{ stroke: 'transparent', strokeWidth: 30, strokeOpacity: 0 }}
          pointerEvents="stroke"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />

        {/* Base Edge */}
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          style={{
            stroke: edgeColor,
            strokeWidth,
            transition: 'all 0.2s ease',
          }}
        />

        {/* Animated Flow Overlay */}
        {animated && (
          <AnimatedPath
            id={`${id}-animated`}
            d={edgePath}
            fill="none"
            stroke={edgeColor}
            strokeWidth={strokeWidth}
            strokeOpacity={0.6}
            $animated={animated}
          />
        )}

        <EdgeLabelRenderer>
          {/* Phase 11: Edge payload / data-key visualization */}
          {visibleKeys.length > 0 && (
            <DataKeysTooltip
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 22}px)`,
                opacity: isHovered ? 1 : 0,
              }}
            >
              <DataKeysTitle>Data Keys</DataKeysTitle>
              <DataKeysList>
                {visibleKeys.map((k) => (
                  <DataKeyChip key={k}>{k}</DataKeyChip>
                ))}
                {remainingCount > 0 && <DataKeyChip>+{remainingCount}</DataKeyChip>}
              </DataKeysList>
            </DataKeysTooltip>
          )}

          {/* Label with Icon */}
          {(label || showIcon) && (
            <EdgeLabel
              $status={status}
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                opacity: isHovered ? 1 : undefined,
                animation: isHovered ? 'none' : undefined,
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {showIcon && getStatusIcon(status)}
              {label && <span>{label}</span>}
            </EdgeLabel>
          )}

          {/* Hover Toolbar */}
          <EdgeToolbarWrapper
            style={{
              left: labelX,
              top: labelY,
              opacity: isHovered ? 1 : 0,
            }}
          >
            <EdgeBtn title="Add Node Here" onClick={handleInsertHere}>
              <Plus size={14} />
            </EdgeBtn>
            <EdgeBtn title="Edit Edge" onClick={(e) => e.stopPropagation()}>
              <Edit2 size={14} />
            </EdgeBtn>
            <EdgeBtn title="Delete Edge" onClick={handleDeleteEdge}>
              <Trash2 size={14} />
            </EdgeBtn>
          </EdgeToolbarWrapper>
        </EdgeLabelRenderer>
      </>
    );
  }
);

EnhancedConnectionEdge.displayName = 'EnhancedConnectionEdge';
