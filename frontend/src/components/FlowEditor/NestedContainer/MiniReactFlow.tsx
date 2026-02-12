/**
 * Mini React Flow Component
 * 
 * Phase 2.2: Migrated to React Flow Native System
 * - Receives filtered nodes/edges from parent (no shadow graph)
 * - Read-only preview of container contents
 * - Eliminates sync issues between shadow and main state
 * 
 * Created: 2026-02-07
 * Updated: 2026-02-08 - Phase 2: Removed shadow graph, simplified to read-only
 * Updated: 2026-02-10 - Fixed "Parent node not found" error by sanitizing nodes
 */
import React, { useMemo } from 'react';
import styled from 'styled-components';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Node,
  Edge,
  BackgroundVariant,
  NodeTypes,
  EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Import nodes individually to avoid circular dependency
// (FormMultiStepContainerNode imports MiniReactFlow, so we can't import from index)
import { FormStepNode } from '../nodes/FormStepNode';
import { FormReferenceNode } from '../nodes/FormReferenceNode';
import { TriggerNode } from '../nodes/TriggerNode';
import { ConditionIfNode } from '../nodes/ConditionIfNode';
import { ActionNode } from '../nodes/ActionNode';
import { WaitStateNode } from '../nodes/WaitStateNode';
import { DocumentNode } from '../nodes/DocumentNode';
import { UtilityNode } from '../nodes/UtilityNode';
import { TerminalNode } from '../nodes/TerminalNode';
import { CustomEdge } from '../edges/CustomEdge';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface MiniReactFlowProps {
  containerId?: string; // ID of parent container for unique keys
  nodes: Node[]; // Phase 2.2: Filtered by parentId in UnifiedFlowEditor (React Flow v11+)
  edges: Edge[]; // Phase 2.2: Filtered to edges between child nodes
  containerHeight?: number; // Height of mini canvas
  interactive?: boolean; // Phase 4.5: Allow interactive mode when expanded
  onNodeClick?: (event: React.MouseEvent, node: Node) => void; // Optional click handler for nodes
  onNodesChange?: (changes: any) => void; // Optional handler for node position changes
  onDrop?: (event: React.DragEvent) => void; // Drop handler for palette nodes
  onDragOver?: (event: React.DragEvent) => void; // Drag over handler for drop feedback
  // Phase 2.2: Removed readOnly prop (always read-only now)
}

// ============================================================================
// Styled Components
// ============================================================================

const MiniFlowContainer = styled.div<{ $height: number; $interactive?: boolean }>`
  width: 100%;
  height: ${props => props.$height}px;
  background: rgba(var(--color-background), 0.5);
  border: 1px solid rgba(var(--color-border), 0.5);
  border-radius: 8px;
  overflow: hidden;
  pointer-events: auto; /* Always allow pointer events */
  position: relative;
  z-index: 1; /* Below interactive buttons */
  
  /* When NOT interactive, disable pointer events on the React Flow canvas itself */
  ${props => !props.$interactive && `
    .react-flow {
      pointer-events: none;
    }
  `}
  
  .react-flow__node {
    cursor: ${props => props.$interactive ? 'grab' : 'default'} !important;
    pointer-events: ${props => props.$interactive ? 'auto' : 'none'};
  }
  
  .react-flow__node:active {
    cursor: ${props => props.$interactive ? 'grabbing' : 'default'} !important;
  }
  
  .react-flow__edges {
    pointer-events: ${props => props.$interactive ? 'auto' : 'none'};
  }
  
  .react-flow__controls {
    pointer-events: ${props => props.$interactive ? 'auto' : 'none'};
  }
`;

// ============================================================================
// Node Types Configuration
// ============================================================================

const nodeTypes: NodeTypes = {
  formStep: FormStepNode,
  formReference: FormReferenceNode,
  trigger: TriggerNode,
  conditionIf: ConditionIfNode,
  action: ActionNode,
  waitState: WaitStateNode,
  document: DocumentNode,
  utility: UtilityNode,
  terminal: TerminalNode,
  // Note: Intentionally excluding formMultiStepContainer to prevent infinite nesting
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

// ============================================================================
// Component
// ============================================================================

export const MiniReactFlow: React.FC<MiniReactFlowProps> = ({
  containerId = 'unknown',
  nodes,
  edges,
  containerHeight = 300,
  interactive = false,
  onNodeClick,
  onNodesChange,
  onDrop,
  onDragOver,
}) => {
  // Phase 2.2: Simplified - no callbacks, read-only preview
  // Phase 4.5: Added interactive mode for expanded containers
  // Phase 4.6: Added click and change handlers for editing support
  
  // CRITICAL: Sanitize nodes to remove ALL parent references
  // This prevents "Parent node not found" errors when rendering child nodes
  // in isolation (container is not included in this mini canvas)
  const sanitizedNodes = useMemo(() => {
    console.log('[MiniReactFlow] Input nodes:', nodes.map(n => ({ 
      id: n.id, 
      parentId: n.parentId,
      type: n.type 
    })));
    
    const sanitized = nodes.map(node => {
      // Create a COMPLETELY NEW object with only safe properties
      // DO NOT include parentId, extent, expandParent at all
      const cleanNode: Node = {
        id: node.id,
        type: node.type,
        position: { x: node.position.x, y: node.position.y }, // Deep copy position
        data: { ...node.data }, // Shallow copy data
        // Copy other safe properties
        style: node.style,
        className: node.className,
        draggable: interactive, // Allow dragging if interactive
        selectable: interactive, // Allow selection if interactive
        connectable: interactive, // Allow connections if interactive
        hidden: false, // CRITICAL: Always show nodes in MiniReactFlow (even if hidden on main canvas)
        // CRITICAL: Explicitly NOT including:
        // - parentId (would cause lookup)
        // - parentNode (legacy, would cause lookup)
        // - extent (parent-child constraint)
        // - expandParent (parent-child behavior)
      };
      
      return cleanNode;
    });
    
    console.log('[MiniReactFlow] Sanitized nodes:', sanitized.map(n => ({ 
      id: n.id, 
      parentId: (n as any).parentId,
      hasParentId: 'parentId' in n,
      hasParentNode: 'parentNode' in n,
      type: n.type 
    })));
    
    return sanitized;
  }, [nodes, interactive]);
  
  return (
    <ReactFlowProvider>
      <MiniFlowContainer 
        $height={containerHeight} 
        $interactive={interactive}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <ReactFlow
          id={`mini-flow-${containerId}`} // Unique ID per container to prevent conflicts
          key={`mini-flow-${containerId}-${nodes.length}`} // Force remount on node count change
          nodes={sanitizedNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={interactive ? onNodeClick : undefined} // Only handle clicks in interactive mode
          onNodesChange={interactive ? onNodesChange : undefined} // Only handle changes in interactive mode
          // NOTE: onDrop/onDragOver moved to MiniFlowContainer div (HTML5 drag-drop)
          // ReactFlow's drag-drop doesn't work across different ReactFlow instances
          fitView
          fitViewOptions={{
            padding: 0.2,
            minZoom: 0.5,
            maxZoom: 1.5,
          }}
          nodesDraggable={interactive} // Allow dragging if interactive
          nodesConnectable={interactive} // Allow connections if interactive
          elementsSelectable={interactive} // Allow selection if interactive
          zoomOnScroll={interactive} // Allow zoom if interactive
          panOnDrag={interactive} // Allow panning if interactive
          proOptions={{ hideAttribution: true }}
          minZoom={0.3}
          maxZoom={2}
        >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={20} 
          size={1} 
          color="rgba(var(--color-border), 0.3)"
        />
        {/* Only show controls when interactive */}
        {interactive && (
          <Controls 
            showZoom
            showFitView
            showInteractive={false}
            style={{
              button: {
                background: 'rgba(var(--color-surface), 0.9)',
                border: '1px solid rgba(var(--color-border), 0.5)',
                color: 'rgb(var(--color-text-primary))',
              },
            }}
          />
        )}
        {/* Removed MiniMap - user requested removal */}
        </ReactFlow>
      </MiniFlowContainer>
    </ReactFlowProvider>
  );
};

export default MiniReactFlow;
