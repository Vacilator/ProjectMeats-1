/**
 * Node Context Menu Component
 * 
 * Right-click context menu for flow editor nodes.
 * Provides quick actions for containers and nodes.
 * 
 * Based on React Flow context menu example:
 * https://reactflow.dev/examples/interaction/context-menu
 * 
 * Created: 2026-02-19 - Phase E.3
 * 
 * @module NodeContextMenu
 */

import React, { useCallback } from 'react';
import styled from 'styled-components';
import { Node, useReactFlow } from '@xyflow/react';
import { Plus, Copy, Layers, Trash2, Settings, Move, Wand2, Maximize2, Minimize2 } from 'lucide-react';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface ContextMenuProps {
  /** Node that was right-clicked */
  node: Node | null;
  /** X position of menu */
  x: number;
  /** Y position of menu */
  y: number;
  /** Callback to close menu */
  onClose: () => void;
}

export interface ContextMenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  separator?: boolean;
}

// ============================================================================
// Styled Components
// ============================================================================

const MenuContainer = styled.div<{ x: number; y: number }>`
  position: fixed;
  top: ${props => props.y}px;
  left: ${props => props.x}px;
  background: rgb(var(--color-background-primary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(0, 0, 0, 0.05);
  padding: 6px;
  min-width: 200px;
  z-index: 10000;
  animation: menuSlide 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  
  @keyframes menuSlide {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`;

const MenuItem = styled.button<{ danger?: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: ${props => props.danger 
    ? 'rgb(239, 68, 68)' 
    : 'rgb(var(--color-text-primary))'};
  font-size: 14px;
  text-align: left;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.1s ease;
  
  &:hover {
    background: ${props => props.danger 
      ? 'rgba(239, 68, 68, 0.1)' 
      : 'rgba(var(--color-primary), 0.08)'};
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  svg {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    opacity: 0.7;
  }
`;

const MenuSeparator = styled.div`
  height: 1px;
  background: rgb(var(--color-border));
  margin: 6px 0;
`;

const MenuHeader = styled.div`
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid rgb(var(--color-border));
  margin-bottom: 6px;
`;

// ============================================================================
// Component
// ============================================================================

/**
 * Node Context Menu
 * 
 * Displays context-sensitive actions based on node type.
 * Container nodes get "Add Step", "Duplicate Container", etc.
 * Regular nodes get "Copy", "Delete", etc.
 * 
 * @param props - Context menu properties
 */
export const NodeContextMenu: React.FC<ContextMenuProps> = ({ node, x, y, onClose }) => {
  const { setNodes, getNode, getNodes } = useReactFlow();
  
  // ============================================================================
  // Action Handlers
  // ============================================================================
  
  /**
   * Add a new step to container
   */
  const handleAddStep = useCallback(() => {
    if (!node) return;
    
    const childNodes = getNodes().filter(n => n.parentId === node.id);
    const newStepId = `step-${Date.now()}`;
    
    const newStep: Node = {
      id: newStepId,
      type: 'formStepSingle',
      position: { x: 20, y: 60 + childNodes.length * 120 },
      data: {
        label: `Step ${childNodes.length + 1}`,
        formFields: [],
      },
      parentId: node.id,
      extent: 'parent' as const,
      draggable: true,
    };
    
    setNodes((nodes) => [...nodes, newStep]);
    onClose();
  }, [node, getNodes, setNodes, onClose]);
  
  /**
   * Duplicate container with all children
   */
  const handleDuplicateContainer = useCallback(() => {
    if (!node) return;
    
    const childNodes = getNodes().filter(n => n.parentId === node.id);
    const containerId = `container-${Date.now()}`;
    
    // Duplicate container
    const duplicatedContainer: Node = {
      ...node,
      id: containerId,
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50,
      },
      data: {
        ...node.data,
        containerName: `${node.data.containerName || 'Container'} (Copy)`,
      },
      selected: false,
    };
    
    // Duplicate children
    const duplicatedChildren = childNodes.map((child, index) => ({
      ...child,
      id: `${containerId}-step-${index}`,
      parentId: containerId,
      selected: false,
    }));
    
    setNodes((nodes) => [...nodes, duplicatedContainer, ...duplicatedChildren]);
    onClose();
  }, [node, getNodes, setNodes, onClose]);
  
  /**
   * Convert container to sub-flow (placeholder)
   */
  const handleConvertToSubFlow = useCallback(() => {
    if (!node) return;
    
    // TODO: Implement sub-flow conversion logic
    console.log('Convert to sub-flow:', node.id);
    onClose();
  }, [node, onClose]);
  
  /**
   * Delete node (and children if container)
   */
  const handleDelete = useCallback(() => {
    if (!node) return;
    
    const isContainer = node.type === 'formProcessGroup' || 
                       node.type === 'formProcess' || 
                       node.type === 'formMultiStepContainer';
    
    if (isContainer) {
      // Delete container and all children
      const childNodes = getNodes().filter(n => n.parentId === node.id);
      const idsToDelete = [node.id, ...childNodes.map(n => n.id)];
      
      setNodes((nodes) => nodes.filter(n => !idsToDelete.includes(n.id)));
    } else {
      // Delete single node
      setNodes((nodes) => nodes.filter(n => n.id !== node.id));
    }
    
    onClose();
  }, [node, getNodes, setNodes, onClose]);
  
  /**
   * Copy node
   */
  const handleCopy = useCallback(() => {
    if (!node) return;
    
    const copiedNode: Node = {
      ...node,
      id: `node-${Date.now()}`,
      position: {
        x: node.position.x + 20,
        y: node.position.y + 20,
      },
      data: {
        ...node.data,
        label: `${node.data.label || 'Node'} (Copy)`,
      },
      selected: false,
    };
    
    setNodes((nodes) => [...nodes, copiedNode]);
    onClose();
  }, [node, setNodes, onClose]);
  
  /**
   * Extract from container
   */
  const handleExtract = useCallback(() => {
    if (!node || !node.parentId) return;
    
    const parentNode = getNode(node.parentId);
    if (!parentNode) return;
    
    // Calculate absolute position
    const absolutePosition = {
      x: parentNode.position.x + node.position.x,
      y: parentNode.position.y + node.position.y + 100, // Place below container
    };
    
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id === node.id) {
          const updated = { ...n };
          updated.position = absolutePosition;
          delete updated.parentId;
          delete updated.extent;
          return updated;
        }
        return n;
      })
    );
    
    onClose();
  }, [node, getNode, setNodes, onClose]);
  
  /**
   * Edit in FormBuilder (Phase 3)
   */
  const handleEditInBuilder = useCallback(() => {
    if (!node) return;
    
    // TODO: Open FormBuilder modal for this container
    console.log('Edit in FormBuilder:', node.id);
    // This will be wired in Phase 4
    
    onClose();
  }, [node, onClose]);
  
  /**
   * Expand/Collapse All children (Phase 3)
   */
  const handleExpandCollapseAll = useCallback(() => {
    if (!node) return;
    
    const childNodes = getNodes().filter(n => n.parentId === node.id);
    const allExpanded = childNodes.every(n => n.data.isExpanded);
    
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.parentId === node.id) {
          return {
            ...n,
            data: {
              ...n.data,
              isExpanded: !allExpanded, // Toggle: if all expanded, collapse all, else expand all
            },
          };
        }
        return n;
      })
    );
    
    onClose();
  }, [node, getNodes, setNodes, onClose]);
  
  // ============================================================================
  // Render
  // ============================================================================
  
  if (!node) return null;
  
  const isContainer = node.type === 'formProcessGroup' || 
                     node.type === 'formProcess' || 
                     node.type === 'formMultiStepContainer';
  
  const isChildNode = !!node.parentId;
  
  return (
    <MenuContainer x={x} y={y} onClick={(e) => e.stopPropagation()}>
      <MenuHeader>
        {isContainer ? 'Container Actions' : isChildNode ? 'Step Actions' : 'Node Actions'}
      </MenuHeader>
      
      {isContainer && (
        <>
          <MenuItem onClick={handleEditInBuilder}>
            <Wand2 size={16} />
            <span>Edit in FormBuilder</span>
          </MenuItem>
          <MenuItem onClick={handleAddStep}>
            <Plus size={16} />
            <span>Add Step</span>
          </MenuItem>
          <MenuItem onClick={handleExpandCollapseAll}>
            <Maximize2 size={16} />
            <span>Expand/Collapse All</span>
          </MenuItem>
          <MenuSeparator />
          <MenuItem onClick={handleDuplicateContainer}>
            <Copy size={16} />
            <span>Duplicate Container</span>
          </MenuItem>
          <MenuItem onClick={handleConvertToSubFlow}>
            <Layers size={16} />
            <span>Convert to Sub-Flow</span>
          </MenuItem>
          <MenuSeparator />
        </>
      )}
      
      {isChildNode && (
        <>
          <MenuItem onClick={handleExtract}>
            <Move size={16} />
            <span>Extract from Container</span>
          </MenuItem>
          <MenuSeparator />
        </>
      )}
      
      {!isContainer && (
        <>
          <MenuItem onClick={handleCopy}>
            <Copy size={16} />
            <span>Copy Node</span>
          </MenuItem>
          <MenuSeparator />
        </>
      )}
      
      <MenuItem onClick={handleDelete} danger>
        <Trash2 size={16} />
        <span>Delete {isContainer ? 'Container' : 'Node'}</span>
      </MenuItem>
    </MenuContainer>
  );
};

/**
 * Hook to manage context menu state
 * 
 * @returns Context menu state and handlers
 */
export function useContextMenu() {
  const [menu, setMenu] = React.useState<{
    node: Node | null;
    x: number;
    y: number;
  } | null>(null);
  
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setMenu({
      node,
      x: event.clientX,
      y: event.clientY,
    });
  }, []);
  
  const handleCloseMenu = useCallback(() => {
    setMenu(null);
  }, []);
  
  return {
    menu,
    handleNodeContextMenu,
    handleCloseMenu,
  };
}

export default NodeContextMenu;
