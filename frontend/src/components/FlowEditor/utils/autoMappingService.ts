/**
 * Auto-Mapping Service
 * 
 * Suggests field mappings between connected nodes in a workflow.
 * Combines output schema inference and field matching to enable Smart Auto-Map.
 * 
 * Created: 2026-03-04 - Smart Auto-Map Phase 3
 */

import { Node } from 'reactflow';
import {
  NodeOutputSchema,
  OutputFieldSchema,
  inferOutputSchema,
  getUpstreamNodes,
  getUpstreamOutputFields,
} from './outputSchemaInference';
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
    
    // From fields array
    if (data.fields && Array.isArray(data.fields)) {
      data.fields.forEach((field: any) => {
        if (field.name) {
          fieldNames.push(field.name);
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
    
    // From fields array
    if (data.fields && Array.isArray(data.fields)) {
      data.fields.forEach((field: any) => {
        if (field.name && field.type) {
          fieldTypes[field.name] = field.type;
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
    const updatedData = { ...data };
    
    // Initialize fieldMappings if not exists
    if (!updatedData.fieldMappings) {
      updatedData.fieldMappings = [];
    }
    
    // Add mapping
    updatedData.fieldMappings.push({
      id: suggestion.id,
      targetFieldName: suggestion.targetFieldName,
      sourceNodeId: suggestion.sourceNodeId,
      sourceFieldName: suggestion.sourceFieldName,
      autoPopulate: true,
      mode: 'copy',
    });
    
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
    return Boolean(node.data?.fieldMappings && node.data.fieldMappings.length > 0);
  }
  
  /**
   * Get field mapping for a specific target field
   */
  static getExistingMapping(
    node: Node,
    targetFieldName: string
  ): any | null {
    if (!node.data?.fieldMappings) {
      return null;
    }
    
    return node.data.fieldMappings.find(
      (m: any) => m.targetFieldName === targetFieldName
    ) || null;
  }
}
