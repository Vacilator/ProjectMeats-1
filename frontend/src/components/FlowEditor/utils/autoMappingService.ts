/**
 * Auto-Mapping Service
 *
 * Suggests field mappings between connected nodes in a workflow.
 * Combines output schema inference and field matching to enable Smart Auto-Map.
 *
 * Created: 2026-03-04 - Smart Auto-Map Phase 3
 */

import { Node } from '@xyflow/react';
import {
  NodeOutputSchema,
  OutputFieldSchema,
  inferOutputSchema,
  getUpstreamNodes,
  getUpstreamOutputFields,
} from './outputSchemaInference';
import { getResolvedFormFields } from './formFieldsDualModel';
import {
  FieldMatch,
  findFieldMatches,
  deduplicateMatches,
  sortMatchesByScore,
} from './fieldMatching';

/**
 * Suggested field mapping for a target node
 */
export interface FieldMappingSuggestion {
  id: string;
  targetFieldName: string;
  sourceNodeId: string;
  sourceFieldName: string;
  sourceFieldLabel: string;
  matchScore: number;
  matchReason: FieldMatch['matchReason'];
  autoApply: boolean; // True for high-confidence matches (score >= 0.9)
}

/**
 * Auto-mapping suggestions for a node
 */
export interface AutoMappingSuggestions {
  targetNodeId: string;
  suggestions: FieldMappingSuggestion[];
  timestamp: number;
}

/**
 * Auto-Mapping Service
 */
export class AutoMappingService {
  /**
   * Generate field mapping suggestions for a target node
   */
  static suggestMappings(
    nodes: Node[],
    edges: any[],
    targetNodeId: string
  ): AutoMappingSuggestions {
    const targetNode = nodes.find(n => n.id === targetNodeId);

    if (!targetNode) {
      return {
        targetNodeId,
        suggestions: [],
        timestamp: Date.now(),
      };
    }

    // Get upstream nodes
    const upstreamNodes = getUpstreamNodes(nodes, edges, targetNodeId);

    if (upstreamNodes.length === 0) {
      return {
        targetNodeId,
        suggestions: [],
        timestamp: Date.now(),
      };
    }

    // Get target field names
    const targetFieldNames = this.extractTargetFieldNames(targetNode);
    const targetFieldTypes = this.extractTargetFieldTypes(targetNode);

    if (targetFieldNames.length === 0) {
      return {
        targetNodeId,
        suggestions: [],
        timestamp: Date.now(),
      };
    }

    // Find matches from each upstream node
    const allMatches: FieldMatch[] = [];

    upstreamNodes.forEach(upstreamNode => {
      const schema = inferOutputSchema(upstreamNode);

      if (schema) {
        const matches = findFieldMatches(
          upstreamNode.id,
          schema.outputFields,
          targetFieldNames,
          targetFieldTypes
        );

        allMatches.push(...matches);
      }
    });

    // Deduplicate and sort
    const uniqueMatches = deduplicateMatches(allMatches);
    const sortedMatches = sortMatchesByScore(uniqueMatches);

    // Convert to suggestions
    const suggestions: FieldMappingSuggestion[] = sortedMatches.map(match => ({
      id: `${match.sourceNodeId}_${match.sourceField.fieldName}_${match.targetFieldName}`,
      targetFieldName: match.targetFieldName,
      sourceNodeId: match.sourceNodeId,
      sourceFieldName: match.sourceField.fieldName,
      sourceFieldLabel: match.sourceField.label,
      matchScore: match.matchScore,
      matchReason: match.matchReason,
      autoApply: match.matchScore >= 0.9, // High-confidence matches
    }));

    return {
      targetNodeId,
      suggestions,
      timestamp: Date.now(),
    };
  }

  /**
   * Extract field names from target node
   */
  private static extractTargetFieldNames(node: Node): string[] {
    const fieldNames: string[] = [];
    const { data } = node;
    const resolvedFields = getResolvedFormFields(data);

    // From fields array
    if (resolvedFields.length > 0) {
      resolvedFields.forEach((field: any) => {
        const fieldName = field.id || field.name;
        if (fieldName) {
          fieldNames.push(fieldName);
        }
      });
    }

    // From steps array (multi-step forms)
    if (data.steps && Array.isArray(data.steps)) {
      data.steps.forEach((step: any) => {
        if (step.fields && Array.isArray(step.fields)) {
          step.fields.forEach((field: any) => {
            if (field.name) {
              fieldNames.push(field.name);
            }
          });
        }
      });
    }

    return fieldNames;
  }

  /**
   * Extract field types from target node
   */
  private static extractTargetFieldTypes(node: Node): Record<string, string> {
    const fieldTypes: Record<string, string> = {};
    const { data } = node;
    const resolvedFields = getResolvedFormFields(data);

    // From fields array
    if (resolvedFields.length > 0) {
      resolvedFields.forEach((field: any) => {
        const fieldName = field.id || field.name;
        if (fieldName && field.type) {
          fieldTypes[fieldName] = field.type;
        }
      });
    }

    // From steps array
    if (data.steps && Array.isArray(data.steps)) {
      data.steps.forEach((step: any) => {
        if (step.fields && Array.isArray(step.fields)) {
          step.fields.forEach((field: any) => {
            if (field.name && field.type) {
              fieldTypes[field.name] = field.type;
            }
          });
        }
      });
    }

    return fieldTypes;
  }

  /**
   * Apply a field mapping suggestion to a node
   */
  static applySuggestion(
    node: Node,
    suggestion: FieldMappingSuggestion
  ): Node {
    const { data } = node;

    // IMPORTANT: keep this immutable.
    // Shadow-state relies on structural changes to detect dirtiness; in-place mutation can make
    // "Apply" appear to do nothing and/or fail to persist.
    const updatedData: any = { ...data };

    const existing = (updatedData.fieldMappings || updatedData.field_mappings) as any[] | undefined;
    const prevMappings = Array.isArray(existing) ? [...existing] : [];

    // Avoid duplicates (same mapping id or same target+source pair)
    const alreadyExists = prevMappings.some((m) =>
      (m?.id && m.id === suggestion.id) ||
      (m?.targetFieldName === suggestion.targetFieldName &&
        m?.sourceNodeId === suggestion.sourceNodeId &&
        m?.sourceFieldName === suggestion.sourceFieldName)
    );

    if (alreadyExists) {
      return node;
    }

    const nextMapping = {
      id: suggestion.id,
      targetFieldName: suggestion.targetFieldName,
      sourceNodeId: suggestion.sourceNodeId,
      sourceFieldName: suggestion.sourceFieldName,
      autoPopulate: true,
      mode: 'copy',
    };

    updatedData.fieldMappings = [...prevMappings, nextMapping];

    return {
      ...node,
      data: updatedData,
    };
  }

  /**
   * Apply all high-confidence suggestions automatically
   */
  static applyAutoSuggestions(
    node: Node,
    suggestions: AutoMappingSuggestions
  ): Node {
    let updatedNode = node;

    // Apply only high-confidence suggestions
    const autoSuggestions = suggestions.suggestions.filter(s => s.autoApply);

    autoSuggestions.forEach(suggestion => {
      updatedNode = this.applySuggestion(updatedNode, suggestion);
    });

    return updatedNode;
  }

  /**
   * Check if a node already has field mappings
   */
  static hasExistingMappings(node: Node): boolean {
    const mappings = (node.data as any)?.fieldMappings;
    return Array.isArray(mappings) && mappings.length > 0;
  }

  /**
   * Get field mapping for a specific target field
   */
  static getExistingMapping(
    node: Node,
    targetFieldName: string
  ): any | null {
    const mappings = (node.data as any)?.fieldMappings;
    if (!Array.isArray(mappings)) {
      return null;
    }

    return mappings.find((m: any) => m?.targetFieldName === targetFieldName) || null;
  }
}
