/**
 * Entity Graph Component (Wave 2: Cockpit Command Center)
 * 
 * Visualizes entity relationships using React Flow.
 * 
 * Features:
 * - Interactive graph visualization
 * - Zoom and pan controls
 * - Click to expand nodes
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
  className?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const GraphContainer = styled.div`
  width: 100%;
  height: 500px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;

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
  className,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  // Fetch graph data
  useEffect(() => {
    const fetchGraph = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get<GraphResponse>(
          `entities/${entityType}/${entityId}/graph/`,
          { params: { depth, max_nodes: maxNodes } }
        );

        const { nodes: graphNodes, edges: graphEdges, root, truncated: isTruncated } = response.data;

        // Layout and convert nodes
        const flowNodes = layoutNodes(graphNodes, root);
        const flowEdges = createEdges(graphEdges);

        setNodes(flowNodes);
        setEdges(flowEdges);
        setTruncated(isTruncated);
      } catch (err: any) {
        console.error('Failed to fetch entity graph:', err);
        setError(err.response?.data?.error || 'Failed to load entity graph');
      } finally {
        setLoading(false);
      }
    };

    fetchGraph();
  }, [entityType, entityId, depth, maxNodes, setNodes, setEdges]);

  // Handle node click
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<EntityNodeData>) => {
      if (onNodeClick) {
        onNodeClick(node.data.entityType, node.data.entityId);
      }
    },
    [onNodeClick]
  );

  // Default viewport centered on root
  const defaultViewport = useMemo(() => ({ x: 300, y: 50, zoom: 0.8 }), []);

  if (loading) {
    return (
      <GraphContainer className={className}>
        <LoadingOverlay>Loading entity graph...</LoadingOverlay>
      </GraphContainer>
    );
  }

  if (error) {
    return (
      <GraphContainer className={className}>
        <ErrorMessage>{error}</ErrorMessage>
      </GraphContainer>
    );
  }

  return (
    <GraphContainer className={className}>
      {truncated && (
        <TruncatedBanner>
          Graph truncated to {maxNodes} nodes. Increase depth or max_nodes to see more.
        </TruncatedBanner>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
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
  );
};

export default EntityGraph;
