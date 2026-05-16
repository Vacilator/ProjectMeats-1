/**
 * useWorkflowContext Hook
 * 
 * Phase 5: Context Inheritance
 * Manages data flow between workflow steps using mustache-style syntax.
 * 
 * Features:
 * - Stores all step submission data in flat JSON structure
 * - Resolves {{nodeId.fieldKey}} templates
 * - Supports nested field access {{step1.address.city}}
 * - Supports default fallbacks {{step1.name|"Unknown"}}
 * - Provides available data catalog for UI
 * 
 * Usage:
 * ```typescript
 * const { resolve, getValue, setValue, availableData } = useWorkflowContext(workflow);
 * 
 * // Resolve template
 * const value = resolve("{{step1.customer_name}}"); // "John Doe"
 * 
 * // Get specific value
 * const name = getValue("step1", "customer_name");
 * 
 * // Set value
 * setValue("step2", "order_total", 299.99);
 * ```
 * 
 * Created: 2026-02-12 - Phase 5 Context Inheritance Implementation
 */

import { useState, useCallback, useMemo } from 'react';
import { Node } from '@xyflow/react';
import { logger } from '@/utils/logger';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface WorkflowContextData {
  [nodeId: string]: Record<string, any>;
}

export interface AvailableDataNode {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  fields: Array<{
    key: string;
    label?: string;
    type?: string;
    value?: any;
  }>;
}

export interface WorkflowContext {
  /** All workflow data indexed by node ID */
  data: WorkflowContextData;
  
  /** Current node being executed */
  currentNodeId: string | null;
  
  /** Resolve mustache template to value */
  resolve: (template: string) => any;
  
  /** Get specific field value from node */
  getValue: (nodeId: string, fieldKey: string) => any;
  
  /** Set field value for current node */
  setValue: (fieldKey: string, value: any) => void;
  
  /** Set multiple fields at once for current node */
  setNodeData: (nodeId: string, data: Record<string, any>) => void;
  
  /** Clear all context data */
  clear: () => void;
  
  /** Available data from previous nodes (for Context Bubble UI) */
  availableData: AvailableDataNode[];
  
  /** All workflow nodes */
  nodes: Node[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse mustache template: {{nodeId.fieldKey}} or {{nodeId.fieldKey|"default"}}
 * 
 * Examples:
 * - "{{step1.customer_name}}" → { nodeId: "step1", fieldKey: "customer_name", defaultValue: undefined }
 * - "{{previousStep.total}}" → { nodeId: "previousStep", fieldKey: "total", defaultValue: undefined }
 * - "{{step1.name|'Unknown'}}" → { nodeId: "step1", fieldKey: "name", defaultValue: "Unknown" }
 * - "{{step1.address.city}}" → { nodeId: "step1", fieldKey: "address.city", defaultValue: undefined }
 */
function parseMustacheTemplate(template: string): {
  nodeId: string;
  fieldKey: string;
  defaultValue?: any;
} | null {
  // Match {{nodeId.fieldKey}} or {{nodeId.fieldKey|"default"}}
  const regex = /^\{\{([^.}]+)\.([^}|]+)(?:\|(.+))?\}\}$/;
  const match = template.trim().match(regex);
  
  if (!match) return null;
  
  const [, nodeId, fieldKey, defaultValue] = match;
  
  // Parse default value if present
  let parsedDefault: any = undefined;
  if (defaultValue) {
    // Remove quotes if string literal
    const trimmed = defaultValue.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      parsedDefault = trimmed.slice(1, -1);
    } else if (trimmed === 'null') {
      parsedDefault = null;
    } else if (trimmed === 'undefined') {
      parsedDefault = undefined;
    } else if (!isNaN(Number(trimmed))) {
      parsedDefault = Number(trimmed);
    } else if (trimmed === 'true' || trimmed === 'false') {
      parsedDefault = trimmed === 'true';
    } else {
      parsedDefault = trimmed;
    }
  }
  
  return {
    nodeId,
    fieldKey,
    defaultValue: parsedDefault,
  };
}

/**
 * Get nested field value using dot notation
 * 
 * Examples:
 * - getNestedValue({ name: "John" }, "name") → "John"
 * - getNestedValue({ address: { city: "NYC" } }, "address.city") → "NYC"
 * - getNestedValue({ items: [{ id: 1 }] }, "items.0.id") → 1
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current == null) return undefined;
    current = current[key];
  }
  
  return current;
}

/**
 * Set nested field value using dot notation
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] == null || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing workflow context and data inheritance
 * 
 * @param nodes - Workflow nodes from React Flow
 * @param currentNodeId - Currently executing node ID
 * @returns Workflow context API
 */
export function useWorkflowContext(
  nodes: Node[],
  currentNodeId: string | null = null
): WorkflowContext {
  // State: All workflow data indexed by node ID
  const [contextData, setContextData] = useState<WorkflowContextData>({});

  // Resolve mustache template to value
  const resolve = useCallback((template: string): any => {
    if (!template || typeof template !== 'string') return template;
    
    // If not a template, return as-is
    if (!template.includes('{{')) return template;
    
    // Parse template
    const parsed = parseMustacheTemplate(template);
    if (!parsed) return template; // Invalid template, return as-is
    
    const { nodeId, fieldKey, defaultValue } = parsed;
    
    // Handle special aliases
    let targetNodeId = nodeId;
    if (nodeId === 'previousStep' || nodeId === 'previous') {
      // Find previous node in workflow
      const currentIndex = nodes.findIndex(n => n.id === currentNodeId);
      if (currentIndex > 0) {
        targetNodeId = nodes[currentIndex - 1].id;
      } else {
        return defaultValue;
      }
    }
    
    // Get value from context
    const nodeData = contextData[targetNodeId];
    if (!nodeData) return defaultValue;
    
    const value = getNestedValue(nodeData, fieldKey);
    return value !== undefined ? value : defaultValue;
  }, [contextData, nodes, currentNodeId]);

  // Get specific field value from node
  const getValue = useCallback((nodeId: string, fieldKey: string): any => {
    const nodeData = contextData[nodeId];
    if (!nodeData) return undefined;
    
    return getNestedValue(nodeData, fieldKey);
  }, [contextData]);

  // Set field value for current node
  const setValue = useCallback((fieldKey: string, value: any) => {
    if (!currentNodeId) {
      logger.warn('[useWorkflowContext] Cannot setValue without currentNodeId');
      return;
    }
    
    setContextData(prev => {
      const nodeData = prev[currentNodeId] || {};
      const updated = { ...nodeData };
      setNestedValue(updated, fieldKey, value);
      
      return {
        ...prev,
        [currentNodeId]: updated,
      };
    });
  }, [currentNodeId]);

  // Set multiple fields at once for a node
  const setNodeData = useCallback((nodeId: string, data: Record<string, any>) => {
    setContextData(prev => ({
      ...prev,
      [nodeId]: {
        ...(prev[nodeId] || {}),
        ...data,
      },
    }));
  }, []);

  // Clear all context data
  const clear = useCallback(() => {
    setContextData({});
  }, []);

  // Build available data catalog for Context Bubble UI
  const availableData = useMemo(() => {
    const result: AvailableDataNode[] = [];
    
    // Only include nodes that have data
    Object.keys(contextData).forEach(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      
      const nodeData = contextData[nodeId];
      const nodeDataRecord = (node.data ?? {}) as Record<string, unknown>;
      const schemaFields = Array.isArray(nodeDataRecord.fields) ? nodeDataRecord.fields as Array<{ key?: string; name?: string; label?: string }> : [];
      const fieldLabelMap = new Map<string, string>();
      schemaFields.forEach((f) => {
        const fieldKey = f.key || f.name;
        if (fieldKey && f.label) fieldLabelMap.set(fieldKey, f.label);
      });

      const fields = Object.keys(nodeData).map(key => ({
        key,
        label: fieldLabelMap.get(key) || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        type: typeof nodeData[key],
        value: nodeData[key],
      }));
      
      result.push({
        nodeId,
        nodeLabel: String((node.data as Record<string, unknown>)?.label ?? node.id),
        nodeType: node.type || 'unknown',
        fields,
      });
    });
    
    return result;
  }, [contextData, nodes]);

  return {
    data: contextData,
    currentNodeId,
    resolve,
    getValue,
    setValue,
    setNodeData,
    clear,
    availableData,
    nodes,
  };
}

/**
 * Utility: Pre-fill field defaults by resolving templates
 * 
 * @param fields - Array of form fields with defaultValue
 * @param context - Workflow context
 * @returns Fields with resolved default values
 */
export function resolveFieldDefaults<T extends { defaultValue?: any }>(
  fields: T[],
  context: WorkflowContext
): T[] {
  return fields.map(field => {
    if (!field.defaultValue || typeof field.defaultValue !== 'string') {
      return field;
    }
    
    const resolved = context.resolve(field.defaultValue);
    return {
      ...field,
      defaultValue: resolved,
      _isResolved: true, // Mark as resolved for UI indicator
    };
  });
}

/**
 * Utility: Check if value is a template string
 */
export function isTemplate(value: any): boolean {
  return typeof value === 'string' && value.includes('{{') && value.includes('}}');
}

/**
 * Utility: Extract all template references from a string
 * 
 * Example: "Hello {{step1.name}}, order total: {{step2.total}}"
 * Returns: ["{{step1.name}}", "{{step2.total}}"]
 */
export function extractTemplates(value: string): string[] {
  const regex = /\{\{[^}]+\}\}/g;
  return value.match(regex) || [];
}

/**
 * Utility: Resolve all templates in a string
 * 
 * Example: "Hello {{step1.name}}" → "Hello John Doe"
 */
export function resolveTemplateString(
  value: string,
  context: WorkflowContext
): string {
  const templates = extractTemplates(value);
  
  let result = value;
  templates.forEach(template => {
    const resolved = context.resolve(template);
    if (resolved !== undefined && resolved !== null) {
      result = result.replace(template, String(resolved));
    }
  });
  
  return result;
}
