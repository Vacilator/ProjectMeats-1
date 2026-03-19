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

const DEFAULT_OPTIONS: Required<LayoutOptions> = {
  direction: 'TB', // Default Top to Bottom; callers can override
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
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const getDims = (node: Node) => {
    const width = (node.measured as any)?.width ?? node.width ?? (node.style as any)?.width ?? 280;
    const height = (node.measured as any)?.height ?? node.height ?? (node.style as any)?.height ?? 100;
    return { width: typeof width === 'number' ? width : 280, height: typeof height === 'number' ? height : 100 };
  };

  const layoutDagre = (
    inputNodes: Node[],
    inputEdges: Edge[],
    normalize: { x: number; y: number }
  ) => {
    const dagreGraph = new dagre.graphlib.Graph({ compound: true });
    dagreGraph.setGraph({
      // Phase 10: Always Top-to-Bottom for compound clusters
      rankdir: 'TB',
      align: opts.align,
      ranker: 'longest-path',
      nodesep: opts.nodeSpacing,
      ranksep: opts.rankSpacing,
      edgesep: opts.edgeSpacing,
      marginx: 80,
      marginy: 80,
    });
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const nodeById = new Map<string, Node>();
    inputNodes.forEach((n) => {
      nodeById.set(n.id, n);
      const { width, height } = getDims(n);
      dagreGraph.setNode(n.id, { width, height });
    });

    // Compound graph: attach children to their parent formProcessGroup nodes
    inputNodes.forEach((n) => {
      if (!n.parentId) return;
      const parent = nodeById.get(n.parentId);
      if (!parent) return;
      if (parent.type !== 'formProcessGroup') return;
      dagreGraph.setParent(n.id, parent.id);
    });

    inputEdges.forEach((e) => {
      if (!dagreGraph.hasNode(e.source) || !dagreGraph.hasNode(e.target)) return;
      dagreGraph.setEdge(e.source, e.target);
    });

    dagre.layout(dagreGraph);

    const absTopLeft = new Map<string, { x: number; y: number }>();

    // Pass 1: compute absolute top-left positions for all nodes
    inputNodes.forEach((n) => {
      const p = dagreGraph.node(n.id);
      const { width, height } = getDims(n);
      absTopLeft.set(n.id, {
        x: p.x - width / 2,
        y: p.y - height / 2,
      });
    });

    const isRootLike = (n: Node) => {
      if (!n.parentId) return true;
      const parent = nodeById.get(n.parentId);
      return !(parent && parent.type === 'formProcessGroup');
    };

    // Pass 2: convert compound children into parent-relative coordinates
    const laidOut = inputNodes.map((n) => {
      const pos = absTopLeft.get(n.id) ?? { x: 0, y: 0 };

      if (n.parentId) {
        const parent = nodeById.get(n.parentId);
        if (parent && parent.type === 'formProcessGroup') {
          const parentAbs = absTopLeft.get(parent.id);
          if (parentAbs) {
            return {
              ...n,
              position: {
                x: pos.x - parentAbs.x,
                y: pos.y - parentAbs.y,
              },
            };
          }
        }
      }

      return {
        ...n,
        position: pos,
      };
    });

    // Normalize only root-level nodes. Child nodes are relative to their parent.
    const rootNodes = laidOut.filter(isRootLike);
    const minX = Math.min(...rootNodes.map((n) => n.position.x));
    const minY = Math.min(...rootNodes.map((n) => n.position.y));

    return laidOut.map((n) => {
      if (!isRootLike(n)) return n;
      return {
        ...n,
        position: {
          x: n.position.x - minX + normalize.x,
          y: n.position.y - minY + normalize.y,
        },
      };
    });
  };

  const PADDING_X = 30;
  const PADDING_Y = 30;
  const HEADER_HEIGHT = 60;
  const MIN_CONTAINER_WIDTH = 500;
  const MIN_CONTAINER_HEIGHT = 300;

  // Phase 10: Single-pass compound layout across the whole graph.
  // Dagre routes edges that leave and re-enter compound parents.
  const laidOutAll = layoutDagre(nodes, edges, { x: 50, y: 50 });

  // Update container dimensions to comfortably fit their children.
  const byId = new Map<string, Node>(laidOutAll.map((n) => [n.id, n]));

  for (const parent of laidOutAll) {
    if (parent.type !== 'formProcessGroup') continue;

    const children = laidOutAll.filter((n) => n.parentId === parent.id);
    if (children.length === 0) {
      // Keep a sensible minimum size for empty containers
      byId.set(parent.id, {
        ...parent,
        style: {
          ...(parent.style as any),
          width: Math.max(MIN_CONTAINER_WIDTH, (parent.style as any)?.width || 0),
          height: Math.max(MIN_CONTAINER_HEIGHT, (parent.style as any)?.height || 0),
        },
      });
      continue;
    }

    let maxRight = 0;
    let maxBottom = 0;

    for (const c of children) {
      const { width, height } = getDims(c);
      maxRight = Math.max(maxRight, c.position.x + width);
      maxBottom = Math.max(maxBottom, c.position.y + height);
    }

    const containerWidth = Math.max(MIN_CONTAINER_WIDTH, maxRight + PADDING_X);
    const containerHeight = Math.max(MIN_CONTAINER_HEIGHT, maxBottom + PADDING_Y + HEADER_HEIGHT);

    byId.set(parent.id, {
      ...parent,
      style: {
        ...(parent.style as any),
        width: containerWidth,
        height: containerHeight,
      },
    });

    // Apply consistent inset within the container for readability
    for (const c of children) {
      byId.set(c.id, {
        ...c,
        position: {
          x: c.position.x + PADDING_X,
          y: c.position.y + HEADER_HEIGHT + PADDING_Y,
        },
      });
    }
  }

  // Merge back into original order (order-preserving)
  const merged = nodes.map((n) => byId.get(n.id) ?? n);

  return {
    nodes: merged,
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
