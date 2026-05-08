/**
 * Auto Layout Utility
 * 
 * Automatic node positioning using dagre layout algorithm.
 * Provides beautiful, hierarchical layouts for workflow diagrams.
 * 
 * Features:
 * - Horizontal and vertical layout options
 * - Automatic spacing based on node dimensions
 * - Handles parent-child relationships with nested group layout
 * - Respects edge directions for flow
 * - Optimized for deeply nested E2E templates (20+ nodes)
 * 
 * Created: 2026-02-21 - Phase 2: UI/UX Enhancements
 * Enhanced: 2026-05-08 - PI-05: Nested group layout optimization
 */

import dagre from 'dagre';
import { Node, Edge } from '@xyflow/react';

export interface LayoutOptions {
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  nodeSpacing?: number;
  rankSpacing?: number;
  edgeSpacing?: number;
  align?: 'UL' | 'UR' | 'DL' | 'DR';
  layoutNestedGroups?: boolean;
  groupPadding?: number;
}

const DEFAULT_OPTIONS: Required<LayoutOptions> = {
  direction: 'TB', // Default Top to Bottom; callers can override
  nodeSpacing: 50,
  rankSpacing: 100,
  edgeSpacing: 20,
  align: 'UL',
  layoutNestedGroups: true,
  groupPadding: 40,
};

/**
 * Apply dagre layout to nodes and edges
 */
export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // CRITICAL FIX: dagre crashes on grouped nodes (parentId).
  // We only layout top-level nodes on the global canvas.
  const topLevelNodes = nodes.filter((n) => !n.parentId);
  const topLevelNodeIds = new Set(topLevelNodes.map((n) => n.id));

  // Only route edges where both source and target are top-level
  const topLevelEdges = edges.filter(
    (e) => topLevelNodeIds.has(e.source) && topLevelNodeIds.has(e.target)
  );

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setGraph({
    rankdir: opts.direction,
    nodesep: opts.nodeSpacing,
    ranksep: opts.rankSpacing,
    edgesep: opts.edgeSpacing,
    marginx: 50,
    marginy: 50,
  });

  dagreGraph.setDefaultEdgeLabel(() => ({}));

  topLevelNodes.forEach((node) => {
    const styleWidth = typeof (node.style as any)?.width === 'number' ? (node.style as any).width : undefined;
    const styleHeight = typeof (node.style as any)?.height === 'number' ? (node.style as any).height : undefined;

    const width = node.measured?.width ?? node.width ?? styleWidth ?? 280;
    const height = node.measured?.height ?? node.height ?? styleHeight ?? 100;

    dagreGraph.setNode(node.id, { width, height });
  });

  topLevelEdges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // Apply positions back to top-level nodes, keep child nodes unchanged
  let layoutedNodes = nodes.map((node) => {
    if (node.parentId) return node; // Skip child nodes

    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) return node;

    const styleWidth = typeof (node.style as any)?.width === 'number' ? (node.style as any).width : undefined;
    const styleHeight = typeof (node.style as any)?.height === 'number' ? (node.style as any).height : undefined;

    const width = node.measured?.width ?? node.width ?? styleWidth ?? 280;
    const height = node.measured?.height ?? node.height ?? styleHeight ?? 100;

    const x = nodeWithPosition.x - width / 2;
    const y = nodeWithPosition.y - height / 2;

    return {
      ...node,
      position: { x, y },
    };
  });

  // Layout nested groups if enabled
  if (opts.layoutNestedGroups) {
    layoutedNodes = layoutNestedChildren(layoutedNodes, edges, opts);
  }

  return {
    nodes: layoutedNodes,
    edges, // Return all edges original array
  };
};

/**
 * Layout children within their parent group nodes.
 * Uses a simplified vertical stack layout within each group container.
 */
function layoutNestedChildren(
  nodes: Node[],
  edges: Edge[],
  opts: Required<LayoutOptions>
): Node[] {
  // Find all group/container parent IDs
  const parentIds = new Set(
    nodes.filter((n) => n.parentId).map((n) => n.parentId!)
  );

  if (parentIds.size === 0) return nodes;

  const result = [...nodes];

  for (const parentId of parentIds) {
    const children = result.filter((n) => n.parentId === parentId);
    if (children.length === 0) continue;

    // Find edges between children of this parent
    const childIds = new Set(children.map((n) => n.id));
    const childEdges = edges.filter(
      (e) => childIds.has(e.source) && childIds.has(e.target)
    );

    // If there are edges, use dagre for child layout; otherwise stack vertically
    if (childEdges.length > 0 && children.length > 2) {
      const childGraph = new dagre.graphlib.Graph();
      childGraph.setGraph({
        rankdir: opts.direction,
        nodesep: opts.nodeSpacing * 0.6,
        ranksep: opts.rankSpacing * 0.7,
        marginx: opts.groupPadding,
        marginy: opts.groupPadding,
      });
      childGraph.setDefaultEdgeLabel(() => ({}));

      children.forEach((node) => {
        const width = node.measured?.width ?? node.width ?? 250;
        const height = node.measured?.height ?? node.height ?? 80;
        childGraph.setNode(node.id, { width: Number(width), height: Number(height) });
      });

      childEdges.forEach((edge) => {
        childGraph.setEdge(edge.source, edge.target);
      });

      dagre.layout(childGraph);

      // Apply child positions relative to parent
      for (const child of children) {
        const pos = childGraph.node(child.id);
        if (!pos) continue;
        const width = child.measured?.width ?? child.width ?? 250;
        const height = child.measured?.height ?? child.height ?? 80;
        const idx = result.findIndex((n) => n.id === child.id);
        if (idx >= 0) {
          result[idx] = {
            ...result[idx],
            position: {
              x: pos.x - Number(width) / 2,
              y: pos.y - Number(height) / 2,
            },
          };
        }
      }
    } else {
      // Simple vertical stack for small groups
      let yOffset = opts.groupPadding + 40; // Account for group header
      const xOffset = opts.groupPadding;

      for (const child of children) {
        const idx = result.findIndex((n) => n.id === child.id);
        if (idx >= 0) {
          result[idx] = {
            ...result[idx],
            position: { x: xOffset, y: yOffset },
          };
          const height = child.measured?.height ?? child.height ?? 80;
          yOffset += Number(height) + opts.nodeSpacing * 0.5;
        }
      }
    }
  }

  return result;
}

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
