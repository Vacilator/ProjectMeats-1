/**
 * Batch Operations Hook for Flow Editor
 * Phase 7.2: Batch Operations
 *
 * Provides clipboard functionality and batch node operations:
 * - Copy/Cut/Paste nodes
 * - Duplicate selection
 * - Delete selection
 * - Group alignment
 * - Keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+X, Del)
 *
 * Created: 2026-02-27
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Node, Edge, useReactFlow } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface ClipboardData {
  nodes: Node[];
  edges: Edge[];
  timestamp: number;
}

interface BatchOperationsOptions {
  /** Whether keyboard shortcuts are enabled (default: true) */
  enableKeyboardShortcuts?: boolean;
  /** Callback when nodes are copied */
  onCopy?: (nodeCount: number) => void;
  /** Callback when nodes are pasted */
  onPaste?: (nodeCount: number) => void;
  /** Callback when nodes are deleted */
  onDelete?: (nodeCount: number) => void;
}

interface BatchOperationsResult {
  /** Copy selected nodes to clipboard */
  copySelection: () => void;
  /** Cut selected nodes to clipboard */
  cutSelection: () => void;
  /** Paste nodes from clipboard */
  pasteSelection: () => void;
  /** Duplicate selected nodes */
  duplicateSelection: () => void;
  /** Delete selected nodes */
  deleteSelection: () => void;
  /** Align selected nodes horizontally */
  alignHorizontal: (alignment: 'left' | 'center' | 'right') => void;
  /** Align selected nodes vertically */
  alignVertical: (alignment: 'top' | 'center' | 'bottom') => void;
  /** Distribute nodes evenly */
  distributeHorizontally: () => void;
  distributeVertically: () => void;
  /** Number of items in clipboard */
  clipboardCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const PASTE_OFFSET = 30; // px offset for pasted nodes
const STORAGE_KEY = 'floweditor_clipboard';

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for batch node operations with clipboard functionality.
 *
 * @example
 * ```tsx
 * const {
 *   copySelection,
 *   pasteSelection,
 *   deleteSelection,
 *   alignHorizontal
 * } = useBatchOperations({
 *   onCopy: (count) => toast.success(`Copied ${count} nodes`),
 *   onPaste: (count) => toast.success(`Pasted ${count} nodes`)
 * });
 * ```
 */
export function useBatchOperations(
  options: BatchOperationsOptions = {}
): BatchOperationsResult {
  const {
    enableKeyboardShortcuts = true,
    onCopy,
    onPaste,
    onDelete,
  } = options;

  const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();
  const clipboardRef = useRef<ClipboardData | null>(null);
  const [clipboardCount, setClipboardCount] = useState(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as ClipboardData;
      if (parsed?.nodes?.length) {
        clipboardRef.current = parsed;
        setClipboardCount(parsed.nodes.length);
      }
    } catch {
      // ignore
    }
  }, []);

  /**
   * Get currently selected nodes
   */
  const getSelectedNodes = useCallback((): Node[] => {
    return getNodes().filter((node) => node.selected);
  }, [getNodes]);

  /**
   * Get edges connecting selected nodes
   */
  const getSelectedEdges = useCallback((selectedNodes: Node[]): Edge[] => {
    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));
    return getEdges().filter(
      (edge) =>
        selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    );
  }, [getEdges]);

  /**
   * Copy selected nodes to clipboard
   */
  const copySelection = useCallback(() => {
    const selectedNodes = getSelectedNodes();
    if (selectedNodes.length === 0) return;

    const selectedEdges = getSelectedEdges(selectedNodes);

    const clipboardData: ClipboardData = {
      nodes: selectedNodes,
      edges: selectedEdges,
      timestamp: Date.now(),
    };

    clipboardRef.current = clipboardData;
    setClipboardCount(selectedNodes.length);

    // Also store in localStorage for cross-session clipboard
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clipboardData));
    } catch (error) {
      logger.warn('Failed to save clipboard to localStorage:', error);
    }

    onCopy?.(selectedNodes.length);
  }, [getSelectedNodes, getSelectedEdges, onCopy]);

  /**
   * Cut selected nodes to clipboard
   */
  const cutSelection = useCallback(() => {
    const selectedNodes = getSelectedNodes();
    if (selectedNodes.length === 0) return;

    // Copy to clipboard
    copySelection();

    // Delete selected nodes
    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));
    setNodes((nodes) => nodes.filter((node) => !selectedNodeIds.has(node.id)));
    setEdges((edges) =>
      edges.filter(
        (edge) =>
          !selectedNodeIds.has(edge.source) &&
          !selectedNodeIds.has(edge.target)
      )
    );

    onDelete?.(selectedNodes.length);
  }, [getSelectedNodes, copySelection, setNodes, setEdges, onDelete]);

  /**
   * Paste nodes from clipboard
   */
  const pasteSelection = useCallback(() => {
    const clipboardData = clipboardRef.current;
    if (!clipboardData || clipboardData.nodes.length === 0) {
      // Try to restore from localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          clipboardRef.current = JSON.parse(stored);
          setClipboardCount(clipboardRef.current?.nodes?.length ?? 0);
          pasteSelection(); // Recursive call with restored data
          return;
        }
      } catch (error) {
        logger.warn('Failed to restore clipboard from localStorage:', error);
      }
      return;
    }

    // Generate new IDs for pasted nodes
    const idMap = new Map<string, string>();
    clipboardData.nodes.forEach((node) => {
      idMap.set(node.id, uuidv4());
    });

    // Clone nodes with new IDs and offset positions
    const pastedNodes: Node[] = clipboardData.nodes.map((node) => ({
      ...node,
      id: idMap.get(node.id)!,
      position: {
        x: node.position.x + PASTE_OFFSET,
        y: node.position.y + PASTE_OFFSET,
      },
      selected: true, // Select pasted nodes
    }));

    // Clone edges with updated source/target IDs
    const pastedEdges: Edge[] = clipboardData.edges
      .map((edge) => {
        const newSource = idMap.get(edge.source);
        const newTarget = idMap.get(edge.target);
        if (!newSource || !newTarget) return null;

        return {
          ...edge,
          id: uuidv4(),
          source: newSource,
          target: newTarget,
        };
      })
      .filter((edge): edge is Edge => edge !== null);

    // Deselect existing nodes
    setNodes((nodes) =>
      (nodes.map((node) => ({ ...node, selected: false })) as Node[]).concat(pastedNodes)
    );
    setEdges((edges) => edges.concat(pastedEdges));

    onPaste?.(pastedNodes.length);
  }, [setNodes, setEdges, onPaste]);

  /**
   * Duplicate selected nodes (copy + paste in one action)
   */
  const duplicateSelection = useCallback(() => {
    copySelection();
    pasteSelection();
  }, [copySelection, pasteSelection]);

  /**
   * Delete selected nodes
   */
  const deleteSelection = useCallback(() => {
    const selectedNodes = getSelectedNodes();
    if (selectedNodes.length === 0) return;

    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));
    setNodes((nodes) => nodes.filter((node) => !selectedNodeIds.has(node.id)));
    setEdges((edges) =>
      edges.filter(
        (edge) =>
          !selectedNodeIds.has(edge.source) &&
          !selectedNodeIds.has(edge.target)
      )
    );

    onDelete?.(selectedNodes.length);
  }, [getSelectedNodes, setNodes, setEdges, onDelete]);

  /**
   * Align selected nodes horizontally
   */
  const alignHorizontal = useCallback(
    (alignment: 'left' | 'center' | 'right') => {
      const selectedNodes = getSelectedNodes();
      if (selectedNodes.length < 2) return;

      const positions = selectedNodes.map((n) => n.position.x);
      let targetX: number;

      switch (alignment) {
        case 'left':
          targetX = Math.min(...positions);
          break;
        case 'center':
          targetX =
            (Math.min(...positions) + Math.max(...positions)) / 2;
          break;
        case 'right':
          targetX = Math.max(...positions);
          break;
      }

      setNodes((nodes) =>
        nodes.map((node) =>
          node.selected
            ? { ...node, position: { ...node.position, x: targetX } }
            : node
        )
      );
    },
    [getSelectedNodes, setNodes]
  );

  /**
   * Align selected nodes vertically
   */
  const alignVertical = useCallback(
    (alignment: 'top' | 'center' | 'bottom') => {
      const selectedNodes = getSelectedNodes();
      if (selectedNodes.length < 2) return;

      const positions = selectedNodes.map((n) => n.position.y);
      let targetY: number;

      switch (alignment) {
        case 'top':
          targetY = Math.min(...positions);
          break;
        case 'center':
          targetY =
            (Math.min(...positions) + Math.max(...positions)) / 2;
          break;
        case 'bottom':
          targetY = Math.max(...positions);
          break;
      }

      setNodes((nodes) =>
        nodes.map((node) =>
          node.selected
            ? { ...node, position: { ...node.position, y: targetY } }
            : node
        )
      );
    },
    [getSelectedNodes, setNodes]
  );

  /**
   * Distribute nodes evenly horizontally
   */
  const distributeHorizontally = useCallback(() => {
    const selectedNodes = getSelectedNodes();
    if (selectedNodes.length < 3) return;

    const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
    const totalWidth = sorted[sorted.length - 1].position.x - sorted[0].position.x;
    const spacing = totalWidth / (sorted.length - 1);

    setNodes((nodes) =>
      nodes.map((node) => {
        const index = sorted.findIndex((n) => n.id === node.id);
        if (index === -1 || index === 0 || index === sorted.length - 1) {
          return node;
        }
        return {
          ...node,
          position: {
            ...node.position,
            x: sorted[0].position.x + spacing * index,
          },
        };
      })
    );
  }, [getSelectedNodes, setNodes]);

  /**
   * Distribute nodes evenly vertically
   */
  const distributeVertically = useCallback(() => {
    const selectedNodes = getSelectedNodes();
    if (selectedNodes.length < 3) return;

    const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
    const totalHeight = sorted[sorted.length - 1].position.y - sorted[0].position.y;
    const spacing = totalHeight / (sorted.length - 1);

    setNodes((nodes) =>
      nodes.map((node) => {
        const index = sorted.findIndex((n) => n.id === node.id);
        if (index === -1 || index === 0 || index === sorted.length - 1) {
          return node;
        }
        return {
          ...node,
          position: {
            ...node.position,
            y: sorted[0].position.y + spacing * index,
          },
        };
      })
    );
  }, [getSelectedNodes, setNodes]);

  /**
   * Keyboard shortcuts handler
   */
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? event.metaKey : event.ctrlKey;

      // Copy: Ctrl/Cmd + C
      if (modKey && event.key === 'c') {
        event.preventDefault();
        copySelection();
      }

      // Cut: Ctrl/Cmd + X
      if (modKey && event.key === 'x') {
        event.preventDefault();
        cutSelection();
      }

      // Paste: Ctrl/Cmd + V
      if (modKey && event.key === 'v') {
        event.preventDefault();
        pasteSelection();
      }

      // Duplicate: Ctrl/Cmd + D
      if (modKey && event.key === 'd') {
        event.preventDefault();
        duplicateSelection();
      }

      // Delete: Delete or Backspace
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enableKeyboardShortcuts,
    copySelection,
    cutSelection,
    pasteSelection,
    duplicateSelection,
    deleteSelection,
  ]);

  return {
    copySelection,
    cutSelection,
    pasteSelection,
    duplicateSelection,
    deleteSelection,
    alignHorizontal,
    alignVertical,
    distributeHorizontally,
    distributeVertically,
    clipboardCount,
  };
}
