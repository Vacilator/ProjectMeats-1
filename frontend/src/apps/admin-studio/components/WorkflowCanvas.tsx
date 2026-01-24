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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Button } from '../../../components/ui/Button';

// Entity node type
interface EntityNodeData {
  label: string;
  fields: Array<{ key: string; label: string; type: string }>;
  mappings?: Record<string, { sourceNodeId: string; sourceField: string }>;
  entityContext?: string;
  [key: string]: unknown;
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

const LogicPanel = styled.div<{ isOpen: boolean }>`
  position: absolute;
  top: 0;
  right: ${props => props.isOpen ? '0' : '-400px'};
  width: 400px;
  height: 100%;
  background-color: rgb(var(--color-surface));
  border-left: 1px solid rgb(var(--color-border));
  box-shadow: var(--shadow-xl);
  z-index: 50;
  transition: right 0.3s ease-in-out;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const PanelHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid rgb(var(--color-border));
  background-color: rgb(var(--color-surface-hover));
`;

const PanelTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 0.25rem;
`;

const PanelSubtitle = styled.div`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
`;

const PanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
`;

const Section = styled.div`
  margin-bottom: 2rem;
`;

const SectionLabel = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 0.5rem;
`;

const Select = styled.select`
  width: 100%;
  padding: 0.5rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background-color: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 0.875rem;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const MappingRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background-color: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
`;

const FieldLabel = styled.div`
  flex: 1;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
`;

const MappingSelect = styled.select`
  flex: 2;
  padding: 0.375rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  background-color: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 0.75rem;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
  }
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
    <div 
      style={{ 
        width: '100%', 
        minWidth: '300px',
        backgroundColor: 'white',
        border: '2px solid rgb(var(--color-border))',
        boxShadow: 'var(--shadow-lg)', 
        borderRadius: 'var(--radius-lg)' 
      }}
    >
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
      <div style={{ padding: '0.75rem', backgroundColor: 'white' }}>
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
                  width: '14px',
                  height: '14px',
                  backgroundColor: 'rgb(var(--color-info))',
                  border: '2px solid white',
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
                  width: '14px',
                  height: '14px',
                  backgroundColor: 'rgb(var(--color-success))',
                  border: '2px solid white',
                  borderRadius: '50%',
                  cursor: 'crosshair',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
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
  dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 150 });

  const nodeWidth = 350;
  const nodeHeight = 200;

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
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
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

interface WorkflowCanvasProps {
  blueprintId: string;
  csrfToken: string;
}

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ blueprintId }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<EntityNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [availableEntities, setAvailableEntities] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node<EntityNodeData> | null>(null);

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

      const newNode: Node<EntityNodeData> = {
        id: `${entity.id}_${Date.now()}`,
        type: 'entityNode',
        position,
        data: {
          label: entity.name,
          fields: entity.fields,
        },
      };

      setNodes((nds) => [...nds, newNode]);
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
    setNodes(layoutedNodes as Node<EntityNodeData>[]);
    setEdges(layoutedEdges);
  };

  const handleSave = () => {
    // TODO: Save to API
    console.log('Saving workflow:', { nodes, edges });
    alert('Workflow saved! (Mock - TODO: API integration)');
  };

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node<EntityNodeData>) => {
    setSelectedNode(node);
  }, []);

  const updateNodeData = useCallback((nodeId: string, updates: Partial<EntityNodeData>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      )
    );
  }, [setNodes]);

  const handleEntityContextChange = (value: string) => {
    if (selectedNode) {
      updateNodeData(selectedNode.id, { entityContext: value });
    }
  };

  const handleMappingChange = (fieldKey: string, sourcePath: string) => {
    if (selectedNode) {
      const [sourceNodeId, sourceField] = sourcePath.split('.');
      const currentMappings = selectedNode.data.mappings || {};
      const updatedMappings = {
        ...currentMappings,
        [fieldKey]: { sourceNodeId, sourceField },
      };
      updateNodeData(selectedNode.id, { mappings: updatedMappings });
    }
  };

  // Get available source nodes (nodes that come before the selected node)
  const getAvailableSourceNodes = useCallback((): Node<EntityNodeData>[] => {
    if (!selectedNode) return [];
    
    // Find all nodes that have an edge pointing to the selected node
    const sourceNodeIds = edges
      .filter((edge) => edge.target === selectedNode.id)
      .map((edge) => edge.source);
    
    return nodes.filter((node) => sourceNodeIds.includes(node.id));
  }, [selectedNode, nodes, edges]);

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
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          zoomOnScroll={true}
          panOnDrag={true}
          minZoom={0.5}
          maxZoom={1.5}
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>

        <LogicPanel isOpen={!!selectedNode}>
          {selectedNode && (
            <>
              <PanelHeader>
                <PanelTitle>Step Configuration</PanelTitle>
                <PanelSubtitle>{selectedNode.data.label}</PanelSubtitle>
              </PanelHeader>
              
              <PanelContent>
                <Section>
                  <SectionLabel>Entity Context</SectionLabel>
                  <Select
                    value={selectedNode.data.entityContext || ''}
                    onChange={(e) => handleEntityContextChange(e.target.value)}
                  >
                    <option value="">Select entity context...</option>
                    {availableEntities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.name}
                      </option>
                    ))}
                  </Select>
                </Section>

                <Section>
                  <SectionLabel>Field Mappings</SectionLabel>
                  <div style={{ fontSize: '0.75rem', color: 'rgb(var(--color-text-secondary))', marginBottom: '1rem' }}>
                    Map fields from previous steps to auto-fill this step's data
                  </div>
                  
                  {selectedNode.data.fields.map((field) => {
                    const currentMapping = selectedNode.data.mappings?.[field.key];
                    const sourceNodes = getAvailableSourceNodes();
                    
                    return (
                      <MappingRow key={field.key}>
                        <FieldLabel>{field.label}</FieldLabel>
                        <MappingSelect
                          value={
                            currentMapping
                              ? `${currentMapping.sourceNodeId}.${currentMapping.sourceField}`
                              : ''
                          }
                          onChange={(e) => handleMappingChange(field.key, e.target.value)}
                        >
                          <option value="">No mapping</option>
                          {sourceNodes.map((sourceNode) =>
                            sourceNode.data.fields.map((sourceField: { key: string; label: string; type: string }) => {
                              const matchScore = 
                                sourceField.label.toLowerCase().includes(field.label.toLowerCase()) ||
                                field.label.toLowerCase().includes(sourceField.label.toLowerCase())
                                  ? ' ⭐'
                                  : '';
                              return (
                                <option
                                  key={`${sourceNode.id}.${sourceField.key}`}
                                  value={`${sourceNode.id}.${sourceField.key}`}
                                >
                                  {sourceNode.data.label} → {sourceField.label}{matchScore}
                                </option>
                              );
                            })
                          )}
                        </MappingSelect>
                      </MappingRow>
                    );
                  })}
                </Section>

                <Section>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedNode(null)}
                    style={{ width: '100%' }}
                  >
                    Close Panel
                  </Button>
                </Section>
              </PanelContent>
            </>
          )}
        </LogicPanel>
      </CanvasContainer>
    </Container>
  );
};

export default WorkflowCanvas;
