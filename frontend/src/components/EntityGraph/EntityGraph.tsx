/**
 * Entity Graph Component (Wave 2: Cockpit Command Center)
 * 
 * Visualizes entity relationships using React Flow.
 * 
 * Features:
 * - Interactive graph visualization
 * - Zoom and pan controls
 * - Click to select nodes
 * - Double-click to expand nodes (fetch deeper relationships)
 * - Inline edit panel for quick editing
 * - Relationship labels on edges
 * 
 * Theme Compliance:
 * - Uses CSS custom properties
 * - Entity colors from backend configuration
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  ConnectionLineType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import styled from 'styled-components';
import { X, Edit2, ExternalLink, ChevronRight } from 'lucide-react';
import { apiClient } from '../../services/apiService';
import { EntityNode, EntityNodeData } from './EntityNode';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface GraphNode {
  id: string;
  entity_id: number;
  entity_type: string;
  label: string;
  icon: string;
  color: string;
  level: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  relationship: string;
}

interface GraphResponse {
  root: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  depth: number;
  truncated: boolean;
}

export interface EntityGraphProps {
  entityType: string;
  entityId: number;
  depth?: number;
  maxNodes?: number;
  onNodeClick?: (entityType: string, entityId: number) => void;
  onNodeEdit?: (entityType: string, entityId: number) => void;
  className?: string;
}

interface SelectedNodeInfo {
  entityType: string;
  entityId: number;
  label: string;
  color: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const GraphWrapper = styled.div`
  position: relative;
  display: flex;
  width: 100%;
  height: 500px;
`;

const GraphContainer = styled.div<{ $panelOpen: boolean }>`
  flex: 1;
  height: 100%;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  border-top-right-radius: ${props => props.$panelOpen ? '0' : 'var(--radius-lg)'};
  border-bottom-right-radius: ${props => props.$panelOpen ? '0' : 'var(--radius-lg)'};
  overflow: hidden;
  transition: border-radius 0.2s ease;

  .react-flow__attribution {
    display: none;
  }
`;

const LoadingOverlay = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgb(var(--color-text-secondary));
`;

const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgb(239, 68, 68);
  padding: 2rem;
  text-align: center;
`;

const TruncatedBanner = styled.div`
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: rgb(var(--color-warning) / 0.1);
  color: rgb(var(--color-warning));
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  z-index: 10;
`;

const ExpandingIndicator = styled.div`
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: rgb(var(--color-primary) / 0.9);
  color: white;
  padding: 6px 16px;
  border-radius: var(--radius-md);
  font-size: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
`;

// ============================================================================
// Inline Edit Panel Styles
// ============================================================================

const InlineEditPanel = styled.div<{ $isOpen: boolean; $color: string }>`
  width: ${props => props.$isOpen ? '320px' : '0'};
  height: 100%;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-left: 3px solid ${props => props.$color};
  border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
  overflow: hidden;
  transition: width 0.2s ease;
`;

const PanelContent = styled.div`
  width: 320px;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const PanelHeader = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: ${props => props.$color}10;
`;

const PanelTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PanelTitleText = styled.span`
  font-weight: 600;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
`;

const PanelEntityType = styled.span<{ $color: string }>`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${props => props.$color};
  font-weight: 500;
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  
  &:hover {
    background: rgb(var(--color-background));
    color: rgb(var(--color-text-primary));
  }
`;

const PanelBody = styled.div`
  flex: 1;
  padding: 16px;
  overflow-y: auto;
`;

const PanelActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid ${props => props.$variant === 'primary' 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-border))'};
  background: ${props => props.$variant === 'primary' 
    ? 'rgb(var(--color-primary))' 
    : 'transparent'};
  color: ${props => props.$variant === 'primary' 
    ? 'white' 
    : 'rgb(var(--color-text-primary))'};
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;

  &:hover {
    background: ${props => props.$variant === 'primary' 
      ? 'rgb(var(--color-primary-hover))' 
      : 'rgb(var(--color-background))'};
  }
`;

const PanelHint = styled.div`
  padding: 16px;
  border-top: 1px solid rgb(var(--color-border));
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  text-align: center;
`;

// ============================================================================
// Layout Algorithm
// ============================================================================

const layoutNodes = (nodes: GraphNode[], root: string): Node<EntityNodeData>[] => {
  // Group nodes by level
  const levelMap = new Map<number, GraphNode[]>();
  nodes.forEach(node => {
    const level = node.level;
    if (!levelMap.has(level)) {
      levelMap.set(level, []);
    }
    levelMap.get(level)!.push(node);
  });

  const flowNodes: Node<EntityNodeData>[] = [];
  const horizontalSpacing = 220;
  const verticalSpacing = 120;

  levelMap.forEach((levelNodes, level) => {
    const totalWidth = (levelNodes.length - 1) * horizontalSpacing;
    const startX = -totalWidth / 2;

    levelNodes.forEach((node, index) => {
      flowNodes.push({
        id: node.id,
        type: 'entityNode',
        position: {
          x: startX + index * horizontalSpacing,
          y: level * verticalSpacing,
        },
        data: {
          label: node.label,
          entityType: node.entity_type,
          entityId: node.entity_id,
          icon: node.icon,
          color: node.color,
          level: node.level,
          isRoot: node.id === root,
        },
      });
    });
  });

  return flowNodes;
};

const createEdges = (edges: GraphEdge[]): Edge[] => {
  return edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: 'smoothstep',
    animated: false,
    style: { stroke: 'rgb(var(--color-border))' },
    labelStyle: { 
      fontSize: 10, 
      fill: 'rgb(var(--color-text-secondary))',
    },
    labelBgStyle: { 
      fill: 'rgb(var(--color-surface))',
      fillOpacity: 0.9,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: 'rgb(var(--color-border))',
    },
  }));
};

// ============================================================================
// Component
// ============================================================================

const nodeTypes = {
  entityNode: EntityNode,
};

export const EntityGraph: React.FC<EntityGraphProps> = ({
  entityType,
  entityId,
  depth = 1,
  maxNodes = 50,
  onNodeClick,
  onNodeEdit,
  className,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  
  // Node expansion state
  const [expandingNode, setExpandingNode] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // Inline edit panel state
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null);

  // Fetch graph data
  const fetchGraph = useCallback(async (
    fetchEntityType: string, 
    fetchEntityId: number, 
    fetchDepth: number,
    mergeWithExisting: boolean = false
  ) => {
    if (!mergeWithExisting) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await apiClient.get<GraphResponse>(
        `entities/${fetchEntityType}/${fetchEntityId}/graph/`,
        { params: { depth: fetchDepth, max_nodes: maxNodes } }
      );

      const { nodes: graphNodes, edges: graphEdges, root, truncated: isTruncated } = response.data;

      if (mergeWithExisting) {
        // Merge new nodes with existing ones (for expansion)
        setNodes(currentNodes => {
          const existingIds = new Set(currentNodes.map(n => n.id));
          const newFlowNodes = layoutNodes(graphNodes, root);
          const uniqueNewNodes = newFlowNodes.filter(n => !existingIds.has(n.id));
          return [...currentNodes, ...uniqueNewNodes];
        });
        
        setEdges(currentEdges => {
          const existingIds = new Set(currentEdges.map(e => e.id));
          const newFlowEdges = createEdges(graphEdges);
          const uniqueNewEdges = newFlowEdges.filter(e => !existingIds.has(e.id));
          return [...currentEdges, ...uniqueNewEdges];
        });
      } else {
        // Replace all nodes/edges
        const flowNodes = layoutNodes(graphNodes, root);
        const flowEdges = createEdges(graphEdges);
        setNodes(flowNodes);
        setEdges(flowEdges);
      }
      
      setTruncated(isTruncated);
    } catch (err: any) {
      console.error('Failed to fetch entity graph:', err);
      setError(err.response?.data?.error || 'Failed to load entity graph');
    } finally {
      setLoading(false);
      setExpandingNode(null);
    }
  }, [maxNodes, setNodes, setEdges]);

  // Initial load
  useEffect(() => {
    fetchGraph(entityType, entityId, depth, false);
  }, [entityType, entityId, depth, fetchGraph]);

  // Handle single click - select node and open panel
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<EntityNodeData>) => {
      setSelectedNode({
        entityType: node.data.entityType,
        entityId: node.data.entityId,
        label: node.data.label,
        color: node.data.color,
      });
      
      if (onNodeClick) {
        onNodeClick(node.data.entityType, node.data.entityId);
      }
    },
    [onNodeClick]
  );

  // Handle double click - expand node relationships
  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node<EntityNodeData>) => {
      const nodeKey = `${node.data.entityType}-${node.data.entityId}`;
      
      // Don't expand if already expanded
      if (expandedNodes.has(nodeKey)) {
        return;
      }
      
      // Mark as expanding and expanded
      setExpandingNode(nodeKey);
      setExpandedNodes(prev => new Set([...prev, nodeKey]));
      
      // Fetch deeper relationships for this node
      fetchGraph(node.data.entityType, node.data.entityId, 1, true);
    },
    [expandedNodes, fetchGraph]
  );

  // Close inline edit panel
  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Navigate to entity detail page
  const handleViewDetails = useCallback(() => {
    if (selectedNode) {
      const routes: Record<string, string> = {
        supplier: '/suppliers',
        customer: '/customers',
        purchase_order: '/purchase-orders',
        sales_order: '/sales-orders',
        product: '/products',
        contact: '/contacts',
        invoice: '/invoices',
        carrier: '/carriers',
      };
      const basePath = routes[selectedNode.entityType] || `/${selectedNode.entityType}s`;
      window.location.href = `${basePath}/${selectedNode.entityId}`;
    }
  }, [selectedNode]);

  // Handle edit action
  const handleEditEntity = useCallback(() => {
    if (selectedNode && onNodeEdit) {
      onNodeEdit(selectedNode.entityType, selectedNode.entityId);
    } else if (selectedNode) {
      // Default: navigate to edit page
      handleViewDetails();
    }
  }, [selectedNode, onNodeEdit, handleViewDetails]);

  // Default viewport centered on root
  const defaultViewport = useMemo(() => ({ x: 300, y: 50, zoom: 0.8 }), []);

  if (loading) {
    return (
      <GraphWrapper className={className}>
        <GraphContainer $panelOpen={false}>
          <LoadingOverlay>Loading entity graph...</LoadingOverlay>
        </GraphContainer>
      </GraphWrapper>
    );
  }

  if (error) {
    return (
      <GraphWrapper className={className}>
        <GraphContainer $panelOpen={false}>
          <ErrorMessage>{error}</ErrorMessage>
        </GraphContainer>
      </GraphWrapper>
    );
  }

  const panelOpen = selectedNode !== null;

  return (
    <GraphWrapper className={className}>
      <GraphContainer $panelOpen={panelOpen}>
        {truncated && (
          <TruncatedBanner>
            Graph truncated to {maxNodes} nodes. Increase depth or max_nodes to see more.
          </TruncatedBanner>
        )}
        {expandingNode && (
          <ExpandingIndicator>
            <span>Expanding relationships...</span>
          </ExpandingIndicator>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          nodeTypes={nodeTypes}
          defaultViewport={defaultViewport}
          connectionLineType={ConnectionLineType.SmoothStep}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
        >
          <Controls />
          <Background color="rgb(var(--color-border))" gap={16} />
        </ReactFlow>
      </GraphContainer>
      
      {/* Inline Edit Panel */}
      <InlineEditPanel $isOpen={panelOpen} $color={selectedNode?.color || 'rgb(var(--color-primary))'}>
        {selectedNode && (
          <PanelContent>
            <PanelHeader $color={selectedNode.color}>
              <PanelTitle>
                <div>
                  <PanelTitleText>{selectedNode.label}</PanelTitleText>
                  <br />
                  <PanelEntityType $color={selectedNode.color}>
                    {selectedNode.entityType.replace('_', ' ')}
                  </PanelEntityType>
                </div>
              </PanelTitle>
              <CloseButton onClick={handleClosePanel} title="Close panel">
                <X size={16} />
              </CloseButton>
            </PanelHeader>
            
            <PanelBody>
              <PanelActions>
                <ActionButton $variant="primary" onClick={handleEditEntity}>
                  <Edit2 size={16} />
                  Edit {selectedNode.entityType.replace('_', ' ')}
                </ActionButton>
                
                <ActionButton onClick={handleViewDetails}>
                  <ExternalLink size={16} />
                  View Details
                </ActionButton>
                
                <ActionButton 
                  onClick={() => {
                    const nodeKey = `${selectedNode.entityType}-${selectedNode.entityId}`;
                    if (!expandedNodes.has(nodeKey)) {
                      setExpandingNode(nodeKey);
                      setExpandedNodes(prev => new Set([...prev, nodeKey]));
                      fetchGraph(selectedNode.entityType, selectedNode.entityId, 1, true);
                    }
                  }}
                  disabled={expandedNodes.has(`${selectedNode.entityType}-${selectedNode.entityId}`)}
                >
                  <ChevronRight size={16} />
                  {expandedNodes.has(`${selectedNode.entityType}-${selectedNode.entityId}`) 
                    ? 'Already Expanded' 
                    : 'Expand Relationships'}
                </ActionButton>
              </PanelActions>
            </PanelBody>
            
            <PanelHint>
              💡 Double-click any node to expand its relationships
            </PanelHint>
          </PanelContent>
        )}
      </InlineEditPanel>
    </GraphWrapper>
  );
};

export default EntityGraph;
