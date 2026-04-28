/**
 * RelationMindMap Component
 * 
 * Visual mind-map style explorer for entity relationships.
 * Shows branching connections between entities with expandable nodes.
 * 
 * Features:
 * - Visual graph layout using react-flow
 * - Expandable nodes for continuous exploration
 * - Breadcrumb integration
 * - Smooth animations
 * - Hover previews
 * 
 * Created: 2026-02-24 - Cockpit Search Enhancement
 */

import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import { 
  Building2, Users, ShoppingCart, Receipt, Package, 
  Truck, User, FileText, Phone, Loader,
  Plus, X 
} from 'lucide-react';
import { businessApi } from '../../services/businessApi';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface RelationMindMapProps {
  /** Root entity to start exploration from */
  entityType: string;
  entityId: number | string;
  entityName: string;
  /** Callback when a related entity is clicked */
  onEntityClick?: (type: string, id: string, name: string) => void;
  /** Max depth of expansion */
  maxDepth?: number;
}

interface MindMapNode {
  id: string;
  entityType: string;
  entityId: string;
  name: string;
  count?: number;
  relationName?: string;
  depth: number;
  expanded: boolean;
}

interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  relationship?: string;
}


// ============================================================================
// Icon Mapping
// ============================================================================

const ENTITY_ICONS: Record<string, React.ComponentType<any>> = {
  supplier: Building2,
  customer: Users,
  contact: User,
  purchase_order: ShoppingCart,
  sales_order: Receipt,
  product: Package,
  shipment: Truck,
  call: Phone,
  workform: FileText,
};

const getEntityIcon = (type: string) => {
  return ENTITY_ICONS[type] || FileText;
};

// ============================================================================
// Custom Node Component
// ============================================================================

const CustomNodeContainer = styled(motion.div)<{ $depth: number; $expanded: boolean }>`
  padding: 12px 16px;
  background: ${props => props.$depth === 0 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-surface))'};
  border: 2px solid ${props => props.$expanded 
    ? 'rgb(var(--color-primary))' 
    : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-width: 180px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 4px 12px rgba(var(--color-primary-rgb), 0.2);
    transform: translateY(-2px);
  }
`;

const NodeHeader = styled.div<{ $isRoot: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  color: ${props => props.$isRoot 
    ? 'white' 
    : 'rgb(var(--color-text-primary))'};
`;

const NodeTitle = styled.div<{ $isRoot: boolean }>`
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.$isRoot 
    ? 'white' 
    : 'rgb(var(--color-text-primary))'};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const NodeSubtitle = styled.div<{ $isRoot: boolean }>`
  font-size: 12px;
  color: ${props => props.$isRoot 
    ? 'rgba(255, 255, 255, 0.8)' 
    : 'rgb(var(--color-text-secondary))'};
`;

const NodeCount = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-tertiary));
  margin-top: 4px;
`;

const ExpandButton = styled.button`
  position: absolute;
  bottom: -10px;
  right: -10px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--color-primary));
  border: 2px solid rgb(var(--color-surface));
  border-radius: 50%;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    transform: scale(1.1);
    box-shadow: 0 2px 8px rgba(var(--color-primary-rgb), 0.4);
  }
`;

const CustomNode: React.FC<{
  data: MindMapNode & {
    onExpand?: () => void;
    onCollapse?: () => void;
  };
}> = ({ data }) => {
  const Icon = getEntityIcon(data.entityType);
  const isRoot = data.depth === 0;
  
  return (
    <CustomNodeContainer
      $depth={data.depth}
      $expanded={data.expanded}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <NodeHeader $isRoot={isRoot}>
        <Icon size={18} />
        <NodeTitle $isRoot={isRoot}>{data.name}</NodeTitle>
      </NodeHeader>
      
      <NodeSubtitle $isRoot={isRoot}>
        {data.entityType.replace('_', ' ')}
      </NodeSubtitle>
      
      {data.count !== undefined && data.count > 0 && (
        <NodeCount>{data.count} items</NodeCount>
      )}
      
      {data.count !== undefined && data.count > 0 && data.onExpand && data.onCollapse && (
        <ExpandButton
          onClick={(e) => {
            e.stopPropagation();
            if (data.expanded) {
              data.onCollapse?.();
            } else {
              data.onExpand?.();
            }
          }}
        >
          {data.expanded ? <X size={14} /> : <Plus size={14} />}
        </ExpandButton>
      )}
    </CustomNodeContainer>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  width: 100%;
  height: 500px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-md);
  border: 1px solid rgb(var(--color-border));
  overflow: hidden;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--color-background-rgb), 0.8);
  z-index: 10;
`;

// ============================================================================
// Layout Calculation
// ============================================================================

const calculateTreeLayout = (
  nodes: MindMapNode[],
  nodeWidth: number = 200,
  nodeHeight: number = 80,
  levelGap: number = 250,
  siblingGap: number = 100
): Record<string, { x: number; y: number }> => {
  const positions: Record<string, { x: number; y: number }> = {};
  const levelNodes: Record<number, MindMapNode[]> = {};
  
  // Group nodes by depth
  nodes.forEach(node => {
    if (!levelNodes[node.depth]) {
      levelNodes[node.depth] = [];
    }
    levelNodes[node.depth].push(node);
  });
  
  // Position nodes level by level
  Object.keys(levelNodes).forEach(depthStr => {
    const depth = parseInt(depthStr);
    const nodesAtLevel = levelNodes[depth];
    const totalWidth = (nodesAtLevel.length - 1) * (nodeWidth + siblingGap);
    const startX = -totalWidth / 2;
    
    nodesAtLevel.forEach((node, index) => {
      positions[node.id] = {
        x: startX + index * (nodeWidth + siblingGap),
        y: depth * levelGap,
      };
    });
  });
  
  return positions;
};

// ============================================================================
// Main Component
// ============================================================================

export const RelationMindMap: React.FC<RelationMindMapProps> = ({
  entityType,
  entityId,
  entityName,
  onEntityClick,
  maxDepth = 2,
}) => {
  const [mindMapNodes, setMindMapNodes] = useState<MindMapNode[]>([]);
  const [mindMapEdges, setMindMapEdges] = useState<MindMapEdge[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadGraph = async () => {
      setLoading(true);
      try {
        const response = await businessApi.get(`/entities/${entityType}/${entityId}/graph/`, {
          params: {
            depth: Math.min(maxDepth, 3),
            max_nodes: 60,
          },
        });

        if (cancelled) return;

        const payload = response.data ?? {};
        const fetchedNodes = Array.isArray(payload.nodes) ? payload.nodes : [];
        const fetchedEdges = Array.isArray(payload.edges) ? payload.edges : [];

        setMindMapNodes(
          fetchedNodes.map((node: any) => ({
            id: String(node.id),
            entityType: String(node.entity_type ?? entityType),
            entityId: String(node.entity_id ?? entityId),
            name: String(node.label ?? node.name ?? entityName),
            depth: Number(node.level ?? 0),
            expanded: true,
          }))
        );
        setMindMapEdges(
          fetchedEdges.map((edge: any) => ({
            id: String(edge.id),
            source: String(edge.source),
            target: String(edge.target),
            relationship: typeof edge.relationship === 'string' ? edge.relationship : undefined,
          }))
        );
      } catch (error) {
        if (cancelled) return;
        setMindMapNodes([
          {
            id: `${entityType}:${entityId}`,
            entityType,
            entityId: String(entityId),
            name: entityName,
            depth: 0,
            expanded: true,
          },
        ]);
        setMindMapEdges([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadGraph();

    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, entityName, maxDepth]);

  useEffect(() => {
    const positions = calculateTreeLayout(mindMapNodes);
    
    const flowNodes: Node[] = mindMapNodes.map(node => ({
      id: node.id,
      type: 'custom',
      position: positions[node.id] || { x: 0, y: 0 },
      data: {
        ...node,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    }));
    
    const flowEdges: Edge[] = mindMapEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: true,
      label: edge.relationship ? edge.relationship.replace(/_/g, ' ') : undefined,
      style: { stroke: 'rgb(var(--color-primary))', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'rgb(var(--color-primary))',
      },
    }));
    
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [mindMapEdges, mindMapNodes, setEdges, setNodes]);
  
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const data = node.data as unknown as MindMapNode;
      if (onEntityClick) {
        onEntityClick(data.entityType, data.entityId, data.name);
      }
    },
    [onEntityClick]
  );
  
  return (
    <Container>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background variant={BackgroundVariant.Dots} />
        <Controls />
      </ReactFlow>
      
      {loading && (
        <LoadingOverlay>
          <Loader size={40} style={{ animation: 'spin 1s linear infinite' }} />
        </LoadingOverlay>
      )}
    </Container>
  );
};

export default RelationMindMap;
