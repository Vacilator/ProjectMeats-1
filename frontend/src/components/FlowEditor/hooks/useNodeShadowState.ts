/**
 * useNodeShadowState Hook
 * 
 * Phase 2: Shadow State Sidebar
 * Provides non-destructive editing for node configuration.
 * 
 * Purpose:
 * - Captures uncommitted sidebar edits in `shadowConfig`
 * - Prevents history bloat from every keystroke
 * - Allows Apply/Discard workflow
 * - Improves UX with dirty indicators
 * 
 * Usage:
 * ```typescript
 * const { shadowConfig, updateShadow, commitShadow, discardShadow, isDirty } 
 *   = useNodeShadowState(nodeId, nodes, setNodes);
 * ```
 * 
 * Created: 2026-02-12 - Phase 2 Shadow State Implementation
 */

import { useCallback, useMemo } from 'react';
import { Node } from '@xyflow/react';

/**
 * Extended node data interface with shadow state support
 */
export interface NodeDataWithShadow {
  config?: Record<string, any>;         // Committed configuration
  shadowConfig?: Record<string, any>;   // Uncommitted changes (WIP)
  configStatus?: 'pristine' | 'editing' | 'dirty';
  [key: string]: any;                   // Allow other properties
}

export interface UseNodeShadowStateReturn {
  /** Current shadow config (falls back to committed config if no shadow) */
  shadowConfig: Record<string, any>;
  
  /** Current editing status */
  configStatus: 'pristine' | 'editing' | 'dirty';
  
  /** Whether uncommitted changes exist */
  isDirty: boolean;
  
  /** Update shadow config (doesn't affect committed config) */
  updateShadow: (changes: Partial<Record<string, any>>) => void;
  
  /** Commit shadow config to main config (creates history entry) */
  commitShadow: () => void;
  
  /** Discard shadow config (revert to last committed) */
  discardShadow: () => void;
}

/**
 * Hook for managing node shadow state
 * 
 * @param nodeId - ID of the node to manage
 * @param nodes - Current nodes array from React Flow
 * @param setNodes - React Flow setNodes function
 * @returns Shadow state management API
 */
export function useNodeShadowState(
  nodeId: string | null,
  nodes: Node[],
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
): UseNodeShadowStateReturn {
  
  // Find the current node
  const node = useMemo(() => {
    if (!nodeId) return null;
    return nodes.find(n => n.id === nodeId);
  }, [nodeId, nodes]);

  // Extract shadow config and status
  const shadowConfig = useMemo(() => {
    if (!node) return {};
    const data = node.data as NodeDataWithShadow;
    
    // If shadow config exists, use it (editing in progress)
    if (data.shadowConfig) {
      return data.shadowConfig;
    }
    
    // Otherwise, return committed config or all data
    return data.config || { ...data };
  }, [node]);

  const configStatus = useMemo(() => {
    if (!node) return 'pristine';
    const data = node.data as NodeDataWithShadow;
    return data.configStatus || 'pristine';
  }, [node]);

  const isDirty = useMemo(() => {
    return configStatus === 'dirty';
  }, [configStatus]);

  /**
   * Update shadow config without affecting committed config
   * Sets status to 'editing' on first change, 'dirty' if different from committed
   */
  const updateShadow = useCallback((changes: Partial<Record<string, any>>) => {
    if (!nodeId) return;

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n;

        const currentData = n.data as NodeDataWithShadow;
        const committedConfig = currentData.config || { ...currentData };
        const currentShadow = currentData.shadowConfig || committedConfig;

        // Merge changes into shadow config
        const newShadow = {
          ...currentShadow,
          ...changes,
        };

        // Check if shadow differs from committed
        const isDifferent = JSON.stringify(newShadow) !== JSON.stringify(committedConfig);

        return {
          ...n,
          data: {
            ...currentData,
            shadowConfig: newShadow,
            configStatus: isDifferent ? ('dirty' as const) : ('pristine' as const),
          },
        };
      })
    );
  }, [nodeId, setNodes]);

  /**
   * Commit shadow config to main config
   * This should trigger a history entry in the main editor
   */
  const commitShadow = useCallback(() => {
    if (!nodeId) return;

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n;

        const currentData = n.data as NodeDataWithShadow;
        const shadow = currentData.shadowConfig;

        if (!shadow) return n; // Nothing to commit

        // Merge shadow into main data and clear shadow
        return {
          ...n,
          data: {
            ...currentData,
            ...shadow,
            config: shadow,
            shadowConfig: undefined,
            configStatus: 'pristine' as const,
          },
        };
      })
    );
  }, [nodeId, setNodes]);

  /**
   * Discard shadow config (revert to last committed)
   */
  const discardShadow = useCallback(() => {
    if (!nodeId) return;

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n;

        const currentData = n.data as NodeDataWithShadow;

        // Clear shadow and reset status
        return {
          ...n,
          data: {
            ...currentData,
            shadowConfig: undefined,
            configStatus: 'pristine' as const,
          },
        };
      })
    );
  }, [nodeId, setNodes]);

  return {
    shadowConfig,
    configStatus,
    isDirty,
    updateShadow,
    commitShadow,
    discardShadow,
  };
}
