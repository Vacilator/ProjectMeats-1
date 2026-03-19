/**
 * useUpstreamVariables Hook
 * 
 * Phase C.3: Upstream Variable Propagation
 * Analyzes workflow graph to find all upstream nodes and extract their output fields.
 * Makes variables available for downstream nodes to reference.
 * 
 * Features:
 * - Graph traversal from current node backwards
 * - Extracts fields from Form Step Single nodes
 * - Formats variables as {{nodeId.fieldName}} templates
 * - Type-aware suggestions (string, number, date)
 * - Handles circular dependencies
 * - Caches results for performance
 * 
 * Usage:
 * ```typescript
 * const { variables, loading } = useUpstreamVariables({
 *   currentNodeId: 'node-123',
 *   nodes,
 *   edges
 * });
 * 
 * // variables = [
 * //   { nodeId: 'step1', nodeName: 'Customer Info', fieldName: 'email', fieldType: 'string', template: '{{step1.email}}' },
 * //   { nodeId: 'step2', nodeName: 'Product Selection', fieldName: 'quantity', fieldType: 'number', template: '{{step2.quantity}}' }
 * // ]
 * ```
 * 
 * Created: 2026-02-17 - Phase C.3 Upstream Variable Propagation
 */

import { useMemo } from 'react';
import { Node, Edge } from 'reactflow';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface UpstreamVariable {
  /** Source node ID */
  nodeId: string;
  
  /** Human-readable node name */
  nodeName: string;
  
  /** Field name/key */
  fieldName: string;
  
  /** Human-readable field label */
  fieldLabel: string;
  
  /** Field data type */
  fieldType: 'string' | 'number' | 'date' | 'boolean' | 'select' | 'file' | 'textarea' | 'email' | 'phone' | 'url' | 'json';
  
  /** Template string for insertion: {{nodeId.fieldName}} */
  template: string;
  
  /** Distance from current node (1 = direct parent, 2 = grandparent, etc.) */
  distance: number;
  
  /** Node type (formStepSingle, formProcess, etc.) */
  nodeType: string;
  
  /** Whether field is required in the source node */
  required?: boolean;
}

export interface UseUpstreamVariablesParams {
  /** Current node ID to find upstream variables for */
  currentNodeId: string;
  
  /** All nodes in the workflow */
  nodes: Node[];
  
  /** All edges in the workflow */
  edges: Edge[];
  
  /** Maximum distance to traverse (default: 10) */
  maxDistance?: number;
}

export interface UseUpstreamVariablesResult {
  /** Array of available upstream variables */
  variables: UpstreamVariable[];
  
  /** Variables grouped by source node */
  variablesByNode: Record<string, UpstreamVariable[]>;
  
  /** Whether calculation is in progress */
  loading: boolean;
  
  /** Error if any */
  error: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find all upstream nodes using breadth-first search
 */
function findUpstreamNodes(
  currentNodeId: string,
  edges: Edge[],
  maxDistance: number = 10
): Map<string, number> {
  const upstreamNodes = new Map<string, number>(); // nodeId -> distance
  const visited = new Set<string>();
  const queue: Array<{ nodeId: string; distance: number }> = [{ nodeId: currentNodeId, distance: 0 }];
  
  while (queue.length > 0) {
    const { nodeId, distance } = queue.shift()!;
    
    if (visited.has(nodeId) || distance > maxDistance) {
      continue;
    }
    
    visited.add(nodeId);
    
    // Find all edges that point TO this node (target = current)
    const incomingEdges = edges.filter(edge => edge.target === nodeId);
    
    for (const edge of incomingEdges) {
      const sourceNodeId = edge.source;
      const sourceDistance = distance + 1;
      
      // Only add if we haven't seen this node or found a shorter path
      if (!upstreamNodes.has(sourceNodeId) || upstreamNodes.get(sourceNodeId)! > sourceDistance) {
        upstreamNodes.set(sourceNodeId, sourceDistance);
        queue.push({ nodeId: sourceNodeId, distance: sourceDistance });
      }
    }
  }
  
  // Remove the current node itself
  upstreamNodes.delete(currentNodeId);
  
  return upstreamNodes;
}

/**
 * Returns upstream node distances (1 = direct parent, 2 = grandparent, ...)
 * using true graph traversal over edges (target -> source).
 */
export function getUpstreamNodeDistances(
  currentNodeId: string,
  edges: Edge[],
  maxDistance: number = 10
): Map<string, number> {
  return findUpstreamNodes(currentNodeId, edges, maxDistance);
}

/**
 * Convenience helper: set of upstream node IDs for currentNodeId.
 */
export function getUpstreamNodeIdSet(
  currentNodeId: string,
  edges: Edge[],
  maxDistance: number = 10
): Set<string> {
  return new Set(getUpstreamNodeDistances(currentNodeId, edges, maxDistance).keys());
}

/**
 * Extract field definitions from a Form Step Single node
 */
function extractFieldsFromFormStep(node: Node): Array<{
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  required?: boolean;
}> {
  const fields: Array<{
    fieldName: string;
    fieldLabel: string;
    fieldType: string;
    required?: boolean;
  }> = [];
  
  // Check if this is a Form node (renamed from Form Step Single in Phase E)
  if (node.type !== 'formStepSingle' && node.type !== 'formStep' && node.type !== 'form') {
    return fields;
  }
  
  // Extract fields from node data
  const nodeData = node.data || {};
  const selectedFields = nodeData.selectedFields || nodeData.fields || [];
  
  // Handle both array of objects and array of strings
  if (Array.isArray(selectedFields)) {
    for (const field of selectedFields) {
      if (typeof field === 'string') {
        // Simple string field name
        fields.push({
          fieldName: field,
          fieldLabel: field,
          fieldType: 'string',
        });
      } else if (typeof field === 'object' && field !== null) {
        // Object with field metadata
        fields.push({
          fieldName: field.name || field.key || field.id || 'unknown',
          fieldLabel: field.label || field.display_name || field.name || 'Unknown Field',
          fieldType: field.type || field.field_type || 'string',
          required: field.required || false,
        });
      }
    }
  }
  
  // Also check for entity fields if entity is selected
  const entityType = nodeData.entityType || nodeData.entity;
  if (entityType && fields.length === 0) {
    // If no fields explicitly selected, check if there's an entity configuration
    const entityFields = nodeData.entityFields || [];
    if (Array.isArray(entityFields)) {
      for (const field of entityFields) {
        fields.push({
          fieldName: field.name || field.key || 'unknown',
          fieldLabel: field.label || field.display_name || 'Unknown',
          fieldType: field.type || 'string',
          required: field.required || false,
        });
      }
    }
  }
  
  return fields;
}

/**
 * Map backend field types to standardized types
 */
function normalizeFieldType(type: string): UpstreamVariable['fieldType'] {
  const typeMap: Record<string, UpstreamVariable['fieldType']> = {
    'CharField': 'string',
    'TextField': 'textarea',
    'IntegerField': 'number',
    'DecimalField': 'number',
    'FloatField': 'number',
    'DateField': 'date',
    'DateTimeField': 'date',
    'BooleanField': 'boolean',
    'EmailField': 'email',
    'URLField': 'url',
    'FileField': 'file',
    'ImageField': 'file',
    'JSONField': 'json',
    'ForeignKey': 'select',
    'ManyToManyField': 'select',
  };
  
  // Check direct match
  if (type in typeMap) {
    return typeMap[type];
  }
  
  // Check lowercase match
  const lowerType = type.toLowerCase();
  if (lowerType.includes('email')) return 'email';
  if (lowerType.includes('phone')) return 'phone';
  if (lowerType.includes('url')) return 'url';
  if (lowerType.includes('date')) return 'date';
  if (lowerType.includes('number') || lowerType.includes('int') || lowerType.includes('float') || lowerType.includes('decimal')) return 'number';
  if (lowerType.includes('bool')) return 'boolean';
  if (lowerType.includes('text') && lowerType.includes('area')) return 'textarea';
  if (lowerType.includes('file') || lowerType.includes('image')) return 'file';
  if (lowerType.includes('json')) return 'json';
  if (lowerType.includes('select') || lowerType.includes('choice')) return 'select';
  
  // Default to string
  return 'string';
}

// ============================================================================
// Main Hook
// ============================================================================

export function useUpstreamVariables({
  currentNodeId,
  nodes,
  edges,
  maxDistance = 10,
}: UseUpstreamVariablesParams): UseUpstreamVariablesResult {
  
  const result = useMemo<UseUpstreamVariablesResult>(() => {
    try {
      // Find all upstream nodes
      const upstreamNodeMap = findUpstreamNodes(currentNodeId, edges, maxDistance);
      
      // Extract variables from each upstream node
      const variables: UpstreamVariable[] = [];
      
      for (const [nodeId, distance] of upstreamNodeMap.entries()) {
        // Find the node object
        const node = nodes.find(n => n.id === nodeId);
        if (!node) continue;
        
        // Get node name (fallback to ID if no label)
        const nodeName = node.data?.label || node.data?.name || nodeId;
        
        // Extract fields from this node
        const fields = extractFieldsFromFormStep(node);
        
        // Create variable entry for each field
        for (const field of fields) {
          variables.push({
            nodeId,
            nodeName,
            fieldName: field.fieldName,
            fieldLabel: field.fieldLabel,
            fieldType: normalizeFieldType(field.fieldType),
            template: `{{${nodeId}.${field.fieldName}}}`,
            distance,
            nodeType: node.type || 'unknown',
            required: field.required,
          });
        }
      }
      
      // Sort by distance (closer nodes first), then by node name
      variables.sort((a, b) => {
        if (a.distance !== b.distance) {
          return a.distance - b.distance;
        }
        return a.nodeName.localeCompare(b.nodeName);
      });
      
      // Group by node
      const variablesByNode: Record<string, UpstreamVariable[]> = {};
      for (const variable of variables) {
        if (!variablesByNode[variable.nodeId]) {
          variablesByNode[variable.nodeId] = [];
        }
        variablesByNode[variable.nodeId].push(variable);
      }
      
      return {
        variables,
        variablesByNode,
        loading: false,
        error: null,
      };
      
    } catch (err) {
      return {
        variables: [],
        variablesByNode: {},
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }, [currentNodeId, nodes, edges, maxDistance]);
  
  return result;
}

/**
 * Helper hook to get variables for a specific field type
 */
export function useUpstreamVariablesFiltered(
  params: UseUpstreamVariablesParams,
  fieldTypes?: UpstreamVariable['fieldType'][]
): UseUpstreamVariablesResult {
  const allVariables = useUpstreamVariables(params);
  
  const filtered = useMemo(() => {
    if (!fieldTypes || fieldTypes.length === 0) {
      return allVariables;
    }
    
    const filteredVariables = allVariables.variables.filter(
      v => fieldTypes.includes(v.fieldType)
    );
    
    const filteredByNode: Record<string, UpstreamVariable[]> = {};
    for (const variable of filteredVariables) {
      if (!filteredByNode[variable.nodeId]) {
        filteredByNode[variable.nodeId] = [];
      }
      filteredByNode[variable.nodeId].push(variable);
    }
    
    return {
      variables: filteredVariables,
      variablesByNode: filteredByNode,
      loading: allVariables.loading,
      error: allVariables.error,
    };
  }, [allVariables, fieldTypes]);
  
  return filtered;
}

export default useUpstreamVariables;
