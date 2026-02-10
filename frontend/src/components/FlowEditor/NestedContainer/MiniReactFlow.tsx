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
  MiniMap,
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
  nodes: Node[]; // Phase 2.2: Filtered by parentId in UnifiedFlowEditor (React Flow v11+)
  edges: Edge[]; // Phase 2.2: Filtered to edges between child nodes
  containerHeight?: number; // Height of mini canvas
  // Phase 2.2: Removed onNodesChange, onEdgesChange, onConnect (read-only)
  // Phase 2.2: Removed readOnly prop (always read-only now)
}

// ============================================================================
// Styled Components
// ============================================================================

const MiniFlowContainer = styled.div<{ $height: number }>`
  width: 100%;
  height: ${props => props.$height}px;
  background: rgba(var(--color-background), 0.5);
  border: 1px solid rgba(var(--color-border), 0.5);
  border-radius: 8px;
  overflow: hidden;
  pointer-events: none; /* Prevent click interception - MiniReactFlow is purely visual */
  
  .react-flow__node {
    cursor: pointer !important;
  }
  
  .react-flow__edges {
    pointer-events: none; /* Always read-only (Phase 2.2) */
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
  nodes,
  edges,
  containerHeight = 300,
}) => {
  // Phase 2.2: Simplified - no callbacks, read-only preview
  
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
        draggable: false, // Force non-draggable
        selectable: false, // Force non-selectable
        connectable: false, // Force non-connectable
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
  }, [nodes]);
  
  return (
    <ReactFlowProvider>
      <MiniFlowContainer $height={containerHeight}>
        <ReactFlow
          id="mini-flow-preview" // Unique ID to prevent conflicts with main editor
          key={`mini-flow-${nodes.length}`} // Force remount on node count change
          nodes={sanitizedNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{
            padding: 0.2,
            minZoom: 0.5,
            maxZoom: 1.5,
          }}
          nodesDraggable={false} // Phase 2.2: Read-only
          nodesConnectable={false} // Phase 2.2: Read-only
          elementsSelectable={false} // Phase 2.2: Read-only
          zoomOnScroll={false} // Phase 2.2: Prevent zoom in mini canvas
          panOnDrag={false} // Phase 2.2: Prevent panning
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
        {/* Phase 2.2: MiniMap for quick overview of container contents */}
        <MiniMap
          nodeColor={(node) => {
            // Color nodes by type in minimap
            if (node.type === 'formStep') return '#3b82f6';
            if (node.type === 'trigger') return '#8b5cf6';
            if (node.type === 'action') return '#10b981';
            if (node.type === 'conditionIf') return '#f59e0b';
            return '#6b7280';
          }}
          maskColor="rgba(var(--color-background), 0.6)"
          style={{
            background: 'rgba(var(--color-surface), 0.9)',
            border: '1px solid rgba(var(--color-border), 0.5)',
          }}
        />
        </ReactFlow>
      </MiniFlowContainer>
    </ReactFlowProvider>
  );
};

export default MiniReactFlow;
