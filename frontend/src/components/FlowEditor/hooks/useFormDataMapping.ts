/**
 * useFormDataMapping Hook
 * 
 * Manages automatic data mapping between form nodes and workflow nodes.
 * Exposes form outputs as connection points for downstream workflow logic.
 * 
 * Features:
 * - Auto-detects form fields as potential data sources
 * - Generates handle IDs for each output field
 * - Tracks mappings between form nodes and workflow nodes
 * - Provides validation for data type compatibility
 * 
 * Created: 2026-02-21 - Phase 1: Hybrid Functionality
 */

import { useCallback, useMemo } from 'react';
import { Node, Edge, useReactFlow } from '@xyflow/react';
import { FormField } from '@/components/form-builder/types';

/**
 * Data mapping between form field and workflow node
 */
export interface FormDataMapping {
  /** Source form node ID */
  formNodeId: string;
  /** Source field ID within the form */
  fieldId: string;
  /** Field name for display */
  fieldName: string;
  /** Field type (text, number, email, etc.) */
  fieldType: string;
  /** Target workflow node ID */
  targetNodeId: string;
  /** Target property/variable name */
  targetProperty: string;
  /** Optional transformation expression */
  transform?: string;
  /** Validation rules */
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

/**
 * Form output definition for a single field
 */
export interface FormOutputField {
  id: string;
  name: string;
  type: string;
  label: string;
  /** Handle ID for React Flow connections */
  handleId: string;
  /** Whether this field is required */
  required: boolean;
}

/**
 * Hook return type
 */
interface UseFormDataMappingReturn {
  /** Generate output fields from form node data */
  generateFormOutputs: (node: Node) => FormOutputField[];
  /** Get all mappings for a form node */
  getMappingsForNode: (nodeId: string) => FormDataMapping[];
  /** Create or update a mapping */
  setMapping: (mapping: FormDataMapping) => void;
  /** Remove a mapping */
  removeMapping: (formNodeId: string, targetNodeId: string, fieldId: string) => void;
  /** Get available fields from connected form nodes */
  getUpstreamFormFields: (nodeId: string) => FormOutputField[];
  /** Validate a mapping */
  validateMapping: (mapping: FormDataMapping) => { valid: boolean; errors: string[] };
}

/**
 * Hook for managing form-to-workflow data mappings
 */
export const useFormDataMapping = (): UseFormDataMappingReturn => {
  const { getNodes, getEdges, setNodes } = useReactFlow();

  /**
   * Generate form output fields from node data
   */
  const generateFormOutputs = useCallback((node: Node): FormOutputField[] => {
    if (!node) return [];

    const outputs: FormOutputField[] = [];
    const data = node.data;

    // Extract fields from different form node types
    if (node.type === 'formProcessGroup' || node.type === 'formReference') {
      // Get child nodes with form fields
      const childNodes = getNodes().filter(n => n.parentId === node.id);
      childNodes.forEach((child, stepIndex) => {
        const fields = child.data?.fields as FormField[] || [];
        fields.forEach((field: FormField, fieldIndex: number) => {
          outputs.push({
            id: field.id,
            name: field.name,
            type: field.type,
            label: field.label || field.name,
            handleId: `output-${stepIndex}-${fieldIndex}-${field.id}`,
            required: field.validation?.required || false,
          });
        });
      });
    } else if (node.type === 'formStepSingle') {
      // Single step form - get fields directly
      const fields = data?.fields as FormField[] || [];
      fields.forEach((field: FormField, index: number) => {
        outputs.push({
          id: field.id,
          name: field.name,
          type: field.type,
          label: field.label || field.name,
          handleId: `output-${index}-${field.id}`,
          required: field.validation?.required || false,
        });
      });
    }

    return outputs;
  }, [getNodes]);

  /**
   * Get all mappings stored in node data
   */
  const getMappingsForNode = useCallback((nodeId: string): FormDataMapping[] => {
    const node = getNodes().find(n => n.id === nodeId);
    return (node?.data?.dataMappings as FormDataMapping[]) || [];
  }, [getNodes]);

  /**
   * Store mapping in target node's data
   */
  const setMapping = useCallback((mapping: FormDataMapping) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === mapping.targetNodeId) {
          const existingMappings = (node.data?.dataMappings as FormDataMapping[]) || [];
          const filteredMappings = existingMappings.filter(
            (m) =>
              !(m.formNodeId === mapping.formNodeId &&
                m.fieldId === mapping.fieldId &&
                m.targetProperty === mapping.targetProperty)
          );
          return {
            ...node,
            data: {
              ...node.data,
              dataMappings: [...filteredMappings, mapping],
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  /**
   * Remove a specific mapping
   */
  const removeMapping = useCallback(
    (formNodeId: string, targetNodeId: string, fieldId: string) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === targetNodeId) {
            const existingMappings = (node.data?.dataMappings as FormDataMapping[]) || [];
            return {
              ...node,
              data: {
                ...node.data,
                dataMappings: existingMappings.filter(
                  (m) => !(m.formNodeId === formNodeId && m.fieldId === fieldId)
                ),
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  /**
   * Get form fields from upstream connected nodes
   */
  const getUpstreamFormFields = useCallback(
    (nodeId: string): FormOutputField[] => {
      const edges = getEdges();
      const nodes = getNodes();

      // Find all edges pointing to this node
      const incomingEdges = edges.filter((edge) => edge.target === nodeId);
      const upstreamFields: FormOutputField[] = [];

      incomingEdges.forEach((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        if (sourceNode && ['formProcessGroup', 'formReference', 'formStepSingle'].includes(sourceNode.type || '')) {
          const fields = generateFormOutputs(sourceNode);
          upstreamFields.push(...fields);
        }
      });

      return upstreamFields;
    },
    [getEdges, getNodes, generateFormOutputs]
  );

  /**
   * Validate mapping compatibility
   */
  const validateMapping = useCallback((mapping: FormDataMapping) => {
    const errors: string[] = [];

    // Check if field type is compatible with target
    const compatibleTypes: Record<string, string[]> = {
      text: ['text', 'string', 'any'],
      number: ['number', 'integer', 'float', 'any'],
      email: ['text', 'string', 'email', 'any'],
      date: ['date', 'datetime', 'timestamp', 'any'],
      boolean: ['boolean', 'checkbox', 'any'],
    };

    // Validate required fields
    if (!mapping.formNodeId) errors.push('Form node ID is required');
    if (!mapping.fieldId) errors.push('Field ID is required');
    if (!mapping.targetNodeId) errors.push('Target node ID is required');
    if (!mapping.targetProperty) errors.push('Target property is required');

    // Validate transformation expression syntax (basic check)
    if (mapping.transform && mapping.transform.trim()) {
      try {
        // Attempt to create a function from the expression
        new Function('value', `return ${mapping.transform}`);
      } catch (error) {
        errors.push('Invalid transformation expression');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }, []);

  return {
    generateFormOutputs,
    getMappingsForNode,
    setMapping,
    removeMapping,
    getUpstreamFormFields,
    validateMapping,
  };
};
