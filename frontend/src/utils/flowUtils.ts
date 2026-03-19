/**
 * Flow Utilities - Upstream Data Traversal
 * 
 * Utilities for traversing React Flow graphs to enable smart data inheritance.
 * Allows nodes to reference outputs from upstream nodes using {{nodeId.fieldName}} syntax.
 * 
 * Created: 2026-02-24 - Phase 2: Smart Data Inheritance
 */
import { Node, Edge } from '@xyflow/react';

export interface UpstreamOutput {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  sampleValue?: any;
}

/**
 * Traverse flow backwards from currentNodeId to collect all upstream outputs.
 * Prevents infinite loops by tracking visited nodes.
 * 
 * @param nodes - All nodes in the flow
 * @param edges - All edges in the flow
 * @param currentNodeId - The node requesting upstream data
 * @param expectedType - Optional filter by field type (e.g., 'email', 'text')
 * @returns Array of upstream outputs available for inheritance
 * 
 * @example
 * ```typescript
 * const outputs = getUpstreamOutputs(nodes, edges, 'emailNode', 'email');
 * // Returns:
 * // [
 * //   {
 * //     nodeId: 'customerForm',
 * //     nodeLabel: 'Customer Details',
 * //     fieldName: 'email',
 * //     fieldLabel: 'Email Address',
 * //     fieldType: 'email',
 * //     sampleValue: 'customer@example.com'
 * //   }
 * // ]
 * ```
 */
export function getUpstreamOutputs(
  nodes: Node[],
  edges: Edge[],
  currentNodeId: string,
  expectedType?: string
): UpstreamOutput[] {
  const outputs: UpstreamOutput[] = [];
  const visited = new Set<string>();
  
  // Recursive traversal with cycle detection
  function traverse(nodeId: string) {
    if (visited.has(nodeId)) return; // Prevent infinite loops
    visited.add(nodeId);
    
    // Find incoming edges to this node
    const incomingEdges = edges.filter(e => e.target === nodeId);
    
    for (const edge of incomingEdges) {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (!sourceNode) continue;
      
      // Extract outputs from source node data
      const nodeOutputs = extractNodeOutputs(sourceNode);
      
      // Filter by type if specified
      const filteredOutputs = expectedType
        ? nodeOutputs.filter(o => o.fieldType === expectedType)
        : nodeOutputs;
      
      outputs.push(...filteredOutputs);
      
      // Recursively traverse upstream
      traverse(sourceNode.id);
    }
  }
  
  traverse(currentNodeId);
  return outputs;
}

/**
 * Extract output fields from a node based on its type.
 * Different node types expose outputs in different ways.
 */
function extractNodeOutputs(node: Node): UpstreamOutput[] {
  const outputs: UpstreamOutput[] = [];
  const data = (node.data ?? {}) as Record<string, any>;

  // Handle form nodes (formStep, formStepSingle, formProcess)
  if (
    (node.type?.includes('form') || node.type?.includes('Form')) &&
    Array.isArray(data.fields)
  ) {
    for (const field of data.fields as any[]) {
      outputs.push({
        nodeId: node.id,
        nodeLabel: data.label || data.stepTitle || 'Unnamed Form',
        nodeType: node.type,
        fieldName: field.name || field.id,
        fieldLabel: field.label,
        fieldType: field.type,
        sampleValue: field.defaultValue || getSampleValue(field.type),
      });
    }
  }
  
  // Handle entity nodes (createRecord with entity)
  if (data.entityType && Array.isArray(data.outputFields)) {
    for (const field of data.outputFields as any[]) {
      outputs.push({
        nodeId: node.id,
        nodeLabel: data.label || 'Create Record',
        nodeType: node.type,
        fieldName: field.name,
        fieldLabel: field.label,
        fieldType: field.type,
        sampleValue: field.sampleValue,
      });
    }
  }
  
  // Handle lookup/query nodes (database query results)
  if (data.lookupResult && typeof data.lookupResult === 'object') {
    for (const [key, value] of Object.entries(data.lookupResult)) {
      outputs.push({
        nodeId: node.id,
        nodeLabel: data.label || 'Lookup',
        nodeType: node.type,
        fieldName: key,
        fieldLabel: humanize(key),
        fieldType: inferType(value),
        sampleValue: value,
      });
    }
  }
  
  // Handle API/webhook response nodes
  if (data.responseData && typeof data.responseData === 'object') {
    for (const [key, value] of Object.entries(data.responseData)) {
      outputs.push({
        nodeId: node.id,
        nodeLabel: data.label || 'API Response',
        nodeType: node.type,
        fieldName: key,
        fieldLabel: humanize(key),
        fieldType: inferType(value),
        sampleValue: value,
      });
    }
  }
  
  // Handle variable nodes (explicit key-value storage)
  if (Array.isArray(data.variables)) {
    for (const variable of data.variables as any[]) {
      outputs.push({
        nodeId: node.id,
        nodeLabel: data.label || 'Variables',
        nodeType: node.type,
        fieldName: variable.key || variable.name,
        fieldLabel: variable.label || humanize(variable.key || variable.name),
        fieldType: variable.type || 'text',
        sampleValue: variable.value,
      });
    }
  }
  
  return outputs;
}

/**
 * Get sample/default value for a field type.
 * Used when no actual value is available for preview.
 */
function getSampleValue(fieldType: string): any {
  const samples: Record<string, any> = {
    text: 'Sample Text',
    textarea: 'Sample longer text...',
    email: 'example@company.com',
    phone: '+1-555-0100',
    url: 'https://example.com',
    number: 42,
    date: '2026-02-24',
    datetime: '2026-02-24T03:00:00Z',
    select: 'Option 1',
    'multi-select': ['Option 1', 'Option 2'],
    checkbox: true,
    radio: 'Option 1',
    file: 'document.pdf',
  };
  return samples[fieldType] || null;
}

/**
 * Convert snake_case or camelCase to Human Readable
 */
function humanize(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, c => c.toUpperCase());
}

/**
 * Infer field type from JavaScript value
 */
function inferType(value: any): string {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'checkbox';
  if (Array.isArray(value)) return 'multi-select';
  if (value && typeof value === 'string') {
    if (value.includes('@')) return 'email';
    if (value.match(/^\d{4}-\d{2}-\d{2}/)) return 'date';
    if (value.match(/^https?:\/\//)) return 'url';
    if (value.match(/^\+?\d[\d\s()-]+$/)) return 'phone';
  }
  return 'text';
}

/**
 * Format Handlebars syntax for upstream field reference.
 * 
 * @example
 * ```typescript
 * formatInheritanceSyntax('customerForm', 'email')
 * // Returns: '{{customerForm.email}}'
 * ```
 */
export function formatInheritanceSyntax(nodeId: string, fieldName: string): string {
  return `{{${nodeId}.${fieldName}}}`;
}

/**
 * Parse Handlebars syntax to extract node and field references.
 * 
 * @example
 * ```typescript
 * parseInheritanceSyntax('{{customerForm.email}}')
 * // Returns: { nodeId: 'customerForm', fieldName: 'email' }
 * ```
 */
export function parseInheritanceSyntax(value: string): { nodeId: string; fieldName: string } | null {
  const match = value.match(/^\{\{([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_]+)\}\}$/);
  if (!match) return null;
  return {
    nodeId: match[1],
    fieldName: match[2],
  };
}

/**
 * Check if a value uses Handlebars inheritance syntax.
 */
export function isInheritanceSyntax(value: any): boolean {
  return typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}');
}

/**
 * Get all nodes upstream from a given node (excluding the node itself).
 * Useful for dependency checking and validation.
 */
export function getUpstreamNodes(
  nodes: Node[],
  edges: Edge[],
  currentNodeId: string
): Node[] {
  const upstreamNodes: Node[] = [];
  const visited = new Set<string>();
  
  function traverse(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const incomingEdges = edges.filter(e => e.target === nodeId);
    
    for (const edge of incomingEdges) {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode && sourceNode.id !== currentNodeId) {
        upstreamNodes.push(sourceNode);
        traverse(sourceNode.id);
      }
    }
  }
  
  traverse(currentNodeId);
  return upstreamNodes;
}
