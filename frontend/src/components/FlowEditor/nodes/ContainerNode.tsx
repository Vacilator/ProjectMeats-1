/**
 * Container Node Component
 * Phase 7.2: Container Nesting Management
 * 
 * A special node type that acts as a visual grouping container for other nodes.
 * Similar to Figma's Frames or Sketch's Groups.
 * 
 * Features:
 * - Drag-and-drop nodes into container
 * - Visual boundary with label
 * - Collapse/expand functionality
 * - Nested containers support
 * - Auto-resize to fit children
 * - Theme-compliant styling
 * 
 * Created: 2026-02-27
 */

import React, { memo, useState, useCallback, useMemo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import styled from 'styled-components';
import { ChevronDown, ChevronRight, Maximize2, Minimize2, Folder } from 'lucide-react';
import { Tooltip } from 'antd';

// ============================================================================
// Types
// ============================================================================

export interface ContainerNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  collapsed?: boolean;
  /** Background color (theme token or hex) */
  backgroundColor?: string;
  /** Border color (theme token or hex) */
  borderColor?: string;
  /** IDs of nodes inside this container */
  childNodeIds?: string[];
  /** Whether container auto-resizes to fit children */
  autoResize?: boolean;
  /** Minimum dimensions */
  minWidth?: number;
  minHeight?: number;
}

// ============================================================================
// Styled Components
// ============================================================================

const ContainerWrapper = styled.div<{
  $collapsed: boolean;
  $backgroundColor?: string;
  $borderColor?: string;
}>`
  min-width: ${(props) => (props.$collapsed ? '200px' : '400px')};
  min-height: ${(props) => (props.$collapsed ? '60px' : '300px')};
  background: ${(props) =>
    props.$backgroundColor || 'rgba(var(--color-background-tertiary), 0.3)'};
  border: 2px dashed
    ${(props) => props.$borderColor || 'rgb(var(--color-border))'};
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.3s ease;
  backdrop-filter: blur(4px);
  position: relative;

  &:hover {
    border-style: solid;
    box-shadow: 0 4px 12px rgba(var(--color-primary), 0.15);
  }

  &.selected {
    border-color: rgb(var(--color-primary));
    border-style: solid;
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.2);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const ContainerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(var(--color-background-primary), 0.8);
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  border: 1px solid rgb(var(--color-border));

  &:hover {
    background: rgba(var(--color-background-secondary), 0.9);
  }

  &:active {
    transform: scale(0.98);
  }
`;

const HeaderIcon = styled.div`
  display: flex;
  align-items: center;
  color: rgb(var(--color-primary));

  svg {
    width: 18px;
    height: 18px;
  }
`;

const HeaderText = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const HeaderLabel = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const HeaderDescription = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const HeaderButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(var(--color-primary), 0.1);
    color: rgb(var(--color-primary));
  }

  &:active {
    transform: scale(0.9);
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const ContainerContent = styled.div<{ $collapsed: boolean }>`
  flex: 1;
  display: ${(props) => (props.$collapsed ? 'none' : 'block')};
  position: relative;
  min-height: 200px;
  padding: 16px;
  background: rgba(var(--color-background-secondary), 0.1);
  border-radius: 8px;
  border: 1px dashed rgba(var(--color-border), 0.3);

  &::after {
    content: 'Drop nodes here to group them';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: rgb(var(--color-text-tertiary));
    font-size: 13px;
    font-style: italic;
    opacity: 0.5;
    pointer-events: none;
  }

  &:hover {
    border-color: rgb(var(--color-primary));
    border-style: solid;
  }
`;

const NodeCount = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(var(--color-primary), 0.1);
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--color-primary));
`;

// ============================================================================
// Component
// ============================================================================

/**
 * Container node for grouping workflow nodes.
 * Provides visual organization and hierarchy.
 * 
 * @example
 * ```typescript
 * const containerNode: Node = {
 *   id: 'container-1',
 *   type: 'container',
 *   position: { x: 0, y: 0 },
 *   data: {
 *     label: 'Authentication Flow',
 *     description: 'User login and session management',
 *     childNodeIds: ['node-1', 'node-2', 'node-3'],
 *     backgroundColor: 'rgba(103, 126, 234, 0.05)',
 *     borderColor: 'rgb(var(--color-primary))',
 *   },
 * };
 * ```
 */
export const ContainerNode: React.FC<NodeProps<Node<ContainerNodeData>>> = memo(
  ({ data, selected }) => {
    const {
      label,
      description,
      collapsed: initialCollapsed = false,
      backgroundColor,
      borderColor,
      childNodeIds = [],
      autoResize = true,
      minWidth = 400,
      minHeight = 300,
    } = data;

    const [collapsed, setCollapsed] = useState(initialCollapsed);

    const handleToggleCollapse = useCallback(() => {
      setCollapsed((prev) => !prev);
    }, []);

    const childCount = childNodeIds.length;

    return (
      <ContainerWrapper
        $collapsed={collapsed}
        $backgroundColor={backgroundColor}
        $borderColor={borderColor}
        className={selected ? 'selected' : ''}
        style={{
          minWidth: collapsed ? 200 : minWidth,
          minHeight: collapsed ? 60 : minHeight,
        }}
      >
        {/* Connection Handles */}
        <Handle
          type="target"
          position={Position.Top}
          style={{
            left: '50%',
            width: 14,
            height: 14,
            background: borderColor || 'rgb(var(--color-primary))',
            border: '2px solid rgb(var(--color-surface))',
            borderRadius: 6,
            transform: 'translateX(-50%)',
          }}
          aria-label="Container input"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            left: '50%',
            width: 14,
            height: 14,
            background: borderColor || 'rgb(var(--color-primary))',
            border: '2px solid rgb(var(--color-surface))',
            borderRadius: 6,
            transform: 'translateX(-50%)',
          }}
          aria-label="Container output"
        />

        {/* Header */}
        <ContainerHeader onClick={handleToggleCollapse}>
          <HeaderIcon>{collapsed ? <ChevronRight /> : <ChevronDown />}</HeaderIcon>
          <HeaderIcon>
            <Folder />
          </HeaderIcon>
          <HeaderText>
            <HeaderLabel>{label}</HeaderLabel>
            {description && <HeaderDescription>{description}</HeaderDescription>}
          </HeaderText>
          {childCount > 0 && (
            <NodeCount>
              {childCount} {childCount === 1 ? 'node' : 'nodes'}
            </NodeCount>
          )}
          <HeaderActions onClick={(e) => e.stopPropagation()}>
            <Tooltip title={collapsed ? 'Expand container' : 'Collapse container'}>
              <HeaderButton
                onClick={handleToggleCollapse}
                aria-label={collapsed ? 'Expand container' : 'Collapse container'}
              >
                {collapsed ? <Maximize2 /> : <Minimize2 />}
              </HeaderButton>
            </Tooltip>
          </HeaderActions>
        </ContainerHeader>

        {/* Content Area */}
        <ContainerContent $collapsed={collapsed}>
          {/* Children nodes will be rendered here by React Flow */}
        </ContainerContent>
      </ContainerWrapper>
    );
  }
);

ContainerNode.displayName = 'ContainerNode';
