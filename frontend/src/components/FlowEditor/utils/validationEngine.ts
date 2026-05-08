/**
 * Real-time Workflow Validation Engine (Phase 7)
 *
 * Validates workflows for:
 * - Missing required configurations
 * - Disconnected nodes (unreachable)
 * - Circular dependencies
 * - Invalid connections
 * - Missing trigger nodes
 * - Type mismatches in data flow
 *
 * Returns validation results with severity levels:
 * - ERROR: Blocks publish (missing config, circular deps)
 * - WARNING: Suggests improvements (unreachable nodes)
 * - INFO: Best practice tips
 */

import { Node, Edge } from '@xyflow/react';

// Ensure schemas are registered before any publish-time validation runs.
import '../config/nodeConfigSchemas';

import { schemaRegistry } from '../config/schemaRegistry';
import { evaluateCondition } from '../config/conditionalLogic';
import { validateField } from '../config/validationEngine';
import type { ConfigField } from '../config/types';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  nodeId?: string;
  severity: ValidationSeverity;
  message: string;
  suggestion?: string;
  category: 'config' | 'connection' | 'logic' | 'performance';
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

/**
 * Validates entire workflow
 */
export function validateWorkflow(nodes: Node[], edges: Edge[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Check for trigger nodes
  const triggerNodes = nodes.filter(n => n.type === 'trigger');
  if (triggerNodes.length === 0) {
    issues.push({
      id: 'no-trigger',
      severity: 'error',
      message: 'Workflow must have at least one Trigger node',
      suggestion: 'Add a Trigger node from the palette to define how this workflow starts',
      category: 'config',
    });
  }

  // 2. Check for terminal nodes (success/error)
  const terminalNodes = nodes.filter(n =>
    n.type === 'terminalSuccess' || n.type === 'terminalError'
  );
  if (terminalNodes.length === 0) {
    issues.push({
      id: 'no-terminal',
      severity: 'warning',
      message: 'No terminal nodes found',
      suggestion: 'Add Success or Error terminal nodes to clearly mark workflow endpoints',
      category: 'logic',
    });
  }

  // 3. Validate each node's configuration
  nodes.forEach(node => {
    const nodeIssues = validateNodeConfig(node);
    issues.push(...nodeIssues);
  });

  // 4. Check for disconnected nodes
  const disconnectedNodes = findDisconnectedNodes(nodes, edges);
  disconnectedNodes.forEach(nodeId => {
    const node = nodes.find(n => n.id === nodeId);
    issues.push({
      id: `disconnected-${nodeId}`,
      nodeId,
      severity: 'warning',
      message: `Node "${node?.data?.label || nodeId}" is not connected`,
      suggestion: 'Connect this node or remove it if unused',
      category: 'connection',
    });
  });

  // 5. Check for circular dependencies
  const circularPaths = detectCircularDependencies(nodes, edges);
  circularPaths.forEach((path, index) => {
    issues.push({
      id: `circular-${index}`,
      severity: 'error',
      message: `Circular dependency detected: ${path.join(' → ')}`,
      suggestion: 'Remove one connection to break the loop',
      category: 'logic',
    });
  });

  // 6. Check for unreachable nodes
  const unreachableNodes = findUnreachableNodes(nodes, edges);
  unreachableNodes.forEach(nodeId => {
    const node = nodes.find(n => n.id === nodeId);
    issues.push({
      id: `unreachable-${nodeId}`,
      nodeId,
      severity: 'warning',
      message: `Node "${node?.data?.label || nodeId}" is unreachable from triggers`,
      suggestion: 'Check connections from trigger nodes',
      category: 'connection',
    });
  });

  // 7. Performance checks
  if (nodes.length > 100) {
    issues.push({
      id: 'large-workflow',
      severity: 'info',
      message: 'Large workflow detected (100+ nodes)',
      suggestion: 'Consider breaking into smaller sub-workflows for better performance',
      category: 'performance',
    });
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  return {
    isValid: errorCount === 0,
    issues,
    errorCount,
    warningCount,
    infoCount,
  };
}

/**
 * Validates a single node's configuration
 */
const _resolveSchemaNodeType = (node: Node): string => {
  const data = (node.data || {}) as any;
  if (typeof data.nodeType === 'string' && data.nodeType.trim()) return data.nodeType;

  // Generic action nodes can be discriminated by actionType.
  if (node.type === 'action' && typeof data.actionType === 'string' && data.actionType.trim()) {
    const at = data.actionType.trim();
    const map: Record<string, string> = {
      email: 'actionEmail',
      http: 'actionHTTP',
      sms: 'actionSMS',
      notify: 'actionNotify',
      notification: 'actionNotify',
      script: 'actionScript',
      createRecord: 'actionCreateRecord',
      updateRecord: 'actionUpdateRecord',
      deleteRecord: 'actionDeleteRecord',
    };
    return map[at] || `action${at.charAt(0).toUpperCase()}${at.slice(1)}`;
  }

  // If the node.type already matches a schema nodeType, this will work.
  return node.type || 'unknown';
};

const _checkIsVisible = (item: any, data: Record<string, any>): boolean => {
  const cond = item?.conditional || item?.visibilityCondition || item?.showIf;
  if (!cond) return true;

  if (typeof cond === 'function') {
    try {
      return Boolean(cond(data));
    } catch {
      return true;
    }
  }

  return evaluateCondition(cond, data);
};

const _materializeEffectiveValues = (
  node: Node,
  schemaFields: ConfigField[]
): Record<string, any> => {
  const raw = ((node.data as any) || {}) as Record<string, any>;
  const out: Record<string, any> = { ...raw };

  // Minimal alias/sync rules to match config panel behavior.
  if (out.type === undefined && out.triggerType !== undefined) out.type = out.triggerType;
  if (out.triggerType === undefined && out.type !== undefined) out.triggerType = out.type;

  if (out.entityType === undefined && out.entity !== undefined) out.entityType = out.entity;
  if (out.entity === undefined && out.entityType !== undefined) out.entity = out.entityType;

  if (out.fieldMappings === undefined && out.fields !== undefined) out.fieldMappings = out.fields;
  if (out.fields === undefined && out.fieldMappings !== undefined) out.fields = out.fieldMappings;

  // Apply schema defaults for validation computation (only when truly missing).
  for (const field of schemaFields) {
    if (out[field.id] === undefined && (field as any).defaultValue !== undefined) {
      out[field.id] = (field as any).defaultValue;
    }
  }

  return out;
};

export function validateNodeConfig(node: Node): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Existing lightweight type-specific checks
  if (node.type === 'form' || node.type === 'formProcessGroup' || node.type === 'formBook') {
    const fields = Array.isArray((node.data as any)?.fields) ? (node.data as any).fields : [];
    if (fields.length === 0) {
      issues.push({
        id: `no-fields-${node.id}`,
        nodeId: node.id,
        severity: 'warning',
        message: `Form "${node.data?.label || node.id}" has no fields`,
        suggestion: 'Open FormBuilder to add fields',
        category: 'config',
      });
    }
  }

  if (node.type === 'conditionIf') {
    const rules = Array.isArray((node.data as any)?.rules) ? (node.data as any).rules : [];
    if (rules.length === 0) {
      issues.push({
        id: `no-rules-${node.id}`,
        nodeId: node.id,
        severity: 'error',
        message: `Condition "${node.data?.label || node.id}" has no rules`,
        suggestion: 'Add at least one condition rule',
        category: 'config',
      });
    }
  }

  if (node.type?.startsWith('action')) {
    const actionType = (node.data as any)?.actionType;
    if (!actionType) {
      issues.push({
        id: `no-action-type-${node.id}`,
        nodeId: node.id,
        severity: 'error',
        message: `Action node "${node.data?.label || node.id}" has no action type`,
        suggestion: 'Select an action type',
        category: 'config',
      });
    }
  }

  // Schema-driven validation (publish-time parity)
  const schemaNodeType = _resolveSchemaNodeType(node);
  const schema = schemaRegistry.getSchema(schemaNodeType);

  const schemaFields: ConfigField[] = (schema.sections || []).flatMap((s: any) => (s?.fields || []) as ConfigField[]);
  const effective = _materializeEffectiveValues(node, schemaFields);

  for (const section of schema.sections || []) {
    if (!_checkIsVisible(section, effective)) continue;

    for (const field of (section.fields || []) as ConfigField[]) {
      if (!_checkIsVisible(field, effective)) continue;

      const value = effective[field.id];
      const err = validateField(field, value, effective);
      if (!err) continue;

      issues.push({
        id: `schema-${node.id}-${field.id}`,
        nodeId: node.id,
        severity: 'error',
        message: err,
        suggestion: `Open the config panel and fix “${field.label || field.id}”.`,
        category: 'config',
      });
    }
  }

  return issues;
}

/**
 * Finds nodes not connected to any edges
 */
function findDisconnectedNodes(nodes: Node[], edges: Edge[]): string[] {
  const connectedNodeIds = new Set<string>();

  edges.forEach(edge => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  return nodes
    .filter(node => !connectedNodeIds.has(node.id))
    .filter(node => node.type !== 'trigger') // Triggers don't need incoming connections
    .map(node => node.id);
}

/**
 * Detects circular dependencies using DFS
 */
function detectCircularDependencies(nodes: Node[], edges: Edge[]): string[][] {
  const graph = buildAdjacencyList(edges);
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(nodeId: string, path: string[]): void {
    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);

    const neighbors = graph.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path]);
      } else if (recStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart);
        cycle.push(neighbor); // Complete the cycle
        cycles.push(cycle);
      }
    }

    recStack.delete(nodeId);
  }

  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  });

  return cycles;
}

/**
 * Finds nodes unreachable from trigger nodes
 */
function findUnreachableNodes(nodes: Node[], edges: Edge[]): string[] {
  const triggerNodes = nodes.filter(n => n.type === 'trigger');
  if (triggerNodes.length === 0) return [];

  const reachable = new Set<string>();
  const graph = buildAdjacencyList(edges);

  // BFS from each trigger
  function bfs(startId: string): void {
    const queue = [startId];
    reachable.add(startId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = graph.get(current) || [];

      for (const neighbor of neighbors) {
        if (!reachable.has(neighbor)) {
          reachable.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  triggerNodes.forEach(trigger => bfs(trigger.id));

  return nodes
    .filter(node => !reachable.has(node.id))
    .filter(node => node.type !== 'trigger') // Other triggers might not be connected
    .map(node => node.id);
}

/**
 * Builds adjacency list from edges
 */
function buildAdjacencyList(edges: Edge[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  edges.forEach(edge => {
    if (!graph.has(edge.source)) {
      graph.set(edge.source, []);
    }
    graph.get(edge.source)!.push(edge.target);
  });

  return graph;
}

/**
 * Gets validation badge color for node
 */
export function getValidationBadgeColor(issues: ValidationIssue[]): string | null {
  if (issues.length === 0) return null;

  const hasError = issues.some(i => i.severity === 'error');
  const hasWarning = issues.some(i => i.severity === 'warning');

  if (hasError) return 'rgb(var(--color-error))'; // Red
  if (hasWarning) return 'rgb(var(--color-warning))'; // Yellow
  return 'rgb(var(--color-info))'; // Blue (info)
}
