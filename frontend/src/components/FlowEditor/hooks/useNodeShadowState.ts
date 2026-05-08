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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Node } from '@xyflow/react';

import { sanitizeNodeConfigForPersistence } from '../utils/nodeDataSanitization';

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

function sanitizeConfig(value: Record<string, any> | undefined): Record<string, any> {
  return (sanitizeNodeConfigForPersistence(value) as Record<string, any>) || {};
}

function configsDiffer(left: Record<string, any>, right: Record<string, any>): boolean {
  try {
    return JSON.stringify(left) !== JSON.stringify(right);
  } catch {
    return true;
  }
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
  const nodeData = node?.data as NodeDataWithShadow | undefined;

  const committedConfig = useMemo(() => {
    if (!node) return {};
    const data = nodeData;
    if (!data) return {};
    const { config, shadowConfig, configStatus, ...rest } = data;
    return sanitizeConfig({
      ...rest,
      ...(config || {}),
    });
  }, [node, nodeData]);

  const initialShadowConfig = useMemo(() => {
    if (!node) return {};
    const data = nodeData;
    if (!data) return committedConfig;
    return data.shadowConfig ? sanitizeConfig(data.shadowConfig) : committedConfig;
  }, [committedConfig, node, nodeData]);

  const [localShadowConfig, setLocalShadowConfig] = useState<Record<string, any>>(initialShadowConfig);
  const [localStatus, setLocalStatus] = useState<'pristine' | 'editing' | 'dirty'>(() =>
    configsDiffer(initialShadowConfig, committedConfig) ? 'dirty' : 'pristine'
  );
  const previousNodeIdRef = useRef<string | null>(nodeId);

  useEffect(() => {
    if (!nodeId || !node) {
      previousNodeIdRef.current = nodeId;
      setLocalShadowConfig({});
      setLocalStatus('pristine');
      return;
    }

    const nodeChanged = previousNodeIdRef.current !== nodeId;
    previousNodeIdRef.current = nodeId;
    const nextStatus = configsDiffer(initialShadowConfig, committedConfig) ? 'dirty' : 'pristine';

    if (nodeChanged) {
      setLocalShadowConfig(initialShadowConfig);
      setLocalStatus(nextStatus);
      return;
    }

    setLocalShadowConfig((current) => {
      if (configsDiffer(current, committedConfig)) {
        return current;
      }
      return configsDiffer(current, initialShadowConfig) ? initialShadowConfig : current;
    });

    setLocalStatus(configsDiffer(localShadowConfig, committedConfig) ? 'dirty' : nextStatus);
  }, [committedConfig, initialShadowConfig, localShadowConfig, node, nodeId]);

  const shadowConfig = localShadowConfig;

  const isDirty = useMemo(() => configsDiffer(localShadowConfig, committedConfig), [committedConfig, localShadowConfig]);

  const configStatus = useMemo(() => {
    if (isDirty) return 'dirty';
    return localStatus;
  }, [isDirty, localStatus]);

  // Stage shadow config locally so the canvas node array is untouched until Apply.
  const updateShadow = useCallback((changes: Partial<Record<string, any>>) => {
    if (!nodeId) return;

    setLocalShadowConfig((currentShadow) => {
      const newShadow = sanitizeConfig({
        ...currentShadow,
        ...changes,
      });
      setLocalStatus(configsDiffer(newShadow, committedConfig) ? 'dirty' : 'pristine');
      return newShadow;
    });
  }, [committedConfig, nodeId]);

  /**
   * Commit shadow config to main config
   * This should trigger a history entry in the main editor
   */
  const commitShadow = useCallback(() => {
    if (!nodeId) return;

    const sanitizedShadow = sanitizeConfig(localShadowConfig);

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n;

        const currentData = n.data as NodeDataWithShadow;
        const { config, shadowConfig, configStatus, ...rest } = currentData;

        const committedBase = sanitizeConfig({
          ...rest,
          ...(config || {}),
        });

        const committed = {
          ...committedBase,
          ...sanitizedShadow,
        };

        return {
          ...n,
          data: {
            ...committed,
            config: committed,
            shadowConfig: undefined,
            configStatus: 'pristine' as const,
          },
        };
      })
    );

    setLocalShadowConfig(sanitizedShadow);
    setLocalStatus('pristine');
  }, [localShadowConfig, nodeId, setNodes]);

  /**
   * Discard shadow config (revert to last committed)
   */
  const discardShadow = useCallback(() => {
    if (!nodeId) return;

    setLocalShadowConfig(committedConfig);
    setLocalStatus('pristine');

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n;

        const currentData = n.data as NodeDataWithShadow;

        if (!currentData.shadowConfig && currentData.configStatus === 'pristine') {
          return n;
        }

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
  }, [committedConfig, nodeId, setNodes]);

  return {
    shadowConfig,
    configStatus,
    isDirty,
    updateShadow,
    commitShadow,
    discardShadow,
  };
}
