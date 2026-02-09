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
 */
import React, { useCallback } from 'react';
import styled from 'styled-components';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  BackgroundVariant,
  NodeTypes,
  EdgeTypes,
  Connection,
  addEdge,
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
  
  .react-flow__node {
    cursor: pointer !important;
  }
  
  .react-flow__edges {
    pointer-events: ${props => props.readOnly ? 'none' : 'all'};
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
  
  return (
    <MiniFlowContainer $height={containerHeight}>
      <ReactFlow
        nodes={nodes}
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
  );
};

export default MiniReactFlow;
