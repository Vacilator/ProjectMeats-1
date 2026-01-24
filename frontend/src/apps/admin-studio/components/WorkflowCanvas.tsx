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
  fields: Array<{ 
    key: string; 
    label: string; 
    type: string;
    mapping?: { sourceNodeId: string; sourceField: string };
    filter?: { targetField: string; sourcePath: string };
  }>;
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

const FieldConfigSection = styled.div<{ isExpanded: boolean }>`
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  margin-bottom: 0.5rem;
  overflow: hidden;
  transition: all 0.2s;
`;

const FieldConfigHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background-color: rgb(var(--color-background));
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgb(var(--color-surface-hover));
  }
`;

const FieldConfigBody = styled.div<{ isExpanded: boolean }>`
  max-height: ${props => props.isExpanded ? '500px' : '0'};
  overflow: hidden;
  transition: max-height 0.3s ease-in-out;
  padding: ${props => props.isExpanded ? '1rem' : '0 1rem'};
  background-color: rgb(var(--color-surface));
`;

const ConfigSubSection = styled.div`
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgb(var(--color-border-light));

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
`;

const SubSectionLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
`;

const ConfigRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const ConfigLabel = styled.label`
  flex: 0 0 120px;
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary));
`;

const ConfigSelect = styled.select`
  flex: 1;
  padding: 0.5rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  background-color: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));
  font-size: 0.75rem;

  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const HelpText = styled.div`
  font-size: 0.7rem;
  color: rgb(var(--color-text-secondary));
  font-style: italic;
  margin-top: 0.25rem;
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

const TestRunModal = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: ${props => props.isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const TestRunContent = styled.div`
  background-color: rgb(var(--color-surface));
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const TestRunHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const TestRunBody = styled.div`
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
`;

const TestStepCard = styled.div`
  padding: 1rem;
  margin-bottom: 1rem;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  background-color: rgb(var(--color-background));
`;

const MagicWandButton = styled.button`
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  background: linear-gradient(135deg, rgb(168, 85, 247) 0%, rgb(236, 72, 153) 100%);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  transition: all 0.2s;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(168, 85, 247, 0.3);
  }
`;

const VariablePickerPopover = styled.div<{ isOpen: boolean }>`
  display: ${props => props.isOpen ? 'block' : 'none'};
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.5rem;
  background-color: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 0.5rem;
  min-width: 250px;
  z-index: 100;
  max-height: 300px;
  overflow-y: auto;
`;

const VariableOption = styled.div`
  padding: 0.5rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: rgba(var(--color-primary), 0.1);
  }
  
  strong {
    color: rgb(var(--color-primary));
    font-family: var(--font-mono));
    font-size: 0.75rem;
  }
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
  const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({});
  const [isTestRunOpen, setIsTestRunOpen] = useState(false);
  const [testRunData, setTestRunData] = useState<Record<string, any>>({});
  const [magicWandField, setMagicWandField] = useState<string | null>(null);

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

  // Get available source nodes (nodes that come before the selected node)
  const getAvailableSourceNodes = useCallback((): Node<EntityNodeData>[] => {
    if (!selectedNode) return [];
    
    // Find all nodes that have an edge pointing to the selected node
    const sourceNodeIds = edges
      .filter((edge) => edge.target === selectedNode.id)
      .map((edge) => edge.source);
    
    return nodes.filter((node) => sourceNodeIds.includes(node.id));
  }, [selectedNode, nodes, edges]);

  const toggleFieldExpanded = (fieldKey: string) => {
    setExpandedFields(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }));
  };

  const handleFieldMappingChange = (fieldKey: string, sourceNodeId: string, sourceField: string) => {
    if (!selectedNode) return;
    
    const updatedFields = selectedNode.data.fields.map(field =>
      field.key === fieldKey
        ? { ...field, mapping: sourceNodeId && sourceField ? { sourceNodeId, sourceField } : undefined }
        : field
    );
    
    updateNodeData(selectedNode.id, { fields: updatedFields });
  };

  const handleFieldFilterChange = (fieldKey: string, targetField: string, sourcePath: string) => {
    if (!selectedNode) return;
    
    const updatedFields = selectedNode.data.fields.map(field =>
      field.key === fieldKey
        ? { ...field, filter: targetField && sourcePath ? { targetField, sourcePath } : undefined }
        : field
    );
    
    updateNodeData(selectedNode.id, { fields: updatedFields });
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
            <Button variant="outline" onClick={() => setIsTestRunOpen(true)} style={{ background: 'linear-gradient(135deg, rgb(34, 197, 94) 0%, rgb(22, 163, 74) 100%)', color: 'white' }}>
              ▶ Test Run
            </Button>
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

        {/* Test Run Modal */}
        <TestRunModal isOpen={isTestRunOpen} onClick={() => setIsTestRunOpen(false)}>
          <TestRunContent onClick={(e) => e.stopPropagation()}>
            <TestRunHeader>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Test Run Workflow</h2>
              <button
                onClick={() => setIsTestRunOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'rgb(var(--color-text-secondary))'
                }}
              >
                ×
              </button>
            </TestRunHeader>
            <TestRunBody>
              <p style={{ marginBottom: '1rem', color: 'rgb(var(--color-text-secondary))' }}>
                Simulate workflow execution step-by-step. Fill in test data for each step.
              </p>
              {nodes.map((node, index) => (
                <TestStepCard key={node.id}>
                  <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                    Step {index + 1}: {node.data.label}
                  </div>
                  {node.data.fields.map((field) => (
                    <div key={field.key} style={{ marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>
                        {field.label}
                        {field.mapping && (
                          <span style={{ color: 'rgb(var(--color-primary))', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                            (Auto-filled from previous step)
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={testRunData[`${node.id}.${field.key}`] || ''}
                        onChange={(e) => setTestRunData(prev => ({
                          ...prev,
                          [`${node.id}.${field.key}`]: e.target.value
                        }))}
                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          border: '1px solid rgb(var(--color-border))',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.875rem'
                        }}
                        disabled={!!field.mapping}
                      />
                    </div>
                  ))}
                </TestStepCard>
              ))}
              <Button
                variant="primary"
                onClick={() => {
                  console.log('Test Run Data:', testRunData);
                  alert('Test run complete! Check console for data.');
                }}
                style={{ width: '100%', marginTop: '1rem' }}
              >
                Execute Test
              </Button>
            </TestRunBody>
          </TestRunContent>
        </TestRunModal>

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
                  <SectionLabel>Field Configuration</SectionLabel>
                  <div style={{ fontSize: '0.75rem', color: 'rgb(var(--color-text-secondary))', marginBottom: '1rem' }}>
                    Configure data sources and filters for each field
                  </div>
                  
                  {selectedNode.data.fields.map((field) => {
                    const isExpanded = expandedFields[field.key] || false;
                    const sourceNodes = getAvailableSourceNodes();
                    const isReferenceType = field.type === 'select' || field.type === 'radio';
                    
                    return (
                      <FieldConfigSection key={field.key} isExpanded={isExpanded}>
                        <FieldConfigHeader onClick={() => toggleFieldExpanded(field.key)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 600 }}>{field.label}</span>
                            <span style={{ 
                              fontSize: '0.7rem', 
                              color: 'rgb(var(--color-text-secondary))',
                              fontFamily: 'var(--font-mono)'
                            }}>
                              {field.type}
                            </span>
                          </div>
                          <span style={{ fontSize: '1rem' }}>
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        </FieldConfigHeader>
                        
                        <FieldConfigBody isExpanded={isExpanded}>
                          {/* Data Mapping Section */}
                          <ConfigSubSection>
                            <SubSectionLabel>
                              📥 Data Mapping (Auto-fill Value)
                              <div style={{ position: 'relative', display: 'inline-block', marginLeft: '0.5rem' }}>
                                <MagicWandButton
                                  onClick={() => setMagicWandField(magicWandField === field.key ? null : field.key)}
                                  type="button"
                                >
                                  🪄 Variables
                                </MagicWandButton>
                                <VariablePickerPopover isOpen={magicWandField === field.key}>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', color: 'rgb(var(--color-text-secondary))' }}>
                                    Available Variables
                                  </div>
                                  {sourceNodes.map((node) => (
                                    <div key={node.id}>
                                      <div style={{ 
                                        fontSize: '0.7rem', 
                                        fontWeight: 600, 
                                        marginTop: '0.5rem', 
                                        marginBottom: '0.25rem',
                                        color: 'rgb(var(--color-primary))'
                                      }}>
                                        {node.data.label}
                                      </div>
                                      {node.data.fields.map((sourceField) => (
                                        <VariableOption
                                          key={sourceField.key}
                                          onClick={() => {
                                            handleFieldMappingChange(field.key, node.id, sourceField.key);
                                            setMagicWandField(null);
                                          }}
                                        >
                                          <div>{sourceField.label}</div>
                                          <strong>{`{{${node.id}.${sourceField.key}}}`}</strong>
                                        </VariableOption>
                                      ))}
                                    </div>
                                  ))}
                                  {sourceNodes.length === 0 && (
                                    <div style={{ fontSize: '0.75rem', color: 'rgb(var(--color-text-secondary))', padding: '0.5rem' }}>
                                      No previous steps available
                                    </div>
                                  )}
                                </VariablePickerPopover>
                              </div>
                            </SubSectionLabel>
                            <HelpText>Pre-fill this field with data from a previous step</HelpText>
                            
                            <ConfigRow>
                              <ConfigLabel>Source Step:</ConfigLabel>
                              <ConfigSelect
                                value={field.mapping?.sourceNodeId || ''}
                                onChange={(e) => {
                                  const sourceNodeId = e.target.value;
                                  const sourceField = field.mapping?.sourceField || '';
                                  handleFieldMappingChange(field.key, sourceNodeId, sourceField);
                                }}
                              >
                                <option value="">None</option>
                                {sourceNodes.map((node) => (
                                  <option key={node.id} value={node.id}>
                                    {node.data.label}
                                  </option>
                                ))}
                              </ConfigSelect>
                            </ConfigRow>
                            
                            {field.mapping?.sourceNodeId && (
                              <ConfigRow>
                                <ConfigLabel>Source Field:</ConfigLabel>
                                <ConfigSelect
                                  value={field.mapping.sourceField || ''}
                                  onChange={(e) => {
                                    const sourceField = e.target.value;
                                    handleFieldMappingChange(
                                      field.key,
                                      field.mapping!.sourceNodeId,
                                      sourceField
                                    );
                                  }}
                                >
                                  <option value="">Select field...</option>
                                  {sourceNodes
                                    .find((n) => n.id === field.mapping?.sourceNodeId)
                                    ?.data.fields.map((sourceField) => {
                                      const matchScore =
                                        sourceField.label.toLowerCase().includes(field.label.toLowerCase()) ||
                                        field.label.toLowerCase().includes(sourceField.label.toLowerCase())
                                          ? ' ⭐'
                                          : '';
                                      return (
                                        <option key={sourceField.key} value={sourceField.key}>
                                          {sourceField.label}{matchScore}
                                        </option>
                                      );
                                    })}
                                </ConfigSelect>
                              </ConfigRow>
                            )}
                          </ConfigSubSection>
                          
                          {/* Chain Filter Section (only for select/reference types) */}
                          {isReferenceType && (
                            <ConfigSubSection>
                              <SubSectionLabel>🔗 Chain Filter (Dynamic Options)</SubSectionLabel>
                              <HelpText>
                                Filter dropdown options based on a previous selection
                              </HelpText>
                              
                              <ConfigRow>
                                <ConfigLabel>Filter Where:</ConfigLabel>
                                <ConfigSelect
                                  value={field.filter?.targetField || ''}
                                  onChange={(e) => {
                                    const targetField = e.target.value;
                                    const sourcePath = field.filter?.sourcePath || '';
                                    handleFieldFilterChange(field.key, targetField, sourcePath);
                                  }}
                                >
                                  <option value="">No filter</option>
                                  <option value="supplier_id">Supplier ID</option>
                                  <option value="customer_id">Customer ID</option>
                                  <option value="category_id">Category ID</option>
                                  <option value="plant_id">Plant ID</option>
                                </ConfigSelect>
                              </ConfigRow>
                              
                              {field.filter?.targetField && (
                                <ConfigRow>
                                  <ConfigLabel>Matches:</ConfigLabel>
                                  <ConfigSelect
                                    value={field.filter.sourcePath || ''}
                                    onChange={(e) => {
                                      const sourcePath = e.target.value;
                                      handleFieldFilterChange(
                                        field.key,
                                        field.filter!.targetField,
                                        sourcePath
                                      );
                                    }}
                                  >
                                    <option value="">Select source...</option>
                                    {sourceNodes.map((sourceNode) =>
                                      sourceNode.data.fields.map((sourceField) => (
                                        <option
                                          key={`${sourceNode.id}.${sourceField.key}`}
                                          value={`${sourceNode.id}.${sourceField.key}`}
                                        >
                                          {sourceNode.data.label} → {sourceField.label}
                                        </option>
                                      ))
                                    )}
                                  </ConfigSelect>
                                </ConfigRow>
                              )}
                              
                              {field.filter?.targetField && field.filter?.sourcePath && (
                                <HelpText style={{ marginTop: '0.5rem', color: 'rgb(var(--color-success))' }}>
                                  ✓ Active: Options will filter where {field.filter.targetField} matches the value from {field.filter.sourcePath.split('.').pop()}
                                </HelpText>
                              )}
                            </ConfigSubSection>
                          )}
                        </FieldConfigBody>
                      </FieldConfigSection>
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
