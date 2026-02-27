/**
 * Batch Operations Toolbar Component
 * Phase 7.2: Batch Operations
 * 
 * Floating toolbar that appears when multiple nodes are selected.
 * Provides quick access to batch operations:
 * - Copy/Cut/Paste/Delete
 * - Align (left/center/right, top/middle/bottom)
 * - Distribute (horizontally/vertically)
 * - Group operations
 * 
 * Created: 2026-02-27
 */

import React, { useMemo } from 'react';
import styled from 'styled-components';
import { Tooltip } from 'antd';
import {
  Copy,
  Scissors,
  Clipboard,
  Trash2,
  AlignLeft,
  AlignCenterHorizontal,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Group,
} from 'lucide-react';

// ============================================================================
// Styled Components
// ============================================================================

const ToolbarContainer = styled.div<{ $visible: boolean; $position: { x: number; y: number } }>`
  position: absolute;
  top: ${(props) => props.$position.y}px;
  left: ${(props) => props.$position.x}px;
  transform: translate(-50%, -120%);
  background: rgba(var(--color-background-primary), 0.95);
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  padding: 8px;
  display: ${(props) => (props.$visible ? 'flex' : 'none')};
  gap: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  backdrop-filter: blur(10px);
  animation: slideInDown 0.2s ease-out;

  @keyframes slideInDown {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-120% - 10px));
    }
    to {
      opacity: 1;
      transform: translate(-50%, -120%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const ToolbarSection = styled.div`
  display: flex;
  gap: 4px;
  padding: 0 4px;

  &:not(:last-child) {
    border-right: 1px solid rgb(var(--color-border));
  }
`;

const ToolbarButton = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: ${(props) =>
    props.$active ? 'rgb(var(--color-primary))' : 'transparent'};
  border: none;
  border-radius: 4px;
  color: ${(props) =>
    props.$active
      ? 'rgb(var(--color-text-inverse))'
      : 'rgb(var(--color-text-secondary))'};
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: ${(props) =>
      props.$active
        ? 'rgb(var(--color-primary-hover))'
        : 'rgba(var(--color-primary), 0.1)'};
    color: ${(props) =>
      props.$active
        ? 'rgb(var(--color-text-inverse))'
        : 'rgb(var(--color-primary))'};
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const NodeCount = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  white-space: nowrap;
`;

// ============================================================================
// Component Props
// ============================================================================

export interface BatchOperationsToolbarProps {
  /** Whether the toolbar is visible */
  visible: boolean;
  /** Number of selected nodes */
  selectedCount: number;
  /** Position of the toolbar (center of selection bounding box) */
  position: { x: number; y: number };
  /** Number of items in clipboard */
  clipboardCount: number;
  /** Callback handlers */
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onAlignTop: () => void;
  onAlignMiddle: () => void;
  onAlignBottom: () => void;
  onDistributeHorizontally: () => void;
  onDistributeVertically: () => void;
  onGroup?: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Floating toolbar for batch node operations.
 * Appears when multiple nodes are selected.
 * 
 * @example
 * ```tsx
 * <BatchOperationsToolbar
 *   visible={selectedNodes.length > 0}
 *   selectedCount={selectedNodes.length}
 *   position={selectionCenter}
 *   clipboardCount={clipboardCount}
 *   onCopy={copySelection}
 *   onDelete={deleteSelection}
 *   // ... other handlers
 * />
 * ```
 */
export const BatchOperationsToolbar: React.FC<BatchOperationsToolbarProps> = ({
  visible,
  selectedCount,
  position,
  clipboardCount,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onAlignTop,
  onAlignMiddle,
  onAlignBottom,
  onDistributeHorizontally,
  onDistributeVertically,
  onGroup,
}) => {
  const showAlignmentTools = selectedCount >= 2;
  const showDistributeTools = selectedCount >= 3;

  // Calculate keyboard shortcut labels based on platform
  const modKey = useMemo(() => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    return isMac ? '⌘' : 'Ctrl';
  }, []);

  return (
    <ToolbarContainer $visible={visible} $position={position}>
      {/* Node Count */}
      <NodeCount>{selectedCount} selected</NodeCount>

      {/* Clipboard Operations */}
      <ToolbarSection>
        <Tooltip title={`Copy (${modKey}+C)`} placement="top">
          <ToolbarButton
            onClick={onCopy}
            disabled={selectedCount === 0}
            aria-label="Copy selected nodes"
          >
            <Copy />
          </ToolbarButton>
        </Tooltip>

        <Tooltip title={`Cut (${modKey}+X)`} placement="top">
          <ToolbarButton
            onClick={onCut}
            disabled={selectedCount === 0}
            aria-label="Cut selected nodes"
          >
            <Scissors />
          </ToolbarButton>
        </Tooltip>

        <Tooltip
          title={`Paste (${modKey}+V)${
            clipboardCount > 0 ? ` - ${clipboardCount} items` : ''
          }`}
          placement="top"
        >
          <ToolbarButton
            onClick={onPaste}
            disabled={clipboardCount === 0}
            aria-label="Paste nodes from clipboard"
          >
            <Clipboard />
          </ToolbarButton>
        </Tooltip>

        <Tooltip title="Delete (Del)" placement="top">
          <ToolbarButton
            onClick={onDelete}
            disabled={selectedCount === 0}
            aria-label="Delete selected nodes"
          >
            <Trash2 />
          </ToolbarButton>
        </Tooltip>
      </ToolbarSection>

      {/* Horizontal Alignment */}
      {showAlignmentTools && (
        <ToolbarSection>
          <Tooltip title="Align Left" placement="top">
            <ToolbarButton
              onClick={onAlignLeft}
              aria-label="Align nodes to the left"
            >
              <AlignLeft />
            </ToolbarButton>
          </Tooltip>

          <Tooltip title="Align Center" placement="top">
            <ToolbarButton
              onClick={onAlignCenter}
              aria-label="Align nodes horizontally to center"
            >
              <AlignCenterHorizontal />
            </ToolbarButton>
          </Tooltip>

          <Tooltip title="Align Right" placement="top">
            <ToolbarButton
              onClick={onAlignRight}
              aria-label="Align nodes to the right"
            >
              <AlignRight />
            </ToolbarButton>
          </Tooltip>
        </ToolbarSection>
      )}

      {/* Vertical Alignment */}
      {showAlignmentTools && (
        <ToolbarSection>
          <Tooltip title="Align Top" placement="top">
            <ToolbarButton
              onClick={onAlignTop}
              aria-label="Align nodes to the top"
            >
              <AlignStartVertical />
            </ToolbarButton>
          </Tooltip>

          <Tooltip title="Align Middle" placement="top">
            <ToolbarButton
              onClick={onAlignMiddle}
              aria-label="Align nodes vertically to middle"
            >
              <AlignCenterVertical />
            </ToolbarButton>
          </Tooltip>

          <Tooltip title="Align Bottom" placement="top">
            <ToolbarButton
              onClick={onAlignBottom}
              aria-label="Align nodes to the bottom"
            >
              <AlignEndVertical />
            </ToolbarButton>
          </Tooltip>
        </ToolbarSection>
      )}

      {/* Distribution */}
      {showDistributeTools && (
        <ToolbarSection>
          <Tooltip title="Distribute Horizontally" placement="top">
            <ToolbarButton
              onClick={onDistributeHorizontally}
              aria-label="Distribute nodes evenly horizontally"
            >
              <AlignHorizontalDistributeCenter />
            </ToolbarButton>
          </Tooltip>

          <Tooltip title="Distribute Vertically" placement="top">
            <ToolbarButton
              onClick={onDistributeVertically}
              aria-label="Distribute nodes evenly vertically"
            >
              <AlignVerticalDistributeCenter />
            </ToolbarButton>
          </Tooltip>
        </ToolbarSection>
      )}

      {/* Group Operations (Future: Phase 7.2 Container Nesting) */}
      {onGroup && showAlignmentTools && (
        <ToolbarSection>
          <Tooltip title="Group Nodes" placement="top">
            <ToolbarButton
              onClick={onGroup}
              aria-label="Group selected nodes into container"
            >
              <Group />
            </ToolbarButton>
          </Tooltip>
        </ToolbarSection>
      )}
    </ToolbarContainer>
  );
};
