/**
 * Connection Validator Utility
 * Phase 7.2: Visual Connection Indicators
 *
 * Validates workflow connections and provides visual feedback:
 * - Type compatibility checking
 * - Circular dependency detection
 * - Dangling connection detection
 * - Connection recommendations
 *
 * Created: 2026-02-27
 */

import { Node, Edge } from '@xyflow/react';
import { ConnectionStatus } from '../edges/EnhancedConnectionEdge';

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  /** Is the connection valid? */
  valid: boolean;
  /** Validation status */
  status: ConnectionStatus;
  /** Human-readable message */
  message: string;
  /** Optional suggestion */
  suggestion?: string;
}

export interface ConnectionRule {
  /** Source node type */
  sourceType: string;
  /** Target node type */
  targetType: string;
  /** Is this connection allowed? */
  allowed: boolean;
  /** Optional warning message */
  warning?: string;
}

// ============================================================================
// Connection Rules
// ============================================================================

/**
 * Default connection compatibility rules.
 * Defines which node types can connect to which.
 */
const DEFAULT_CONNECTION_RULES: ConnectionRule[] = [
  // Triggers can only be source
  { sourceType: 'trigger', targetType: '*', allowed: true },
  { sourceType: '*', targetType: 'trigger', allowed: false },

  // Forms flow to actions
  { sourceType: 'form', targetType: 'action', allowed: true },
  { sourceType: 'form', targetType: 'wait', allowed: true },
  { sourceType: 'form', targetType: 'condition', allowed: true },

  // Conditions split flow
  { sourceType: 'condition', targetType: '*', allowed: true },

  // Actions can chain
  { sourceType: 'action', targetType: 'action', allowed: true },
  { sourceType: 'action', targetType: 'wait', allowed: true },
  { sourceType: 'action', targetType: 'terminal', allowed: true },

  // Wait states flow to actions
  { sourceType: 'wait', targetType: 'action', allowed: true },
  { sourceType: 'wait', targetType: 'condition', allowed: true },

  // Terminals are endpoints
  { sourceType: 'terminal', targetType: '*', allowed: false },
  { sourceType: '*', targetType: 'terminal', allowed: true },

  // Loops can contain anything
  { sourceType: 'loop', targetType: '*', allowed: true },
  { sourceType: '*', targetType: 'loop', allowed: true },

  // Containers pass through
  { sourceType: 'container', targetType: '*', allowed: true },
  { sourceType: '*', targetType: 'container', allowed: true },
];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if a connection is type-compatible
 */
export function validateConnectionType(
  sourceNode: Node,
  targetNode: Node,
  rules: ConnectionRule[] = DEFAULT_CONNECTION_RULES
): ValidationResult {
  const sourceType = sourceNode.type || 'default';
  const targetType = targetNode.type || 'default';

  // Find applicable rule
  const exactRule = rules.find(
    (r) => r.sourceType === sourceType && r.targetType === targetType
  );

  const wildcardSourceRule = rules.find(
    (r) => r.sourceType === '*' && r.targetType === targetType
  );

  const wildcardTargetRule = rules.find(
    (r) => r.sourceType === sourceType && r.targetType === '*'
  );

  const rule = exactRule || wildcardSourceRule || wildcardTargetRule;

  if (!rule || rule.allowed) {
    if (rule?.warning) {
      return {
        valid: true,
        status: 'warning',
        message: rule.warning,
      };
    }
    return {
      valid: true,
      status: 'valid',
      message: 'Connection is valid',
    };
  }

  return {
    valid: false,
    status: 'invalid',
    message: `Cannot connect ${sourceType} to ${targetType}`,
    suggestion: `Try connecting to a different node type`,
  };
}

/**
 * Detect circular dependencies in the graph
 */
export function detectCircularDependency(
  sourceNodeId: string,
  targetNodeId: string,
  edges: Edge[]
): ValidationResult {
  // Build adjacency list
  const graph = new Map<string, string[]>();
  [...edges, { source: sourceNodeId, target: targetNodeId }].forEach((edge) => {
    if (!graph.has(edge.source)) {
      graph.set(edge.source, []);
    }
    graph.get(edge.source)!.push(edge.target);
  });

  // DFS to detect cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    if (!visited.has(nodeId)) {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && hasCycle(neighbor)) {
          return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  if (hasCycle(targetNodeId)) {
    return {
      valid: false,
      status: 'invalid',
      message: 'This connection creates a circular loop',
      suggestion: 'Remove the connection or restructure your workflow',
    };
  }

  return {
    valid: true,
    status: 'valid',
    message: 'No circular dependencies detected',
  };
}

/**
 * Check for dangling connections (nodes with no inputs or outputs)
 */
export function validateNodeConnectivity(
  nodeId: string,
  nodeType: string,
  edges: Edge[]
): ValidationResult {
  const hasIncoming = edges.some((e) => e.target === nodeId);
  const hasOutgoing = edges.some((e) => e.source === nodeId);

  // Triggers don't need incoming
  if (nodeType === 'trigger' && !hasIncoming) {
    return {
      valid: true,
      status: 'info',
      message: 'Trigger node - no incoming connections needed',
    };
  }

  // Terminals don't need outgoing
  if (nodeType === 'terminal' && !hasOutgoing) {
    return {
      valid: true,
      status: 'info',
      message: 'Terminal node - no outgoing connections needed',
    };
  }

  // Check for orphans
  if (!hasIncoming && !hasOutgoing) {
    return {
      valid: false,
      status: 'warning',
      message: 'Node has no connections',
      suggestion: 'Connect this node to your workflow',
    };
  }

  // Check for dead ends (non-terminal with no output)
  if (hasIncoming && !hasOutgoing && nodeType !== 'terminal') {
    return {
      valid: false,
      status: 'warning',
      message: 'Node has no outgoing connections',
      suggestion: 'Add a connection or use a terminal node',
    };
  }

  // Check for disconnected inputs
  if (hasOutgoing && !hasIncoming && nodeType !== 'trigger') {
    return {
      valid: false,
      status: 'warning',
      message: 'Node has no incoming connections',
      suggestion: 'Connect this node to a trigger or previous step',
    };
  }

  return {
    valid: true,
    status: 'valid',
    message: 'Node is properly connected',
  };
}

/**
 * Validate a complete workflow
 */
export function validateWorkflow(
  nodes: Node[],
  edges: Edge[]
): Map<string, ValidationResult> {
  const results = new Map<string, ValidationResult>();

  // Validate each edge
  edges.forEach((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    if (!sourceNode || !targetNode) {
      results.set(edge.id, {
        valid: false,
        status: 'invalid',
        message: 'Connected node not found',
      });
      return;
    }

    // Type compatibility
    const typeResult = validateConnectionType(sourceNode, targetNode);
    if (!typeResult.valid) {
      results.set(edge.id, typeResult);
      return;
    }

    // Circular dependency
    const circularResult = detectCircularDependency(edge.source, edge.target, edges);
    if (!circularResult.valid) {
      results.set(edge.id, circularResult);
      return;
    }

    results.set(edge.id, typeResult);
  });

  // Validate each node
  nodes.forEach((node) => {
    const nodeResult = validateNodeConnectivity(
      node.id,
      node.type || 'default',
      edges
    );
    if (!nodeResult.valid || nodeResult.status === 'warning') {
      results.set(`node-${node.id}`, nodeResult);
    }
  });

  return results;
}

/**
 * Get connection recommendations for a node
 */
export function getConnectionRecommendations(
  node: Node,
  allNodes: Node[],
  rules: ConnectionRule[] = DEFAULT_CONNECTION_RULES
): Node[] {
  const nodeType = node.type || 'default';

  // Find compatible target types
  const compatibleTypes = new Set<string>();
  rules.forEach((rule) => {
    if (
      (rule.sourceType === nodeType || rule.sourceType === '*') &&
      rule.allowed
    ) {
      if (rule.targetType !== '*') {
        compatibleTypes.add(rule.targetType);
      }
    }
  });

  // Filter nodes by type
  return allNodes.filter(
    (n) => n.id !== node.id && compatibleTypes.has(n.type || 'default')
  );
}
