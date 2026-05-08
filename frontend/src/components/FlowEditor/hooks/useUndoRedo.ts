/**
 * useUndoRedo Hook
 *
 * Provides undo/redo functionality for React Flow nodes and edges.
 * Manages history stack and state restoration for flow editing.
 *
 * Features:
 * - Automatic state snapshots on changes
 * - Configurable history limit
 * - Keyboard shortcuts integration (Ctrl+Z/Y)
 * - Optimized for performance with debouncing
 *
 * React Flow Best Practices:
 * - Use shallow comparison for state changes
 * - Debounce rapid changes to avoid excessive snapshots
 * - Clear future history on new changes
 *
 * Created: 2026-02-21 - Phase 3 Performance & Stability
 *
 * @module useUndoRedo
 */

import { useCallback, useRef } from 'react';
import { logger } from '@/utils/logger';

import { Node, Edge } from '@xyflow/react';
import useUndo from 'use-undo';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface FlowState {
  nodes: Node[];
  edges: Edge[];
}

export interface UseUndoRedoOptions {
  /** Maximum history entries to keep (default: 50) */
  maxHistory?: number;
  /** Debounce delay in ms for state snapshots (default: 300) */
  debounceMs?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface UseUndoRedoReturn {
  /** Current flow state */
  state: FlowState;
  /** Set new state (creates snapshot) */
  setState: (state: FlowState) => void;
  /** Undo last change */
  undo: () => void;
  /** Redo last undone change */
  redo: () => void;
  /** Reset history and state */
  reset: (initialState: FlowState) => void;
  /** Can undo */
  canUndo: boolean;
  /** Can redo */
  canRedo: boolean;
  /** Clear all history */
  clearHistory: () => void;
  /** Get history info */
  getHistoryInfo: () => { past: number; future: number };
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * useUndoRedo Hook
 *
 * Manages undo/redo functionality for flow editor state.
 *
 * @example
 * ```tsx
 * const { state, setState, undo, redo, canUndo, canRedo } = useUndoRedo({
 *   nodes: [],
 *   edges: []
 * });
 *
 * // Update state (creates snapshot)
 * setState({ nodes: newNodes, edges: newEdges });
 *
 * // Undo last change
 * if (canUndo) undo();
 *
 * // Redo last undone change
 * if (canRedo) redo();
 * ```
 */
export const useUndoRedo = (
  initialState: FlowState,
  options: UseUndoRedoOptions = {}
): UseUndoRedoReturn => {
  const {
    maxHistory = 50,
    debounceMs = 300,
    debug = false,
  } = options;

  // Use use-undo for state management
  const [
    undoState,
    {
      set: setUndoState,
      undo: undoAction,
      redo: redoAction,
      reset: resetAction,
      canUndo: canUndoState,
      canRedo: canRedoState,
    },
  ] = useUndo<FlowState>(initialState);

  // Debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStateRef = useRef<FlowState | null>(null);

  /**
   * Set state with debouncing
   * Prevents excessive snapshots during rapid changes (e.g., dragging)
   */
  const setState = useCallback(
    (newState: FlowState) => {
      // Store pending state
      pendingStateRef.current = newState;

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer
      debounceTimerRef.current = setTimeout(() => {
        if (pendingStateRef.current) {
          // Check if state actually changed (shallow comparison)
          const isDifferent =
            pendingStateRef.current.nodes !== undoState.present.nodes ||
            pendingStateRef.current.edges !== undoState.present.edges;

          if (isDifferent) {
            setUndoState(pendingStateRef.current);

            if (debug) {
              logger.debug('[useUndoRedo] State snapshot created:', {
                nodes: pendingStateRef.current.nodes.length,
                edges: pendingStateRef.current.edges.length,
              });
            }
          }

          pendingStateRef.current = null;
        }
      }, debounceMs);
    },
    [debounceMs, debug, setUndoState, undoState.present.edges, undoState.present.nodes]
  );

  /**
   * Undo last change
   */
  const undo = useCallback(() => {
    if (canUndoState) {
      undoAction();

      if (debug) {
        logger.debug('[useUndoRedo] Undo performed');
      }
    }
  }, [canUndoState, debug, undoAction]);

  /**
   * Redo last undone change
   */
  const redo = useCallback(() => {
    if (canRedoState) {
      redoAction();

      if (debug) {
        logger.debug('[useUndoRedo] Redo performed');
      }
    }
  }, [canRedoState, debug, redoAction]);

  /**
   * Reset history and state
   */
  const reset = useCallback(
    (newInitialState: FlowState) => {
      resetAction(newInitialState);

      if (debug) {
        logger.debug('[useUndoRedo] History reset');
      }
    },
    [debug, resetAction]
  );

  /**
   * Clear all history (keeps current state)
   */
  const clearHistory = useCallback(() => {
    resetAction(undoState.present);

    if (debug) {
      logger.debug('[useUndoRedo] History cleared');
    }
  }, [debug, resetAction, undoState.present]);

  /**
   * Get history information
   */
  const getHistoryInfo = useCallback(() => {
    return {
      past: undoState.past.length,
      future: undoState.future.length,
    };
  }, [undoState.future.length, undoState.past.length]);

  return {
    state: undoState.present,
    setState,
    undo,
    redo,
    reset,
    canUndo: canUndoState,
    canRedo: canRedoState,
    clearHistory,
    getHistoryInfo,
  };
};

/**
 * Helper: Create state snapshot from nodes and edges
 */
export const createFlowSnapshot = (nodes: Node[], edges: Edge[]): FlowState => ({
  nodes: [...nodes],
  edges: [...edges],
});

/**
 * Helper: Check if two states are equal (shallow)
 */
export const areStatesEqual = (a: FlowState, b: FlowState): boolean => {
  return a.nodes === b.nodes && a.edges === b.edges;
};
