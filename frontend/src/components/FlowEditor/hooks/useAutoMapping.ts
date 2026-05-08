/**
 * useAutoMapping Hook
 *
 * React hook for Smart Auto-Map functionality in the workflow editor.
 * Provides field mapping suggestions and application logic.
 *
 * Created: 2026-03-04 - Smart Auto-Map Phase 3
 */

import { useState, useEffect, useCallback } from 'react';
import { Node, useReactFlow } from '@xyflow/react';
import {
  AutoMappingService,
  AutoMappingSuggestions,
  FieldMappingSuggestion,
} from '../utils/autoMappingService';
import { attachOutputSchemaToNode } from '../utils/outputSchemaInference';

import { logger } from '@/utils/logger';

/**
 * Hook return type
 */
export interface UseAutoMappingReturn {
  suggestions: AutoMappingSuggestions | null;
  loading: boolean;
  error: string | null;
  generateSuggestions: (nodeId: string) => void;
  applySuggestion: (nodeId: string, suggestion: FieldMappingSuggestion) => void;
  applyAllSuggestions: (nodeId: string) => void;
  dismissSuggestion: (suggestionId: string) => void;
  clearSuggestions: () => void;
}

/**
 * Hook for auto-mapping functionality
 */
export function useAutoMapping(): UseAutoMappingReturn {
  const { getNodes, getEdges, setNodes } = useReactFlow();
  const [suggestions, setSuggestions] = useState<AutoMappingSuggestions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Generate field mapping suggestions for a node
   */
  const generateSuggestions = useCallback((nodeId: string) => {
    setLoading(true);
    setError(null);

    try {
      const nodes = getNodes();
      const edges = getEdges();

      // Ensure all nodes have output schemas
      const nodesWithSchemas = nodes.map(attachOutputSchemaToNode);

      // Generate suggestions
      const mappingSuggestions = AutoMappingService.suggestMappings(
        nodesWithSchemas,
        edges,
        nodeId
      );

      setSuggestions(mappingSuggestions);

      logger.debug('Generated suggestions', { component: 'AutoMapping', metadata: { mappingSuggestions } });
    } catch (err) {
      logger.error('[AutoMapping] Failed to generate suggestions:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions');
    } finally {
      setLoading(false);
    }
  }, [getNodes, getEdges]);

  /**
   * Apply a single suggestion
   */
  const applySuggestion = useCallback((nodeId: string, suggestion: FieldMappingSuggestion) => {
    setNodes((nodes) => {
      return nodes.map((node) => {
        if (node.id === nodeId) {
          const updatedNode = AutoMappingService.applySuggestion(node, suggestion);
          logger.debug('Applied suggestion', { component: 'AutoMapping', metadata: { suggestion } });
          return updatedNode;
        }
        return node;
      });
    });

    // UX: remove accepted suggestion immediately.
    setSuggestions((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        suggestions: prev.suggestions.filter((s) => s.id !== suggestion.id),
      };
    });
  }, [setNodes]);

  /**
   * Apply all high-confidence suggestions
   */
  const applyAllSuggestions = useCallback((nodeId: string) => {
    if (!suggestions) {
      return;
    }

    setNodes((nodes) => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          const updatedNode = AutoMappingService.applyAutoSuggestions(node, suggestions);
          logger.debug('Applied all auto-suggestions', { component: 'AutoMapping' });
          return updatedNode;
        }
        return node;
      });
    });

    // Clear suggestions after applying
    setSuggestions(null);
  }, [suggestions, setNodes]);

  /**
   * Clear suggestions
   */
  const dismissSuggestion = useCallback((suggestionId: string) => {
    setSuggestions((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        suggestions: prev.suggestions.filter((s) => s.id !== suggestionId),
      };
    });
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions(null);
    setError(null);
  }, []);

  return {
    suggestions,
    loading,
    error,
    generateSuggestions,
    applySuggestion,
    applyAllSuggestions,
    dismissSuggestion,
    clearSuggestions,
  };
}
