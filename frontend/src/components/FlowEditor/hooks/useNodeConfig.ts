/**
 * useNodeConfig Hook
 *
 * Phase E.1: Foundation - Step 2/4 (Shared Hooks)
 *
 * Manages node configuration data with local state, validation, and persistence.
 * Provides consistent API for reading/updating node data across all config panels.
 *
 * Features:
 * - Local state management (shadow state)
 * - Dirty tracking (unsaved changes)
 * - Apply/Discard pattern
 * - Auto-save support
 * - Validation integration
 *
 * @example
 * ```typescript
 * const { config, updateField, isDirty, apply, discard } = useNodeConfig({
 *   node,
 *   onUpdate: (nodeId, data) => setNodes(...),
 * });
 * ```
 *
 * Created: 2026-02-17 - Phase E.1 FlowEditor Refactoring
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Node } from '@xyflow/react';

export interface UseNodeConfigOptions {
  /**
   * The node to configure
   */
  node: Node | null;

  /**
   * Callback when config is applied
   */
  onUpdate: (nodeId: string, data: Record<string, any>) => void;

  /**
   * Auto-save delay in ms (0 to disable)
   * @default 0
   */
  autoSaveDelay?: number;

  /**
   * Callback when changes are discarded
   */
  onDiscard?: () => void;

  /**
   * Callback when config changes (including unsaved)
   */
  onChange?: (data: Record<string, any>) => void;

  /**
   * Default data if node has no data
   */
  defaultData?: Record<string, any>;
}

export interface UseNodeConfigReturn<T = Record<string, any>> {
  /**
   * Current configuration (shadow state)
   */
  config: T;

  /**
   * Original node data (before changes)
   */
  originalConfig: T;

  /**
   * Update a single field
   */
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;

  /**
   * Update multiple fields at once
   */
  updateFields: (fields: Partial<T>) => void;

  /**
   * Replace entire config
   */
  setConfig: (config: T) => void;

  /**
   * Apply changes (persist to node)
   */
  apply: () => void;

  /**
   * Discard changes (revert to original)
   */
  discard: () => void;

  /**
   * Whether config has unsaved changes
   */
  isDirty: boolean;

  /**
   * Reset to original config
   */
  reset: () => void;

  /**
   * Node ID (for convenience)
   */
  nodeId: string | null;
}

/**
 * Deep equality check for objects
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

/**
 * Hook for managing node configuration with shadow state
 *
 * @example
 * ```typescript
 * const ConfigPanel = ({ node, onUpdate }) => {
 *   const {
 *     config,
 *     updateField,
 *     isDirty,
 *     apply,
 *     discard
 *   } = useNodeConfig({ node, onUpdate });
 *
 *   return (
 *     <div>
 *       <Input
 *         value={config.label}
 *         onChange={(e) => updateField('label', e.target.value)}
 *       />
 *
 *       {isDirty && (
 *         <>
 *           <Button onClick={discard}>Discard</Button>
 *           <Button onClick={apply}>Apply</Button>
 *         </>
 *       )}
 *     </div>
 *   );
 * };
 * ```
 */
export function useNodeConfig<T = Record<string, any>>(
  options: UseNodeConfigOptions
): UseNodeConfigReturn<T> {
  const {
    node,
    onUpdate,
    autoSaveDelay = 0,
    onDiscard,
    onChange,
    defaultData = {} as T,
  } = options;

  const nodeId = node?.id || null;
  const originalConfig = useMemo(() => {
    return (node?.data || defaultData) as T;
  }, [node?.data, defaultData]);

  const [config, setConfig] = useState<T>(originalConfig);

  // Sync config when node changes
  useEffect(() => {
    setConfig(originalConfig);
  }, [originalConfig]);

  const isDirty = useMemo(() => {
    return !deepEqual(config, originalConfig);
  }, [config, originalConfig]);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setConfig(prev => {
      const next = { ...prev, [field]: value };
      onChange?.(next as Record<string, any>);
      return next;
    });
  }, [onChange]);

  const updateFields = useCallback((fields: Partial<T>) => {
    setConfig(prev => {
      const next = { ...prev, ...fields };
      onChange?.(next as Record<string, any>);
      return next;
    });
  }, [onChange]);

  const apply = useCallback(() => {
    if (!nodeId) return;
    onUpdate(nodeId, config as Record<string, any>);
  }, [nodeId, config, onUpdate]);

  const discard = useCallback(() => {
    setConfig(originalConfig);
    onDiscard?.();
  }, [originalConfig, onDiscard]);

  const reset = useCallback(() => {
    setConfig(originalConfig);
  }, [originalConfig]);

  // Auto-save support
  useEffect(() => {
    if (autoSaveDelay === 0 || !isDirty) return;

    const timeoutId = setTimeout(() => {
      apply();
    }, autoSaveDelay);

    return () => clearTimeout(timeoutId);
  }, [autoSaveDelay, isDirty, apply]);

  return {
    config,
    originalConfig,
    updateField,
    updateFields,
    setConfig,
    apply,
    discard,
    isDirty,
    reset,
    nodeId,
  };
}
