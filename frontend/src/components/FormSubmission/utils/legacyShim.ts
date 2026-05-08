/**
 * Legacy Shim
 *
 * Phase 1: Wire TaskRenderer to FormSubmissionModal
 * Converts legacy `steps` array format to workflow_definition format (nodes/edges).
 *
 * Purpose:
 * - Enable backward compatibility for existing forms
 * - Bridge old modal architecture to new workflow system
 * - Zero breaking changes to existing functionality
 *
 * Usage:
 * ```typescript
 * const { nodes, edges } = createLinearGraph(steps);
 * const context = useWorkflowContext(nodes, currentNode?.id);
 * ```
 *
 * Created: 2026-01-08 - Phase 1 TaskRenderer Integration
 */

import { Node, Edge } from '@xyflow/react';

export interface LegacyStep {
  id: string;
  name: string;
  order: number;
  entity_type: string;
  fields: any[];
}

/**
 * Convert legacy steps array to workflow nodes/edges
 *
 * Creates a linear graph where each step becomes a formStep node
 * connected by edges in order.
 *
 * @param steps - Legacy steps array from form submission
 * @returns { nodes, edges } - React Flow compatible graph
 */
export function createLinearGraph(steps: LegacyStep[]): {
  nodes: Node[];
  edges: Edge[];
} {
  // Sort steps by order
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  // Create nodes
  const nodes: Node[] = sortedSteps.map((step, index) => ({
    id: step.id,
    type: 'formStep',
    position: { x: 0, y: index * 200 }, // Not displayed, but required by React Flow
    data: {
      id: step.id,
      label: step.name,
      name: step.name,
      order: step.order,
      entity_type: step.entity_type,
      fields: step.fields,
      // Legacy compatibility fields
      _legacy: true,
      _originalStep: step,
    },
  }));

  // Create edges (linear connections)
  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `edge-${nodes[i].id}-${nodes[i + 1].id}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
      type: 'default',
    });
  }

  return { nodes, edges };
}

/**
 * Get node by step ID
 *
 * @param nodes - Workflow nodes
 * @param stepId - Legacy step ID
 * @returns Node or undefined
 */
export function getNodeByStepId(nodes: Node[], stepId: string): Node | undefined {
  return nodes.find(n => n.id === stepId);
}

/**
 * Get next node in linear graph
 *
 * @param nodes - Workflow nodes
 * @param currentNodeId - Current node ID
 * @returns Next node or undefined
 */
export function getNextNode(nodes: Node[], currentNodeId: string): Node | undefined {
  const currentIndex = nodes.findIndex(n => n.id === currentNodeId);
  if (currentIndex === -1 || currentIndex === nodes.length - 1) {
    return undefined;
  }
  return nodes[currentIndex + 1];
}

/**
 * Get previous node in linear graph
 *
 * @param nodes - Workflow nodes
 * @param currentNodeId - Current node ID
 * @returns Previous node or undefined
 */
export function getPreviousNode(nodes: Node[], currentNodeId: string): Node | undefined {
  const currentIndex = nodes.findIndex(n => n.id === currentNodeId);
  if (currentIndex <= 0) {
    return undefined;
  }
  return nodes[currentIndex - 1];
}

/**
 * Check if node is first in graph
 *
 * @param nodes - Workflow nodes
 * @param nodeId - Node ID to check
 * @returns True if first node
 */
export function isFirstNode(nodes: Node[], nodeId: string): boolean {
  return nodes.length > 0 && nodes[0].id === nodeId;
}

/**
 * Check if node is last in graph
 *
 * @param nodes - Workflow nodes
 * @param nodeId - Node ID to check
 * @returns True if last node
 */
export function isLastNode(nodes: Node[], nodeId: string): boolean {
  return nodes.length > 0 && nodes[nodes.length - 1].id === nodeId;
}
