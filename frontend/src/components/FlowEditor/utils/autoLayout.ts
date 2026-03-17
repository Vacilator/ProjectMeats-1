/**
 * Auto Layout Utility
 * 
 * Automatic node positioning using dagre layout algorithm.
 * Provides beautiful, hierarchical layouts for workflow diagrams.
 * 
 * Features:
 * - Horizontal and vertical layout options
 * - Automatic spacing based on node dimensions
 * - Handles parent-child relationships
 * - Respects edge directions for flow
 * 
 * Created: 2026-02-21 - Phase 2: UI/UX Enhancements
 */

import dagre from 'dagre';
import { Node, Edge } from '@xyflow/react';

export interface LayoutOptions {
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  nodeSpacing?: number;
  rankSpacing?: number;
  edgeSpacing?: number;
  align?: 'UL' | 'UR' | 'DL' | 'DR';
}

const DEFAULT_OPTIONS: Required<Omit<LayoutOptions, 'direction'>> & { direction: 'TB' } = {
  direction: 'TB', // Force Top to Bottom
  nodeSpacing: 50,
  rankSpacing: 100,
  edgeSpacing: 20,
  align: 'UL',
};

/**
 * Apply dagre layout to nodes and edges
 */
export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } => {
  const opts = { ...DEFAULT_OPTIONS, ...options, direction: 'TB' };
  
  // Create a new dagre graph
  const dagreGraph = new dagre.graphlib.Graph();
  
  // Set graph options
  dagreGraph.setGraph({
    rankdir: 'TB',
    align: opts.align,
    ranker: 'longest-path',
    nodesep: opts.nodeSpacing,
    ranksep: opts.rankSpacing,
    edgesep: opts.edgeSpacing,
    marginx: 80,
    marginy: 80,
  });
  
  // Default edge config
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // Add nodes to dagre
  nodes.forEach((node) => {
    // Use measured dimensions or defaults
    const width = node.width || 280;
    const height = node.height || 100;
    
    dagreGraph.setNode(node.id, {
      width,
      height,
    });
  });
  
  // Add edges to dagre
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });
  
  // Calculate layout
  dagre.layout(dagreGraph);
  
  // Apply calculated positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    // Dagre gives center positions, React Flow uses top-left
    const x = nodeWithPosition.x - (node.width || 280) / 2;
    const y = nodeWithPosition.y - (node.height || 100) / 2;
    
    return {
      ...node,
      position: { x, y },
    };
  });
  
  // Center align graph horizontally for consistent top-to-bottom layout
  const minX = Math.min(...layoutedNodes.map((n) => n.position.x));
  const maxX = Math.max(...layoutedNodes.map((n) => n.position.x + (n.width || 280)));
  const centerOffset = (minX + maxX) / 2;

  const alignedNodes = layoutedNodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x - centerOffset,
      y: node.position.y,
    },
  }));

  const normalizedMinX = Math.min(...alignedNodes.map((n) => n.position.x));
  const normalizedNodes = alignedNodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x - normalizedMinX + 50, // add slight margin for viewport
      y: node.position.y,
    },
  }));

  return {
    nodes: normalizedNodes,
    edges,
  };
};

/**
 * Layout only selected nodes while keeping others in place
 */
export const layoutSelectedNodes = (
  allNodes: Node[],
  edges: Edge[],
  selectedNodeIds: string[],
  options: LayoutOptions = {}
): Node[] => {
  if (selectedNodeIds.length === 0) {
    return allNodes;
  }
  
  // Filter to selected nodes and their connecting edges
  const selectedNodes = allNodes.filter(n => selectedNodeIds.includes(n.id));
  const relevantEdges = edges.filter(
    e => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
  );
  
  // Layout just the selected subgraph
  const { nodes: layoutedSelected } = getLayoutedElements(
    selectedNodes,
    relevantEdges,
    options
  );
  
  // Merge back with unselected nodes
  return allNodes.map(node => {
    const layouted = layoutedSelected.find(n => n.id === node.id);
    return layouted || node;
  });
};

/**
 * Auto-align nodes horizontally
 */
export const alignNodesHorizontally = (
  nodes: Node[],
  alignment: 'left' | 'center' | 'right' = 'center'
): Node[] => {
  if (nodes.length === 0) return nodes;
  
  // Calculate target X based on alignment
  let targetX: number;
  
  if (alignment === 'left') {
    targetX = Math.min(...nodes.map(n => n.position.x));
  } else if (alignment === 'right') {
    targetX = Math.max(...nodes.map(n => n.position.x + (n.width || 280)));
  } else {
    // Center alignment
    const leftMost = Math.min(...nodes.map(n => n.position.x));
    const rightMost = Math.max(...nodes.map(n => n.position.x + (n.width || 280)));
    targetX = (leftMost + rightMost) / 2;
  }
  
  return nodes.map(node => ({
    ...node,
    position: {
      x: alignment === 'center'
        ? targetX - (node.width || 280) / 2
        : alignment === 'left'
        ? targetX
        : targetX - (node.width || 280),
      y: node.position.y,
    },
  }));
};

/**
 * Auto-align nodes vertically
 */
export const alignNodesVertically = (
  nodes: Node[],
  alignment: 'top' | 'middle' | 'bottom' = 'middle'
): Node[] => {
  if (nodes.length === 0) return nodes;
  
  // Calculate target Y based on alignment
  let targetY: number;
  
  if (alignment === 'top') {
    targetY = Math.min(...nodes.map(n => n.position.y));
  } else if (alignment === 'bottom') {
    targetY = Math.max(...nodes.map(n => n.position.y + (n.height || 100)));
  } else {
    // Middle alignment
    const topMost = Math.min(...nodes.map(n => n.position.y));
    const bottomMost = Math.max(...nodes.map(n => n.position.y + (n.height || 100)));
    targetY = (topMost + bottomMost) / 2;
  }
  
  return nodes.map(node => ({
    ...node,
    position: {
      x: node.position.x,
      y: alignment === 'middle'
        ? targetY - (node.height || 100) / 2
        : alignment === 'top'
        ? targetY
        : targetY - (node.height || 100),
    },
  }));
};

/**
 * Distribute nodes evenly horizontally
 */
export const distributeNodesHorizontally = (nodes: Node[]): Node[] => {
  if (nodes.length < 3) return nodes;
  
  // Sort by X position
  const sorted = [...nodes].sort((a, b) => a.position.x - b.position.x);
  
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalSpace = last.position.x - first.position.x;
  const spacing = totalSpace / (sorted.length - 1);
  
  return nodes.map(node => {
    const index = sorted.findIndex(n => n.id === node.id);
    return {
      ...node,
      position: {
        x: first.position.x + (spacing * index),
        y: node.position.y,
      },
    };
  });
};

/**
 * Distribute nodes evenly vertically
 */
export const distributeNodesVertically = (nodes: Node[]): Node[] => {
  if (nodes.length < 3) return nodes;
  
  // Sort by Y position
  const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y);
  
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalSpace = last.position.y - first.position.y;
  const spacing = totalSpace / (sorted.length - 1);
  
  return nodes.map(node => {
    const index = sorted.findIndex(n => n.id === node.id);
    return {
      ...node,
      position: {
        x: node.position.x,
        y: first.position.y + (spacing * index),
      },
    };
  });
};
