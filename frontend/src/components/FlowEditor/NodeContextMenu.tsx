/**
 * Node Context Menu Component
 * 
 * Right-click context menu for flow editor nodes.
 * Provides quick actions for containers and nodes.
 * 
 * Advanced Features:
 * - React Portal rendering to document.body
 * - Smart viewport flipping (never off-screen)
 * - Zoom-aware positioning
 * - Full opacity with dark theme
 * - 120ms entrance animation
 * 
 * Based on React Flow context menu example:
 * https://reactflow.dev/examples/interaction/context-menu
 * 
 * Created: 2026-02-19 - Phase E.3
 * Enhanced: 2026-02-21 - Advanced positioning
 * 
 * @module NodeContextMenu
 */

import React, { useCallback, useLayoutEffect, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  /** Callback to edit node configuration */
  onEdit?: (nodeId: string) => void;
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

const MenuContainer = styled.div<{ x: number; y: number; flipX: boolean; flipY: boolean }>`
  position: fixed;
  top: ${props => props.y}px;
  left: ${props => props.x}px;
  background: #1f2937 !important;
  border: 1px solid #374151;
  border-radius: 12px;
  box-shadow: 
    0 20px 25px -5px rgba(0, 0, 0, 0.3),
    0 10px 10px -5px rgba(0, 0, 0, 0.2);
  padding: 6px;
  min-width: 220px;
  z-index: 9999;
  opacity: 1 !important;
  backdrop-filter: blur(10px);
  animation: menuEntrance 0.12s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: ${props => 
    props.flipX && props.flipY ? 'bottom right' :
    props.flipX ? 'top right' :
    props.flipY ? 'bottom left' :
    'top left'
  };
  
  @keyframes menuEntrance {
    from {
      opacity: 0;
      transform: scale(0.92) translateY(-4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
`;

const MenuItem = styled.button<{ danger?: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: none;
  background: transparent;
  color: ${props => props.danger 
    ? 'rgb(239, 68, 68)' 
    : 'rgb(var(--color-text-primary))'};
  font-size: 14px;
  font-family: inherit;
  text-align: left;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.1s ease-out;
  
  &:hover {
    background: ${props => props.danger 
      ? 'rgba(239, 68, 68, 0.1)' 
      : 'rgb(var(--color-primary) / 0.1)'};
    color: ${props => props.danger ? 'rgb(239, 68, 68)' : 'rgb(var(--color-primary))'};
    transform: translateX(2px);
  }
  
  &:active {
    transform: scale(0.98) translateX(2px);
  }
  
  svg {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    opacity: 0.7;
    transition: opacity 0.1s ease-out;
  }
  
  &:hover svg {
    opacity: 1;
  }
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
 * Regular nodes get "Edit", "Copy", "Delete", etc.
 * 
 * Advanced positioning features:
 * - Smart viewport flipping (left/right, top/bottom)
 * - Zoom-aware positioning with transform compensation
 * - React Portal rendering to document.body
 * - 12px viewport padding for safety
 * 
 * @param props - Context menu properties
 */
export const NodeContextMenu: React.FC<ContextMenuProps> = ({ node, x, y, onClose, onEdit }) => {
  const { setNodes, getNode, getNodes, getViewport } = useReactFlow();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y, flipX: false, flipY: false });
  
  // Advanced positioning with viewport flipping and zoom compensation
  useLayoutEffect(() => {
    if (!menuRef.current) return;
    
    const menuRect = menuRef.current.getBoundingClientRect();
    const viewport = getViewport();
    const PADDING = 12; // Minimum distance from viewport edges
    
    let finalX = x;
    let finalY = y;
    let flipX = false;
    let flipY = false;
    
    // Apply subtle zoom compensation
    const zoomFactor = viewport.zoom;
    const zoomOffset = (1 - zoomFactor) * 8; // Subtle offset based on zoom
    
    // Check horizontal overflow and flip if needed
    if (x + menuRect.width + PADDING > window.innerWidth) {
      finalX = x - menuRect.width; // Flip to left
      flipX = true;
    }
    
    // Check vertical overflow and flip if needed
    if (y + menuRect.height + PADDING > window.innerHeight) {
      finalY = y - menuRect.height; // Flip to top
      flipY = true;
    }
    
    // Clamp to viewport with padding
    finalX = Math.max(PADDING, Math.min(finalX, window.innerWidth - menuRect.width - PADDING));
    finalY = Math.max(PADDING, Math.min(finalY, window.innerHeight - menuRect.height - PADDING));
    
    // Apply zoom offset
    finalX += zoomOffset;
    finalY += zoomOffset;
    
    setPosition({ x: finalX, y: finalY, flipX, flipY });
  }, [x, y, getViewport]);
  
  // Recalculate on window resize or zoom change
  useEffect(() => {
    const handleResize = () => {
      if (!menuRef.current) return;
      
      const menuRect = menuRef.current.getBoundingClientRect();
      const PADDING = 12;
      
      let finalX = position.x;
      let finalY = position.y;
      
      // Re-clamp on resize
      finalX = Math.max(PADDING, Math.min(finalX, window.innerWidth - menuRect.width - PADDING));
      finalY = Math.max(PADDING, Math.min(finalY, window.innerHeight - menuRect.height - PADDING));
      
      if (finalX !== position.x || finalY !== position.y) {
        setPosition({ x: finalX, y: finalY, flipX: position.flipX, flipY: position.flipY });
      }
    };
    
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, [position]);
  
  // Close on outside click (passive listener for performance)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside, { passive: true });
    document.addEventListener('keydown', handleEscape, { passive: true } as AddEventListenerOptions);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);
  
  // ============================================================================
  // Action Handlers
  // ============================================================================
  
  /**
   * Edit node configuration
   */
  const handleEdit = useCallback(() => {
    if (!node || !onEdit) return;
    
    onEdit(node.id);
    onClose();
  }, [node, onEdit, onClose]);
  
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
  
  // Render menu via React Portal to document.body
  return createPortal(
    <MenuContainer 
      ref={menuRef} 
      x={position.x} 
      y={position.y} 
      flipX={position.flipX}
      flipY={position.flipY}
      onClick={(e) => e.stopPropagation()} 
      role="menu" 
      aria-label="Node context menu"
    >
      <MenuHeader>
        {isContainer ? 'Container Actions' : isChildNode ? 'Step Actions' : 'Node Actions'}
      </MenuHeader>
      
      {/* Edit option for ALL nodes */}
      {onEdit && (
        <>
          <MenuItem onClick={handleEdit} role="menuitem">
            <Settings size={16} />
            <span>Edit Configuration</span>
          </MenuItem>
          <MenuSeparator />
        </>
      )}
      
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
    </MenuContainer>,
    document.body
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
