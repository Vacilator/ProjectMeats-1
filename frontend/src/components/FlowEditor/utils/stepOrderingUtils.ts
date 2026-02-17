/**
 * Step Ordering Utilities
 * 
 * Calculate execution order of nodes within a Form Process container.
 * Uses topological sort to determine step sequence based on connections.
 * 
 * Phase B.1: Form Process Container Overhaul
 * Created: 2026-02-17
 */

import { Node, Edge } from '@xyflow/react';

/**
 * Calculate step order for child nodes in a container using topological sort
 * @param containerNodeId - The parent container node ID
 * @param allNodes - All nodes in the flow
 * @param allEdges - All edges in the flow
 * @returns Map of node ID to step number (1, 2, 3...)
 */
export function calculateStepOrder(
  containerNodeId: string,
  allNodes: Node[],
  allEdges: Edge[]
): Map<string, number> {
  // Get child nodes (nodes with this container as parent)
  const childNodes = allNodes.filter(node => node.parentId === containerNodeId);
  const childNodeIds = new Set(childNodes.map(n => n.id));
  
  // Get edges between child nodes only
  const childEdges = allEdges.filter(edge => 
    childNodeIds.has(edge.source) && childNodeIds.has(edge.target)
  );
  
  // If no children, return empty map
  if (childNodes.length === 0) {
    return new Map();
  }
  
  // If only one child, it's step 1
  if (childNodes.length === 1) {
    return new Map([[childNodes[0].id, 1]]);
  }
  
  // Build adjacency list and in-degree map for topological sort
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  
  // Initialize all child nodes
  childNodes.forEach(node => {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  });
  
  // Build graph
  childEdges.forEach(edge => {
    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });
  
  // Topological sort (Kahn's algorithm)
  const queue: string[] = [];
  const stepOrder = new Map<string, number>();
  let step = 1;
  
  // Find nodes with no incoming edges (start nodes)
  childNodes.forEach(node => {
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id);
    }
  });
  
  // If no start nodes, use position-based ordering (fallback)
  if (queue.length === 0) {
    return fallbackPositionBasedOrder(childNodes);
  }
  
  // Process nodes in topological order
  while (queue.length > 0) {
    // Process all nodes at the current level (same step)
    const levelSize = queue.length;
    const currentLevel: string[] = [];
    
    for (let i = 0; i < levelSize; i++) {
      const nodeId = queue.shift()!;
      currentLevel.push(nodeId);
      stepOrder.set(nodeId, step);
      
      // Reduce in-degree of neighbors
      const neighbors = adjacency.get(nodeId) || [];
      neighbors.forEach(neighbor => {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      });
    }
    
    step++;
  }
  
  // Handle any remaining nodes (cycles or disconnected) with position-based ordering
  const unorderedNodes = childNodes.filter(node => !stepOrder.has(node.id));
  if (unorderedNodes.length > 0) {
    const fallbackOrder = fallbackPositionBasedOrder(unorderedNodes);
    unorderedNodes.forEach(node => {
      stepOrder.set(node.id, (fallbackOrder.get(node.id) || 0) + step - 1);
    });
  }
  
  return stepOrder;
}

/**
 * Fallback ordering based on node positions (top-to-bottom, left-to-right)
 */
function fallbackPositionBasedOrder(nodes: Node[]): Map<string, number> {
  const sorted = [...nodes].sort((a, b) => {
    // Primary sort: Y position (top to bottom)
    const yDiff = (a.position.y || 0) - (b.position.y || 0);
    if (Math.abs(yDiff) > 20) { // Consider nodes on same row if Y diff < 20px
      return yDiff;
    }
    // Secondary sort: X position (left to right)
    return (a.position.x || 0) - (b.position.x || 0);
  });
  
  const orderMap = new Map<string, number>();
  sorted.forEach((node, index) => {
    orderMap.set(node.id, index + 1);
  });
  
  return orderMap;
}

/**
 * Get a display label for a step number
 * @param step - Step number (1, 2, 3...)
 * @returns Formatted label like "Step 1", "Step 2", etc.
 */
export function getStepLabel(step: number): string {
  return `Step ${step}`;
}

/**
 * Check if a node should show a step number
 * (Only form-related nodes typically show step numbers)
 */
export function shouldShowStepNumber(nodeType: string): boolean {
  const stepNumberTypes = [
    'formStepSingle',
    'formStep', // Legacy name
    'formInput',
    'formField',
    'approval',
    'review',
  ];
  
  return stepNumberTypes.includes(nodeType);
}
