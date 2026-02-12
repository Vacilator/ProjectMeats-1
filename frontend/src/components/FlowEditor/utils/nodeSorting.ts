/**
 * Node Sorting Utilities
 * 
 * Topological sorting for React Flow nodes to ensure parent-child ordering.
 * React Flow v11+ requires parent nodes to appear BEFORE their children in the nodes array.
 * 
 * Created: 2026-02-09 - Extracted from UnifiedFlowEditor.tsx
 * Related: Phase 2 Critical Fix - Parent node ordering enforcement
 */

import { Node } from '@xyflow/react';

/**
 * Sort nodes topologically to ensure parents appear before children.
 * 
 * React Flow v11+ strictly enforces parent-before-child ordering in the nodes array.
 * Violation causes runtime error: "Parent node not found. Please make sure that 
 * parent nodes are in front of their child nodes in the nodes array."
 * 
 * Algorithm:
 * 1. Build a map of nodes by ID for O(1) lookup
 * 2. Perform depth-first traversal starting from each unvisited node
 * 3. For each node, recursively add its parent first (if exists)
 * 4. Mark nodes as visited to handle cycles and prevent duplicates
 * 5. Verify ordering after sort (debug mode)
 * 
 * Complexity: O(n) where n is number of nodes
 * 
 * @param nodes - Array of React Flow nodes (possibly unsorted)
 * @returns New array with nodes sorted topologically (parents before children)
 * 
 * @example
 * ```typescript
 * const unsortedNodes = [
 *   { id: 'child-1', parentId: 'parent-1', ... },
 *   { id: 'parent-1', ... },
 * ];
 * 
 * const sortedNodes = sortNodesTopologically(unsortedNodes);
 * // Result: [{ id: 'parent-1', ... }, { id: 'child-1', parentId: 'parent-1', ... }]
 * ```
 */
export function sortNodesTopologically(nodes: Node[]): Node[] {
  // Handle empty or null input
  if (!nodes || nodes.length === 0) {
    return nodes;
  }

  // Filter out null/undefined entries (defensive - handles corrupt data from DB/JSON)
  const validNodes = nodes.filter(node => node != null && typeof node === 'object' && node.id);
  
  if (validNodes.length === 0) {
    console.warn('[Node Sort] No valid nodes found after filtering null/undefined entries');
    return [];
  }
  
  if (validNodes.length !== nodes.length) {
    console.warn(`[Node Sort] Filtered out ${nodes.length - validNodes.length} null/undefined nodes`);
  }

  // Build a map of node IDs for quick lookup
  const nodeMap = new Map<string, Node>();
  validNodes.forEach(node => nodeMap.set(node.id, node));

  // Track visited nodes to detect cycles
  const visited = new Set<string>();
  const sorted: Node[] = [];

  /**
   * Recursive helper: Add node and its parents to sorted array.
   * Ensures parent is added before child.
   */
  function addNodeWithParents(nodeId: string) {
    // Skip if already visited (prevents infinite loops from cycles)
    if (visited.has(nodeId)) {
      return;
    }

    const node = nodeMap.get(nodeId);
    if (!node) {
      console.warn(`[Node Sort] Node ${nodeId} not found in map (orphaned reference)`);
      return;
    }

    // Mark as visited BEFORE processing parent to handle cycles
    visited.add(nodeId);

    // If node has a parent, recursively add parent first
    if (node.parentId) {
      addNodeWithParents(node.parentId);
    }

    // Add this node to sorted array (after parent, if any)
    sorted.push(node);
  }

  // Process all nodes, starting with unvisited ones
  validNodes.forEach(node => {
    if (!visited.has(node.id)) {
      addNodeWithParents(node.id);
    }
  });

  // Verify ordering in debug mode (can be disabled in production)
  if (process.env.NODE_ENV !== 'production') {
    verifyNodeOrdering(sorted);
  }

  return sorted;
}

/**
 * Verify that nodes are correctly ordered (parents before children).
 * Logs errors if ordering is violated.
 * 
 * @param nodes - Sorted nodes array to verify
 * @returns true if ordering is correct, false otherwise
 */
function verifyNodeOrdering(nodes: Node[]): boolean {
  // Build index map for quick lookup
  const nodeIndices = new Map<string, number>();
  nodes.forEach((node, index) => {
    nodeIndices.set(node.id, index);
  });

  let hasOrderingError = false;

  // Check each node with a parent
  nodes.forEach((node, index) => {
    if (node.parentId) {
      const parentIndex = nodeIndices.get(node.parentId);
      
      if (parentIndex === undefined) {
        console.error(
          `[Node Sort] ❌ Parent ${node.parentId} of node ${node.id} not found in sorted array`
        );
        hasOrderingError = true;
      } else if (parentIndex >= index) {
        console.error(
          `[Node Sort] ❌ Parent ${node.parentId} at index ${parentIndex} must come before child ${node.id} at index ${index}`
        );
        hasOrderingError = true;
      }
    }
  });

  if (hasOrderingError) {
    console.error('[Node Sort] ❌ Sorting failed - parent-child ordering violated');
  } else {
    console.log(`[Node Sort] ✅ Successfully sorted ${nodes.length} nodes`);
  }

  return !hasOrderingError;
}

/**
 * Find all root nodes (nodes without parents).
 * Useful for identifying top-level nodes in a hierarchy.
 * 
 * @param nodes - Array of nodes
 * @returns Array of nodes that have no parentId
 */
export function findRootNodes(nodes: Node[]): Node[] {
  return nodes.filter(node => !node.parentId);
}

/**
 * Find all children of a specific node.
 * 
 * @param nodes - Array of all nodes
 * @param parentId - ID of parent node
 * @returns Array of child nodes
 */
export function findChildNodes(nodes: Node[], parentId: string): Node[] {
  return nodes.filter(node => node.parentId === parentId);
}

/**
 * Build a tree structure from flat node array.
 * Useful for hierarchical rendering or analysis.
 * 
 * @param nodes - Array of nodes
 * @returns Map of parent IDs to their children
 */
export function buildNodeHierarchy(nodes: Node[]): Map<string, Node[]> {
  const hierarchy = new Map<string, Node[]>();
  
  nodes.forEach(node => {
    if (node.parentId) {
      const siblings = hierarchy.get(node.parentId) || [];
      siblings.push(node);
      hierarchy.set(node.parentId, siblings);
    }
  });
  
  return hierarchy;
}

/**
 * Check if a node has any children.
 * 
 * @param nodes - Array of all nodes
 * @param nodeId - ID of node to check
 * @returns true if node has children
 */
export function hasChildren(nodes: Node[], nodeId: string): boolean {
  return nodes.some(node => node.parentId === nodeId);
}

/**
 * Get the depth of a node in the hierarchy (distance from root).
 * Root nodes have depth 0, their children have depth 1, etc.
 * 
 * @param nodes - Array of all nodes
 * @param nodeId - ID of node to check
 * @returns Depth of node, or -1 if node not found
 */
export function getNodeDepth(nodes: Node[], nodeId: string): number {
  const nodeMap = new Map<string, Node>();
  nodes.forEach(node => nodeMap.set(node.id, node));
  
  const node = nodeMap.get(nodeId);
  if (!node) {
    return -1;
  }
  
  let depth = 0;
  let current = node;
  
  while (current.parentId) {
    const parent = nodeMap.get(current.parentId);
    if (!parent) {
      console.warn(`[Node Depth] Orphaned node ${current.id} has parent ${current.parentId} that doesn't exist`);
      break;
    }
    depth++;
    current = parent;
    
    // Prevent infinite loop from cycles
    if (depth > nodes.length) {
      console.error(`[Node Depth] Cycle detected in hierarchy for node ${nodeId}`);
      return -1;
    }
  }
  
  return depth;
}
