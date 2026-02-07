/**
 * Mini React Flow Component
 * 
 * Nested React Flow instance displayed inside container nodes.
 * Shows child nodes in a mini canvas within the container body.
 * 
 * Created: 2026-02-07
 * Updated: 2026-02-07 - Fixed circular dependency by using individual imports
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
  nodes: Node[];
  edges: Edge[];
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  onConnect?: (connection: Connection | Edge) => void;
  readOnly?: boolean;
  containerHeight?: number;
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
  onNodesChange,
  onEdgesChange,
  onConnect,
  readOnly = false,
  containerHeight = 300,
}) => {
  const handleConnect = useCallback((params: Connection | Edge) => {
    if (onConnect) {
      onConnect(params);
    }
  }, [onConnect]);
  
  return (
    <MiniFlowContainer $height={containerHeight}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : (changes) => {
          if (onNodesChange) {
            // Calculate updated nodes from changes
            const updatedNodes = nodes; // TODO: Apply changes properly
            onNodesChange(updatedNodes);
          }
        }}
        onEdgesChange={readOnly ? undefined : (changes) => {
          if (onEdgesChange) {
            // Calculate updated edges from changes
            const updatedEdges = edges; // TODO: Apply changes properly
            onEdgesChange(updatedEdges);
          }
        }}
        onConnect={readOnly ? undefined : handleConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.5,
          maxZoom: 1.5,
        }}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
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
