/**
 * useKeyboardShortcuts Hook
 *
 * Comprehensive keyboard shortcut system for FlowEditor.
 * Provides industry-standard shortcuts for common operations.
 *
 * Features:
 * - Undo/Redo (Ctrl+Z / Ctrl+Y)
 * - Delete (Del / Backspace)
 * - Select All (Ctrl+A)
 * - Copy/Paste (Ctrl+C / Ctrl+V)
 * - Duplicate (Ctrl+D)
 * - Layout (Ctrl+L)
 * - Save (Ctrl+S)
 * - Search (Ctrl+F)
 *
 * Created: 2026-02-21 - Phase 2: UI/UX Enhancements
 */

import { useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useReactFlow } from '@xyflow/react';
import { isTypingInInput } from '../utils/keyboardUtils';

export interface KeyboardShortcutsOptions {
  /** Enable undo/redo shortcuts */
  enableHistory?: boolean;
  /** Enable delete shortcuts */
  enableDelete?: boolean;
  /** Enable copy/paste shortcuts */
  enableClipboard?: boolean;
  /** Enable layout shortcuts */
  enableLayout?: boolean;
  /** Enable save shortcut */
  enableSave?: boolean;
  /** Custom handlers */
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onDuplicate?: () => void;
  onLayout?: () => void;
  onSave?: () => void;
  onSearch?: () => void;
}

/**
 * Hook for managing keyboard shortcuts in FlowEditor
 */
export const useKeyboardShortcuts = (options: KeyboardShortcutsOptions = {}) => {
  const {
    enableHistory = true,
    enableDelete = true,
    enableClipboard = true,
    enableLayout = true,
    enableSave = true,
    onUndo,
    onRedo,
    onDelete,
    onCopy,
    onPaste,
    onDuplicate,
    onLayout,
    onSave,
    onSearch,
  } = options;

  const { getNodes, setNodes, getEdges, setEdges } = useReactFlow();

  /**
   * Centralized keydown guard.
   *
   * IMPORTANT: The first line must be the typing-context check to avoid
   * rogue shortcuts intercepting text entry (Monaco, AntD, inline editors, etc.).
   */
  const handleKeyDown = useCallback((event: KeyboardEvent, action: () => void) => {
    if (isTypingInInput(event)) return;
    action();
  }, []);

  // Undo - Ctrl+Z
  useHotkeys(
    'ctrl+z, meta+z',
    (e) => {
      handleKeyDown(e, () => {
        e.preventDefault();
        onUndo?.();
      });
    },
    {
      enabled: enableHistory,
      enableOnFormTags: false,
    },
    [onUndo, handleKeyDown]
  );

  // Redo - Ctrl+Y or Ctrl+Shift+Z
  useHotkeys(
    'ctrl+y, meta+y, ctrl+shift+z, meta+shift+z',
    (e) => {
      handleKeyDown(e, () => {
        e.preventDefault();
        onRedo?.();
      });
    },
    {
      enabled: enableHistory,
      enableOnFormTags: false,
    },
    [onRedo, handleKeyDown]
  );

  // Delete - Del or Backspace
  useHotkeys(
    'delete, backspace',
    (e) => {
      handleKeyDown(e, () => {
        e.preventDefault();

        if (onDelete) {
          onDelete();
          return;
        }

        const nodes = getNodes();
        const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id);

        if (selectedNodeIds.length > 0) {
          setNodes((nds) => nds.filter((n) => !n.selected));
          setEdges((eds) =>
            eds.filter(
              (edge) => !selectedNodeIds.includes(edge.source) && !selectedNodeIds.includes(edge.target)
            )
          );
        } else {
          // Delete selected edges
          setEdges((eds) => eds.filter((edge) => !edge.selected));
        }
      });
    },
    {
      enabled: enableDelete,
      enableOnFormTags: false,
    },
    [onDelete, getNodes, setNodes, setEdges, handleKeyDown]
  );

  // Copy - Ctrl+C
  useHotkeys(
    'ctrl+c, meta+c',
    (e) => {
      handleKeyDown(e, () => {
        e.preventDefault();
        onCopy?.();
      });
    },
    {
      enabled: enableClipboard,
      enableOnFormTags: false,
    },
    [onCopy, handleKeyDown]
  );

  // Paste - Ctrl+V
  useHotkeys(
    'ctrl+v, meta+v',
    (e) => {
      handleKeyDown(e, () => {
        e.preventDefault();
        onPaste?.();
      });
    },
    {
      enabled: enableClipboard,
      enableOnFormTags: false,
    },
    [onPaste, handleKeyDown]
  );

  // Duplicate - Ctrl+D
  useHotkeys(
    'ctrl+d, meta+d',
    (e) => {
      handleKeyDown(e, () => {
        e.preventDefault();

        if (onDuplicate) {
          onDuplicate();
          return;
        }

        const nodes = getNodes();
        const selectedNodes = nodes.filter((n) => n.selected);

        if (selectedNodes.length > 0) {
          const createId = () =>
            globalThis.crypto?.randomUUID
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

          const duplicates = selectedNodes.map((node) => ({
            ...node,
            id: createId(),
            position: {
              x: node.position.x + 50,
              y: node.position.y + 50,
            },
            selected: false,
          }));

          setNodes((nds) => [
            ...nds.map((n) => ({ ...n, selected: false })),
            ...duplicates.map((d) => ({ ...d, selected: true })),
          ]);
        }
      });
    },
    {
      enabled: enableClipboard,
      enableOnFormTags: false,
    },
    [onDuplicate, getNodes, setNodes, handleKeyDown]
  );

  // Auto-layout - Ctrl+L
  useHotkeys(
    'ctrl+l, meta+l',
    (e) => {
      handleKeyDown(e, () => {
        e.preventDefault();
        onLayout?.();
      });
    },
    {
      enabled: enableLayout,
      enableOnFormTags: false,
    },
    [onLayout, handleKeyDown]
  );

  // Save - Ctrl+S
  useHotkeys(
    'ctrl+s, meta+s',
    (e) => {
      handleKeyDown(e, () => {
        e.preventDefault();
        onSave?.();
      });
    },
    {
      enabled: enableSave,
      enableOnFormTags: false,
    },
    [onSave, handleKeyDown]
  );

  // Search - Ctrl+F
  useHotkeys(
    'ctrl+f, meta+f',
    (e) => {
      handleKeyDown(e, () => {
        e.preventDefault();
        onSearch?.();
      });
    },
    {
      enableOnFormTags: false,
    },
    [onSearch, handleKeyDown]
  );

  // Select All - Ctrl+A
  useHotkeys(
    'ctrl+a, meta+a',
    (e) => {
      handleKeyDown(e, () => {
        e.preventDefault();
        setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
        setEdges((eds) => eds.map((edge) => ({ ...edge, selected: true })));
      });
    },
    {
      enableOnFormTags: false,
    },
    [setNodes, setEdges, handleKeyDown]
  );

  // Escape - Clear selection and close panels
  useHotkeys(
    'escape',
    (e) => {
      handleKeyDown(e, () => {
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
        setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })));
      });
    },
    {
      enableOnFormTags: false,
    },
    [setNodes, setEdges, handleKeyDown]
  );
};
