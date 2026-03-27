/**
 * Output Schema Inference Utility
 * 
 * Automatically infers what data a node outputs based on its configuration.
 * This enables Smart Auto-Map to suggest field mappings between connected nodes.
 * 
 * Created: 2026-03-04 - Smart Auto-Map Phase 3
 */

import { Node } from '@xyflow/react';

/**
 * Output field schema for a node
 */
export interface OutputFieldSchema {
  fieldId: string;
  fieldName: string;
  fieldType: string; // 'text', 'number', 'date', 'select', etc.
  label: string;
  entityType?: string; // If field comes from entity introspection
  required: boolean;
  defaultValue?: any;
}

/**
 * Complete output schema for a node
 */
export interface NodeOutputSchema {
  nodeId: string;
  nodeType: string;
  entityType?: string; // e.g., 'customers.Customer', 'products.Product'
  outputFields: OutputFieldSchema[];
  timestamp: number; // When schema was inferred
}

/**
 * Infer output schema from a form node
 */
export function inferOutputSchemaFromFormNode(node: Node): NodeOutputSchema | null {
  try {
    const { data } = node;
    const dataAny = data as any;
    const fields: OutputFieldSchema[] = [];

    // Check if node has form fields
    if (data.fields && Array.isArray(data.fields)) {
      data.fields.forEach((field: any) => {
        fields.push({
          fieldId: field.id || field.name,
          fieldName: field.name || field.id,
          fieldType: field.type || 'text',
          label: field.label || field.name,
          entityType: typeof dataAny.entityType === 'string' ? dataAny.entityType : undefined,
          required: field.required || false,
          defaultValue: field.defaultValue,
        });
      });
    }

    // Check if node has form steps (multi-step forms)
    if (data.steps && Array.isArray(data.steps)) {
      data.steps.forEach((step: any) => {
        if (step.fields && Array.isArray(step.fields)) {
          step.fields.forEach((field: any) => {
            fields.push({
              fieldId: field.id || field.name,
              fieldName: field.name || field.id,
              fieldType: field.type || 'text',
              label: field.label || field.name,
              entityType:
                typeof step.entityType === 'string'
                  ? step.entityType
                  : (typeof dataAny.entityType === 'string' ? dataAny.entityType : undefined),
              required: field.required || false,
              defaultValue: field.defaultValue,
            });
          });
        }
      });
    }

    if (fields.length === 0) {
      return null; // No fields to infer
    }

    return {
      nodeId: node.id,
      nodeType: node.type || 'form',
      entityType: typeof dataAny.entityType === 'string' ? dataAny.entityType : undefined,
      outputFields: fields,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('[OutputSchema] Failed to infer schema:', error);
    return null;
  }
}

/**
 * Infer output schema from any node type
 */
export function inferOutputSchema(node: Node): NodeOutputSchema | null {
  // Use existing outputSchema if available and recent (< 5 minutes old)
  const existing = (node.data as any)?.outputSchema;
  if (
    existing &&
    typeof existing === 'object' &&
    typeof existing.timestamp === 'number' &&
    Date.now() - existing.timestamp < 5 * 60 * 1000
  ) {
    return existing as NodeOutputSchema;
  }

  // Infer based on node type
  switch (node.type) {
    case 'form':
    case 'formStep':
    case 'formBook':
    case 'formProcessGroup':
      return inferOutputSchemaFromFormNode(node);
    
    // Add more node types as needed
    default:
      return null;
  }
}

/**
 * Extract output schemas from multiple nodes
 */
export function extractOutputSchemas(nodes: Node[]): Map<string, NodeOutputSchema> {
  const schemas = new Map<string, NodeOutputSchema>();
  
  nodes.forEach(node => {
    const schema = inferOutputSchema(node);
    if (schema) {
      schemas.set(node.id, schema);
    }
  });
  
  return schemas;
}

/**
 * Get upstream nodes (nodes that connect to the target node)
 */
export function getUpstreamNodes(nodes: Node[], edges: any[], targetNodeId: string): Node[] {
  // Find edges that point to target node
  const incomingEdges = edges.filter(edge => edge.target === targetNodeId);
  
  // Get source nodes from those edges
  const upstreamNodeIds = new Set(incomingEdges.map(edge => edge.source));
  
  return nodes.filter(node => upstreamNodeIds.has(node.id));
}

/**
 * Get output fields from upstream nodes
 */
export function getUpstreamOutputFields(
  nodes: Node[],
  edges: any[],
  targetNodeId: string
): OutputFieldSchema[] {
  const upstreamNodes = getUpstreamNodes(nodes, edges, targetNodeId);
  const allFields: OutputFieldSchema[] = [];
  
  upstreamNodes.forEach(node => {
    const schema = inferOutputSchema(node);
    if (schema) {
      allFields.push(...schema.outputFields);
    }
  });
  
  return allFields;
}

/**
 * Update node data with inferred output schema
 */
export function attachOutputSchemaToNode(node: Node): Node {
  const schema = inferOutputSchema(node);
  
  if (!schema) {
    return node; // No changes
  }
  
  return {
    ...node,
    data: {
      ...node.data,
      outputSchema: schema,
    },
  };
}

/**
 * Validate that output schema is still valid
 * (fields haven't been deleted/renamed)
 */
export function validateOutputSchema(
  node: Node,
  storedSchema: NodeOutputSchema
): boolean {
  const currentSchema = inferOutputSchemaFromFormNode(node);
  
  if (!currentSchema) {
    return false; // Node no longer has fields
  }
  
  // Check if field count matches
  if (currentSchema.outputFields.length !== storedSchema.outputFields.length) {
    return false;
  }
  
  // Check if field names match
  const currentFieldNames = new Set(
    currentSchema.outputFields.map(f => f.fieldName)
  );
  const storedFieldNames = new Set(
    storedSchema.outputFields.map(f => f.fieldName)
  );
  
  for (const name of storedFieldNames) {
    if (!currentFieldNames.has(name)) {
      return false; // Field was deleted
    }
  }
  
  return true;
}
