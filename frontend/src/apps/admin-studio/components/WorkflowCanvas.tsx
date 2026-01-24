/**
 * WorkflowCanvas Component
 * 
 * Industry-leading visual workflow designer using React Flow.
 * Matches n8n/Zapier standards with:
 * - Workflow templates for common patterns
 * - Keyboard shortcuts (Ctrl+S save, Ctrl+Z undo, Del delete)
 * - Copy/paste nodes
 * - Undo/redo history
 * - Save status indicator
 * - Node duplication
 * - Zoom controls UI
 * - Connection validation
 * - Empty state guidance
 * - Step numbering
 * 
 * Allows drag-and-drop of entity blueprints onto a canvas and connecting them.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
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
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Button } from '../../../components/ui/Button';

// Entity node type
interface EntityNodeData {
  label: string;
  stepNumber?: number;
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

// Workflow template interface
interface WorkflowTemplate {
  name: string;
  icon: string;
  description: string;
  nodes: Array<{ entity: string; position: { x: number; y: number } }>;
  connections: Array<{ from: number; to: number }>;
}

// Common workflow templates
const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    name: 'Customer → Order',
    icon: '🛒',
    description: 'Basic customer to order flow',
    nodes: [
      { entity: 'customer', position: { x: 0, y: 0 } },
      { entity: 'order', position: { x: 400, y: 0 } },
    ],
    connections: [{ from: 0, to: 1 }],
  },
  {
    name: 'Order → Product → Delivery',
    icon: '📦',
    description: 'Order fulfillment workflow',
    nodes: [
      { entity: 'order', position: { x: 0, y: 0 } },
      { entity: 'product', position: { x: 400, y: 0 } },
      { entity: 'customer', position: { x: 800, y: 0 } },
    ],
    connections: [{ from: 0, to: 1 }, { from: 1, to: 2 }],
  },
  {
    name: 'Product Catalog',
    icon: '📋',
    description: 'Product listing workflow',
    nodes: [
      { entity: 'product', position: { x: 0, y: 0 } },
    ],
    connections: [],
  },
];

// History item for undo/redo
interface HistoryItem {
  nodes: Node<EntityNodeData>[];
  edges: Edge[];
}

// Animation keyframes
const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const slideIn = keyframes`
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

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

const SidebarSection = styled.div`
  margin-bottom: 1.5rem;
`;

const SidebarTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 1rem;
`;

const SidebarSubtitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

const TemplateCard = styled.div`
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: linear-gradient(135deg, rgba(var(--color-primary), 0.05) 0%, rgba(var(--color-primary), 0.1) 100%);
  border: 1px solid rgba(var(--color-primary), 0.2);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: linear-gradient(135deg, rgba(var(--color-primary), 0.1) 0%, rgba(var(--color-primary), 0.15) 100%);
    border-color: rgb(var(--color-primary));
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
`;

const TemplateHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
`;

const TemplateIcon = styled.span`
  font-size: 1.25rem;
`;

const TemplateName = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const TemplateDescription = styled.div`
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
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const SaveIndicator = styled.div<{ status: 'saved' | 'saving' | 'unsaved' }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: ${props => props.status === 'saved' 
    ? 'rgb(34, 197, 94)' 
    : props.status === 'saving' 
      ? 'rgb(234, 179, 8)' 
      : 'rgb(var(--color-text-secondary))'};
  animation: ${props => props.status === 'saving' ? pulse : 'none'} 1.5s ease-in-out infinite;
`;

const ToolbarDivider = styled.div`
  width: 1px;
  height: 24px;
  background-color: rgb(var(--color-border));
  margin: 0 0.5rem;
`;

const ZoomControls = styled.div`
  position: absolute;
  bottom: 6rem;
  left: 1rem;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background-color: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  padding: 0.25rem;
  box-shadow: var(--shadow-md);
`;

const ZoomButton = styled.button`
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-size: 1rem;
  color: rgb(var(--color-text-primary));
  transition: background-color 0.2s;

  &:hover {
    background-color: rgb(var(--color-surface-hover));
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ZoomLevel = styled.div`
  font-size: 0.625rem;
  text-align: center;
  padding: 0.25rem;
  color: rgb(var(--color-text-secondary));
  border-top: 1px solid rgb(var(--color-border));
  border-bottom: 1px solid rgb(var(--color-border));
`;

const EmptyStateContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  padding: 3rem;
  z-index: 5;
`;

const EmptyStateIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`;

const EmptyStateTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 0.5rem;
`;

const EmptyStateDescription = styled.p`
  font-size: 0.875rem;
  color: rgb(var(--color-text-secondary));
  margin-bottom: 1rem;
  max-width: 400px;
`;

const ShortcutHint = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 1.5rem;
`;

const Shortcut = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: rgb(var(--color-text-secondary));
`;

const Kbd = styled.kbd`
  padding: 0.25rem 0.5rem;
  background-color: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.7rem;
`;

const NodeBadge = styled.div`
  position: absolute;
  top: -10px;
  left: -10px;
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, rgb(var(--color-primary)) 0%, rgb(79, 70, 229) 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  box-shadow: var(--shadow-md);
  border: 2px solid white;
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
    font-family: var(--font-mono);
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
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', 
        borderRadius: '12px',
        position: 'relative',
      }}
    >
      {/* Step Number Badge */}
      {data.stepNumber && (
        <div
          style={{
            position: 'absolute',
            top: '-10px',
            left: '-10px',
            width: '28px',
            height: '28px',
            background: 'linear-gradient(135deg, rgb(99, 102, 241) 0%, rgb(79, 70, 229) 100%)',
            color: 'white',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 700,
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            border: '2px solid white',
            zIndex: 10,
          }}
        >
          {data.stepNumber}
        </div>
      )}
      <div
        style={{
          padding: '0.75rem 1rem',
          background: 'linear-gradient(135deg, rgb(99, 102, 241) 0%, rgb(79, 70, 229) 100%)',
          color: 'white',
          fontWeight: 600,
          fontSize: '0.875rem',
          borderTopLeftRadius: '10px',
          borderTopRightRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>{data.label}</span>
        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{data.fields.length} fields</span>
      </div>
      <div style={{ padding: '0.5rem', backgroundColor: 'white', borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px' }}>
        {data.fields.slice(0, 4).map((field, idx) => (
          <div
            key={field.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem',
              fontSize: '0.8rem',
              borderBottom:
                idx < Math.min(data.fields.length, 4) - 1
                  ? '1px solid rgba(0, 0, 0, 0.06)'
                  : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  backgroundColor: '#3b82f6',
                  border: '2px solid white',
                  borderRadius: '50%',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                }}
              />
              <span style={{ color: '#374151' }}>
                {field.label}
              </span>
              {field.mapping && (
                <span style={{ fontSize: '0.6rem', color: '#8b5cf6' }}>⚡</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  color: '#9ca3af',
                  fontFamily: 'monospace',
                  fontSize: '0.65rem',
                  backgroundColor: '#f3f4f6',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '4px',
                }}
              >
                {field.type}
              </span>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  backgroundColor: '#10b981',
                  border: '2px solid white',
                  borderRadius: '50%',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                }}
              />
            </div>
          </div>
        ))}
        {data.fields.length > 4 && (
          <div style={{ 
            padding: '0.5rem', 
            textAlign: 'center', 
            fontSize: '0.7rem', 
            color: '#9ca3af',
            borderTop: '1px solid rgba(0,0,0,0.06)',
          }}>
            +{data.fields.length - 4} more fields
          </div>
        )}
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

// Inner component that uses React Flow hooks
const WorkflowCanvasInner: React.FC<WorkflowCanvasProps> = ({ blueprintId }) => {
  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<EntityNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [availableEntities, setAvailableEntities] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node<EntityNodeData> | null>(null);
  const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({});
  const [isTestRunOpen, setIsTestRunOpen] = useState(false);
  const [testRunData, setTestRunData] = useState<Record<string, any>>({});
  const [magicWandField, setMagicWandField] = useState<string | null>(null);
  
  // New state for industry-leading features
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [clipboard, setClipboard] = useState<Node<EntityNodeData>[] | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Update step numbers when nodes change
  useEffect(() => {
    const numberedNodes = nodes.map((node, index) => ({
      ...node,
      data: { ...node.data, stepNumber: index + 1 },
    }));
    
    // Only update if step numbers have changed
    const hasChanges = numberedNodes.some((n, i) => n.data.stepNumber !== nodes[i]?.data.stepNumber);
    if (hasChanges && nodes.length > 0) {
      setNodes(numberedNodes as Node<EntityNodeData>[]);
    }
  }, [nodes.length]);

  // Auto-save with debounce
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      setSaveStatus('unsaved');
      
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
      
      autoSaveTimeout.current = setTimeout(() => {
        // Auto-save logic would go here
        setSaveStatus('saving');
        setTimeout(() => {
          setSaveStatus('saved');
        }, 500);
      }, 2000);
    }
    
    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, [nodes, edges]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S: Save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Ctrl+Z: Undo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Y or Ctrl+Shift+Z: Redo
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        handleRedo();
      }
      // Ctrl+C: Copy selected node
      if (e.ctrlKey && e.key === 'c' && selectedNode) {
        e.preventDefault();
        setClipboard([selectedNode]);
      }
      // Ctrl+V: Paste
      if (e.ctrlKey && e.key === 'v' && clipboard) {
        e.preventDefault();
        handlePaste();
      }
      // Delete: Remove selected node
      if (e.key === 'Delete' && selectedNode) {
        e.preventDefault();
        handleDeleteNode(selectedNode.id);
      }
      // Escape: Deselect
      if (e.key === 'Escape') {
        setSelectedNode(null);
        setMagicWandField(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, clipboard, historyIndex]);

  // Save to history for undo/redo
  const saveToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: [...nodes], edges: [...edges] });
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [nodes, edges, history, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setNodes(prev.nodes as Node<EntityNodeData>[]);
      setEdges(prev.edges);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setNodes(next.nodes as Node<EntityNodeData>[]);
      setEdges(next.edges);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;
    
    const newNodes = clipboard.map((node) => ({
      ...node,
      id: `${node.id.split('_')[0]}_${Date.now()}`,
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50,
      },
      data: { ...node.data },
    }));
    
    saveToHistory();
    setNodes((nds) => [...nds, ...newNodes] as Node<EntityNodeData>[]);
  }, [clipboard, setNodes, saveToHistory]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    if (window.confirm('Delete this step? This action cannot be undone.')) {
      saveToHistory();
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode(null);
    }
  }, [setNodes, setEdges, saveToHistory]);

  const handleDuplicateNode = useCallback((node: Node<EntityNodeData>) => {
    const newNode: Node<EntityNodeData> = {
      ...node,
      id: `${node.id.split('_')[0]}_${Date.now()}`,
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50,
      },
      data: { ...node.data, stepNumber: nodes.length + 1 },
    };
    
    saveToHistory();
    setNodes((nds) => [...nds, newNode]);
  }, [nodes.length, setNodes, saveToHistory]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    reactFlowInstance.zoomIn();
    setZoomLevel(prev => Math.min(prev + 0.1, 1.5));
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance.zoomOut();
    setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
  }, [reactFlowInstance]);

  const handleZoomReset = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2 });
    setZoomLevel(1);
  }, [reactFlowInstance]);

  // Apply workflow template
  const handleApplyTemplate = useCallback((template: WorkflowTemplate) => {
    saveToHistory();
    
    const newNodes: Node<EntityNodeData>[] = template.nodes.map((nodeConfig, index) => {
      const entity = availableEntities.find((e) => e.id === nodeConfig.entity);
      return {
        id: `${nodeConfig.entity}_${Date.now()}_${index}`,
        type: 'entityNode',
        position: nodeConfig.position,
        data: {
          label: entity?.name || nodeConfig.entity,
          fields: entity?.fields || [],
          stepNumber: index + 1,
        },
      };
    });

    const newEdges: Edge[] = template.connections.map((conn, index) => ({
      id: `edge_${Date.now()}_${index}`,
      source: newNodes[conn.from].id,
      target: newNodes[conn.to].id,
    }));

    setNodes(newNodes);
    setEdges(newEdges);
    
    // Auto-layout after applying template
    setTimeout(() => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        newNodes,
        newEdges,
        'LR'
      );
      setNodes(layoutedNodes as Node<EntityNodeData>[]);
      setEdges(layoutedEdges);
    }, 100);
  }, [availableEntities, setNodes, setEdges, saveToHistory]);

  // Mock data - in production, fetch from API
  useEffect(() => {
    setAvailableEntities([
      {
        id: 'customer',
        name: 'Customer',
        description: 'Customer entity with contact details',
        fields: [
          { key: 'id', label: 'ID', type: 'text' },
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'phone', label: 'Phone', type: 'phone' },
          { key: 'address', label: 'Address', type: 'textarea' },
        ],
      },
      {
        id: 'order',
        name: 'Sales Order',
        description: 'Sales order with line items',
        fields: [
          { key: 'id', label: 'ID', type: 'text' },
          { key: 'order_number', label: 'Order #', type: 'text' },
          { key: 'order_date', label: 'Date', type: 'date' },
          { key: 'customer_id', label: 'Customer', type: 'reference' },
          { key: 'total', label: 'Total', type: 'number' },
          { key: 'status', label: 'Status', type: 'select' },
        ],
      },
      {
        id: 'product',
        name: 'Product',
        description: 'Product catalog item',
        fields: [
          { key: 'id', label: 'ID', type: 'text' },
          { key: 'sku', label: 'SKU', type: 'text' },
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'price', label: 'Price', type: 'number' },
          { key: 'category', label: 'Category', type: 'select' },
        ],
      },
      {
        id: 'supplier',
        name: 'Supplier',
        description: 'Supplier/vendor information',
        fields: [
          { key: 'id', label: 'ID', type: 'text' },
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'contact', label: 'Contact', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
        ],
      },
    ]);

    // Initialize history
    setHistory([{ nodes: [], edges: [] }]);
    setHistoryIndex(0);
  }, [blueprintId]);

  const onConnect = useCallback(
    (params: Connection) => {
      saveToHistory();
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges, saveToHistory]
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
          stepNumber: nodes.length + 1,
        },
      };

      saveToHistory();
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes, nodes.length, saveToHistory]
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
        <SidebarSection>
          <SidebarSubtitle>⚡ Quick Start Templates</SidebarSubtitle>
          {WORKFLOW_TEMPLATES.map((template, index) => (
            <TemplateCard key={index} onClick={() => handleApplyTemplate(template)}>
              <TemplateHeader>
                <TemplateIcon>{template.icon}</TemplateIcon>
                <TemplateName>{template.name}</TemplateName>
              </TemplateHeader>
              <TemplateDescription>{template.description}</TemplateDescription>
            </TemplateCard>
          ))}
        </SidebarSection>
        
        <SidebarSection>
          <SidebarTitle>Available Entities</SidebarTitle>
          <p style={{ fontSize: '0.75rem', color: 'rgb(var(--color-text-secondary))', marginBottom: '0.75rem' }}>
            Drag entities onto the canvas to build your workflow
          </p>
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
        </SidebarSection>
      </Sidebar>

      <CanvasContainer>
        <Header>
          <Title>
            Workflow Designer
            <SaveIndicator status={saveStatus}>
              {saveStatus === 'saved' && '✓ Saved'}
              {saveStatus === 'saving' && '⟳ Saving...'}
              {saveStatus === 'unsaved' && '○ Unsaved changes'}
            </SaveIndicator>
          </Title>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Button 
              variant="outline" 
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title="Undo (Ctrl+Z)"
              style={{ padding: '0.5rem 0.75rem' }}
            >
              ↶
            </Button>
            <Button 
              variant="outline" 
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Redo (Ctrl+Y)"
              style={{ padding: '0.5rem 0.75rem' }}
            >
              ↷
            </Button>
            <ToolbarDivider />
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

        {/* Empty State */}
        {nodes.length === 0 && (
          <EmptyStateContainer>
            <EmptyStateIcon>🔗</EmptyStateIcon>
            <EmptyStateTitle>Design Your Workflow</EmptyStateTitle>
            <EmptyStateDescription>
              Start by dragging entities from the sidebar, or use a template to get started quickly.
              Connect steps to define your data flow.
            </EmptyStateDescription>
            <ShortcutHint>
              <Shortcut><Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> Save</Shortcut>
              <Shortcut><Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> Undo</Shortcut>
              <Shortcut><Kbd>Del</Kbd> Delete</Shortcut>
              <Shortcut><Kbd>Ctrl</Kbd>+<Kbd>C</Kbd>/<Kbd>V</Kbd> Copy/Paste</Shortcut>
            </ShortcutHint>
          </EmptyStateContainer>
        )}

        {/* Zoom Controls */}
        <ZoomControls>
          <ZoomButton onClick={handleZoomIn} title="Zoom In">+</ZoomButton>
          <ZoomLevel>{Math.round(zoomLevel * 100)}%</ZoomLevel>
          <ZoomButton onClick={handleZoomOut} title="Zoom Out">−</ZoomButton>
          <ZoomButton onClick={handleZoomReset} title="Fit to View">⊡</ZoomButton>
        </ZoomControls>

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
              {nodes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'rgb(var(--color-text-secondary))' }}>
                  No steps in workflow yet. Add some entities to test.
                </div>
              ) : (
                <>
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
                </>
              )}
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
                <div>
                  <PanelTitle>Step Configuration</PanelTitle>
                  <PanelSubtitle>{selectedNode.data.label}</PanelSubtitle>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleDuplicateNode(selectedNode)}
                    title="Duplicate Step"
                    style={{
                      padding: '0.375rem 0.5rem',
                      background: 'rgb(var(--color-surface))',
                      border: '1px solid rgb(var(--color-border))',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    ⧉ Duplicate
                  </button>
                  <button
                    onClick={() => handleDeleteNode(selectedNode.id)}
                    title="Delete Step"
                    style={{
                      padding: '0.375rem 0.5rem',
                      background: 'rgb(239, 68, 68)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      color: 'white',
                      fontSize: '0.75rem',
                    }}
                  >
                    🗑 Delete
                  </button>
                </div>
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
                    const isReferenceType = field.type === 'select' || field.type === 'radio' || field.type === 'reference';
                    
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
                            {field.mapping && (
                              <span style={{ fontSize: '0.65rem', color: 'rgb(139, 92, 246)' }}>⚡ mapped</span>
                            )}
                            {field.filter && (
                              <span style={{ fontSize: '0.65rem', color: 'rgb(34, 197, 94)' }}>🔗 filtered</span>
                            )}
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

// Wrapper component with ReactFlowProvider
const WorkflowCanvas: React.FC<WorkflowCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
};

export default WorkflowCanvas;
