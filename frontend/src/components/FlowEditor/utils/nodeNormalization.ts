/**
 * Node Normalization Utilities
 * 
 * Utilities for normalizing nodes loaded from database to ensure
 * they have required maxInputs/maxOutputs properties.
 * 
 * Extracted from UnifiedFlowEditor to enable testing without
 * importing the main component (which has React hooks).
 * 
 * Created: 2026-02-21
 */
import { Node } from '@xyflow/react';
import { NODE_TYPE_REGISTRY } from '../nodeTypes';

/**
 * Normalize a single node's data to include maxInputs and maxOutputs.
 * 
 * @param node - The node to normalize
 * @returns A new node with normalized data (does not mutate original)
 */
export function normalizeNodeData(node: Node): Node {
  // If node has no type, return as-is
  if (!node.type) {
    return node;
  }
  
  // Get node type definition
  const nodeTypeDef = NODE_TYPE_REGISTRY[node.type];
  
  // If unknown type, return as-is
  if (!nodeTypeDef) {
    return node;
  }
  
  // Create new node with normalized data
  return {
    ...node,
    data: {
      ...node.data,
      maxInputs: node.data?.maxInputs ?? nodeTypeDef.maxInputs ?? 1,
      maxOutputs: node.data?.maxOutputs ?? nodeTypeDef.maxOutputs ?? 1,
    },
  };
}

/**
 * Normalize an array of nodes.
 * 
 * @param nodes - The nodes to normalize
 * @returns A new array of normalized nodes (does not mutate originals)
 */
export function normalizeNodes(nodes: Node[]): Node[] {
  return nodes.map(normalizeNodeData);
}
