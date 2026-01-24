/**
 * WorkflowCanvas Component
 * 
 * Visual workflow designer using React Flow.
 * Allows drag-and-drop of entity blueprints onto a canvas and connecting them.
 */
import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Card, CardHeader, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

// Entity node type
interface EntityNodeData {
  label: string;
  fields: Array<{ key: string; label: string; type: string }>;
}

const Container = styled.div`
  width: 100%;
  height: 100vh;
  display: flex;
  background-color: rgb(var(--color-background));
`;

const Sidebar = styled.div`
  width: 300px;
  background-color: rgb(var(--color-surface));
  border-right: 1px solid rgb(var(--color-border));
  padding: 1rem;
  overflow-y: auto;
`;

const SidebarTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 1rem;
`;

const EntityItem = styled.div`
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background-color: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  cursor: grab;
  transition: all 0.2s;

  &:hover {
    background-color: rgb(var(--color-surface-hover));
    border-color: rgb(var(--color-primary));
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  &:active {
    cursor: grabbing;
  }
`;

const EntityName = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 0.25rem;
`;

const EntityDescription = styled.div`
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary));
`;

const CanvasContainer = styled.div`
  flex: 1;
  position: relative;
`;

const Header = styled.div`
  position: absolute;
  top: 1rem;
  left: 1rem;
  right: 1rem;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: rgba(var(--color-surface), 0.95);
  backdrop-filter: blur(10px);
  padding: 1rem;
  border-radius: var(--radius-lg);
  border: 1px solid rgb(var(--color-border));
  box-shadow: var(--shadow-md);
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

// Custom Entity Node Component
const EntityNode: React.FC<{ data: EntityNodeData }> = ({ data }) => {
  return (
    <Card padding="none" style={{ width: '100%', minWidth: '250px', boxShadow: 'var(--shadow-md)', borderRadius: 'var(--radius-lg)' }}>
      <div
        style={{
          padding: '0.75rem',
          backgroundColor: 'rgb(var(--color-primary))',
          color: 'rgb(var(--color-primary-foreground))',
          fontWeight: 600,
          fontSize: '0.875rem',
          borderTopLeftRadius: 'var(--radius-lg)',
          borderTopRightRadius: 'var(--radius-lg)',
        }}
      >
        {data.label}
      </div>
      <div style={{ padding: '0.75rem' }}>
        {data.fields.map((field, idx) => (
          <div
            key={field.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem',
              fontSize: '0.875rem',
              borderBottom:
                idx < data.fields.length - 1
                  ? '1px solid rgb(var(--color-border-light))'
                  : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                className="react-flow__handle react-flow__handle-left"
                style={{
                  position: 'relative',
                  transform: 'none',
                  width: '12px',
                  height: '12px',
                  backgroundColor: 'rgb(var(--color-info))',
                  border: '1px solid rgb(var(--color-surface))',
                  borderRadius: '50%',
                  cursor: 'crosshair',
                }}
              />
              <span style={{ color: 'rgb(var(--color-text-primary))' }}>
                {field.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  color: 'rgb(var(--color-text-secondary))',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                }}
              >
                {field.type}
              </span>
              <div
                className="react-flow__handle react-flow__handle-right"
                style={{
                  position: 'relative',
                  transform: 'none',
                  width: '12px',
                  height: '12px',
                  backgroundColor: 'rgb(var(--color-success))',
                  border: '1px solid rgb(var(--color-surface))',
                  borderRadius: '50%',
                  cursor: 'crosshair',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

// Node types
const nodeTypes = {
  entityNode: EntityNode,
};

// Auto-layout using Dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 300, height: 200 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 125,
        y: nodeWithPosition.y - 75,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

interface WorkflowCanvasProps {
  blueprintId: string;
  csrfToken: string;
}

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ blueprintId, csrfToken }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [availableEntities, setAvailableEntities] = useState<any[]>([]);

  // Mock data - in production, fetch from API
  useEffect(() => {
    setAvailableEntities([
      {
        id: 'customer',
        name: 'Customer',
        description: 'Customer entity with contact details',
        fields: [
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'phone', label: 'Phone', type: 'phone' },
        ],
      },
      {
        id: 'order',
        name: 'Sales Order',
        description: 'Sales order with line items',
        fields: [
          { key: 'order_number', label: 'Order #', type: 'text' },
          { key: 'order_date', label: 'Date', type: 'date' },
          { key: 'total', label: 'Total', type: 'number' },
        ],
      },
      {
        id: 'product',
        name: 'Product',
        description: 'Product catalog item',
        fields: [
          { key: 'sku', label: 'SKU', type: 'text' },
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'price', label: 'Price', type: 'number' },
        ],
      },
    ]);

    // Load existing workflow if any
    // TODO: Fetch from API
  }, [blueprintId]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const entityData = event.dataTransfer.getData('application/json');
      if (!entityData) return;

      const entity = JSON.parse(entityData);
      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 125,
        y: event.clientY - reactFlowBounds.top - 75,
      };

      const newNode: Node = {
        id: `${entity.id}_${Date.now()}`,
        type: 'entityNode',
        position,
        data: {
          label: entity.name,
          fields: entity.fields,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const onDragStart = (event: React.DragEvent, entity: any) => {
    event.dataTransfer.setData('application/json', JSON.stringify(entity));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleAutoLayout = () => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      'LR'
    );
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  };

  const handleSave = () => {
    // TODO: Save to API
    console.log('Saving workflow:', { nodes, edges });
    alert('Workflow saved! (Mock - TODO: API integration)');
  };

  return (
    <Container>
      <Sidebar>
        <SidebarTitle>Available Entities</SidebarTitle>
        {availableEntities.map((entity) => (
          <EntityItem
            key={entity.id}
            draggable
            onDragStart={(e) => onDragStart(e, entity)}
          >
            <EntityName>{entity.name}</EntityName>
            <EntityDescription>{entity.description}</EntityDescription>
          </EntityItem>
        ))}
      </Sidebar>

      <CanvasContainer>
        <Header>
          <Title>Workflow Designer</Title>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="outline" onClick={handleAutoLayout}>
              Auto Layout
            </Button>
            <Button variant="outline" onClick={() => window.history.back()}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              Save Workflow
            </Button>
          </div>
        </Header>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          zoomOnScroll={true}
          panOnDrag={true}
          minZoom={0.2}
          maxZoom={2.0}
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
      </CanvasContainer>
    </Container>
  );
};

export default WorkflowCanvas;
