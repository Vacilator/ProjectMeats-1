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

  // Rollback: Force all legacy Form Process container variants to render as plain
  // `react-flow__node-default` (no group semantics / purple container overrides).
  if (
    node.type === 'formMultiStepContainer' ||
    node.type === 'formProcess' ||
    node.type === 'formProcessGroup' ||
    node.type === 'formBook'
  ) {
    const { parentId, extent, expandParent, ...rest } = node as any;

    return {
      ...rest,
      type: 'default',
      data: {
        ...(node.data || {}),
        label: (node.data as any)?.label ?? (node.data as any)?.containerName ?? 'Form Process',
      },
    } as Node;
  }

  // --------------------------------------------------------------------------
  // Canonicalize legacy Form types (additive/back-compat)
  // --------------------------------------------------------------------------
  // Canonical nodes:
  // - Form step: `form`
  // - Form container: `formProcessGroup` ("Form Process")
  if (node.type === 'formStep' || node.type === 'formStepSingle') {
    const canonicalType = 'form';
    const canonicalDef = NODE_TYPE_REGISTRY[canonicalType];

    return {
      ...node,
      type: canonicalType,
      data: {
        ...(node.data || {}),
        maxInputs: (node.data as any)?.maxInputs ?? canonicalDef?.maxInputs ?? 1,
        maxOutputs: (node.data as any)?.maxOutputs ?? canonicalDef?.maxOutputs ?? 1,
      },
    };
  }

  if (
    node.type === 'formMultiStepContainer' ||
    node.type === 'formProcess' ||
    node.type === 'formProcessGroup' ||
    node.type === 'formBook'
  ) {
    const canonicalType = 'formProcessGroup';
    const canonicalDef = NODE_TYPE_REGISTRY[canonicalType];

    return {
      ...node,
      type: canonicalType,
      data: {
        ...(node.data || {}),
        // Ensure group semantics are enabled
        isGroup: true,
        maxInputs: (node.data as any)?.maxInputs ?? canonicalDef?.maxInputs ?? 1,
        maxOutputs: (node.data as any)?.maxOutputs ?? canonicalDef?.maxOutputs ?? 1,
      },
    };
  }

  // Ensure strict parent bounds for any node that lives inside a container
  if (node.parentId) {
    node = {
      ...node,
      extent: node.extent || 'parent',
      expandParent: node.expandParent ?? true,
    } as Node;
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
