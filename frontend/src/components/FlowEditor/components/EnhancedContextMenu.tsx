/**
 * Enhanced Node Context Menu
 * 
 * Right-click context menu for nodes with advanced operations.
 * Positioned correctly even in zoomed/panned canvases.
 * 
 * Features:
 * - Dynamic menu items based on node type
 * - AI suggestions (placeholder)
 * - Convert to subflow
 * - Duplicate/Delete
 * - Copy/Paste
 * - Layout options
 * 
 * Created: 2026-02-21 - Phase 2: UI/UX Enhancements
 */

import React, { useCallback, useMemo } from 'react';
import styled from 'styled-components';
import {
  Copy,
  Trash2,
  Settings,
  Wand2,
  Box,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Node, useReactFlow } from '@xyflow/react';

interface EnhancedContextMenuProps {
  node: Node;
  x: number;
  y: number;
  onClose: () => void;
  onEdit?: (node: Node) => void;
  onDelete?: (node: Node) => void;
  onDuplicate?: (node: Node) => void;
  onConvertToSubflow?: (node: Node) => void;
  onAISuggest?: (node: Node) => void;
  onLayout?: () => void;
}

const MenuContainer = styled.div<{ x: number; y: number }>`
  position: fixed;
  left: ${props => props.x}px;
  top: ${props => props.y}px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  min-width: 200px;
  z-index: 10000;
  padding: 6px;
  animation: menuFadeIn 0.15s ease-out;

  @keyframes menuFadeIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-5px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
`;

const MenuItem = styled.button<{ $danger?: boolean; $disabled?: boolean }>`
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.15s ease;
  font-size: 14px;
  color: ${props =>
    props.$disabled
      ? 'rgb(var(--color-text-tertiary))'
      : props.$danger
      ? 'rgb(239, 68, 68)'
      : 'rgb(var(--color-text-primary))'};
  text-align: left;
  opacity: ${props => props.$disabled ? 0.5 : 1};

  &:hover:not(:disabled) {
    background: ${props =>
      props.$danger
        ? 'rgba(239, 68, 68, 0.1)'
        : 'rgb(var(--color-surface-hover))'};
  }

  svg {
    flex-shrink: 0;
  }
`;

const MenuDivider = styled.div`
  height: 1px;
  background: rgb(var(--color-border));
  margin: 6px 0;
`;

const MenuLabel = styled.span`
  flex: 1;
`;

const MenuShortcut = styled.span`
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  margin-left: auto;
  font-family: monospace;
`;

const SubMenuIndicator = styled(ArrowRight)`
  margin-left: auto;
  color: rgb(var(--color-text-tertiary));
`;

/**
 * Enhanced Context Menu Component
 */
export const EnhancedContextMenu: React.FC<EnhancedContextMenuProps> = React.memo(({
  node,
  x,
  y,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
  onConvertToSubflow,
  onAISuggest,
  onLayout,
}) => {
  const { setNodes, setEdges, getNodes } = useReactFlow();

  /**
   * Handle duplicate
   */
  const handleDuplicate = useCallback(() => {
    if (onDuplicate) {
      onDuplicate(node);
    } else {
      // Default duplicate logic
      const newNode: Node = {
        ...node,
        id: `${node.id}-copy-${Date.now()}`,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
        selected: true,
      };

      setNodes((nds) => [
        ...nds.map((n) => ({ ...n, selected: false })),
        newNode,
      ]);
    }
    onClose();
  }, [node, onDuplicate, setNodes, onClose]);

  /**
   * Handle delete
   */
  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(node);
    } else {
      // Default delete logic
      setNodes((nds) => nds.filter((n) => n.id !== node.id));
      setEdges((eds) =>
        eds.filter((e) => e.source !== node.id && e.target !== node.id)
      );
    }
    onClose();
  }, [node, onDelete, setNodes, setEdges, onClose]);

  /**
   * Handle edit
   */
  const handleEdit = useCallback(() => {
    onEdit?.(node);
    onClose();
  }, [node, onEdit, onClose]);

  /**
   * Handle convert to subflow
   */
  const handleConvertToSubflow = useCallback(() => {
    onConvertToSubflow?.(node);
    onClose();
  }, [node, onConvertToSubflow, onClose]);

  /**
   * Handle AI suggest
   */
  const handleAISuggest = useCallback(() => {
    onAISuggest?.(node);
    onClose();
  }, [node, onAISuggest, onClose]);

  /**
   * Check if node can be converted to subflow
   */
  const canConvertToSubflow = useMemo(() => {
    // Only certain node types can become subflows
    const convertibleTypes = ['formProcessGroup', 'formReference'];
    return convertibleTypes.includes(node.type || '');
  }, [node.type]);

  return (
    <MenuContainer x={x} y={y} onClick={(e) => e.stopPropagation()}>
      <MenuItem onClick={handleEdit}>
        <Settings size={16} />
        <MenuLabel>Configure</MenuLabel>
        <MenuShortcut>Enter</MenuShortcut>
      </MenuItem>

      <MenuItem onClick={handleDuplicate}>
        <Copy size={16} />
        <MenuLabel>Duplicate</MenuLabel>
        <MenuShortcut>Ctrl+D</MenuShortcut>
      </MenuItem>

      <MenuDivider />

      <MenuItem
        onClick={handleConvertToSubflow}
        $disabled={!canConvertToSubflow}
      >
        <Box size={16} />
        <MenuLabel>Convert to Subflow</MenuLabel>
      </MenuItem>

      <MenuItem onClick={handleAISuggest}>
        <Sparkles size={16} />
        <MenuLabel>AI Suggest Next</MenuLabel>
        <MenuShortcut>Coming Soon</MenuShortcut>
      </MenuItem>

      <MenuDivider />

      <MenuItem onClick={onLayout}>
        <AlignVerticalDistributeCenter size={16} />
        <MenuLabel>Auto-Layout</MenuLabel>
        <MenuShortcut>Ctrl+L</MenuShortcut>
      </MenuItem>

      <MenuDivider />

      <MenuItem onClick={handleDelete} $danger>
        <Trash2 size={16} />
        <MenuLabel>Delete</MenuLabel>
        <MenuShortcut>Del</MenuShortcut>
      </MenuItem>
    </MenuContainer>
  );
});

EnhancedContextMenu.displayName = 'EnhancedContextMenu';

/**
 * Hook for managing context menu state
 */
export const useEnhancedContextMenu = () => {
  const [menu, setMenu] = React.useState<{
    show: boolean;
    node: Node | null;
    x: number;
    y: number;
  }>({
    show: false,
    node: null,
    x: 0,
    y: 0,
  });

  const showContextMenu = useCallback((node: Node, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // Calculate position relative to viewport
    const x = event.clientX;
    const y = event.clientY;

    setMenu({
      show: true,
      node,
      x,
      y,
    });
  }, []);

  const hideContextMenu = useCallback(() => {
    setMenu({
      show: false,
      node: null,
      x: 0,
      y: 0,
    });
  }, []);

  // Close menu on click outside or escape
  React.useEffect(() => {
    if (!menu.show) return;

    const handleClickOutside = () => hideContextMenu();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideContextMenu();
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menu.show, hideContextMenu]);

  return {
    menu,
    showContextMenu,
    hideContextMenu,
  };
};
