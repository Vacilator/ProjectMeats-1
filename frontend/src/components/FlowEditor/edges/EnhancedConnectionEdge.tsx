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

import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
  EdgeToolbar,
  useReactFlow,
} from '@xyflow/react';
import styled, { keyframes } from 'styled-components';
import { CheckCircle, AlertCircle, XCircle, Info, Pencil, Trash2, Plus } from 'lucide-react';

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

const EdgeToolbarCard = styled.div`
  display: flex;
  gap: 4px;
  background: rgb(var(--color-surface));
  padding: 4px;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border));
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: all;
  opacity: 0;
  transform: scale(0.9);
  transition: opacity 0.2s ease, transform 0.2s ease;
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

const EdgeEditCard = styled.div`
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgb(var(--color-surface));
  padding: 8px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  pointer-events: all;
  min-width: 220px;
`;

const EdgeEditInput = styled.input`
  width: 100%;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
  color: rgb(var(--color-text-primary));
  font-size: 12px;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.15);
  }
`;

const EdgeEditActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 6px;
`;

const EdgeEditActionBtn = styled.button<{ $primary?: boolean }>`
  border: 1px solid rgb(var(--color-border));
  background: ${(p) => (p.$primary ? 'rgb(var(--color-primary))' : 'rgb(var(--color-surface))')};
  color: ${(p) => (p.$primary ? 'white' : 'rgb(var(--color-text-secondary))')};
  font-size: 12px;
  font-weight: 700;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    border-color: rgb(var(--color-primary));
    color: ${(p) => (p.$primary ? 'white' : 'rgb(var(--color-primary))')};
    background: ${(p) => (p.$primary ? 'rgb(var(--color-primary))' : 'rgba(var(--color-primary), 0.08)')};
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
    const hoverOffTimeoutRef = useRef<number | null>(null);

    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [draftLabel, setDraftLabel] = useState<string>(label ?? '');

    const setHoverOn = useCallback(() => {
      if (hoverOffTimeoutRef.current) {
        window.clearTimeout(hoverOffTimeoutRef.current);
        hoverOffTimeoutRef.current = null;
      }
      setIsHovered(true);
    }, []);

    const scheduleHoverOff = useCallback(() => {
      if (hoverOffTimeoutRef.current) {
        window.clearTimeout(hoverOffTimeoutRef.current);
      }
      hoverOffTimeoutRef.current = window.setTimeout(() => {
        setIsHovered(false);
        hoverOffTimeoutRef.current = null;
      }, 120);
    }, []);

    const { getNode, setEdges } = useReactFlow();

    const handleEditEdge = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setHoverOn();
        setDraftLabel(label ?? '');
        setIsEditingLabel(true);
      },
      [label, setHoverOn]
    );

    const handleCancelEdit = useCallback(
      (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setIsEditingLabel(false);
        setDraftLabel(label ?? '');
      },
      [label]
    );

    const handleSaveEdit = useCallback(
      (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const next = draftLabel.trim();
        setEdges((eds) =>
          eds.map((edge) =>
            edge.id === id
              ? {
                  ...edge,
                  data: {
                    ...(edge.data as any),
                    label: next,
                  },
                }
              : edge
          )
        );
        setIsEditingLabel(false);
      },
      [draftLabel, id, setEdges]
    );

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
          onMouseEnter={setHoverOn}
          onMouseLeave={scheduleHoverOff}
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
              onMouseEnter={setHoverOn}
              onMouseLeave={scheduleHoverOff}
            >
              {showIcon && getStatusIcon(status)}
              {label && <span>{label}</span>}
            </EdgeLabel>
          )}

          {/* Edge Edit Popover */}
          {isEditingLabel && (
            <EdgeEditCard
              style={{
                left: labelX,
                top: labelY - 54,
              }}
              onMouseEnter={setHoverOn}
              onMouseLeave={scheduleHoverOff}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <EdgeEditInput
                value={draftLabel}
                placeholder="Edge label"
                onChange={(e) => setDraftLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                autoFocus
              />
              <EdgeEditActions>
                <EdgeEditActionBtn onClick={handleCancelEdit}>Cancel</EdgeEditActionBtn>
                <EdgeEditActionBtn $primary onClick={handleSaveEdit}>
                  Save
                </EdgeEditActionBtn>
              </EdgeEditActions>
            </EdgeEditCard>
          )}

          {/* Hover Toolbar */}
          <EdgeToolbar edgeId={id} x={labelX} y={labelY} isVisible>
            <EdgeToolbarCard
              style={{
                opacity: isHovered || selected ? 1 : 0,
                transform: `scale(${isHovered || selected ? 1 : 0.9})`,
                pointerEvents: isHovered || selected ? 'all' : 'none',
              }}
              onMouseEnter={setHoverOn}
              onMouseLeave={scheduleHoverOff}
            >
              <EdgeBtn title="Add Node Here" onClick={handleInsertHere}>
                <Plus size={14} />
              </EdgeBtn>
              <EdgeBtn title="Edit Edge" onClick={handleEditEdge}>
                <Pencil size={14} />
              </EdgeBtn>
              <EdgeBtn title="Delete Edge" onClick={handleDeleteEdge}>
                <Trash2 size={14} />
              </EdgeBtn>
            </EdgeToolbarCard>
          </EdgeToolbar>
        </EdgeLabelRenderer>
      </>
    );
  }
);

EnhancedConnectionEdge.displayName = 'EnhancedConnectionEdge';
